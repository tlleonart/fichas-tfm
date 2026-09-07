/**
 * `convex/lib/stats.ts` — tests unitarios de las primitivas.
 * ==========================================================
 * Acá se verifica cada función contra valores ANALÍTICOS o de referencia
 * (libro de texto / fuerza bruta), con datos chicos y sintéticos.
 *
 * El gate contra los números publicados del TFM vive aparte, en
 * `stats-tfm.test.mjs`. Los dos tienen que pasar.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import * as S from "../convex/lib/stats.ts";

/** Igualdad con tolerancia absoluta. */
const cerca = (got, esperado, tol, msg) =>
  assert.ok(
    got !== null && Math.abs(got - esperado) <= tol,
    `${msg ?? ""} got=${got} esperado=${esperado} (tol ${tol})`,
  );

/* ================================================================== */
describe("descriptivos y dispersión", () => {
  test("μ, σ muestral y σ poblacional sobre un caso a mano", () => {
    const xs = [2, 4, 4, 4, 5, 5, 7, 9];
    const d = S.descriptivos(xs);
    assert.equal(d.n, 8);
    assert.equal(d.media, 5);
    // σ poblacional = 2 exacto; σ muestral = 2·√(8/7)
    cerca(S.sdP(xs), 2, 1e-12, "σ poblacional");
    cerca(d.de, 2 * Math.sqrt(8 / 7), 1e-12, "σ muestral");
    assert.equal(d.mediana, 4.5);
    assert.equal(d.min, 2);
    assert.equal(d.max, 9);
  });

  test("serie vacía devuelve nulos, no NaN", () => {
    const d = S.descriptivos([]);
    assert.deepEqual(d, { n: 0, media: null, de: null, mediana: null, min: null, max: null });
  });

  test("ignora los valores no finitos", () => {
    assert.equal(S.descriptivos([1, NaN, 3, Infinity]).n, 2);
  });

  test("varianza poblacional vs muestral", () => {
    const xs = [1, 2, 3, 4];
    cerca(S.varianceP(xs), 1.25, 1e-12);
    cerca(S.variance(xs), 5 / 3, 1e-12);
  });

  test("proporcionIgualA cuenta extremos", () => {
    const xs = [0, 0, 50, 100, 100, 100];
    cerca(S.proporcionIgualA(xs, 0) * 100, 33.3333, 1e-3);
    cerca(S.proporcionIgualA(xs, 100) * 100, 50, 1e-9);
  });
});

/* ================================================================== */
describe("funciones especiales (Numerical Recipes)", () => {
  test("Φ y la cola de la normal en los cuantiles conocidos", () => {
    cerca(S.normalSf(1.959963985), 0.025, 1e-9, "cola 1,96");
    cerca(S.normalSf(0), 0.5, 1e-12);
    cerca(S.normalCdf(-2.5758293), 0.005, 1e-8, "cola 2,576");
    cerca(S.normalCdf(0), 0.5, 1e-12);
  });

  test("erfc contra valores tabulados", () => {
    cerca(S.erfc(0), 1, 1e-12);
    cerca(S.erfc(1), 0.15729920705, 1e-10);
    cerca(S.erfc(-1), 1.84270079295, 1e-10);
    cerca(S.erfc(2), 0.00467773498, 1e-11);
  });

  test("χ² en los valores críticos al 5 %", () => {
    cerca(S.chiCuadradoSf(3.8414588, 1), 0.05, 1e-7);
    cerca(S.chiCuadradoSf(5.9914645, 2), 0.05, 1e-7);
    cerca(S.chiCuadradoSf(7.8147279, 3), 0.05, 1e-7);
    cerca(S.chiCuadradoSf(0, 2), 1, 1e-12);
  });

  test("t de Student a dos colas en los valores críticos", () => {
    cerca(S.tSf2(2.2281389, 10), 0.05, 1e-6);
    cerca(S.tSf2(2.0, 60), 0.0500330, 1e-6);
    cerca(S.tSf2(0, 10), 1, 1e-12);
  });

  test("gamma incompleta: P + Q = 1", () => {
    for (const [a, x] of [[0.5, 1], [2, 3], [5, 2], [10, 12]]) {
      cerca(S.gammaIncompletaP(a, x) + S.gammaIncompletaQ(a, x), 1, 1e-12, `a=${a} x=${x}`);
    }
  });

  test("beta incompleta: I_x(a,b) = 1 − I_{1−x}(b,a)", () => {
    for (const [a, b, x] of [[2, 3, 0.3], [5, 1, 0.8], [0.5, 0.5, 0.25]]) {
      cerca(
        S.betaIncompleta(a, b, x) + S.betaIncompleta(b, a, 1 - x),
        1,
        1e-12,
        `a=${a} b=${b} x=${x}`,
      );
    }
  });
});

