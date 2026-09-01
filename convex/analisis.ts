import { query } from "./_generated/server";
import { v } from "convex/values";
import type { EATMetrics, ZonacionMetrics } from "./lib/metrics";
import * as stats from "./lib/stats";
import {
  analizarPoblacion,
  construirFila,
  UMBRAL_COMPLETITUD_EXTREMA,
  ZONAS_MANOS_PIES,
  ZONAS_NUCLEO,
} from "./lib/poblacional";
import { ZONATION_TOTAL_ZONES } from "./lib/metrics";

/* ------------------------------------------------------------------ */
/*  Statistics helpers                                                 */
/* ------------------------------------------------------------------ */
/* Pearson y Spearman se movieron a `lib/stats.ts` (funciones puras,
 * testeadas offline) junto con el resto del motor estadístico. Acá quedan
 * envoltorios que preservan EXACTAMENTE el contrato histórico de
 * `comparacion`: redondeo a 3 decimales y `null` con n < 3.
 * No cambiar: `/analisis` publica estos números desde la v1. */

/** ρ de Spearman redondeado a 3 decimales, como lo devolvía esta query. */
function spearman(x: number[], y: number[], minN = 3): number | null {
  const rho = stats.spearman(x, y, minN);
  return rho === null ? null : stats.round(rho, 3);
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

/* ------------------------------------------------------------------ */
/*  Dashboard (read-only) — "disponibilizar la data"                   */
/* ------------------------------------------------------------------ */

/**
 * Query de SOLO LECTURA para el dashboard de datos (/datos).
 *
 * Devuelve TODOS los individuos con su identidad + covariables y, por cada
 * método, un flag de presencia, las `metricas` YA calculadas y guardadas
 * (NO se recalcula nada aquí: `lib/metrics.ts` sigue siendo la única fuente de
 * verdad) y el `data` crudo tal cual está en la base. El filtrado, los
 * resúmenes y el export se resuelven client-side sobre este resultado.
 *
 * Eficiencia: un `collect()` de individuos y otro de fichas, unidos en memoria
 * por `individuoId` (2 lecturas de tabla, sin N+1).
 *
 * Shape de cada elemento del array:
 *   {
 *     _id, codigoCanonico,
 *     anioExcavacion, sitio, numeroFosa, codigoUF, numeroIndividuo,
 *     sexoEstimado?, edadEstimada?, observaciones?,
 *     revisionesPendientesCount: number,
 *     zonacion: { presente: boolean, metricas?: any, data?: any,
 *                 registrador?: string, fechaRegistro?: string,
 *                 revisionesPendientes?: any[] },
 *     eat:      { presente: boolean, metricas?: any, data?: any,
 *                 registrador?: string, fechaRegistro?: string },
 *   }
 */
export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const individuos = await ctx.db.query("individuos").collect();
    const fichas = await ctx.db.query("fichas").collect();

    // Índice en memoria: individuoId -> fichas (evita N+1).
    const porIndividuo = new Map<string, typeof fichas>();
    for (const f of fichas) {
      const k = f.individuoId as unknown as string;
      const arr = porIndividuo.get(k);
      if (arr) arr.push(f);
      else porIndividuo.set(k, [f]);
    }

    return individuos.map((ind) => {
      const fs = porIndividuo.get(ind._id as unknown as string) ?? [];
      const zon = fs.find((f) => f.tipo === "zonacion");
      const eat = fs.find((f) => f.tipo === "eat");
      const revisiones = Array.isArray(zon?.revisionesPendientes)
        ? zon!.revisionesPendientes
        : [];

      return {
        _id: ind._id,
        codigoCanonico: ind.codigoCanonico,
        anioExcavacion: ind.anioExcavacion,
        sitio: ind.sitio,
        numeroFosa: ind.numeroFosa,
        codigoUF: ind.codigoUF,
        numeroIndividuo: ind.numeroIndividuo,
        sexoEstimado: ind.sexoEstimado ?? null,
        edadEstimada: ind.edadEstimada ?? null,
        observaciones: ind.observaciones ?? null,
        revisionesPendientesCount: revisiones.length,
        zonacion: zon
          ? {
              presente: true,
              metricas: zon.metricas ?? null,
              data: zon.data ?? null,
              registrador: zon.registrador,
              fechaRegistro: zon.fechaRegistro,
              revisionesPendientes: revisiones,
            }
          : { presente: false },
        eat: eat
          ? {
              presente: true,
              metricas: eat.metricas ?? null,
              data: eat.data ?? null,
              registrador: eat.registrador,
              fechaRegistro: eat.fechaRegistro,
            }
          : { presente: false },
      };
    });
  },
});

/* ------------------------------------------------------------------ */
/*  Análisis poblacional — la batería completa del TFM                 */
/* ------------------------------------------------------------------ */

/** Versión del contrato del payload. Bump ante cualquier cambio de forma. */
export const POBLACIONAL_VERSION = "1.0.0";

