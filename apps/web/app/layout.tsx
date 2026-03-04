import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
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
  title: "plata.pe — Financiamiento Político Peruano",
  description:
    "Mapa open-source de flujos de financiamiento político en Perú. Datos de ONPE 1995–2026.",
  openGraph: {
    title: "plata.pe",
    description: "¿Quién financia la política peruana?",
    url: "https://plata.pe",
    siteName: "plata.pe",
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
                plata<span className="text-[#c084fc]">.pe</span>
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
      </body>
    </html>
  );
}
