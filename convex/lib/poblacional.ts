/**
 * Capa poblacional — de `fichas.metricas` a la batería del TFM.
 * ==============================================================
 * Funciones PURAS (solo importa `./metrics` y `./stats`, sin Convex), así que
 * todo el análisis se puede correr y testear offline. `convex/analisis.ts` se
 * limita a leer las dos tablas y delegar acá.
 *
 * 🔒 NO recalcula métricas individuales. IPO, ICH, EAT, completitud global y
 * completitud por elemento vienen YA calculadas y persistidas por
 * `lib/metrics.ts` (única fuente de verdad). Lo único que se deriva acá es la
 * partición núcleo / manos+pies del denominador de zonación, que el TFM usa y
 * la app no guardaba (ver `zonasPorElemento` más abajo).
 *
 * Correspondencia con el TFM ("Estudio comparativo de metodologías
 * cuantitativas para el análisis tafonómico de restos óseos humanos"):
 *
 *   Tabla 1   → `descriptivos`
 *   Tabla 2   → `ichPorSitio`
 *   Tabla 3   → `concordancia.global`     (zonación /635 vs IPO)
 *   Tabla 4   → `concordancia.nucleo`     (zonación /363 vs IPO)
 *   Tabla 4b  → `concordancia.controlSinExtremos`  ("Casos extremos", n=60)
 *   Tabla 5   → `relacionEatIpoIch`
 *   Tabla 6   → `variabilidadPorSitio`
 *   Tabla 7   → `porElemento` + `corticalVsEsponjoso`
 *   Tabla 7b  → `manosPiesVsNucleo`
 *   Tabla 7c  → `manosPiesVsNucleo.wilcoxonPorSitio`
 */

import { ZONATION_ELEMENT_MAX, ZONATION_TOTAL_ZONES } from "./metrics";
import type { EATMetrics, ZonacionMetrics } from "./metrics";
import * as S from "./stats";

/* ================================================================== */
/*  Particiones anatómicas del denominador de zonación                 */
/* ================================================================== */

/**
 * Elementos que el TFM agrupa como "manos + pies".
 * ⚠️ La RÓTULA NO va acá: es elemento propio de Zonación desde la corrección
 * metodológica 2026-06 (ver `lib/metrics.ts`, principio rector de fidelidad).
 */
export const ELEMENTOS_MANOS_PIES = ["hand_zones", "foot_zones"] as const;

/** Elementos del "núcleo": todo el esqueleto MENOS manos y pies. */
export const ELEMENTOS_NUCLEO = Object.keys(ZONATION_ELEMENT_MAX).filter(
  (k) => !(ELEMENTOS_MANOS_PIES as readonly string[]).includes(k),
);

/** 363 = 635 − 130 (mano) − 142 (pie). Es el denominador "núcleo" del TFM. */
export const ZONAS_NUCLEO = ELEMENTOS_NUCLEO.reduce(
  (a, k) => a + ZONATION_ELEMENT_MAX[k],
  0,
);

/** 272 = 130 + 142. */
export const ZONAS_MANOS_PIES = (ELEMENTOS_MANOS_PIES as readonly string[]).reduce(
  (a, k) => a + ZONATION_ELEMENT_MAX[k],
  0,
);

/** Etiqueta legible por clave de elemento (la que usa la Tabla 7 del TFM). */
export const ELEMENTO_ETIQUETA: Record<string, string> = {
  cranium_zones: "Cráneo",
  mandible_zones: "Mandíbula",
  vertebrae_zones: "Vértebras",
  sacrum_zones: "Sacro",
  sternum_zones: "Esternón",
  clavicle_zones: "Clavícula",
  rib_zones: "Costillas",
  scapula_zones: "Escápula",
  humerus_zones: "Húmero",
  radius_zones: "Radio",
  ulna_zones: "Cúbito",
  os_coxae_zones: "Coxal",
  femur_zones: "Fémur",
  tibia_zones: "Tibia",
  fibula_zones: "Peroné",
  hand_zones: "Mano",
  foot_zones: "Pie",
  patella_zones: "Rótula",
};

