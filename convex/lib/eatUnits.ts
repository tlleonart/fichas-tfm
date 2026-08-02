/**
 * EAT — contrato de las unidades anatómicas de mano y pie (Serrulla & Vázquez 2019).
 * =================================================================================
 * SDD: `SDD-fidelidad-EAT-unidades-anatomicas.md` · Handoff: `HANDOFF-schema-eat-unidades-anatomicas.md`
 *
 * Módulo PURO (sin imports de `convex/server`) — testeable offline contra un
 * snapshot de prod y reutilizable desde el front.
 *
 * ─── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 * `fichas.data` es `v.any()` en `schema.ts` (payload heterogéneo por método), así
 * que el "schema" del EAT no vive en el schema de Convex: vive ACÁ. Este módulo es
 * el contrato normativo (nombres de claves, rangos, allowlists) + la normalización
 * canónica. Todo lo que escriba o lea el inventario de mano/pie del EAT pasa por
 * acá; nadie hardcodea nombres de campo en otro lado.
 *
 * ─── EL PROBLEMA QUE RESUELVE ─────────────────────────────────────────────────
 * La partición de unidades anatómicas de la fuente corta al medio dos conteos
 * agregados que la app venía guardando:
 *
 *   pie:  `tarsianos`     (0..7) → calcáneo /1 + astrágalo /1 + resto del tarso /5
 *   mano: `falProxMedias` (0..9) → fal. proximales /5 + fal. medias (con distales) /9
 *
 * Sin desdoblar el conteo no se puede puntuar como la fuente. Ver SDD §1.
 *
 * ─── INVARIANTES (🔒 no re-debatibles) ────────────────────────────────────────
 *  1. `EAT = 100 − (IPO × ICH)/100` (multiplicativa). Este módulo NO la toca.
 *  2. `EAT_IPO_MAX = 115` NO cambia: la mano sigue en 4 U.A. / 27 huesos y el pie
 *     en 5 U.A. / máx 5 pts. Cambia QUÉ hueso entra en QUÉ unidad, no el total.
 *  3. Las métricas las recalcula SIEMPRE el backend al guardar (`lib/metrics.ts`).
 *  4. Migración ADITIVA: se escriben las claves nuevas y se PRESERVAN las viejas
 *     (`tarsianos`, `falProxMedias`) como espejos derivados. Reversible.
 *  5. Fidelidad a los autores: se replican sus rarezas y se documentan, no se
 *     "arreglan" (falanges de pie con denominador /10 siendo 14; el pie de la
 *     fuente suma 22 huesos siendo 26 anatómicos). Ver §Rarezas abajo.
 */

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Versión del schema de datos de la ficha                                    */
/* ══════════════════════════════════════════════════════════════════════════ */

/**
 * Escalera de `fichas.schemaVersion` (contador global monotónico, semántica
 * documentada por bump; cada migración filtra además por `tipo`):
 *
 *   undefined / 1 → shape original (2026-06 y anterior).
 *   2             → Zonación: corrección metodológica 2026-06 (sacro/mandíbula/rótula).
 *                   Las fichas de Zonación se quedan acá; esta migración NO las toca.
 *   3             → EAT: unidades anatómicas de mano/pie desdobladas (este módulo).
 *
 * Una ficha EAT con `schemaVersion >= 3` ya está en el shape granular.
 */
export const EAT_SCHEMA_VERSION = 3;

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Contrato de campos                                                         */
/* ══════════════════════════════════════════════════════════════════════════ */

/** Los cuatro sub-objetos de extremidad dentro de `data`. */
export const EAT_HAND_SIDES = ["manoDer", "manoIzq"] as const;
export const EAT_FOOT_SIDES = ["pieDer", "pieIzq"] as const;
export const EAT_LIMB_SIDES = [...EAT_HAND_SIDES, ...EAT_FOOT_SIDES] as const;
export type EatHandSide = (typeof EAT_HAND_SIDES)[number];
export type EatFootSide = (typeof EAT_FOOT_SIDES)[number];
export type EatLimbSide = (typeof EAT_LIMB_SIDES)[number];

