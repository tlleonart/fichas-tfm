/**
 * EAT — capa de PREVIEW del formulario (display-only).
 * ====================================================
 * SDD: `SDD-fidelidad-EAT-unidades-anatomicas.md` §3.4 · Handoff de API §2.3/§2.4
 *
 * 🔒 **Invariante #2 del proyecto: el backend es la fuente de verdad de las
 * métricas.** `convex/lib/metrics.ts` recalcula SIEMPRE al guardar; lo que hay acá
 * solo se muestra en pantalla. Por eso este módulo NO re-escribe ninguna fórmula:
 *
 *   - IPO / ICH / EAT / totalPresent → se toman de `computeEAT()`, la MISMA función
 *     que persiste el backend. El preview no puede divergir del número guardado.
 *   - los puntos POR UNIDAD y POR LADO (que `metrics.ts` no exporta) se derivan de
 *     `EAT_HAND_FIELDS` / `EAT_FOOT_FIELDS` agrupando por `unit` y sumando los
 *     `max` del contrato, con el único denominador que la fuente NO deriva de la
 *     anatomía tomado también del contrato
 *     (`EAT_SOURCE_FOOT_PHALANGES_DENOMINATOR` = 10 para la U.A.5 del pie).
 *     `tests/eat-form-preview.test.mjs` prueba la PARIDAD exacta contra
 *     `computeEAT` para que un cambio de partición en el backend rompa el test
 *     en vez de dejar el formulario mintiendo.
 *   - la PRESENCIA de manos/pies usa `handBoneCount` / `footBoneCount` del
 *     contrato: ⚠️ un `Object.values(manoDer).reduce(...)` genérico DUPLICA los
 *     huesos cuando el espejo legacy (`falProxMedias` / `tarsianos`) convive con
 *     las claves nuevas (36 vs 27 en la mano, 33 vs 26 en el pie).
 *
 * El estado del formulario guarda SOLO las claves autoritativas: los espejos
 * legacy los reescribe el backend en cada guardado y el front no debe mandarlos
 * (handoff §3, prohibición 4).
 *
 * Los imports de `convex/` son módulos PUROS (sin `convex/server`), igual que el
 * `@convex/lib/zonacionMigration` que ya consume `ZonacionForm`.
 */

import {
  EAT_FOOT_FIELDS,
  EAT_HAND_FIELDS,
  EAT_NEW_FOOT_KEYS,
  EAT_NEW_HAND_KEYS,
  EAT_SOURCE_FOOT_PHALANGES_DENOMINATOR,
  MANO_TOTAL_BONES,
  PIE_TOTAL_BONES,
  deriveFalangesMano,
  deriveTarso,
  footBoneCount,
  handBoneCount,
  num,
  type EatFieldSpec,
} from "@convex/lib/eatUnits";
import { computeEAT, type EATMetrics } from "@convex/lib/metrics";

export { MANO_TOTAL_BONES, PIE_TOTAL_BONES };

/** Puntos máximos por lado = cantidad de unidades anatómicas de la fuente. */
export const MANO_MAX_PTS = 4;
export const PIE_MAX_PTS = 5;

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Tipos del estado del formulario (solo claves autoritativas)                 */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface ManoData {
  carpianos: number;
  metacarpianos: number;
  falProximales: number;
  falMedias: number;
  falDistales: number;
}

export interface PieData {
  calcaneo: number;
  astragalo: number;
  restoTarso: number;
  metatarsianos: number;
  falProx: number;
  falMedias: number;
  falDistales: number;
}