/**
 * Tejido predominante por elemento — la agrupación del Resultado 5 del TFM.
 *
 * "cortical" = hueso cortical compacto (diáfisis de huesos largos + clavícula +
 * mandíbula). "esponjoso" = trabecular o de paredes finas.
 * Es la hipótesis direccional que contrasta el Mann-Whitney (U=70; p=0,0031 a
 * una cola): se espera que el cortical se preserve mejor.
 */
export const TEJIDO_POR_ELEMENTO: Record<string, "cortical" | "esponjoso"> = {
  humerus_zones: "cortical",
  radius_zones: "cortical",
  ulna_zones: "cortical",
  femur_zones: "cortical",
  tibia_zones: "cortical",
  fibula_zones: "cortical",
  clavicle_zones: "cortical",
  mandible_zones: "cortical",
  vertebrae_zones: "esponjoso",
  rib_zones: "esponjoso",
  sternum_zones: "esponjoso",
  sacrum_zones: "esponjoso",
  os_coxae_zones: "esponjoso",
  scapula_zones: "esponjoso",
  cranium_zones: "esponjoso",
  patella_zones: "esponjoso",
  hand_zones: "esponjoso",
  foot_zones: "esponjoso",
};

/**
 * Umbral (en % de completitud global) por debajo del cual un individuo se
 * considera "caso extremo". El TFM excluye con este criterio a I12 e I36 de
 * Castellón (completitud 2,2 % y 3,0 %) en el control de las Tablas 3/4 y en
 * TODA la Tabla 7b/7c — de ahí el `n=32*` de Castellón.
 */
export const UMBRAL_COMPLETITUD_EXTREMA = 5;

/* ================================================================== */
/*  Fila poblacional                                                   */
/* ================================================================== */

export interface FilaPoblacional {
  individuoId: string;
  codigo: string;
  sitio: string;
  sexo: string | null;
  edad: string | null;

  /** Zonas presentes por elemento, reconstruidas (ver `construirFila`). */
  zonasPorElemento: Record<string, number>;
  zonasPresentes: number;
  /** % sobre las 635 zonas. Viene tal cual de `metricas.completitudGlobal`. */
  completitudGlobal: number;
  /** % sobre las 363 zonas del núcleo (derivado acá). */
  completitudNucleo: number;
  /** % sobre las 272 zonas de manos + pies (derivado acá). */
  completitudManosPies: number;

  ipo: number;
  ich: number;
  eat: number;

  ffiMedia: number | null;
  alteraciones: number;
  fragmentos: number;

  /**
   * `false` si la reconstrucción de zonas por elemento NO suma el
   * `zonasPresentes` persistido — ver la nota de `construirFila`. Se propaga al
   * payload como diagnóstico en vez de devolver números silenciosamente malos.
   */
  reconstruccionCoherente: boolean;
}

export interface IndividuoBase {
  _id: string;
  codigoCanonico: string;
  sitio: string;
  sexoEstimado?: string | null;
  edadEstimada?: string | null;
}

/**
 * Arma la fila poblacional de un individuo a partir de sus dos fichas.
 * Devuelve `null` si al individuo le falta alguna de las dos métricas (los
 * análisis del TFM son todos sobre individuos PAREADOS).
 *
 * Reconstrucción de zonas por elemento
 * ------------------------------------
 * `metricas.completitudPorElemento` guarda PORCENTAJES redondeados a 1 decimal,
 * no conteos. El conteo se recupera con `round(pct · max / 100)`: el error de
 * redondeo del porcentaje es ≤ 0,05 %, que sobre el denominador más grande
 * (pie, 142 zonas) da ≤ 0,071 zonas — muy por debajo del medio punto que haría
 * fallar el redondeo. Se verifica igual contra el `zonasPresentes` persistido
 * (`reconstruccionCoherente`).
 *
 * TODO (Dante): persistir `zonasPorElemento` en `metricas` haría innecesaria la
 * reconstrucción. Es aditivo y no rompe nada; queda para el schema v3.1.
 */