/* ================================================================== */
describe("correlación", () => {
  test("Pearson = 1 y −1 en relaciones lineales exactas", () => {
    cerca(S.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-12);
    cerca(S.pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1, 1e-12);
  });

  test("Pearson sobre un caso calculado a mano", () => {
    // x̄=ȳ=3 · Sxy = 2+2+0+0+4 = 8 · Sxx = Syy = 10 ⇒ r = 8/√(10·10) = 0,8
    cerca(S.pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]), 0.8, 1e-12);
  });

  test("null con n<2 o varianza cero", () => {
    assert.equal(S.pearson([1], [2]), null);
    assert.equal(S.pearson([1, 1, 1], [1, 2, 3]), null);
    assert.equal(S.pearson([1, 2], [1, 2, 3]), null);
  });

  test("ranks promedia los empates", () => {
    assert.deepEqual(S.ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
    assert.deepEqual(S.ranks([5, 5, 5]), [2, 2, 2]);
  });

  test("Spearman detecta monotonía no lineal que Pearson no", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [1, 4, 9, 16, 25];
    cerca(S.spearman(x, y), 1, 1e-12, "ρ = 1 en una monótona creciente");
    assert.ok(S.pearson(x, y) < 1, "Pearson < 1 en la misma serie");
  });

  test("Spearman devuelve null por debajo de minN", () => {
    assert.equal(S.spearman([1, 2], [2, 1]), null);
    assert.equal(S.spearman([1, 2], [2, 1], 2), -1);
  });

  test("CCC de Lin: 1 con acuerdo perfecto, < r con desplazamiento", () => {
    cerca(S.ccc([1, 2, 3, 4], [1, 2, 3, 4]), 1, 1e-12, "acuerdo perfecto");
    const x = [1, 2, 3, 4];
    const y = x.map((v) => v + 10); // r = 1 pero acuerdo pésimo
    cerca(S.pearson(x, y), 1, 1e-12);
    assert.ok(S.ccc(x, y) < 0.1, "el CCC penaliza el sesgo constante");
  });

  test("CCC contra la fórmula desarrollada a mano", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [1, 3, 2, 5, 4];
    const esperado =
      (2 * S.covarianceP(x, y)) /
      (S.varianceP(x) + S.varianceP(y) + (S.mean(x) - S.mean(y)) ** 2);
    cerca(S.ccc(x, y), esperado, 1e-12);
    cerca(S.ccc(x, y), 0.8, 1e-12); // cov=1.6, var=var=2, medias iguales
  });
});

