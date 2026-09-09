/**
 * `/datos` — construcción del export tidy-long (y del detalle crudo en pantalla).
 * =============================================================================
 * Módulo PURO extraído de `src/app/datos/page.tsx` para poder testearlo con el
 * runner de Node (`tests/datos-export-tidy.test.mjs`). La página quedó solo con
 * el render; la forma de las filas exportadas se fija acá y se prueba.
 *
 * ─── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 * Este CSV es el insumo del análisis en R/Python de la tesis: si duplica huesos,
 * duplica el error aguas abajo. La versión anterior recorría los sub-objetos de
 * mano/pie con un `Object.entries(...)` GENÉRICO, así que después del backfill de
 * unidades anatómicas (2026-08-02) emitía las claves nuevas **y** los espejos
 * legacy juntos:
 *
 *   pieDer → calcaneo=1, astragalo=1, restoTarso=5, ... **y** tarsianos=7
 *   manoDer → falProximales=5, falMedias=4, ...        **y** falProxMedias=9
 *
 * No se perdía nada: SOBRABA. Pero sumar las columnas numéricas de un pie daba
 * **33 en vez de 26** (mano: 36 en vez de 27). Ahora el export emite SOLO la
 * partición canónica, con las allowlists de `convex/lib/eatUnits.ts` como única
 * fuente de verdad (`EAT_HAND_BONE_KEYS` / `EAT_FOOT_BONE_KEYS`) — no se
 * hardcodean listas nuevas acá, para que no puedan divergir del contrato.
 *
 * ─── 🔒 LECTURA DUAL (cinturón y tiradores) ───────────────────────────────────
 * Una allowlist sola sería frágil: si entrara una ficha SIN las claves nuevas
 * (import externo, rollback de la migración), filtrar por allowlist emitiría
 * ceros → **pérdida de información en el CSV**, exactamente el error que este
 * cambio evita. Por eso el valor se lee con `hydrateMano` / `hydratePie` de
 * `eatPreview.ts`: las MISMAS funciones que usa el formulario, que derivan del
 * agregado legacy (`deriveTarso` / `deriveFalangesMano`, supuesto best-case del
 * contrato) cuando las claves granulares no están. Ficha migrada o no, el export
 * emite la partición canónica con valores reales.
 *
 * ⚠️ Nombres de columna: el header del tidy NO cambia
 * (`codigo, sitio, fosa, uf, metodo, elemento, clave, valor`). Lo que cambia es
 * el conjunto de valores de `clave` en las filas de mano/pie: desaparecen
 * `tarsianos` y `falProxMedias` (espejos), aparecen `calcaneo`, `astragalo`,
 * `restoTarso`, `falProximales` y `falMedias` (mano). Ningún nombre preexistente
 * y todavía válido se renombró.
 */

import {
  EAT_FOOT_BONE_KEYS,
  EAT_HAND_BONE_KEYS,
  num,
} from "@convex/lib/eatUnits";
import { hydrateMano, hydratePie } from "@/lib/eatPreview";

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Tipos (espejan el shape de `api.analisis.dashboard` — read-only)           */
/*  Las métricas vienen YA calculadas del backend; acá NO se recalcula nada.   */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface ZonMetrics {
  completitudGlobal: number;
  zonasPresentes: number;
  elementosPresentes: number;
  ffi: { n: number; media: number | null; frescas: number; secas: number };
  alteracionesCount: number;
  fragmentosCount: number;
}

export interface EatMetrics {
  ipo: number;
  ich: number;
  eat: number;
  totalPresent: number;
}

export interface Metodo<M> {
  presente: boolean;
  metricas?: M | null;
  data?: Record<string, unknown> | null;
  registrador?: string;
  fechaRegistro?: string;
  revisionesPendientes?: unknown[];
}

