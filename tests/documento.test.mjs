import test from "node:test";
import assert from "node:assert/strict";

const {
  seccionesZonacion, gruposEat, calidadEat, contextoZonacion, num, TOTAL_ZONAS,
} = await import("../src/lib/documento.ts");

const celdas = (secs) => secs.reduce((n, s) => n + s.total, 0);

test("la ficha de zonación rinde exactamente las 635 zonas del método", () => {
  const secs = seccionesZonacion({});
  assert.equal(celdas(secs), TOTAL_ZONAS,
    `el documento tiene que cubrir las ${TOTAL_ZONAS} zonas de ZONATION_ELEMENT_MAX`);
});

test("una ficha vacía no inventa presencias: todo queda como 'sin registro'", () => {
  const secs = seccionesZonacion({});
  assert.equal(secs.reduce((n, s) => n + s.presentes, 0), 0);
  for (const s of secs)
    for (const f of s.filas)
      for (const c of f.celdas) assert.equal(c, null);
});

test("presente / ausente / sin registro son tres estados distintos", () => {
  const secs = seccionesZonacion({ cranium_zones: { cran_1: true, cran_2: false } });
  const craneo = secs.find((s) => s.titulo === "Cráneo");
  assert.equal(craneo.filas[0].celdas[0], true);   // registrada presente
  assert.equal(craneo.filas[1].celdas[0], false);  // registrada ausente
  assert.equal(craneo.filas[2].celdas[0], null);   // nunca registrada
  assert.equal(craneo.presentes, 1);
});

test("la mandíbula son 7 zonas-tipo (mand_z1..z7), no las 14 claves viejas", () => {
  const secs = seccionesZonacion({
    mandible_zones: { mand_z1: true, mand_1_L: true, mand_1_R: true },
  });
  const mand = secs.find((s) => s.titulo === "Mandíbula");
  assert.equal(mand.total, 7, "el denominador de la mandíbula es 7");
  assert.equal(mand.presentes, 1, "las claves viejas mand_N_L/R no se cuentan: metrics.ts las ignora");
});

test("cada elemento aporta su denominador oficial", () => {
  const secs = seccionesZonacion({});
  const porTitulo = (t) => secs.filter((s) => s.titulo.startsWith(t)).reduce((n, s) => n + s.total, 0);
  assert.equal(porTitulo("Cráneo"), 15);
  assert.equal(porTitulo("Vértebras"), 96);
  assert.equal(porTitulo("Sacro"), 4);
  assert.equal(porTitulo("Costillas"), 72);
  assert.equal(porTitulo("Mano"), 130);
  assert.equal(porTitulo("Pie"), 142);
  assert.equal(porTitulo("Rótula"), 2);
});

test("el EAT empareja claves aunque el acento no coincida", () => {
  // El formulario escribe "Escápula der"; el registro guarda "Escapula der".
  const g = gruposEat({ huesosPlanos: { "Escapula der": true, "Esternon": true } });
  const planos = g.find((x) => x.titulo === "Huesos planos");
  assert.equal(planos.total, 7, "sin normalizar, el grupo se duplicaba");
  assert.equal(planos.presentes, 2);
});

test("las costillas del EAT son 24 y usan el formato del registro", () => {
  const g = gruposEat({ costillas: { "Costilla 1 der": true, "Costilla 1 izq": false } });
  const c = g.find((x) => x.titulo === "Costillas");
  assert.equal(c.total, 24);
  assert.equal(c.presentes, 1);
});

test("una clave que la nomenclatura no prevé se muestra igual, no se descarta", () => {
  const g = gruposEat({ craneo: { "Hueso raro": true } });
  const craneo = g.find((x) => x.titulo === "Cráneo");
  assert.ok(craneo.items.some((i) => i.nombre === "Hueso raro" && i.presente === true));
});

test("mandíbula e hioides son booleanos de pieza única", () => {
  const g = gruposEat({ mandibula: true, hioides: false });
  assert.equal(g.find((x) => x.titulo === "Mandíbula").tipo, "unico");
  assert.equal(g.find((x) => x.titulo === "Mandíbula").presente, true);
  assert.equal(g.find((x) => x.titulo === "Hioides").presente, false);
});

test("la calidad lee el objeto {value, obs} de cada grupo", () => {
  const q = calidadEat({ quality: { craneo: { value: 45, obs: "nota" } } });
  const craneo = q.find((x) => x.grupo === "Cráneo");
  assert.equal(craneo.valor, 45);
  assert.equal(craneo.obs, "nota");
  assert.equal(q.find((x) => x.grupo === "Costillas").valor, null);
});

test("el contexto descarta las filas de FFI totalmente vacías", () => {
  const c = contextoZonacion({
    ffi_rows: [
      { element: "", outline: "", angle: "", texture: "", observation: "" },
      { element: "Fémur", outline: "V", angle: "", texture: "", observation: "" },
    ],
    taphonomy: { root_marks: true, fire: false },
  });
  assert.equal(c.ffi.length, 1);
  assert.deepEqual(c.alteraciones, ["Marcas de raíces"]);
});

test("los números se escriben con coma decimal, como el manuscrito", () => {
  assert.equal(num(99.5), "99,5");
  assert.equal(num(17.71, 2), "17,71");
  assert.equal(num(null), "—");
});
