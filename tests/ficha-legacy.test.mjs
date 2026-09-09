/**
 * Preservación de las claves retiradas de la ficha de Zonación (2026-09-09).
 * =========================================================================
 * `fichas.actualizar` REEMPLAZA el blob `data` entero. Cuando "Fragmentos",
 * "FFI" y "Alteraciones tafonómicas" salieron del formulario, el payload dejó
 * de emitir esas claves: sin el arrastre de `clavesHeredadas`, reguardar una de
 * las 2 fichas de producción que tienen `taphonomy` cargada borraría el dato.
 *
 * Esta es la prueba de la decisión D-A ("barrido de la UI, datos intactos").
 * ⚠️ Se hace acá, con una función pura: NO se prueba reguardando una ficha,
 * porque `.env.local` apunta al deployment de PRODUCCIÓN.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { clavesHeredadas, CLAVES_RETIRADAS } = await import("../src/lib/fichaLegacy.ts");

test("una ficha con tafonomía conserva `taphonomy` y `taphonomy_obs` intactos", () => {
  const guardada = {
    cranium_zones: { cran_1: true },
    taphonomy: { root_marks: true, fire: false },
    taphonomy_obs: "marcas de raíces en la diáfisis",
    weathering_degree: "3",
  };
  const h = clavesHeredadas(guardada);
  assert.deepEqual(h.taphonomy, { root_marks: true, fire: false });
  assert.equal(h.taphonomy_obs, "marcas de raíces en la diáfisis");
  assert.equal(h.weathering_degree, "3");
  // Referencia idéntica: se arrastra tal cual vino, sin normalizar nada.
  assert.equal(h.taphonomy, guardada.taphonomy);
});

test("fragmentos y filas de FFI también se arrastran", () => {
  const guardada = {
    fragments: { "frag_Axial (esponjoso)_0-20": 12 },
    ffi_rows: [{ id: 1, element: "Fémur", outline: "1", angle: "2", texture: "0" }],
  };
  const h = clavesHeredadas(guardada);
  assert.deepEqual(h.fragments, { "frag_Axial (esponjoso)_0-20": 12 });
  assert.equal(h.ffi_rows.length, 1);
});

test("una ficha sin esas claves no inventa ninguna", () => {
  assert.deepEqual(clavesHeredadas({ cranium_zones: { cran_1: true } }), {});
  assert.deepEqual(clavesHeredadas({}), {});
  assert.deepEqual(clavesHeredadas(undefined), {});
  assert.deepEqual(clavesHeredadas(null), {});
});

test("un valor registrado pero vacío se conserva (no es lo mismo que ausente)", () => {
  const h = clavesHeredadas({ taphonomy: {}, taphonomy_obs: "", ffi_rows: [] });
  assert.deepEqual(Object.keys(h).sort(), ["ffi_rows", "taphonomy", "taphonomy_obs"]);
  assert.deepEqual(h.taphonomy, {});
  assert.equal(h.taphonomy_obs, "");
});

test("una clave viva nunca es pisada por la heredada (el spread va primero)", () => {
  // Réplica del orden que arma el formulario: `{ ...heredado, ...claves vivas }`.
  const guardada = {
    taphonomy: { root_marks: true },
    cranium_zones: { cran_1: true },   // valor VIEJO de una clave viva
  };
  const heredado = clavesHeredadas(guardada);
  const data = { ...heredado, cranium_zones: { cran_2: true } }; // valor NUEVO
  assert.deepEqual(data.cranium_zones, { cran_2: true }, "gana el estado del formulario");
  assert.deepEqual(data.taphonomy, { root_marks: true });
  assert.ok(!("cranium_zones" in heredado), "una clave viva no puede ser heredada");
});

test("la lista de claves retiradas es exactamente la del SDD", () => {
  assert.deepEqual(
    [...CLAVES_RETIRADAS],
    ["fragments", "ffi_rows", "taphonomy", "weathering_degree", "taphonomy_obs"],
  );
});
