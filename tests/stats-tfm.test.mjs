/**
 * GATE — el motor estadístico tiene que reproducir el TFM al dígito.
 * ==================================================================
 * Fuente de los valores esperados: "Estudio comparativo de metodologías
 * cuantitativas para el análisis tafonómico de restos óseos humanos"
 * (TFM de Martina Fay, defendido), Tablas 1–7c. Transcritos leyendo el PDF,
 * no de memoria.
 *
 * 🔒 ESTO NO ES UN NICE-TO-HAVE. Si `convex/lib/stats.ts` o
 * `convex/lib/poblacional.ts` dejan de reproducir estos números, la app estaría
 * contradiciendo un trabajo ya defendido. No se relajan las tolerancias para
 * hacer pasar el test: se arregla el motor, o se documenta la discrepancia.
 *
 * Tolerancias: los valores publicados vienen redondeados a 2–3 decimales, así
 * que se compara con media unidad del último decimal impreso. Los p-valores
 * publicados como "<0,0001" se testean como una cota superior.
 *
 * Fixture: `fixtures/tfm-n62.json`, de-identificado (sitio + métricas ya
 * persistidas por `lib/metrics.ts`; sin código canónico, fosa ni UF). Este repo
 * es público — ver la nota dentro del propio fixture.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  analizarPoblacion,
  construirFila,
  ZONAS_NUCLEO,
  ZONAS_MANOS_PIES,
  UMBRAL_COMPLETITUD_EXTREMA,
} from "../convex/lib/poblacional.ts";
import { ZONATION_TOTAL_ZONES } from "../convex/lib/metrics.ts";

/* ── carga del fixture ─────────────────────────────────────────────────── */

const fixture = JSON.parse(
  fs.readFileSync(new URL("./fixtures/tfm-n62.json", import.meta.url), "utf8"),
);

const filas = fixture.filas.map((f, i) =>
  construirFila(
    {
      _id: `fixture-${i}`,
      codigoCanonico: `FIXTURE-${String(i + 1).padStart(2, "0")}`,
      sitio: f.sitio,
    },
    f.zonacion,
    f.eat,
  ),
);

const A = analizarPoblacion(filas);

/* ── helpers ───────────────────────────────────────────────────────────── */

/** Igualdad contra un valor publicado, con tolerancia de redondeo. */
const pub = (got, esperado, tol, etiqueta) =>
  assert.ok(
    got !== null && Math.abs(got - esperado) <= tol,
    `${etiqueta}: got=${got} · TFM=${esperado} (tol ${tol})`,
  );

/** 2 decimales publicados ⇒ ±0,005. */
const pub2 = (got, esperado, etiqueta) => pub(got, esperado, 0.005, etiqueta);
/** 3 decimales publicados ⇒ ±0,0005. */
const pub3 = (got, esperado, etiqueta) => pub(got, esperado, 0.0005, etiqueta);
/** 1 decimal publicado ⇒ ±0,05. */
const pub1 = (got, esperado, etiqueta) => pub(got, esperado, 0.05, etiqueta);

const kw = (nombre) => A.variabilidadPorSitio.find((v) => v.variable === nombre);
const elem = (etiqueta) => A.porElemento.find((e) => e.etiqueta === etiqueta);
const wil = (sitio) => A.manosPiesVsNucleo.wilcoxonPorSitio.find((w) => w.sitio === sitio);

/* ================================================================== */
describe("integridad del fixture y de la derivación", () => {
  test("n = 62, pareados, sin filas descartadas", () => {
    assert.equal(fixture.n, 62);
    assert.equal(filas.length, 62);
    assert.ok(filas.every((f) => f !== null));
  });

  test("composición por sitio: Albarracín 12 · Villar 16 · Castellón 34", () => {
    const porSitio = {};
    for (const f of filas) porSitio[f.sitio] = (porSitio[f.sitio] ?? 0) + 1;
    assert.deepEqual(porSitio, { "Albarracín": 12, "Castellón": 34, Villar: 16 });
  });

  test("denominadores: 635 = 363 (núcleo) + 272 (manos+pies)", () => {
    assert.equal(ZONATION_TOTAL_ZONES, 635);
    assert.equal(ZONAS_NUCLEO, 363);
    assert.equal(ZONAS_MANOS_PIES, 272);
    assert.equal(ZONAS_NUCLEO + ZONAS_MANOS_PIES, ZONATION_TOTAL_ZONES);
  });

  test("la reconstrucción de zonas por elemento cierra con zonasPresentes", () => {
    assert.equal(
      A.diagnostico.filasConReconstruccionIncoherente,
      0,
      `filas incoherentes: ${A.diagnostico.codigosIncoherentes.join(", ")}`,
    );
  });

  test("construirFila devuelve null si falta alguna de las dos métricas", () => {
    const base = { _id: "x", codigoCanonico: "X", sitio: "S" };
    assert.equal(construirFila(base, null, fixture.filas[0].eat), null);
    assert.equal(construirFila(base, fixture.filas[0].zonacion, null), null);
  });
});