/* ================================================================== */
describe("regresión lineal", () => {
  test("OLS simple recupera una recta exacta", () => {
    const x = [1, 2, 3, 4, 5];
    const r = S.regresionLineal(x, x.map((v) => 3 * v + 7));
    cerca(r.pendiente, 3, 1e-12);
    cerca(r.interseccion, 7, 1e-12);
    cerca(r.r2, 1, 1e-12);
  });

  test("R² del OLS simple = r de Pearson al cuadrado", () => {
    const x = [2, 4, 6, 8, 10, 12];
    const y = [3, 5, 4, 9, 8, 13];
    cerca(S.regresionLineal(x, y).r2, S.pearson(x, y) ** 2, 1e-12);
  });

  test("el p de la pendiente coincide con el t del r de Pearson", () => {
    const x = [1, 3, 4, 6, 8, 9, 11, 14];
    const y = [1, 2, 4, 4, 5, 7, 8, 9];
    const r = S.regresionLineal(x, y);
    const rho = S.pearson(x, y);
    const t = (rho * Math.sqrt(r.n - 2)) / Math.sqrt(1 - rho * rho);
    cerca(r.t, t, 1e-9);
    cerca(r.p, S.tSf2(t, r.n - 2), 1e-12);
  });

  test("null con n<3 o x constante", () => {
    assert.equal(S.regresionLineal([1, 2], [1, 2]), null);
    assert.equal(S.regresionLineal([1, 1, 1], [1, 2, 3]), null);
  });

  test("OLS múltiple recupera un plano exacto", () => {
    const x1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const x2 = [2, 1, 4, 3, 6, 5, 8, 7];
    const y = x1.map((v, i) => 5 + 2 * v - 3 * x2[i]);
    const r = S.regresionMultiple([x1, x2], y);
    cerca(r.interseccion, 5, 1e-9);
    cerca(r.coeficientes[0], 2, 1e-9);
    cerca(r.coeficientes[1], -3, 1e-9);
    cerca(r.r2, 1, 1e-12);
  });

  test("con un solo predictor, el múltiple = el simple", () => {
    const x = [1, 4, 2, 8, 5, 7, 3, 6];
    const y = [2, 5, 1, 9, 4, 8, 2, 7];
    const simple = S.regresionLineal(x, y);
    const multiple = S.regresionMultiple([x], y);
    cerca(multiple.r2, simple.r2, 1e-10);
    cerca(multiple.coeficientes[0], simple.pendiente, 1e-9);
    cerca(multiple.interseccion, simple.interseccion, 1e-9);
  });

  test("R² conjunto ≥ R² de cada predictor por separado", () => {
    const x1 = [1, 3, 2, 6, 5, 8, 4, 7, 9, 10];
    const x2 = [2, 1, 5, 4, 7, 6, 9, 8, 3, 10];
    const y = x1.map((v, i) => v * 1.5 + x2[i] * 0.5 + (i % 3));
    const r2a = S.regresionLineal(x1, y).r2;
    const r2b = S.regresionLineal(x2, y).r2;
    const r2ab = S.regresionMultiple([x1, x2], y).r2;
    assert.ok(r2ab >= r2a - 1e-12 && r2ab >= r2b - 1e-12);
  });

  test("null ante colinealidad exacta", () => {
    const x1 = [1, 2, 3, 4, 5, 6];
    const x2 = x1.map((v) => 2 * v);
    assert.equal(S.regresionMultiple([x1, x2], [1, 2, 3, 4, 5, 7]), null);
  });
});

