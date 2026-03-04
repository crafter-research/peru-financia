/**
 * entity-resolution.ts
 *
 * Deduplicación de donantes usando Claude Haiku.
 * Detecta variaciones del mismo donante (e.g. "JOSE GARCIA" vs "JOSÉ GARCÍA")
 * y normaliza nombres en financing_records.
 *
 * Uso:
 *   bun run scripts/entity-resolution.ts
 *   bun run scripts/entity-resolution.ts --dry-run
 */

import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicKey) {
  console.error("ANTHROPIC_API_KEY not set");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: anthropicKey });
const sql = neon(dbUrl);

type DonorGroup = {
  canonical: string;
  aliases: string[];
};

async function getDonorNames(): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT donor_name
    FROM financing_records
    WHERE donor_name IS NOT NULL AND donor_name != ''
    ORDER BY donor_name
  `;
  return rows.map((r) => r.donor_name as string);
}

async function resolveDuplicates(names: string[]): Promise<DonorGroup[]> {
  const BATCH_SIZE = 50;
  const groups: DonorGroup[] = [];

  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(names.length / BATCH_SIZE)}...`);

    const prompt = `You are deduplicating donor names from Peruvian political financing records.

Given this list of donor names, identify groups of names that refer to the same entity.
Consider: accent variations, abbreviations, partial names, RUC formatting differences.

Names:
${batch.map((n, idx) => `${idx + 1}. ${n}`).join("\n")}

Return ONLY a JSON array of groups where duplicates exist (skip names with no duplicates):
[
  {
    "canonical": "the most complete/correct name",
    "aliases": ["other name variants that are the same entity"]
  }
]

If no duplicates found, return empty array: []`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const batchGroups: DonorGroup[] = JSON.parse(jsonMatch[0]);
        groups.push(...batchGroups);
      }
    } catch {
      console.warn("  Failed to parse response for batch, skipping");
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return groups;
}

async function applyResolution(groups: DonorGroup[]): Promise<void> {
  let totalUpdated = 0;

  for (const group of groups) {
    for (const alias of group.aliases) {
      if (dryRun) {
        console.log(`  [dry-run] "${alias}" → "${group.canonical}"`);
        continue;
      }

      const result = await sql`
        UPDATE financing_records
        SET donor_name = ${group.canonical}
        WHERE donor_name = ${alias}
      `;

      totalUpdated += (result as unknown[]).length;
    }
  }

  console.log(`\nUpdated ${totalUpdated} records${dryRun ? " (dry-run)" : ""}`);
}

// Main
console.log("Loading donor names...");
const names = await getDonorNames();
console.log(`Found ${names.length} unique donor names`);

if (names.length === 0) {
  console.log("No donors to process");
  process.exit(0);
}

console.log("Resolving duplicates with Claude Haiku...");
const groups = await resolveDuplicates(names);

console.log(`\nFound ${groups.length} duplicate groups:`);
for (const group of groups) {
  console.log(`  "${group.canonical}" ← ${group.aliases.map((a) => `"${a}"`).join(", ")}`);
}

console.log(`\nApplying resolution${dryRun ? " (dry-run)" : ""}...`);
await applyResolution(groups);

console.log("Done.");
