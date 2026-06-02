import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Antropología forense · Tafonomía
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Registro y análisis osteológico
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Plataforma de registro digital y análisis cuantitativo de restos óseos.
          Cada individuo integra dos métodos complementarios y permite cruzar sus
          resultados a nivel individuo, población y total.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/individuos" className="btn btn-primary">
            Ver individuos
          </Link>
          <Link href="/individuos/nuevo" className="btn btn-ghost">
            Nuevo individuo
          </Link>
          <Link href="/analisis" className="btn btn-ghost">
            Análisis comparativo
          </Link>
        </div>
      </section>

      {/* Methods */}
      <section className="grid gap-5 md:grid-cols-2">
        <article className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-ink">Método de Zonación</h2>
            <span className="pill">Cuantitativo</span>
          </div>
          <p className="mt-1 text-sm text-faint">Knüsel &amp; Outram (2004)</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Registro de zonas anatómicas presentes por elemento óseo. Calcula
            completitud por elemento y global, e incorpora análisis de fractura (FFI)
            y alteraciones tafonómicas.
          </p>
        </article>

        <article className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-ink">
              Estado de Afectación Tafonómica
            </h2>
            <span className="pill">Semicuantitativo</span>
          </div>
          <p className="mt-1 text-sm text-faint">Serrulla &amp; Vázquez (2019)</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Integra el Índice de Preservación Ósea (objetivo) y el Índice de Calidad
            del Hueso (estimación del valorador) en el EAT&nbsp;=&nbsp;100&nbsp;−&nbsp;(IPO×ICH)/100.
          </p>
        </article>
      </section>
    </div>
  );
}
