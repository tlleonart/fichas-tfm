import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { computeMetrics } from "./lib/metrics";
import { prepararEscrituraEat } from "./lib/eatWrite";

const tipoValidator = v.union(v.literal("zonacion"), v.literal("eat"));

export const crear = mutation({
  args: {
    individuoId: v.id("individuos"),
    tipo: tipoValidator,
    registrador: v.string(),
    fechaRegistro: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const individuo = await ctx.db.get(args.individuoId);
    if (!individuo) throw new Error("El individuo no existe.");

    // Business rule: 1 ficha per method per individual.
    const existing = await ctx.db
      .query("fichas")
      .withIndex("by_individuo_tipo", (q) =>
        q.eq("individuoId", args.individuoId).eq("tipo", args.tipo),
      )
      .unique();
    if (existing) {
      throw new Error(
        `Este individuo ya tiene una ficha de tipo "${args.tipo}". Editá la existente.`,
      );
    }

    // Fichas EAT: shape granular v3 + validación de rango. Zonación pasa derecho
    // (su migración vive en `lib/zonacionMigration.ts` y queda en schemaVersion 2).
    if (args.tipo === "eat") {
      const { data, metricas, schemaVersion } = prepararEscrituraEat(args.data, Date.now());
      return await ctx.db.insert("fichas", { ...args, data, metricas, schemaVersion });
    }

    const metricas = computeMetrics(args.tipo, args.data ?? {});
    return await ctx.db.insert("fichas", { ...args, metricas });
  },
});

export const actualizar = mutation({
  args: {
    id: v.id("fichas"),
    registrador: v.optional(v.string()),
    fechaRegistro: v.optional(v.string()),
    data: v.any(),
  },
  handler: async (ctx, { id, data, ...rest }) => {
    const ficha = await ctx.db.get(id);
    if (!ficha) throw new Error("La ficha no existe.");

    if (ficha.tipo === "eat") {
      // ⚠️ El tercer argumento NO es opcional acá: `ficha.data` es lo que rescata
      // `data.eatDerivation`, que el payload de `EATForm` no trae (handoff §4.3).
      const {
        data: normalizado,
        metricas,
        schemaVersion,
      } = prepararEscrituraEat(data, Date.now(), ficha.data);
      await ctx.db.patch(id, { ...rest, data: normalizado, metricas, schemaVersion });
      return;
    }

    const metricas = computeMetrics(ficha.tipo, data ?? {});
    await ctx.db.patch(id, { ...rest, data, metricas });
  },
});

/**
 * Marca una revisión pendiente como resuelta: remueve el ítem cuyo `codigo`
 * coincida de `revisionesPendientes` (botón "Marcar como revisada", SDD §6).
 * Idempotente (si el código no está, no-op). NO toca `data`, `metricas` ni
 * `schemaVersion` — solo la lista de revisiones.
 */
export const marcarRevisionResuelta = mutation({
  args: { fichaId: v.id("fichas"), codigo: v.string() },
  handler: async (ctx, { fichaId, codigo }) => {
    const ficha = await ctx.db.get(fichaId);
    if (!ficha) throw new Error("Ficha no encontrada");
    const restantes = (ficha.revisionesPendientes ?? []).filter(
      (r) => r.codigo !== codigo,
    );
    await ctx.db.patch(fichaId, { revisionesPendientes: restantes });
    return { restantes: restantes.length };
  },
});

export const eliminar = mutation({
  args: { id: v.id("fichas") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const obtener = query({
  args: { id: v.id("fichas") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});
