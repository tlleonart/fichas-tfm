/**
 * Motor estadístico poblacional — funciones puras.
 * ================================================
 * Mismo contrato que `lib/metrics.ts`: SIN imports de Convex, por lo que se
 * puede testear offline con el runner de Node (`tests/*.test.mjs`).
 *
 * Alcance
 * -------
 * Reproduce, al dígito, la batería estadística publicada en el TFM
 * ("Estudio comparativo de metodologías cuantitativas para el análisis
 * tafonómico de restos óseos humanos", Tablas 1–7c). Los tests de
 * `tests/stats-tfm.test.mjs` pinean los valores publicados: si esta librería
 * deja de reproducirlos, el gate falla.
 *
 * 🔒 REGLA DURA — esta librería NO calcula métricas individuales.
 * IPO, ICH, EAT y completitud salen de `lib/metrics.ts` (única fuente de
 * verdad) y llegan acá ya calculados y persistidos en `fichas.metricas`.
 * Acá solo se agrega, se correlaciona y se contrasta.
 *
 * Convenciones
 * ------------
 * - Todas las funciones devuelven `null` cuando la muestra es insuficiente o
 *   degenerada (varianza cero). Nunca `NaN`, nunca una excepción.
 * - Los resultados NO vienen redondeados: el redondeo es presentación y lo
 *   aplica la capa de query (`convex/analisis.ts`).
 * - `r`, `CCC`, regresión y Bland-Altman usan Pearson (variables continuas).
 *   La correlación ICH↔IPO usa Spearman porque el ICH es SEMICUANTITATIVO
 *   (escala de calidad); Pearson sobre ese par da 0,872 y el TFM reporta
 *   ρ=0,827 (Tabla 5). No son intercambiables — ver `docs/metodologia.md` §3.4.
 *
 * Funciones especiales (§ "Numérica"): las aproximaciones de las funciones
 * gamma incompleta y beta incompleta están tomadas de Press et al.,
 * *Numerical Recipes in C*, 2ª ed., §6.1–6.4. Son deterministas y no dependen
 * de ninguna librería externa (el bundler de Convex no admite dependencias
 * nativas y queremos que el resultado sea idéntico en test y en producción).
 */

/* ================================================================== */
/*  0. Utilidades numéricas básicas                                    */
/* ================================================================== */

/** Redondeo a `d` decimales (helper de presentación, expuesto para la query). */
export function round(n: number, d = 3): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Redondeo tolerante a `null` (el caso "n insuficiente" del payload). */
export function roundOrNull(n: number | null | undefined, d = 3): number | null {
  return n === null || n === undefined || !Number.isFinite(n) ? null : round(n, d);
}

const finite = (xs: readonly number[]): number[] => xs.filter((x) => Number.isFinite(x));

export function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Suma de cuadrados centrada, Σ(x−x̄)². */
function ss(xs: readonly number[], m = mean(xs)): number {
  return xs.reduce((a, b) => a + (b - m) ** 2, 0);
}

/** Varianza MUESTRAL (denominador N−1). */
export function variance(xs: readonly number[]): number {
  return xs.length < 2 ? 0 : ss(xs) / (xs.length - 1);
}

/** Varianza POBLACIONAL (denominador N) — la que usa el CCC de Lin. */
export function varianceP(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : ss(xs) / xs.length;
}

/** Desvío estándar MUESTRAL (N−1). Es el σ que reporta la Tabla 1 del TFM. */
export function sd(xs: readonly number[]): number {
  return Math.sqrt(variance(xs));
}

/** Desvío estándar POBLACIONAL (N). */
export function sdP(xs: readonly number[]): number {
  return Math.sqrt(varianceP(xs));
}

/** Covarianza POBLACIONAL (denominador N) — la que usa el CCC de Lin. */
export function covarianceP(x: readonly number[], y: readonly number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const mx = mean(x);
  const my = mean(y);
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my);
  return s / n;
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export interface Descriptivos {
  n: number;
  media: number | null;
  /** Desvío estándar MUESTRAL (N−1) — el σ de la Tabla 1. */
  de: number | null;
  mediana: number | null;
  min: number | null;
  max: number | null;
}

