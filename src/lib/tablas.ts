/**
 * Helpers compartidos de tabla + export para las vistas de cobertura y planilla.
 * Client-side, sin librerías externas.
 */

/* ---------- Tipos que espejan api.cobertura.cobertura (read-only) ---------- */

export interface Stats {
  n: number;
  media: number | null;
  mediana: number | null;
  min: number | null;
  max: number | null;
  de: number | null;
}

export type Discrepancia = "solo-eat" | "solo-zonacion" | null;

export interface FilaCobertura {
  _id: string;
  codigoCanonico: string;
  sitio: string;
  anioExcavacion: number;
  numeroFosa: string;
  codigoUF: string;
  numeroIndividuo: string;
  sexoEstimado: string | null;
  edadEstimada: string | null;
  zonacion: {
    presente: boolean;
    costillasZonas: number;
    costillasPct: number;
    vertebrasZonas: number;
    vertebrasPct: number;
    sacroZonas: number;
    completitudGlobal: number | null;
    zonasPresentes: number | null;
    elementosPresentes: number | null;
    ffiMedia: number | null;
    alteraciones: number | null;
    fragmentos: number | null;
  };
  eat: {
    presente: boolean;
    costillasN: number;
    costillasPct: number;
    vertebrasN: number;
    vertebrasPct: number;
    ipo: number | null;
    ich: number | null;
    eat: number | null;
    totalPresent: number | null;
  };
  vacios: {
    zonCostillas: boolean;
    zonVertebras: boolean;
    zonAmbos: boolean;
    eatCostillas: boolean;
    eatVertebras: boolean;
    eatAmbos: boolean;
    costillasVacio: boolean;
    vertebrasVacio: boolean;
  };
  ambosGruposVacios: boolean;
  algunVacio: boolean;
  discrepancias: { costillas: Discrepancia; vertebras: Discrepancia };
}

export interface AgregadoSitio {
  sitio: string;
  n: number;
  conZonacion: number;
  conEat: number;
  pareados: number;
  zonacion: {
    completitud: Stats;
    zonasPresentes: number;
    zonasPosibles: number;
    completitudAgregada: number;
    costillasZonas: number;
    costillasPosibles: number;
    costillasPctAgregado: number;
    vertebrasZonas: number;
    vertebrasPosibles: number;
    vertebrasPctAgregado: number;
    ffiMedia: Stats;
  };
  eat: {
    ipo: Stats;
    ich: Stats;
    eat: Stats;
    puntos: number;
    puntosPosibles: number;
    ipoAgregado: number;
    costillasN: number;
    costillasPosibles: number;
    costillasPctAgregado: number;
    vertebrasN: number;
    vertebrasPosibles: number;
    vertebrasPctAgregado: number;
  };
  vacios: {
    zonCostillas: number;
    zonVertebras: number;
    zonAmbos: number;
    eatCostillas: number;
    eatVertebras: number;
    eatAmbos: number;
    costillas: number;
    vertebras: number;
    ambosGrupos: number;
    alguno: number;
  };
  discrepancias: { costillas: number; vertebras: number };
}

export interface Cobertura {
  denominadores: {
    zonacion: { costillas: number; vertebras: number; sacro: number; total: number };
    eat: { costillas: number; vertebras: number; ipoPuntos: number };
  };
  individuos: FilaCobertura[];
  sitios: AgregadoSitio[];
  total: AgregadoSitio;
}

/* ---------- Export CSV ---------- */

export type Celda = string | number | null;

export function csvEscape(v: Celda): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: Celda[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  // BOM para que Excel interprete UTF-8 (acentos).
  return "﻿" + lines.join("\r\n");
}

export function download(filename: string, content: string, mime: string) {
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

export function descargarCSV(nombre: string, headers: string[], rows: Celda[][]) {
  const hoy = new Date().toISOString().slice(0, 10);
  download(`${nombre}_${hoy}.csv`, toCSV(headers, rows), "text/csv;charset=utf-8");
}

/* ---------- Formato ---------- */

export const num = (v: number | null | undefined, suf = "") =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v}${suf}`;
