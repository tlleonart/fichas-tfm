import { query } from "./_generated/server";
import { v } from "convex/values";
import type { EATMetrics, ZonacionMetrics } from "./lib/metrics";

/* ------------------------------------------------------------------ */
/*  Statistics helpers (Spearman rank correlation)                     */
/* ------------------------------------------------------------------ */

function ranks(xs: number[]): number[] {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1; // average rank (1-based) for ties
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 2) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : Math.round((num / den) * 1000) / 1000;
}

/** Spearman rho = Pearson on ranks. Returns null below the minimum sample size. */
function spearman(x: number[], y: number[], minN = 3): number | null {
  if (x.length < minN) return null;
  return pearson(ranks(x), ranks(y));
}

/* ------------------------------------------------------------------ */
/*  Comparison query (population / total)                              */
/* ------------------------------------------------------------------ */

export const comparacion = query({
  args: { sitio: v.optional(v.string()) },
  handler: async (ctx, { sitio }) => {
    const individuos = sitio
      ? await ctx.db
          .query("individuos")
          .withIndex("by_sitio", (q) => q.eq("sitio", sitio))
          .collect()
      : await ctx.db.query("individuos").collect();

    const pares: Array<Record<string, unknown>> = [];
    let soloZonacion = 0;
    let soloEat = 0;

    for (const ind of individuos) {
      const fichas = await ctx.db
        .query("fichas")
        .withIndex("by_individuo", (q) => q.eq("individuoId", ind._id))
        .collect();
      const eat = fichas.find((f) => f.tipo === "eat");
      const zon = fichas.find((f) => f.tipo === "zonacion");

      if (eat && zon) {
        const em = eat.metricas as EATMetrics | undefined;
        const zm = zon.metricas as ZonacionMetrics | undefined;
        if (em && zm) {
          pares.push({
            individuoId: ind._id,
            codigo: ind.codigoCanonico,
            sitio: ind.sitio,
            sexo: ind.sexoEstimado ?? null,
            edad: ind.edadEstimada ?? null,
            // EAT (subjective component embedded)
            ipo: em.ipo,
            ich: em.ich, // <- subjective index under study
            eat: em.eat,
            // Zonación (objective)
            completitudGlobal: zm.completitudGlobal,
            // direction-aligned with EAT (affectation, higher = worse)
            afectacionZonacion: Math.round((100 - zm.completitudGlobal) * 10) / 10,
            ffiMedia: zm.ffi.media,
            alteraciones: zm.alteracionesCount,
          });
        }
      } else if (zon) {
        soloZonacion += 1;
      } else if (eat) {
        soloEat += 1;
      }
    }

    // Correlations across paired individuals (null until n >= 3).
    const col = (k: string) => pares.map((p) => Number(p[k]));
    const correlaciones = {
      // H1 — convergent validity of presence (expected strong)
      ipo_vs_completitud: spearman(col("ipo"), col("completitudGlobal")),
      // H2 — does EAT diverge from the purely objective measure?
      eat_vs_afectacionZonacion: spearman(col("eat"), col("afectacionZonacion")),
      // H3 — is the subjective ICH grounded in objective condition?
      //      (raw; partial correlation controlling for IPO is a documented next step)
      ich_vs_completitud: spearman(col("ich"), col("completitudGlobal")),
      ich_vs_ffi: spearman(
        pares.filter((p) => p.ffiMedia !== null).map((p) => Number(p.ich)),
        pares.filter((p) => p.ffiMedia !== null).map((p) => Number(p.ffiMedia)),
      ),
    };

    return {
      alcance: sitio ?? "total",
      resumen: {
        individuos: individuos.length,
        pareados: pares.length,
        soloZonacion,
        soloEat,
        nSuficienteParaCorrelacion: pares.length >= 3,
      },
      pares,
      correlaciones,
    };
  },
});
