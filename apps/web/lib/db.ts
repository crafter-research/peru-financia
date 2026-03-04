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

export type DonorProfile = {
  donor_name: string | null;
  donor_dni_ruc: string;
  donor_type: string | null;
  total: number;
  parties_count: number;
  donations_count: number;
  first_year: number;
  last_year: number;
};

export type DonorDonation = {
  party_name: string;
  year: number;
  electoral_process: string | null;
  total: number;
  count: number;
};

export type SearchResult = {
  type: "donante" | "partido";
  name: string;
  key: string;
  total: number;
};

export type PartyBreakdown = {
  party_name: string;
  privado: number;
  publico: number;
  total: number;
};

export type PartyTrend = {
  year: number;
  total: number;
  financing_type: string | null;
};

export async function getFinancingRecords(
  year?: number,
  partyName?: string,
  financingType?: string,
  electoralProcess?: string
): Promise<FinancingRecord[]> {
  const SELECT = sql`
    SELECT id, source, year, electoral_process, party_name, party_type,
           financing_type, donor_name, donor_dni_ruc, donor_type,
           amount_soles::float, donation_type, date::text, candidate_name
    FROM financing_records
  `;

  if (year && partyName && financingType && electoralProcess) {
    return sql`${SELECT} WHERE year = ${year} AND party_name ILIKE ${"%" + partyName + "%"} AND financing_type = ${financingType} AND electoral_process = ${electoralProcess} ORDER BY amount_soles DESC LIMIT 500` as unknown as Promise<FinancingRecord[]>;
  }
  if (year && partyName && financingType) {
    return sql`${SELECT} WHERE year = ${year} AND party_name ILIKE ${"%" + partyName + "%"} AND financing_type = ${financingType} ORDER BY amount_soles DESC LIMIT 500` as unknown as Promise<FinancingRecord[]>;
  }
  if (year && partyName && electoralProcess) {
    return sql`${SELECT} WHERE year = ${year} AND party_name ILIKE ${"%" + partyName + "%"} AND electoral_process = ${electoralProcess} ORDER BY amount_soles DESC LIMIT 500` as unknown as Promise<FinancingRecord[]>;
  }
  if (year && financingType && electoralProcess) {
    return sql`${SELECT} WHERE year = ${year} AND financing_type = ${financingType} AND electoral_process = ${electoralProcess} ORDER BY amount_soles DESC LIMIT 500` as unknown as Promise<FinancingRecord[]>;
  }
  if (year && partyName) {
    return sql`${SELECT} WHERE year = ${year} AND party_name ILIKE ${"%" + partyName + "%"} ORDER BY amount_soles DESC LIMIT 500` as unknown as Promise<FinancingRecord[]>;
  }
  if (year && financingType) {
    return sql`${SELECT} WHERE year = ${year} AND financing_type = ${financingType} ORDER BY amount_soles DESC LIMIT 500` as unknown as Promise<FinancingRecord[]>;
  }
  if (year && electoralProcess) {
    return sql`${SELECT} WHERE year = ${year} AND electoral_process = ${electoralProcess} ORDER BY amount_soles DESC LIMIT 500` as unknown as Promise<FinancingRecord[]>;
  }
  if (year) {
    return sql`${SELECT} WHERE year = ${year} ORDER BY amount_soles DESC LIMIT 500` as unknown as Promise<FinancingRecord[]>;
  }
  return sql`${SELECT} ORDER BY amount_soles DESC LIMIT 500` as unknown as Promise<FinancingRecord[]>;
}

const TOP_PARTIES = 10;