/* ================================================================== */
describe("Tabla 1 — descriptivos globales (μ ± σ, n=62)", () => {
  const esperado = [
    ["completitudGlobal", 82.4, 19.36, "Completitud zonación original /635"],
    ["completitudNucleo", 78.76, 26.87, "Completitud zonación núcleo /363"],
    ["ipo", 80.34, 24.45, "IPO"],
    ["ich", 78.32, 21.09, "ICH"],
    ["eat", 32.65, 29.27, "EAT"],
  ];
  for (const [clave, mu, sigma, etiqueta] of esperado) {
    test(`${etiqueta} = ${mu} ± ${sigma}`, () => {
      const d = A.descriptivos[clave];
      assert.equal(d.n, 62);
      pub2(d.media, mu, `${etiqueta} μ`);
      pub2(d.de, sigma, `${etiqueta} σ (muestral, N−1)`);
    });
  }

  test("σ es el MUESTRAL (N−1), no el poblacional", () => {
    // El poblacional daría 19,21 para la completitud global: distinguirlos importa.
    pub2(A.descriptivos.completitudGlobal.de, 19.36, "σ muestral");
    assert.ok(Math.abs(A.descriptivos.completitudGlobal.de - 19.21) > 0.1);
  });
});

/* ================================================================== */
describe("Tabla 2 — ICH por sitio", () => {
  const esperado = [
    ["Castellón", 34, 63.58, 17.92],
    ["Albarracín", 12, 96.49, 2.26],
    ["Villar", 16, 96.04, 2.38],
  ];
  for (const [sitio, n, mu, sigma] of esperado) {
    test(`${sitio}: n=${n}, ICH = ${mu} ± ${sigma}`, () => {
      const s = A.ichPorSitio.find((x) => x.sitio === sitio);
      assert.equal(s.n, n);
      pub2(s.media, mu, `${sitio} μ`);
      pub2(s.de, sigma, `${sitio} σ`);
    });
  }
});

/* ================================================================== */
describe("Tabla 3 — concordancia sobre toda la muestra (635 zonas)", () => {
  const t3 = () => A.concordancia.global;

  test("r de Pearson = 0,911", () => pub3(t3().rPearson, 0.911, "r"));
  test("CCC de Lin = 0,883", () => pub3(t3().cccLin, 0.883, "CCC"));
  test("Sesgo (Bland-Altman) = 2,06", () => pub2(t3().sesgo, 2.06, "sesgo"));
  test("Pendiente (sesgo proporcional) = −0,243", () =>
    pub3(t3().pendiente, -0.243, "pendiente"));
  test("p de la pendiente < 0,0001", () =>
    assert.ok(t3().pendienteP < 0.0001, `p = ${t3().pendienteP}`));
  test("Amplitud LoA 95 % = 41,08", () => pub2(t3().amplitudLoA95, 41.08, "amplitud LoA"));

  test("el sesgo es zonación − IPO (μ 82,40 − 80,34 = +2,06)", () => {
    const dif = A.descriptivos.completitudGlobal.media - A.descriptivos.ipo.media;
    pub2(t3().sesgo, dif, "sesgo = Δ de medias");
    assert.ok(t3().sesgo > 0, "el signo POSITIVO es load-bearing");
  });

  test("la amplitud de los LoA es la distancia entre los dos límites", () => {
    pub2(t3().amplitudLoA95, t3().loaSuperior - t3().loaInferior, "amplitud");
  });
});

