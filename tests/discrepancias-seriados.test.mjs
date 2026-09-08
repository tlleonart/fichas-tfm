import test from "node:test";
import assert from "node:assert/strict";

const {
  contarSeriadosEat, construirFila, analizarPoblacion,
  EAT_TOTAL_VERTEBRAS, EAT_TOTAL_COSTILLAS,
} = await import("../convex/lib/poblacional.ts");

/* Métricas mínimas para que `construirFila` acepte el individuo. */
const zonMet = (porElemento = {}) => ({
  completitudGlobal: 50,
  completitudPorElemento: { ...porElemento },
  elementosPresentes: 10,
  ffi: { n: 0, media: null, frescas: 0, secas: 0 },
  alteracionesCount: 0,
  fragmentosCount: 0,
});
const eatMet = { ipo: 60, ich: 70, eat: 58, totalPresent: 60 };

const fila = (cod, sitio, porElemento, seriados) =>
  construirFila(
    { _id: cod, codigoCanonico: cod, sitio, sexoEstimado: null, edadEstimada: null },
    zonMet(porElemento), eatMet, seriados,
  );

test("contarSeriadosEat cuenta sólo las piezas marcadas como presentes", () => {
  const s = contarSeriadosEat({
    vertebras: { C1: true, C2: true, T1: false },
    costillas: { "Costilla 1 der": true, "Costilla 1 izq": false },
  });
  assert.equal(s.vertebrasPresentes, 2);
  assert.equal(s.costillasPresentes, 1);
});

test("contarSeriadosEat tolera un registro sin esos grupos", () => {
  assert.deepEqual(contarSeriadosEat({}), { vertebrasPresentes: 0, costillasPresentes: 0 });
  assert.equal(contarSeriadosEat(null), null);
  assert.equal(contarSeriadosEat(undefined), null);
});

test("los totales del EAT son 32 vértebras y 24 costillas", () => {
  assert.equal(EAT_TOTAL_VERTEBRAS, 32);
  assert.equal(EAT_TOTAL_COSTILLAS, 24);
});

test("hay discrepancia cuando la zonación registra cero y el EAT registra presencia", () => {
  const filas = [
    // discrepante: 0 zonas de vértebras, pero el EAT tiene 15
    fila("S-2020-F1-UF1-I1", "Castellón", { vertebrae_zones: 0, rib_zones: 0 },
         { vertebrasPresentes: 15, costillasPresentes: 0 }),
    // coherente: ambos métodos registran presencia
    fila("S-2020-F1-UF1-I2", "Castellón", { vertebrae_zones: 100, rib_zones: 100 },
         { vertebrasPresentes: 32, costillasPresentes: 24 }),
    // coherente: ambos en cero — ausencia real, NO discrepancia
    fila("S-2020-F1-UF1-I3", "Castellón", { vertebrae_zones: 0, rib_zones: 0 },
         { vertebrasPresentes: 0, costillasPresentes: 0 }),
  ];
  const d = analizarPoblacion(filas).discrepanciasSeriados;
  assert.equal(d.total, 1, "sólo el primero discrepa");
  assert.equal(d.enVertebras, 1);
  assert.equal(d.enCostillas, 0);
  assert.equal(d.casos[0].codigo, "S-2020-F1-UF1-I1");
  assert.equal(d.casos[0].vertebrasEat, 15);
  assert.equal(d.casos[0].vertebrasZonacion, 0);
});

test("la discrepancia en costillas se detecta por separado", () => {
  const filas = [
    fila("S-2020-F1-UF1-I1", "Castellón", { vertebrae_zones: 100, rib_zones: 0 },
         { vertebrasPresentes: 32, costillasPresentes: 24 }),
  ];
  const d = analizarPoblacion(filas).discrepanciasSeriados;
  assert.equal(d.enCostillas, 1);
  assert.equal(d.enVertebras, 0);
  assert.equal(d.casos[0].costillasEat, 24);
});