/* ================================================================== */
describe("Bland-Altman", () => {
  test("orden de la diferencia: x − y (LOAD-BEARING)", () => {
    const x = [10, 20, 30, 40];
    const y = [8, 19, 26, 39];
    const ba = S.blandAltman(x, y);
    cerca(ba.sesgo, S.mean([2, 1, 4, 1]), 1e-12, "sesgo = media(x − y)");
    // Invertir el orden invierte el signo del sesgo y de la pendiente.
    const inv = S.blandAltman(y, x);
    cerca(inv.sesgo, -ba.sesgo, 1e-12);
    cerca(inv.pendiente, -ba.pendiente, 1e-12);
  });

  test("LoA 95 % = sesgo ± 1,96·DE y amplitud = 2·1,96·DE", () => {
    const x = [10, 20, 30, 40, 50, 60];
    const y = [12, 19, 33, 38, 52, 59];
    const ba = S.blandAltman(x, y);
    const dif = x.map((v, i) => v - y[i]);
    cerca(ba.deDiferencias, S.sd(dif), 1e-12, "DE muestral de las diferencias");
    cerca(ba.loaSuperior, ba.sesgo + 1.96 * ba.deDiferencias, 1e-12);
    cerca(ba.loaInferior, ba.sesgo - 1.96 * ba.deDiferencias, 1e-12);
    cerca(ba.amplitudLoA95, ba.loaSuperior - ba.loaInferior, 1e-10);
    cerca(ba.amplitudLoA95, 2 * 1.96 * ba.deDiferencias, 1e-12);
    assert.equal(S.LOA_Z, 1.96);
  });

  test("acuerdo perfecto: sesgo 0, LoA 0, sin sesgo proporcional", () => {
    const x = [1, 2, 3, 4, 5];
    const ba = S.blandAltman(x, x);
    cerca(ba.sesgo, 0, 1e-12);
    cerca(ba.amplitudLoA95, 0, 1e-12);
    cerca(ba.pendiente, 0, 1e-12);
    cerca(ba.discrepanciaMaximaAbs, 0, 1e-12);
  });

  test("sesgo proporcional: la pendiente sale de regresar dif sobre media", () => {
    const x = [10, 20, 30, 40, 50];
    const y = [10, 21, 32, 43, 54]; // la diferencia crece con la magnitud
    const ba = S.blandAltman(x, y);
    const dif = x.map((v, i) => v - y[i]);
    const prom = x.map((v, i) => (v + y[i]) / 2);
    cerca(ba.pendiente, S.regresionLineal(prom, dif).pendiente, 1e-12);
    assert.ok(ba.pendiente < 0);
  });

  test("discrepancia máxima es el |dif| más grande", () => {
    const ba = S.blandAltman([10, 20, 30, 40], [12, 20, 25, 41]);
    cerca(ba.discrepanciaMaximaAbs, 5, 1e-12);
  });
});

/* ================================================================== */
describe("Kruskal-Wallis", () => {
  test("grupos idénticos ⇒ H ≈ 0 y p ≈ 1", () => {
    const kw = S.kruskalWallis([
      { etiqueta: "a", valores: [1, 2, 3, 4] },
      { etiqueta: "b", valores: [1, 2, 3, 4] },
      { etiqueta: "c", valores: [1, 2, 3, 4] },
    ]);
    cerca(kw.H, 0, 1e-9);
    cerca(kw.p, 1, 1e-9);
    assert.equal(kw.k, 3);
    assert.equal(kw.gl, 2);
    assert.equal(kw.n, 12);
  });

  test("separación total ⇒ H máximo y p chico", () => {
    const kw = S.kruskalWallis([
      { etiqueta: "a", valores: [1, 2, 3, 4, 5] },
      { etiqueta: "b", valores: [11, 12, 13, 14, 15] },
      { etiqueta: "c", valores: [21, 22, 23, 24, 25] },
    ]);
    // H máximo con k=3, n=5 c/u: 12/(15·16)·(20²+50²+80²)/5 − 3·16 = 12,5
    cerca(kw.H, 12.5, 1e-9);
    assert.ok(kw.p < 0.005);
  });

  test("η²_H = (H − k + 1)/(N − k)", () => {
    const kw = S.kruskalWallis([
      { etiqueta: "a", valores: [1, 2, 3, 4, 5] },
      { etiqueta: "b", valores: [11, 12, 13, 14, 15] },
      { etiqueta: "c", valores: [21, 22, 23, 24, 25] },
    ]);
    cerca(kw.etaCuadradoH, (kw.H - kw.k + 1) / (kw.n - kw.k), 1e-12);
    cerca(kw.etaCuadradoH, (12.5 - 2) / 12, 1e-9);
  });

  test("con k=2 coincide con el z² de Mann-Whitney sin corregir", () => {
    const a = [1, 3, 5, 7, 9, 11];
    const b = [2, 4, 6, 8, 10, 12];
    const kw = S.kruskalWallis([
      { etiqueta: "a", valores: a },
      { etiqueta: "b", valores: b },
    ]);
    const n1 = a.length, n2 = b.length, N = n1 + n2;
    const rs = S.ranks([...a, ...b]);
    const R1 = rs.slice(0, n1).reduce((s, r) => s + r, 0);
    const U = R1 - (n1 * (n1 + 1)) / 2;
    const z = (U - (n1 * n2) / 2) / Math.sqrt((n1 * n2 * (N + 1)) / 12);
    cerca(kw.H, z * z, 1e-9);
  });

  test("corrección por empates aumenta H", () => {
    const conEmpates = [
      { etiqueta: "a", valores: [1, 1, 2, 2] },
      { etiqueta: "b", valores: [3, 3, 4, 4] },
    ];
    const kw = S.kruskalWallis(conEmpates);
    // H sin corregir, calculado a mano sobre los rangos promediados
    const rs = S.ranks([1, 1, 2, 2, 3, 3, 4, 4]);
    const R1 = rs.slice(0, 4).reduce((s, r) => s + r, 0);
    const R2 = rs.slice(4).reduce((s, r) => s + r, 0);
    const N = 8;
    const sinCorregir = (12 / (N * (N + 1))) * ((R1 ** 2 + R2 ** 2) / 4) - 3 * (N + 1);
    assert.ok(kw.H > sinCorregir, `${kw.H} debería superar ${sinCorregir}`);
  });

  test("null con menos de 2 grupos no vacíos", () => {
    assert.equal(S.kruskalWallis([{ etiqueta: "a", valores: [1, 2, 3] }]), null);
    assert.equal(
      S.kruskalWallis([
        { etiqueta: "a", valores: [1, 2] },
        { etiqueta: "b", valores: [] },
      ]),
      null,
    );
  });
});