/* ================================================================== */
describe("Tabla 4 — concordancia excluyendo manos y pies (núcleo /363)", () => {
  const t4 = () => A.concordancia.nucleo;

  test("r de Pearson = 0,948", () => pub3(t4().rPearson, 0.948, "r"));
  test("CCC de Lin = 0,942", () => pub3(t4().cccLin, 0.942, "CCC"));
  test("Sesgo = −1,58", () => pub2(t4().sesgo, -1.58, "sesgo"));
  test("Pendiente = 0,097 (p = 0,024)", () => {
    pub3(t4().pendiente, 0.097, "pendiente");
    pub(t4().pendienteP, 0.024, 0.0005, "p de la pendiente");
  });
  test("Amplitud LoA 95 % = 33,67", () => pub2(t4().amplitudLoA95, 33.67, "amplitud LoA"));
  test("discrepancia individual máxima = 28,08", () =>
    pub2(t4().discrepanciaMaximaAbs, 28.08, "discrepancia máxima"));

  test("excluir manos y pies mejora el acuerdo y reduce el sesgo proporcional", () => {
    assert.ok(A.concordancia.nucleo.cccLin > A.concordancia.global.cccLin);
    assert.ok(
      Math.abs(A.concordancia.nucleo.pendiente) <
        Math.abs(A.concordancia.global.pendiente),
    );
    assert.ok(A.concordancia.nucleo.amplitudLoA95 < A.concordancia.global.amplitudLoA95);
  });
});

/* ================================================================== */
describe("Casos extremos — control sin los 2 individuos de completitud <5 % (n=60)", () => {
  const c = () => A.concordancia.controlSinExtremos;

  /**
   * ⚠️ DOBLE REDONDEO EN EL TFM (documentado, no es un error del motor).
   *
   * Esta tabla auxiliar del TFM está transcrita desde un intermedio de 4
   * decimales, no desde el valor pleno. Tres de sus seis celdas quedan a
   * ~0,0005 del valor exacto:
   *
   *   r (/635)        exacto 0,8904650 → 4 dec 0,8905 → publicado 0,891
   *   CCC (/635)      exacto 0,7974621 → 4 dec 0,7975 → publicado 0,798
   *   p pend (núcleo) exacto 0,0074900 → 4 dec 0,0075 → publicado 0,008
   *
   * El redondeo en dos pasos (4 → 3 decimales) explica las 6 celdas de esta
   * tabla Y las 9 celdas de las Tablas 3 y 4, sin excepción — por eso se
   * concluye que el motor es correcto y el artefacto es de transcripción.
   * Las Tablas 1, 2, 5, 6, 7, 7b y 7c coinciden al dígito de forma directa.
   *
   * Se usa tolerancia 0,001 SOLO en este bloque. No extender a los demás.
   */
  const TOL_DOBLE_REDONDEO = 0.001;
  const pubC = (got, esperado, etiqueta) =>
    pub(got, esperado, TOL_DOBLE_REDONDEO, etiqueta);

  test("se excluyen exactamente 2 individuos, ambos de Castellón", () => {
    assert.equal(c().excluidos.length, 2);
    assert.ok(c().excluidos.every((e) => e.sitio === "Castellón"));
    assert.ok(c().excluidos.every((e) => e.completitudGlobal < UMBRAL_COMPLETITUD_EXTREMA));
    assert.equal(c().global.n, 60);
  });

  test("el redondeo en dos pasos (4 → 3 dec) reproduce las 6 celdas publicadas", () => {
    const dosPasos = (x) => Math.round((Math.round(x * 1e4) / 1e4) * 1e3) / 1e3;
    assert.equal(dosPasos(c().global.rPearson), 0.891, "r /635");
    assert.equal(dosPasos(c().global.cccLin), 0.798, "CCC /635");
    assert.equal(dosPasos(c().global.pendiente), -0.476, "pendiente /635");
    assert.equal(dosPasos(c().nucleo.cccLin), 0.918, "CCC núcleo");
    assert.equal(dosPasos(c().nucleo.pendiente), 0.14, "pendiente núcleo");
    assert.equal(dosPasos(c().nucleo.pendienteP), 0.008, "p pendiente núcleo");
  });

  test("r de Pearson (/635) = 0,891", () => pubC(c().global.rPearson, 0.891, "r /635"));
  test("CCC de Lin (/635) = 0,798", () => pubC(c().global.cccLin, 0.798, "CCC /635"));
  test("Pendiente (/635) = −0,476", () => pub3(c().global.pendiente, -0.476, "pendiente /635"));
  test("CCC de Lin (núcleo) = 0,918", () => pub3(c().nucleo.cccLin, 0.918, "CCC núcleo"));
  test("Pendiente (núcleo) = 0,140 (p = 0,008)", () => {
    pub3(c().nucleo.pendiente, 0.14, "pendiente núcleo");
    pubC(c().nucleo.pendienteP, 0.008, "p de la pendiente núcleo");
  });

  test("el patrón se mantiene: la pendiente del núcleo sigue significativa", () => {
    assert.ok(c().nucleo.pendienteP < 0.05);
    assert.ok(Math.abs(c().global.sesgo) > Math.abs(c().nucleo.sesgo));
  });
});

