import type { Metadata } from "next";
import { Geist, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";
import RolProvider from "@/components/RolProvider";
import { rolDesdeToken } from "@/lib/rol";

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
  // Aplicación privada, ahora también abierta a los correctores del TFM: fuera
  // de los buscadores (va con `src/app/robots.ts`).
  robots: { index: false, follow: false },
};

// Set the theme before paint to avoid a flash of the wrong theme (FOUC).
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El rol se resuelve en el servidor; al cliente solo baja la cadena.
  const rol = rolDesdeToken((await cookies()).get("osteo_auth")?.value);
  const authed = rol !== null;
  const esEditor = rol === "editor";

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
                    {/* Análisis es solo del editor: el lector lo tiene denegado
                        en el servidor (`src/proxy.ts`). */}
                    {esEditor && <NavLink href="/analisis">Análisis</NavLink>}
                    <span className="mx-1 h-5 w-px bg-line" aria-hidden />
                  </>
                )}
                <ThemeToggle />
                {authed && <LogoutButton />}
              </nav>
            </div>
          </header>

          {/* El rol solo lo necesitan las páginas (client components). */}
          <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
            <RolProvider rol={rol}>{children}</RolProvider>
          </main>

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
