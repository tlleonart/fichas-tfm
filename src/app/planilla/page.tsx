"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  type AgregadoSitio,
  type Cobertura,
  type Stats,
  descargarCSV,
  num,
} from "@/lib/tablas";

/* ================================================================== */
/*  Planilla de totales — ambos métodos, por individuo y por sitio     */
/* ================================================================== */

type Orden =
  | "codigo"
  | "sitio"
  | "completitud"
  | "ipo"
  | "ich"
  | "eat";

export default function PlanillaPage() {
  const data = useQuery(api.cobertura.cobertura, {}) as unknown as Cobertura | undefined;

  const [fSitio, setFSitio] = useState("");
  const [orden, setOrden] = useState<Orden>("codigo");
  const [dir, setDir] = useState<1 | -1>(1);

  const filas = useMemo(() => {
    if (!data) return [];
    const arr = data.individuos.filter((r) => !fSitio || r.sitio === fSitio);
    const key = (r: (typeof arr)[number]) => {
      switch (orden) {
        case "sitio":
          return r.sitio;
        case "completitud":
          return r.zonacion.completitudGlobal ?? -1;
        case "ipo":
          return r.eat.ipo ?? -1;
        case "ich":
          return r.eat.ich ?? -1;
        case "eat":
          return r.eat.eat ?? -1;
        default:
          return r.codigoCanonico;
      }
    };
    return [...arr].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (typeof ka === "number" && typeof kb === "number") return (ka - kb) * dir;
      return String(ka).localeCompare(String(kb), "es", { numeric: true }) * dir;
    });
  }, [data, fSitio, orden, dir]);

  if (data === undefined)
    return <div className="card p-10 text-center text-sm text-muted">Cargando…</div>;

  const { denominadores: D, sitios, total } = data;

  function ordenar(k: Orden) {
    if (k === orden) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setOrden(k);
      setDir(1);
    }
  }

  function exportarIndividuos() {
    const headers = [
      "Código",
      "Sitio",
      "Año",
      "Fosa",
      "UF",
      "Individuo",
      "Sexo",
      "Edad",
      "Tiene Zonación",
      "Tiene EAT",
      "Completitud global % (Zon.)",
      `Zonas presentes (/${D.zonacion.total})`,
      "Elementos presentes",
      `Costillas zonas (/${D.zonacion.costillas})`,
      `Vértebras zonas (/${D.zonacion.vertebras})`,
      "FFI media",
      "Alteraciones",
      "Fragmentos",
      "IPO %",
      "ICH %",
      "EAT %",
      `Puntos EAT presentes (/${D.eat.ipoPuntos})`,
      `Costillas EAT (/${D.eat.costillas})`,
      `Vértebras EAT (/${D.eat.vertebras})`,
    ];
    const rows = filas.map((r) => [
      r.codigoCanonico,
      r.sitio,
      r.anioExcavacion,
      r.numeroFosa,
      r.codigoUF,
      r.numeroIndividuo,
      r.sexoEstimado ?? "",
      r.edadEstimada ?? "",
      r.zonacion.presente ? "sí" : "no",
      r.eat.presente ? "sí" : "no",
      r.zonacion.completitudGlobal,
      r.zonacion.zonasPresentes,
      r.zonacion.elementosPresentes,
      r.zonacion.costillasZonas,
      r.zonacion.vertebrasZonas,
      r.zonacion.ffiMedia,
      r.zonacion.alteraciones,
      r.zonacion.fragmentos,
      r.eat.ipo,
      r.eat.ich,
      r.eat.eat,
      r.eat.totalPresent,
      r.eat.costillasN,
      r.eat.vertebrasN,
    ]);
    descargarCSV("planilla_totales-por-individuo", headers, rows);
  }

  function exportarSitios() {
    const headers = [
      "Sitio",
      "n individuos",
      "Con Zonación",
      "Con EAT",
      "Pareados",
      "Completitud media %",
      "Completitud mediana %",
      "Completitud DE",
      "Completitud mín %",
      "Completitud máx %",
      "Zonas presentes (suma)",
      "Zonas posibles (suma)",
      "Completitud agregada %",
      "Costillas zonas (suma)",
      "Costillas % agregado (Zon.)",
      "Vértebras zonas (suma)",
      "Vértebras % agregado (Zon.)",
      "IPO media %",
      "IPO mediana %",
      "IPO DE",
      "ICH media %",
      "ICH mediana %",
      "ICH DE",
      "EAT media %",
      "EAT mediana %",
      "EAT DE",
      "EAT mín %",
      "EAT máx %",
      "Puntos EAT (suma)",
      "Puntos posibles (suma)",
      "IPO agregado %",
      "Costillas EAT (suma)",
      "Costillas % agregado (EAT)",
      "Vértebras EAT (suma)",
      "Vértebras % agregado (EAT)",
    ];
    const rows = [...sitios, total].map((s) => [
      s.sitio,
      s.n,
      s.conZonacion,
      s.conEat,
      s.pareados,
      s.zonacion.completitud.media,
      s.zonacion.completitud.mediana,
      s.zonacion.completitud.de,
      s.zonacion.completitud.min,
      s.zonacion.completitud.max,
      s.zonacion.zonasPresentes,
      s.zonacion.zonasPosibles,
      s.zonacion.completitudAgregada,
      s.zonacion.costillasZonas,
      s.zonacion.costillasPctAgregado,
      s.zonacion.vertebrasZonas,
      s.zonacion.vertebrasPctAgregado,
      s.eat.ipo.media,
      s.eat.ipo.mediana,
      s.eat.ipo.de,
      s.eat.ich.media,
      s.eat.ich.mediana,
      s.eat.ich.de,
      s.eat.eat.media,
      s.eat.eat.mediana,
      s.eat.eat.de,
      s.eat.eat.min,
      s.eat.eat.max,
      s.eat.puntos,
      s.eat.puntosPosibles,
      s.eat.ipoAgregado,
      s.eat.costillasN,
      s.eat.costillasPctAgregado,
      s.eat.vertebrasN,
      s.eat.vertebrasPctAgregado,
    ]);
    descargarCSV("planilla_totales-por-sitio", headers, rows);
  }

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-ink">Planilla de totales</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Valores totales de los dos métodos —Zonación (Knüsel &amp; Outram) y EAT
          (Serrulla &amp; Vázquez)— para cada individuo de la muestra y agregados para
          cada sitio. Las métricas son las que calculó y guardó el backend al registrar
          cada ficha; acá solo se leen y se agregan.
        </p>
      </header>

      {/* ---------- Totales por sitio ---------- */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-semibold text-ink">
              Totales por sitio
            </h2>
            <p className="mt-0.5 text-xs text-faint">
              <strong>Media</strong> = promedio de los valores individuales (cada individuo
              pesa igual). <strong>Agregado</strong> = suma de lo presente sobre la suma de
              lo posible (los individuos más completos pesan más).
            </p>
          </div>
          <button onClick={exportarSitios} className="btn btn-ghost text-xs">
            Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[0.7rem] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-semibold" rowSpan={2}>
                  Sitio
                </th>
                <th className="px-3 py-2 font-semibold" rowSpan={2}>
                  n
                </th>
                <th className="border-l border-line px-3 py-2 font-semibold" colSpan={4}>
                  Zonación
                </th>
                <th className="border-l border-line px-3 py-2 font-semibold" colSpan={5}>
                  EAT
                </th>
              </tr>
              <tr className="border-b border-line bg-surface-2 text-left text-[0.7rem] uppercase tracking-wide text-muted">
                <th className="border-l border-line px-3 py-2 font-semibold">
                  Completitud media
                </th>
                <th className="px-3 py-2 font-semibold">Mediana</th>
                <th className="px-3 py-2 font-semibold">Agregada</th>
                <th className="px-3 py-2 font-semibold">Zonas</th>
                <th className="border-l border-line px-3 py-2 font-semibold">IPO media</th>
                <th className="px-3 py-2 font-semibold">IPO agregado</th>
                <th className="px-3 py-2 font-semibold">ICH media</th>
                <th className="px-3 py-2 font-semibold">EAT media</th>
                <th className="px-3 py-2 font-semibold">EAT mediana</th>
              </tr>
            </thead>
            <tbody>
              {[...sitios, total].map((s) => (
                <FilaSitio key={s.sitio} s={s} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-5 py-3 text-xs leading-relaxed text-faint">
          El <strong>EAT del sitio</strong> se reporta como media y mediana de los EAT
          individuales. No se aplica la fórmula multiplicativa
          EAT&nbsp;=&nbsp;100&nbsp;−&nbsp;(IPO×ICH)/100 sobre promedios: está definida por
          individuo y aplicarla a agregados daría otro estadístico, no el EAT del sitio.
          La dispersión (DE, mín, máx) va completa en el CSV.
        </div>
      </section>

      {/* ---------- Filtros ---------- */}
      <section className="card flex flex-wrap items-center gap-3 p-4">
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
        <span className="text-xs text-faint">{filas.length} individuo(s)</span>
        <button onClick={exportarIndividuos} className="btn btn-ghost ml-auto text-xs">
          Exportar CSV
        </button>
      </section>

      {/* ---------- Totales por individuo ---------- */}
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Totales por individuo
          </h2>
          <p className="mt-0.5 text-xs text-faint">
            Zonas de Zonación sobre {D.zonacion.total} · puntos de IPO sobre{" "}
            {D.eat.ipoPuntos}. Hacé clic en los encabezados subrayados para ordenar.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[0.7rem] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-semibold" rowSpan={2}>
                  <Sortable label="Código" k="codigo" orden={orden} dir={dir} on={ordenar} />
                </th>
                <th className="px-3 py-2 font-semibold" rowSpan={2}>
                  <Sortable label="Sitio" k="sitio" orden={orden} dir={dir} on={ordenar} />
                </th>
                <th className="border-l border-line px-3 py-2 font-semibold" colSpan={4}>
                  Zonación
                </th>
                <th className="border-l border-line px-3 py-2 font-semibold" colSpan={5}>
                  EAT
                </th>
              </tr>
              <tr className="border-b border-line bg-surface-2 text-left text-[0.7rem] uppercase tracking-wide text-muted">
                <th className="border-l border-line px-3 py-2 font-semibold">
                  <Sortable
                    label="Completitud"
                    k="completitud"
                    orden={orden}
                    dir={dir}
                    on={ordenar}
                  />
                </th>
                <th className="px-3 py-2 font-semibold">Zonas</th>
                <th className="px-3 py-2 font-semibold">Elementos</th>
                <th className="px-3 py-2 font-semibold">Cost. / Vért.</th>
                <th className="border-l border-line px-3 py-2 font-semibold">
                  <Sortable label="IPO" k="ipo" orden={orden} dir={dir} on={ordenar} />
                </th>
                <th className="px-3 py-2 font-semibold">
                  <Sortable label="ICH" k="ich" orden={orden} dir={dir} on={ordenar} />
                </th>
                <th className="px-3 py-2 font-semibold">
                  <Sortable label="EAT" k="eat" orden={orden} dir={dir} on={ordenar} />
                </th>
                <th className="px-3 py-2 font-semibold">Puntos</th>
                <th className="px-3 py-2 font-semibold">Cost. / Vért.</th>
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
                  <td className="border-l border-line px-3 py-2.5 font-medium text-ink">
                    {num(r.zonacion.completitudGlobal, "%")}
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    {num(r.zonacion.zonasPresentes)}
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    {num(r.zonacion.elementosPresentes)}
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    <Par a={r.zonacion.costillasZonas} b={r.zonacion.vertebrasZonas} on={r.zonacion.presente} />
                  </td>
                  <td className="border-l border-line px-3 py-2.5 text-muted">
                    {num(r.eat.ipo, "%")}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{num(r.eat.ich, "%")}</td>
                  <td className="px-3 py-2.5 font-medium text-accent">
                    {num(r.eat.eat, "%")}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{num(r.eat.totalPresent)}</td>
                  <td className="px-3 py-2.5 text-muted">
                    <Par a={r.eat.costillasN} b={r.eat.vertebrasN} on={r.eat.presente} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-muted">
        Para ver qué individuos no tienen costillas o vértebras cargadas y de qué sitios
        son, entrá a{" "}
        <Link href="/cobertura" className="font-medium text-accent hover:underline">
          Cobertura
        </Link>
        .
      </p>
    </div>
  );
}

/* ---------- piezas ---------- */

function FilaSitio({ s }: { s: AgregadoSitio }) {
  const esTotal = s.sitio === "TOTAL";
  return (
    <tr
      className={`border-b border-line last:border-0 ${
        esTotal ? "bg-surface-2 font-semibold" : ""
      }`}
    >
      <td className="px-3 py-2.5 font-medium text-ink">{s.sitio}</td>
      <td className="px-3 py-2.5 text-muted">{s.n}</td>
      <td className="border-l border-line px-3 py-2.5 text-ink">
        {media(s.zonacion.completitud)}
      </td>
      <td className="px-3 py-2.5 text-muted">{num(s.zonacion.completitud.mediana, "%")}</td>
      <td className="px-3 py-2.5 text-muted">{num(s.zonacion.completitudAgregada, "%")}</td>
      <td className="px-3 py-2.5 text-faint">
        {s.zonacion.zonasPresentes} / {s.zonacion.zonasPosibles}
      </td>
      <td className="border-l border-line px-3 py-2.5 text-ink">{media(s.eat.ipo)}</td>
      <td className="px-3 py-2.5 text-muted">{num(s.eat.ipoAgregado, "%")}</td>
      <td className="px-3 py-2.5 text-muted">{media(s.eat.ich)}</td>
      <td className="px-3 py-2.5 font-medium text-accent">{media(s.eat.eat)}</td>
      <td className="px-3 py-2.5 text-muted">{num(s.eat.eat.mediana, "%")}</td>
    </tr>
  );
}

/** "media% ± DE" */
function media(s: Stats) {
  if (s.media === null) return "—";
  return (
    <>
      {s.media}%{" "}
      {s.de !== null && <span className="text-xs font-normal text-faint">± {s.de}</span>}
    </>
  );
}

function Par({ a, b, on }: { a: number; b: number; on: boolean }) {
  if (!on) return <span className="text-faint">—</span>;
  const cls = (v: number) => (v === 0 ? "font-semibold text-[var(--danger)]" : "");
  return (
    <span>
      <span className={cls(a)}>{a}</span>
      <span className="text-faint"> / </span>
      <span className={cls(b)}>{b}</span>
    </span>
  );
}

function Sortable({
  label,
  k,
  orden,
  dir,
  on,
}: {
  label: string;
  k: Orden;
  orden: Orden;
  dir: 1 | -1;
  on: (k: Orden) => void;
}) {
  const activo = orden === k;
  return (
    <button
      onClick={() => on(k)}
      className={`underline decoration-dotted underline-offset-4 transition-colors hover:text-ink ${
        activo ? "text-ink" : ""
      }`}
    >
      {label}
      {activo && <span aria-hidden> {dir === 1 ? "▲" : "▼"}</span>}
    </button>
  );
}
