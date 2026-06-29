/**
 * Migración 2026-06 — Corrección metodológica de Zonación.
 * --------------------------------------------------------
 * internalMutation idempotente y ADITIVA. Itera las fichas tipo "zonacion" con
 * schemaVersion ausente o < 2, aplica `migrateZonacionFicha` (función pura) y
 * persiste con ctx.db.patch. Una ficha por vez. No borra claves viejas.
 *
 * 🔒 Se invoca SOLO en el gate G-PROD (Randall), con backup fresco + go de
 * Tomás. NO correr `npx convex run` desde el entorno de desarrollo: el repo
 * apunta a PROD `vibrant-otter-229`.
 *
 * Las fichas EAT NO se tocan (su cómputo es idéntico).
 */

import { internalMutation } from "../_generated/server";
import { migrateZonacionFicha, type FichaLike } from "../lib/zonacionMigration";

export const migrarZonacion = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fichas = await ctx.db
      .query("fichas")
      .withIndex("by_tipo", (q) => q.eq("tipo", "zonacion"))
      .collect();

    const resultado = {
      total: fichas.length,
      migradas: 0,
      saltadas: 0,
      detalle: [] as Array<{
        id: string;
        accion: "migrada" | "saltada";
        zonasPresentes?: number;
        elementosPresentes?: number;
        revisiones?: string[];
      }>,
    };

    for (const ficha of fichas) {
      if (typeof ficha.schemaVersion === "number" && ficha.schemaVersion >= 2) {
        resultado.saltadas += 1;
        resultado.detalle.push({ id: ficha._id, accion: "saltada" });
        continue;
      }

      const migrada = migrateZonacionFicha(ficha as unknown as FichaLike);

      await ctx.db.patch(ficha._id, {
        data: migrada.data,
        metricas: migrada.metricas,
        revisionesPendientes: migrada.revisionesPendientes,
        schemaVersion: migrada.schemaVersion,
      });

      const m = migrada.metricas;
      resultado.migradas += 1;
      resultado.detalle.push({
        id: ficha._id,
        accion: "migrada",
        zonasPresentes: m.zonasPresentes,
        elementosPresentes: m.elementosPresentes,
        revisiones: (migrada.revisionesPendientes ?? []).map((r) => r.codigo),
      });
    }

    return resultado;
  },
});
