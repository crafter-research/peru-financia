import { type NextRequest, NextResponse } from "next/server";
import {
  getAvailableYears,
  getFinancingRecords,
  getPartyTotals,
  getSankeyData,
} from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "records";
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const partyName = searchParams.get("party") ?? undefined;
  const financingType = searchParams.get("type") ?? undefined;

  try {
    switch (action) {
      case "sankey": {
        if (!year) return NextResponse.json({ error: "year required" }, { status: 400 });
        const data = await getSankeyData(year);
        return NextResponse.json(data);
      }

      case "totals": {
        if (!year) return NextResponse.json({ error: "year required" }, { status: 400 });
        const totals = await getPartyTotals(year);
        return NextResponse.json(totals);
      }

      case "years": {
        const years = await getAvailableYears();
        return NextResponse.json(years);
      }

      default: {
        const records = await getFinancingRecords(year, partyName, financingType);
        return NextResponse.json(records);
      }
    }
  } catch (err) {
    console.error("[financing/route]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
