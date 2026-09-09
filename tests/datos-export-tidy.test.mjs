/**
 * Export tidy-long de `/datos` — partición canónica + lectura dual.
 * =================================================================
 * Este CSV es el insumo del análisis en R/Python de la tesis, así que los dos
 * modos de fallar son caros y opuestos:
 *
 *   1. **SOBRAR** — emitir las claves nuevas y los espejos legacy juntos
 *      (`tarsianos=7` al lado de `calcaneo/astragalo/restoTarso`): sumar las
 *      columnas de un pie da 33 en vez de 26. Es el bug que este cambio arregla.
 *   2. **FALTAR** — filtrar por allowlist y emitir ceros cuando una ficha NO
 *      tiene las claves nuevas (import externo / rollback): pérdida de
 *      información en el CSV.
 *
 * Los tests fijan las dos cosas: allowlist del contrato + lectura dual, y la
 * suma de control (mano 27, pie 26).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  EAT_EXTREMIDADES,
  TIDY_HEADERS,
  canonicalLimbEntries,
  tidyRowToArray,
  tidyRowsFor,
} from "../src/lib/tidyExport.ts";
import {
  EAT_FOOT_BONE_KEYS,
  EAT_HAND_BONE_KEYS,
  MANO_TOTAL_BONES,
  PIE_TOTAL_BONES,
  deriveFalangesMano,
  deriveTarso,
} from "../convex/lib/eatUnits.ts";

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Fixtures                                                                   */
/* ══════════════════════════════════════════════════════════════════════════ */

/** Mano completa, shape MIGRADO: claves nuevas + espejo legacy preservado. */
const MANO_MIGRADA_COMPLETA = {
  carpianos: 8,
  metacarpianos: 5,
  falProximales: 5,
  falMedias: 4,
  falDistales: 5,
  falProxMedias: 9, // espejo legacy (aditivo, sigue en prod)
};

/** Pie completo, shape MIGRADO: claves nuevas + espejo legacy preservado. */
const PIE_MIGRADO_COMPLETO = {
  calcaneo: 1,
  astragalo: 1,
  restoTarso: 5,
  metatarsianos: 5,
  falProx: 5,
  falMedias: 4,
  falDistales: 5,
  tarsianos: 7, // espejo legacy
};

/** Mano shape VIEJO (pre-backfill): solo el agregado `falProxMedias`. */
const MANO_LEGACY = {
  carpianos: 6,
  metacarpianos: 5,
  falProxMedias: 7,
  falDistales: 3,
};

/** Pie shape VIEJO (pre-backfill): solo el agregado `tarsianos`. */
const PIE_LEGACY = {
  tarsianos: 4,
  metatarsianos: 5,
  falProx: 3,
  falMedias: 2,
  falDistales: 1,
};

function fichaRow(eatData, zonData = null) {
  return {
    _id: "id1",
    codigoCanonico: "2024-LP-F1-UF3-I2",
    anioExcavacion: 2024,
    sitio: "La Pedrera",
    numeroFosa: "1",
    codigoUF: "3",
    numeroIndividuo: "2",
    sexoEstimado: "F",
    edadEstimada: "adulto",
    observaciones: null,
    revisionesPendientesCount: 0,
    zonacion: { presente: zonData !== null, data: zonData, metricas: null },
    eat: { presente: eatData !== null, data: eatData, metricas: null },
  };
}

