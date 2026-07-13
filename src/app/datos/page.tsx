"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

/* ================================================================== */
/*  Tipos (espejan el shape de api.analisis.dashboard — read-only).    */
/*  Las métricas vienen YA calculadas del backend; acá NO se recalcula. */
/* ================================================================== */

interface ZonMetrics {
  completitudGlobal: number;
  zonasPresentes: number;
  elementosPresentes: number;
  ffi: { n: number; media: number | null; frescas: number; secas: number };
  alteracionesCount: number;
  fragmentosCount: number;
}
interface EatMetrics {
  ipo: number;
  ich: number;
  eat: number;
  totalPresent: number;
}
interface Metodo<M> {
  presente: boolean;
  metricas?: M | null;
  data?: Record<string, unknown> | null;
  registrador?: string;
  fechaRegistro?: string;
  revisionesPendientes?: unknown[];
}
interface DashRow {
  _id: string;
  codigoCanonico: string;
  anioExcavacion: number;
  sitio: string;
  numeroFosa: string;
  codigoUF: string;
  numeroIndividuo: string;
  sexoEstimado: string | null;
  edadEstimada: string | null;
  observaciones: string | null;
  revisionesPendientesCount: number;
  zonacion: Metodo<ZonMetrics>;
  eat: Metodo<EatMetrics>;
}

/* ================================================================== */
/*  Mapas de elementos / grupos para el detalle crudo y el export      */
/* ================================================================== */

const ZON_ELEMENTOS: { key: string; label: string }[] = [
  { key: "cranium_zones", label: "Cráneo" },
  { key: "mandible_zones", label: "Mandíbula" },
  { key: "vertebrae_zones", label: "Vértebras" },
  { key: "sacrum_zones", label: "Sacro" },
  { key: "sternum_zones", label: "Esternón" },
  { key: "clavicle_zones", label: "Clavícula" },
  { key: "rib_zones", label: "Costillas" },
  { key: "scapula_zones", label: "Escápula" },
  { key: "humerus_zones", label: "Húmero" },
  { key: "radius_zones", label: "Radio" },
  { key: "ulna_zones", label: "Cúbito" },
  { key: "os_coxae_zones", label: "Coxal" },
  { key: "femur_zones", label: "Fémur" },
  { key: "tibia_zones", label: "Tibia" },
  { key: "fibula_zones", label: "Peroné" },
  { key: "patella_zones", label: "Rótula" },
  { key: "hand_zones", label: "Mano" },
  { key: "foot_zones", label: "Pie" },
];

const EAT_GRUPOS_BOOL: { key: string; label: string }[] = [
  { key: "craneo", label: "Cráneo" },
  { key: "vertebras", label: "Vértebras" },
  { key: "huesosLargos", label: "Huesos largos" },
  { key: "huesosPlanos", label: "Huesos planos" },
  { key: "costillas", label: "Costillas" },
];

const EAT_EXTREMIDADES: { key: string; label: string }[] = [
  { key: "manoDer", label: "Mano derecha" },
  { key: "manoIzq", label: "Mano izquierda" },
  { key: "pieDer", label: "Pie derecho" },
  { key: "pieIzq", label: "Pie izquierdo" },
];

/* ---- helpers de extracción del data crudo -------------------------- */

function truthyKeys(o: unknown): string[] {
  if (!o || typeof o !== "object") return [];
  return Object.entries(o as Record<string, unknown>)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k);
}

function numericEntries(o: unknown): [string, number][] {
  if (!o || typeof o !== "object") return [];
  return Object.entries(o as Record<string, unknown>)
    .map(([k, v]) => [k, Number(v)] as [string, number])
    .filter(([, v]) => Number.isFinite(v) && v > 0);
}

/* ================================================================== */
/*  Export helpers (client-side, sin librerías externas)               */
/* ================================================================== */

interface TidyRow {
  codigo: string;
  sitio: string;
  fosa: string;
  uf: string;
  metodo: string;
  elemento: string;
  clave: string;
  valor: number;
}

