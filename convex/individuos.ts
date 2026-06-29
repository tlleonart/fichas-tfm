import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Build a readable, dedup-safe canonical code from the structured identity. */
function buildCodigo(a: {
  sitio: string;
  anioExcavacion: number;
  numeroFosa: string;
  codigoUF: string;
  numeroIndividuo: string;
}): string {
  const slug = (s: string) =>
    s.trim().toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, "");
  return [
    slug(a.sitio),
    a.anioExcavacion,
    `F${slug(a.numeroFosa)}`,
    `UF${slug(a.codigoUF)}`,
    `I${slug(a.numeroIndividuo)}`,
  ].join("-");
}

const identityArgs = {
  anioExcavacion: v.number(),
  sitio: v.string(),
  numeroFosa: v.string(),
  codigoUF: v.string(),
  numeroIndividuo: v.string(),
  sexoEstimado: v.optional(v.string()),
  edadEstimada: v.optional(v.string()),
  observaciones: v.optional(v.string()),
};

export const crear = mutation({
  args: identityArgs,
  handler: async (ctx, args) => {
    const codigoCanonico = buildCodigo(args);
    const existing = await ctx.db
      .query("individuos")
      .withIndex("by_codigo", (q) => q.eq("codigoCanonico", codigoCanonico))
      .unique();
    if (existing) {
      throw new Error(
        `Ya existe un individuo con el código ${codigoCanonico}. Usá el existente.`,
      );
    }
    return await ctx.db.insert("individuos", { ...args, codigoCanonico });
  },
});

export const actualizar = mutation({
  args: { id: v.id("individuos"), ...identityArgs },
  handler: async (ctx, { id, ...args }) => {
    const codigoCanonico = buildCodigo(args);
    const clash = await ctx.db
      .query("individuos")
      .withIndex("by_codigo", (q) => q.eq("codigoCanonico", codigoCanonico))
      .unique();
    if (clash && clash._id !== id) {
      throw new Error(`El código ${codigoCanonico} ya pertenece a otro individuo.`);
    }
    await ctx.db.patch(id, { ...args, codigoCanonico });
  },
});

export const eliminar = mutation({
  args: { id: v.id("individuos") },
  handler: async (ctx, { id }) => {
    const fichas = await ctx.db
      .query("fichas")
      .withIndex("by_individuo", (q) => q.eq("individuoId", id))
      .collect();
    for (const f of fichas) await ctx.db.delete(f._id);
    await ctx.db.delete(id);
  },
});

/** List individuals with a per-method coverage summary for the index view. */
export const listar = query({
  args: { sitio: v.optional(v.string()) },
  handler: async (ctx, { sitio }) => {
    const individuos = sitio
      ? await ctx.db
          .query("individuos")
          .withIndex("by_sitio", (q) => q.eq("sitio", sitio))
          .collect()
      : await ctx.db.query("individuos").collect();

    return await Promise.all(
      individuos.map(async (ind) => {
        const fichas = await ctx.db
          .query("fichas")
          .withIndex("by_individuo", (q) => q.eq("individuoId", ind._id))
          .collect();
        // Corrección metodológica (SDD §6): contador de revisiones pendientes
        // a través de las fichas del individuo, para el badge en /individuos.
        const revisionesPendientesCount = fichas.reduce(
          (acc, f) =>
            acc + (Array.isArray(f.revisionesPendientes) ? f.revisionesPendientes.length : 0),
          0,
        );
        return {
          ...ind,
          tieneZonacion: fichas.some((f) => f.tipo === "zonacion"),
          tieneEat: fichas.some((f) => f.tipo === "eat"),
          revisionesPendientesCount,
        };
      }),
    );
  },
});

/** Full individual with its fichas. */
export const obtener = query({
  args: { id: v.id("individuos") },
  handler: async (ctx, { id }) => {
    const individuo = await ctx.db.get(id);
    if (!individuo) return null;
    const fichas = await ctx.db
      .query("fichas")
      .withIndex("by_individuo", (q) => q.eq("individuoId", id))
      .collect();
    return { individuo, fichas };
  },
});
