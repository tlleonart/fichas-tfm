/**
 * DRY-RUN de la migración EAT de unidades anatómicas (SDD §3.1) contra un
 * snapshot de `npx convex export`. NO toca la base: solo lee JSONL del disco.
 *
 * Uso:
 *   unzip -o <backup>.zip -d <dir>
 *   node --experimental-strip-types scripts/dryrun-eat-units.mjs <dir> [csv-referencia]
 *
 *   <dir>            carpeta con `fichas/documents.jsonl` e `individuos/documents.jsonl`
 *   [csv-referencia] opcional: `analisis/cuantificacion-2026-08-01.csv` para
 *                    contrastar el IPO estricto contra la columna `ipo_best`
 *                    calculada independientemente por el análisis de impacto.
 *
 * Qué reporta:
 *   0. CONTROL — que el recálculo con la partición VIEJA reproduce `metricas` de la DB.
 *   1. Cuántos documentos toca la migración y cuántos caen bajo el supuesto best-case.
 *   2. El diff esperado de IPO/ICH/EAT con la partición ESTRICTA (SDD §3.2).
 *   3. Chequeos de invariantes (espejos legacy, presencia del ICH, unidades completas).
 *   4. Contraste contra el CSV de referencia, si se pasa.
 *
 * ⚠️ La partición estricta de acá es la implementación de REFERENCIA del SDD §3.2,
 *    escrita para poder cuantificar el diff antes de que exista en `lib/metrics.ts`.
 *    La implementación autoritativa es la de `lib/metrics.ts` (lane de Ronan).
 */

import fs from "node:fs";
import path from "node:path";
import {
  normalizeEatUnits,
  validateEatUnits,
  handBoneCount,
  footBoneCount,
  deriveTarso,
  deriveFalangesMano,
  isTarsoAmbiguous,
  isFalangesManoAmbiguous,
  EAT_SCHEMA_VERSION,
  MANO_TOTAL_BONES,
  PIE_TOTAL_BONES,
} from "../convex/lib/eatUnits.ts";

const snapshotDir = process.argv[2];
const csvRef = process.argv[3];
if (!snapshotDir) {
  console.error("Falta el directorio del snapshot. Ver el encabezado del script.");
  process.exit(1);
}

const readJsonl = (p) =>
  fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

const fichas = readJsonl(path.join(snapshotDir, "fichas", "documents.jsonl"));
const individuos = readJsonl(path.join(snapshotDir, "individuos", "documents.jsonl"));
const codigoPorId = new Map(individuos.map((i) => [i._id, i.codigoCanonico]));

/* ─────────────────────────────── helpers numéricos ───────────────────────── */

const n_ = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const cnt = (o) => (o && typeof o === "object" ? Object.values(o).filter(Boolean).length : 0);
const term = (v, max) => Math.min(1, n_(v) / max);

/* ───────────── partición VIEJA, inline (CONTROL contra `metricas` de la DB) ─────
 * Antes se importaba `computeEAT` de `lib/metrics.ts`, que tenía la partición
 * vieja. Desde 2026-08-02 `lib/metrics.ts` está en la partición ESTRICTA
 * (EAT_UNIT_PARTITION_VERSION = 2), así que el control se congela ACÁ: es la
 * partición que produjo los números que hoy están persistidos en la DB, y sirve
 * para verificar que el harness reproduce la DB bit a bit. NO tocar.
 */