function tidyRowsFor(row: DashRow): TidyRow[] {
  const base = {
    codigo: row.codigoCanonico,
    sitio: row.sitio,
    fosa: row.numeroFosa,
    uf: row.codigoUF,
  };
  const out: TidyRow[] = [];

  // ---- Zonación ----
  const zd = row.zonacion.presente ? row.zonacion.data ?? {} : null;
  if (zd) {
    for (const { key, label } of ZON_ELEMENTOS) {
      for (const k of truthyKeys(zd[key])) {
        out.push({ ...base, metodo: "zonacion", elemento: label, clave: k, valor: 1 });
      }
    }
    for (const [k, v] of numericEntries(zd.fragments)) {
      out.push({ ...base, metodo: "zonacion", elemento: "Fragmentos", clave: k, valor: v });
    }
    for (const k of truthyKeys(zd.taphonomy)) {
      out.push({ ...base, metodo: "zonacion", elemento: "Tafonomía", clave: k, valor: 1 });
    }
    if (Array.isArray(zd.ffi_rows)) {
      (zd.ffi_rows as Record<string, unknown>[]).forEach((r, i) => {
        for (const f of ["outline", "angle", "texture"] as const) {
          const val = Number(r[f]);
          if (r[f] !== "" && r[f] !== undefined && r[f] !== null && Number.isFinite(val)) {
            out.push({
              ...base,
              metodo: "zonacion",
              elemento: "FFI",
              clave: `fila${i + 1}_${f}`,
              valor: val,
            });
          }
        }
      });
    }
  }

  // ---- EAT ----
  const ed = row.eat.presente ? row.eat.data ?? {} : null;
  if (ed) {
    for (const { key, label } of EAT_GRUPOS_BOOL) {
      for (const k of truthyKeys(ed[key])) {
        out.push({ ...base, metodo: "eat", elemento: label, clave: k, valor: 1 });
      }
    }
    if (ed.mandibula) out.push({ ...base, metodo: "eat", elemento: "Mandíbula", clave: "mandibula", valor: 1 });
    if (ed.hioides) out.push({ ...base, metodo: "eat", elemento: "Hioides", clave: "hioides", valor: 1 });
    for (const { key, label } of EAT_EXTREMIDADES) {
      for (const [k, v] of numericEntries(ed[key])) {
        out.push({ ...base, metodo: "eat", elemento: label, clave: k, valor: v });
      }
    }
    const quality = (ed.quality ?? {}) as Record<string, { value?: number }>;
    for (const [k, q] of Object.entries(quality)) {
      const val = Number(q?.value);
      if (Number.isFinite(val) && val > 0) {
        out.push({ ...base, metodo: "eat", elemento: "Calidad (ICH)", clave: k, valor: val });
      }
    }
  }

  return out;
}

/* Columnas de la tabla maestra (wide). Fuente de verdad para tabla + export. */
type Col = { key: string; label: string; get: (r: DashRow) => string | number };

