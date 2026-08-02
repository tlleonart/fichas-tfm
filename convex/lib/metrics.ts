/**
 * Derived metrics for both recording methods.
 * Pure functions (only `./eatUnits`, no Convex imports) so they can be
 * unit-tested offline and reused.
 *
 * IMPORTANT — EAT formula:
 *   The published worked example (Serrulla & Vázquez 2019, p.5: IPO 16%, ICH 80%
 *   -> EAT 87%) and the source spreadsheet cell `J5 = 1 - H5*H17` both confirm the
 *   EAT is MULTIPLICATIVE, not the arithmetic average the original app used:
 *
 *        EAT = 100 - (IPO * ICH) / 100
 *
 *   Manos/pies are weighted PER ANATOMICAL UNIT (each unit contributes equally,
 *   max 4 pts/hand and 5 pts/foot). Which bone belongs to which unit is the
 *   SOURCE's partition, not ours — see `EAT_UNIT_PARTITION_VERSION` below.
 *
 *   ⚠️ The previous version of this header claimed the per-unit weighting
 *   "matched the spreadsheet's per-unit ratios". That was TRUE for the group
 *   maxima (115) and FALSE for the internal partition of hand and foot, which
 *   was inverted until 2026-08 (SDD §1, VALIDACION-METODOLOGICA §A.1).
 */

import { footBoneCount, handBoneCount } from "./eatUnits";

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

/** Group maxima for the Index of Bone Preservation (IPO). Sum = 115. 🔒 No cambia. */
export const EAT_IPO_MAX = 115;

/**
 * Version of the hand/foot ANATOMICAL UNIT PARTITION implemented below.
 *
 *   1 = pre-2026-08 partition (hand: falProxMedias/9 + falDistales/5;
 *       foot: tarsianos/7 + metatarsianos/5 + falProx/5 + falMedias/4 + falDistales/5).
 *       Inverted with respect to the source — see SDD §1.
 *   2 = STRICT partition of Serrulla & Vázquez (2019) — the one below.
 *
 * 🔒 `convex/migrations/eat_units_2026_08.ts` READS this constant and REFUSES to
 * run with `apply: true` while it is `< 2`, so nobody can persist `metricas`
 * computed with the old partition. Do not remove or rename it.
 */
export const EAT_UNIT_PARTITION_VERSION = 2;

/** Coeficiente de una unidad anatómica: presentes / total de la unidad, capado en 1. */
const unitTerm = (v: unknown, max: number) => Math.min(1, num(v) / max);

/**
 * MANO — 4 unidades anatómicas, máx 4 pts/mano (Serrulla & Vázquez 2019,
 * diagrama coloreado de la planilla; evidencia en VALIDACION-METODOLOGICA §A.1).
 *
 *   U.A.1  carpianos                    /8
 *   U.A.2  metacarpianos                /5
 *   U.A.3  falProximales                /5   ← proximales SOLAS (verde del diagrama)
 *   U.A.4  falMedias + falDistales      /9   ← todo lo distal a las proximales (amarillo)
 *
 * Confirmación aritmética independiente: los coeficientes del Gráfico 3 son
 * 0,40 = 2/5 (U.A.3) y 0,22 = 2/9 (U.A.4); con denominador 9 en U.A.3 el 0,40
 * exigiría 3,6/9, que no es un número entero de huesos.
 *
 * ⚠️ Lee SOLO las claves granulares (`falProximales`, `falMedias`): el espejo
 * legacy `falProxMedias` NO se lee más. Los datos llegan siempre normalizados por
 * `normalizeEatUnits` (mutations + migración), que las deriva si faltan.
 */
function handPoints(h: Dict): number {
  if (!h || typeof h !== "object") return 0;
  const d = h as Record<string, unknown>;
  return (
    unitTerm(d.carpianos, 8) +
    unitTerm(d.metacarpianos, 5) +
    unitTerm(d.falProximales, 5) +
    unitTerm(num(d.falMedias) + num(d.falDistales), 9)
  );
}