function handPointsLegacy(h) {
  if (!h || typeof h !== "object") return 0;
  return term(h.carpianos, 8) + term(h.metacarpianos, 5) + term(h.falProxMedias, 9) + term(h.falDistales, 5);
}
function footPointsLegacy(f) {
  if (!f || typeof f !== "object") return 0;
  return (
    term(f.tarsianos, 7) +
    term(f.metatarsianos, 5) +
    term(f.falProx, 5) +
    term(f.falMedias, 4) +
    term(f.falDistales, 5)
  );
}
/** Réplica exacta del `computeEAT` pre-2026-08 (partición vieja + ICH sin hardening). */
function computeEAT(data) {
  const totalPresent =
    cnt(data.craneo) +
    cnt(data.vertebras) +
    cnt(data.huesosLargos) +
    cnt(data.huesosPlanos) +
    cnt(data.costillas) +
    (data.mandibula ? 1 : 0) +
    (data.hioides ? 1 : 0) +
    handPointsLegacy(data.manoDer) +
    handPointsLegacy(data.manoIzq) +
    footPointsLegacy(data.pieDer) +
    footPointsLegacy(data.pieIzq);
  const ipo = (totalPresent / 115) * 100;
  const sumaGenerica = (o) => (o && typeof o === "object" ? Object.values(o).reduce((a, v) => a + n_(v), 0) : 0);
  const presence = {
    craneo: cnt(data.craneo),
    vertebras: cnt(data.vertebras),
    huesosLargos: cnt(data.huesosLargos),
    huesosPlanos: cnt(data.huesosPlanos),
    costillas: cnt(data.costillas),
    mandibula: data.mandibula ? 1 : 0,
    hioides: data.hioides ? 1 : 0,
    manos: sumaGenerica(data.manoDer) + sumaGenerica(data.manoIzq),
    pies: sumaGenerica(data.pieDer) + sumaGenerica(data.pieIzq),
  };
  const quality = data.quality ?? {};
  const present = Object.keys(presence).filter((k) => presence[k] > 0);
  const ich = present.length === 0 ? 0 : present.reduce((a, k) => a + n_((quality[k] ?? {}).value), 0) / present.length;
  const eat = 100 - (ipo * ich) / 100;
  const r = (n) => Math.round(n * 100) / 100;
  return { ipo: r(ipo), ich: r(ich), eat: r(eat), totalPresent: r(totalPresent) };
}

/* ───────────────────────── partición ESTRICTA de referencia (SDD §3.2) ─────── */

/** Mano — 4 U.A.: carpianos/8 + metacarpianos/5 + falProximales/5 + (medias+distales)/9 */
function handPointsStrict(h) {
  if (!h || typeof h !== "object") return 0;
  return (
    term(h.carpianos, 8) +
    term(h.metacarpianos, 5) +
    term(h.falProximales, 5) +
    term(n_(h.falMedias) + n_(h.falDistales), 9)
  );
}

/** Pie — 5 U.A.: calcaneo/1 + astragalo/1 + restoTarso/5 + metatarsianos/5 + falanges/10 */
function footPointsStrict(f) {
  if (!f || typeof f !== "object") return 0;
  return (
    term(f.calcaneo, 1) +
    term(f.astragalo, 1) +
    term(f.restoTarso, 5) +
    term(f.metatarsianos, 5) +
    term(n_(f.falProx) + n_(f.falMedias) + n_(f.falDistales), 10)
  );
}

const EAT_IPO_MAX = 115;
const GRUPOS_ICH = [
  "craneo",
  "vertebras",
  "huesosLargos",
  "huesosPlanos",
  "costillas",
  "mandibula",
  "hioides",
  "manos",
  "pies",
];

/** EAT estricto, con el ICH hardened (SDD §3.3: excluir presentes SIN `value`). */
function computeEatStrict(data) {
  const fijo =
    cnt(data.craneo) +
    cnt(data.vertebras) +
    cnt(data.huesosLargos) +
    cnt(data.huesosPlanos) +
    cnt(data.costillas) +
    (data.mandibula ? 1 : 0) +
    (data.hioides ? 1 : 0);

  const pts =
    handPointsStrict(data.manoDer) +
    handPointsStrict(data.manoIzq) +
    footPointsStrict(data.pieDer) +
    footPointsStrict(data.pieIzq);

  const totalPresent = fijo + pts;
  const ipo = (totalPresent / EAT_IPO_MAX) * 100;

  const presence = {
    craneo: cnt(data.craneo),
    vertebras: cnt(data.vertebras),
    huesosLargos: cnt(data.huesosLargos),
    huesosPlanos: cnt(data.huesosPlanos),
    costillas: cnt(data.costillas),
    mandibula: data.mandibula ? 1 : 0,
    hioides: data.hioides ? 1 : 0,
    manos: handBoneCount(data.manoDer) + handBoneCount(data.manoIzq),
    pies: footBoneCount(data.pieDer) + footBoneCount(data.pieIzq),
  };
  const quality = data.quality ?? {};
  const presentes = GRUPOS_ICH.filter((k) => presence[k] > 0);
  const conValor = presentes.filter((k) => (quality[k] ?? {}).value !== undefined && (quality[k] ?? {}).value !== null);
  const ich = conValor.length
    ? conValor.reduce((a, k) => a + n_(quality[k].value), 0) / conValor.length
    : 0;

  const eat = 100 - (ipo * ich) / 100;
  const r = (n) => Math.round(n * 100) / 100;
  return {
    ipo: r(ipo),
    ich: r(ich),
    eat: r(eat),
    totalPresent: r(totalPresent),
    presencia: presence,
    ichGruposPresentes: presentes,
    ichGruposSinValor: presentes.filter((k) => !conValor.includes(k)),
  };
}

