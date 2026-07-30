import type { Metadata } from "next";
import { Geist, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Registro Osteológico",
  description:
    "Registro y análisis de fichas osteológicas — Método de Zonación (Knüsel & Outram 2004) y EAT (Serrulla & Vázquez 2019).",
};

// Set the theme before paint to avoid a flash of the wrong theme (FOUC).
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = (await cookies()).get("osteo_auth")?.value === process.env.AUTH_TOKEN;

  return (
    <html lang="es" className={`${geist.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <ConvexClientProvider>
          <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
              <Link href={authed ? "/" : "/login"} className="group flex items-baseline gap-2">
                <span className="font-serif text-lg font-semibold tracking-tight text-ink">
                  Registro Osteológico
                </span>
                <span className="hidden text-xs text-faint sm:inline">Zonación · EAT</span>
              </Link>
              <nav className="flex items-center gap-1">
                {authed && (
                  <>
                    <NavLink href="/individuos">Individuos</NavLink>
                    <NavLink href="/datos">Datos</NavLink>
                    <NavLink href="/cobertura">Cobertura</NavLink>
                    <NavLink href="/planilla">Planilla</NavLink>
                    <NavLink href="/analisis">Análisis</NavLink>
                    <span className="mx-1 h-5 w-px bg-line" aria-hidden />
                  </>
                )}
                <ThemeToggle />
                {authed && <LogoutButton />}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>

          <footer className="border-t border-line">
            <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-faint">
              Registro Osteológico — herramienta de investigación. Métodos: Knüsel &amp;
              Outram (2004) · Serrulla &amp; Vázquez (2019).
            </div>
          </footer>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </Link>
  );
}
