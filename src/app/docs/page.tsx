import { promises as fs } from "fs";
import path from "path";
import { marked } from "marked";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentación — Registro Osteológico",
};

const DOCS = [
  { slug: "arquitectura", titulo: "Arquitectura técnica", file: "arquitectura.md" },
  { slug: "metodologia", titulo: "Metodología", file: "metodologia.md" },
  { slug: "escalado", titulo: "Escalado y roadmap", file: "escalado.md" },
];

export default async function DocsPage() {
  const docsDir = path.join(process.cwd(), "docs");
  const sections = await Promise.all(
    DOCS.map(async (d) => {
      const md = await fs.readFile(path.join(docsDir, d.file), "utf8");
      return { ...d, html: await marked.parse(md) };
    }),
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Documentación
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-ink">
          Registro Osteológico — Documentación
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Documentación técnica y metodológica del sistema.
        </p>
      </header>

      <nav className="card p-5">
        <h2 className="font-serif text-base font-semibold text-ink">Contenido</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.slug}>
              <a href={`#${s.slug}`} className="text-sm text-accent hover:underline">
                {s.titulo}
              </a>
            </li>
          ))}
          <li>
            <a
              href="/documentacion/esquema-datos.html"
              target="_blank"
              rel="noopener"
              className="text-sm text-accent hover:underline"
            >
              Esquema de datos (HTML)
            </a>
          </li>
          <li>
            <a
              href="/documentacion/esquema-datos.pdf"
              target="_blank"
              rel="noopener"
              className="text-sm text-accent hover:underline"
            >
              Esquema de datos (PDF)
            </a>
          </li>
        </ul>
      </nav>

      {sections.map((s) => (
        <section key={s.slug} id={s.slug} className="card scroll-mt-24 p-6 sm:p-8">
          <article
            className="prose-doc"
            dangerouslySetInnerHTML={{ __html: s.html }}
          />
        </section>
      ))}
    </div>
  );
}