/* ───────────────────────────────────── corrida ───────────────────────────── */

const NOW = 1754092800000; // 2026-08-02T00:00:00Z — fijo, para que el dry-run sea determinista
const eat = fichas.filter((f) => f.tipo === "eat");
const zonacion = fichas.filter((f) => f.tipo === "zonacion");

const rows = [];
let controlMaxDelta = { ipo: 0, ich: 0, eat: 0 };
const issuesTotales = [];
const invariantes = { espejoTarso: 0, espejoFalanges: 0, presenciaCambiada: 0, sumaConservada: 0 };

for (const f of eat) {
  const antes = f.data ?? {};
  const metricasDB = f.metricas ?? {};

  // CONTROL: recálculo con la partición VIEJA (la que hay en metrics.ts hoy).
  const viejo = computeEAT(antes);
  controlMaxDelta.ipo = Math.max(controlMaxDelta.ipo, Math.abs(viejo.ipo - (metricasDB.ipo ?? 0)));
  controlMaxDelta.ich = Math.max(controlMaxDelta.ich, Math.abs(viejo.ich - (metricasDB.ich ?? 0)));
  controlMaxDelta.eat = Math.max(controlMaxDelta.eat, Math.abs(viejo.eat - (metricasDB.eat ?? 0)));

  // MIGRACIÓN (la función real, la misma que corre la internalMutation).
  const { data: despues, changed, derivation } = normalizeEatUnits(antes, NOW);

  // Invariantes del contrato.
  for (const side of ["pieDer", "pieIzq"]) {
    const a = antes[side] ?? {};
    const d = despues[side] ?? {};
    if (n_(d.calcaneo) + n_(d.astragalo) + n_(d.restoTarso) === n_(d.tarsianos)) invariantes.espejoTarso++;
    if (n_(d.tarsianos) === n_(a.tarsianos)) invariantes.sumaConservada++;
  }
  for (const side of ["manoDer", "manoIzq"]) {
    const a = antes[side] ?? {};
    const d = despues[side] ?? {};
    if (n_(d.falProximales) + n_(d.falMedias) === n_(d.falProxMedias)) invariantes.espejoFalanges++;
    if (n_(d.falProxMedias) === n_(a.falProxMedias)) invariantes.sumaConservada++;
  }

  const estricto = computeEatStrict(despues);
  const issues = validateEatUnits(despues);
  if (issues.length) issuesTotales.push({ id: f._id, issues });

  // La presencia del ICH no debe cambiar por la migración (allowlist + fallback).
  const presenciaVieja = {
    manos:
      Object.values(antes.manoDer ?? {}).reduce((a, v) => a + n_(v), 0) +
      Object.values(antes.manoIzq ?? {}).reduce((a, v) => a + n_(v), 0),
    pies:
      Object.values(antes.pieDer ?? {}).reduce((a, v) => a + n_(v), 0) +
      Object.values(antes.pieIzq ?? {}).reduce((a, v) => a + n_(v), 0),
  };
  const presenciaMismaSignatura =
    presenciaVieja.manos > 0 === estricto.presencia.manos > 0 &&
    presenciaVieja.pies > 0 === estricto.presencia.pies > 0;
  if (!presenciaMismaSignatura) invariantes.presenciaCambiada++;

  const ladosSupuesto = Object.entries(derivation.sides)
    .filter(([, s]) => s.ambiguous)
    .map(([k]) => k);

  rows.push({
    codigo: codigoPorId.get(f.individuoId) ?? f.individuoId,
    changed,
    ladosSupuesto,
    tarsDer: n_((antes.pieDer ?? {}).tarsianos),
    tarsIzq: n_((antes.pieIzq ?? {}).tarsianos),
    fpmDer: n_((antes.manoDer ?? {}).falProxMedias),
    fpmIzq: n_((antes.manoIzq ?? {}).falProxMedias),
    ipoDB: metricasDB.ipo ?? null,
    ipoViejo: viejo.ipo,
    ipoEstricto: estricto.ipo,
    ichViejo: viejo.ich,
    ichEstricto: estricto.ich,
    eatViejo: viejo.eat,
    eatEstricto: estricto.eat,
    ichGruposSinValor: estricto.ichGruposSinValor,
    // Sumas de huesos con la allowlist nueva (para el "X / N huesos" del form).
    huesosManoDer: handBoneCount(despues.manoDer),
    huesosPieDer: footBoneCount(despues.pieDer),
  });
}

