/**
 * Derived metrics for both recording methods.
 * Pure functions (no Convex imports) so they can be unit-tested and reused.
 *
 * IMPORTANT — EAT formula:
 *   The published worked example (Serrulla & Vázquez 2019, p.5: IPO 16%, ICH 80%
 *   -> EAT 87%) and the source spreadsheet cell `J5 = 1 - H5*H17` both confirm the
 *   EAT is MULTIPLICATIVE, not the arithmetic average the original app used:
 *
 *        EAT = 100 - (IPO * ICH) / 100
 *
 *   Manos/pies are weighted PER ANATOMICAL UNIT (each unit contributes equally,
 *   max 4 pts/hand and 5 pts/foot), matching the spreadsheet's per-unit ratios
 *   rather than raw bone counts.
 */

type Dict = Record<string, unknown> | undefined | null;

function countTrue(o: Dict): number {
  if (!o || typeof o !== "object") return 0;
  return Object.values(o).filter(Boolean).length;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/* ================================================================== */
/*  EAT — Estado de Afectación Tafonómica (Serrulla & Vázquez 2019)    */
/* ================================================================== */

/** Group maxima for the Index of Bone Preservation (IPO). Sum = 115. */
const EAT_IPO_MAX = 115;

/** Hand split into 4 anatomical units (max 4 pts/hand). */
function handPoints(h: Dict): number {
  if (!h || typeof h !== "object") return 0;
  const d = h as Record<string, unknown>;
  const term = (v: unknown, max: number) => Math.min(1, num(v) / max);
  return (
    term(d.carpianos, 8) +
    term(d.metacarpianos, 5) +
    term(d.falProxMedias, 9) +
    term(d.falDistales, 5)
  );
}

/** Foot split into 5 anatomical units (max 5 pts/foot). */
function footPoints(f: Dict): number {
  if (!f || typeof f !== "object") return 0;
  const d = f as Record<string, unknown>;
  const term = (v: unknown, max: number) => Math.min(1, num(v) / max);
  return (
    term(d.tarsianos, 7) +
    term(d.metatarsianos, 5) +
    term(d.falProx, 5) +
    term(d.falMedias, 4) +
    term(d.falDistales, 5)
  );
}

function handBones(h: Dict): number {
  if (!h || typeof h !== "object") return 0;
  return Object.values(h as Record<string, unknown>).reduce<number>((a, v) => a + num(v), 0);
}

export interface EATMetrics {
  ipo: number; // Index of Bone Preservation (%)
  ich: number; // Index of Bone Quality (%) — subjective component
  eat: number; // State of Taphonomic Damage (%) — multiplicative
  totalPresent: number;
}

export function computeEAT(data: Record<string, unknown>): EATMetrics {
  const craneo = countTrue(data.craneo as Dict);
  const vertebras = countTrue(data.vertebras as Dict);
  const huesosLargos = countTrue(data.huesosLargos as Dict);
  const huesosPlanos = countTrue(data.huesosPlanos as Dict);
  const costillas = countTrue(data.costillas as Dict);
  const mandibula = data.mandibula ? 1 : 0;
  const hioides = data.hioides ? 1 : 0;

  const manoDerPts = handPoints(data.manoDer as Dict);
  const manoIzqPts = handPoints(data.manoIzq as Dict);
  const pieDerPts = footPoints(data.pieDer as Dict);
  const pieIzqPts = footPoints(data.pieIzq as Dict);

  const totalPresent =
    craneo + vertebras + huesosLargos + huesosPlanos + costillas +
    mandibula + hioides + manoDerPts + manoIzqPts + pieDerPts + pieIzqPts;

  const ipo = (totalPresent / EAT_IPO_MAX) * 100;

  // ICH = average quality across groups that have bones present (blanks ignored).
  const presence: Record<string, number> = {
    craneo, vertebras, huesosLargos, huesosPlanos, costillas,
    mandibula, hioides,
    manos: handBones(data.manoDer as Dict) + handBones(data.manoIzq as Dict),
    pies: handBones(data.pieDer as Dict) + handBones(data.pieIzq as Dict),
  };
  const quality = (data.quality ?? {}) as Record<string, { value?: number }>;
  const present = Object.keys(presence).filter((k) => presence[k] > 0);
  const ich =
    present.length === 0
      ? 0
      : present.reduce((a, k) => a + num(quality[k]?.value), 0) / present.length;

  const eat = 100 - (ipo * ich) / 100;

  const round = (n: number) => Math.round(n * 100) / 100;
  return { ipo: round(ipo), ich: round(ich), eat: round(eat), totalPresent: round(totalPresent) };
}

/* ================================================================== */
/*  Zonación (Knüsel & Outram 2004)                                   */
/* ================================================================== */

/** Max zones per element (keyed by the data field). Sum = 658.
 *  Hand/foot phalanges are recorded per digit (I–V × position × 3 zones × L/R):
 *  14 phalanges/side × 3 zones × 2 = 84, included in hand_zones/foot_zones. */
export const ZONATION_ELEMENT_MAX: Record<string, number> = {
  cranium_zones: 15,
  mandible_zones: 14,
  vertebrae_zones: 96,
  sacrum_zones: 20,
  sternum_zones: 3,
  clavicle_zones: 6,
  rib_zones: 72,
  scapula_zones: 18,
  humerus_zones: 22,
  radius_zones: 22,
  ulna_zones: 18,
  os_coxae_zones: 24,
  femur_zones: 22,
  tibia_zones: 20,
  fibula_zones: 12,
  hand_zones: 130,
  foot_zones: 144,
};

export const ZONATION_TOTAL_ZONES = Object.values(ZONATION_ELEMENT_MAX).reduce(
  (a, b) => a + b,
  0,
); // 526

export interface ZonacionMetrics {
  completitudGlobal: number; // % of all possible zones present
  completitudPorElemento: Record<string, number>; // % per element
  elementosPresentes: number; // distinct bone elements with >=1 zone
  zonasPresentes: number;
  ffi: { n: number; media: number | null; frescas: number; secas: number }; // FFI summary
  alteracionesCount: number; // taphonomic alterations checked
  fragmentosCount: number; // unidentifiable fragments tallied
}

export function computeZonacion(data: Record<string, unknown>): ZonacionMetrics {
  const completitudPorElemento: Record<string, number> = {};
  let zonasPresentes = 0;
  let elementosPresentes = 0;

  for (const [field, max] of Object.entries(ZONATION_ELEMENT_MAX)) {
    const present = countTrue(data[field] as Dict);
    zonasPresentes += present;
    if (present > 0) elementosPresentes += 1;
    completitudPorElemento[field] = Math.round((present / max) * 1000) / 10;
  }

  const completitudGlobal =
    Math.round((zonasPresentes / ZONATION_TOTAL_ZONES) * 1000) / 10;

  // FFI: rows where outline + angle + texture are all scored (0-2 each, total 0-6).
  // 0-2 total => fresh (perimortem); >=3 => dry (postmortem).
  const rows = Array.isArray(data.ffi_rows) ? (data.ffi_rows as Array<Record<string, unknown>>) : [];
  const totals: number[] = [];
  for (const r of rows) {
    const hasAll = ["outline", "angle", "texture"].every(
      (k) => r[k] !== "" && r[k] !== undefined && r[k] !== null,
    );
    if (hasAll) totals.push(num(r.outline) + num(r.angle) + num(r.texture));
  }
  const ffi = {
    n: totals.length,
    media: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100 : null,
    frescas: totals.filter((t) => t <= 2).length,
    secas: totals.filter((t) => t >= 3).length,
  };

  const alteracionesCount = countTrue(data.taphonomy as Dict);
  const fragmentosCount = data.fragments && typeof data.fragments === "object"
    ? Object.values(data.fragments as Record<string, unknown>).reduce<number>((a, v) => a + num(v), 0)
    : 0;

  return {
    completitudGlobal,
    completitudPorElemento,
    elementosPresentes,
    zonasPresentes,
    ffi,
    alteracionesCount,
    fragmentosCount,
  };
}

/** Dispatch by method type. */
export function computeMetrics(
  tipo: "zonacion" | "eat",
  data: Record<string, unknown>,
): EATMetrics | ZonacionMetrics {
  return tipo === "eat" ? computeEAT(data) : computeZonacion(data);
}