const MASTER_COLS: Col[] = [
  { key: "codigo", label: "Código", get: (r) => r.codigoCanonico },
  { key: "sitio", label: "Sitio", get: (r) => r.sitio },
  { key: "anio", label: "Año", get: (r) => r.anioExcavacion },
  { key: "fosa", label: "Fosa", get: (r) => r.numeroFosa },
  { key: "uf", label: "UF", get: (r) => r.codigoUF },
  { key: "numeroIndividuo", label: "Individuo", get: (r) => r.numeroIndividuo },
  { key: "sexo", label: "Sexo", get: (r) => r.sexoEstimado ?? "" },
  { key: "edad", label: "Edad", get: (r) => r.edadEstimada ?? "" },
  { key: "tieneZonacion", label: "Zonación", get: (r) => (r.zonacion.presente ? "sí" : "no") },
  { key: "tieneEat", label: "EAT", get: (r) => (r.eat.presente ? "sí" : "no") },
  { key: "completitudGlobal", label: "Completitud %", get: (r) => r.zonacion.metricas?.completitudGlobal ?? "" },
  { key: "zonasPresentes", label: "Zonas presentes", get: (r) => r.zonacion.metricas?.zonasPresentes ?? "" },
  { key: "elementosPresentes", label: "Elementos presentes", get: (r) => r.zonacion.metricas?.elementosPresentes ?? "" },
  { key: "ffiN", label: "FFI n", get: (r) => r.zonacion.metricas?.ffi.n ?? "" },
  { key: "ffiMedia", label: "FFI media", get: (r) => r.zonacion.metricas?.ffi.media ?? "" },
  { key: "ffiFrescas", label: "FFI frescas", get: (r) => r.zonacion.metricas?.ffi.frescas ?? "" },
  { key: "ffiSecas", label: "FFI secas", get: (r) => r.zonacion.metricas?.ffi.secas ?? "" },
  { key: "alteraciones", label: "Alteraciones", get: (r) => r.zonacion.metricas?.alteracionesCount ?? "" },
  { key: "fragmentos", label: "Fragmentos", get: (r) => r.zonacion.metricas?.fragmentosCount ?? "" },
  { key: "ipo", label: "IPO %", get: (r) => r.eat.metricas?.ipo ?? "" },
  { key: "ich", label: "ICH %", get: (r) => r.eat.metricas?.ich ?? "" },
  { key: "eat", label: "EAT %", get: (r) => r.eat.metricas?.eat ?? "" },
  { key: "totalPresent", label: "EAT total presente", get: (r) => r.eat.metricas?.totalPresent ?? "" },
  { key: "revisionesPendientes", label: "Revisiones pend.", get: (r) => r.revisionesPendientesCount },
  { key: "observaciones", label: "Observaciones", get: (r) => r.observaciones ?? "" },
];

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  // BOM para que Excel interprete UTF-8 (acentos).
  return "﻿" + lines.join("\r\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const HOY = () => new Date().toISOString().slice(0, 10);

/* ================================================================== */
/*  Página                                                             */
/* ================================================================== */

type MetodoFiltro = "todos" | "ambos" | "zon" | "eat" | "revisiones";

export default function DatosPage() {
  const rows = useQuery(api.analisis.dashboard, {}) as unknown as DashRow[] | undefined;

  const [fSitio, setFSitio] = useState("");
  const [fFosa, setFFosa] = useState("");
  const [fSexo, setFSexo] = useState("");
  const [fMetodo, setFMetodo] = useState<MetodoFiltro>("todos");
  const [sortKey, setSortKey] = useState("codigo");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [verJson, setVerJson] = useState<string | null>(null);

  /* Opciones de filtro derivadas de la data (no hardcodeadas). */
  const opciones = useMemo(() => {
    const sitios = new Set<string>();
    const fosas = new Set<string>();
    const sexos = new Set<string>();
    for (const r of rows ?? []) {
      if (r.sitio) sitios.add(r.sitio);
      if (r.numeroFosa) fosas.add(r.numeroFosa);
      if (r.sexoEstimado) sexos.add(r.sexoEstimado);
    }
    const alfa = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });
    return {
      sitios: [...sitios].sort(alfa),
      fosas: [...fosas].sort(alfa),
      sexos: [...sexos].sort(alfa),
    };
  }, [rows]);

  /* Filtrado client-side. */
  const filtrados = useMemo(() => {
    const arr = (rows ?? []).filter((r) => {
      if (fSitio && r.sitio !== fSitio) return false;
      if (fFosa && r.numeroFosa !== fFosa) return false;
      if (fSexo && r.sexoEstimado !== fSexo) return false;
      if (fMetodo === "ambos" && !(r.zonacion.presente && r.eat.presente)) return false;
      if (fMetodo === "zon" && !(r.zonacion.presente && !r.eat.presente)) return false;
      if (fMetodo === "eat" && !(r.eat.presente && !r.zonacion.presente)) return false;
      if (fMetodo === "revisiones" && r.revisionesPendientesCount <= 0) return false;
      return true;
    });
    const col = MASTER_COLS.find((c) => c.key === sortKey) ?? MASTER_COLS[0];
    arr.sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb), "es", { numeric: true }) * sortDir;
    });
    return arr;
  }, [rows, fSitio, fFosa, fSexo, fMetodo, sortKey, sortDir]);

  /* Resumen del subconjunto filtrado. */
  const resumen = useMemo(() => {
    const n = filtrados.length;
    const pareados = filtrados.filter((r) => r.zonacion.presente && r.eat.presente).length;
    const soloZon = filtrados.filter((r) => r.zonacion.presente && !r.eat.presente).length;
    const soloEat = filtrados.filter((r) => r.eat.presente && !r.zonacion.presente).length;
    const mean = (xs: number[]) =>
      xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
    const zonM = filtrados.filter((r) => r.zonacion.metricas).map((r) => r.zonacion.metricas!);
    const eatM = filtrados.filter((r) => r.eat.metricas).map((r) => r.eat.metricas!);
    return {
      n,
      pareados,
      soloZon,
      soloEat,
      completitud: mean(zonM.map((m) => m.completitudGlobal)),
      ipo: mean(eatM.map((m) => m.ipo)),
      ich: mean(eatM.map((m) => m.ich)),
      eat: mean(eatM.map((m) => m.eat)),
    };
  }, [filtrados]);

  function sortBy(key: string) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  /* ---- Export (usa el subconjunto FILTRADO) ---- */
  function exportMaestraCSV() {
    const headers = MASTER_COLS.map((c) => c.label);
    const data = filtrados.map((r) => MASTER_COLS.map((c) => c.get(r)));
    download(`registro-osteologico_maestra_${HOY()}.csv`, toCSV(headers, data), "text/csv;charset=utf-8");
  }
  function exportMaestraJSON() {
    const data = filtrados.map((r) =>
      Object.fromEntries(MASTER_COLS.map((c) => [c.key, c.get(r)])),
    );
    download(
      `registro-osteologico_maestra_${HOY()}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
  }
  function exportCrudoCSV() {
    const tidy = filtrados.flatMap(tidyRowsFor);
    const headers = ["codigo", "sitio", "fosa", "uf", "metodo", "elemento", "clave", "valor"];
    const data = tidy.map((t) => [t.codigo, t.sitio, t.fosa, t.uf, t.metodo, t.elemento, t.clave, t.valor]);
    download(`registro-osteologico_crudo-tidy_${HOY()}.csv`, toCSV(headers, data), "text/csv;charset=utf-8");
  }
  function exportCrudoJSON() {
    const tidy = filtrados.flatMap(tidyRowsFor);
    download(
      `registro-osteologico_crudo-tidy_${HOY()}.json`,
      JSON.stringify(tidy, null, 2),
      "application/json",
    );
  }

  if (rows === undefined)
    return <div className="card p-10 text-center text-sm text-muted">Cargando…</div>;

  const hayFiltros = fSitio || fFosa || fSexo || fMetodo !== "todos";

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Datos</h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Todos los individuos con sus covariables y las métricas de ambos métodos.
            Filtrá, explorá el detalle crudo por zona/elemento y exportá a CSV/JSON para
            R o Python. Las métricas se muestran tal como las calculó y guardó el backend.
          </p>
        </div>
        <Link href="/analisis" className="btn btn-ghost">
          Ver análisis comparativo
        </Link>
      </header>

      {/* ---- Filtros ---- */}
      <section className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">Sitio</span>
            <select className="field" value={fSitio} onChange={(e) => setFSitio(e.target.value)}>
              <option value="">Todos</option>
              {opciones.sitios.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Fosa</span>
            <select className="field" value={fFosa} onChange={(e) => setFFosa(e.target.value)}>
              <option value="">Todas</option>
              {opciones.fosas.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Sexo</span>
            <select className="field" value={fSexo} onChange={(e) => setFSexo(e.target.value)}>
              <option value="">Todos</option>
              {opciones.sexos.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Método presente</span>
            <select
              className="field"
              value={fMetodo}
              onChange={(e) => setFMetodo(e.target.value as MetodoFiltro)}
            >
              <option value="todos">Todos</option>
              <option value="ambos">Ambos (Zon + EAT)</option>
              <option value="zon">Solo Zonación</option>
              <option value="eat">Solo EAT</option>
              <option value="revisiones">Con revisiones pendientes</option>
            </select>
          </label>
        </div>
        {hayFiltros && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="text-muted">
              {filtrados.length} de {rows.length} individuos
            </span>
            <button
              type="button"
              className="bulk-btn"
              onClick={() => {
                setFSitio("");
                setFFosa("");
                setFSexo("");
                setFMetodo("todos");
              }}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </section>

      {/* ---- Resumen ---- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Individuos" value={resumen.n} />
        <Card label="Pareados (Zon + EAT)" value={resumen.pareados} accent />
        <Card label="Solo Zonación" value={resumen.soloZon} />
        <Card label="Solo EAT" value={resumen.soloEat} />
        <Card label="Completitud media" value={resumen.completitud === null ? "—" : `${resumen.completitud}%`} />
        <Card label="IPO medio" value={resumen.ipo === null ? "—" : `${resumen.ipo}%`} />
        <Card label="ICH medio" value={resumen.ich === null ? "—" : `${resumen.ich}%`} />
        <Card label="EAT medio" value={resumen.eat === null ? "—" : `${resumen.eat}%`} accent />
      </section>

      {/* ---- Export ---- */}
      <section className="card p-4">
        <h2 className="font-serif text-base font-semibold text-ink">Exportar (subconjunto filtrado)</h2>
        <p className="mt-1 text-sm text-muted">
          Tabla maestra: una fila por individuo (wide). Detalle crudo: formato tidy-long
          (<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">codigo, sitio, fosa, uf, metodo, elemento, clave, valor</code>),
          pensado para R/Python.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={exportMaestraCSV}>Maestra · CSV</button>
          <button type="button" className="btn btn-ghost" onClick={exportMaestraJSON}>Maestra · JSON</button>
          <span className="mx-1 hidden h-8 w-px bg-line sm:inline-block" aria-hidden />
          <button type="button" className="btn btn-ghost" onClick={exportCrudoCSV}>Detalle crudo · CSV</button>
          <button type="button" className="btn btn-ghost" onClick={exportCrudoJSON}>Detalle crudo · JSON</button>
        </div>
      </section>

      {/* ---- Tabla maestra ---- */}
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-serif text-lg font-semibold text-ink">Tabla maestra</h2>
          <p className="text-xs text-faint">
            Clic en un encabezado ordena; clic en una fila muestra el detalle crudo por
            zona/elemento.
          </p>
        </div>
        {filtrados.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">
            No hay individuos que coincidan con los filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <Th onClick={() => sortBy("codigo")} active={sortKey === "codigo"} dir={sortDir}>Código</Th>
                  <Th onClick={() => sortBy("sitio")} active={sortKey === "sitio"} dir={sortDir}>Sitio</Th>
                  <Th onClick={() => sortBy("fosa")} active={sortKey === "fosa"} dir={sortDir}>Fosa/UF</Th>
                  <Th onClick={() => sortBy("sexo")} active={sortKey === "sexo"} dir={sortDir}>Sexo</Th>
                  <Th onClick={() => sortBy("edad")} active={sortKey === "edad"} dir={sortDir}>Edad</Th>
                  <Th onClick={() => sortBy("completitudGlobal")} active={sortKey === "completitudGlobal"} dir={sortDir}>Compl.</Th>
                  <Th onClick={() => sortBy("ipo")} active={sortKey === "ipo"} dir={sortDir}>IPO</Th>
                  <Th onClick={() => sortBy("ich")} active={sortKey === "ich"} dir={sortDir}>ICH</Th>
                  <Th onClick={() => sortBy("eat")} active={sortKey === "eat"} dir={sortDir}>EAT</Th>
                  <th className="px-4 py-2.5 font-semibold">Métodos</th>
                  <th className="px-4 py-2.5 font-semibold">Rev.</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => {
                  const abierto = expandido === r._id;
                  const zm = r.zonacion.metricas;
                  const em = r.eat.metricas;
                  return (
                    <FilaGrupo key={r._id}>
                      <tr
                        className="cursor-pointer border-b border-line hover:bg-surface-2"
                        onClick={() => setExpandido(abierto ? null : r._id)}
                      >
                        <td className="px-4 py-2.5 font-medium text-ink">
                          <span className="mr-1 text-faint">{abierto ? "▾" : "▸"}</span>
                          {r.codigoCanonico}
                        </td>
                        <td className="px-4 py-2.5 text-muted">{r.sitio}</td>
                        <td className="px-4 py-2.5 text-muted">F{r.numeroFosa} · UF{r.codigoUF}</td>
                        <td className="px-4 py-2.5 text-muted">{r.sexoEstimado ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted">{r.edadEstimada ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted">{zm ? `${zm.completitudGlobal}%` : "—"}</td>
                        <td className="px-4 py-2.5 text-muted">{em ? `${em.ipo}%` : "—"}</td>
                        <td className="px-4 py-2.5 text-muted">{em ? `${em.ich}%` : "—"}</td>
                        <td className="px-4 py-2.5 font-medium text-accent">{em ? `${em.eat}%` : "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <span className={r.zonacion.presente ? "pill pill-accent" : "pill opacity-50"}>Z</span>
                            <span className={r.eat.presente ? "pill pill-accent" : "pill opacity-50"}>E</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted">
                          {r.revisionesPendientesCount > 0 ? r.revisionesPendientesCount : "—"}
                        </td>
                      </tr>
                      {abierto && (
                        <tr className="border-b border-line bg-surface-2/40">
                          <td colSpan={11} className="px-4 py-4">
                            <DetalleCrudo
                              row={r}
                              verJson={verJson === r._id}
                              onToggleJson={() => setVerJson(verJson === r._id ? null : r._id)}
                            />
                            <div className="mt-3 text-xs">
                              <Link
                                href={`/individuos/${r._id}`}
                                className="text-accent hover:underline"
                              >
                                Abrir ficha del individuo →
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )}
                    </FilaGrupo>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ================================================================== */
/*  Sub-componentes                                                    */
/* ================================================================== */

function FilaGrupo({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: 1 | -1;
}) {
  return (
    <th className="px-4 py-2.5 font-semibold">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:text-ink"
      >
        {children}
        {active && <span className="text-accent">{dir === 1 ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function Card({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-faint">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ? "text-accent" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function DetalleCrudo({
  row,
  verJson,
  onToggleJson,
}: {
  row: DashRow;
  verJson: boolean;
  onToggleJson: () => void;
}) {
  const zd = row.zonacion.presente ? row.zonacion.data ?? {} : null;
  const ed = row.eat.presente ? row.eat.data ?? {} : null;

  const zonElementos = zd
    ? ZON_ELEMENTOS.map(({ key, label }) => ({ label, presentes: truthyKeys(zd[key]) })).filter(
        (e) => e.presentes.length > 0,
      )
    : [];
  const fragmentos = zd ? numericEntries(zd.fragments) : [];
  const tafonomia = zd ? truthyKeys(zd.taphonomy) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Detalle crudo por zona / elemento
        </span>
        <button type="button" className="bulk-btn" onClick={onToggleJson}>
          {verJson ? "Ocultar JSON" : "Ver JSON"}
        </button>
      </div>

      {verJson ? (
        <pre className="max-h-96 overflow-auto rounded-lg border border-line bg-surface p-3 text-xs text-muted">
          {JSON.stringify({ zonacion: row.zonacion.data, eat: row.eat.data }, null, 2)}
        </pre>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Zonación */}
          <div className="rounded-lg border border-line bg-surface p-3">
            <h4 className="font-serif text-sm font-semibold text-ink">Zonación</h4>
            {!row.zonacion.presente ? (
              <p className="mt-1 text-sm text-faint">Sin ficha de zonación.</p>
            ) : (
              <div className="mt-2 space-y-2 text-xs">
                {zonElementos.length === 0 && (
                  <p className="text-faint">No hay zonas marcadas como presentes.</p>
                )}
                {zonElementos.map((e) => (
                  <div key={e.label}>
                    <span className="font-medium text-ink">{e.label}</span>{" "}
                    <span className="text-faint">({e.presentes.length} zona{e.presentes.length === 1 ? "" : "s"})</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {e.presentes.map((k) => (
                        <span key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {fragmentos.length > 0 && (
                  <div>
                    <span className="font-medium text-ink">Fragmentos</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {fragmentos.map(([k, v]) => (
                        <span key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {tafonomia.length > 0 && (
                  <div>
                    <span className="font-medium text-ink">Tafonomía</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {tafonomia.map((k) => (
                        <span key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EAT */}
          <div className="rounded-lg border border-line bg-surface p-3">
            <h4 className="font-serif text-sm font-semibold text-ink">EAT</h4>
            {!row.eat.presente ? (
              <p className="mt-1 text-sm text-faint">Sin ficha de EAT.</p>
            ) : (
              <div className="mt-2 space-y-2 text-xs">
                {EAT_GRUPOS_BOOL.map(({ key, label }) => {
                  const ks = truthyKeys((ed as Record<string, unknown>)[key]);
                  if (ks.length === 0) return null;
                  return (
                    <div key={key}>
                      <span className="font-medium text-ink">{label}</span>{" "}
                      <span className="text-faint">({ks.length})</span>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {ks.map((k) => (
                          <span key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Boolean(ed?.mandibula || ed?.hioides) && (
                  <div>
                    <span className="font-medium text-ink">Otros</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {ed?.mandibula ? <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">Mandíbula</span> : null}
                      {ed?.hioides ? <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">Hioides</span> : null}
                    </div>
                  </div>
                )}
                {EAT_EXTREMIDADES.map(({ key, label }) => {
                  const units = ed ? numericEntries(ed[key]) : [];
                  if (units.length === 0) return null;
                  return (
                    <div key={key}>
                      <span className="font-medium text-ink">{label}</span>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {units.map(([k, v]) => (
                          <span key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <EatCalidad data={ed} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EatCalidad({ data }: { data: Record<string, unknown> | null }) {
  const quality = (data?.quality ?? {}) as Record<string, { value?: number; obs?: string }>;
  const entries = Object.entries(quality).filter(([, q]) => Number(q?.value) > 0);
  if (entries.length === 0) return null;
  return (
    <div>
      <span className="font-medium text-ink">Calidad (ICH)</span>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {entries.map(([k, q]) => (
          <span key={k} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
            {k}: {q.value}%
          </span>
        ))}
      </div>
    </div>
  );
}
