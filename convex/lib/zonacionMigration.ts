/**
 * Migración pura de fichas de Zonación a schemaVersion 2.
 * --------------------------------------------------------
 * Corrección metodológica 2026-06 (SDD-correccion-metodologica-zonacion).
 *
 * Función PURA (sin imports de Convex) — testeable offline contra el snapshot
 * de prod. Es:
 *   - ADITIVA / NO destructiva: escribe las claves nuevas y PRESERVA las viejas
 *     (sacrum_zones S{x}_z{y}, mand_{k}_{L|R}, foot_zones.fPatella_*, *_fusion).
 *     Una limpieza destructiva posterior (mutation aparte) borrará las viejas
 *     recién tras la verificación de Martina.
 *   - IDEMPOTENTE: si schemaVersion >= 2, devuelve la ficha sin cambios.
 *
 * Transformaciones:
 *   1. Sacro 20 → 4: sac_z{k} = OR(S1_z{k}..S5_z{k}). Flag SACRO_COLAPSO si
 *      había ≥1 zona de sacro previa.
 *   2. Rótula: nuevo data.patella_zones { pat_L, pat_R } = fPatella_L/R. Sin flag.
 *   3. Mandíbula 14 → 7: mand_z{k} = OR(mand_{k}_L, mand_{k}_R). Auto-genera
 *      data.mandibula_lateralidad_obs desde las claves L/R. Flag ligero
 *      MANDIBULA_REVISAR_NOTA.
 *   4. Fusión: flag FUSION_FUERA_DE_EPIFISIS (severidad "corregir") si hay valor
 *      de fusión en una zona NO epifisaria de algún hueso largo.
 *   5. Recalcula `metricas` con computeZonacion nuevo; setea schemaVersion = 2.
 */

import { computeZonacion, type ZonacionMetrics } from "./metrics";

export interface RevisionPendiente {
  codigo: string;
  severidad: "corregir" | "revisar";
  titulo: string;
  instrucciones: string;
  campos: string[];
}

export interface FichaLike {
  tipo?: string;
  schemaVersion?: number;
  data?: Record<string, unknown>;
  metricas?: unknown;
  revisionesPendientes?: RevisionPendiente[];
  [k: string]: unknown;
}

export interface MigrationResult {
  data: Record<string, unknown>;
  metricas: ZonacionMetrics;
  revisionesPendientes: RevisionPendiente[];
  schemaVersion: 2;
}

const SACRUM_ZONES = [1, 2, 3, 4] as const;
const SACRUM_SEGMENTS = [1, 2, 3, 4, 5] as const;
const MANDIBLE_ZONES = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Conjunto epifisario por hueso (SDD §Z1, tabla autoritativa). Las claves de
 * fusión usan el número/letra de zona: `${prefix}_${zone}_fus{L|R}`.
 * Una zona NO listada aquí es diáfisis → la fusión cargada en ella es errónea.
 */
export const EPIPHYSEAL_ZONES: Record<string, string[]> = {
  hum: ["1", "2", "3", "4", "5", "6"], // húmero: diáfisis 7–11
  rad: ["1", "2", "3", "4", "J"], // radio: diáfisis 5–10
  uln: ["A", "B", "C", "J"], // cúbito: diáfisis D–H
  fem: ["1", "2", "4", "5", "9", "10", "11"], // fémur: diáfisis 3,6,7,8
  tib: ["1", "2", "3", "4", "5", "6"], // tibia: diáfisis 7–10
  fib: ["1", "2"], // peroné: diáfisis 3–6
};

const FUSION_FIELDS: Record<string, string> = {
  humerus_fusion: "hum",
  radius_fusion: "rad",
  ulna_fusion: "uln",
  femur_fusion: "fem",
  tibia_fusion: "tib",
  fibula_fusion: "fib",
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Parsea `${prefix}_${zone}_fus{L|R}` → { zone, side } o null. */
function parseFusionKey(prefix: string, key: string): { zone: string; side: "L" | "R" } | null {
  const m = key.match(new RegExp(`^${prefix}_(.+)_fus([LR])$`));
  if (!m) return null;
  return { zone: m[1], side: m[2] as "L" | "R" };
}

/**
 * Construye la observación legible de lateralidad de la mandíbula desde las
 * claves mand_{k}_{L|R}. Ej: "zona 5: solo lado izquierdo; zona 6: ambos lados".
 * Solo describe las zonas presentes (al menos un lado en true).
 */
export function buildMandibulaLateralidadObs(mandible: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of MANDIBLE_ZONES) {
    const L = Boolean(mandible[`mand_${k}_L`]);
    const R = Boolean(mandible[`mand_${k}_R`]);
    if (!L && !R) continue;
    let lado: string;
    if (L && R) lado = "ambos lados";
    else if (L) lado = "solo lado izquierdo";
    else lado = "solo lado derecho";
    parts.push(`zona ${k}: ${lado}`);
  }
  return parts.join("; ");
}

/**
 * Migra una ficha de zonación a schemaVersion 2. Idempotente: si ya está en
 * v2 (o más), devuelve la ficha tal cual (sin clonar campos no afectados).
 */