/** μ / σ / mediana / rango de una serie. Ignora los no-finitos. */
export function descriptivos(xsRaw: readonly number[]): Descriptivos {
  const xs = finite(xsRaw);
  if (xs.length === 0) {
    return { n: 0, media: null, de: null, mediana: null, min: null, max: null };
  }
  return {
    n: xs.length,
    media: mean(xs),
    de: xs.length < 2 ? 0 : sd(xs),
    mediana: median(xs),
    min: Math.min(...xs),
    max: Math.max(...xs),
  };
}

/** Proporción (0–1) de valores exactamente iguales a `valor`, con tolerancia. */
export function proporcionIgualA(xs: readonly number[], valor: number, tol = 1e-9): number {
  if (xs.length === 0) return 0;
  return xs.filter((x) => Math.abs(x - valor) <= tol).length / xs.length;
}

/* ================================================================== */
/*  1. Funciones especiales (Numerical Recipes in C, 2ª ed.)           */
/* ================================================================== */

/** ln Γ(x) — aproximación de Lanczos (NR §6.1, `gammln`). |ε| < 2e-10. */
function gammln(xx: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  const x = xx;
  let y = xx;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

const ITMAX = 500;
const EPS = 3e-16;
const FPMIN = 1e-300;

/** Serie para la gamma incompleta regularizada P(a,x) (NR §6.2, `gser`). */
function gser(a: number, x: number): number {
  if (x <= 0) return 0;
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 0; n < ITMAX; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - gammln(a));
}

/** Fracción continua para Q(a,x) = 1 − P(a,x) (NR §6.2, `gcf`, Lentz). */
function gcf(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - gammln(a)) * h;
}

/** Gamma incompleta regularizada P(a,x) = γ(a,x)/Γ(a). */
export function gammaIncompletaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  return x < a + 1 ? gser(a, x) : 1 - gcf(a, x);
}

/** Gamma incompleta complementaria Q(a,x) = 1 − P(a,x). */
export function gammaIncompletaQ(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 1;
  return x < a + 1 ? 1 - gser(a, x) : gcf(a, x);
}

/**
 * erfc(x) vía la gamma incompleta: erfc(x) = Q(1/2, x²) para x ≥ 0
 * (NR §6.2, ec. 6.2.8). Precisión ~1e-14, muy por encima de la que necesitan
 * los p-valores del TFM (el más chico es del orden de 1e-5).
 */
export function erfc(x: number): number {
  return x >= 0 ? gammaIncompletaQ(0.5, x * x) : 1 + gammaIncompletaP(0.5, x * x);
}

/** Φ(z): CDF de la normal estándar. */
export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Cola superior de la normal estándar, P(Z ≥ z). */
export function normalSf(z: number): number {
  return 0.5 * erfc(z / Math.SQRT2);
}

/** p-valor (cola superior) de una χ² con `df` grados de libertad. */
export function chiCuadradoSf(x: number, df: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  return gammaIncompletaQ(df / 2, x / 2);
}

