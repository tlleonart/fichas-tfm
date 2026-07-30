"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  type Cobertura,
  type FilaCobertura,
  descargarCSV,
  num,
} from "@/lib/tablas";

/* ================================================================== */
/*  Cobertura de costillas y vértebras                                 */
/*  Paso 1: quién no tiene información cargada y de qué sitio es.      */
/*  Paso 2: completitud / IPO / ICH / EAT de esos individuos.          */
/* ================================================================== */

type Filtro =
  | "vacios"
  | "costillas"
  | "vertebras"
  | "ambos"
  | "discrepancias"
  | "todos";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "vacios", label: "Con algún vacío" },
  { key: "costillas", label: "Sin costillas" },
  { key: "vertebras", label: "Sin vértebras" },
  { key: "ambos", label: "Sin costillas Y sin vértebras" },
  { key: "discrepancias", label: "Discrepancia entre métodos" },
  { key: "todos", label: "Todos los individuos" },
];

function pasaFiltro(r: FilaCobertura, f: Filtro): boolean {
  switch (f) {
    case "vacios":
      return r.algunVacio;
    case "costillas":
      return r.vacios.costillasVacio;
    case "vertebras":
      return r.vacios.vertebrasVacio;
    case "ambos":
      return r.ambosGruposVacios;
    case "discrepancias":
      return r.discrepancias.costillas !== null || r.discrepancias.vertebras !== null;
    case "todos":
      return true;
  }
}