/* ───────────────────────────────────── reporte ───────────────────────────── */

const P = console.log;
const sec = (t) => P("\n" + "=".repeat(78) + "\n" + t + "\n" + "=".repeat(78));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f2 = (n) => n.toFixed(2);

P("DRY-RUN — migración EAT unidades anatómicas (SDD §3.1)");
P(`snapshot: ${snapshotDir}`);
P(`fichas totales: ${fichas.length}  ·  EAT: ${eat.length}  ·  zonación (NO se tocan): ${zonacion.length}`);
P(`individuos: ${individuos.length}`);
P(`schemaVersion objetivo: ${EAT_SCHEMA_VERSION}  ·  MANO_TOTAL_BONES=${MANO_TOTAL_BONES}  PIE_TOTAL_BONES=${PIE_TOTAL_BONES}`);

sec("0. CONTROL — ¿el recálculo con la partición VIEJA reproduce metricas de la DB?");
P(`max |Δ IPO| = ${controlMaxDelta.ipo.toFixed(6)}`);
P(`max |Δ ICH| = ${controlMaxDelta.ich.toFixed(6)}`);
P(`max |Δ EAT| = ${controlMaxDelta.eat.toFixed(6)}`);
P(
  controlMaxDelta.ipo < 0.01 && controlMaxDelta.eat < 0.01
    ? ">> OK: el harness reproduce la DB. Los deltas de abajo son atribuibles al cambio."
    : ">> ⚠️ DIVERGENCIA: revisar antes de confiar en el diff.",
);

sec("1. ALCANCE — documentos que toca la migración");
const cambian = rows.filter((r) => r.changed).length;
const bajoSupuesto = rows.filter((r) => r.ladosSupuesto.length > 0);
const ladosSupuesto = rows.reduce((a, r) => a + r.ladosSupuesto.length, 0);
P(`fichas EAT a patchear (data + metricas + schemaVersion): ${eat.length}`);
P(`  de ellas con cambio de shape en \`data\`: ${cambian}`);
P(`fichas de zonación tocadas: 0`);
P(`documentos de \`individuos\` tocados: 0`);
P("");
P(`fichas con AL MENOS UN lado derivado bajo supuesto best-case: ${bajoSupuesto.length}/${eat.length}`);
P(`lados (mano/pie individuales) derivados bajo supuesto: ${ladosSupuesto}/${eat.length * 4}`);
const tarsoAmb = rows.filter((r) => isTarsoAmbiguous(r.tarsDer) || isTarsoAmbiguous(r.tarsIzq));
const manoAmb = rows.filter(
  (r) => isFalangesManoAmbiguous(r.fpmDer) || isFalangesManoAmbiguous(r.fpmIzq),
);
P(`  · tarso ambiguo (tarsianos 1..6 en algún pie):        ${tarsoAmb.length} fichas`);
P(`  · falanges de mano ambiguas (falProxMedias 1..8):     ${manoAmb.length} fichas`);
P(`  · conversión EXACTA en ambas dimensiones:             ${eat.length - bajoSupuesto.length} fichas`);
P("");
P("distribución de `tarsianos` (por pie, n=" + eat.length * 2 + "):");
const distT = {};
for (const r of rows) for (const v of [r.tarsDer, r.tarsIzq]) distT[v] = (distT[v] ?? 0) + 1;
for (const k of Object.keys(distT).sort((a, b) => a - b)) P(`   ${k} → ${distT[k]}`);
P("distribución de `falProxMedias` (por mano, n=" + eat.length * 2 + "):");
const distM = {};
for (const r of rows) for (const v of [r.fpmDer, r.fpmIzq]) distM[v] = (distM[v] ?? 0) + 1;
for (const k of Object.keys(distM).sort((a, b) => a - b)) P(`   ${k} → ${distM[k]}`);