/** Fracción continua de la beta incompleta (NR §6.4, `betacf`, Lentz). */
function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= ITMAX; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Beta incompleta regularizada I_x(a,b) (NR §6.4, `betai`). */
export function betaIncompleta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    gammln(a + b) - gammln(a) - gammln(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/**
 * p-valor a DOS COLAS de un estadístico t con `df` grados de libertad
 * (NR §6.4: p = I_{df/(df+t²)}(df/2, 1/2)).
 */
export function tSf2(t: number, df: number): number {
  if (!Number.isFinite(t) || df <= 0) return 1;
  return betaIncompleta(df / 2, 0.5, df / (df + t * t));
}

/* ================================================================== */
/*  2. Correlación                                                     */
/* ================================================================== */

/**
 * Rangos 1-based con promedio en los empates.
 * (Se movió acá desde `convex/analisis.ts`, sin cambios de comportamiento.)
 */
export function ranks(xs: readonly number[]): number[] {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1; // rango promedio (1-based) para los empates
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

/**
 * r de Pearson. `null` con n<2 o con varianza cero en alguna de las series.
 *
 * ⚠️ Cambio respecto de la versión que vivía en `analisis.ts`: acá NO se
 * redondea. El redondeo a 3 decimales lo aplica quien consume (la query
 * `analisis.comparacion` lo sigue haciendo, así que su payload no cambia).
 */
export function pearson(x: readonly number[], y: readonly number[]): number | null {
  const n = x.length;
  if (n < 2 || y.length !== n) return null;
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : num / den;
}

/** ρ de Spearman = Pearson sobre los rangos. `null` por debajo de `minN`. */
export function spearman(
  x: readonly number[],
  y: readonly number[],
  minN = 3,
): number | null {
  if (x.length < minN || y.length !== x.length) return null;
  return pearson(ranks(x), ranks(y));
}

/**
 * CCC de Lin (1989) — coeficiente de correlación de concordancia.
 *
 *      CCC = 2·cov(x,y) / (var(x) + var(y) + (x̄ − ȳ)²)
 *
 * Con var y cov POBLACIONALES (denominador N), que es la definición original
 * de Lin y la que reproduce los valores de las Tablas 3 y 4 del TFM.
 * A diferencia de Pearson, penaliza el desplazamiento sistemático entre
 * métodos: mide acuerdo, no solo asociación lineal.
 */
export function ccc(x: readonly number[], y: readonly number[]): number | null {
  const n = x.length;
  if (n < 2 || y.length !== n) return null;
  const den = varianceP(x) + varianceP(y) + (mean(x) - mean(y)) ** 2;
  return den === 0 ? null : (2 * covarianceP(x, y)) / den;
}

/**
 * Intervalo de confianza del CCC por **bootstrap percentil**.
 *
 * No se usa la fórmula analítica de Lin (1989) a propósito: asume normalidad
 * bivariada, y en estos datos no se sostiene — las diferencias sobre el núcleo dan
 * Jarque-Bera ≈ 60 con asimetría −1,7, y las marginales tienen efecto techo cerca
 * del 100 %. El IC analítico sale sistemáticamente más estrecho, que es lo que
 * ocurre cuando ese supuesto falla. El bootstrap no depende de él.
 *
 * El generador es determinista (semilla fija): el mismo conjunto de datos devuelve
 * siempre el mismo intervalo. Un IC que cambia entre recargas no es publicable.
 */
export interface IntervaloCCC {
  ccc: number;
  inferior: number;
  superior: number;
  remuestreos: number;
  nivel: number;
}

export function cccIntervalo(
  x: readonly number[],
  y: readonly number[],
  opciones: { remuestreos?: number; nivel?: number; semilla?: number } = {},
): IntervaloCCC | null {
  const n = x.length;
  if (n < 4 || y.length !== n) return null;
  const punto = ccc(x, y);
  if (punto === null) return null;

  const reps = opciones.remuestreos ?? 5000;
  const nivel = opciones.nivel ?? 0.95;
  // LCG: reproducible y suficiente para remuestreo, sin dependencias.
  let semilla = opciones.semilla ?? 20260908;
  const aleatorio = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    return semilla / 0x7fffffff;
  };

  const valores: number[] = [];
  const xs = new Array<number>(n);
  const ys = new Array<number>(n);
  for (let b = 0; b < reps; b++) {
    for (let i = 0; i < n; i++) {
      const j = Math.floor(aleatorio() * n);
      xs[i] = x[j];
      ys[i] = y[j];
    }
    const c = ccc(xs, ys);
    if (c !== null && Number.isFinite(c)) valores.push(c);
  }
  if (valores.length < 100) return null;

  valores.sort((a, b) => a - b);
  const alfa = (1 - nivel) / 2;
  const cuantil = (pr: number) =>
    valores[Math.min(valores.length - 1, Math.max(0, Math.round(pr * (valores.length - 1))))];

  return {
    ccc: punto,
    inferior: cuantil(alfa),
    superior: cuantil(1 - alfa),
    remuestreos: valores.length,
    nivel,
  };
}

/* ================================================================== */
/*  3. Regresión lineal                                                */
/* ================================================================== */

export interface RegresionSimple {
  n: number;
  /** Pendiente (β₁) de y sobre x. */
  pendiente: number;
  /** Ordenada al origen (β₀). */
  interseccion: number;
  /** Error estándar de la pendiente. */
  eePendiente: number;
  /** t = β₁ / EE(β₁), con n−2 grados de libertad. */
  t: number;
  /** p-valor a dos colas de H₀: β₁ = 0. */
  p: number;
  r: number;
  r2: number;
}

/** OLS simple y = β₀ + β₁·x, con contraste t de la pendiente. */
export function regresionLineal(
  x: readonly number[],
  y: readonly number[],
): RegresionSimple | null {
  const n = x.length;
  if (n < 3 || y.length !== n) return null;
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0) return null;
  const pendiente = sxy / sxx;
  const interseccion = my - pendiente * mx;
  const sce = Math.max(0, syy - pendiente * sxy); // suma de cuadrados del error
  const df = n - 2;
  const eePendiente = Math.sqrt(sce / df / sxx);
  const t = eePendiente === 0 ? Infinity : pendiente / eePendiente;
  const r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  return {
    n,
    pendiente,
    interseccion,
    eePendiente,
    t,
    p: eePendiente === 0 ? 0 : tSf2(t, df),
    r,
    r2: r * r,
  };
}