/** Filas de una extremidad del tidy → `{ clave: valor }`. */
function limbRows(rows, elemento) {
  return Object.fromEntries(
    rows.filter((r) => r.elemento === elemento).map((r) => [r.clave, r.valor]),
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  1. Ficha migrada → partición canónica, SIN espejos legacy                   */
/* ══════════════════════════════════════════════════════════════════════════ */

describe("ficha migrada: solo la partición canónica", () => {
  const rows = tidyRowsFor(
    fichaRow({
      manoDer: MANO_MIGRADA_COMPLETA,
      pieDer: PIE_MIGRADO_COMPLETO,
    }),
  );

  test("mano: las 5 claves canónicas, sin `falProxMedias`", () => {
    const mano = limbRows(rows, "Mano derecha");
    assert.deepEqual(mano, {
      carpianos: 8,
      metacarpianos: 5,
      falProximales: 5,
      falMedias: 4,
      falDistales: 5,
    });
    assert.ok(!("falProxMedias" in mano), "el espejo legacy NO debe exportarse");
  });

  test("pie: las 7 claves canónicas, sin `tarsianos`", () => {
    const pie = limbRows(rows, "Pie derecho");
    assert.deepEqual(pie, {
      calcaneo: 1,
      astragalo: 1,
      restoTarso: 5,
      metatarsianos: 5,
      falProx: 5,
      falMedias: 4,
      falDistales: 5,
    });
    assert.ok(!("tarsianos" in pie), "el espejo legacy NO debe exportarse");
  });

  test("ninguna fila del export lleva una clave de espejo legacy", () => {
    for (const r of rows) {
      assert.notEqual(r.clave, "tarsianos");
      assert.notEqual(r.clave, "falProxMedias");
    }
  });

  test("las claves emitidas son exactamente las allowlists del contrato", () => {
    const mano = Object.keys(limbRows(rows, "Mano derecha"));
    const pie = Object.keys(limbRows(rows, "Pie derecho"));
    assert.deepEqual(mano, [...EAT_HAND_BONE_KEYS]);
    assert.deepEqual(pie, [...EAT_FOOT_BONE_KEYS]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════ */
/*  2. Suma de control — 26 y no 33                                            */
/* ══════════════════════════════════════════════════════════════════════════ */

describe("suma de control de las columnas numéricas", () => {
  const rows = tidyRowsFor(
    fichaRow({
      manoDer: MANO_MIGRADA_COMPLETA,
      pieDer: PIE_MIGRADO_COMPLETO,
    }),
  );
  const suma = (elemento) =>
    rows.filter((r) => r.elemento === elemento).reduce((a, r) => a + r.valor, 0);

  test("pie completo suma 26, NO 33 (26 + 7 del espejo)", () => {
    assert.equal(suma("Pie derecho"), 26);
    assert.equal(suma("Pie derecho"), PIE_TOTAL_BONES);
    assert.notEqual(suma("Pie derecho"), 33);
  });

  test("mano completa suma 27, NO 36 (27 + 9 del espejo)", () => {
    assert.equal(suma("Mano derecha"), 27);
    assert.equal(suma("Mano derecha"), MANO_TOTAL_BONES);
    assert.notEqual(suma("Mano derecha"), 36);
  });

  test("los cuatro lados completos suman 2×27 + 2×26 = 106", () => {
    const todos = tidyRowsFor(
      fichaRow({
        manoDer: MANO_MIGRADA_COMPLETA,
        manoIzq: MANO_MIGRADA_COMPLETA,
        pieDer: PIE_MIGRADO_COMPLETO,
        pieIzq: PIE_MIGRADO_COMPLETO,
      }),
    );
    const total = todos
      .filter((r) => EAT_EXTREMIDADES.some((e) => e.label === r.elemento))
      .reduce((a, r) => a + r.valor, 0);
    assert.equal(total, 106);
  });
});

/* ══════════════════════════════════════════════════════════════════════════ */
/*  3. 🔒 Lectura dual — ficha SIN las claves nuevas NO exporta vacío           */
/* ══════════════════════════════════════════════════════════════════════════ */

describe("lectura dual: ficha sin las claves nuevas (import / rollback)", () => {
  const rows = tidyRowsFor(fichaRow({ manoDer: MANO_LEGACY, pieDer: PIE_LEGACY }));

  test("pie legacy: `tarsianos: 4` se DERIVA, no se emite vacío", () => {
    const pie = limbRows(rows, "Pie derecho");
    const d = deriveTarso(4); // best-case: calcaneo 1, astragalo 1, restoTarso 2
    assert.equal(d.calcaneo, 1);
    assert.equal(d.astragalo, 1);
    assert.equal(d.restoTarso, 2);
    assert.deepEqual(pie, {
      calcaneo: 1,
      astragalo: 1,
      restoTarso: 2,
      metatarsianos: 5,
      falProx: 3,
      falMedias: 2,
      falDistales: 1,
    });
    assert.ok(!("tarsianos" in pie));
  });

  test("mano legacy: `falProxMedias: 7` se DERIVA, no se emite vacío", () => {
    const mano = limbRows(rows, "Mano derecha");
    const d = deriveFalangesMano(7); // best-case: proximales 5, medias 2
    assert.equal(d.falProximales, 5);
    assert.equal(d.falMedias, 2);
    assert.deepEqual(mano, {
      carpianos: 6,
      metacarpianos: 5,
      falProximales: 5,
      falMedias: 2,
      falDistales: 3,
    });
    assert.ok(!("falProxMedias" in mano));
  });

  test("la derivación CONSERVA el total de huesos del agregado legacy", () => {
    // 6+5+7+3 = 21 en el shape viejo; el export tiene que dar los mismos 21.
    const suma = rows
      .filter((r) => r.elemento === "Mano derecha")
      .reduce((a, r) => a + r.valor, 0);
    assert.equal(suma, 21);
    // Pie: 4+5+3+2+1 = 15.
    const sumaPie = rows
      .filter((r) => r.elemento === "Pie derecho")
      .reduce((a, r) => a + r.valor, 0);
    assert.equal(sumaPie, 15);
  });

  test("ningún lado con datos legacy produce 0 filas", () => {
    assert.ok(canonicalLimbEntries(PIE_LEGACY, "pie").length > 0);
    assert.ok(canonicalLimbEntries(MANO_LEGACY, "mano").length > 0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════ */
/*  4. Bordes                                                                  */
/* ══════════════════════════════════════════════════════════════════════════ */

describe("bordes de `canonicalLimbEntries`", () => {
  test("lado ausente / no-objeto → sin filas (no se inventan ceros)", () => {
    for (const raw of [undefined, null, 0, "", [], "7"]) {
      assert.deepEqual(canonicalLimbEntries(raw, "mano"), []);
      assert.deepEqual(canonicalLimbEntries(raw, "pie"), []);
    }
  });

  test("lado presente pero todo en 0 → sin filas (el tidy solo lleva presencias)", () => {
    assert.deepEqual(canonicalLimbEntries({ tarsianos: 0, metatarsianos: 0 }, "pie"), []);
    assert.deepEqual(canonicalLimbEntries({ falProxMedias: 0 }, "mano"), []);
  });

  test("un lado con SOLO el espejo legacy en 0 no emite el espejo", () => {
    const e = canonicalLimbEntries({ tarsianos: 7 }, "pie");
    assert.deepEqual(e, [
      ["calcaneo", 1],
      ["astragalo", 1],
      ["restoTarso", 5],
    ]);
  });

  test("valores fuera de rango se clampean al máximo del contrato", () => {
    const e = Object.fromEntries(canonicalLimbEntries({ calcaneo: 9, restoTarso: 99 }, "pie"));
    assert.equal(e.calcaneo, 1);
    assert.equal(e.restoTarso, 5);
  });

  test("claves desconocidas en el sub-objeto NO se exportan", () => {
    const e = Object.fromEntries(
      canonicalLimbEntries({ calcaneo: 1, inventada: 5, falMediasDistales: 9 }, "pie"),
    );
    assert.ok(!("inventada" in e));
    assert.ok(!("falMediasDistales" in e));
  });
});

/* ══════════════════════════════════════════════════════════════════════════ */
/*  5. No-regresión del contrato del CSV                                       */
/* ══════════════════════════════════════════════════════════════════════════ */

describe("contrato del CSV (nombres de columna estables para R/Python)", () => {
  test("el header del tidy no cambió", () => {
    assert.deepEqual(
      [...TIDY_HEADERS],
      ["codigo", "sitio", "fosa", "uf", "metodo", "elemento", "clave", "valor"],
    );
  });

  test("`tidyRowToArray` respeta el orden del header", () => {
    const rows = tidyRowsFor(fichaRow({ mandibula: true }));
    assert.deepEqual(tidyRowToArray(rows[0]), [
      "2024-LP-F1-UF3-I2",
      "La Pedrera",
      "1",
      "3",
      "eat",
      "Mandíbula",
      "mandibula",
      1,
    ]);
  });

  test("los rótulos de `elemento` de mano/pie no cambiaron", () => {
    assert.deepEqual(
      EAT_EXTREMIDADES.map((e) => e.label),
      ["Mano derecha", "Mano izquierda", "Pie derecho", "Pie izquierdo"],
    );
  });

  test("la Zonación exporta zonas; fragmentos, tafonomía y FFI ya no salen", () => {
    // 2026-09-09: los tres campos que Martina no usó salieron de toda la UI y
    // del tidy. El dato NO se borró de Convex — el blob `data` los sigue
    // teniendo (acá se los pasa a propósito) y el backend los sigue
    // calculando; lo que cambia es que el export deja de emitirlos.
    const rows = tidyRowsFor(
      fichaRow(null, {
        cranium_zones: { cr_z1: true, cr_z2: false },
        patella_zones: { pat_L: true },
        fragments: { axial_small: 3, apendicular_small: 0 },
        taphonomy: { raices: true },
        ffi_rows: [{ outline: 1, angle: 2, texture: 0 }],
      }),
    );
    const claves = rows.map((r) => `${r.elemento}/${r.clave}=${r.valor}`);
    assert.deepEqual(claves, ["Cráneo/cr_z1=1", "Rótula/pat_L=1"]);
    assert.ok(
      !rows.some((r) => ["Fragmentos", "Tafonomía", "FFI"].includes(r.elemento)),
      "ningún elemento retirado puede volver al tidy",
    );
  });

  test("un método ausente no emite filas de ese método", () => {
    const rows = tidyRowsFor(fichaRow(null, null));
    assert.equal(rows.length, 0);
  });

  test("`quality` (ICH) sigue exportándose igual", () => {
    const rows = tidyRowsFor(fichaRow({ quality: { craneo: { value: 80 }, pies: { value: 0 } } }));
    const q = limbRows(rows, "Calidad (ICH)");
    assert.deepEqual(q, { craneo: 80 });
  });
});
