import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fichas Osteológicas",
  description: "Registro digital de fichas de Zonación y EAT",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-[family-name:var(--font-geist)]">
        <nav className="bg-gray-900 text-white shadow">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold tracking-wide hover:text-gray-300">
              Fichas Osteológicas
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/" className="hover:text-gray-300">Inicio</Link>
              <Link href="/fichas" className="hover:text-gray-300">Mis Fichas</Link>
            </div>
          </div>
        </nav>
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
