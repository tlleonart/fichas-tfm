/**
 * ICH — hardening del promedio de calidad (SDD §3.3 · §4 verificación 3).
 * =======================================================================
 * Bug arreglado: un grupo con huesos PRESENTES pero SIN calidad registrada
 * aportaba 0 al numerador y CONTABA en el denominador, hundiendo el ICH.
 *
 * 🔴 La distinción que sostiene todo esto:
 *   `value` AUSENTE  → no es una observación → SALE del promedio.
 *   `value = 0`      → SÍ es una observación (calidad nula) → ENTRA al promedio.
 *
 * Incidencia medida sobre los 60 individuos reales: 0/60 (dry-run de Dante y
 * `scripts/verify-eat-metrics.mjs`). Es hardening puro: no mueve ningún número
 * publicado. Si moviera alguno, sería un bug de esta implementación.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { computeEAT } from "../convex/lib/metrics.ts";
import { handBoneCount, footBoneCount, normalizeEatUnits } from "../convex/lib/eatUnits.ts";

const marcar = (prefijo, n) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefijo}${i}`, true]));

/** Dos grupos presentes: cráneo (18) y vértebras (32). El ICH es el promedio de los dos. */
const dosGrupos = (quality) => ({
  craneo: marcar("cr", 18),
  vertebras: marcar("v", 32),
  quality,
});

describe("ICH — grupo presente SIN calidad registrada queda FUERA del promedio", () => {
  test("clave del grupo ausente en `quality` → excluido", () => {
    const m = computeEAT(dosGrupos({ craneo: { value: 90 } }));
    assert.equal(m.ich, 90); // no 45 (= 90/2), que es lo que daba antes
  });

  test("`value: undefined` → excluido", () => {
    const m = computeEAT(dosGrupos({ craneo: { value: 90 }, vertebras: { value: undefined, obs: "" } }));
    assert.equal(m.ich, 90);
  });

  test("`value: null` → excluido", () => {
    const m = computeEAT(dosGrupos({ craneo: { value: 90 }, vertebras: { value: null } }));
    assert.equal(m.ich, 90);
  });

  test("`value: \"\"` (input vaciado en el form) → excluido", () => {
    const m = computeEAT(dosGrupos({ craneo: { value: 90 }, vertebras: { value: "" } }));
    assert.equal(m.ich, 90);
  });

  test("`value` no numérico → excluido", () => {
    const m = computeEAT(dosGrupos({ craneo: { value: 90 }, vertebras: { value: "s/d" } }));
    assert.equal(m.ich, 90);
  });

  test("entrada del grupo `undefined` en `quality` → excluido", () => {
    const m = computeEAT(dosGrupos({ craneo: { value: 90 }, vertebras: undefined }));
    assert.equal(m.ich, 90);
  });

  test("el grupo excluido NO arrastra el EAT hacia arriba", () => {
    const conBug = 100 - (43.48 * 45) / 100; // ICH hundido a la mitad
    const m = computeEAT(dosGrupos({ craneo: { value: 90 } }));
    assert.equal(m.ipo, 43.48); // 50/115
    assert.equal(m.eat, 60.87); // 100 − 43,48×90/100
    assert.ok(m.eat < conBug);
  });
});

describe("ICH — `value = 0` es una observación VÁLIDA y ENTRA al promedio", () => {
  test("`value: 0` → incluido (ICH = 45, no 90)", () => {
    const m = computeEAT(dosGrupos({ craneo: { value: 90 }, vertebras: { value: 0 } }));
    assert.equal(m.ich, 45);
  });

  test("`value: \"0\"` (string numérico del form) → incluido", () => {
    const m = computeEAT(dosGrupos({ craneo: { value: 90 }, vertebras: { value: "0" } }));
    assert.equal(m.ich, 45);
  });

  test("todos los grupos presentes con calidad 0 → ICH 0 y EAT 100", () => {
    const m = computeEAT(dosGrupos({ craneo: { value: 0 }, vertebras: { value: 0 } }));
    assert.equal(m.ich, 0);
    assert.equal(m.eat, 100);
  });
});

describe("ICH — grupos AUSENTES nunca entran (comportamiento previo, sin cambios)", () => {
  test("un grupo sin huesos no cuenta aunque tenga calidad cargada", () => {
    const m = computeEAT({
      craneo: marcar("cr", 18),
      vertebras: {}, // ausente
      quality: { craneo: { value: 80 }, vertebras: { value: 20 } },
    });
    assert.equal(m.ich, 80);
  });

  test("ningún grupo con calidad registrada → ICH 0 (fallback)", () => {
    const m = computeEAT({ craneo: marcar("cr", 18), quality: {} });
    assert.equal(m.ich, 0);
    assert.equal(m.eat, 100);
  });

  test("`quality` ausente por completo → ICH 0", () => {
    assert.equal(computeEAT({ craneo: marcar("cr", 18) }).ich, 0);
  });
});

describe("presencia de manos/pies en el ICH — allowlists, sin doble conteo", () => {
  const MANO_MIGRADA = {
    carpianos: 8,
    metacarpianos: 5,
    falProximales: 5,
    falMedias: 4,
    falDistales: 5,
    falProxMedias: 9, // espejo legacy, convive con las claves nuevas
  };
  const PIE_MIGRADO = {
    calcaneo: 1,
    astragalo: 1,
    restoTarso: 5,
    metatarsianos: 5,
    falProx: 5,
    falMedias: 4,
    falDistales: 5,
    tarsianos: 7, // espejo legacy
  };

  test("🎯 el espejo legacy NO se suma dos veces (handBoneCount vs Object.values genérico)", () => {
    const generico = Object.values(MANO_MIGRADA).reduce((a, v) => a + v, 0);
    assert.equal(generico, 36); // 27 + 9 → lo que daba el `handBones()` viejo
    assert.equal(handBoneCount(MANO_MIGRADA), 27);
    assert.equal(footBoneCount(PIE_MIGRADO), 26);
    assert.equal(Object.values(PIE_MIGRADO).reduce((a, v) => a + v, 0), 33); // 26 + 7
  });

  test("una ficha SIN migrar cae al espejo legacy y no pierde presencia", () => {
    const manoLegacy = { carpianos: 0, metacarpianos: 0, falProxMedias: 3, falDistales: 0 };
    const pieLegacy = { tarsianos: 2, metatarsianos: 0, falProx: 0, falMedias: 0, falDistales: 0 };
    assert.equal(handBoneCount(manoLegacy), 3);
    assert.equal(footBoneCount(pieLegacy), 2);
    // → los grupos "manos" y "pies" siguen contando como presentes en el ICH.
    const m = computeEAT({
      manoDer: manoLegacy,
      pieDer: pieLegacy,
      quality: { manos: { value: 60 }, pies: { value: 40 } },
    });
    assert.equal(m.ich, 50);
  });

  test("la presencia no cambia por normalizar (antes vs después de la migración)", () => {
    const antes = {
      manoDer: { carpianos: 8, metacarpianos: 5, falProxMedias: 9, falDistales: 5 },
      pieDer: { tarsianos: 7, metatarsianos: 5, falProx: 5, falMedias: 4, falDistales: 5 },
      quality: { manos: { value: 70 }, pies: { value: 30 } },
    };
    const { data: despues } = normalizeEatUnits(antes, 0);
    assert.equal(handBoneCount(antes.manoDer), handBoneCount(despues.manoDer));
    assert.equal(footBoneCount(antes.pieDer), footBoneCount(despues.pieDer));
    assert.equal(computeEAT(antes).ich, computeEAT(despues).ich);
  });
});