/* ================================================================== */
describe("Mann-Whitney U", () => {
  test("U1 + U2 = n1·n2", () => {
    const mw = S.mannWhitney([1, 3, 5, 7], [2, 4, 6, 8, 10]);
    assert.equal(mw.U + mw.U2, 4 * 5);
  });

  test("separación total ⇒ U = 0 y p exacto = 2/C(n1+n2,n1)", () => {
    const mw = S.mannWhitney([1, 2, 3, 4], [11, 12, 13, 14, 15]);
    assert.equal(mw.U, 0);
    assert.equal(mw.exacto, true);
    // C(9,4) = 126; una sola de las 126 asignaciones da U=0
    cerca(mw.pUnaCola, 1 / 126, 1e-12);
    cerca(mw.pDosColas, 2 / 126, 1e-12);
  });

  test("la distribución exacta suma 1 y es simétrica", () => {
    // Muestras espejadas ⇒ U = n1·n2/2 ⇒ p a una cola ≈ 0,5
    const mw = S.mannWhitney([1, 4, 5, 8], [2, 3, 6, 7]);
    assert.equal(mw.U + mw.U2, 16);
    assert.equal(mw.U, 8);
    cerca(mw.pUnaCola, 0.5, 0.15);
  });

  test("caso de referencia n1=3 n2=4 verificado por enumeración", () => {
    // Con U=0 y n1=3, n2=4: C(7,3)=35 asignaciones, una sola da U=0
    const mw = S.mannWhitney([1, 2, 3], [4, 5, 6, 7]);
    assert.equal(mw.U, 0);
    cerca(mw.pUnaCola, 1 / 35, 1e-12);
  });

  test("con empates cae en la aproximación normal", () => {
    const mw = S.mannWhitney([1, 2, 3, 4], [4, 5, 6, 7]);
    assert.equal(mw.exacto, false);
    assert.ok(mw.pDosColas > 0 && mw.pDosColas <= 1);
  });

  test("forzarNormal usa la aproximación aunque no haya empates", () => {
    const exacto = S.mannWhitney([1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]);
    const normal = S.mannWhitney([1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], {
      forzarNormal: true,
    });
    assert.equal(exacto.exacto, true);
    assert.equal(normal.exacto, false);
    assert.equal(exacto.U, normal.U);
    // Ambas rutas tienen que coincidir en el orden de magnitud del p.
    assert.ok(Math.abs(exacto.pUnaCola - normal.pUnaCola) < 0.01);
  });

  test("null con alguna muestra vacía", () => {
    assert.equal(S.mannWhitney([], [1, 2]), null);
    assert.equal(S.mannWhitney([1, 2], []), null);
  });
});