sec("2. DIFF ESPERADO de métricas (partición estricta de referencia, SDD §3.2)");
const dIpo = rows.map((r) => r.ipoEstricto - r.ipoViejo);
const dEat = rows.map((r) => r.eatEstricto - r.eatViejo);
const dIch = rows.map((r) => r.ichEstricto - r.ichViejo);
P(`IPO  viejo ${f2(mean(rows.map((r) => r.ipoViejo)))}  →  estricto ${f2(mean(rows.map((r) => r.ipoEstricto)))}`);
P(`  Δ medio ${dIpo.reduce((a, b) => a + b, 0) / dIpo.length >= 0 ? "+" : ""}${f2(mean(dIpo))} pp` +
  `  (min ${f2(Math.min(...dIpo))}, max +${f2(Math.max(...dIpo))})`);
P(`ICH  viejo ${f2(mean(rows.map((r) => r.ichViejo)))}  →  estricto ${f2(mean(rows.map((r) => r.ichEstricto)))}` +
  `   (max |Δ| ${f2(Math.max(...dIch.map(Math.abs)))})`);
P(`EAT  viejo ${f2(mean(rows.map((r) => r.eatViejo)))}  →  estricto ${f2(mean(rows.map((r) => r.eatEstricto)))}`);
P(`  Δ medio ${f2(mean(dEat))} pp  (min ${f2(Math.min(...dEat))}, max +${f2(Math.max(...dEat))})`);
P("");
P("top 5 fichas por |Δ IPO|:");
[...rows]
  .sort((a, b) => Math.abs(b.ipoEstricto - b.ipoViejo) - Math.abs(a.ipoEstricto - a.ipoViejo))
  .slice(0, 5)
  .forEach((r) =>
    P(
      `   ${String(r.codigo).padEnd(24)} IPO ${f2(r.ipoViejo)} → ${f2(r.ipoEstricto)} ` +
        `(${r.ipoEstricto - r.ipoViejo >= 0 ? "+" : ""}${f2(r.ipoEstricto - r.ipoViejo)})  ` +
        `supuesto: ${r.ladosSupuesto.join(",") || "-"}`,
    ),
  );

sec("3. INVARIANTES del contrato");
const nPies = eat.length * 2;
const nManos = eat.length * 2;
P(`espejo tarso   (calcaneo+astragalo+restoTarso === tarsianos):        ${invariantes.espejoTarso}/${nPies} ${invariantes.espejoTarso === nPies ? "✅" : "❌"}`);
P(`espejo mano    (falProximales+falMedias === falProxMedias):          ${invariantes.espejoFalanges}/${nManos} ${invariantes.espejoFalanges === nManos ? "✅" : "❌"}`);
P(`conteo agregado CONSERVADO (los espejos valen lo mismo que antes):    ${invariantes.sumaConservada}/${nPies + nManos} ${invariantes.sumaConservada === nPies + nManos ? "✅" : "❌"}`);
P(`presencia del ICH sin cambios de signatura (>0 antes ⇔ >0 después):  ${eat.length - invariantes.presenciaCambiada}/${eat.length} ${invariantes.presenciaCambiada === 0 ? "✅" : "❌"}`);
P(`issues de validateEatUnits() tras normalizar:                        ${issuesTotales.length} ${issuesTotales.length === 0 ? "✅" : "❌"}`);
if (issuesTotales.length) P(JSON.stringify(issuesTotales.slice(0, 5), null, 1));