export interface EatFieldSpec {
  /** Nombre de la clave dentro del sub-objeto de extremidad. */
  key: string;
  /** Máximo anatómico por lado (mínimo siempre 0). Entero. */
  max: number;
  /** Unidad anatómica de la fuente a la que aporta. `null` = clave legacy. */
  unit: 1 | 2 | 3 | 4 | 5 | null;
  /** `true` = dato de captura autoritativo. `false` = espejo legacy derivado. */
  authoritative: boolean;
  label: string;
}

/**
 * MANO — 5 campos de captura autoritativos → 4 unidades anatómicas.
 *   U.A.1 carpianos /8 · U.A.2 metacarpianos /5
 *   U.A.3 falProximales /5                      ← NUEVO
 *   U.A.4 (falMedias + falDistales) /9          ← falMedias es NUEVO
 * Total de huesos de captura: 8+5+5+4+5 = 27 = `MANO_TOTAL_BONES` (coincide con la fuente).
 */
export const EAT_HAND_FIELDS: readonly EatFieldSpec[] = [
  { key: "carpianos", max: 8, unit: 1, authoritative: true, label: "Carpianos" },
  { key: "metacarpianos", max: 5, unit: 2, authoritative: true, label: "Metacarpianos" },
  { key: "falProximales", max: 5, unit: 3, authoritative: true, label: "Fal. proximales" },
  { key: "falMedias", max: 4, unit: 4, authoritative: true, label: "Fal. medias" },
  { key: "falDistales", max: 5, unit: 4, authoritative: true, label: "Fal. distales" },
  // Espejo legacy: = falProximales + falMedias. NUNCA lo leen las métricas.
  { key: "falProxMedias", max: 9, unit: null, authoritative: false, label: "Fal. prox + medias (legacy)" },
] as const;

/**
 * PIE — 7 campos de captura autoritativos → 5 unidades anatómicas.
 *   U.A.1 calcaneo /1                                     ← NUEVO
 *   U.A.2 astragalo /1                                    ← NUEVO
 *   U.A.3 restoTarso /5 (navicular, cuboides, 3 cuneiformes) ← NUEVO
 *   U.A.4 metatarsianos /5
 *   U.A.5 (falProx + falMedias + falDistales) /10         ← una sola unidad en la fuente
 * Total de huesos de captura: 1+1+5+5+5+4+5 = 26 = anatómico (`PIE_TOTAL_BONES`).
 */
export const EAT_FOOT_FIELDS: readonly EatFieldSpec[] = [
  { key: "calcaneo", max: 1, unit: 1, authoritative: true, label: "Calcáneo" },
  { key: "astragalo", max: 1, unit: 2, authoritative: true, label: "Astrágalo" },
  { key: "restoTarso", max: 5, unit: 3, authoritative: true, label: "Resto del tarso" },
  { key: "metatarsianos", max: 5, unit: 4, authoritative: true, label: "Metatarsianos" },
  { key: "falProx", max: 5, unit: 5, authoritative: true, label: "Fal. proximales" },
  { key: "falMedias", max: 4, unit: 5, authoritative: true, label: "Fal. medias" },
  { key: "falDistales", max: 5, unit: 5, authoritative: true, label: "Fal. distales" },
  // Espejo legacy: = calcaneo + astragalo + restoTarso. NUNCA lo leen las métricas.
  { key: "tarsianos", max: 7, unit: null, authoritative: false, label: "Tarsianos (legacy)" },
] as const;

/** Claves nuevas que introduce esta migración (por lado). */
export const EAT_NEW_HAND_KEYS = ["falProximales", "falMedias"] as const;
export const EAT_NEW_FOOT_KEYS = ["calcaneo", "astragalo", "restoTarso"] as const;