export interface RegresionMultiple {
  n: number;
  k: number;
  /** Coeficientes β₁…β_k, en el orden de `predictores`. */
  coeficientes: number[];
  interseccion: number;
  r2: number;
  /** R² ajustado — informativo; el TFM reporta el R² crudo. */
  r2Ajustado: number;
}

/**
 * OLS múltiple por ecuaciones normales (XᵀX)β = Xᵀy, resueltas con
 * eliminación gaussiana con pivoteo parcial. `predictores` es un array de
 * COLUMNAS (cada una de largo n).
 *
 * A n=62 y k=2 el condicionamiento no es un problema; el pivoteo está igual
 * porque IPO e ICH están fuertemente correlacionados (ρ=0,827) y la matriz
 * normal queda mal escalada sin él.
 */
export function regresionMultiple(
  predictores: readonly (readonly number[])[],
  y: readonly number[],
): RegresionMultiple | null {
  const k = predictores.length;
  const n = y.length;
  if (k === 0 || n < k + 2) return null;
  if (predictores.some((c) => c.length !== n)) return null;

  const p = k + 1; // + intercepto
  // Matriz de diseño con la columna de unos primero.
  const col = (j: number) => (i: number) => (j === 0 ? 1 : predictores[j - 1][i]);

  // XᵀX aumentada con Xᵀy.
  const a: number[][] = [];
  for (let r = 0; r < p; r++) {
    a.push(new Array<number>(p + 1).fill(0));
    for (let c = 0; c < p; c++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += col(r)(i) * col(c)(i);
      a[r][c] = s;
    }
    let s = 0;
    for (let i = 0; i < n; i++) s += col(r)(i) * y[i];
    a[r][p] = s;
  }

  // Eliminación gaussiana con pivoteo parcial.
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    if (Math.abs(a[piv][c]) < 1e-12) return null; // singular / colinealidad exacta
    if (piv !== c) [a[c], a[piv]] = [a[piv], a[c]];
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      if (f === 0) continue;
      for (let cc = c; cc <= p; cc++) a[r][cc] -= f * a[c][cc];
    }
  }
  const beta = a.map((row, r) => row[p] / a[r][r]);

  const my = mean(y);
  let sct = 0;
  let sce = 0;
  for (let i = 0; i < n; i++) {
    let yhat = beta[0];
    for (let j = 1; j < p; j++) yhat += beta[j] * predictores[j - 1][i];
    sce += (y[i] - yhat) ** 2;
    sct += (y[i] - my) ** 2;
  }
  const r2 = sct === 0 ? 0 : 1 - sce / sct;
  return {
    n,
    k,
    coeficientes: beta.slice(1),
    interseccion: beta[0],
    r2,
    r2Ajustado: 1 - (1 - r2) * ((n - 1) / (n - p)),
  };
}

/* ================================================================== */
/*  4. Bland-Altman                                                    */
/* ================================================================== */

export interface BlandAltman {
  n: number;
  /**
   * Sesgo = media de las diferencias.
   *
   * ⚠️ ORDEN LOAD-BEARING: `diferencia = x − y` = ZONACIÓN − IPO.
   * Con ese orden el TFM reporta sesgo = +2,06 sobre /635 (82,40 − 80,34) y
   * −1,58 sobre el núcleo /363 (78,76 − 80,34). Invertirlo cambia el signo de
   * TODO el análisis (sesgo, pendiente y LoA) y contradice lo publicado.
   */
  sesgo: number;
  /** Desvío estándar MUESTRAL de las diferencias. */
  deDiferencias: number;
  loaInferior: number;
  loaSuperior: number;
  /** Amplitud de los LoA 95 % = 2 · 1,96 · DE(diferencias). */
  amplitudLoA95: number;
  /** Pendiente de la regresión de la diferencia sobre la media = sesgo proporcional. */
  pendiente: number;
  /** p-valor a dos colas de la pendiente (H₀: sin sesgo proporcional). */
  pendienteP: number;
  /** |diferencia| máxima observada — la "discrepancia máxima" del TFM. */
  discrepanciaMaximaAbs: number;
}

