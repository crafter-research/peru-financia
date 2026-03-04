import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type FinancingRecord = {
  id: string;
  source: string;
  year: number;
  electoral_process: string | null;
  party_name: string;
  party_type: string | null;
  financing_type: string | null;
  donor_name: string | null;
  donor_dni_ruc: string | null;
  donor_type: string | null;
  amount_soles: number;
  donation_type: string | null;
  date: string | null;
  candidate_name: string | null;
};

export type SankeyNode = {
  name: string;
};

export type SankeyLink = {
  source: number;
  target: number;
  value: number;
};

export type SankeyData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
};

export async function getFinancingRecords(
  year?: number,
  partyName?: string,
  financingType?: string
): Promise<FinancingRecord[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let idx = 1;

  if (year) {
    conditions.push(`year = $${idx++}`);
    params.push(year);
  }
  if (partyName) {
    conditions.push(`party_name ILIKE $${idx++}`);
    params.push(`%${partyName}%`);
  }
  if (financingType) {
    conditions.push(`financing_type = $${idx++}`);
    params.push(financingType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return sql`
    SELECT id, source, year, electoral_process, party_name, party_type,
           financing_type, donor_name, donor_dni_ruc, donor_type,
           amount_soles::float, donation_type, date::text, candidate_name
    FROM financing_records
    ${sql.unsafe(where)}
    ORDER BY amount_soles DESC
    LIMIT 500
  ` as Promise<FinancingRecord[]>;
}

export async function getSankeyData(year: number): Promise<SankeyData> {
  const rows = await sql`
    SELECT
      COALESCE(donor_type, 'desconocido') as donor_type,
      financing_type,
      party_name,
      SUM(amount_soles) as total
    FROM financing_records
    WHERE year = ${year} AND amount_soles > 0
    GROUP BY donor_type, financing_type, party_name
    ORDER BY total DESC
    LIMIT 100
  `;

  const nodeSet = new Set<string>();
  for (const row of rows) {
    nodeSet.add(row.donor_type as string);
    if (row.financing_type) nodeSet.add(row.financing_type as string);
    nodeSet.add(row.party_name as string);
  }

  const nodes: SankeyNode[] = Array.from(nodeSet).map((name) => ({ name }));
  const nodeIndex = new Map(nodes.map((n, i) => [n.name, i]));

  const links: SankeyLink[] = [];
  for (const row of rows) {
    const donorType = row.donor_type as string;
    const financingType = row.financing_type as string | null;
    const partyName = row.party_name as string;
    const total = Number(row.total);

    if (financingType) {
      const srcIdx = nodeIndex.get(donorType);
      const midIdx = nodeIndex.get(financingType);
      const dstIdx = nodeIndex.get(partyName);

      if (srcIdx !== undefined && midIdx !== undefined) {
        links.push({ source: srcIdx, target: midIdx, value: total });
      }
      if (midIdx !== undefined && dstIdx !== undefined) {
        links.push({ source: midIdx, target: dstIdx, value: total });
      }
    } else {
      const srcIdx = nodeIndex.get(donorType);
      const dstIdx = nodeIndex.get(partyName);
      if (srcIdx !== undefined && dstIdx !== undefined) {
        links.push({ source: srcIdx, target: dstIdx, value: total });
      }
    }
  }

  return { nodes, links };
}

export async function getAvailableYears(): Promise<number[]> {
  const rows = await sql`SELECT DISTINCT year FROM financing_records ORDER BY year DESC`;
  return rows.map((r) => r.year as number);
}

export async function getPartyTotals(
  year: number
): Promise<{ party_name: string; total: number; party_type: string | null }[]> {
  return sql`
    SELECT party_name, SUM(amount_soles)::float as total, MAX(party_type) as party_type
    FROM financing_records
    WHERE year = ${year}
    GROUP BY party_name
    ORDER BY total DESC
    LIMIT 20
  ` as Promise<{ party_name: string; total: number; party_type: string | null }[]>;
}