// Idempotencia: normalizar N veces = normalizar una vez.
let idem = 0;
let trazaSobrevive = 0;
let reRegistroLimpia = 0;
const conSupuesto = [];
for (const f of eat) {
  const a = normalizeEatUnits(f.data ?? {}, NOW).data;
  const b = normalizeEatUnits(a, NOW + 999).data;
  const c = normalizeEatUnits(b, NOW + 12345).data;
  if (JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(b) === JSON.stringify(c)) idem++;

  // Escenario real: EATForm reconstruye `data` desde cero y NO devuelve
  // `eatDerivation`. `fichas.actualizar` tiene que pasar el data viejo.
  const sinTraza = { ...a };
  delete sinTraza.eatDerivation;
  const rescatado = normalizeEatUnits(sinTraza, NOW + 999, a).data;
  if (JSON.stringify(rescatado.eatDerivation) === JSON.stringify(a.eatDerivation)) trazaSobrevive++;

  // Escenario real: Martina re-registra a mano un lado que venía bajo supuesto.
  if (a.eatDerivation.underAssumption) {
    conSupuesto.push(f._id);
    const lado = Object.entries(a.eatDerivation.sides).find(([, s]) => s.ambiguous)[0];
    const editado = { ...a, [lado]: { ...a[lado] } };
    delete editado.eatDerivation;
    if (lado.startsWith("mano")) {
      editado[lado].falProximales = Math.max(0, n_(a[lado].falProximales) - 1);
      editado[lado].falMedias = n_(a[lado].falMedias) + 1;
    } else {
      editado[lado].calcaneo = 0;
      editado[lado].restoTarso = Math.min(5, n_(a[lado].restoTarso) + 1);
    }
    const post = normalizeEatUnits(editado, NOW + 999, a).data;
    if (post.eatDerivation.sides[lado].status === "registrado") reRegistroLimpia++;
  }
}
P(`idempotencia (normalize×3 === normalize):                            ${idem}/${eat.length} ${idem === eat.length ? "✅" : "❌"}`);
P(`traza rescatada del data previo (EATForm la descarta):               ${trazaSobrevive}/${eat.length} ${trazaSobrevive === eat.length ? "✅" : "❌"}`);
P(`re-registro manual limpia el supuesto (status → "registrado"):       ${reRegistroLimpia}/${conSupuesto.length} ${reRegistroLimpia === conSupuesto.length ? "✅" : "❌"}`);

// Casos de prueba del SDD §4.2.
const manoCompleta = { carpianos: 8, metacarpianos: 5, falProximales: 5, falMedias: 4, falDistales: 5 };
const pieCompleto = { calcaneo: 1, astragalo: 1, restoTarso: 5, metatarsianos: 5, falProx: 5, falMedias: 4, falDistales: 5 };
const soloCalcAstr = { calcaneo: 1, astragalo: 1, restoTarso: 0, metatarsianos: 0, falProx: 0, falMedias: 0, falDistales: 0 };
P("");
P("tests de unidades (SDD §4.2) sobre la partición de referencia:");
P(`   mano completa → ${f2(handPointsStrict(manoCompleta))} pts  (esperado 4.00) ${handPointsStrict(manoCompleta) === 4 ? "✅" : "❌"}`);
P(`   pie completo  → ${f2(footPointsStrict(pieCompleto))} pts  (esperado 5.00) ${footPointsStrict(pieCompleto) === 5 ? "✅" : "❌"}`);
P(`   solo calcáneo+astrágalo → ${f2(footPointsStrict(soloCalcAstr))} pts (esperado 2.00; hoy 0.29) ${footPointsStrict(soloCalcAstr) === 2 ? "✅" : "❌"}`);
P("");
P("derivación best-case, tabla completa:");
P("   tarsianos → calcáneo/astrágalo/restoTarso | ambiguo");
for (let n = 0; n <= 7; n++) {
  const d = deriveTarso(n);
  P(`     ${n} → ${d.calcaneo}/${d.astragalo}/${d.restoTarso} (suma ${d.calcaneo + d.astragalo + d.restoTarso}) | ${isTarsoAmbiguous(n) ? "SÍ" : "no"}`);
}
P("   falProxMedias → proximales/medias | ambiguo");
for (let m = 0; m <= 9; m++) {
  const d = deriveFalangesMano(m);
  P(`     ${m} → ${d.falProximales}/${d.falMedias} (suma ${d.falProximales + d.falMedias}) | ${isFalangesManoAmbiguous(m) ? "SÍ" : "no"}`);
}