/** Multiplicador de los límites de acuerdo al 95 % (convención de Bland-Altman). */
export const LOA_Z = 1.96;

/**
 * Análisis de Bland-Altman de dos métodos medidos en la misma escala.
 * `x` = método de referencia visual (zonación), `y` = método comparado (IPO).
 */
export function blandAltman(
  x: readonly number[],
  y: readonly number[],
): BlandAltman | null {
  const n = x.length;
  if (n < 3 || y.length !== n) return null;
  const dif: number[] = [];
  const prom: number[] = [];
  for (let i = 0; i < n; i++) {
    dif.push(x[i] - y[i]);
    prom.push((x[i] + y[i]) / 2);
  }
  const sesgo = mean(dif);
  const de = sd(dif);
  const reg = regresionLineal(prom, dif);
  return {
    n,
    sesgo,
    deDiferencias: de,
    loaInferior: sesgo - LOA_Z * de,
    loaSuperior: sesgo + LOA_Z * de,
    amplitudLoA95: 2 * LOA_Z * de,
    pendiente: reg ? reg.pendiente : 0,
    pendienteP: reg ? reg.p : 1,
    discrepanciaMaximaAbs: Math.max(...dif.map(Math.abs)),
  };
}

/* ================================================================== */
/*  5. Kruskal-Wallis (+ η²_H)                                         */
/* ================================================================== */

export interface GrupoKW {
  etiqueta: string;
  n: number;
  rangoMedio: number;
}

export interface KruskalWallis {
  /** N total. */
  n: number;
  /** k = cantidad de grupos. */
  k: number;
  /** H corregido por empates. */
  H: number;
  gl: number;
  p: number;
  /**
   * Tamaño de efecto η²_H = (H − k + 1) / (N − k)
   * (Tomczak & Tomczak 2014). Es el que reporta la Tabla 6 del TFM.
   */
  etaCuadradoH: number;
  grupos: GrupoKW[];
}

/**
 * Kruskal-Wallis sobre k grupos independientes, con corrección por empates.
 * Devuelve `null` con menos de 2 grupos no vacíos o N ≤ k.
 */
export function kruskalWallis(
  grupos: readonly { etiqueta: string; valores: readonly number[] }[],
): KruskalWallis | null {
  const gs = grupos
    .map((g) => ({ etiqueta: g.etiqueta, valores: finite(g.valores) }))
    .filter((g) => g.valores.length > 0);
  const k = gs.length;
  if (k < 2) return null;

  const todos = gs.flatMap((g) => g.valores);
  const N = todos.length;
  if (N <= k) return null;

  const rs = ranks(todos);
  let off = 0;
  let suma = 0;
  const detalle: GrupoKW[] = [];
  for (const g of gs) {
    const ni = g.valores.length;
    const rg = rs.slice(off, off + ni);
    const total = rg.reduce((a, b) => a + b, 0);
    suma += total ** 2 / ni;
    detalle.push({ etiqueta: g.etiqueta, n: ni, rangoMedio: total / ni });
    off += ni;
  }

  let H = (12 / (N * (N + 1))) * suma - 3 * (N + 1);

  // Corrección por empates: H' = H / (1 − Σ(tᵢ³−tᵢ) / (N³−N)).
  const conteo = new Map<number, number>();
  for (const v of todos) conteo.set(v, (conteo.get(v) ?? 0) + 1);
  let ties = 0;
  for (const t of conteo.values()) if (t > 1) ties += t ** 3 - t;
  const corr = 1 - ties / (N ** 3 - N);
  if (corr > 0) H /= corr;

  const gl = k - 1;
  return {
    n: N,
    k,
    H,
    gl,
    p: chiCuadradoSf(H, gl),
    etaCuadradoH: (H - k + 1) / (N - k),
    grupos: detalle,
  };
}