/* ================================================================== */
describe("Tabla 5 — relación algebraica y empírica entre EAT, IPO e ICH", () => {
  const t5 = () => A.relacionEatIpoIch;

  test("diferencia media EAT vs (100−IPO) = 12,99 pts", () =>
    pub2(t5().diferenciaMediaEatVsPresencia, 12.99, "Δ media"));
  test("DE de esa diferencia = 10,63 pts", () => pub2(t5().deDiferencia, 10.63, "DE de Δ"));
  test("esa diferencia como % del EAT medio = 39,8 %", () =>
    pub1(t5().pctDelEatMedio, 39.8, "% del EAT medio"));

  test("correlación ICH ↔ IPO: ρ de Spearman = 0,827", () =>
    pub3(t5().rhoIchIpo, 0.827, "ρ Spearman"));

  test("⚠️ Pearson sobre ese par NO reproduce el TFM (0,872 ≠ 0,827)", () => {
    // Guardarraíl explícito: el ICH es semicuantitativo, corresponde Spearman.
    pub3(t5().rPearsonIchIpo, 0.872, "r de Pearson ICH↔IPO");
    assert.ok(
      Math.abs(t5().rPearsonIchIpo - 0.827) > 0.04,
      "si Pearson empezara a coincidir con 0,827, algo cambió en los datos",
    );
  });

  test("R² de EAT explicado por el IPO = 0,878", () => pub3(t5().r2EatPorIpo, 0.878, "R² IPO"));
  test("R² de EAT explicado por el ICH = 0,882", () => pub3(t5().r2EatPorIch, 0.882, "R² ICH"));
  test("R² del modelo conjunto IPO + ICH = 0,940", () =>
    pub3(t5().r2Conjunto, 0.94, "R² conjunto"));
  test("incremento de R² del conjunto sobre el modelo solo-IPO = 0,062", () =>
    pub3(t5().incrementoR2, 0.062, "ΔR²"));

  test("el incremento es exactamente R² conjunto − R² solo-IPO", () => {
    pub(t5().incrementoR2, t5().r2Conjunto - t5().r2EatPorIpo, 1e-9, "ΔR² consistente");
  });
});

/* ================================================================== */
describe("Tabla 6 — variabilidad por sitio (Kruskal-Wallis, n=62, k=3)", () => {
  const esperado = [
    ["ich", 45.11, 0.731],
    ["eat", 45.38, 0.735],
    ["ipo", 41.48, 0.669],
    ["completitudNucleo", 45.27, 0.733],
    ["completitudGlobal", 25.88, 0.405],
  ];
  for (const [variable, H, eta] of esperado) {
    test(`${variable}: H = ${H} · p < 0,0001 · η²_H = ${eta}`, () => {
      const k = kw(variable);
      assert.equal(k.n, 62);
      assert.equal(k.k, 3);
      assert.equal(k.gl, 2);
      pub2(k.H, H, `${variable} H`);
      pub3(k.etaCuadradoH, eta, `${variable} η²_H`);
      assert.ok(k.p < 0.0001, `${variable} p = ${k.p}`);
    });
  }

  test("η²_H se calcula como (H − k + 1)/(N − k)", () => {
    for (const k of A.variabilidadPorSitio) {
      pub(k.etaCuadradoH, (k.H - k.k + 1) / (k.n - k.k), 1e-4, `${k.variable} η²_H`);
    }
  });

  test("el efecto del sitio es menor sobre /635 que sobre el núcleo /363", () => {
    assert.ok(kw("completitudGlobal").etaCuadradoH < kw("completitudNucleo").etaCuadradoH);
  });
});