export function construirFila(
  ind: IndividuoBase,
  zon: ZonacionMetrics | null | undefined,
  eat: EATMetrics | null | undefined,
): FilaPoblacional | null {
  if (!zon || !eat) return null;
  if (typeof zon.completitudGlobal !== "number" || typeof eat.ipo !== "number") return null;

  const cpe = zon.completitudPorElemento ?? {};
  const zonasPorElemento: Record<string, number> = {};
  let suma = 0;
  for (const [clave, max] of Object.entries(ZONATION_ELEMENT_MAX)) {
    const n = Math.round(((cpe[clave] ?? 0) * max) / 100);
    zonasPorElemento[clave] = n;
    suma += n;
  }
  const nucleo = ELEMENTOS_NUCLEO.reduce((a, k) => a + zonasPorElemento[k], 0);
  const manosPies = (ELEMENTOS_MANOS_PIES as readonly string[]).reduce(
    (a, k) => a + zonasPorElemento[k],
    0,
  );

  return {
    individuoId: ind._id,
    codigo: ind.codigoCanonico,
    sitio: ind.sitio,
    sexo: ind.sexoEstimado ?? null,
    edad: ind.edadEstimada ?? null,
    zonasPorElemento,
    zonasPresentes: zon.zonasPresentes,
    completitudGlobal: zon.completitudGlobal,
    completitudNucleo: (nucleo / ZONAS_NUCLEO) * 100,
    completitudManosPies: (manosPies / ZONAS_MANOS_PIES) * 100,
    ipo: eat.ipo,
    ich: eat.ich,
    eat: eat.eat,
    ffiMedia: zon.ffi?.media ?? null,
    alteraciones: zon.alteracionesCount ?? 0,
    fragmentos: zon.fragmentosCount ?? 0,
    reconstruccionCoherente: suma === zon.zonasPresentes,
  };
}

/* ================================================================== */
/*  Tipos del payload                                                  */
/* ================================================================== */

export interface Concordancia {
  n: number;
  denominador: number;
  rPearson: number | null;
  cccLin: number | null;
  sesgo: number | null;
  deDiferencias: number | null;
  loaInferior: number | null;
  loaSuperior: number | null;
  amplitudLoA95: number | null;
  pendiente: number | null;
  pendienteP: number | null;
  discrepanciaMaximaAbs: number | null;
}

export interface FilaElemento {
  clave: string;
  etiqueta: string;
  zonasMaximas: number;
  /** % que este elemento representa del denominador total (635). */
  pctDelDenominador: number;
  completitudMedia: number;
  pctEn0: number;
  pctEn100: number;
  tejido: "cortical" | "esponjoso";
}

export interface WilcoxonSitio {
  sitio: string;
  n: number;
  manosPiesMedia: number;
  nucleoMedia: number;
  /** Brecha en puntos porcentuales (manos+pies − núcleo). */
  brechaPp: number;
  p: number;
  exacto: boolean;
  individuosManosPiesMayor: number;
}

export interface OpcionesPoblacional {
  /** Umbral de completitud global para marcar "caso extremo". */
  umbralCompletitudExtrema?: number;
  /** Decimales de redondeo del payload (presentación). */
  decimales?: number;
}

/* ================================================================== */
/*  Análisis                                                           */
/* ================================================================== */

const noNulo = <T>(x: T | null | undefined): x is T => x !== null && x !== undefined;

function concordancia(
  x: readonly number[],
  y: readonly number[],
  denominador: number,
  r: (n: number | null) => number | null,
): Concordancia {
  const ba = S.blandAltman(x, y);
  return {
    n: x.length,
    denominador,
    rPearson: r(S.pearson(x, y)),
    cccLin: r(S.ccc(x, y)),
    sesgo: r(ba && ba.sesgo),
    deDiferencias: r(ba && ba.deDiferencias),
    loaInferior: r(ba && ba.loaInferior),
    loaSuperior: r(ba && ba.loaSuperior),
    amplitudLoA95: r(ba && ba.amplitudLoA95),
    pendiente: r(ba && ba.pendiente),
    pendienteP: ba ? S.round(ba.pendienteP, 6) : null,
    discrepanciaMaximaAbs: r(ba && ba.discrepanciaMaximaAbs),
  };
}