/* ================================================================== */
/*  6. Mann-Whitney U                                                  */
/* ================================================================== */

/**
 * Distribución exacta de U (sin empates): `f[u]` = nº de asignaciones con U = u.
 *
 * Identidad usada: el nº de valores de U iguales a `u` es el nº de particiones
 * de `u` en a lo sumo `m` partes, cada una ≤ `n` — es decir, el coeficiente de
 * qᵘ en el binomio gaussiano [m+n, m]_q = Πᵢ₌₁..ₘ (1 − q^{n+i}) / (1 − q^i).
 * El producto se acumula factor a factor: multiplicar por 1/(1 − q^i) es la
 * suma prefija de paso `i`, y por (1 − q^{n+i}) es la resta desplazada.
 * Σ f[u] = C(m+n, m).
 */
function distribucionU(mRaw: number, nRaw: number): Float64Array {
  const m = Math.min(mRaw, nRaw);
  const n = Math.max(mRaw, nRaw);
  const maxU = m * n;
  let prev = new Float64Array(maxU + 1);
  prev[0] = 1;
  for (let i = 1; i <= m; i++) {
    const cur = new Float64Array(maxU + 1);
    for (let u = 0; u <= maxU; u++) {
      let v = prev[u];
      if (u >= n + i) v -= prev[u - n - i];
      if (u >= i) v += cur[u - i];
      cur[u] = v;
    }
    prev = cur;
  }
  return prev;
}

export interface MannWhitney {
  n1: number;
  n2: number;
  /** U del primer grupo (nº de comparaciones ganadas por `a`). */
  U: number;
  /** U del segundo grupo; U1 + U2 = n1·n2. */
  U2: number;
  /** z de la aproximación normal con corrección de continuidad (informativo). */
  z: number;
  pUnaCola: number;
  pDosColas: number;
  /** `true` si el p-valor sale de la distribución exacta (sin empates y n chico). */
  exacto: boolean;
}

/**
 * U de Mann-Whitney para dos muestras independientes.
 *
 * p-valor: EXACTO cuando no hay empates entre las dos muestras y n1·n2 es
 * manejable (≤ 20.000 celdas de DP, que cubre de sobra el n1=8 / n2=10 de la
 * Tabla 7 del TFM). Si hay empates, aproximación normal con corrección de
 * continuidad y corrección de empates en la varianza.
 *
 * La cola de `pUnaCola` es la del lado observado (la que corresponde a la
 * hipótesis direccional): p = P(U ≥ U_obs) si U_obs > n1·n2/2, si no P(U ≤ U_obs).
 */
export function mannWhitney(
  aRaw: readonly number[],
  bRaw: readonly number[],
  { forzarNormal = false } = {},
): MannWhitney | null {
  const a = finite(aRaw);
  const b = finite(bRaw);
  const n1 = a.length;
  const n2 = b.length;
  if (n1 === 0 || n2 === 0) return null;

  const todos = [...a, ...b];
  const rs = ranks(todos);
  const R1 = rs.slice(0, n1).reduce((s, r) => s + r, 0);
  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;

  // ¿Hay empates ENTRE muestras (los que invalidan la distribución exacta)?
  const conteo = new Map<number, number>();
  for (const v of todos) conteo.set(v, (conteo.get(v) ?? 0) + 1);
  let ties = 0;
  for (const t of conteo.values()) if (t > 1) ties += t ** 3 - t;
  const hayEmpates = ties > 0;

  // Aproximación normal (siempre se calcula: el z es informativo).
  const N = n1 + n2;
  const mu = (n1 * n2) / 2;
  const varU =
    ((n1 * n2) / 12) * (N + 1 - ties / (N * (N - 1)));
  const sigma = Math.sqrt(varU);
  const dist = Math.abs(U1 - mu);
  const z = sigma === 0 ? 0 : (dist - 0.5) / sigma; // corrección de continuidad
  let pUnaCola = sigma === 0 ? 0.5 : normalSf(z);
  let exacto = false;

  const puedeExacto = !hayEmpates && !forzarNormal && n1 * n2 <= 20000;
  if (puedeExacto) {
    const f = distribucionU(Math.min(n1, n2), Math.max(n1, n2));
    let total = 0;
    for (let u = 0; u < f.length; u++) total += f[u];
    // Cola del lado observado. La distribución de U es simétrica respecto de
    // n1·n2/2, así que se puede evaluar sobre min(U1,U2) y leer la cola baja.
    const uMin = Math.min(U1, U2);
    let acum = 0;
    for (let u = 0; u <= uMin; u++) acum += f[u];
    pUnaCola = acum / total;
    exacto = true;
  }

  return {
    n1,
    n2,
    U: U1,
    U2,
    z,
    pUnaCola: Math.min(1, pUnaCola),
    pDosColas: Math.min(1, 2 * pUnaCola),
    exacto,
  };
}

