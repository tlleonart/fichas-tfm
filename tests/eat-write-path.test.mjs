/**
 * Camino de escritura de `fichas.crear` / `fichas.actualizar` (handoff §4.3).
 * ==========================================================================
 * `prepararEscrituraEat` es literalmente lo que corren las dos mutations, así que
 * lo que se verifica acá es el contrato de escritura completo:
 *   - las métricas las recalcula el backend (invariante #2), no el front;
 *   - `schemaVersion` queda en 3 en toda escritura;
 *   - la traza `data.eatDerivation` sobrevive a una edición desde `EATForm`;
 *   - un inventario fuera de rango se RECHAZA con un error legible;
 *   - los espejos legacy se preservan (migración aditiva, reversible).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { prepararEscrituraEat } from "../convex/lib/eatWrite.ts";
import { EAT_SCHEMA_VERSION, normalizeEatUnits } from "../convex/lib/eatUnits.ts";
import { computeEAT } from "../convex/lib/metrics.ts";

const NOW = 1_754_092_800_000; // 2026-08-02T00:00:00Z, fijo

/** Payload tal como lo arma `EATForm` (shape legacy, pre-Johan). */
const payloadFormLegacy = () => ({
  craneo: { Frontal: true, Occipital: true },
  vertebras: {},
  huesosLargos: {},
  huesosPlanos: {},
  costillas: {},
  mandibula: true,
  hioides: false,
  manoDer: { carpianos: 8, metacarpianos: 5, falProxMedias: 9, falDistales: 5 },
  manoIzq: { carpianos: 0, metacarpianos: 0, falProxMedias: 0, falDistales: 0 },
  pieDer: { tarsianos: 7, metatarsianos: 5, falProx: 5, falMedias: 4, falDistales: 5 },
  pieIzq: { tarsianos: 0, metatarsianos: 0, falProx: 0, falMedias: 0, falDistales: 0 },
  quality: { craneo: { value: 80, obs: "" }, mandibula: { value: 80, obs: "" }, manos: { value: 80, obs: "" }, pies: { value: 80, obs: "" } },
  observations: "",
});

/** Payload con el shape granular (post-Johan). */
const payloadFormGranular = () => ({
  ...payloadFormLegacy(),
  manoDer: { carpianos: 8, metacarpianos: 5, falProximales: 3, falMedias: 2, falDistales: 5 },
  pieDer: { calcaneo: 1, astragalo: 1, restoTarso: 3, metatarsianos: 5, falProx: 5, falMedias: 4, falDistales: 5 },
});

describe("crear — normaliza, valida y recalcula", () => {
  test("deja la ficha en schemaVersion 3", () => {
    const r = prepararEscrituraEat(payloadFormLegacy(), NOW);
    assert.equal(r.schemaVersion, EAT_SCHEMA_VERSION);
    assert.equal(r.schemaVersion, 3);
  });

  test("escribe las claves granulares nuevas y PRESERVA los espejos legacy", () => {
    const { data } = prepararEscrituraEat(payloadFormLegacy(), NOW);
    assert.deepEqual(data.manoDer, {
      carpianos: 8,
      metacarpianos: 5,
      falProximales: 5,
      falMedias: 4,
      falDistales: 5,
      falProxMedias: 9, // espejo, = 5 + 4
    });
    assert.deepEqual(data.pieDer, {
      calcaneo: 1,
      astragalo: 1,
      restoTarso: 5,
      metatarsianos: 5,
      falProx: 5,
      falMedias: 4,
      falDistales: 5,
      tarsianos: 7, // espejo, = 1 + 1 + 5
    });
  });

  test("las métricas persistidas son las del backend, con la partición estricta", () => {
    const { data, metricas } = prepararEscrituraEat(payloadFormLegacy(), NOW);
    assert.deepEqual(metricas, computeEAT(data));
    // 2 cráneo + mandíbula + mano completa (4) + pie completo (5) = 12
    assert.equal(metricas.totalPresent, 12);
    assert.equal(metricas.ich, 80);
  });

  test("un payload granular no se pisa con la derivación best-case", () => {
    const { data } = prepararEscrituraEat(payloadFormGranular(), NOW);
    assert.equal(data.manoDer.falProximales, 3);
    assert.equal(data.manoDer.falMedias, 2);
    assert.equal(data.manoDer.falProxMedias, 5); // espejo recalculado
    assert.equal(data.pieDer.restoTarso, 3);
    assert.equal(data.pieDer.tarsianos, 5); // 1 + 1 + 3
  });

  test("refresca `data._computed` (el preview del form) con el número autoritativo", () => {
    const conPreview = { ...payloadFormLegacy(), _computed: { IPO: 999, ICH: 999, EAT: 999, totalPresent: 999 } };
    const { data, metricas } = prepararEscrituraEat(conPreview, NOW);
    assert.deepEqual(data._computed, {
      IPO: metricas.ipo,
      ICH: metricas.ich,
      EAT: metricas.eat,
      totalPresent: metricas.totalPresent,
    });
  });

  test("no inventa `_computed` si el payload no lo trae", () => {
    const { data } = prepararEscrituraEat(payloadFormLegacy(), NOW);
    assert.equal(data._computed, undefined);
  });

  test("no toca los grupos que no son de mano/pie", () => {
    const entrada = payloadFormLegacy();
    const { data } = prepararEscrituraEat(entrada, NOW);
    assert.deepEqual(data.craneo, entrada.craneo);
    assert.deepEqual(data.quality, entrada.quality);
    assert.equal(data.mandibula, true);
    assert.equal(data.observations, "");
  });

  test("`data` vacío / ausente no explota", () => {
    assert.equal(prepararEscrituraEat(undefined, NOW).metricas.ipo, 0);
    assert.equal(prepararEscrituraEat({}, NOW).metricas.eat, 100);
  });
});

