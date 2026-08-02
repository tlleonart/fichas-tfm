/**
 * Migración 2026-08 — EAT: unidades anatómicas de mano y pie.
 * ==========================================================
 * SDD: `SDD-fidelidad-EAT-unidades-anatomicas.md` §3.1 · contrato: `lib/eatUnits.ts`
 *
 * Desdobla los conteos agregados que la partición de Serrulla & Vázquez (2019)
 * corta al medio:
 *     pieDer/Izq.tarsianos     (0..7) → calcaneo · astragalo · restoTarso
 *     manoDer/Izq.falProxMedias (0..9) → falProximales · falMedias
 *
 * internalMutation ADITIVA e IDEMPOTENTE. Toca SOLO fichas `tipo === "eat"`.
 * Las de Zonación no se tocan en absoluto (siguen en schemaVersion 2).
 *
 * ─── 🔒 GATES DE CORRIDA (leer antes de ejecutar) ──────────────────────────
 *  1. **BACKUP.** `npx convex export --path <ruta>.zip` ANTES de cualquier
 *     corrida con `apply: true`. Sin backup fresco no se corre. El repo apunta a
 *     PROD (`vibrant-otter-229`): no hay entorno de staging.
 *  2. **ORDEN.** Correr DESPUÉS de que `lib/metrics.ts` tenga la partición
 *     estricta (SDD §3.2, lane de Ronan). La migración recalcula `metricas` con
 *     `computeEAT`; si las métricas todavía son las viejas, persistiría números
 *     obsoletos. `apply: true` está BLOQUEADO por guard hasta que `metrics.ts`
 *     exporte `EAT_UNIT_PARTITION_VERSION >= 2`.
 *  3. **DRY-RUN POR DEFECTO.** Sin `apply: true` no escribe nada. Correr el
 *     dry-run primero y comparar contra el reporte de
 *     `scripts/dryrun-eat-units.mjs`.
 *  4. **GO DE TOMÁS.** La corrida real la dispara el gate G-PROD (Randall), no
 *     un agente por su cuenta.
 *
 * Rollback: los espejos legacy (`tarsianos`, `falProxMedias`) se preservan, así
 * que el estado anterior es re-derivable sin restaurar el backup. El backup cubre
 * el caso `metricas` (que sí se sobreescribe).
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { computeEAT } from "../lib/metrics";
import * as metricsModule from "../lib/metrics";
import {
  EAT_SCHEMA_VERSION,
  normalizeEatUnits,
  stripLegacyEatKeys,
  validateEatUnits,
  type EatSideDerivation,
} from "../lib/eatUnits";

/**
 * Versión de la partición de unidades anatómicas implementada en `lib/metrics.ts`.
 * Lectura suelta a propósito: hoy la constante NO existe (partición vieja) y este
 * módulo tiene que compilar igual. Ronan la exporta con valor `2` al implementar
 * SDD §3.2; recién entonces `apply: true` se habilita.
 *
 *   1 (o ausente) = partición vieja (falProxMedias/9, tarsianos/7).
 *   2             = partición estricta de la fuente.
 */
const REQUIRED_PARTITION_VERSION = 2;

function currentPartitionVersion(): number {
  const raw = (metricsModule as unknown as Record<string, unknown>)
    .EAT_UNIT_PARTITION_VERSION;
  return typeof raw === "number" ? raw : 1;
}

interface DetalleFicha {
  id: string;
  individuoId: string;
  accion: "migrada" | "sin-cambios" | "dry-run";
  /** Lados derivados bajo el supuesto best-case (SDD §5.1). */
  ladosBajoSupuesto: string[];
  ipoAntes: number | null;
  ipoDespues: number;
  ichAntes: number | null;
  ichDespues: number;
  eatAntes: number | null;
  eatDespues: number;
  issues: string[];
}

