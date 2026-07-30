import { query } from "./_generated/server";
import { ZONATION_ELEMENT_MAX, ZONATION_TOTAL_ZONES } from "./lib/metrics";
import type { EATMetrics, ZonacionMetrics } from "./lib/metrics";

/**
 * Cobertura de costillas y vértebras + planilla de totales por individuo y sitio.
 * ------------------------------------------------------------------------------
 * Query de SOLO LECTURA. NO recalcula métricas: lee las `metricas` ya guardadas
 * por `lib/metrics.ts` (única fuente de verdad) y solo cuenta las marcas crudas
 * de los grupos costillas / vértebras, que no están desagregadas en `metricas`.
 *
 * Qué significa "sin información" acá
 * ----------------------------------
 * Los formularios guardan las casillas como `{clave: boolean}` y solo persisten
 * lo que se tocó (una clave ausente y una clave en `false` son indistinguibles
 * en la base). Por lo tanto "sin información" = CERO marcas cargadas en ese
 * grupo. Con el modelo de datos actual NO se puede distinguir entre
 * "el elemento no se preservó" y "el elemento no se registró".
 * El indicador que sí discrimina es la DISCREPANCIA ENTRE MÉTODOS: si el EAT
 * registra costillas y la Zonación no (o viceversa) para el mismo individuo,
 * es casi seguro un vacío de registro y no una ausencia real.
 */

/* ------------------------------------------------------------------ */
/*  Denominadores                                                      */
/* ------------------------------------------------------------------ */

/** Zonación: denominadores canónicos, importados de lib/metrics.ts. */
export const ZON_MAX = {
  costillas: ZONATION_ELEMENT_MAX.rib_zones, // 72 = 12 costillas × 3 zonas × L/R
  vertebras: ZONATION_ELEMENT_MAX.vertebrae_zones, // 96 = 24 vértebras × 4 zonas
  sacro: ZONATION_ELEMENT_MAX.sacrum_zones, // 4 (elemento aparte del bloque vertebral)
  total: ZONATION_TOTAL_ZONES, // 635
} as const;

/**
 * EAT: denominadores de los grupos, espejo de `EATForm.tsx`
 * (Costillas 24 = 12 pares izq/der · Vértebras 32 = C1–C7, T1–T12, L1–L5,
 * S1–S5, Co1–Co3 — ojo: en el EAT el sacro y el cóccix VAN DENTRO de
 * "vértebras"; en Zonación el sacro es un elemento propio).
 */
export const EAT_MAX = {
  costillas: 24,
  vertebras: 32,
  ipoPuntos: 115, // EAT_IPO_MAX en lib/metrics.ts
} as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function countTrue(o: unknown): number {
  if (!o || typeof o !== "object") return 0;
  return Object.values(o as Record<string, unknown>).filter(Boolean).length;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

const pct = (n: number, max: number) => (max === 0 ? 0 : r1((n / max) * 100));

export interface Stats {
  n: number;
  media: number | null;
  mediana: number | null;
  min: number | null;
  max: number | null;
  de: number | null; // desvío estándar muestral
}

function stats(xs: number[]): Stats {
  const v = xs.filter((x) => Number.isFinite(x));
  const n = v.length;
  if (n === 0) return { n: 0, media: null, mediana: null, min: null, max: null, de: null };
  const media = v.reduce((a, b) => a + b, 0) / n;
  const s = [...v].sort((a, b) => a - b);
  const mediana = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  const de =
    n < 2 ? 0 : Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1));
  return {
    n,
    media: r2(media),
    mediana: r2(mediana),
    min: r2(s[0]),
    max: r2(s[n - 1]),
    de: r2(de),
  };
}

type Discrepancia = "solo-eat" | "solo-zonacion" | null;