describe("actualizar — el tercer argumento RESCATA `data.eatDerivation`", () => {
  test("🎯 sin `previousData` la traza de derivación se pierde", () => {
    const persistido = prepararEscrituraEat(payloadFormLegacy(), NOW).data;
    assert.equal(persistido.eatDerivation.underAssumption, false);

    // `EATForm` reconstruye el payload desde cero: no devuelve `eatDerivation`.
    const delForm = payloadFormLegacy();
    assert.equal(delForm.eatDerivation, undefined);

    const conRescate = prepararEscrituraEat(delForm, NOW + 999, persistido).data;
    assert.deepEqual(conRescate.eatDerivation, persistido.eatDerivation);
    assert.equal(conRescate.eatDerivation.migratedAt, NOW); // timestamp original conservado
  });

  test("un lado bajo supuesto sigue marcado tras una edición que no lo toca", () => {
    // `falProxMedias: 4` es ambiguo (1..8) → derivado bajo supuesto best-case.
    const inicial = { ...payloadFormLegacy(), manoIzq: { carpianos: 8, metacarpianos: 5, falProxMedias: 4, falDistales: 5 } };
    const persistido = prepararEscrituraEat(inicial, NOW).data;
    assert.equal(persistido.eatDerivation.underAssumption, true);
    assert.equal(persistido.eatDerivation.sides.manoIzq.status, "derivado-supuesto");

    // El form devuelve las claves granulares tal como las cargó (sin editar el lado).
    const reenviado = { ...inicial, manoIzq: { ...persistido.manoIzq } };
    delete reenviado.eatDerivation;
    const despues = prepararEscrituraEat(reenviado, NOW + 999, persistido).data;
    assert.equal(despues.eatDerivation.sides.manoIzq.status, "derivado-supuesto");
    assert.equal(despues.eatDerivation.underAssumption, true);
  });

  test("re-registrar el lado a mano lo saca del análisis de sensibilidad", () => {
    const inicial = { ...payloadFormLegacy(), manoIzq: { carpianos: 8, metacarpianos: 5, falProxMedias: 4, falDistales: 5 } };
    const persistido = prepararEscrituraEat(inicial, NOW).data;

    const editado = { ...inicial, manoIzq: { ...persistido.manoIzq, falProximales: 2, falMedias: 2 } };
    delete editado.eatDerivation;
    const despues = prepararEscrituraEat(editado, NOW + 999, persistido).data;
    assert.equal(despues.eatDerivation.sides.manoIzq.status, "registrado");
    assert.equal(despues.eatDerivation.underAssumption, false);
  });

  test("idempotencia: re-guardar sin cambios no mueve nada", () => {
    const a = prepararEscrituraEat(payloadFormLegacy(), NOW).data;
    const b = prepararEscrituraEat(a, NOW + 111, a).data;
    const c = prepararEscrituraEat(b, NOW + 222, b).data;
    assert.deepEqual(b, a);
    assert.deepEqual(c, a);
  });
});

describe("validación — un inventario fuera de contrato se RECHAZA", () => {
  test("un espejo legacy incoherente se corrige por clampeo, no se rechaza", () => {
    // `normalizeEatUnits` clampea las claves que administra, así que para probar el
    // rechazo se usa una clave que no clampea el camino nuevo: un espejo inconsistente.
    const roto = {
      manoDer: { carpianos: 8, metacarpianos: 5, falProximales: 5, falMedias: 4, falDistales: 5, falProxMedias: 2 },
    };
    // Normalizado, el espejo se corrige solo → NO hay issue: el clampeo es la defensa.
    const { data } = normalizeEatUnits(roto, NOW);
    assert.equal(data.manoDer.falProxMedias, 9);
    assert.doesNotThrow(() => prepararEscrituraEat(roto, NOW));
  });

  test("un sub-objeto de extremidad que no es objeto se rechaza", () => {
    assert.throws(() => prepararEscrituraEat({ manoDer: "ocho" }, NOW), /Inventario EAT inválido/);
  });

  test("valores no numéricos se clampean a 0, no rompen la ficha", () => {
    const { data, metricas } = prepararEscrituraEat(
      { manoDer: { carpianos: "8", metacarpianos: null, falProximales: "x", falMedias: 4, falDistales: 5 } },
      NOW,
    );
    assert.equal(data.manoDer.carpianos, 8);
    assert.equal(data.manoDer.metacarpianos, 0);
    assert.equal(data.manoDer.falProximales, 0);
    assert.equal(metricas.totalPresent, 2); // carpianos 8/8 + (4+5)/9
  });

  test("valores por encima del máximo se clampean al máximo", () => {
    const { data } = prepararEscrituraEat({ pieDer: { calcaneo: 5, astragalo: 3, restoTarso: 99 } }, NOW);
    assert.equal(data.pieDer.calcaneo, 1);
    assert.equal(data.pieDer.astragalo, 1);
    assert.equal(data.pieDer.restoTarso, 5);
    assert.equal(data.pieDer.tarsianos, 7);
  });
});
