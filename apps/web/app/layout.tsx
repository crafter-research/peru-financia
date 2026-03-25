import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import GlobalSearch from "@/components/global-search";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "peru-financia — Financiamiento Político Peruano",
  description:
    "Mapa open-source de flujos de financiamiento político en Perú. Datos de ONPE 1995–2026.",
  openGraph: {
    title: "peru-financia",
    description: "¿Quién financia la política peruana?",
    siteName: "peru-financia",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "peru-financia",
    description: "¿Quién financia la política peruana?",
    images: ["/og-twitter.png"],
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="sticky top-0 z-40 border-b border-[#1f1f1f] bg-[#0a0a0a]/90 backdrop-blur-sm px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 shrink-0">
              <a href="/" className="text-sm font-semibold tracking-tight">
                peru<span className="text-[#c084fc]">-financia</span>
              </a>
              <Link href="/donante" className="text-sm text-[#888] hover:text-foreground transition-colors">
                Donantes
              </Link>
            </div>
            <Suspense>
              <GlobalSearch />
            </Suspense>
          </div>
        </div>
        {children}
        <Analytics />
        <footer className="border-t border-[#1f1f1f] px-6 py-6 mt-12">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#888]">
            <div className="space-y-1">
              <p>Datos: <a href="https://onpe.gob.pe" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">ONPE</a> 1995–2026. Proyecto open-source bajo <a href="https://github.com/crafter-research/peru-financia" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">AGPL-3.0</a>.</p>
              <p>Tratamiento de datos amparado por Art. 14.2, Ley 29733 (fuentes accesibles al público).</p>
            </div>
            <div className="flex gap-4 shrink-0">
              <Link href="/legal" className="hover:text-foreground transition-colors">Aviso legal</Link>
              <a href="https://crafterstation.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Crafter Station</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