/* ================================================================== */
/*  7. Wilcoxon de rangos con signo (pareado)                          */
/* ================================================================== */

/** Nº de subconjuntos de {1…n} cuya suma es w, para w = 0 … n(n+1)/2. */
function distribucionW(n: number): Float64Array {
  const maxW = (n * (n + 1)) / 2;
  const f = new Float64Array(maxW + 1);
  f[0] = 1;
  for (let i = 1; i <= n; i++) {
    for (let w = maxW; w >= i; w--) f[w] += f[w - i];
  }
  return f;
}

export interface Wilcoxon {
  /** Pares con diferencia distinta de cero (los ceros se descartan, Wilcoxon 1945). */
  n: number;
  /** Pares descartados por diferencia exactamente 0. */
  nCeros: number;
  /** Suma de rangos positivos. */
  wMas: number;
  /** Suma de rangos negativos. */
  wMenos: number;
  /** Estadístico W = min(W⁺, W⁻). */
  W: number;
  z: number;
  p: number;
  exacto: boolean;
  /** Media de las diferencias (a − b), en las unidades originales. */
  diferenciaMedia: number;
  /** Cuántos pares tienen a > b. */
  aMayorQueB: number;
}

/**
 * Wilcoxon de rangos con signo para muestras pareadas (a[i] vs b[i]).
 *
 * p-valor a DOS COLAS: EXACTO cuando no hay empates entre los |dᵢ| y n ≤ 50
 * (la DP es O(n·n²), trivial a estas escalas). Con empates, aproximación
 * normal con corrección de continuidad y de empates.
 */
export function wilcoxonSignedRank(
  a: readonly number[],
  b: readonly number[],
  { forzarNormal = false } = {},
): Wilcoxon | null {
  if (a.length !== b.length || a.length === 0) return null;

  const difTodas: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) difTodas.push(a[i] - b[i]);
  }
  if (difTodas.length === 0) return null;

  const diferenciaMedia = mean(difTodas);
  const aMayorQueB = difTodas.filter((d) => d > 0).length;
  const dif = difTodas.filter((d) => d !== 0);
  const nCeros = difTodas.length - dif.length;
  const n = dif.length;
  if (n < 1) return null;

  const abs = dif.map(Math.abs);
  const rs = ranks(abs);
  let wMas = 0;
  let wMenos = 0;
  for (let i = 0; i < n; i++) {
    if (dif[i] > 0) wMas += rs[i];
    else wMenos += rs[i];
  }
  const W = Math.min(wMas, wMenos);

  // Empates entre los |dᵢ|.
  const conteo = new Map<number, number>();
  for (const v of abs) conteo.set(v, (conteo.get(v) ?? 0) + 1);
  let ties = 0;
  for (const t of conteo.values()) if (t > 1) ties += t ** 3 - t;

  const mu = (n * (n + 1)) / 4;
  const varW = (n * (n + 1) * (2 * n + 1)) / 24 - ties / 48;
  const sigma = Math.sqrt(Math.max(varW, 0));
  const z = sigma === 0 ? 0 : (Math.abs(W - mu) - 0.5) / sigma;
  let p = sigma === 0 ? 1 : Math.min(1, 2 * normalSf(z));
  let exacto = false;

  if (ties === 0 && !forzarNormal && n <= 50) {
    const f = distribucionW(n);
    const total = 2 ** n;
    let acum = 0;
    for (let w = 0; w <= W; w++) acum += f[w];
    p = Math.min(1, (2 * acum) / total);
    exacto = true;
  }

  return { n, nCeros, wMas, wMenos, W, z, p, exacto, diferenciaMedia, aMayorQueB };
}