/** Marca el grupo que aparece en un método y está vacío en el otro. */
function discrepancia(zon: number, eat: number, ambosPresentes: boolean): Discrepancia {
  if (!ambosPresentes) return null;
  if (zon === 0 && eat > 0) return "solo-eat";
  if (eat === 0 && zon > 0) return "solo-zonacion";
  return null;
}

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export const cobertura = query({
  args: {},
  handler: async (ctx) => {
    const individuos = await ctx.db.query("individuos").collect();
    const fichas = await ctx.db.query("fichas").collect();

    // Índice en memoria individuoId -> fichas (2 lecturas de tabla, sin N+1).
    const porIndividuo = new Map<string, typeof fichas>();
    for (const f of fichas) {
      const k = f.individuoId as unknown as string;
      const arr = porIndividuo.get(k);
      if (arr) arr.push(f);
      else porIndividuo.set(k, [f]);
    }

    const filas = individuos.map((ind) => {
      const fs = porIndividuo.get(ind._id as unknown as string) ?? [];
      const zonF = fs.find((f) => f.tipo === "zonacion");
      const eatF = fs.find((f) => f.tipo === "eat");

      const zd = (zonF?.data ?? {}) as Record<string, unknown>;
      const ed = (eatF?.data ?? {}) as Record<string, unknown>;
      const zm = zonF?.metricas as ZonacionMetrics | undefined;
      const em = eatF?.metricas as EATMetrics | undefined;

      // --- conteos crudos de los grupos bajo estudio ---
      const zCost = zonF ? countTrue(zd.rib_zones) : 0;
      const zVert = zonF ? countTrue(zd.vertebrae_zones) : 0;
      const zSacro = zonF ? countTrue(zd.sacrum_zones) : 0;
      const eCost = eatF ? countTrue(ed.costillas) : 0;
      const eVert = eatF ? countTrue(ed.vertebras) : 0;

      const ambos = Boolean(zonF && eatF);

      const vacios = {
        zonCostillas: Boolean(zonF) && zCost === 0,
        zonVertebras: Boolean(zonF) && zVert === 0,
        zonAmbos: Boolean(zonF) && zCost === 0 && zVert === 0,
        eatCostillas: Boolean(eatF) && eCost === 0,
        eatVertebras: Boolean(eatF) && eVert === 0,
        eatAmbos: Boolean(eatF) && eCost === 0 && eVert === 0,
      };
      // Vacío "en algún método": el grupo falta al menos en un método registrado.
      const costillasVacio = vacios.zonCostillas || vacios.eatCostillas;
      const vertebrasVacio = vacios.zonVertebras || vacios.eatVertebras;

      return {
        _id: ind._id,
        codigoCanonico: ind.codigoCanonico,
        sitio: ind.sitio,
        anioExcavacion: ind.anioExcavacion,
        numeroFosa: ind.numeroFosa,
        codigoUF: ind.codigoUF,
        numeroIndividuo: ind.numeroIndividuo,
        sexoEstimado: ind.sexoEstimado ?? null,
        edadEstimada: ind.edadEstimada ?? null,

        zonacion: {
          presente: Boolean(zonF),
          costillasZonas: zCost,
          costillasPct: pct(zCost, ZON_MAX.costillas),
          vertebrasZonas: zVert,
          vertebrasPct: pct(zVert, ZON_MAX.vertebras),
          sacroZonas: zSacro,
          completitudGlobal: zm?.completitudGlobal ?? null,
          zonasPresentes: zm?.zonasPresentes ?? null,
          elementosPresentes: zm?.elementosPresentes ?? null,
          ffiMedia: zm?.ffi?.media ?? null,
          alteraciones: zm?.alteracionesCount ?? null,
          fragmentos: zm?.fragmentosCount ?? null,
        },
        eat: {
          presente: Boolean(eatF),
          costillasN: eCost,
          costillasPct: pct(eCost, EAT_MAX.costillas),
          vertebrasN: eVert,
          vertebrasPct: pct(eVert, EAT_MAX.vertebras),
          ipo: em?.ipo ?? null,
          ich: em?.ich ?? null,
          eat: em?.eat ?? null,
          totalPresent: em?.totalPresent ?? null,
        },

        vacios: { ...vacios, costillasVacio, vertebrasVacio },
        // Vacío en los DOS grupos a la vez, dentro del mismo método.
        ambosGruposVacios: vacios.zonAmbos || vacios.eatAmbos,
        algunVacio: costillasVacio || vertebrasVacio,
        discrepancias: {
          costillas: discrepancia(zCost, eCost, ambos),
          vertebras: discrepancia(zVert, eVert, ambos),
        },
      };
    });

    type Fila = (typeof filas)[number];

    /** Agregado por conjunto de individuos (un sitio, o toda la muestra). */
    function agregar(sitio: string, rs: Fila[]) {
      const zon = rs.filter((r) => r.zonacion.presente);
      const eat = rs.filter((r) => r.eat.presente);
      const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

      const zonasPresentes = sum(zon.map((r) => r.zonacion.zonasPresentes ?? 0));
      const zonasPosibles = zon.length * ZON_MAX.total;
      const zCostTotal = sum(zon.map((r) => r.zonacion.costillasZonas));
      const zVertTotal = sum(zon.map((r) => r.zonacion.vertebrasZonas));
      const puntosEat = sum(eat.map((r) => r.eat.totalPresent ?? 0));
      const puntosPosibles = eat.length * EAT_MAX.ipoPuntos;
      const eCostTotal = sum(eat.map((r) => r.eat.costillasN));
      const eVertTotal = sum(eat.map((r) => r.eat.vertebrasN));

      return {
        sitio,
        n: rs.length,
        conZonacion: zon.length,
        conEat: eat.length,
        pareados: rs.filter((r) => r.zonacion.presente && r.eat.presente).length,

        zonacion: {
          // Promedio de los % individuales (cada individuo pesa igual).
          completitud: stats(zon.map((r) => r.zonacion.completitudGlobal ?? NaN)),
          // Agregado: suma de zonas presentes / suma de zonas posibles.
          zonasPresentes,
          zonasPosibles,
          completitudAgregada: pct(zonasPresentes, zonasPosibles),
          costillasZonas: zCostTotal,
          costillasPosibles: zon.length * ZON_MAX.costillas,
          costillasPctAgregado: pct(zCostTotal, zon.length * ZON_MAX.costillas),
          vertebrasZonas: zVertTotal,
          vertebrasPosibles: zon.length * ZON_MAX.vertebras,
          vertebrasPctAgregado: pct(zVertTotal, zon.length * ZON_MAX.vertebras),
          ffiMedia: stats(
            zon.map((r) => r.zonacion.ffiMedia).filter((x): x is number => x !== null),
          ),
        },
        eat: {
          ipo: stats(eat.map((r) => r.eat.ipo ?? NaN)),
          ich: stats(eat.map((r) => r.eat.ich ?? NaN)),
          eat: stats(eat.map((r) => r.eat.eat ?? NaN)),
          // Agregado de PRESENCIA (IPO). No se agrega el EAT con la fórmula
          // multiplicativa a nivel sitio: el EAT está definido por individuo
          // (EAT = 100 − IPO×ICH/100) y aplicarla a promedios no es el mismo
          // estadístico. Para el sitio se reportan media/mediana de los EAT.
          puntos: r2(puntosEat),
          puntosPosibles,
          ipoAgregado: pct(puntosEat, puntosPosibles),
          costillasN: eCostTotal,
          costillasPosibles: eat.length * EAT_MAX.costillas,
          costillasPctAgregado: pct(eCostTotal, eat.length * EAT_MAX.costillas),
          vertebrasN: eVertTotal,
          vertebrasPosibles: eat.length * EAT_MAX.vertebras,
          vertebrasPctAgregado: pct(eVertTotal, eat.length * EAT_MAX.vertebras),
        },
        vacios: {
          zonCostillas: rs.filter((r) => r.vacios.zonCostillas).length,
          zonVertebras: rs.filter((r) => r.vacios.zonVertebras).length,
          zonAmbos: rs.filter((r) => r.vacios.zonAmbos).length,
          eatCostillas: rs.filter((r) => r.vacios.eatCostillas).length,
          eatVertebras: rs.filter((r) => r.vacios.eatVertebras).length,
          eatAmbos: rs.filter((r) => r.vacios.eatAmbos).length,
          costillas: rs.filter((r) => r.vacios.costillasVacio).length,
          vertebras: rs.filter((r) => r.vacios.vertebrasVacio).length,
          ambosGrupos: rs.filter((r) => r.ambosGruposVacios).length,
          alguno: rs.filter((r) => r.algunVacio).length,
        },
        discrepancias: {
          costillas: rs.filter((r) => r.discrepancias.costillas !== null).length,
          vertebras: rs.filter((r) => r.discrepancias.vertebras !== null).length,
        },
      };
    }

    const nombresSitio = [...new Set(filas.map((r) => r.sitio))].sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true }),
    );
    const sitios = nombresSitio.map((s) =>
      agregar(
        s,
        filas.filter((r) => r.sitio === s),
      ),
    );

    return {
      denominadores: { zonacion: ZON_MAX, eat: EAT_MAX },
      individuos: filas,
      sitios,
      total: agregar("TOTAL", filas),
    };
  },
});