/**
 * Corre TODA la batería del TFM sobre un conjunto de filas poblacionales.
 *
 * Nota sobre el alcance de cada bloque (fidelidad al TFM):
 *   - Tablas 1–6 se calculan sobre la muestra COMPLETA.
 *   - `concordancia.controlSinExtremos` y TODO `manosPiesVsNucleo` se calculan
 *     sobre la muestra SIN los casos extremos (completitud < umbral), que es lo
 *     que el TFM hace y declara con el asterisco de la Tabla 7b.
 */
export function analizarPoblacion(
  filas: readonly FilaPoblacional[],
  opciones: OpcionesPoblacional = {},
) {
  const umbral = opciones.umbralCompletitudExtrema ?? UMBRAL_COMPLETITUD_EXTREMA;
  const dec = opciones.decimales ?? 4;
  /**
   * Redondeo seguro para el payload. El `Number.isFinite` NO es decorativo:
   * Convex no serializa `NaN` ni `Infinity`, así que un caso degenerado
   * (grupo vacío, varianza cero) tiene que salir como `null` y no reventar la
   * query entera en runtime.
   */
  const r = (n: number | null | undefined | false): number | null =>
    typeof n === "number" && Number.isFinite(n) ? S.round(n, dec) : null;

  const sitios = [...new Set(filas.map((f) => f.sitio))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const col = (fs: readonly FilaPoblacional[], k: keyof FilaPoblacional) =>
    fs.map((f) => f[k] as number);

  const extremos = filas.filter((f) => f.completitudGlobal < umbral);
  const sinExtremos = filas.filter((f) => f.completitudGlobal >= umbral);

  const desc = (fs: readonly FilaPoblacional[], k: keyof FilaPoblacional) => {
    const d = S.descriptivos(col(fs, k));
    return { n: d.n, media: r(d.media), de: r(d.de), mediana: r(d.mediana), min: r(d.min), max: r(d.max) };
  };

  /* ---- Tabla 1 — descriptivos globales ------------------------------ */
  const descriptivos = {
    completitudGlobal: desc(filas, "completitudGlobal"),
    completitudNucleo: desc(filas, "completitudNucleo"),
    completitudManosPies: desc(filas, "completitudManosPies"),
    ipo: desc(filas, "ipo"),
    ich: desc(filas, "ich"),
    eat: desc(filas, "eat"),
  };

  /* ---- Tabla 2 — ICH por sitio -------------------------------------- */
  const ichPorSitio = sitios.map((s) => {
    const fs = filas.filter((f) => f.sitio === s);
    const d = S.descriptivos(col(fs, "ich"));
    return { sitio: s, n: d.n, media: r(d.media), de: r(d.de) };
  });

  /* ---- Tablas 3, 4 y control de casos extremos ---------------------- */
  const ipo = col(filas, "ipo");
  const concordanciaBloque = {
    /** Tabla 3 — zonación sobre las 635 zonas vs IPO. */
    global: concordancia(col(filas, "completitudGlobal"), ipo, ZONATION_TOTAL_ZONES, r),
    /** Tabla 4 — zonación sobre el núcleo /363 vs IPO. */
    nucleo: concordancia(col(filas, "completitudNucleo"), ipo, ZONAS_NUCLEO, r),
    /** Control publicado: los mismos cálculos excluyendo los casos extremos. */
    controlSinExtremos: {
      criterio: `completitud global >= ${umbral}%`,
      excluidos: extremos.map((f) => ({
        codigo: f.codigo,
        sitio: f.sitio,
        completitudGlobal: r(f.completitudGlobal),
      })),
      global: concordancia(
        col(sinExtremos, "completitudGlobal"),
        col(sinExtremos, "ipo"),
        ZONATION_TOTAL_ZONES,
        r,
      ),
      nucleo: concordancia(
        col(sinExtremos, "completitudNucleo"),
        col(sinExtremos, "ipo"),
        ZONAS_NUCLEO,
        r,
      ),
    },
  };

  /* ---- Tabla 5 — relación algebraica y empírica EAT / IPO / ICH ----- */
  const ich = col(filas, "ich");
  const eat = col(filas, "eat");
  const difAlgebraica = filas.map((f) => f.eat - (100 - f.ipo));
  const regIpo = S.regresionLineal(ipo, eat);
  const regIch = S.regresionLineal(ich, eat);
  const regConjunta = S.regresionMultiple([ipo, ich], eat);
  const eatMedio = S.mean(eat);
  const relacionEatIpoIch = {
    n: filas.length,
    /** Cuánto desplaza el ICH al EAT respecto de la pura presencia ósea. */
    diferenciaMediaEatVsPresencia: r(S.mean(difAlgebraica)),
    deDiferencia: r(S.sd(difAlgebraica)),
    pctDelEatMedio: eatMedio === 0 ? null : r((S.mean(difAlgebraica) / eatMedio) * 100),
    /** ⚠️ SPEARMAN: el ICH es semicuantitativo (Pearson da 0,872, no 0,827). */
    rhoIchIpo: r(S.spearman(ich, ipo)),
    /** Pearson del mismo par, expuesto solo como contraste metodológico. */
    rPearsonIchIpo: r(S.pearson(ich, ipo)),
    r2EatPorIpo: r(regIpo && regIpo.r2),
    r2EatPorIch: r(regIch && regIch.r2),
    r2Conjunto: r(regConjunta && regConjunta.r2),
    incrementoR2: r(regConjunta && regIpo ? regConjunta.r2 - regIpo.r2 : null),
    coeficientesConjunta: regConjunta
      ? {
          intercepto: r(regConjunta.interseccion),
          ipo: r(regConjunta.coeficientes[0]),
          ich: r(regConjunta.coeficientes[1]),
        }
      : null,
  };

  /* ---- Tabla 6 — Kruskal-Wallis por sitio --------------------------- */
  const kwDe = (fs: readonly FilaPoblacional[], k: keyof FilaPoblacional) =>
    S.kruskalWallis(
      sitios.map((s) => ({
        etiqueta: s,
        valores: fs.filter((f) => f.sitio === s).map((f) => f[k] as number),
      })),
    );
  const empaquetarKw = (variable: string, kw: ReturnType<typeof S.kruskalWallis>) =>
    kw === null
      ? null
      : {
          variable,
          n: kw.n,
          k: kw.k,
          H: r(kw.H),
          gl: kw.gl,
          p: S.round(kw.p, 8),
          etaCuadradoH: r(kw.etaCuadradoH),
          grupos: kw.grupos.map((g) => ({ ...g, rangoMedio: r(g.rangoMedio) })),
        };

  const variabilidadPorSitio = (
    [
      ["ich", "ich"],
      ["eat", "eat"],
      ["ipo", "ipo"],
      ["completitudNucleo", "completitudNucleo"],
      ["completitudGlobal", "completitudGlobal"],
    ] as const
  )
    .map(([nombre, k]) => empaquetarKw(nombre, kwDe(filas, k)))
    .filter(noNulo);

  /* ---- Tabla 7 — completitud media por elemento --------------------- */
  const porElemento: FilaElemento[] = Object.entries(ZONATION_ELEMENT_MAX)
    .map(([clave, max]) => {
      const pcts = filas.map((f) => (f.zonasPorElemento[clave] / max) * 100);
      return {
        clave,
        etiqueta: ELEMENTO_ETIQUETA[clave] ?? clave,
        zonasMaximas: max,
        pctDelDenominador: S.round((max / ZONATION_TOTAL_ZONES) * 100, 1),
        completitudMedia: S.round(pcts.length ? S.mean(pcts) : 0, dec),
        pctEn0: S.round(S.proporcionIgualA(pcts, 0) * 100, 1),
        pctEn100: S.round(S.proporcionIgualA(pcts, 100) * 100, 1),
        tejido: TEJIDO_POR_ELEMENTO[clave],
      };
    })
    .sort((a, b) => a.completitudMedia - b.completitudMedia);

  const corticales = porElemento.filter((e) => e.tejido === "cortical").map((e) => e.completitudMedia);
  const esponjosos = porElemento.filter((e) => e.tejido === "esponjoso").map((e) => e.completitudMedia);
  const mw = S.mannWhitney(corticales, esponjosos);
  const corticalVsEsponjoso = mw && {
    nCortical: mw.n1,
    nEsponjoso: mw.n2,
    mediaCortical: r(S.mean(corticales)),
    mediaEsponjoso: r(S.mean(esponjosos)),
    U: mw.U,
    /** Direccional: se hipotetiza que el cortical se preserva mejor. */
    pUnaCola: S.round(mw.pUnaCola, 6),
    pDosColas: S.round(mw.pDosColas, 6),
    exacto: mw.exacto,
  };

  /* ---- Tablas 7b y 7c — manos+pies vs núcleo ------------------------ */
  /* Sobre `sinExtremos`, tal como el TFM (asterisco de la Tabla 7b). */
  const wilcoxonPorSitio: WilcoxonSitio[] = sitios
    .map((s) => {
      const fs = sinExtremos.filter((f) => f.sitio === s);
      const mp = fs.map((f) => f.completitudManosPies);
      const nu = fs.map((f) => f.completitudNucleo);
      const w = S.wilcoxonSignedRank(mp, nu);
      if (!w) return null;
      return {
        sitio: s,
        n: fs.length,
        manosPiesMedia: S.round(S.mean(mp), dec),
        nucleoMedia: S.round(S.mean(nu), dec),
        brechaPp: S.round(w.diferenciaMedia, dec),
        p: S.round(w.p, 8),
        exacto: w.exacto,
        individuosManosPiesMayor: w.aMayorQueB,
      };
    })
    .filter(noNulo);

  const manosPiesVsNucleo = {
    criterio: `completitud global >= ${umbral}%`,
    n: sinExtremos.length,
    /* Las medias globales del bloque "Grupo / Completitud media" sí van sobre
       la muestra completa: es el resumen de la Tabla 7, no de la 7b. */
    globalManosPies: r(S.mean(col(filas, "completitudManosPies"))),
    globalNucleo: r(S.mean(col(filas, "completitudNucleo"))),
    kruskalWallisManosPies: empaquetarKw(
      "completitudManosPies",
      kwDe(sinExtremos, "completitudManosPies"),
    ),
    kruskalWallisNucleo: empaquetarKw(
      "completitudNucleo",
      kwDe(sinExtremos, "completitudNucleo"),
    ),
    wilcoxonPorSitio,
  };

  /* ---- Correlaciones H1–H3 (las 4 Spearman históricas) -------------- */
  /* Mismo contenido que `analisis.comparacion.correlaciones`, con el mismo
     redondeo a 3 decimales, para que la UI pueda migrar sin cambiar números. */
  const r3 = (n: number | null) => (n === null ? null : S.round(n, 3));
  const afectacion = filas.map((f) => S.round(100 - f.completitudGlobal, 1));
  const conFfi = filas.filter((f) => f.ffiMedia !== null);
  const correlaciones = {
    ipo_vs_completitud: r3(S.spearman(ipo, col(filas, "completitudGlobal"))),
    eat_vs_afectacionZonacion: r3(S.spearman(eat, afectacion)),
    ich_vs_completitud: r3(S.spearman(ich, col(filas, "completitudGlobal"))),
    ich_vs_ffi: r3(
      S.spearman(
        conFfi.map((f) => f.ich),
        conFfi.map((f) => f.ffiMedia as number),
      ),
    ),
  };

  return {
    descriptivos,
    ichPorSitio,
    concordancia: concordanciaBloque,
    relacionEatIpoIch,
    variabilidadPorSitio,
    porElemento,
    corticalVsEsponjoso,
    manosPiesVsNucleo,
    correlaciones,
    diagnostico: {
      filasConReconstruccionIncoherente: filas.filter((f) => !f.reconstruccionCoherente)
        .length,
      codigosIncoherentes: filas.filter((f) => !f.reconstruccionCoherente).map((f) => f.codigo),
    },
  };
}

export type AnalisisPoblacional = ReturnType<typeof analizarPoblacion>;