/**
 * PIE — 5 unidades anatómicas, máx 5 pts/pie.
 *
 *   U.A.1  calcaneo                            /1
 *   U.A.2  astragalo                           /1
 *   U.A.3  restoTarso                          /5   (navicular, cuboides, 3 cuneiformes)
 *   U.A.4  metatarsianos                       /5
 *   U.A.5  falProx + falMedias + falDistales   /10  ← UNA sola unidad en la fuente
 *
 * La fuente carga el peso en los huesos grandes y densos (tarso = 60 % del pie);
 * la partición anterior lo cargaba en las falanges (60 %), que son lo primero que
 * se pierde. Caso testigo: solo calcáneo + astrágalo → 2,00 pts (antes 0,29).
 *
 * 🔒 RAREZAS DE LA FUENTE — se REPLICAN, no se corrigen (principio rector, SDD §5.2):
 *   1. La U.A.5 usa denominador **10** aunque anatómicamente son **14** falanges:
 *      un pie con 11–14 falanges satura en 1,0. Capturamos 14 (más información) y
 *      puntuamos sobre 10 (fidelidad).
 *   2. Los denominadores del pie suman **22** (1+1+5+5+10) aunque el pie tiene
 *      **26** huesos. No es un bug nuestro: es la fuente. Va declarado en el
 *      apartado metodológico del TFM.
 * Un índice "corregido" a criterio propio deja de ser comparable con cualquier
 * otro estudio que use el EAT.
 */
function footPoints(f: Dict): number {
  if (!f || typeof f !== "object") return 0;
  const d = f as Record<string, unknown>;
  return (
    unitTerm(d.calcaneo, 1) +
    unitTerm(d.astragalo, 1) +
    unitTerm(d.restoTarso, 5) +
    unitTerm(d.metatarsianos, 5) +
    unitTerm(num(d.falProx) + num(d.falMedias) + num(d.falDistales), 10)
  );
}

/**
 * ¿El grupo tiene una calidad REGISTRADA? (ICH, SDD §3.3)
 *
 * Distingue lo AUSENTE de lo CERO:
 *   - `undefined` / `null` / `""` / no numérico → NO registrado → sale del promedio.
 *   - `0` (o `"0"`) → SÍ registrado: es una observación válida de calidad nula
 *     y tiene que entrar al promedio, arrastrando el ICH hacia abajo.
 */
function isQualityScored(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n);
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

  // ICH = average quality across groups that (a) have bones present AND (b) have a
  // quality actually SCORED. A present group with no `value` recorded is EXCLUDED
  // from the average instead of contributing a 0 (which used to drag the ICH down
  // while still counting in the denominator — SDD §3.3, incidencia medida 0/60).
  //
  // ⚠️ La presencia de manos/pies se cuenta con las allowlists de `lib/eatUnits.ts`:
  // un `Object.values(manoDer).reduce(...)` genérico DUPLICA los huesos cuando el
  // espejo legacy (`falProxMedias` / `tarsianos`) convive con las claves nuevas.
  const presence: Record<string, number> = {
    craneo, vertebras, huesosLargos, huesosPlanos, costillas,
    mandibula, hioides,
    manos: handBoneCount(data.manoDer) + handBoneCount(data.manoIzq),
    pies: footBoneCount(data.pieDer) + footBoneCount(data.pieIzq),
  };
  const quality = (data.quality ?? {}) as Record<string, { value?: unknown } | undefined>;
  const present = Object.keys(presence).filter((k) => presence[k] > 0);
  const scored = present.filter((k) => isQualityScored(quality[k]?.value));
  const ich =
    scored.length === 0
      ? 0
      : scored.reduce((a, k) => a + num(quality[k]?.value), 0) / scored.length;

  const eat = 100 - (ipo * ich) / 100;

  const round = (n: number) => Math.round(n * 100) / 100;
  return { ipo: round(ipo), ich: round(ich), eat: round(eat), totalPresent: round(totalPresent) };
}

