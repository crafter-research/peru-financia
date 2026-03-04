import { type NextRequest, NextResponse } from "next/server";
import {
  getAllElectoralProcesses,
  getAvailableYears,
  getDonorDonations,
  getDonorProfile,
  getDonors,
  getDonorStats,
  getElectoralProcesses,
  getFinancingRecords,
  getPartyBreakdown,
  getPartyTotals,
  getPartyTrend,
  getSankeyData,
  searchAll,
} from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "records";
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const partyName = searchParams.get("party") ?? undefined;
  const financingType = searchParams.get("type") ?? undefined;
  const electoralProcess = searchParams.get("process") ?? undefined;
  const ruc = searchParams.get("ruc") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const format = searchParams.get("format") ?? "json";

  try {
    switch (action) {
      case "sankey": {
        const data = await getSankeyData(year, electoralProcess);
        return NextResponse.json(data);
      }

      case "totals": {
        const totals = await getPartyTotals(year, electoralProcess);
        return NextResponse.json(totals);
      }

      case "years": {
        const years = await getAvailableYears();
        return NextResponse.json(years);
      }

      case "processes": {
        if (!year) return NextResponse.json({ error: "year required" }, { status: 400 });
        const processes = await getElectoralProcesses(year);
        return NextResponse.json(processes);
      }

      case "all-processes": {
        const allProcesses = await getAllElectoralProcesses();
        return NextResponse.json(allProcesses);
      }

      case "donors": {
        const page = searchParams.get("page") ? Number(searchParams.get("page")) : 0;
        const pageSize = searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : 50;
        const search = searchParams.get("q") ?? undefined;
        const result = await getDonors({ search, page, pageSize });
        return NextResponse.json(result);
      }

      case "donor-stats": {
        const stats = await getDonorStats();
        return NextResponse.json(stats);
      }

      case "breakdown": {
        const breakdown = await getPartyBreakdown(year, electoralProcess);
        return NextResponse.json(breakdown);
      }

      case "trend": {
        if (!partyName) return NextResponse.json({ error: "party required" }, { status: 400 });
        const trend = await getPartyTrend(partyName);
        return NextResponse.json(trend);
      }

      case "donor": {
        if (!ruc) return NextResponse.json({ error: "ruc required" }, { status: 400 });
        const [profile, donations] = await Promise.all([getDonorProfile(ruc), getDonorDonations(ruc)]);
        if (!profile) return NextResponse.json({ error: "donor not found" }, { status: 404 });
        return NextResponse.json({ profile, donations });
      }

      case "search": {
        if (!q || q.length < 2) return NextResponse.json([]);
        const results = await searchAll(q);
        return NextResponse.json(results);
      }

      default: {
        const records = await getFinancingRecords(year, partyName, financingType, electoralProcess);

        if (format === "csv") {
          const headers = ["id", "year", "electoral_process", "party_name", "party_type", "financing_type", "donor_name", "donor_dni_ruc", "donor_type", "amount_soles", "date"];
          const csvRows = [
            headers.join(","),
            ...records.map((r) =>
              headers.map((h) => {
                const val = r[h as keyof typeof r] ?? "";
                return `"${String(val).replace(/"/g, '""')}"`;
              }).join(",")
            ),
          ];
          return new NextResponse(csvRows.join("\n"), {
            headers: {
              "Content-Type": "text/csv",
              "Content-Disposition": `attachment; filename="plata-pe-${year ?? "all"}.csv"`,
            },
          });
        }

        return NextResponse.json(records);
      }
    }
  } catch (err) {
    console.error("[financing/route]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
