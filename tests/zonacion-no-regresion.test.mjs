/**
 * Zonación (Knüsel & Outram 2004) — NO-REGRESIÓN.
 * ==============================================
 * 🔒 El cambio de unidades anatómicas del EAT NO toca la zonación en absoluto
 * (SDD §6). Este archivo es el candado: si alguien mueve `ZONATION_ELEMENT_MAX`,
 * el total de 635 zonas o el conteo por elemento mientras trabaja en el EAT, acá
 * se cae.
 *
 * Los valores de referencia son los de la corrección metodológica 2026-06
 * (sacro 4, mandíbula 7, pie 142 + rótula 2 = 635 zonas, 18 elementos).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  computeZonacion,
  computeMetrics,
  ZONATION_ELEMENT_MAX,
  ZONATION_TOTAL_ZONES,
} from "../convex/lib/metrics.ts";

describe("denominadores de zonación (🔒 congelados)", () => {
  test("ZONATION_TOTAL_ZONES === 635", () => {
    assert.equal(ZONATION_TOTAL_ZONES, 635);
  });

  test("18 elementos, con los máximos exactos de la corrección 2026-06", () => {
    assert.deepEqual(ZONATION_ELEMENT_MAX, {
      cranium_zones: 15,
      mandible_zones: 7,
      vertebrae_zones: 96,
      sacrum_zones: 4,
      sternum_zones: 3,
      clavicle_zones: 6,
      rib_zones: 72,
      scapula_zones: 18,
      humerus_zones: 22,
      radius_zones: 22,
      ulna_zones: 18,
      os_coxae_zones: 24,
      femur_zones: 22,
      tibia_zones: 20,
      fibula_zones: 12,
      hand_zones: 130,
      foot_zones: 142,
      patella_zones: 2,
    });
    assert.equal(Object.keys(ZONATION_ELEMENT_MAX).length, 18);
  });
});

describe("computeZonacion — comportamiento sin cambios", () => {
  test("ficha vacía → todo en cero", () => {
    const m = computeZonacion({});
    assert.equal(m.completitudGlobal, 0);
    assert.equal(m.zonasPresentes, 0);
    assert.equal(m.elementosPresentes, 0);
    assert.deepEqual(m.ffi, { n: 0, media: null, frescas: 0, secas: 0 });
  });

  test("sacro: solo cuenta las claves canónicas `sac_z1..4`, ignora las viejas", () => {
    const m = computeZonacion({
      sacrum_zones: { sac_z1: true, sac_z2: true, S1_z1: true, S2_z3: true },
    });
    assert.equal(m.zonasPresentes, 2);
    assert.equal(m.completitudPorElemento.sacrum_zones, 50);
  });

  test("mandíbula: 7 zonas-tipo `mand_z1..7`, el lado es observación", () => {
    const m = computeZonacion({
      mandible_zones: { mand_z1: true, mand_z2: true, mand_1_L: true, mand_1_R: true },
    });
    assert.equal(m.zonasPresentes, 2);
  });

  test("rótula: elemento propio, y NO se cuenta dentro de `foot_zones`", () => {
    const m = computeZonacion({
      patella_zones: { pat_L: true, pat_R: true },
      foot_zones: { fCalcaneus_L_z1: true, fPatella_L: true, fPatella_R: true },
    });
    assert.equal(m.completitudPorElemento.patella_zones, 100);
    assert.equal(m.zonasPresentes, 3); // 2 rótulas + 1 zona de calcáneo
    assert.equal(m.elementosPresentes, 2);
  });

  test("FFI: fresco (≤2) vs seco (≥3), filas incompletas ignoradas", () => {
    const m = computeZonacion({
      ffi_rows: [
        { outline: 0, angle: 1, texture: 1 }, // 2 → fresca
        { outline: 2, angle: 2, texture: 2 }, // 6 → seca
        { outline: 1, angle: "", texture: 1 }, // incompleta → ignorada
      ],
    });
    assert.deepEqual(m.ffi, { n: 2, media: 4, frescas: 1, secas: 1 });
  });

  test("`computeMetrics('zonacion', ...)` despacha a computeZonacion", () => {
    assert.deepEqual(computeMetrics("zonacion", {}), computeZonacion({}));
  });

  test("una ficha de zonación NO produce métricas de EAT", () => {
    const m = computeMetrics("zonacion", { cranium_zones: { c1: true } });
    assert.equal(m.ipo, undefined);
    assert.equal(m.completitudGlobal, 0.2); // 1 / 635
    assert.equal(m.completitudPorElemento.cranium_zones, 6.7); // 1 / 15
  });
});