export default function CoberturaPage() {
  const data = useQuery(api.cobertura.cobertura, {}) as unknown as Cobertura | undefined;

  const [filtro, setFiltro] = useState<Filtro>("vacios");
  const [fSitio, setFSitio] = useState("");

  const filas = useMemo(() => {
    if (!data) return [];
    return data.individuos
      .filter((r) => pasaFiltro(r, filtro))
      .filter((r) => !fSitio || r.sitio === fSitio)
      .sort((a, b) =>
        a.sitio === b.sitio
          ? a.codigoCanonico.localeCompare(b.codigoCanonico, "es", { numeric: true })
          : a.sitio.localeCompare(b.sitio, "es"),
      );
  }, [data, filtro, fSitio]);

  if (data === undefined)
    return <div className="card p-10 text-center text-sm text-muted">Cargando…</div>;

  const { denominadores: D, sitios, total } = data;

  function exportar() {
    const headers = [
      "Código",
      "Sitio",
      "Año",
      "Fosa",
      "UF",
      "Individuo",
      `Zon. costillas (zonas /${D.zonacion.costillas})`,
      "Zon. costillas %",
      `Zon. vértebras (zonas /${D.zonacion.vertebras})`,
      "Zon. vértebras %",
      `EAT costillas (/${D.eat.costillas})`,
      "EAT costillas %",
      `EAT vértebras (/${D.eat.vertebras})`,
      "EAT vértebras %",
      "Sin costillas (Zonación)",
      "Sin vértebras (Zonación)",
      "Sin costillas (EAT)",
      "Sin vértebras (EAT)",
      "Discrepancia costillas",
      "Discrepancia vértebras",
      "Completitud % (Zonación)",
      "IPO %",
      "ICH %",
      "EAT %",
    ];
    const si = (b: boolean) => (b ? "sí" : "no");
    const rows = filas.map((r) => [
      r.codigoCanonico,
      r.sitio,
      r.anioExcavacion,
      r.numeroFosa,
      r.codigoUF,
      r.numeroIndividuo,
      r.zonacion.costillasZonas,
      r.zonacion.costillasPct,
      r.zonacion.vertebrasZonas,
      r.zonacion.vertebrasPct,
      r.eat.costillasN,
      r.eat.costillasPct,
      r.eat.vertebrasN,
      r.eat.vertebrasPct,
      si(r.vacios.zonCostillas),
      si(r.vacios.zonVertebras),
      si(r.vacios.eatCostillas),
      si(r.vacios.eatVertebras),
      r.discrepancias.costillas ?? "",
      r.discrepancias.vertebras ?? "",
      r.zonacion.completitudGlobal,
      r.eat.ipo,
      r.eat.ich,
      r.eat.eat,
    ]);
    descargarCSV("cobertura_costillas-vertebras", headers, rows);
  }

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-ink">
          Cobertura de costillas y vértebras
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Individuos de la muestra que no tienen ninguna marca cargada en costillas,
          en vértebras o en ambos grupos, con el sitio al que pertenecen y sus valores
          totales de completitud (Zonación) e IPO / ICH / EAT.
        </p>
      </header>

      {/* Aviso metodológico — qué significa "sin información" */}
      <section className="card border-l-4 border-l-accent p-5">
        <h2 className="font-serif text-base font-semibold text-ink">
          Cómo leer &ldquo;sin información&rdquo;
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-ink">Sin información = cero marcas cargadas</strong> en
            ese grupo. Los formularios guardan solo casillas tildadas, así que en la base
            no se distingue &ldquo;el hueso no se preservó&rdquo; de &ldquo;el hueso no se
            registró&rdquo;. Ambos casos se ven igual: cero.
          </li>
          <li>
            <strong className="text-ink">La discrepancia entre métodos sí discrimina.</strong>{" "}
            Si el EAT registra costillas y la Zonación no (o al revés) para el mismo
            individuo, es casi seguro un <em>vacío de registro</em>, no una ausencia real.
            Esas filas están marcadas.
          </li>
          <li>
            <strong className="text-ink">Los denominadores difieren entre métodos.</strong>{" "}
            Zonación: costillas {D.zonacion.costillas} zonas (12 pares × 3 zonas × L/R),
            vértebras {D.zonacion.vertebras} zonas (24 vértebras × 4). EAT: costillas{" "}
            {D.eat.costillas} elementos, vértebras {D.eat.vertebras}. Atención: en el EAT
            el sacro y el cóccix van <em>dentro</em> de vértebras; en Zonación el sacro es
            un elemento aparte ({D.zonacion.sacro} zonas) y no cuenta acá.
          </li>
        </ul>
      </section>

      {/* Resumen global */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Individuos" value={total.n} />
        <Card label="Con algún vacío" value={total.vacios.alguno} accent />
        <Card label="Sin costillas" value={total.vacios.costillas} />
        <Card label="Sin vértebras" value={total.vacios.vertebras} />
        <Card label="Sin ambos grupos" value={total.vacios.ambosGrupos} />
        <Card
          label="Discrepancias"
          value={total.discrepancias.costillas + total.discrepancias.vertebras}
        />
      </section>

      {/* Vacíos por sitio */}
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-serif text-lg font-semibold text-ink">Vacíos por sitio</h2>
          <p className="mt-0.5 text-xs text-faint">
            Conteo de individuos. &ldquo;Zon.&rdquo; = método de Zonación · &ldquo;EAT&rdquo;
            = Serrulla &amp; Vázquez. Un individuo puede aparecer en más de una columna.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-semibold">Sitio</th>
                <th className="px-4 py-2.5 font-semibold">n</th>
                <th className="px-4 py-2.5 font-semibold">Sin costillas (Zon.)</th>
                <th className="px-4 py-2.5 font-semibold">Sin vértebras (Zon.)</th>
                <th className="px-4 py-2.5 font-semibold">Sin costillas (EAT)</th>
                <th className="px-4 py-2.5 font-semibold">Sin vértebras (EAT)</th>
                <th className="px-4 py-2.5 font-semibold">Sin ambos grupos</th>
                <th className="px-4 py-2.5 font-semibold">Con algún vacío</th>
                <th className="px-4 py-2.5 font-semibold">Discrepancias</th>
              </tr>
            </thead>
            <tbody>
              {[...sitios, total].map((s) => {
                const esTotal = s.sitio === "TOTAL";
                return (
                  <tr
                    key={s.sitio}
                    className={`border-b border-line last:border-0 ${
                      esTotal ? "bg-surface-2 font-semibold" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium text-ink">{s.sitio}</td>
                    <td className="px-4 py-2.5 text-muted">{s.n}</td>
                    <Conteo v={s.vacios.zonCostillas} />
                    <Conteo v={s.vacios.zonVertebras} />
                    <Conteo v={s.vacios.eatCostillas} />
                    <Conteo v={s.vacios.eatVertebras} />
                    <Conteo v={s.vacios.ambosGrupos} />
                    <td className="px-4 py-2.5 font-medium text-ink">{s.vacios.alguno}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {s.discrepancias.costillas + s.discrepancias.vertebras}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Filtros */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filtro === f.key
                  ? "border-transparent bg-accent text-[var(--accent-ink)]"
                  : "border-line-strong text-muted hover:bg-surface-2"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <select
            className="field"
            value={fSitio}
            onChange={(e) => setFSitio(e.target.value)}
            aria-label="Filtrar por sitio"
          >
            <option value="">Todos los sitios</option>
            {sitios.map((s) => (
              <option key={s.sitio} value={s.sitio}>
                {s.sitio}
              </option>
            ))}
          </select>
          <span className="ml-auto flex items-center gap-3">
            <span className="text-xs text-faint">{filas.length} individuo(s)</span>
            <button onClick={exportar} className="btn btn-ghost text-xs">
              Exportar CSV
            </button>
          </span>
        </div>
      </section>

      {/* Tabla de individuos */}
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Individuos y sus valores totales
          </h2>
          <p className="mt-0.5 text-xs text-faint">
            En rojo, el grupo sin ninguna marca cargada. Completitud, IPO, ICH y EAT son
            los valores globales del individuo, tal como los calculó y guardó el backend.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5 font-semibold">Código</th>
                <th className="px-3 py-2.5 font-semibold">Sitio</th>
                <th className="px-3 py-2.5 font-semibold" title={`sobre ${D.zonacion.costillas} zonas`}>
                  Costillas Zon.
                </th>
                <th className="px-3 py-2.5 font-semibold" title={`sobre ${D.zonacion.vertebras} zonas`}>
                  Vértebras Zon.
                </th>
                <th className="px-3 py-2.5 font-semibold" title={`sobre ${D.eat.costillas} elementos`}>
                  Costillas EAT
                </th>
                <th className="px-3 py-2.5 font-semibold" title={`sobre ${D.eat.vertebras} elementos`}>
                  Vértebras EAT
                </th>
                <th className="px-3 py-2.5 font-semibold">Completitud</th>
                <th className="px-3 py-2.5 font-semibold">IPO</th>
                <th className="px-3 py-2.5 font-semibold">ICH</th>
                <th className="px-3 py-2.5 font-semibold">EAT</th>
                <th className="px-3 py-2.5 font-semibold">Señales</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r._id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 font-medium text-ink">
                    <Link href={`/individuos/${r._id}`} className="hover:text-accent">
                      {r.codigoCanonico}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{r.sitio}</td>
                  <Conteo2
                    n={r.zonacion.costillasZonas}
                    max={D.zonacion.costillas}
                    presente={r.zonacion.presente}
                  />
                  <Conteo2
                    n={r.zonacion.vertebrasZonas}
                    max={D.zonacion.vertebras}
                    presente={r.zonacion.presente}
                  />
                  <Conteo2
                    n={r.eat.costillasN}
                    max={D.eat.costillas}
                    presente={r.eat.presente}
                  />
                  <Conteo2
                    n={r.eat.vertebrasN}
                    max={D.eat.vertebras}
                    presente={r.eat.presente}
                  />
                  <td className="px-3 py-2.5 text-muted">
                    {num(r.zonacion.completitudGlobal, "%")}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{num(r.eat.ipo, "%")}</td>
                  <td className="px-3 py-2.5 text-muted">{num(r.eat.ich, "%")}</td>
                  <td className="px-3 py-2.5 font-medium text-accent">
                    {num(r.eat.eat, "%")}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.ambosGruposVacios && (
                        <span className="pill border-[var(--danger)] text-[var(--danger)]">
                          ambos vacíos
                        </span>
                      )}
                      {r.discrepancias.costillas && (
                        <span className="pill pill-accent" title="Costillas presentes en un método y vacías en el otro">
                          costillas: {r.discrepancias.costillas}
                        </span>
                      )}
                      {r.discrepancias.vertebras && (
                        <span className="pill pill-accent" title="Vértebras presentes en un método y vacías en el otro">
                          vértebras: {r.discrepancias.vertebras}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-muted">
                    Ningún individuo cumple el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-muted">
        Los totales de los dos métodos para toda la muestra, individuo por individuo y
        sitio por sitio, están en{" "}
        <Link href="/planilla" className="font-medium text-accent hover:underline">
          la planilla de totales
        </Link>
        .
      </p>
    </div>
  );
}

/* ---------- piezas ---------- */

function Card({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-faint">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ? "text-accent" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

/** Celda de conteo de vacíos: 0 en gris, >0 en rojo. */
function Conteo({ v }: { v: number }) {
  return (
    <td className={`px-4 py-2.5 ${v > 0 ? "font-semibold text-[var(--danger)]" : "text-faint"}`}>
      {v}
    </td>
  );
}

/** Celda "n / max" con el cero resaltado. */
function Conteo2({ n, max, presente }: { n: number; max: number; presente: boolean }) {
  if (!presente)
    return <td className="px-3 py-2.5 text-faint">— sin ficha</td>;
  return (
    <td className={`px-3 py-2.5 ${n === 0 ? "font-semibold text-[var(--danger)]" : "text-muted"}`}>
      {n} <span className="text-faint">/ {max}</span>
    </td>
  );
}
