import { notFound } from "next/navigation";
import Link from "next/link";
import { getAvailableYears, getFinancingRecords } from "@/lib/db";
import DonorTable from "@/components/donor-table";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
};

export default async function PartidoPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { year: yearParam } = await searchParams;

  let years: number[] = [];
  let partyName: string | null = null;

  try {
    years = await getAvailableYears();
  } catch {
    // DB not connected
  }

  const year = yearParam ? Number(yearParam) : (years[0] ?? 2020);

  try {
    const records = await getFinancingRecords(year, slug.replace(/-/g, " "));
    if (records.length > 0) {
      partyName = records[0].party_name;
    }
  } catch {
    // DB not connected
  }

  if (!partyName && years.length > 0) {
    notFound();
  }

  const displayName = partyName ?? slug.replace(/-/g, " ").toUpperCase();

  return (
    <main className="min-h-screen">
      <header className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-[#888] hover:text-foreground transition-colors text-sm">
            ← plata.pe
          </Link>
          <span className="text-[#333]">/</span>
          <span className="text-sm text-[#888]">partido</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
          <p className="text-[#888] text-sm mt-1">
            Registro de financiamiento — ONPE
          </p>
        </div>

        {years.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#888]">Año:</span>
            <div className="flex gap-1 flex-wrap">
              {years.map((y) => (
                <Link
                  key={y}
                  href={`/partido/${slug}?year=${y}`}
                  className={`px-2 py-1 rounded text-xs border transition-colors ${
                    y === year
                      ? "border-[#c084fc] text-[#c084fc] bg-[#c084fc11]"
                      : "border-[#1f1f1f] text-[#888] hover:border-[#333] hover:text-foreground"
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          </div>
        )}

        <DonorTable year={year} partyFilter={displayName} />
      </div>
    </main>
  );
}
