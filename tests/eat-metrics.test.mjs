/**
 * EAT — partición estricta de unidades anatómicas (SDD §3.2 · §4 verificación 1, 2, 4).
 * =====================================================================================
 * Fuente: Serrulla & Vázquez (2019). Evidencia: `sources/VALIDACION-METODOLOGICA.md` §A.1.
 *
 * Se testea a través de `computeEAT` (la función pública) y no de `handPoints` /
 * `footPoints` (privadas): lo que tiene que ser correcto es el resultado que se
 * persiste, no el detalle interno.
 *
 * Truco de los fixtures: `totalPresent` es exactamente la suma de huesos simples
 * (1 c/u) + los puntos ponderados de mano/pie, así que un fixture con SOLO una
 * extremidad mide los puntos de esa extremidad directamente.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  computeEAT,
  computeMetrics,
  EAT_IPO_MAX,
  EAT_UNIT_PARTITION_VERSION,
} from "../convex/lib/metrics.ts";
import {
  MANO_TOTAL_BONES,
  PIE_TOTAL_BONES,
  normalizeEatUnits,
} from "../convex/lib/eatUnits.ts";

/* ── fixtures ──────────────────────────────────────────────────────────────── */

const MANO_COMPLETA = {
  carpianos: 8,
  metacarpianos: 5,
  falProximales: 5,
  falMedias: 4,
  falDistales: 5,
};
const PIE_COMPLETO = {
  calcaneo: 1,
  astragalo: 1,
  restoTarso: 5,
  metatarsianos: 5,
  falProx: 5,
  falMedias: 4,
  falDistales: 5,
};
const MANO_VACIA = { carpianos: 0, metacarpianos: 0, falProximales: 0, falMedias: 0, falDistales: 0 };
const PIE_VACIO = {
  calcaneo: 0,
  astragalo: 0,
  restoTarso: 0,
  metatarsianos: 0,
  falProx: 0,
  falMedias: 0,
  falDistales: 0,
};

