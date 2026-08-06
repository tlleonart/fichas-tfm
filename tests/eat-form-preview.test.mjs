/**
 * `src/lib/eatPreview.ts` — la capa de PREVIEW del `EATForm`.
 * ==========================================================
 * SDD: `SDD-fidelidad-EAT-unidades-anatomicas.md` §3.4 · Handoff de API §2.4/§5
 *
 * Lo que fijan estos tests (y por qué):
 *
 *  1. **PARIDAD con el backend.** Los puntos por lado que muestra el formulario
 *     tienen que dar exactamente lo que puntúa `computeEAT` de `lib/metrics.ts`
 *     (invariante #2: el backend es la fuente de verdad). Si alguien cambia la
 *     partición en el backend, esto se pone rojo en vez de dejar el form mintiendo.
 *  2. **Los 3 casos de aceptación** del handoff §5: mano completa 4,00 pts, pie
 *     completo 5,00 pts y el caso TESTIGO "solo calcáneo + astrágalo" = 2,00 pts
 *     (con la partición vieja daba 0,29).
 *  3. **La trampa del doble conteo:** nunca sumar el sub-objeto entero, porque el
 *     espejo legacy convive con las claves nuevas (36 vs 27 / 33 vs 26).
 *  4. **Compatibilidad con fichas SIN migrar** (el backfill corre después, §5bis.1):
 *     abrir + guardar una ficha vieja desde el form nuevo no puede mover su métrica.
 *  5. **`quality.value = 0` se persiste como `0`** y "no observado" sigue sin
 *     `value` (SDD §5bis.2): convertir uno en el otro mueve el ICH de las 60 fichas.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  MANO_ROWS,
  PIE_ROWS,
  MANO_UNITS,
  PIE_UNITS,
  MANO_TOTAL_BONES,
  PIE_TOTAL_BONES,
  MANO_MAX_PTS,
  PIE_MAX_PTS,
  EMPTY_MANO,
  EMPTY_PIE,
  handPreviewPoints,
  footPreviewPoints,
  handBoneTotal,
  footBoneTotal,
  hydrateMano,
  hydratePie,
  buildEatData,
  previewMetrics,
  presenceCounts,
  pruneQualityForAbsentGroups,
  unitPoints,
} from "@/lib/eatPreview.ts";
import { computeEAT } from "@convex/lib/metrics.ts";
import { prepararEscrituraEat } from "@convex/lib/eatWrite.ts";

const round2 = (n) => Math.round(n * 100) / 100;

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

/** Estado mínimo del formulario, para armar payloads en los tests. */
function estado(over = {}) {
  return {
    craneo: {},
    vertebras: {},
    huesosLargos: {},
    huesosPlanos: {},
    costillas: {},
    mandibula: false,
    hioides: false,
    manoDer: { ...EMPTY_MANO },
    manoIzq: { ...EMPTY_MANO },
    pieDer: { ...EMPTY_PIE },
    pieIzq: { ...EMPTY_PIE },
    quality: {},
    observations: "",
    ...over,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */

describe("filas de captura derivadas del contrato (nunca los espejos legacy)", () => {
  test("mano: 5 inputs, sin `falProxMedias`", () => {
    assert.deepEqual(
      MANO_ROWS.map((r) => r.key),
      ["carpianos", "metacarpianos", "falProximales", "falMedias", "falDistales"],
    );
    assert.ok(!MANO_ROWS.some((r) => r.key === "falProxMedias"));
    // 🔒 handoff §3 punto 3: el agregado `falMediasDistales` NO existe como campo.
    assert.ok(!MANO_ROWS.some((r) => r.key === "falMediasDistales"));
  });

  test("pie: 7 inputs, sin `tarsianos`", () => {
    assert.deepEqual(
      PIE_ROWS.map((r) => r.key),
      [
        "calcaneo",
        "astragalo",
        "restoTarso",
        "metatarsianos",
        "falProx",
        "falMedias",
        "falDistales",
      ],
    );
    assert.ok(!PIE_ROWS.some((r) => r.key === "tarsianos"));
  });

  test("calcáneo y astrágalo son CHECKBOX (un hueso por lado); el resto spinner", () => {
    const kinds = Object.fromEntries(PIE_ROWS.map((r) => [r.key, r.kind]));
    assert.equal(kinds.calcaneo, "checkbox");
    assert.equal(kinds.astragalo, "checkbox");
    assert.equal(kinds.restoTarso, "spinner");
    assert.equal(kinds.metatarsianos, "spinner");
    assert.ok(MANO_ROWS.every((r) => r.kind === "spinner"));
  });

  test("rangos = los del contrato", () => {
    assert.deepEqual(
      Object.fromEntries(MANO_ROWS.map((r) => [r.key, r.max])),
      { carpianos: 8, metacarpianos: 5, falProximales: 5, falMedias: 4, falDistales: 5 },
    );
    assert.deepEqual(
      Object.fromEntries(PIE_ROWS.map((r) => [r.key, r.max])),
      {
        calcaneo: 1,
        astragalo: 1,
        restoTarso: 5,
        metatarsianos: 5,
        falProx: 5,
        falMedias: 4,
        falDistales: 5,
      },
    );
  });

  test("cada input pertenece a una unidad anatómica y todas las unidades tienen input", () => {
    assert.deepEqual([...new Set(MANO_ROWS.map((r) => r.unit))].sort(), [1, 2, 3, 4]);
    assert.deepEqual([...new Set(PIE_ROWS.map((r) => r.unit))].sort(), [1, 2, 3, 4, 5]);
  });
});

describe("unidades anatómicas de puntuación (Serrulla & Vázquez 2019)", () => {
  test("mano: 4 U.A. con denominadores 8 / 5 / 5 / 9", () => {
    assert.equal(MANO_UNITS.length, MANO_MAX_PTS);
    assert.deepEqual(MANO_UNITS.map((u) => u.denominator), [8, 5, 5, 9]);
    assert.deepEqual(MANO_UNITS.map((u) => [...u.keys]), [
      ["carpianos"],
      ["metacarpianos"],
      ["falProximales"],
      ["falMedias", "falDistales"],
    ]);
  });

  test("pie: 5 U.A. con denominadores 1 / 1 / 5 / 5 / 10", () => {
    assert.equal(PIE_UNITS.length, PIE_MAX_PTS);
    // 🔒 rareza REPLICADA de la fuente: la U.A.5 puntúa /10 aunque se capturan 14.
    assert.deepEqual(PIE_UNITS.map((u) => u.denominator), [1, 1, 5, 5, 10]);
    assert.deepEqual(PIE_UNITS.map((u) => [...u.keys]), [
      ["calcaneo"],
      ["astragalo"],
      ["restoTarso"],
      ["metatarsianos"],
      ["falProx", "falMedias", "falDistales"],
    ]);
  });

  test("los denominadores de puntuación del pie suman 22 (la fuente), no 26", () => {
    assert.equal(PIE_UNITS.reduce((a, u) => a + u.denominator, 0), 22);
    assert.equal(PIE_TOTAL_BONES, 26);
    assert.equal(MANO_TOTAL_BONES, 27);
  });
});

describe("aceptación del handoff §5 — puntos de preview", () => {
  test("mano completa → 4,00 pts", () => {
    assert.equal(handPreviewPoints(MANO_COMPLETA), 4);
  });

  test("pie completo → 5,00 pts (11–14 falanges saturan en 1,0)", () => {
    assert.equal(footPreviewPoints(PIE_COMPLETO), 5);
  });

  test("CASO TESTIGO: pie con solo calcáneo + astrágalo → 2,00 pts (antes 0,29)", () => {
    const pie = { ...EMPTY_PIE, calcaneo: 1, astragalo: 1 };
    assert.equal(footPreviewPoints(pie), 2);
    // La partición vieja puntuaba tarsianos/7 = 2/7 = 0,29.
    assert.equal(round2(2 / 7), 0.29);
  });

  test("mano vacía / pie vacío → 0 pts", () => {
    assert.equal(handPreviewPoints(EMPTY_MANO), 0);
    assert.equal(footPreviewPoints(EMPTY_PIE), 0);
  });

  test("U.A.3 de la mano son las PROXIMALES solas (/5), no el agregado", () => {
    const mano = { ...EMPTY_MANO, falProximales: 2 };
    assert.equal(unitPoints(mano, MANO_UNITS[2]), 0.4); // 2/5 = 0,40 (Gráfico 3)
  });

  test("U.A.4 de la mano son medias + distales juntas (/9)", () => {
    const mano = { ...EMPTY_MANO, falMedias: 1, falDistales: 1 };
    assert.equal(round2(unitPoints(mano, MANO_UNITS[3])), 0.22); // 2/9 = 0,22 (Gráfico 3)
  });
});

describe("🔒 PARIDAD con `computeEAT` (el backend es la fuente de verdad)", () => {
  /** LCG determinista: mismos casos en cada corrida. */
  function* casos(n, maxes) {
    let s = 12345;
    const keys = Object.keys(maxes);
    for (let i = 0; i < n; i++) {
      const o = {};
      for (const k of keys) {
        s = (s * 1103515245 + 12345) % 2147483648;
        o[k] = s % (maxes[k] + 1);
      }
      yield o;
    }
  }

  test("mano: 300 combinaciones → preview === puntos que suma computeEAT", () => {
    const maxes = Object.fromEntries(MANO_ROWS.map((r) => [r.key, r.max]));
    let n = 0;
    for (const mano of casos(300, maxes)) {
      const autoritativo = computeEAT({ manoDer: mano }).totalPresent;
      assert.equal(round2(handPreviewPoints(mano)), autoritativo, JSON.stringify(mano));
      n++;
    }
    assert.equal(n, 300);
  });

  test("pie: 300 combinaciones → preview === puntos que suma computeEAT", () => {
    const maxes = Object.fromEntries(PIE_ROWS.map((r) => [r.key, r.max]));
    let n = 0;
    for (const pie of casos(300, maxes)) {
      const autoritativo = computeEAT({ pieDer: pie }).totalPresent;
      assert.equal(round2(footPreviewPoints(pie)), autoritativo, JSON.stringify(pie));
      n++;
    }
    assert.equal(n, 300);
  });

  test("las métricas de pantalla SON las de `computeEAT` sobre el payload", () => {
    const s = estado({
      manoDer: MANO_COMPLETA,
      pieDer: PIE_COMPLETO,
      craneo: { Frontal: true, Occipital: true },
      quality: { craneo: { value: 80, obs: "" }, manos: { value: 60, obs: "" }, pies: { value: 40, obs: "" } },
    });
    const data = buildEatData(s);
    assert.deepEqual(previewMetrics(data), computeEAT(data));
    // ... y coincide con lo que el camino de escritura del backend va a persistir.
    assert.deepEqual(previewMetrics(data), prepararEscrituraEat(data, 1).metricas);
  });
});

describe("⚠️ trampa del doble conteo (36 vs 27 · 33 vs 26)", () => {
  test("mano completa = 27 huesos, aunque el blob traiga el espejo legacy", () => {
    assert.equal(handBoneTotal(MANO_COMPLETA), MANO_TOTAL_BONES);
    const conEspejo = { ...MANO_COMPLETA, falProxMedias: 9 };
    assert.equal(handBoneTotal(conEspejo), 27);
    // El bug: la suma genérica del sub-objeto.
    assert.equal(Object.values(conEspejo).reduce((a, b) => a + b, 0), 36);
  });

  test("pie completo = 26 huesos, aunque el blob traiga `tarsianos`", () => {
    assert.equal(footBoneTotal(PIE_COMPLETO), PIE_TOTAL_BONES);
    const conEspejo = { ...PIE_COMPLETO, tarsianos: 7 };
    assert.equal(footBoneTotal(conEspejo), 26);
    assert.equal(Object.values(conEspejo).reduce((a, b) => a + b, 0), 33);
  });

  test("el estado del formulario NUNCA lleva los espejos legacy", () => {
    const mano = hydrateMano({ ...MANO_COMPLETA, falProxMedias: 9 });
    assert.ok(!("falProxMedias" in mano));
    const pie = hydratePie({ ...PIE_COMPLETO, tarsianos: 7 });
    assert.ok(!("tarsianos" in pie));
  });

  test("presencia de manos/pies para el gating del ICH = la del backend", () => {
    const s = estado({ manoDer: MANO_COMPLETA, pieIzq: PIE_COMPLETO });
    const p = presenceCounts(s);
    assert.equal(p.manos, 27);
    assert.equal(p.pies, 26);
  });
});

describe("hidratación de una ficha SIN migrar (el backfill corre después — §5bis.1)", () => {
  test("mano: `falProxMedias` → proximales primero (supuesto best-case)", () => {
    for (const [agregado, esperado] of [
      [0, { falProximales: 0, falMedias: 0 }],
      [3, { falProximales: 3, falMedias: 0 }],
      [5, { falProximales: 5, falMedias: 0 }],
      [7, { falProximales: 5, falMedias: 2 }],
      [9, { falProximales: 5, falMedias: 4 }],
    ]) {
      const m = hydrateMano({ carpianos: 8, metacarpianos: 5, falProxMedias: agregado, falDistales: 5 });
      assert.equal(m.falProximales, esperado.falProximales, `falProxMedias=${agregado}`);
      assert.equal(m.falMedias, esperado.falMedias, `falProxMedias=${agregado}`);
      // Invariante del contrato: la derivación conserva el conteo agregado.
      assert.equal(m.falProximales + m.falMedias, agregado);
    }
  });

  test("pie: `tarsianos` → calcáneo, astrágalo, resto", () => {
    for (const [agregado, esperado] of [
      [0, [0, 0, 0]],
      [1, [1, 0, 0]],
      [2, [1, 1, 0]],
      [4, [1, 1, 2]],
      [7, [1, 1, 5]],
    ]) {
      const p = hydratePie({ tarsianos: agregado, metatarsianos: 5 });
      assert.deepEqual([p.calcaneo, p.astragalo, p.restoTarso], esperado, `tarsianos=${agregado}`);
      assert.equal(p.calcaneo + p.astragalo + p.restoTarso, agregado);
    }
  });

  test("si el dato granular YA está, no se deriva nada (el registro manda)", () => {
    const m = hydrateMano({ falProximales: 1, falMedias: 4, falProxMedias: 9 });
    assert.equal(m.falProximales, 1);
    assert.equal(m.falMedias, 4);
    const p = hydratePie({ calcaneo: 0, astragalo: 1, restoTarso: 3, tarsianos: 7 });
    assert.deepEqual([p.calcaneo, p.astragalo, p.restoTarso], [0, 1, 3]);
  });

  test("un lado ausente abre en cero y no explota", () => {
    assert.deepEqual(hydrateMano(undefined), EMPTY_MANO);
    assert.deepEqual(hydratePie(null), EMPTY_PIE);
    assert.deepEqual(hydrateMano("basura"), EMPTY_MANO);
    assert.deepEqual(hydratePie({}), EMPTY_PIE);
  });

  test("valores fuera de rango / sucios se clampean a entero en [0, max]", () => {
    const m = hydrateMano({ carpianos: 99, metacarpianos: -3, falProximales: "4", falMedias: 2.6, falDistales: null });
    assert.deepEqual(m, { carpianos: 8, metacarpianos: 0, falProximales: 4, falMedias: 3, falDistales: 0 });
    const p = hydratePie({ calcaneo: 5, astragalo: "1", restoTarso: 9 });
    assert.deepEqual([p.calcaneo, p.astragalo, p.restoTarso], [1, 1, 5]);
  });

  test("🔒 abrir una ficha vieja y guardarla NO mueve su métrica", () => {
    // Ficha con el shape pre-migración (agregados) y unidades parciales.
    const viejo = {
      craneo: { Frontal: true, Parietal_der: true },
      vertebras: { C1: true, C2: true, T1: true },
      huesosLargos: { "Femur der": true },
      huesosPlanos: {},
      costillas: {},
      mandibula: true,
      hioides: false,
      manoDer: { carpianos: 6, metacarpianos: 5, falProxMedias: 7, falDistales: 3 },
      manoIzq: { carpianos: 8, metacarpianos: 5, falProxMedias: 9, falDistales: 5 },
      pieDer: { tarsianos: 4, metatarsianos: 5, falProx: 3, falMedias: 2, falDistales: 1 },
      pieIzq: { tarsianos: 7, metatarsianos: 5, falProx: 5, falMedias: 4, falDistales: 5 },
      quality: { craneo: { value: 75, obs: "" }, vertebras: { value: 50, obs: "" }, manos: { value: 60, obs: "" }, pies: { value: 40, obs: "" }, huesosLargos: { value: 80, obs: "" }, mandibula: { value: 0, obs: "" } },
      observations: "histórica",
    };
    // Lo que persistiría el backend hoy (normaliza + recalcula).
    const backend = prepararEscrituraEat(viejo, 1);

    // Lo que manda el formulario después de abrirla y guardarla sin editar.
    const reenviado = buildEatData(
      estado({
        craneo: viejo.craneo,
        vertebras: viejo.vertebras,
        huesosLargos: viejo.huesosLargos,
        mandibula: true,
        manoDer: hydrateMano(viejo.manoDer),
        manoIzq: hydrateMano(viejo.manoIzq),
        pieDer: hydratePie(viejo.pieDer),
        pieIzq: hydratePie(viejo.pieIzq),
        quality: viejo.quality,
        observations: viejo.observations,
      }),
    );
    const backendTrasGuardar = prepararEscrituraEat(reenviado, 2, backend.data);

    assert.deepEqual(backendTrasGuardar.metricas, backend.metricas);
    // Y no se perdió ningún conteo: los espejos legacy quedan coherentes.
    assert.equal(backendTrasGuardar.data.manoDer.falProxMedias, 7);
    assert.equal(backendTrasGuardar.data.pieDer.tarsianos, 4);
    assert.equal(backendTrasGuardar.data.observations, "histórica");
  });
});

describe("payload (`buildEatData`)", () => {
  test("no emite espejos legacy ni el agregado que este cambio elimina", () => {
    const data = buildEatData(estado({ manoDer: MANO_COMPLETA, pieDer: PIE_COMPLETO }));
    for (const lado of ["manoDer", "manoIzq"]) {
      assert.ok(!("falProxMedias" in data[lado]), `${lado}.falProxMedias`);
      assert.ok(!("falMediasDistales" in data[lado]), `${lado}.falMediasDistales`);
    }
    for (const lado of ["pieDer", "pieIzq"]) {
      assert.ok(!("tarsianos" in data[lado]), `${lado}.tarsianos`);
    }
    assert.ok(!("eatDerivation" in data));
  });

  test("manda todos los grupos del EAT (lo que no viaja, se pierde)", () => {
    const data = buildEatData(estado({ observations: "obs" }));
    for (const k of ["craneo", "vertebras", "huesosLargos", "huesosPlanos", "costillas", "mandibula", "hioides", "manoDer", "manoIzq", "pieDer", "pieIzq", "quality", "observations"]) {
      assert.ok(k in data, k);
    }
  });

  test("round-trip: guardar y reabrir devuelve los 12 valores idénticos", () => {
    const s = estado({
      manoDer: { carpianos: 3, metacarpianos: 5, falProximales: 2, falMedias: 1, falDistales: 4 },
      manoIzq: MANO_COMPLETA,
      pieDer: { calcaneo: 1, astragalo: 0, restoTarso: 2, metatarsianos: 4, falProx: 3, falMedias: 0, falDistales: 5 },
      pieIzq: PIE_COMPLETO,
    });
    const data = buildEatData(s);
    // El backend normaliza (agrega los espejos) y el form vuelve a hidratar.
    const persistido = prepararEscrituraEat(data, 1).data;
    assert.deepEqual(hydrateMano(persistido.manoDer), s.manoDer);
    assert.deepEqual(hydrateMano(persistido.manoIzq), s.manoIzq);
    assert.deepEqual(hydratePie(persistido.pieDer), s.pieDer);
    assert.deepEqual(hydratePie(persistido.pieIzq), s.pieIzq);
  });

  test("🔒 `quality.value = 0` viaja como `0` (calidad nula ES una observación)", () => {
    const quality = { craneo: { value: 0, obs: "" }, manos: { value: 0, obs: "muy degradado" } };
    const data = buildEatData(estado({ craneo: { Frontal: true }, manoDer: MANO_COMPLETA, quality }));
    assert.equal(data.quality.craneo.value, 0);
    assert.equal(data.quality.manos.value, 0);
    assert.notEqual(data.quality.craneo.value, undefined);
    // Con los dos grupos presentes y calidad 0, el ICH es 0 → EAT 100.
    const m = previewMetrics(data);
    assert.equal(m.ich, 0);
    assert.equal(m.eat, 100);
  });

  /* ────────────────────────────────────────────────────────────────────────
     🐛 Calidad huérfana — bug reportado por Martina el 2026-08-06.
     El slider del ICH se gatea por presencia, pero el gate era sólo de RENDER:
     al destildar el hueso el control desaparecía y el valor cargado quedaba en el
     estado, viajaba en el payload y se persistía. Quedaban 2 fichas de la muestra
     con calidad imposible de ver ni borrar desde la interfaz
     (`UF3014-I14` hioides=95 · `UF3018-I18` costillas=40).
     El ICH nunca estuvo mal: promedia por PRESENCIA, así que el huérfano no entra.
     Estos tests fijan las DOS direcciones, que no son simétricas.
     ──────────────────────────────────────────────────────────────────────── */
  describe("🐛 calidad de grupos ausentes (no puede quedar huérfana)", () => {
    test("grupo AUSENTE con calidad cargada → se limpia al armar el payload", () => {
      const data = buildEatData(
        estado({ hioides: false, quality: { hioides: { value: 95, obs: "" } } }),
      );
      assert.equal(data.quality.hioides.value, 0);
      assert.equal(data.quality.hioides.obs, "");
    });

    test("también se limpia la observación del grupo ausente", () => {
      const data = buildEatData(
        estado({ costillas: {}, quality: { costillas: { value: 40, obs: "quedó de antes" } } }),
      );
      assert.equal(data.quality.costillas.value, 0);
      assert.equal(data.quality.costillas.obs, "");
    });

    test("🔒 el grupo PRESENTE con calidad 0 NO se toca (0 es calidad nula, no vacío)", () => {
      const data = buildEatData(
        estado({ craneo: { Frontal: true }, quality: { craneo: { value: 0, obs: "pulverizado" } } }),
      );
      assert.equal(data.quality.craneo.value, 0);
      assert.equal(data.quality.craneo.obs, "pulverizado");
    });

    test("🔒 el grupo PRESENTE sin `value` sigue sin `value` (no se fabrica un 0)", () => {
      const data = buildEatData(
        estado({ craneo: { Frontal: true }, quality: { craneo: { obs: "sin evaluar" } } }),
      );
      assert.equal(data.quality.craneo.value, undefined);
      assert.equal(data.quality.craneo.obs, "sin evaluar");
    });

    test("limpiar un grupo ausente NO mueve el ICH (promedia por presencia)", () => {
      const base = { craneo: { Frontal: true }, quality: { craneo: { value: 80, obs: "" } } };
      const limpio = previewMetrics(buildEatData(estado(base)));
      const conHuerfana = previewMetrics(
        buildEatData(
          estado({ ...base, quality: { ...base.quality, hioides: { value: 10, obs: "" } } }),
        ),
      );
      assert.equal(conHuerfana.ich, limpio.ich);
      assert.equal(conHuerfana.ich, 80);
      assert.equal(conHuerfana.eat, limpio.eat);
    });

    test("mano y pie: el gate usa el conteo por allowlist, no el objeto entero", () => {
      // Mano vacía → `manos` ausente → la calidad se limpia.
      const vacia = buildEatData(estado({ quality: { manos: { value: 70, obs: "" } } }));
      assert.equal(vacia.quality.manos.value, 0);
      // Mano con un solo hueso → `manos` presente → la calidad se respeta.
      const conHueso = buildEatData(
        estado({ manoDer: { ...EMPTY_MANO, carpianos: 1 }, quality: { manos: { value: 70, obs: "" } } }),
      );
      assert.equal(conHueso.quality.manos.value, 70);
    });

    test("una clave desconocida no se toca (no le inventamos presencia)", () => {
      const out = pruneQualityForAbsentGroups(
        estado({ quality: { grupoRaro: { value: 33, obs: "x" } } }),
      );
      assert.deepEqual(out.grupoRaro, { value: 33, obs: "x" });
    });

    test("el saneamiento no muta el estado del formulario", () => {
      const s = estado({ hioides: false, quality: { hioides: { value: 95, obs: "ojo" } } });
      buildEatData(s);
      assert.equal(s.quality.hioides.value, 95);
      assert.equal(s.quality.hioides.obs, "ojo");
    });

    test("los dos casos reales de la muestra quedan saneados", () => {
      // UF3014-I14: hioides destildado con calidad 95.
      const i14 = buildEatData(estado({ hioides: false, quality: { hioides: { value: 95, obs: "" } } }));
      assert.equal(i14.quality.hioides.value, 0);
      // UF3018-I18: costillas sin ninguna marcada, con calidad 40.
      const i18 = buildEatData(estado({ costillas: {}, quality: { costillas: { value: 40, obs: "" } } }));
      assert.equal(i18.quality.costillas.value, 0);
    });
  });

  test("un grupo presente SIN `value` sigue excluido del promedio (no se fabrica un 0)", () => {
    const data = buildEatData(
      estado({
        craneo: { Frontal: true },
        manoDer: MANO_COMPLETA,
        quality: { craneo: { value: 80, obs: "" }, manos: { obs: "sin evaluar" } },
      }),
    );
    assert.equal(data.quality.manos.value, undefined);
    assert.equal(previewMetrics(data).ich, 80); // promedio de 1 grupo, no de 2
  });

  test("`_computed` refleja el número autoritativo", () => {
    const data = buildEatData(estado({ manoDer: MANO_COMPLETA, quality: { manos: { value: 50, obs: "" } } }));
    const m = computeEAT(data);
    assert.deepEqual(data._computed, {
      totalPresent: m.totalPresent,
      IPO: m.ipo,
      ICH: m.ich,
      EAT: m.eat,
    });
  });
});