/** Claves legacy preservadas (espejos derivados). La limpieza posterior las borra. */
export const EAT_LEGACY_HAND_KEYS = ["falProxMedias"] as const;
export const EAT_LEGACY_FOOT_KEYS = ["tarsianos"] as const;

/**
 * Allowlists para contar huesos presentes (presencia del grupo en el ICH y total
 * "X / N huesos" del formulario). EXCLUYEN los espejos legacy: sumar todas las
 * claves del sub-objeto con un `Object.values(...).reduce(...)` genérico
 * DUPLICA los huesos después de la migración.
 */
export const EAT_HAND_BONE_KEYS: readonly string[] = EAT_HAND_FIELDS.filter(
  (f) => f.authoritative,
).map((f) => f.key);
export const EAT_FOOT_BONE_KEYS: readonly string[] = EAT_FOOT_FIELDS.filter(
  (f) => f.authoritative,
).map((f) => f.key);

/** Huesos de captura por lado. Mano 27 (= fuente). Pie 26 (= anatómico). */
export const MANO_TOTAL_BONES = EAT_HAND_FIELDS.filter((f) => f.authoritative).reduce(
  (a, f) => a + f.max,
  0,
); // 27
export const PIE_TOTAL_BONES = EAT_FOOT_FIELDS.filter((f) => f.authoritative).reduce(
  (a, f) => a + f.max,
  0,
); // 26

/**
 * ─── Rarezas de la fuente — se REPLICAN y se documentan (SDD §5.2) ───────────
 *  1. La U.A.5 del pie (falanges) tiene denominador **10** cuando anatómicamente
 *     son 14: un pie con 11–14 falanges satura en 1,0. Capturamos los 14 (más
 *     información) y puntuamos sobre 10 (fidelidad).
 *  2. Los denominadores de puntuación del pie suman **22** (1+1+5+5+10) cuando
 *     el pie tiene 26 huesos. Por eso `PIE_TOTAL_BONES` (26, captura) ≠ suma de
 *     denominadores de la fuente (22, puntuación). No es un bug nuestro.
 * NO corregir ninguna de las dos: un índice corregido a criterio propio deja de
 * ser comparable con cualquier otro estudio que use el EAT.
 */
export const EAT_SOURCE_FOOT_SCORING_DENOMINATOR_SUM = 22;
export const EAT_SOURCE_FOOT_PHALANGES_DENOMINATOR = 10;

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Helpers numéricos                                                          */
/* ══════════════════════════════════════════════════════════════════════════ */

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function asObj(v: unknown): Obj {
  return isObj(v) ? v : {};
}

