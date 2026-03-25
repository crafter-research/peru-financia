import { notFound } from "next/navigation";
import Link from "next/link";
import { getDonorDonations, getDonorProfile } from "@/lib/db";

type Props = {
  params: Promise<{ slug: string }>;
};

function formatSoles(amount: number): string {
  if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(1)}K`;
  return `S/ ${amount.toFixed(2)}`;
}

export default async function DonantePage({ params }: Props) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  let profile = null;
  let donations: Awaited<ReturnType<typeof getDonorDonations>> = [];

  try {
    [profile, donations] = await Promise.all([
      getDonorProfile(decodedSlug),
      getDonorDonations(decodedSlug),
    ]);
  } catch {
    // DB not connected
  }

  if (!profile) notFound();

  const isMultiple = profile.parties_count >= 3;

  return (
    <main className="min-h-screen">
      <header className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-[#888] hover:text-foreground transition-colors text-sm">
            ← peru-financia
          </Link>
          <span className="text-[#333]">/</span>
          <Link href="/donante" className="text-sm text-[#888] hover:text-foreground transition-colors">donante</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {profile.donor_name ?? "Donante"}
              </h1>
              {isMultiple && (
                <span className="px-2 py-0.5 rounded text-xs border border-[#f87171] text-[#f87171] bg-[#f8717111]">
                  Financiador múltiple
                </span>
              )}
              {profile.donor_type === "autofinanciamiento" && (
                <span className="px-2 py-0.5 rounded text-xs border border-[#60a5fa] text-[#60a5fa] bg-[#60a5fa11]">
                  Autofinanciamiento
                </span>
              )}
            </div>
            {profile.donor_type && (
              <p className="text-[#888] text-xs mt-1">
                {profile.donor_type === "persona_natural" ? "Persona natural" : profile.donor_type === "autofinanciamiento" ? "Fondos propios del partido" : profile.donor_type === "desconocido" ? "Donante no identificado" : "Persona jurídica"}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total donado", value: formatSoles(profile.total) },
            { label: "Partidos", value: profile.parties_count },
            { label: "Donaciones", value: profile.donations_count },
            { label: "Período", value: profile.first_year === profile.last_year ? String(profile.first_year) : `${profile.first_year}–${profile.last_year}` },
          ].map(({ label, value }) => (
            <div key={label} className="border border-[#1f1f1f] rounded-lg p-4 bg-[#0d0d0d]">
              <p className="text-xs text-[#888]">{label}</p>
              <p className="font-mono text-lg mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#888] mb-3">Donaciones por partido</h2>
          <div className="border border-[#1f1f1f] rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-[#1f1f1f] bg-[#111]">
                  <th className="text-left px-3 sm:px-4 py-3 text-[#888] font-normal">Partido</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-[#888] font-normal">Año</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-[#888] font-normal hidden sm:table-cell">Proceso</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-[#888] font-normal">Monto</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-[#888] font-normal hidden sm:table-cell">N°</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d, i) => (
                  <tr
                    key={`${d.party_name}-${d.year}-${d.electoral_process}-${i}`}
                    className="border-b border-[#111] hover:bg-[#111] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/partido/${d.party_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                        className="hover:text-[#c084fc] transition-colors"
                      >
                        {d.party_name}
                      </Link>
                    </td>
                    <td className="px-3 sm:px-4 py-3 font-mono text-[#888]">{d.year}</td>
                    <td className="px-3 sm:px-4 py-3 font-mono text-xs text-[#888] hidden sm:table-cell">{d.electoral_process ?? "—"}</td>
                    <td className="px-3 sm:px-4 py-3 text-right font-mono whitespace-nowrap">
                      <span className={d.total >= 100_000 ? "text-[#c084fc]" : d.total >= 10_000 ? "text-[#60a5fa]" : ""}>
                        {formatSoles(d.total)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right text-[#888] font-mono hidden sm:table-cell">{d.count}</td>
                  </tr>
                ))}
                {donations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#888] font-mono text-xs">sin registros</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