test("los casos se ordenan por número de individuo, no por el código entero", () => {
  const mk = (anio, num) =>
    fila(`CASTELLN-${anio}-FFILA-11-UF30${num}-I${num}`, "Castellón",
         { vertebrae_zones: 0, rib_zones: 0 }, { vertebrasPresentes: 5, costillasPresentes: 0 });
  // I5 con un año posterior: ordenar por el código lo mandaría al final
  const d = analizarPoblacion([mk(2023, 5), mk(2021, 9), mk(2021, 13)]).discrepanciasSeriados;
  assert.deepEqual(d.casos.map((c) => c.codigo.split("-I").pop()), ["5", "9", "13"]);
});

test("sin conteos del EAT no se inventan discrepancias", () => {
  const filas = [fila("S-2020-F1-UF1-I1", "Castellón", { vertebrae_zones: 0, rib_zones: 0 }, null)];
  const d = analizarPoblacion(filas).discrepanciasSeriados;
  assert.equal(d.evaluados, 0, "el individuo no es evaluable");
  assert.equal(d.total, 0);
});

test("el porcentaje se calcula sobre la muestra total, no sobre los evaluables", () => {
  const filas = [
    fila("S-2020-F1-UF1-I1", "Castellón", { vertebrae_zones: 0, rib_zones: 0 },
         { vertebrasPresentes: 5, costillasPresentes: 0 }),
    fila("S-2020-F1-UF1-I2", "Castellón", { vertebrae_zones: 50, rib_zones: 50 },
         { vertebrasPresentes: 10, costillasPresentes: 10 }),
    fila("S-2020-F1-UF1-I3", "Castellón", { vertebrae_zones: 50, rib_zones: 50 }, null),
  ];
  const d = analizarPoblacion(filas).discrepanciasSeriados;
  assert.equal(d.total, 1);
  assert.equal(d.evaluados, 2);
  assert.ok(Math.abs(d.pctDeLaMuestra - 33.3333) < 0.01, "1 de 3, no 1 de 2");
});

/* ─────────── IC del CCC (bootstrap) ─────────── */
const S = await import("../convex/lib/stats.ts");

test("el IC del CCC es determinista: dos llamadas dan el mismo intervalo", () => {
  const x = Array.from({ length: 40 }, (_, i) => i + (i % 7));
  const y = Array.from({ length: 40 }, (_, i) => i + (i % 5));
  const a = S.cccIntervalo(x, y);
  const b = S.cccIntervalo(x, y);
  assert.equal(a.inferior, b.inferior);
  assert.equal(a.superior, b.superior);
});

test("el IC contiene al CCC puntual y respeta el orden", () => {
  const x = Array.from({ length: 50 }, (_, i) => i * 1.7 + (i % 3));
  const y = Array.from({ length: 50 }, (_, i) => i * 1.6 + (i % 4));
  const ic = S.cccIntervalo(x, y);
  assert.ok(ic.inferior <= ic.ccc && ic.ccc <= ic.superior, "el punto cae dentro del intervalo");
  assert.ok(ic.inferior < ic.superior);
  assert.ok(ic.inferior >= -1 && ic.superior <= 1, "el CCC vive en [-1, 1]");
});

test("acuerdo perfecto da un intervalo degenerado en 1, no un error", () => {
  const x = Array.from({ length: 30 }, (_, i) => i);
  const ic = S.cccIntervalo(x, x);
  assert.equal(ic.ccc, 1);
  assert.ok(ic.inferior > 0.99);
});

test("sin datos suficientes devuelve null en vez de inventar un intervalo", () => {
  assert.equal(S.cccIntervalo([1, 2, 3], [1, 2, 3]), null);
  assert.equal(S.cccIntervalo([], []), null);
});

test("un intervalo más ancho corresponde a menos acuerdo", () => {
  const n = 60;
  const x = Array.from({ length: n }, (_, i) => i);
  const casi = x.map((v) => v + (v % 2 ? 0.4 : -0.4));
  const ruidoso = x.map((v) => v + ((v * 37) % 23) - 11);
  const a = S.cccIntervalo(x, casi);
  const b = S.cccIntervalo(x, ruidoso);
  assert.ok(a.ccc > b.ccc);
  assert.ok(a.superior - a.inferior < b.superior - b.inferior, "menos acuerdo, más incertidumbre");
});