/** Número tolerante (los snapshots de prod traen `7.0`, el front puede traer `"7"`). */
export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Entero clampeado a [0, max]. Todos los conteos del inventario son enteros. */
function clampInt(v: unknown, max: number): number {
  const n = Math.round(num(v));
  if (n < 0) return 0;
  if (n > max) return max;
  return n;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Derivación del histórico — supuesto best-case (SDD §5.1)                   */
/* ══════════════════════════════════════════════════════════════════════════ */

/**
 * Supuesto tafonómico declarado: **los huesos de mayor densidad y tamaño se
 * preservan y se recuperan primero.** Es el orden esperado y es el que se
 * publica en la tesis junto a la banda de sensibilidad best/worst.
 */
export const EAT_DERIVATION_ASSUMPTION = "best-case:huesos-grandes-y-densos-primero";

/**
 * `tarsianos` (0..7) → calcáneo, astrágalo, resto del tarso.
 * Se llena calcáneo, después astrágalo, después el resto.
 * Invariante: `calcaneo + astragalo + restoTarso === clampInt(tarsianos, 7)`.
 */
export function deriveTarso(tarsianos: unknown): {
  calcaneo: number;
  astragalo: number;
  restoTarso: number;
} {
  const n = clampInt(tarsianos, 7);
  return {
    calcaneo: Math.min(n, 1),
    astragalo: Math.min(Math.max(n - 1, 0), 1),
    restoTarso: Math.min(Math.max(n - 2, 0), 5),
  };
}

/**
 * `falProxMedias` (0..9) → falanges proximales (0..5) + medias (0..4).
 * Se llenan las proximales (más robustas) primero.
 * Invariante: `falProximales + falMedias === clampInt(falProxMedias, 9)`.
 */
export function deriveFalangesMano(falProxMedias: unknown): {
  falProximales: number;
  falMedias: number;
} {
  const m = clampInt(falProxMedias, 9);
  const falProximales = Math.min(m, 5);
  return { falProximales, falMedias: m - falProximales };
}

/**
 * ¿La derivación del tarso descansa en el supuesto?
 * `0` → nada presente y `7` → todo presente son exactos (sabemos qué huesos son).
 * `1..6` → ambiguo: el conteo agregado no dice CUÁLES.
 */
export function isTarsoAmbiguous(tarsianos: unknown): boolean {
  const n = clampInt(tarsianos, 7);
  return n >= 1 && n <= 6;
}

/** Ídem falanges de mano: `0` y `9` exactos, `1..8` ambiguos. */
export function isFalangesManoAmbiguous(falProxMedias: unknown): boolean {
  const m = clampInt(falProxMedias, 9);
  return m >= 1 && m <= 8;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Lectura dual (nuevo con fallback al legacy)                                */
/* ══════════════════════════════════════════════════════════════════════════ */

/**
 * Huesos presentes en una mano, para la PRESENCIA del grupo en el ICH y el total
 * del formulario. Suma solo las claves autoritativas; si las nuevas todavía no
 * existen (ficha sin migrar) cae al espejo legacy, para que la presencia del
 * grupo nunca se caiga a 0 por leer un shape viejo.
 */
export function handBoneCount(hand: unknown): number {
  const d = asObj(hand);
  let total = 0;
  for (const f of EAT_HAND_FIELDS) {
    if (f.authoritative) total += clampInt(d[f.key], f.max);
  }
  const granular = EAT_NEW_HAND_KEYS.some((k) => d[k] !== undefined);
  if (!granular) total += clampInt(d.falProxMedias, 9);
  return total;
}

/** Ídem pie. Fallback al espejo `tarsianos` si el tarso no está desdoblado. */
export function footBoneCount(foot: unknown): number {
  const d = asObj(foot);
  let total = 0;
  for (const f of EAT_FOOT_FIELDS) {
    if (f.authoritative) total += clampInt(d[f.key], f.max);
  }
  const granular = EAT_NEW_FOOT_KEYS.some((k) => d[k] !== undefined);
  if (!granular) total += clampInt(d.tarsianos, 7);
  return total;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Normalización canónica (migración + escritura, mismo código)               */
/* ══════════════════════════════════════════════════════════════════════════ */

export type EatSideStatus =
  /** No existía el sub-objeto del lado: se deja tal cual (no se inventan ceros). */
  | "ausente"
  /** Las claves nuevas ya estaban y no hay traza previa de derivación. */
  | "granular"
  /** Derivado del conteo legacy, sin ambigüedad (conteo 0 o completo). */
  | "derivado-exacto"
  /** Derivado del conteo legacy bajo el supuesto best-case → NO es observación. */
  | "derivado-supuesto"
  /**
   * Venía derivado y el usuario lo RE-REGISTRÓ a mano en el formulario: la
   * provenance de supuesto se limpia (ya es observación directa) y el lado sale
   * del análisis de sensibilidad.
   */
  | "registrado";

export interface EatSideDerivation {
  status: EatSideStatus;
  /** Conteo agregado de origen (`tarsianos` o `falProxMedias`). `null` si no había. */
  source: number | null;
  /** Valores escritos en las claves nuevas. */
  derived: Record<string, number>;
  /** `true` solo si status === "derivado-supuesto". */
  ambiguous: boolean;
}

export interface EatDerivation {
  version: number;
  migratedAt: number;
  assumption: string;
  /** `true` si ALGÚN lado se derivó bajo supuesto → el análisis de sensibilidad lo toma. */
  underAssumption: boolean;
  sides: Record<string, EatSideDerivation>;
}

export interface EatNormalizeResult {
  data: Obj;
  /** `true` si `data` cambió respecto de la entrada. */
  changed: boolean;
  /** Metadatos de derivación (también quedan en `data.eatDerivation`). */
  derivation: EatDerivation;
}

/** Clave donde viven los metadatos de derivación, dentro de `data`. */
export const EAT_DERIVATION_KEY = "eatDerivation";

/**
 * Normaliza el inventario de mano/pie de una ficha EAT al shape granular v3.
 *
 * Es la ÚNICA función que escribe estas claves. La llaman por igual:
 *   - la migración del histórico (`convex/migrations/eat_units_2026_08.ts`), y
 *   - las mutations `fichas.crear` / `fichas.actualizar` (fichas nuevas y ediciones).
 * Así no hay dos caminos de escritura que puedan divergir.
 *
 * Reglas (todas necesarias para que sea segura y reversible):
 *   1. **Aditiva:** una clave nueva se DERIVA solo si está `undefined`. Si el
 *      formulario ya cargó `falProximales`, la derivación no la pisa nunca.
 *   2. **Espejos legacy:** `tarsianos` y `falProxMedias` se reescriben como suma
 *      de las claves nuevas. Se preservan hasta la pasada de limpieza para que
 *      los consumidores del shape viejo (export de `/datos`, scripts de
 *      `analisis/`) sigan funcionando durante la transición.
 *   3. **Idempotente:** correrla N veces da el mismo resultado. Por construcción
 *      `calcaneo+astragalo+restoTarso === tarsianos` y
 *      `falProximales+falMedias === falProxMedias`, así que el espejo es estable.
 *   4. **Clampeo:** todo conteo se fuerza a entero en [0, max] del contrato.
 *   5. **NO toca métricas.** El recálculo es de `lib/metrics.ts` (invariante #3).
 *   6. **NO toca zonación**, ni `quality`, ni ningún otro grupo del EAT.
 *
 * @param rawData      `ficha.data` de una ficha `tipo === "eat"`.
 * @param now          timestamp inyectado (mantiene la función pura/testeable).
 * @param previousData `ficha.data` ya persistido, si se está actualizando. Sirve
 *   para RESCATAR `data.eatDerivation`: `EATForm` reconstruye el payload desde
 *   cero y no lo devuelve, así que sin esto una edición borraría la traza de
 *   derivación. `fichas.actualizar` DEBE pasar el `data` viejo acá.
 */
export function normalizeEatUnits(
  rawData: unknown,
  now: number,
  previousData?: unknown,
): EatNormalizeResult {
  const original = asObj(rawData);
  const data: Obj = { ...original };
  const sides: Record<string, EatSideDerivation> = {};
  let changed = false;

  /* ---- Manos ---- */
  for (const side of EAT_HAND_SIDES) {
    if (!isObj(original[side])) {
      sides[side] = { status: "ausente", source: null, derived: {}, ambiguous: false };
      continue;
    }
    const before = original[side] as Obj;
    const after: Obj = { ...before };

    const alreadyGranular = EAT_NEW_HAND_KEYS.some((k) => before[k] !== undefined);
    let derived: Record<string, number>;
    let status: EatSideStatus;
    let ambiguous = false;

    if (alreadyGranular) {
      status = "granular";
      derived = {
        falProximales: clampInt(before.falProximales, 5),
        falMedias: clampInt(before.falMedias, 4),
      };
    } else {
      const d = deriveFalangesMano(before.falProxMedias);
      derived = d;
      ambiguous = isFalangesManoAmbiguous(before.falProxMedias);
      status = ambiguous ? "derivado-supuesto" : "derivado-exacto";
    }
    // Regla 1: solo se escribe donde está undefined.
    for (const k of EAT_NEW_HAND_KEYS) {
      if (before[k] === undefined) after[k] = derived[k];
    }
    // Clampeo de las claves que no cambian de semántica.
    after.carpianos = clampInt(before.carpianos, 8);
    after.metacarpianos = clampInt(before.metacarpianos, 5);
    after.falProximales = clampInt(after.falProximales, 5);
    after.falMedias = clampInt(after.falMedias, 4);
    after.falDistales = clampInt(before.falDistales, 5);
    // Regla 2: espejo legacy.
    after.falProxMedias = num(after.falProximales) + num(after.falMedias);

    if (!shallowEqualNumeric(before, after)) changed = true;
    data[side] = after;
    sides[side] = {
      status,
      source: before.falProxMedias === undefined ? null : clampInt(before.falProxMedias, 9),
      derived: { falProximales: num(after.falProximales), falMedias: num(after.falMedias) },
      ambiguous,
    };
  }

  /* ---- Pies ---- */
  for (const side of EAT_FOOT_SIDES) {
    if (!isObj(original[side])) {
      sides[side] = { status: "ausente", source: null, derived: {}, ambiguous: false };
      continue;
    }
    const before = original[side] as Obj;
    const after: Obj = { ...before };

    const alreadyGranular = EAT_NEW_FOOT_KEYS.some((k) => before[k] !== undefined);
    let derived: Record<string, number>;
    let status: EatSideStatus;
    let ambiguous = false;

    if (alreadyGranular) {
      status = "granular";
      derived = {
        calcaneo: clampInt(before.calcaneo, 1),
        astragalo: clampInt(before.astragalo, 1),
        restoTarso: clampInt(before.restoTarso, 5),
      };
    } else {
      derived = deriveTarso(before.tarsianos);
      ambiguous = isTarsoAmbiguous(before.tarsianos);
      status = ambiguous ? "derivado-supuesto" : "derivado-exacto";
    }
    for (const k of EAT_NEW_FOOT_KEYS) {
      if (before[k] === undefined) after[k] = derived[k];
    }
    after.calcaneo = clampInt(after.calcaneo, 1);
    after.astragalo = clampInt(after.astragalo, 1);
    after.restoTarso = clampInt(after.restoTarso, 5);
    after.metatarsianos = clampInt(before.metatarsianos, 5);
    after.falProx = clampInt(before.falProx, 5);
    after.falMedias = clampInt(before.falMedias, 4);
    after.falDistales = clampInt(before.falDistales, 5);
    after.tarsianos = num(after.calcaneo) + num(after.astragalo) + num(after.restoTarso);

    if (!shallowEqualNumeric(before, after)) changed = true;
    data[side] = after;
    sides[side] = {
      status,
      source: before.tarsianos === undefined ? null : clampInt(before.tarsianos, 7),
      derived: {
        calcaneo: num(after.calcaneo),
        astragalo: num(after.astragalo),
        restoTarso: num(after.restoTarso),
      },
      ambiguous,
    };
  }

  /* ---- Metadatos de derivación ---- */
  // La traza puede venir en el propio payload o, si `EATForm` la descartó al
  // reconstruir el objeto, en el `data` previamente persistido.
  const inline = asObj(original[EAT_DERIVATION_KEY]);
  const prev = inline.version !== undefined ? inline : asObj(asObj(previousData)[EAT_DERIVATION_KEY]);

  const mergedSides = mergeSides(asObj(prev.sides), sides);
  const derivation: EatDerivation = {
    version: EAT_SCHEMA_VERSION,
    // Idempotencia: si ya se había migrado, se conserva el timestamp original.
    migratedAt: typeof prev.migratedAt === "number" ? prev.migratedAt : now,
    assumption: EAT_DERIVATION_ASSUMPTION,
    // Se RECALCULA de los lados (no se hace OR con el valor viejo): si Martina
    // re-registra el único lado ambiguo, la ficha tiene que salir del análisis
    // de sensibilidad.
    underAssumption: Object.values(mergedSides).some((s) => s.ambiguous),
    sides: mergedSides,
  };
  data[EAT_DERIVATION_KEY] = derivation;
  if (prev.version !== EAT_SCHEMA_VERSION) changed = true;

  return { data, changed, derivation };
}

/**
 * Fusiona la traza de derivación previa con la recién calculada. Es lo que hace
 * la función IDEMPOTENTE y lo que sostiene el análisis de sensibilidad.
 *
 * Segunda corrida sobre una ficha ya migrada: los lados se ven `granular`
 * (las claves nuevas existen). Sin este merge, un lado `derivado-supuesto`
 * pasaría a `granular` y la ficha se perdería del análisis. Reglas:
 *
 *  - había traza `derivado-*` y los valores actuales COINCIDEN con los derivados
 *    → se conserva el status/ambigüedad/origen (re-corrida, no hubo edición);
 *  - había traza `derivado-*` y los valores CAMBIARON → el usuario re-registró
 *    el lado a mano: pasa a `registrado`, `ambiguous = false`;
 *  - `registrado` es terminal (no vuelve a supuesto);
 *  - sin traza previa → se usa lo calculado.
 */
function mergeSides(
  prev: Obj,
  current: Record<string, EatSideDerivation>,
): Record<string, EatSideDerivation> {
  const out: Record<string, EatSideDerivation> = {};
  for (const [side, cur] of Object.entries(current)) {
    const old = isObj(prev[side]) ? (prev[side] as unknown as EatSideDerivation) : null;
    const oldStatus = old?.status;

    if (old && oldStatus === "registrado") {
      out[side] = { ...cur, status: "registrado", ambiguous: false, source: old.source ?? null };
      continue;
    }
    const eraDerivado = oldStatus === "derivado-exacto" || oldStatus === "derivado-supuesto";
    if (!old || !eraDerivado) {
      // sin traza previa, o traza "ausente"/"granular"/desconocida: manda lo calculado
      out[side] = cur;
      continue;
    }
    if (cur.status !== "granular") {
      out[side] = cur; // se volvió a derivar del legacy: la traza nueva manda
      continue;
    }
    const sameValues = sameDerived(old.derived, cur.derived);
    out[side] = sameValues
      ? {
          ...cur,
          status: oldStatus,
          ambiguous: old.ambiguous === true,
          source: old.source ?? null,
        }
      : { ...cur, status: "registrado", ambiguous: false, source: old.source ?? null };
  }
  return out;
}

function sameDerived(a: unknown, b: Record<string, number>): boolean {
  const prevDerived = asObj(a);
  const keys = new Set([...Object.keys(prevDerived), ...Object.keys(b)]);
  for (const k of keys) {
    if (num(prevDerived[k]) !== num(b[k])) return false;
  }
  return true;
}

/** Compara dos sub-objetos de extremidad clave por clave (valores numéricos). */
function shallowEqualNumeric(a: Obj, b: Obj): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k] === undefined || b[k] === undefined) return false;
    if (num(a[k]) !== num(b[k])) return false;
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Validación de rango (para las mutations)                                   */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface EatUnitsValidationIssue {
  side: string;
  key: string;
  value: unknown;
  problem: "no-numerico" | "fuera-de-rango" | "no-entero" | "espejo-inconsistente";
  expected: string;
}

/**
 * Verifica el inventario de mano/pie contra el contrato. Read-only: NO corrige.
 * Pensada para que `fichas.crear` / `fichas.actualizar` rechacen payloads fuera
 * de rango con un error legible (hoy `data` es `v.any()` y no valida nada).
 * `normalizeEatUnits` clampea, así que en el camino normal esto sale vacío.
 */
export function validateEatUnits(rawData: unknown): EatUnitsValidationIssue[] {
  const data = asObj(rawData);
  const issues: EatUnitsValidationIssue[] = [];

  const checkSide = (side: string, fields: readonly EatFieldSpec[]) => {
    if (data[side] === undefined) return; // lado ausente: válido
    if (!isObj(data[side])) {
      issues.push({ side, key: "-", value: data[side], problem: "no-numerico", expected: "objeto" });
      return;
    }
    const d = data[side] as Obj;
    for (const f of fields) {
      const raw = d[f.key];
      if (raw === undefined) continue;
      const n = typeof raw === "number" ? raw : parseFloat(String(raw));
      if (!Number.isFinite(n)) {
        issues.push({ side, key: f.key, value: raw, problem: "no-numerico", expected: "número" });
        continue;
      }
      if (!Number.isInteger(n)) {
        issues.push({ side, key: f.key, value: raw, problem: "no-entero", expected: "entero" });
      }
      if (n < 0 || n > f.max) {
        issues.push({
          side,
          key: f.key,
          value: raw,
          problem: "fuera-de-rango",
          expected: `0..${f.max}`,
        });
      }
    }
  };

  for (const side of EAT_HAND_SIDES) checkSide(side, EAT_HAND_FIELDS);
  for (const side of EAT_FOOT_SIDES) checkSide(side, EAT_FOOT_FIELDS);

  // Coherencia de los espejos legacy (solo si ambos lados del espejo existen).
  for (const side of EAT_HAND_SIDES) {
    const d = asObj(data[side]);
    if (d.falProxMedias === undefined || d.falProximales === undefined) continue;
    const esperado = clampInt(d.falProximales, 5) + clampInt(d.falMedias, 4);
    if (clampInt(d.falProxMedias, 9) !== esperado) {
      issues.push({
        side,
        key: "falProxMedias",
        value: d.falProxMedias,
        problem: "espejo-inconsistente",
        expected: `falProximales + falMedias = ${esperado}`,
      });
    }
  }
  for (const side of EAT_FOOT_SIDES) {
    const d = asObj(data[side]);
    if (d.tarsianos === undefined || d.calcaneo === undefined) continue;
    const esperado =
      clampInt(d.calcaneo, 1) + clampInt(d.astragalo, 1) + clampInt(d.restoTarso, 5);
    if (clampInt(d.tarsianos, 7) !== esperado) {
      issues.push({
        side,
        key: "tarsianos",
        value: d.tarsianos,
        problem: "espejo-inconsistente",
        expected: `calcaneo + astragalo + restoTarso = ${esperado}`,
      });
    }
  }

  return issues;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Limpieza destructiva (pasada posterior, gateada)                           */
/* ══════════════════════════════════════════════════════════════════════════ */

/**
 * Borra los espejos legacy de una ficha ya migrada. NO se corre junto con la
 * migración: es una pasada aparte, recién después de que Martina verifique los
 * números y de que ningún consumidor lea `tarsianos` / `falProxMedias`.
 * Reversible: los espejos se re-derivan de las claves nuevas (son sumas).
 */
export function stripLegacyEatKeys(rawData: unknown): { data: Obj; removed: string[] } {
  const data: Obj = { ...asObj(rawData) };
  const removed: string[] = [];
  for (const side of EAT_HAND_SIDES) {
    if (!isObj(data[side])) continue;
    const d: Obj = { ...(data[side] as Obj) };
    for (const k of EAT_LEGACY_HAND_KEYS) {
      if (k in d) {
        delete d[k];
        removed.push(`${side}.${k}`);
      }
    }
    data[side] = d;
  }
  for (const side of EAT_FOOT_SIDES) {
    if (!isObj(data[side])) continue;
    const d: Obj = { ...(data[side] as Obj) };
    for (const k of EAT_LEGACY_FOOT_KEYS) {
      if (k in d) {
        delete d[k];
        removed.push(`${side}.${k}`);
      }
    }
    data[side] = d;
  }
  return { data, removed };
}