/* ================================================================== */
/*  Zonación (Knüsel & Outram 2004)                                   */
/* ================================================================== */

/** Max zones per element (keyed by the data field). Sum = 635.
 *  Operacionalización del sistema de Knüsel & Outram (2004): los totales por
 *  elemento son la implementación de esta app, no cifras canónicas del paper.
 *  Hand/foot phalanges are recorded per digit (I–V × position × 3 zones × L/R):
 *  14 phalanges/side × 3 zones × 2 = 84, included in hand_zones/foot_zones.
 *
 *  Corrección metodológica 2026-06 (SDD-correccion-metodologica-zonacion):
 *   - sacrum_zones 20 → 4  (4 zonas K&O Fig 2d, no 5 segmentos × 4)
 *   - mandible_zones 14 → 7 (7 zonas-tipo; el lado L/R es observación, no denominador)
 *   - foot_zones 144 → 142  (la rótula sale de "pie")
 *   - patella_zones: 2      (rótula como elemento propio: pat_L, pat_R)
 *  Total 658 → 635; elementos 17 → 18. */
export const ZONATION_ELEMENT_MAX: Record<string, number> = {
  cranium_zones: 15,
  mandible_zones: 7,
  vertebrae_zones: 96,
  sacrum_zones: 4,
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
  foot_zones: 142,
  patella_zones: 2,
};

export const ZONATION_TOTAL_ZONES = Object.values(ZONATION_ELEMENT_MAX).reduce(
  (a, b) => a + b,
  0,
); // 635

export interface ZonacionMetrics {
  completitudGlobal: number; // % of all possible zones present
  completitudPorElemento: Record<string, number>; // % per element
  elementosPresentes: number; // distinct bone elements with >=1 zone
  zonasPresentes: number;
  ffi: { n: number; media: number | null; frescas: number; secas: number }; // FFI summary
  alteracionesCount: number; // taphonomic alterations checked
  fragmentosCount: number; // unidentifiable fragments tallied
}

/** Count the TRUE entries of an object whose key matches `re`. */
function countTrueMatching(o: Dict, re: RegExp): number {
  if (!o || typeof o !== "object") return 0;
  return Object.entries(o as Record<string, unknown>).filter(
    ([k, v]) => re.test(k) && Boolean(v),
  ).length;
}

/** Count the TRUE entries of an object whose key does NOT match `re`. */
function countTrueExcluding(o: Dict, re: RegExp): number {
  if (!o || typeof o !== "object") return 0;
  return Object.entries(o as Record<string, unknown>).filter(
    ([k, v]) => !re.test(k) && Boolean(v),
  ).length;
}

export function computeZonacion(data: Record<string, unknown>): ZonacionMetrics {
  const completitudPorElemento: Record<string, number> = {};
  let zonasPresentes = 0;
  let elementosPresentes = 0;

  for (const [field, max] of Object.entries(ZONATION_ELEMENT_MAX)) {
    let present: number;
    if (field === "sacrum_zones") {
      // K&O 4 zonas: contamos las claves canónicas nuevas (sac_z1..4),
      // ignorando las viejas (S{1..5}_z{1..4}) que la migración preserva.
      present = countTrueMatching(data.sacrum_zones as Dict, /^sac_z[1-4]$/);
    } else if (field === "mandible_zones") {
      // 7 zonas-tipo: contamos mand_z1..7 (el lado L/R es observación, no
      // denominador). Las claves viejas mand_{1..7}_{L|R} se preservan e ignoran.
      present = countTrueMatching(data.mandible_zones as Dict, /^mand_z[1-7]$/);
    } else if (field === "patella_zones") {
      // Rótula como elemento propio: pat_L, pat_R.
      present = countTrue(data.patella_zones as Dict);
    } else if (field === "foot_zones") {
      // La rótula salió de "pie": no contamos fPatella_L/R.
      present = countTrueExcluding(data.foot_zones as Dict, /^fPatella_[LR]$/);
    } else {
      present = countTrue(data[field] as Dict);
    }
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