/**
 * Query de SOLO LECTURA que devuelve TODA la estadística poblacional del TFM
 * (Tablas 1–7c) en un único payload.
 *
 * Reemplaza la "recorrida contra la planilla externa": cada número de acá está
 * pineado en `tests/stats-tfm.test.mjs` contra el TFM ya defendido.
 *
 * NO recalcula métricas individuales: lee las `metricas` persistidas por
 * `lib/metrics.ts` (única fuente de verdad) y delega TODO el cómputo en
 * `lib/poblacional.ts` + `lib/stats.ts`, que son puros y se testean offline.
 * Esta función solo hace I/O: dos `collect()` unidos en memoria (sin N+1).
 *
 * Alcance de los análisis (fidelidad al TFM):
 *   - Solo entran los individuos PAREADOS (con ficha de Zonación Y de EAT).
 *   - Tablas 1–6 sobre la muestra completa; `concordancia.controlSinExtremos`
 *     y todo `manosPiesVsNucleo` sobre la muestra sin los casos de completitud
 *     extrema (< `umbralCompletitudExtrema`), como declara la Tabla 7b.
 *
 * Args:
 *   sitio?                     filtra a un solo sitio (por defecto: total)
 *   umbralCompletitudExtrema?  % de completitud global por debajo del cual un
 *                              individuo cuenta como caso extremo (default 5)
 */
export const poblacional = query({
  args: {
    sitio: v.optional(v.string()),
    umbralCompletitudExtrema: v.optional(v.number()),
  },
  handler: async (ctx, { sitio, umbralCompletitudExtrema }) => {
    const individuos = sitio
      ? await ctx.db
          .query("individuos")
          .withIndex("by_sitio", (q) => q.eq("sitio", sitio))
          .collect()
      : await ctx.db.query("individuos").collect();

    const todasLasFichas = await ctx.db.query("fichas").collect();
    const porIndividuo = new Map<string, typeof todasLasFichas>();
    for (const f of todasLasFichas) {
      const k = f.individuoId as unknown as string;
      const arr = porIndividuo.get(k);
      if (arr) arr.push(f);
      else porIndividuo.set(k, [f]);
    }

    const filas = [];
    let soloZonacion = 0;
    let soloEat = 0;
    let sinFichas = 0;

    for (const ind of individuos) {
      const fs = porIndividuo.get(ind._id as unknown as string) ?? [];
      const zon = fs.find((f) => f.tipo === "zonacion");
      const eat = fs.find((f) => f.tipo === "eat");

      const fila = construirFila(
        {
          _id: ind._id as unknown as string,
          codigoCanonico: ind.codigoCanonico,
          sitio: ind.sitio,
          sexoEstimado: ind.sexoEstimado ?? null,
          edadEstimada: ind.edadEstimada ?? null,
        },
        (zon?.metricas ?? null) as ZonacionMetrics | null,
        (eat?.metricas ?? null) as EATMetrics | null,
      );

      if (fila) filas.push(fila);
      else if (zon && !eat) soloZonacion += 1;
      else if (eat && !zon) soloEat += 1;
      else sinFichas += 1;
    }

    const umbral = umbralCompletitudExtrema ?? UMBRAL_COMPLETITUD_EXTREMA;
    const analisis =
      filas.length >= 3
        ? analizarPoblacion(filas, { umbralCompletitudExtrema: umbral })
        : null;

    const porSitio = new Map<string, number>();
    for (const f of filas) porSitio.set(f.sitio, (porSitio.get(f.sitio) ?? 0) + 1);

    return {
      version: POBLACIONAL_VERSION,
      alcance: {
        sitio: sitio ?? null,
        umbralCompletitudExtrema: umbral,
      },
      denominadores: {
        zonacionTotal: ZONATION_TOTAL_ZONES,
        zonacionNucleo: ZONAS_NUCLEO,
        zonacionManosPies: ZONAS_MANOS_PIES,
      },
      muestra: {
        individuos: individuos.length,
        pareados: filas.length,
        soloZonacion,
        soloEat,
        sinFichas,
        porSitio: [...porSitio.entries()]
          .map(([s, n]) => ({ sitio: s, n }))
          .sort((a, b) => a.sitio.localeCompare(b.sitio, "es")),
        /** Los análisis requieren al menos 3 individuos pareados. */
        nSuficiente: filas.length >= 3,
      },
      analisis,
      /**
       * Fuente canónica "individuos + métricas": una fila por individuo
       * pareado, con la completitud ya partida en núcleo / manos+pies.
       * Es la tabla que `/datos`, `/planilla` y `/cobertura` pueden consumir
       * en lugar de sus tres backends actuales (ver el handoff).
       */
      individuos: filas.map((f) => ({
        individuoId: f.individuoId,
        codigo: f.codigo,
        sitio: f.sitio,
        sexo: f.sexo,
        edad: f.edad,
        zonasPresentes: f.zonasPresentes,
        zonasPorElemento: f.zonasPorElemento,
        completitudGlobal: stats.round(f.completitudGlobal, 2),
        completitudNucleo: stats.round(f.completitudNucleo, 2),
        completitudManosPies: stats.round(f.completitudManosPies, 2),
        ipo: f.ipo,
        ich: f.ich,
        eat: f.eat,
        afectacionZonacion: stats.round(100 - f.completitudGlobal, 1),
        ffiMedia: f.ffiMedia,
        alteraciones: f.alteraciones,
        fragmentos: f.fragmentos,
      })),
    };
  },
});