sec("4. ICH — incidencia del bug latente (SDD §3.3)");
const conBug = rows.filter((r) => r.ichGruposSinValor.length > 0);
P(`fichas con algún grupo PRESENTE y sin \`value\` de calidad: ${conBug.length}/${eat.length}`);
if (conBug.length === 0) P(">> INCIDENCIA CERO confirmada sobre este snapshot. El fix es hardening puro.");
else conBug.slice(0, 10).forEach((r) => P(`   ${r.codigo}: ${r.ichGruposSinValor.join(", ")}`));

if (csvRef && fs.existsSync(csvRef)) {
  sec("5. CONTRASTE contra el CSV de impacto (columna ipo_best, cálculo independiente)");
  const lines = fs.readFileSync(csvRef, "utf8").trim().split("\n");
  const head = lines[0].split(",");
  const iCod = head.indexOf("codigo");
  const iBest = head.indexOf("ipo_best");
  const ref = new Map();
  for (const l of lines.slice(1)) {
    const c = l.split(",");
    ref.set(c[iCod], parseFloat(c[iBest]));
  }
  const deltas = [];
  const faltantes = [];
  for (const r of rows) {
    const v = ref.get(String(r.codigo));
    if (v === undefined) {
      faltantes.push(r.codigo);
      continue;
    }
    deltas.push(Math.abs(r.ipoEstricto - v));
  }
  P(`fichas contrastadas: ${deltas.length}  ·  sin fila en el CSV: ${faltantes.length}`);
  if (deltas.length) {
    P(`max |ipoEstricto − ipo_best| = ${Math.max(...deltas).toFixed(4)}`);
    P(`media                        = ${mean(deltas).toFixed(4)}`);
    P(
      Math.max(...deltas) < 0.02
        ? ">> ✅ COINCIDE con el análisis de impacto (dentro del redondeo). Doble cálculo independiente."
        : ">> ⚠️ NO coincide: investigar antes de correr la migración.",
    );
  }
  if (faltantes.length) P(`   sin CSV: ${faltantes.slice(0, 5).join(", ")}${faltantes.length > 5 ? " …" : ""}`);
}

sec("RESUMEN OPERATIVO");
P(`documentos leídos:            ${fichas.length} fichas + ${individuos.length} individuos`);
P(`documentos que se patchearían: ${eat.length} (todas las fichas EAT)`);
P(`documentos NO tocados:         ${zonacion.length} zonación + ${individuos.length} individuos`);
P(`claves nuevas escritas:        ${eat.length * 2} × {falProximales, falMedias} + ${eat.length * 2} × {calcaneo, astragalo, restoTarso}`);
P(`claves legacy borradas:        0 (aditiva; la limpieza es una pasada aparte)`);
P(`fichas marcadas bajo supuesto: ${bajoSupuesto.length} (data.eatDerivation.underAssumption = true)`);
P(`Δ IPO medio esperado:          ${mean(dIpo) >= 0 ? "+" : ""}${f2(mean(dIpo))} pp`);
P(`Δ EAT medio esperado:          ${f2(mean(dEat))} pp`);

const out = {
  generado: new Date(NOW).toISOString(),
  snapshot: snapshotDir,
  totales: {
    fichas: fichas.length,
    eat: eat.length,
    zonacion: zonacion.length,
    individuos: individuos.length,
    aPatchear: eat.length,
    conCambioDeShape: cambian,
    fichasBajoSupuesto: bajoSupuesto.length,
    ladosBajoSupuesto: ladosSupuesto,
    tarsoAmbiguo: tarsoAmb.length,
    manoAmbigua: manoAmb.length,
  },
  control: controlMaxDelta,
  invariantes: { ...invariantes, idempotencia: idem, issues: issuesTotales.length },
  delta: {
    ipoMedio: mean(dIpo),
    ipoMin: Math.min(...dIpo),
    ipoMax: Math.max(...dIpo),
    eatMedio: mean(dEat),
    ichMaxAbs: Math.max(...dIch.map(Math.abs)),
  },
  filas: rows,
};
const outPath = process.env.DRYRUN_OUT;
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  P(`\n>> JSON escrito en ${outPath}`);
}