/** `n` claves `true` (los grupos de checkbox cuentan 1 por hueso presente). */
const marcar = (prefijo, n) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefijo}${i}`, true]));

/** Calidad uniforme para los grupos indicados. */
const calidad = (valor, grupos) =>
  Object.fromEntries(grupos.map((g) => [g, { value: valor, obs: "" }]));

/* ── 1. La fórmula: los tres ejemplos publicados ───────────────────────────── */

describe("fórmula EAT = 100 − (IPO × ICH)/100 (🔒 invariante #1, multiplicativa)", () => {
  /**
   * IPO = 59,00 exacto: totalPresent = 67,85 = 115 × 0,59.
   *   66 huesos simples (18 cráneo + 32 vértebras + 14 largos + mandíbula + hioides)
   *   + metacarpianos 5/5 = 1,00
   *   + carpianos 6/8      = 0,75
   *   + falanges de pie 1/10 = 0,10
   * Grupos con presencia: cráneo, vértebras, largos, mandíbula, hioides, manos, pies (7).
   */
  const ipo59 = (ich) => ({
    craneo: marcar("cr", 18),
    vertebras: marcar("v", 32),
    huesosLargos: marcar("hl", 14),
    huesosPlanos: {},
    costillas: {},
    mandibula: true,
    hioides: true,
    manoDer: { ...MANO_VACIA, carpianos: 6, metacarpianos: 5 },
    manoIzq: { ...MANO_VACIA },
    pieDer: { ...PIE_VACIO, falProx: 1 },
    pieIzq: { ...PIE_VACIO },
    quality: calidad(ich, [
      "craneo",
      "vertebras",
      "huesosLargos",
      "mandibula",
      "hioides",
      "manos",
      "pies",
    ]),
  });

  test("Gráfico 1 — IPO 59 % × ICH 75 % → EAT 56 %", () => {
    const m = computeEAT(ipo59(75));
    assert.equal(m.totalPresent, 67.85);
    assert.equal(m.ipo, 59);
    assert.equal(m.ich, 75);
    assert.equal(m.eat, 55.75);
    assert.equal(Math.round(m.eat), 56); // el valor publicado, en entero
  });

  test("Gráfico 2 — IPO 59 % × ICH 84 % → EAT 50 %", () => {
    const m = computeEAT(ipo59(84));
    assert.equal(m.ipo, 59);
    assert.equal(m.ich, 84);
    assert.equal(m.eat, 50.44);
    assert.equal(Math.round(m.eat), 50);
  });

  test("Gráfico 5 — IPO 16 % × ICH 80 % → EAT 87 %", () => {
    // totalPresent = 18,4 = 115 × 0,16 → 18 huesos de cráneo + metacarpianos 2/5 = 0,40.
    const data = {
      craneo: marcar("cr", 18),
      manoDer: { ...MANO_VACIA, metacarpianos: 2 },
      quality: calidad(80, ["craneo", "manos"]),
    };
    const m = computeEAT(data);
    assert.equal(m.totalPresent, 18.4);
    assert.equal(m.ipo, 16);
    assert.equal(m.ich, 80);
    assert.equal(m.eat, 87.2);
    assert.equal(Math.round(m.eat), 87);
  });

  test("EAT nunca es el promedio aditivo", () => {
    const m = computeEAT(ipo59(75));
    const promedioAditivo = (m.ipo + m.ich) / 2; // 67 — el bug histórico
    assert.notEqual(m.eat, promedioAditivo);
    assert.equal(m.eat, Math.round((100 - (m.ipo * m.ich) / 100) * 100) / 100);
  });
});

/* ── 2. Las unidades anatómicas ────────────────────────────────────────────── */

describe("unidades anatómicas de MANO — 4 U.A., máx 4 pts/mano", () => {
  const pts = (mano) => computeEAT({ manoDer: mano }).totalPresent;

  test("mano completa → 4,00 pts", () => {
    assert.equal(pts(MANO_COMPLETA), 4);
  });

  test("mano vacía → 0,00 pts", () => {
    assert.equal(pts(MANO_VACIA), 0);
  });

  test("U.A.3 = falanges PROXIMALES solas, /5", () => {
    // 2/5 = 0,40 — el coeficiente del Gráfico 3 de la fuente.
    assert.equal(pts({ ...MANO_VACIA, falProximales: 2 }), 0.4);
    assert.equal(pts({ ...MANO_VACIA, falProximales: 5 }), 1);
  });

  test("U.A.4 = falanges MEDIAS + DISTALES juntas, /9", () => {
    // 2/9 = 0,22 — el otro coeficiente del Gráfico 3 (totalPresent viene redondeado a 2 decimales).
    assert.equal(pts({ ...MANO_VACIA, falMedias: 2 }), 0.22);
    assert.equal(pts({ ...MANO_VACIA, falDistales: 2 }), 0.22);
    assert.equal(pts({ ...MANO_VACIA, falMedias: 1, falDistales: 1 }), 0.22);
    // La unidad completa (4 medias + 5 distales) satura en 1.
    assert.equal(pts({ ...MANO_VACIA, falMedias: 4, falDistales: 5 }), 1);
  });

  test("las distales YA NO son una unidad propia /5 (partición vieja)", () => {
    // Antes: falDistales 5/5 = 1,00 pt. Ahora: 5/9 = 0,56 (comparten U.A.4).
    assert.notEqual(pts({ ...MANO_VACIA, falDistales: 5 }), 1);
    assert.equal(pts({ ...MANO_VACIA, falDistales: 5 }), 0.56);
  });

  test("carpianos /8 y metacarpianos /5 no cambian", () => {
    assert.equal(pts({ ...MANO_VACIA, carpianos: 2 }), 0.25); // Gráfico 3
    assert.equal(pts({ ...MANO_VACIA, metacarpianos: 4 }), 0.8); // Gráfico 3
  });

  test("cada unidad aporta como máximo 1 punto (clampeo)", () => {
    const excedida = { carpianos: 99, metacarpianos: 99, falProximales: 99, falMedias: 99, falDistales: 99 };
    assert.equal(pts(excedida), 4);
  });
});

describe("unidades anatómicas de PIE — 5 U.A., máx 5 pts/pie", () => {
  const pts = (pie) => computeEAT({ pieDer: pie }).totalPresent;

  test("pie completo → 5,00 pts", () => {
    assert.equal(pts(PIE_COMPLETO), 5);
  });

  test("🎯 solo calcáneo + astrágalo → 2,00 pts (con la partición vieja: 0,29)", () => {
    const soloGrandes = { ...PIE_VACIO, calcaneo: 1, astragalo: 1 };
    assert.equal(pts(soloGrandes), 2);
    const viejo = Math.round(Math.min(1, 2 / 7) * 100) / 100; // tarsianos 2/7
    assert.equal(viejo, 0.29);
  });

  test("el tarso pesa 60 % del pie (3 U.A. de 5), como en la fuente", () => {
    assert.equal(pts({ ...PIE_VACIO, calcaneo: 1, astragalo: 1, restoTarso: 5 }), 3);
  });

  test("U.A.5 = las falanges son UNA sola unidad, /10", () => {
    assert.equal(pts({ ...PIE_VACIO, falProx: 5, falMedias: 4, falDistales: 1 }), 1);
    assert.equal(pts({ ...PIE_VACIO, falProx: 1 }), 0.1);
    assert.equal(pts({ ...PIE_VACIO, falMedias: 1 }), 0.1);
    assert.equal(pts({ ...PIE_VACIO, falDistales: 1 }), 0.1);
    // Las falanges pesan 20 % del pie, no 60 % como en la partición vieja.
    assert.equal(pts({ ...PIE_VACIO, falProx: 5, falMedias: 4, falDistales: 5 }), 1);
  });

  test("🔒 RAREZA DE LA FUENTE replicada: 11–14 falanges saturan en 1,0 (denominador 10, no 14)", () => {
    assert.equal(pts({ ...PIE_VACIO, falProx: 5, falMedias: 4, falDistales: 1 }), 1); // 10 falanges
    assert.equal(pts({ ...PIE_VACIO, falProx: 5, falMedias: 4, falDistales: 5 }), 1); // 14 falanges
  });

  test("🔒 RAREZA DE LA FUENTE replicada: los denominadores del pie suman 22, no 26", () => {
    const denominadoresFuente = 1 + 1 + 5 + 5 + 10;
    assert.equal(denominadoresFuente, 22);
    assert.equal(PIE_TOTAL_BONES, 26); // captura anatómica
    assert.notEqual(denominadoresFuente, PIE_TOTAL_BONES); // la inconsistencia es de la fuente
  });

  test("metatarsianos /5 no cambia", () => {
    assert.equal(pts({ ...PIE_VACIO, metatarsianos: 4 }), 0.8);
  });
});

/* ── 4. El denominador global ───────────────────────────────────────────────── */

describe("denominador del IPO (🔒 115, no se mueve)", () => {
  const INDIVIDUO_COMPLETO = {
    craneo: marcar("cr", 18),
    vertebras: marcar("v", 32),
    huesosLargos: marcar("hl", 14),
    huesosPlanos: marcar("hp", 7),
    costillas: marcar("co", 24),
    mandibula: true,
    hioides: true,
    manoDer: MANO_COMPLETA,
    manoIzq: MANO_COMPLETA,
    pieDer: PIE_COMPLETO,
    pieIzq: PIE_COMPLETO,
  };

  test("EAT_IPO_MAX === 115", () => {
    assert.equal(EAT_IPO_MAX, 115);
  });

  test("individuo completo → totalPresent 115 e IPO 100,0 %", () => {
    const m = computeEAT(INDIVIDUO_COMPLETO);
    assert.equal(m.totalPresent, 115);
    assert.equal(m.ipo, 100);
  });

  test("los máximos por grupo siguen sumando 115", () => {
    const grupos = { craneo: 18, vertebras: 32, huesosLargos: 14, huesosPlanos: 7, costillas: 24, mandibula: 1, hioides: 1, manos: 8, pies: 10 };
    assert.equal(Object.values(grupos).reduce((a, b) => a + b, 0), EAT_IPO_MAX);
  });

  test("individuo vacío → IPO 0, ICH 0, EAT 100", () => {
    const m = computeEAT({});
    assert.deepEqual(m, { ipo: 0, ich: 0, eat: 100, totalPresent: 0 });
  });

  test("la mano sigue en 4 U.A. / 27 huesos y el pie en 5 U.A. / máx 5 pts", () => {
    assert.equal(MANO_TOTAL_BONES, 27);
    assert.equal(8 + 5 + 5 + 9, MANO_TOTAL_BONES); // denominadores de las 4 U.A.
    assert.equal(computeEAT({ manoDer: MANO_COMPLETA, manoIzq: MANO_COMPLETA }).totalPresent, 8);
    assert.equal(computeEAT({ pieDer: PIE_COMPLETO, pieIzq: PIE_COMPLETO }).totalPresent, 10);
  });
});

/* ── versión de la partición (guard de la migración) ───────────────────────── */

describe("EAT_UNIT_PARTITION_VERSION (🔒 guard de `migrations/eat_units_2026_08.ts`)", () => {
  test("exportada y === 2", () => {
    assert.equal(EAT_UNIT_PARTITION_VERSION, 2);
  });
});

/* ── la partición estricta necesita el shape granular ──────────────────────── */

describe("shape granular obligatorio (métricas normalizadas por `normalizeEatUnits`)", () => {
  const MANO_LEGACY = { carpianos: 8, metacarpianos: 5, falProxMedias: 9, falDistales: 5 };
  const PIE_LEGACY = { tarsianos: 7, metatarsianos: 5, falProx: 5, falMedias: 4, falDistales: 5 };

  test("una mano/pie legacy SIN normalizar NO puntúa completo (por eso las mutations normalizan)", () => {
    assert.notEqual(computeEAT({ manoDer: MANO_LEGACY }).totalPresent, 4);
    assert.notEqual(computeEAT({ pieDer: PIE_LEGACY }).totalPresent, 5);
  });

  test("normalizeEatUnits + computeEAT sobre datos legacy → 4,00 y 5,00 pts", () => {
    const { data } = normalizeEatUnits({ manoDer: MANO_LEGACY, pieDer: PIE_LEGACY }, 0);
    const m = computeEAT(data);
    assert.equal(m.totalPresent, 9); // 4 (mano) + 5 (pie)
  });

  test("`computeMetrics('eat', ...)` despacha a computeEAT", () => {
    assert.deepEqual(computeMetrics("eat", { manoDer: MANO_COMPLETA }), computeEAT({ manoDer: MANO_COMPLETA }));
  });
});