/* ================================================================== */
describe("Wilcoxon de rangos con signo", () => {
  test("todas las diferencias del mismo signo ⇒ p exacto = 2/2ⁿ", () => {
    const a = [10, 20, 30, 40, 50, 60, 70, 80];
    const b = a.map((v, i) => v - (i + 1)); // |d| distintos ⇒ sin empates
    const w = S.wilcoxonSignedRank(a, b);
    assert.equal(w.exacto, true);
    assert.equal(w.W, 0);
    assert.equal(w.aMayorQueB, 8);
    cerca(w.p, 2 / 2 ** 8, 1e-12);
  });

  test("W = min(W⁺, W⁻) y W⁺ + W⁻ = n(n+1)/2", () => {
    const a = [5, 9, 2, 8, 14, 6, 11];
    const b = [4, 11, 6, 7, 9, 10, 3];
    const w = S.wilcoxonSignedRank(a, b);
    assert.equal(w.wMas + w.wMenos, (w.n * (w.n + 1)) / 2);
    assert.equal(w.W, Math.min(w.wMas, w.wMenos));
  });

  test("los pares con diferencia 0 se descartan (Wilcoxon 1945)", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 8, 16, 32];
    const w = S.wilcoxonSignedRank(a, b);
    assert.equal(w.nCeros, 2);
    assert.equal(w.n, 3);
  });

  test("caso verificado contra la enumeración de los 2ⁿ signos", () => {
    // d = +1,−2,+3,−4,+5,−6,+7,−8,+9,−10 ⇒ W⁺ = 1+3+5+7+9 = 25
    const d = [1, -2, 3, -4, 5, -6, 7, -8, 9, -10];
    const w = S.wilcoxonSignedRank(d, d.map(() => 0));
    assert.equal(w.exacto, true);
    assert.equal(w.W, 25);
    // Enumeración directa de los 2¹⁰ subconjuntos de rangos.
    let acum = 0;
    for (let mask = 0; mask < 1 << 10; mask++) {
      let s = 0;
      for (let i = 0; i < 10; i++) if (mask & (1 << i)) s += i + 1;
      if (s <= 25) acum++;
    }
    cerca(w.p, (2 * acum) / 2 ** 10, 1e-12);
  });

  test("con empates en |d| cae en la aproximación normal", () => {
    const a = [1, 2, 3, 4, 5, 6];
    const b = [3, 4, 5, 6, 7, 8]; // todas las |d| = 2
    const w = S.wilcoxonSignedRank(a, b);
    assert.equal(w.exacto, false);
  });

  test("diferenciaMedia y aMayorQueB describen la dirección del efecto", () => {
    const w = S.wilcoxonSignedRank([10, 20, 30, 40], [12, 15, 33, 31]);
    cerca(w.diferenciaMedia, S.mean([-2, 5, -3, 9]), 1e-12);
    assert.equal(w.aMayorQueB, 2);
  });

  test("null con largos distintos o series vacías", () => {
    assert.equal(S.wilcoxonSignedRank([1, 2], [1]), null);
    assert.equal(S.wilcoxonSignedRank([], []), null);
  });
});

/* ================================================================== */
describe("helpers de redondeo", () => {
  test("round y roundOrNull", () => {
    assert.equal(S.round(0.91134, 3), 0.911);
    assert.equal(S.round(2.0552, 2), 2.06);
    assert.equal(S.roundOrNull(null), null);
    assert.equal(S.roundOrNull(undefined), null);
    assert.equal(S.roundOrNull(NaN), null);
    assert.equal(S.roundOrNull(1.23456, 2), 1.23);
  });
});