export async function getSankeyData(year?: number, electoralProcess?: string): Promise<SankeyData> {
  const rows = electoralProcess
    ? await sql`
        SELECT COALESCE(donor_type, 'desconocido') as donor_type, financing_type, party_name, SUM(amount_soles) as total
        FROM financing_records
        WHERE electoral_process = ${electoralProcess} AND amount_soles > 0
        GROUP BY donor_type, financing_type, party_name ORDER BY total DESC LIMIT 200
      `
    : year
    ? await sql`
        SELECT COALESCE(donor_type, 'desconocido') as donor_type, financing_type, party_name, SUM(amount_soles) as total
        FROM financing_records
        WHERE year = ${year} AND amount_soles > 0
        GROUP BY donor_type, financing_type, party_name ORDER BY total DESC LIMIT 200
      `
    : await sql`
        SELECT COALESCE(donor_type, 'desconocido') as donor_type, financing_type, party_name, SUM(amount_soles) as total
        FROM financing_records
        WHERE amount_soles > 0
        GROUP BY donor_type, financing_type, party_name ORDER BY total DESC LIMIT 200
      `;

  // Determine top parties by total across all rows
  const partyTotals = new Map<string, number>();
  for (const row of rows) {
    const p = row.party_name as string;
    partyTotals.set(p, (partyTotals.get(p) ?? 0) + Number(row.total));
  }
  const topParties = new Set(
    [...partyTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_PARTIES)
      .map(([name]) => name)
  );

  // Remap party names: non-top become "Otros"
  const normalized = rows.map((row) => ({
    donor_type: row.donor_type as string,
    financing_type: row.financing_type as string | null,
    party_name: topParties.has(row.party_name as string) ? (row.party_name as string) : "Otros",
    total: Number(row.total),
  }));

  // Aggregate after remapping (Otros may have many rows now)
  type AggKey = string;
  const aggMap = new Map<AggKey, { donor_type: string; financing_type: string | null; party_name: string; total: number }>();
  for (const r of normalized) {
    const key = `${r.donor_type}||${r.financing_type ?? ""}||${r.party_name}`;
    const existing = aggMap.get(key);
    if (existing) {
      existing.total += r.total;
    } else {
      aggMap.set(key, { ...r });
    }
  }
  const agg = [...aggMap.values()];

  // If all financing_types are the same value, skip the middle node (adds no information)
  const uniqueFinancingTypes = new Set(agg.map((r) => r.financing_type).filter(Boolean));
  const skipMiddle = uniqueFinancingTypes.size <= 1;

  const nodeSet = new Set<string>();
  for (const row of agg) {
    nodeSet.add(row.donor_type);
    if (!skipMiddle && row.financing_type) nodeSet.add(row.financing_type);
    nodeSet.add(row.party_name);
  }

  const nodes: SankeyNode[] = Array.from(nodeSet).map((name) => ({ name }));
  const nodeIndex = new Map(nodes.map((n, i) => [n.name, i]));

  // Aggregate direct links when skipping middle
  const directMap = new Map<string, number>();
  const links: SankeyLink[] = [];

  if (skipMiddle) {
    for (const row of agg) {
      const key = `${row.donor_type}||${row.party_name}`;
      directMap.set(key, (directMap.get(key) ?? 0) + row.total);
    }
    for (const [key, total] of directMap) {
      const [donor_type, party_name] = key.split("||");
      const srcIdx = nodeIndex.get(donor_type);
      const dstIdx = nodeIndex.get(party_name);
      if (srcIdx !== undefined && dstIdx !== undefined) links.push({ source: srcIdx, target: dstIdx, value: total });
    }
  } else {
    for (const row of agg) {
      const { donor_type, financing_type, party_name, total } = row;
      if (financing_type) {
        const srcIdx = nodeIndex.get(donor_type);
        const midIdx = nodeIndex.get(financing_type);
        const dstIdx = nodeIndex.get(party_name);
        if (srcIdx !== undefined && midIdx !== undefined) links.push({ source: srcIdx, target: midIdx, value: total });
        if (midIdx !== undefined && dstIdx !== undefined) links.push({ source: midIdx, target: dstIdx, value: total });
      } else {
        const srcIdx = nodeIndex.get(donor_type);
        const dstIdx = nodeIndex.get(party_name);
        if (srcIdx !== undefined && dstIdx !== undefined) links.push({ source: srcIdx, target: dstIdx, value: total });
      }
    }
  }

  return { nodes, links };
}

export async function getAvailableYears(): Promise<number[]> {
  const rows = await sql`SELECT DISTINCT year FROM financing_records ORDER BY year DESC`;
  return rows.map((r) => r.year as number);
}

export async function getAllElectoralProcesses(): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT electoral_process FROM financing_records
    WHERE electoral_process IS NOT NULL
    ORDER BY electoral_process DESC
  `;
  return rows.map((r) => r.electoral_process as string);
}

export async function getElectoralProcesses(year: number): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT electoral_process FROM financing_records
    WHERE year = ${year} AND electoral_process IS NOT NULL
    ORDER BY electoral_process
  `;
  return rows.map((r) => r.electoral_process as string);
}

export type DonorRow = {
  donor_name: string | null;
  donor_dni_ruc: string;
  donor_type: string | null;
  total: number;
  parties_count: number;
  donations_count: number;
};