/* ================================================================== */
describe("Tabla 7 — completitud media por elemento anatómico (18 elementos)", () => {
  // [etiqueta, % del denominador, completitud media, % en 0 %, % en 100 %]
  const TABLA_7 = [
    ["Vértebras", 15.1, 62.03, 24.2, 50.0],
    ["Costillas", 11.3, 72.47, 24.2, 54.8],
    ["Cráneo", 2.4, 73.44, 3.2, 46.8],
    ["Esternón", 0.5, 75.27, 3.2, 38.7],
    ["Coxal", 3.8, 77.08, 9.7, 61.3],
    ["Sacro", 0.6, 82.66, 9.7, 74.2],
    ["Pie", 22.4, 84.96, 3.2, 14.5],
    ["Mandíbula", 1.1, 88.02, 4.8, 71.0],
    ["Escápula", 2.8, 89.43, 3.2, 74.2],
    ["Mano", 20.5, 89.75, 0.0, 17.7],
    ["Tibia", 3.1, 92.82, 3.2, 85.5],
    ["Fémur", 3.5, 93.04, 3.2, 82.3],
    ["Clavícula", 0.9, 93.55, 3.2, 83.9],
    ["Húmero", 3.5, 94.13, 1.6, 77.4],
    ["Peroné", 1.9, 94.22, 3.2, 85.5],
    ["Cúbito", 2.8, 95.34, 1.6, 87.1],
    ["Radio", 3.5, 95.75, 1.6, 83.9],
    ["Rótula", 0.3, 96.77, 1.6, 95.2],
  ];

  test("los 18 elementos están presentes", () => {
    assert.equal(A.porElemento.length, 18);
    for (const [etiqueta] of TABLA_7) assert.ok(elem(etiqueta), `falta ${etiqueta}`);
  });

  for (const [etiqueta, pctDen, media, en0, en100] of TABLA_7) {
    test(`${etiqueta}: ${pctDen} % del denominador · media ${media} % · 0 %: ${en0} · 100 %: ${en100}`, () => {
      const e = elem(etiqueta);
      pub1(e.pctDelDenominador, pctDen, `${etiqueta} % del denominador`);
      pub2(e.completitudMedia, media, `${etiqueta} completitud media`);
      pub1(e.pctEn0, en0, `${etiqueta} % en 0`);
      pub1(e.pctEn100, en100, `${etiqueta} % en 100`);
    });
  }

  test("el orden publicado es de peor a mejor conservado", () => {
    const ordenTfm = TABLA_7.map(([e]) => e);
    assert.deepEqual(A.porElemento.map((e) => e.etiqueta), ordenTfm);
  });

  test("los % del denominador suman 100", () => {
    const suma = A.porElemento.reduce((a, e) => a + e.zonasMaximas, 0);
    assert.equal(suma, ZONATION_TOTAL_ZONES);
  });
});

/* ================================================================== */
describe("Tabla 7 — cortical vs esponjoso (Mann-Whitney)", () => {
  const c = () => A.corticalVsEsponjoso;

  test("agrupación: 8 corticales vs 10 esponjosos", () => {
    assert.equal(c().nCortical, 8);
    assert.equal(c().nEsponjoso, 10);
  });

  test("completitud media cortical = 93,36 %", () =>
    pub2(c().mediaCortical, 93.36, "media cortical"));
  test("completitud media esponjoso = 80,39 %", () =>
    pub2(c().mediaEsponjoso, 80.39, "media esponjoso"));

  test("U = 70", () => assert.equal(c().U, 70));
  test("p = 0,0031 a una cola (hipótesis direccional)", () =>
    pub(c().pUnaCola, 0.0031, 0.00005, "p a una cola"));
  test("p = 0,0062 a dos colas", () => pub(c().pDosColas, 0.0062, 0.0001, "p a dos colas"));

  test("el p-valor sale de la distribución EXACTA, no de la normal", () => {
    // La aproximación normal daría ≈0,0044 a una cola: no reproduce el TFM.
    assert.equal(c().exacto, true);
  });
});

