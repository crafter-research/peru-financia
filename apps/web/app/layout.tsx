import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