export async function getDonors(opts: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: DonorRow[]; total: number }> {
  const { search, page = 0, pageSize = 50 } = opts;
  const offset = page * pageSize;
  const q = search ? "%" + search + "%" : null;

  const [rows, countRows] = await Promise.all([
    q
      ? sql`
          SELECT donor_name, donor_dni_ruc, donor_type,
                 SUM(amount_soles)::float as total,
                 COUNT(DISTINCT party_name)::int as parties_count,
                 COUNT(*)::int as donations_count
          FROM financing_records
          WHERE donor_dni_ruc IS NOT NULL AND donor_dni_ruc != ''
            AND (donor_name ILIKE ${q} OR donor_dni_ruc ILIKE ${q})
          GROUP BY donor_name, donor_dni_ruc, donor_type
          ORDER BY total DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `
      : sql`
          SELECT donor_name, donor_dni_ruc, donor_type,
                 SUM(amount_soles)::float as total,
                 COUNT(DISTINCT party_name)::int as parties_count,
                 COUNT(*)::int as donations_count
          FROM financing_records
          WHERE donor_dni_ruc IS NOT NULL AND donor_dni_ruc != ''
          GROUP BY donor_name, donor_dni_ruc, donor_type
          ORDER BY total DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `,
    q
      ? sql`
          SELECT COUNT(DISTINCT donor_dni_ruc)::int as total
          FROM financing_records
          WHERE donor_dni_ruc IS NOT NULL AND donor_dni_ruc != ''
            AND (donor_name ILIKE ${q} OR donor_dni_ruc ILIKE ${q})
        `
      : sql`
          SELECT COUNT(DISTINCT donor_dni_ruc)::int as total
          FROM financing_records
          WHERE donor_dni_ruc IS NOT NULL AND donor_dni_ruc != ''
        `,
  ]);

  return {
    rows: rows as unknown as DonorRow[],
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function getPartyTotals(
  year?: number,
  electoralProcess?: string
): Promise<{ party_name: string; total: number; party_type: string | null }[]> {
  if (electoralProcess) {
    return sql`
      SELECT party_name, SUM(amount_soles)::float as total, MAX(party_type) as party_type
      FROM financing_records WHERE electoral_process = ${electoralProcess}
      GROUP BY party_name ORDER BY total DESC LIMIT 20
    ` as unknown as Promise<{ party_name: string; total: number; party_type: string | null }[]>;
  }
  if (year) {
    return sql`
      SELECT party_name, SUM(amount_soles)::float as total, MAX(party_type) as party_type
      FROM financing_records WHERE year = ${year}
      GROUP BY party_name ORDER BY total DESC LIMIT 20
    ` as unknown as Promise<{ party_name: string; total: number; party_type: string | null }[]>;
  }
  return sql`
    SELECT party_name, SUM(amount_soles)::float as total, MAX(party_type) as party_type
    FROM financing_records
    GROUP BY party_name ORDER BY total DESC LIMIT 20
  ` as unknown as Promise<{ party_name: string; total: number; party_type: string | null }[]>;
}

export async function getPartyBreakdown(year?: number, electoralProcess?: string): Promise<PartyBreakdown[]> {
  if (electoralProcess) {
    return sql`
      SELECT party_name,
             SUM(CASE WHEN financing_type = 'privado' THEN amount_soles ELSE 0 END)::float as privado,
             SUM(CASE WHEN financing_type LIKE 'publico%' THEN amount_soles ELSE 0 END)::float as publico,
             SUM(amount_soles)::float as total
      FROM financing_records WHERE electoral_process = ${electoralProcess}
      GROUP BY party_name ORDER BY total DESC LIMIT 15
    ` as unknown as Promise<PartyBreakdown[]>;
  }
  if (year) {
    return sql`
      SELECT party_name,
             SUM(CASE WHEN financing_type = 'privado' THEN amount_soles ELSE 0 END)::float as privado,
             SUM(CASE WHEN financing_type LIKE 'publico%' THEN amount_soles ELSE 0 END)::float as publico,
             SUM(amount_soles)::float as total
      FROM financing_records WHERE year = ${year}
      GROUP BY party_name ORDER BY total DESC LIMIT 15
    ` as unknown as Promise<PartyBreakdown[]>;
  }
  return sql`
    SELECT party_name,
           SUM(CASE WHEN financing_type = 'privado' THEN amount_soles ELSE 0 END)::float as privado,
           SUM(CASE WHEN financing_type LIKE 'publico%' THEN amount_soles ELSE 0 END)::float as publico,
           SUM(amount_soles)::float as total
    FROM financing_records
    GROUP BY party_name ORDER BY total DESC LIMIT 15
  ` as unknown as Promise<PartyBreakdown[]>;
}

export async function getPartyTrend(partyName: string): Promise<PartyTrend[]> {
  return sql`
    SELECT year, SUM(amount_soles)::float as total, financing_type
    FROM financing_records WHERE party_name ILIKE ${"%" + partyName + "%"}
    GROUP BY year, financing_type ORDER BY year ASC
  ` as unknown as Promise<PartyTrend[]>;
}

export async function getDonorProfile(ruc: string): Promise<DonorProfile | null> {
  const rows = await sql`
    SELECT donor_name, donor_dni_ruc, donor_type,
           SUM(amount_soles)::float as total,
           COUNT(DISTINCT party_name)::int as parties_count,
           COUNT(*)::int as donations_count,
           MIN(year)::int as first_year, MAX(year)::int as last_year
    FROM financing_records WHERE donor_dni_ruc = ${ruc}
    GROUP BY donor_name, donor_dni_ruc, donor_type
    ORDER BY total DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rows[0] as unknown as DonorProfile;
}

export async function getDonorDonations(ruc: string): Promise<DonorDonation[]> {
  return sql`
    SELECT party_name, year, electoral_process,
           SUM(amount_soles)::float as total, COUNT(*)::int as count
    FROM financing_records WHERE donor_dni_ruc = ${ruc}
    GROUP BY party_name, year, electoral_process ORDER BY total DESC
  ` as unknown as Promise<DonorDonation[]>;
}

export type DonorStats = {
  total_donors: number;
  persona_natural: number;
  persona_juridica: number;
  multi_party_donors: number;
  total_amount: number;
  top_donors: { donor_name: string | null; donor_dni_ruc: string; total: number; parties_count: number }[];
  amount_buckets: { bucket: string; count: number }[];
};

export async function getDonorStats(): Promise<DonorStats> {
  const [summaryRows, topRows, bucketRows] = await Promise.all([
    sql`
      SELECT
        COUNT(DISTINCT donor_dni_ruc)::int as total_donors,
        COUNT(DISTINCT CASE WHEN donor_type = 'persona_natural' THEN donor_dni_ruc END)::int as persona_natural,
        COUNT(DISTINCT CASE WHEN donor_type != 'persona_natural' AND donor_type IS NOT NULL THEN donor_dni_ruc END)::int as persona_juridica,
        COUNT(DISTINCT CASE WHEN parties_count >= 2 THEN donor_dni_ruc END)::int as multi_party_donors,
        SUM(total_amount)::float as total_amount
      FROM (
        SELECT donor_dni_ruc, donor_type,
               COUNT(DISTINCT party_name) as parties_count,
               SUM(amount_soles) as total_amount
        FROM financing_records
        WHERE donor_dni_ruc IS NOT NULL AND donor_dni_ruc != ''
        GROUP BY donor_dni_ruc, donor_type
      ) sub
    `,
    sql`
      SELECT donor_name, donor_dni_ruc,
             SUM(amount_soles)::float as total,
             COUNT(DISTINCT party_name)::int as parties_count
      FROM financing_records
      WHERE donor_dni_ruc IS NOT NULL AND donor_dni_ruc != ''
      GROUP BY donor_name, donor_dni_ruc
      ORDER BY total DESC LIMIT 10
    `,
    sql`
      SELECT bucket, COUNT(*)::int as count FROM (
        SELECT donor_dni_ruc,
          CASE
            WHEN SUM(amount_soles) >= 1000000 THEN '≥ S/1M'
            WHEN SUM(amount_soles) >= 100000  THEN 'S/100K–1M'
            WHEN SUM(amount_soles) >= 10000   THEN 'S/10K–100K'
            WHEN SUM(amount_soles) >= 1000    THEN 'S/1K–10K'
            ELSE '< S/1K'
          END as bucket
        FROM financing_records
        WHERE donor_dni_ruc IS NOT NULL AND donor_dni_ruc != ''
        GROUP BY donor_dni_ruc
      ) sub
      GROUP BY bucket
      ORDER BY MIN(CASE bucket
        WHEN '≥ S/1M'    THEN 1
        WHEN 'S/100K–1M' THEN 2
        WHEN 'S/10K–100K' THEN 3
        WHEN 'S/1K–10K'  THEN 4
        ELSE 5
      END)
    `,
  ]);

  const s = summaryRows[0];
  return {
    total_donors: Number(s.total_donors),
    persona_natural: Number(s.persona_natural),
    persona_juridica: Number(s.persona_juridica),
    multi_party_donors: Number(s.multi_party_donors),
    total_amount: Number(s.total_amount),
    top_donors: topRows as unknown as DonorStats["top_donors"],
    amount_buckets: bucketRows as unknown as DonorStats["amount_buckets"],
  };
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  const q = "%" + query + "%";
  const rows = await sql`
    (SELECT 'donante' as type, COALESCE(donor_name, donor_dni_ruc) as name, donor_dni_ruc as key,
            SUM(amount_soles)::float as total
     FROM financing_records
     WHERE (donor_name ILIKE ${q} OR donor_dni_ruc ILIKE ${q}) AND donor_dni_ruc IS NOT NULL
     GROUP BY donor_name, donor_dni_ruc LIMIT 5)
    UNION ALL
    (SELECT 'partido' as type, party_name as name, party_name as key,
            SUM(amount_soles)::float as total
     FROM financing_records WHERE party_name ILIKE ${q}
     GROUP BY party_name LIMIT 5)
    ORDER BY total DESC LIMIT 10
  `;
  return rows as unknown as SearchResult[];
}
