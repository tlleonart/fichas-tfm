/**
 * Contrato de `lib/eatUnits.ts` — las piezas de las que depende el camino de
 * escritura de las mutations (validación de rango, derivación best-case, limpieza).
 * ==============================================================================
 * El módulo lo entregó Dante (handoff §2); estos tests fijan lo que `fichas.ts` y
 * `lib/metrics.ts` asumen de él, para que un cambio ahí no rompa el backend en
 * silencio. La tabla de derivación es la publicada en el handoff §6.4 y es la que
 * se declara en la nota metodológica del TFM.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  deriveTarso,
  deriveFalangesMano,
  isTarsoAmbiguous,
  isFalangesManoAmbiguous,
  validateEatUnits,
  stripLegacyEatKeys,
  normalizeEatUnits,
  EAT_HAND_BONE_KEYS,
  EAT_FOOT_BONE_KEYS,
  EAT_DERIVATION_ASSUMPTION,
  MANO_TOTAL_BONES,
  PIE_TOTAL_BONES,
} from "../convex/lib/eatUnits.ts";

describe("allowlists de conteo (⚠️ excluyen los espejos legacy)", () => {
  test("mano: 5 claves autoritativas, sin `falProxMedias`", () => {
    assert.deepEqual([...EAT_HAND_BONE_KEYS], ["carpianos", "metacarpianos", "falProximales", "falMedias", "falDistales"]);
    assert.ok(!EAT_HAND_BONE_KEYS.includes("falProxMedias"));
  });

  test("pie: 7 claves autoritativas, sin `tarsianos`", () => {
    assert.deepEqual([...EAT_FOOT_BONE_KEYS], ["calcaneo", "astragalo", "restoTarso", "metatarsianos", "falProx", "falMedias", "falDistales"]);
    assert.ok(!EAT_FOOT_BONE_KEYS.includes("tarsianos"));
  });

  test("totales de captura: mano 27 (= fuente), pie 26 (= anatómico)", () => {
    assert.equal(MANO_TOTAL_BONES, 27);
    assert.equal(PIE_TOTAL_BONES, 26);
  });
});

describe("derivación best-case del histórico (handoff §6.4 — supuesto publicado)", () => {
  test("supuesto declarado", () => {
    assert.equal(EAT_DERIVATION_ASSUMPTION, "best-case:huesos-grandes-y-densos-primero");
  });

  test("tabla completa `tarsianos` → calcáneo / astrágalo / restoTarso", () => {
    const esperado = [
      [0, { calcaneo: 0, astragalo: 0, restoTarso: 0 }, false],
      [1, { calcaneo: 1, astragalo: 0, restoTarso: 0 }, true],
      [2, { calcaneo: 1, astragalo: 1, restoTarso: 0 }, true],
      [3, { calcaneo: 1, astragalo: 1, restoTarso: 1 }, true],
      [4, { calcaneo: 1, astragalo: 1, restoTarso: 2 }, true],
      [5, { calcaneo: 1, astragalo: 1, restoTarso: 3 }, true],
      [6, { calcaneo: 1, astragalo: 1, restoTarso: 4 }, true],
      [7, { calcaneo: 1, astragalo: 1, restoTarso: 5 }, false],
    ];
    for (const [n, derivado, ambiguo] of esperado) {
      assert.deepEqual(deriveTarso(n), derivado, `tarsianos=${n}`);
      assert.equal(isTarsoAmbiguous(n), ambiguo, `ambigüedad de tarsianos=${n}`);
      const suma = derivado.calcaneo + derivado.astragalo + derivado.restoTarso;
      assert.equal(suma, n, `el espejo tiene que conservarse (tarsianos=${n})`);
    }
  });

  test("tabla completa `falProxMedias` → proximales / medias", () => {
    for (let m = 0; m <= 9; m++) {
      const d = deriveFalangesMano(m);
      assert.equal(d.falProximales, Math.min(m, 5), `falProxMedias=${m}`);
      assert.equal(d.falProximales + d.falMedias, m, `el espejo tiene que conservarse (falProxMedias=${m})`);
      assert.equal(isFalangesManoAmbiguous(m), m >= 1 && m <= 8, `ambigüedad de falProxMedias=${m}`);
    }
    assert.deepEqual(deriveFalangesMano(9), { falProximales: 5, falMedias: 4 });
  });

  test("los conteos exactos (0 y el máximo) NO quedan bajo supuesto", () => {
    assert.equal(isTarsoAmbiguous(0), false);
    assert.equal(isTarsoAmbiguous(7), false);
    assert.equal(isFalangesManoAmbiguous(0), false);
    assert.equal(isFalangesManoAmbiguous(9), false);
  });
});

describe("validateEatUnits — rechazo de un inventario fuera de contrato", () => {
  test("un inventario normalizado no tiene issues", () => {
    const { data } = normalizeEatUnits(
      {
        manoDer: { carpianos: 8, metacarpianos: 5, falProxMedias: 9, falDistales: 5 },
        pieDer: { tarsianos: 7, metatarsianos: 5, falProx: 5, falMedias: 4, falDistales: 5 },
      },
      0,
    );
    assert.deepEqual(validateEatUnits(data), []);
  });

  test("valor por encima del máximo → `fuera-de-rango`", () => {
    const issues = validateEatUnits({ manoDer: { carpianos: 9 } });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].problem, "fuera-de-rango");
    assert.equal(issues[0].expected, "0..8");
  });

  test("valor negativo → `fuera-de-rango`", () => {
    assert.equal(validateEatUnits({ pieDer: { calcaneo: -1 } })[0].problem, "fuera-de-rango");
  });

  test("valor no entero → `no-entero`", () => {
    assert.equal(validateEatUnits({ manoIzq: { metacarpianos: 2.5 } })[0].problem, "no-entero");
  });

  test("valor no numérico → `no-numerico`", () => {
    assert.equal(validateEatUnits({ pieIzq: { restoTarso: "tres" } })[0].problem, "no-numerico");
  });

  test("sub-objeto que no es objeto → `no-numerico`", () => {
    assert.equal(validateEatUnits({ manoDer: 8 })[0].problem, "no-numerico");
  });

  test("espejo legacy incoherente → `espejo-inconsistente`", () => {
    const manoIssues = validateEatUnits({
      manoDer: { falProximales: 5, falMedias: 4, falProxMedias: 3 },
    });
    assert.equal(manoIssues[0].problem, "espejo-inconsistente");
    const pieIssues = validateEatUnits({
      pieDer: { calcaneo: 1, astragalo: 1, restoTarso: 5, tarsianos: 2 },
    });
    assert.equal(pieIssues[0].problem, "espejo-inconsistente");
  });

  test("un lado ausente es válido (no se inventan ceros)", () => {
    assert.deepEqual(validateEatUnits({}), []);
    assert.deepEqual(validateEatUnits({ manoDer: { carpianos: 8 } }), []);
  });
});

describe("stripLegacyEatKeys — limpieza destructiva posterior (paso D, gateado)", () => {
  test("borra SOLO los espejos legacy y deja el resto intacto", () => {
    const { data } = normalizeEatUnits(
      {
        manoDer: { carpianos: 8, metacarpianos: 5, falProxMedias: 9, falDistales: 5 },
        pieDer: { tarsianos: 7, metatarsianos: 5, falProx: 5, falMedias: 4, falDistales: 5 },
      },
      0,
    );
    const { data: limpio, removed } = stripLegacyEatKeys(data);
    assert.deepEqual(removed.sort(), ["manoDer.falProxMedias", "pieDer.tarsianos"]);
    assert.equal(limpio.manoDer.falProxMedias, undefined);
    assert.equal(limpio.pieDer.tarsianos, undefined);
    assert.equal(limpio.manoDer.falProximales, 5);
    assert.equal(limpio.pieDer.calcaneo, 1);
  });

  test("es reversible: los espejos se re-derivan de las claves nuevas", () => {
    const { data } = normalizeEatUnits({ pieDer: { tarsianos: 4 } }, 0);
    const { data: limpio } = stripLegacyEatKeys(data);
    const { data: reHidratado } = normalizeEatUnits(limpio, 0);
    assert.equal(reHidratado.pieDer.tarsianos, 4);
  });

  test("sin claves legacy no hay nada que borrar (idempotente)", () => {
    const { removed } = stripLegacyEatKeys({ manoDer: { carpianos: 8 } });
    assert.deepEqual(removed, []);
  });
});