export interface QualityEntry {
  /**
   * Calidad del grupo, 0..100.
   *
   * 🔒 `0` es una observación VÁLIDA ("calidad nula") y se persiste como `0`
   * (SDD §5bis.2 / handoff §3 punto 5): convertirlo a `undefined`/`""` lo sacaría
   * del promedio del ICH y movería el ICH de las 60 fichas históricas.
   *
   * `undefined` = calidad NO registrada → el ICH la excluye del promedio. Solo
   * puede llegar así desde una ficha vieja; el formulario nunca lo produce y
   * tampoco lo convierte a `0` (eso también movería el ICH).
   */
  value?: number;
  obs: string;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Filas de captura (derivadas del contrato)                                  */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface EatInputRow {
  key: string;
  /** Rótulo anatómico, el del contrato. */
  label: string;
  /** Aclaración opcional para la usuaria (qué huesos son). */
  hint?: string;
  max: number;
  unit: number;
  /** Un hueso por lado → checkbox; conteo → spinner (handoff §2.2). */
  kind: "checkbox" | "spinner";
}

/** Aclaraciones anatómicas que el contrato no lleva (son de UI, no de datos). */
const ROW_HINTS: Record<string, string> = {
  restoTarso: "navicular, cuboides, cuneiformes",
};

function toRows(fields: readonly EatFieldSpec[]): EatInputRow[] {
  return fields
    .filter((f) => f.authoritative && f.unit !== null)
    .map((f) => ({
      key: f.key,
      label: f.label,
      hint: ROW_HINTS[f.key],
      max: f.max,
      unit: f.unit as number,
      kind: f.max === 1 ? "checkbox" : "spinner",
    }));
}

/** 5 filas de captura de la mano (el espejo `falProxMedias` no se renderiza). */
export const MANO_ROWS: readonly EatInputRow[] = toRows(EAT_HAND_FIELDS);
/** 7 filas de captura del pie (el espejo `tarsianos` no se renderiza). */
export const PIE_ROWS: readonly EatInputRow[] = toRows(EAT_FOOT_FIELDS);

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Unidades anatómicas de puntuación (derivadas del contrato)                 */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface EatUnitSpec {
  unit: number;
  /** Claves de captura que aportan a la unidad. */
  keys: readonly string[];
  /** Denominador de la unidad en la fuente. */
  denominator: number;
  /** Rótulo de la unidad para la UI. */
  label: string;
}

/**
 * Rótulos de unidad (UI). Los nombres de hueso salen del contrato; esto es solo
 * cómo se llama la UNIDAD cuando agrupa más de un hueso.
 */
const MANO_UNIT_LABELS: Record<number, string> = {
  1: "Carpianos",
  2: "Metacarpianos",
  3: "Falanges proximales",
  4: "Falanges medias + distales",
};
const PIE_UNIT_LABELS: Record<number, string> = {
  1: "Calcáneo",
  2: "Astrágalo",
  3: "Resto del tarso",
  4: "Metatarsianos",
  5: "Falanges (una sola unidad en la fuente)",
};

/**
 * 🔒 Rareza de la fuente que se REPLICA (SDD §5.2, punto 1): la U.A.5 del pie
 * puntúa sobre **10** aunque se capturan **14** falanges (11–14 satura en 1,0).
 * Es el único denominador que no es la suma de los máximos anatómicos, y viene
 * del contrato — no se hardcodea acá.
 */
const PIE_UNIT_DENOMINATOR_OVERRIDES: Record<number, number> = {
  5: EAT_SOURCE_FOOT_PHALANGES_DENOMINATOR,
};

function buildUnits(
  fields: readonly EatFieldSpec[],
  labels: Record<number, string>,
  overrides: Record<number, number> = {},
): EatUnitSpec[] {
  const byUnit = new Map<number, EatFieldSpec[]>();
  for (const f of fields) {
    if (!f.authoritative || f.unit === null) continue;
    const list = byUnit.get(f.unit) ?? [];
    list.push(f);
    byUnit.set(f.unit, list);
  }
  return [...byUnit.keys()]
    .sort((a, b) => a - b)
    .map((unit) => {
      const list = byUnit.get(unit) as EatFieldSpec[];
      return {
        unit,
        keys: list.map((f) => f.key),
        denominator: overrides[unit] ?? list.reduce((a, f) => a + f.max, 0),
        label: labels[unit] ?? `U.A.${unit}`,
      };
    });
}

/** MANO — 4 U.A.: /8, /5, /5, /9. */
export const MANO_UNITS: readonly EatUnitSpec[] = buildUnits(EAT_HAND_FIELDS, MANO_UNIT_LABELS);
/** PIE — 5 U.A.: /1, /1, /5, /5, /10. */
export const PIE_UNITS: readonly EatUnitSpec[] = buildUnits(
  EAT_FOOT_FIELDS,
  PIE_UNIT_LABELS,
  PIE_UNIT_DENOMINATOR_OVERRIDES,
);

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Puntos de preview                                                          */
/* ══════════════════════════════════════════════════════════════════════════ */

/** Coeficiente de una unidad: presentes / denominador de la unidad, capado en 1. */
export function unitPoints(values: Record<string, unknown>, unit: EatUnitSpec): number {
  const present = unit.keys.reduce((a, k) => a + num(values[k]), 0);
  return Math.min(1, present / unit.denominator);
}

function sumUnits(values: Record<string, unknown>, units: readonly EatUnitSpec[]): number {
  return units.reduce((a, u) => a + unitPoints(values, u), 0);
}

/** Puntos de una mano (máx 4). Paridad con `handPoints` de `metrics.ts` (test). */
export function handPreviewPoints(mano: ManoData): number {
  return sumUnits(mano as unknown as Record<string, unknown>, MANO_UNITS);
}

/** Puntos de un pie (máx 5). Paridad con `footPoints` de `metrics.ts` (test). */
export function footPreviewPoints(pie: PieData): number {
  return sumUnits(pie as unknown as Record<string, unknown>, PIE_UNITS);
}

/** Huesos presentes de una mano (allowlist del contrato: nunca cuenta el espejo). */
export function handBoneTotal(mano: ManoData): number {
  return handBoneCount(mano);
}

/** Huesos presentes de un pie (allowlist del contrato). */
export function footBoneTotal(pie: PieData): number {
  return footBoneCount(pie);
}

/** Formato de puntos del formulario (2 decimales, como el resto de la app). */
export function fmtPts(n: number): string {
  return n.toFixed(2);
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Hidratación desde una ficha guardada (migrada o NO migrada)                 */
/* ══════════════════════════════════════════════════════════════════════════ */

const MANO_MAXES: Record<string, number> = Object.fromEntries(
  MANO_ROWS.map((r) => [r.key, r.max]),
);
const PIE_MAXES: Record<string, number> = Object.fromEntries(PIE_ROWS.map((r) => [r.key, r.max]));

/** Entero clampeado a [0, max] — mismo criterio que `normalizeEatUnits`. */
export function clampCount(v: unknown, max: number): number {
  const n = Math.round(num(v));
  if (n < 0) return 0;
  if (n > max) return max;
  return n;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export const EMPTY_MANO: ManoData = {
  carpianos: 0,
  metacarpianos: 0,
  falProximales: 0,
  falMedias: 0,
  falDistales: 0,
};

export const EMPTY_PIE: PieData = {
  calcaneo: 0,
  astragalo: 0,
  restoTarso: 0,
  metatarsianos: 0,
  falProx: 0,
  falMedias: 0,
  falDistales: 0,
};

/**
 * Mano guardada → estado del formulario.
 *
 * ⚠️ El backfill del histórico corre DESPUÉS de que este formulario esté en prod
 * (SDD §5bis.1), así que tiene que abrir fichas con el shape viejo. Misma regla
 * que `normalizeEatUnits`: si las claves granulares no están, se DERIVAN del
 * agregado legacy con `deriveFalangesMano` (supuesto best-case del contrato, sin
 * re-implementarlo); si están, manda el dato registrado y no se deriva nada.
 */
export function hydrateMano(raw: unknown): ManoData {
  const d = asObj(raw);
  const granular = EAT_NEW_HAND_KEYS.some((k) => d[k] !== undefined);
  const base = granular
    ? { falProximales: d.falProximales, falMedias: d.falMedias }
    : deriveFalangesMano(d.falProxMedias);
  return {
    carpianos: clampCount(d.carpianos, MANO_MAXES.carpianos),
    metacarpianos: clampCount(d.metacarpianos, MANO_MAXES.metacarpianos),
    falProximales: clampCount(base.falProximales, MANO_MAXES.falProximales),
    falMedias: clampCount(base.falMedias, MANO_MAXES.falMedias),
    falDistales: clampCount(d.falDistales, MANO_MAXES.falDistales),
  };
}

/**
 * Pie guardado → estado del formulario. Ídem mano, con `deriveTarso` para el
 * agregado `tarsianos` (0..7) → calcáneo / astrágalo / resto del tarso.
 */
export function hydratePie(raw: unknown): PieData {
  const d = asObj(raw);
  const granular = EAT_NEW_FOOT_KEYS.some((k) => d[k] !== undefined);
  const base = granular
    ? { calcaneo: d.calcaneo, astragalo: d.astragalo, restoTarso: d.restoTarso }
    : deriveTarso(d.tarsianos);
  return {
    calcaneo: clampCount(base.calcaneo, PIE_MAXES.calcaneo),
    astragalo: clampCount(base.astragalo, PIE_MAXES.astragalo),
    restoTarso: clampCount(base.restoTarso, PIE_MAXES.restoTarso),
    metatarsianos: clampCount(d.metatarsianos, PIE_MAXES.metatarsianos),
    falProx: clampCount(d.falProx, PIE_MAXES.falProx),
    falMedias: clampCount(d.falMedias, PIE_MAXES.falMedias),
    falDistales: clampCount(d.falDistales, PIE_MAXES.falDistales),
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Payload y métricas de preview                                              */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface EatFormState {
  craneo: Record<string, boolean>;
  vertebras: Record<string, boolean>;
  huesosLargos: Record<string, boolean>;
  huesosPlanos: Record<string, boolean>;
  costillas: Record<string, boolean>;
  mandibula: boolean;
  hioides: boolean;
  manoDer: ManoData;
  manoIzq: ManoData;
  pieDer: PieData;
  pieIzq: PieData;
  quality: Record<string, QualityEntry>;
  observations: string;
}

/**
 * `quality` saneado: un grupo SIN huesos presentes no puede conservar calidad.
 *
 * 🐛 Bug que arregla (reportado por Martina 2026-08-06, confirmado en 2 fichas de
 * la muestra — `UF3014-I14` hioides=95 y `UF3018-I18` costillas=40): el formulario
 * gatea el slider por presencia, pero **sólo en el render**. Al destildar el hueso
 * el control desaparece y el valor ya cargado queda en el estado, viaja en el
 * payload y se persiste. Queda un valor de calidad huérfano, imposible de ver o
 * de borrar desde la interfaz.
 *
 * 🔒 Las dos direcciones son distintas y hay que tratarlas distinto:
 *   - grupo AUSENTE con valor  → se limpia acá (es el bug);
 *   - grupo PRESENTE con `value = 0` → **se deja**, `0` es "calidad nula", una
 *     observación válida (SDD §5bis.2). Convertirlo en `undefined` lo sacaría del
 *     promedio y movería el ICH de las fichas históricas.
 *
 * El grupo ausente queda en `{ value: 0, obs: "" }`, que es exactamente el estado
 * de todos los demás grupos ausentes de la base: así el saneamiento no introduce
 * una tercera forma de "vacío" ni cambia la semántica si el hueso se vuelve a
 * marcar como presente.
 *
 * NEUTRO PARA LAS MÉTRICAS: el ICH promedia por PRESENCIA, así que limpiar un
 * grupo ausente no puede mover el ICH. Verificado sobre las 62 fichas de PROD:
 * Δ ICH máximo = 0,000000.
 *
 * Las claves que no correspondan a ninguno de los 9 grupos conocidos se dejan
 * intactas (no inventamos presencia para algo que no sabemos qué es).
 */
export function pruneQualityForAbsentGroups(s: EatFormState): Record<string, QualityEntry> {
  const counts = presenceCounts(s);
  const out: Record<string, QualityEntry> = {};
  for (const [key, entry] of Object.entries(s.quality)) {
    const count = counts[key];
    const conocido = count !== undefined;
    out[key] = conocido && count === 0 ? { value: 0, obs: "" } : { ...entry };
  }
  return out;
}

/**
 * Estado del formulario → `data` de la ficha.
 *
 * 🔒 Reglas del handoff §3 que esta función garantiza por construcción:
 *   - NO emite `falProxMedias` ni `tarsianos` (espejos: los reescribe el backend);
 *   - NO emite `falMediasDistales` (el agregado que este cambio elimina);
 *   - de `quality` sanea SOLO los grupos ausentes (ver `pruneQualityForAbsentGroups`):
 *     los `value = 0` de los grupos PRESENTES viajan como `0`, nunca como
 *     `undefined` (con el ICH hardened, un grupo presente sin `value` sale del
 *     promedio y movería el ICH de las fichas históricas — SDD §5bis.2);
 *   - `eatDerivation` no se manda: lo rescata `fichas.actualizar` del `data` previo.
 */
export function buildEatData(s: EatFormState): Record<string, unknown> {
  const data: Record<string, unknown> = {
    craneo: s.craneo,
    vertebras: s.vertebras,
    huesosLargos: s.huesosLargos,
    huesosPlanos: s.huesosPlanos,
    costillas: s.costillas,
    mandibula: s.mandibula,
    hioides: s.hioides,
    manoDer: { ...s.manoDer },
    manoIzq: { ...s.manoIzq },
    pieDer: { ...s.pieDer },
    pieIzq: { ...s.pieIzq },
    quality: pruneQualityForAbsentGroups(s),
    observations: s.observations,
  };
  const m = computeEAT(data);
  // Preview persistido junto al dato (histórico). El backend lo REFRESCA con el
  // número autoritativo; está en camino de salida (handoff §3, punto 7).
  data._computed = {
    totalPresent: m.totalPresent,
    IPO: m.ipo,
    ICH: m.ich,
    EAT: m.eat,
  };
  return data;
}

/**
 * Métricas de pantalla. Es literalmente `computeEAT`, la función que corre el
 * backend al guardar → el preview no puede divergir de `metricas`.
 */
export function previewMetrics(data: Record<string, unknown>): EATMetrics {
  return computeEAT(data);
}

/**
 * Huesos presentes por grupo (gating de los sliders del ICH). Mismo criterio que
 * el `presence` de `computeEAT`, incluidas las allowlists de mano/pie.
 */
export function presenceCounts(s: EatFormState): Record<string, number> {
  const countTrue = (o: Record<string, boolean>) => Object.values(o).filter(Boolean).length;
  return {
    craneo: countTrue(s.craneo),
    vertebras: countTrue(s.vertebras),
    huesosLargos: countTrue(s.huesosLargos),
    huesosPlanos: countTrue(s.huesosPlanos),
    costillas: countTrue(s.costillas),
    mandibula: s.mandibula ? 1 : 0,
    hioides: s.hioides ? 1 : 0,
    manos: handBoneTotal(s.manoDer) + handBoneTotal(s.manoIzq),
    pies: footBoneTotal(s.pieDer) + footBoneTotal(s.pieIzq),
  };
}