export function migrateZonacionFicha(
  ficha: FichaLike,
): FichaLike & { metricas: ZonacionMetrics; revisionesPendientes: RevisionPendiente[] } {
  if (typeof ficha.schemaVersion === "number" && ficha.schemaVersion >= 2) {
    return ficha as FichaLike & {
      metricas: ZonacionMetrics;
      revisionesPendientes: RevisionPendiente[];
    };
  }

  const data: Record<string, unknown> = { ...(ficha.data ?? {}) };
  const revisiones: RevisionPendiente[] = [];

  /* ---- 1. Sacro: sac_z{k} = OR(S1_z{k}..S5_z{k}) ---- */
  const sacrumOld = asObj(data.sacrum_zones);
  const hadSacrum = Object.values(sacrumOld).some(Boolean);
  const sacrumNew: Record<string, unknown> = { ...sacrumOld };
  for (const k of SACRUM_ZONES) {
    const present = SACRUM_SEGMENTS.some((s) => Boolean(sacrumOld[`S${s}_z${k}`]));
    sacrumNew[`sac_z${k}`] = present;
  }
  data.sacrum_zones = sacrumNew;
  if (hadSacrum) {
    revisiones.push({
      codigo: "SACRO_COLAPSO",
      severidad: "revisar",
      titulo: "Sacro recalculado a 4 zonas (Knüsel & Outram)",
      instrucciones:
        "El sacro pasó de 5 segmentos × 4 zonas (20) a las 4 zonas-tipo K&O " +
        "(cuerpo, ala derecha, ala izquierda, cresta/espinosa). Las zonas " +
        "nuevas se derivaron por OR de los segmentos previos. Revisá que las 4 " +
        "zonas reflejen lo observado en el material.",
      campos: ["sacrum_zones"],
    });
  }

  /* ---- 2. Rótula: data.patella_zones { pat_L, pat_R } ---- */
  const footOld = asObj(data.foot_zones);
  const patellaL = Boolean(footOld.fPatella_L);
  const patellaR = Boolean(footOld.fPatella_R);
  const patellaPrev = asObj(data.patella_zones);
  data.patella_zones = {
    ...patellaPrev,
    pat_L: patellaL || Boolean(patellaPrev.pat_L),
    pat_R: patellaR || Boolean(patellaPrev.pat_R),
  };
  // foot_zones queda intacto (fPatella_* preservadas; el cómputo las ignora).

  /* ---- 3. Mandíbula: mand_z{k} = OR(L,R) + obs de lateralidad ---- */
  const mandOld = asObj(data.mandible_zones);
  const hadMandible = MANDIBLE_ZONES.some(
    (k) => Boolean(mandOld[`mand_${k}_L`]) || Boolean(mandOld[`mand_${k}_R`]),
  );
  const mandNew: Record<string, unknown> = { ...mandOld };
  for (const k of MANDIBLE_ZONES) {
    mandNew[`mand_z${k}`] = Boolean(mandOld[`mand_${k}_L`]) || Boolean(mandOld[`mand_${k}_R`]);
  }
  data.mandible_zones = mandNew;
  if (hadMandible) {
    const obs = buildMandibulaLateralidadObs(mandOld);
    data.mandibula_lateralidad_obs = obs;
    revisiones.push({
      codigo: "MANDIBULA_REVISAR_NOTA",
      severidad: "revisar",
      titulo: "Mandíbula: completitud sobre 7 zonas-tipo (lado como observación)",
      instrucciones:
        "La completitud de la mandíbula ahora cuenta 7 zonas-tipo (presente si " +
        "está de cualquier lado). El lado izq/der quedó registrado como " +
        `observación de lateralidad: "${obs}". Verificá que la observación sea ` +
        "correcta.",
      campos: ["mandible_zones", "mandibula_lateralidad_obs"],
    });
  }

  /* ---- 4. Fusión fuera de epífisis ---- */
  const camposFusionAfectados: string[] = [];
  for (const [field, prefix] of Object.entries(FUSION_FIELDS)) {
    const fus = asObj(data[field]);
    const epi = EPIPHYSEAL_ZONES[prefix] ?? [];
    let fieldHasOffEpiphysis = false;
    for (const [key, val] of Object.entries(fus)) {
      if (!val || val === "") continue; // sin valor de fusión cargado
      const parsed = parseFusionKey(prefix, key);
      if (!parsed) continue;
      if (!epi.includes(parsed.zone)) {
        fieldHasOffEpiphysis = true;
      }
    }
    if (fieldHasOffEpiphysis) camposFusionAfectados.push(field);
  }
  if (camposFusionAfectados.length > 0) {
    revisiones.push({
      codigo: "FUSION_FUERA_DE_EPIFISIS",
      severidad: "corregir",
      titulo: "Fusión cargada fuera de zonas epifisarias",
      instrucciones:
        "Se detectó estado de fusión (F/PUF/DUF) en zonas de diáfisis, donde " +
        "no corresponde registrar fusión (solo en epífisis). Revisá y re-cargá " +
        "la fusión únicamente en las zonas epifisarias de cada hueso afectado.",
      campos: camposFusionAfectados,
    });
  }

  /* ---- 5. Recalcular métricas + schemaVersion ---- */
  const metricas = computeZonacion(data);

  const prevRevisiones = Array.isArray(ficha.revisionesPendientes)
    ? ficha.revisionesPendientes
    : [];
  // Reemplazamos las revisiones de esta migración por código (idempotencia si
  // alguna vez se re-corre sobre una ficha sin schemaVersion). Conservamos
  // cualquier revisión de otro origen.
  const migCodes = new Set(["SACRO_COLAPSO", "MANDIBULA_REVISAR_NOTA", "FUSION_FUERA_DE_EPIFISIS"]);
  const keptOther = prevRevisiones.filter((r) => !migCodes.has(r.codigo));
  const revisionesPendientes = [...keptOther, ...revisiones];

  return {
    ...ficha,
    data,
    metricas,
    revisionesPendientes,
    schemaVersion: 2,
  };
}