export interface DashRow {
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

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Mapas de elementos / grupos (detalle crudo + export)                       */
/* ══════════════════════════════════════════════════════════════════════════ */

export const ZON_ELEMENTOS: { key: string; label: string }[] = [
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

export const EAT_GRUPOS_BOOL: { key: string; label: string }[] = [
  { key: "craneo", label: "Cráneo" },
  { key: "vertebras", label: "Vértebras" },
  { key: "huesosLargos", label: "Huesos largos" },
  { key: "huesosPlanos", label: "Huesos planos" },
  { key: "costillas", label: "Costillas" },
];

/** Los cuatro sub-objetos de extremidad del EAT, con su tipo de partición. */
export interface EatLimbSpec {
  key: string;
  label: string;
  kind: "mano" | "pie";
}

export const EAT_EXTREMIDADES: readonly EatLimbSpec[] = [
  { key: "manoDer", label: "Mano derecha", kind: "mano" },
  { key: "manoIzq", label: "Mano izquierda", kind: "mano" },
  { key: "pieDer", label: "Pie derecho", kind: "pie" },
  { key: "pieIzq", label: "Pie izquierdo", kind: "pie" },
] as const;

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Helpers de extracción del `data` crudo                                     */
/* ══════════════════════════════════════════════════════════════════════════ */

export function truthyKeys(o: unknown): string[] {
  if (!o || typeof o !== "object") return [];
  return Object.entries(o as Record<string, unknown>)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/**
 * Inventario de una extremidad en la **partición canónica** de la fuente.
 *
 * - **Allowlist del contrato** (`EAT_HAND_BONE_KEYS` / `EAT_FOOT_BONE_KEYS`):
 *   emite las 5 claves de la mano / 7 del pie y **excluye los espejos legacy**.
 * - **Lectura dual:** el valor sale de `hydrateMano` / `hydratePie`, que derivan
 *   del agregado legacy si las claves nuevas no están (nunca emite ceros por
 *   leer un shape viejo).
 * - Se omiten los ceros (el tidy-long solo lleva presencias, igual que antes).
 * - Lado ausente (`undefined`, no-objeto) → `[]`, no se inventan filas.
 *
 * Suma de control: mano completa = 27, pie completo = 26 (no 36 / 33).
 */
export function canonicalLimbEntries(
  raw: unknown,
  kind: "mano" | "pie",
): [string, number][] {
  if (!isObj(raw)) return [];
  const values = (
    kind === "mano" ? hydrateMano(raw) : hydratePie(raw)
  ) as unknown as Record<string, unknown>;
  const keys = kind === "mano" ? EAT_HAND_BONE_KEYS : EAT_FOOT_BONE_KEYS;
  const out: [string, number][] = [];
  for (const k of keys) {
    const v = num(values[k]);
    if (Number.isFinite(v) && v > 0) out.push([k, v]);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Export tidy-long                                                           */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface TidyRow {
  codigo: string;
  sitio: string;
  fosa: string;
  uf: string;
  metodo: string;
  elemento: string;
  clave: string;
  valor: number;
}

/** Header del tidy. 🔒 Estable: es el contrato con los scripts de R/Python. */
export const TIDY_HEADERS = [
  "codigo",
  "sitio",
  "fosa",
  "uf",
  "metodo",
  "elemento",
  "clave",
  "valor",
] as const;

export function tidyRowsFor(row: DashRow): TidyRow[] {
  const base = {
    codigo: row.codigoCanonico,
    sitio: row.sitio,
    fosa: row.numeroFosa,
    uf: row.codigoUF,
  };
  const out: TidyRow[] = [];

  /* ---- Zonación ----
   * Fragmentos, FFI y tafonomía salieron del tidy el 2026-09-09 (Martina: no
   * se usaron). El dato sigue en Convex; simplemente ya no se exporta. */
  const zd = row.zonacion.presente ? row.zonacion.data ?? {} : null;
  if (zd) {
    for (const { key, label } of ZON_ELEMENTOS) {
      for (const k of truthyKeys(zd[key])) {
        out.push({ ...base, metodo: "zonacion", elemento: label, clave: k, valor: 1 });
      }
    }
  }

  /* ---- EAT ---- */
  const ed = row.eat.presente ? row.eat.data ?? {} : null;
  if (ed) {
    for (const { key, label } of EAT_GRUPOS_BOOL) {
      for (const k of truthyKeys(ed[key])) {
        out.push({ ...base, metodo: "eat", elemento: label, clave: k, valor: 1 });
      }
    }
    if (ed.mandibula)
      out.push({ ...base, metodo: "eat", elemento: "Mandíbula", clave: "mandibula", valor: 1 });
    if (ed.hioides)
      out.push({ ...base, metodo: "eat", elemento: "Hioides", clave: "hioides", valor: 1 });
    // 🔒 Partición canónica + lectura dual: nunca los espejos legacy.
    for (const { key, label, kind } of EAT_EXTREMIDADES) {
      for (const [k, v] of canonicalLimbEntries(ed[key], kind)) {
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

/** Fila del tidy → array en el orden de `TIDY_HEADERS`. */
export function tidyRowToArray(t: TidyRow): (string | number)[] {
  return [t.codigo, t.sitio, t.fosa, t.uf, t.metodo, t.elemento, t.clave, t.valor];
}