export const migrarEatUnidades = internalMutation({
  args: {
    /** `true` = escribe. Ausente/`false` = dry-run read-only (default seguro). */
    apply: v.optional(v.boolean()),
  },
  handler: async (ctx, { apply }) => {
    const escribir = apply === true;
    const partitionVersion = currentPartitionVersion();

    if (escribir && partitionVersion < REQUIRED_PARTITION_VERSION) {
      throw new Error(
        `[eat_units_2026_08] BLOQUEADA: lib/metrics.ts está en partición v${partitionVersion} ` +
          `y se requiere v${REQUIRED_PARTITION_VERSION} (SDD §3.2, unidades anatómicas estrictas). ` +
          `Correr la migración con las métricas viejas persistiría métricas obsoletas. ` +
          `Implementar handPoints/footPoints estrictos y exportar ` +
          `EAT_UNIT_PARTITION_VERSION = 2 desde lib/metrics.ts primero.`,
      );
    }

    const fichas = await ctx.db
      .query("fichas")
      .withIndex("by_tipo", (q) => q.eq("tipo", "eat"))
      .collect();

    const resultado = {
      modo: escribir ? ("apply" as const) : ("dry-run" as const),
      partitionVersion,
      schemaVersionObjetivo: EAT_SCHEMA_VERSION,
      total: fichas.length,
      migradas: 0,
      sinCambios: 0,
      yaEnVersion: 0,
      fichasBajoSupuesto: 0,
      ladosBajoSupuesto: 0,
      issuesDeValidacion: 0,
      detalle: [] as DetalleFicha[],
    };

    const now = Date.now();

    for (const ficha of fichas) {
      const yaMigrada =
        typeof ficha.schemaVersion === "number" && ficha.schemaVersion >= EAT_SCHEMA_VERSION;
      if (yaMigrada) resultado.yaEnVersion += 1;

      const dataAntes = (ficha.data ?? {}) as Record<string, unknown>;
      const metricasAntes = (ficha.metricas ?? null) as {
        ipo?: number;
        ich?: number;
        eat?: number;
      } | null;

      // 1. Normalización del inventario (aditiva, idempotente). Lane de Dante.
      const { data, changed, derivation } = normalizeEatUnits(dataAntes, now);

      // 2. Recálculo de métricas con la partición vigente. Lane de Ronan.
      const metricas = computeEAT(data);

      // 3. `data._computed` es el preview del formulario persistido dentro de
      //    `data` (invariante #2: el backend es la fuente de verdad). Se refresca
      //    solo si ya existía, para no dejar un preview obsoleto en la ficha.
      if (data._computed && typeof data._computed === "object") {
        data._computed = {
          ...(data._computed as Record<string, unknown>),
          IPO: metricas.ipo,
          ICH: metricas.ich,
          EAT: metricas.eat,
          totalPresent: metricas.totalPresent,
        };
      }

      const issues = validateEatUnits(data).map(
        (i) => `${i.side}.${i.key}=${String(i.value)} (${i.problem}, esperado ${i.expected})`,
      );
      resultado.issuesDeValidacion += issues.length;

      const ladosBajoSupuesto = Object.entries(derivation.sides)
        .filter(([, s]) => (s as EatSideDerivation).ambiguous)
        .map(([side]) => side);
      if (ladosBajoSupuesto.length > 0) {
        resultado.fichasBajoSupuesto += 1;
        resultado.ladosBajoSupuesto += ladosBajoSupuesto.length;
      }

      const debeEscribir = changed || !yaMigrada;
      if (escribir && debeEscribir) {
        await ctx.db.patch(ficha._id, {
          data,
          metricas,
          schemaVersion: EAT_SCHEMA_VERSION,
        });
        resultado.migradas += 1;
      } else if (!debeEscribir) {
        resultado.sinCambios += 1;
      }

      resultado.detalle.push({
        id: ficha._id,
        individuoId: ficha.individuoId,
        accion: escribir ? (debeEscribir ? "migrada" : "sin-cambios") : "dry-run",
        ladosBajoSupuesto,
        ipoAntes: metricasAntes?.ipo ?? null,
        ipoDespues: metricas.ipo,
        ichAntes: metricasAntes?.ich ?? null,
        ichDespues: metricas.ich,
        eatAntes: metricasAntes?.eat ?? null,
        eatDespues: metricas.eat,
        issues,
      });
    }

    return resultado;
  },
});

/**
 * Pasada de LIMPIEZA destructiva — borra los espejos legacy `tarsianos` y
 * `falProxMedias`. Paso (D) del plan aditivo: se corre RECIÉN cuando
 *   (a) `migrarEatUnidades` cerró en todas las fichas (schemaVersion >= 3),
 *   (b) Martina verificó los números del recálculo,
 *   (c) ningún consumidor lee las claves legacy: `lib/metrics.ts`,
 *       `src/components/EATForm.tsx`, el export de `/datos` y los scripts de
 *       `analisis/` (cuantificar.py, gen_informe.py).
 *
 * Requiere confirmación explícita, con backup fresco. Rollback: re-correr
 * `migrarEatUnidades` (los espejos son sumas de las claves nuevas, se re-derivan).
 */
export const limpiarClavesLegacyEat = internalMutation({
  args: {
    confirmacion: v.literal("BORRAR-CLAVES-LEGACY-EAT"),
    apply: v.optional(v.boolean()),
  },
  handler: async (ctx, { apply }) => {
    const escribir = apply === true;
    const fichas = await ctx.db
      .query("fichas")
      .withIndex("by_tipo", (q) => q.eq("tipo", "eat"))
      .collect();

    const sinMigrar = fichas.filter(
      (f) => !(typeof f.schemaVersion === "number" && f.schemaVersion >= EAT_SCHEMA_VERSION),
    );
    if (sinMigrar.length > 0) {
      throw new Error(
        `[limpiarClavesLegacyEat] BLOQUEADA: ${sinMigrar.length} fichas EAT todavía no están en ` +
          `schemaVersion ${EAT_SCHEMA_VERSION}. Correr migrarEatUnidades primero.`,
      );
    }

    const resultado = {
      modo: escribir ? ("apply" as const) : ("dry-run" as const),
      total: fichas.length,
      limpiadas: 0,
      clavesBorradas: 0,
      detalle: [] as Array<{ id: string; removed: string[] }>,
    };

    for (const ficha of fichas) {
      const { data, removed } = stripLegacyEatKeys(ficha.data ?? {});
      if (removed.length === 0) continue;
      if (escribir) await ctx.db.patch(ficha._id, { data });
      resultado.limpiadas += 1;
      resultado.clavesBorradas += removed.length;
      resultado.detalle.push({ id: ficha._id, removed });
    }

    return resultado;
  },
});