/* ================================================================== */
describe("Tabla 7b/7c — manos+pies vs núcleo", () => {
  test("medias globales (Tabla 7): manos+pies 87,25 % · núcleo 78,76 %", () => {
    pub2(A.manosPiesVsNucleo.globalManosPies, 87.25, "manos+pies");
    pub2(A.manosPiesVsNucleo.globalNucleo, 78.76, "núcleo");
  });

  test("Tabla 7b/7c se calculan sobre n=60 (sin los 2 casos extremos)", () => {
    assert.equal(A.manosPiesVsNucleo.n, 60);
    assert.equal(wil("Castellón").n, 32, "el n=32* de Castellón");
    assert.equal(wil("Albarracín").n, 12);
    assert.equal(wil("Villar").n, 16);
  });

  // [sitio, n, manos+pies %, núcleo %, brecha pp, individuos manos+pies > núcleo]
  const TABLA_7C = [
    ["Albarracín", 12, 86.64, 99.4, -12.76, 2],
    ["Castellón", 32, 93.13, 65.34, 27.79, 29],
    ["Villar", 16, 86.44, 99.69, -13.25, 0],
  ];
  for (const [sitio, n, mp, nu, brecha, mayores] of TABLA_7C) {
    test(`${sitio}: n=${n} · manos+pies ${mp} % · núcleo ${nu} % · brecha ${brecha} pp`, () => {
      const w = wil(sitio);
      assert.equal(w.n, n);
      pub2(w.manosPiesMedia, mp, `${sitio} manos+pies`);
      pub2(w.nucleoMedia, nu, `${sitio} núcleo`);
      pub2(w.brechaPp, brecha, `${sitio} brecha`);
      assert.equal(w.individuosManosPiesMayor, mayores, `${sitio} individuos mp>núcleo`);
    });
  }

  test("Wilcoxon Albarracín: p = 0,0024", () =>
    pub(wil("Albarracín").p, 0.0024, 0.00005, "p Albarracín"));
  test("Wilcoxon Castellón: p < 0,0001", () =>
    assert.ok(wil("Castellón").p < 0.0001, `p = ${wil("Castellón").p}`));
  test("Wilcoxon Villar: p < 0,0001", () =>
    assert.ok(wil("Villar").p < 0.0001, `p = ${wil("Villar").p}`));

  test("Kruskal-Wallis manos+pies: H = 7,37 · p = 0,025 (n=60)", () => {
    const k = A.manosPiesVsNucleo.kruskalWallisManosPies;
    assert.equal(k.n, 60);
    pub2(k.H, 7.37, "H manos+pies");
    pub(k.p, 0.025, 0.0005, "p manos+pies");
  });

  test("Kruskal-Wallis núcleo (n=60): H = 44,02 · p < 0,0001 · η²_H = 0,737", () => {
    const k = A.manosPiesVsNucleo.kruskalWallisNucleo;
    assert.equal(k.n, 60);
    pub2(k.H, 44.02, "H núcleo");
    pub3(k.etaCuadradoH, 0.737, "η²_H núcleo");
    assert.ok(k.p < 0.0001, `p = ${k.p}`);
  });

  test("la dirección se invierte entre Castellón y los otros dos sitios", () => {
    assert.ok(wil("Castellón").brechaPp > 0);
    assert.ok(wil("Albarracín").brechaPp < 0);
    assert.ok(wil("Villar").brechaPp < 0);
  });
});

/* ================================================================== */
describe("correlaciones H1–H3 (compatibilidad con analisis.comparacion)", () => {
  test("las 4 Spearman históricas siguen presentes y redondeadas a 3 decimales", () => {
    for (const k of [
      "ipo_vs_completitud",
      "eat_vs_afectacionZonacion",
      "ich_vs_completitud",
      "ich_vs_ffi",
    ]) {
      const v = A.correlaciones[k];
      assert.ok(v === null || (v >= -1 && v <= 1), `${k} fuera de rango: ${v}`);
      if (v !== null) assert.equal(v, Math.round(v * 1000) / 1000, `${k} sin redondear`);
    }
  });

  test("H1 — IPO ↔ completitud: correlación fuerte (validez convergente)", () => {
    assert.ok(A.correlaciones.ipo_vs_completitud > 0.8);
  });
});
