/**
 * VERIFICACIÓN de `lib/metrics.ts` (partición estricta + ICH hardened) contra los
 * 60 individuos reales — SDD §4, chequeo 5.
 * ==========================================================================
 * 100 % OFFLINE: lee un snapshot de `npx convex export` del disco. NO se conecta
 * a Convex, NO escribe nada, NO toca prod.
 *
 * Uso:
 *   unzip -o <backup>.zip -d <dir>
 *   node --experimental-strip-types --import ./tests/register-ts.mjs \
 *        scripts/verify-eat-metrics.mjs <dir> [cuantificacion.csv] [dryrun.json]
 *
 * Es el CONTRASTE CRUZADO de la implementación autoritativa (`lib/metrics.ts`,
 * lane de Ronan) contra dos cálculos independientes que ya existían:
 *   - `analisis/cuantificacion-2026-08-01.csv` (columnas `ipo_best`, `eat_best`,
 *     `ich_fix`) — cuantificación de impacto en Python;
 *   - `analisis/dryrun-eat-unidades-2026-08-02.json` (`filas[].ipoEstricto`…) —
 *     partición de referencia del dry-run de la migración, en JS.
 * Tres implementaciones independientes que tienen que dar el mismo número.
 *
 * Además verifica el CONTROL: recalcular con la partición VIEJA (congelada acá,
 * ver `partitionVieja`) tiene que reproducir las `metricas` persistidas en la DB.
 * Sin ese control los deltas no son atribuibles al cambio.
 *
 * Sale con código ≠ 0 si algún chequeo falla.
 */

import fs from "node:fs";
import path from "node:path";

import { computeEAT, EAT_UNIT_PARTITION_VERSION } from "../convex/lib/metrics.ts";
import { normalizeEatUnits } from "../convex/lib/eatUnits.ts";

const [snapshotDir, csvRef, dryrunRef] = process.argv.slice(2);
if (!snapshotDir) {
  console.error("Falta el directorio del snapshot. Ver el encabezado del script.");
  process.exit(2);
}

const readJsonl = (p) =>
  fs.readFileSync(p, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

const fichas = readJsonl(path.join(snapshotDir, "fichas", "documents.jsonl"));
const individuos = readJsonl(path.join(snapshotDir, "individuos", "documents.jsonl"));
const codigoPorId = new Map(individuos.map((i) => [i._id, i.codigoCanonico]));
const eatFichas = fichas.filter((f) => f.tipo === "eat");

/* ── partición VIEJA congelada (CONTROL: reproduce lo que hay en la DB) ─────── */

const n_ = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const cnt = (o) => (o && typeof o === "object" ? Object.values(o).filter(Boolean).length : 0);
const term = (v, max) => Math.min(1, n_(v) / max);
const sumaGenerica = (o) => (o && typeof o === "object" ? Object.values(o).reduce((a, v) => a + n_(v), 0) : 0);

/** Réplica exacta del `computeEAT` pre-2026-08 (partición vieja + ICH sin hardening). */
function partitionVieja(data) {
  const mano = (h) =>
    !h || typeof h !== "object"
      ? 0
      : term(h.carpianos, 8) + term(h.metacarpianos, 5) + term(h.falProxMedias, 9) + term(h.falDistales, 5);
  const pie = (f) =>
    !f || typeof f !== "object"
      ? 0
      : term(f.tarsianos, 7) + term(f.metatarsianos, 5) + term(f.falProx, 5) + term(f.falMedias, 4) + term(f.falDistales, 5);
  const totalPresent =
    cnt(data.craneo) + cnt(data.vertebras) + cnt(data.huesosLargos) + cnt(data.huesosPlanos) +
    cnt(data.costillas) + (data.mandibula ? 1 : 0) + (data.hioides ? 1 : 0) +
    mano(data.manoDer) + mano(data.manoIzq) + pie(data.pieDer) + pie(data.pieIzq);
  const ipo = (totalPresent / 115) * 100;
  const presence = {
    craneo: cnt(data.craneo), vertebras: cnt(data.vertebras), huesosLargos: cnt(data.huesosLargos),
    huesosPlanos: cnt(data.huesosPlanos), costillas: cnt(data.costillas),
    mandibula: data.mandibula ? 1 : 0, hioides: data.hioides ? 1 : 0,
    manos: sumaGenerica(data.manoDer) + sumaGenerica(data.manoIzq),
    pies: sumaGenerica(data.pieDer) + sumaGenerica(data.pieIzq),
  };
  const quality = data.quality ?? {};
  const present = Object.keys(presence).filter((k) => presence[k] > 0);
  const ich = present.length === 0 ? 0 : present.reduce((a, k) => a + n_((quality[k] ?? {}).value), 0) / present.length;
  const r = (x) => Math.round(x * 100) / 100;
  return { ipo: r(ipo), ich: r(ich), eat: r(100 - (ipo * ich) / 100), totalPresent: r(totalPresent) };
}

/** Grupos presentes SIN `value` de calidad (la incidencia del bug del ICH). */
function gruposPresentesSinValor(data) {
  const quality = data.quality ?? {};
  const presence = {
    craneo: cnt(data.craneo), vertebras: cnt(data.vertebras), huesosLargos: cnt(data.huesosLargos),
    huesosPlanos: cnt(data.huesosPlanos), costillas: cnt(data.costillas),
    mandibula: data.mandibula ? 1 : 0, hioides: data.hioides ? 1 : 0,
    manos: sumaGenerica(data.manoDer) + sumaGenerica(data.manoIzq),
    pies: sumaGenerica(data.pieDer) + sumaGenerica(data.pieIzq),
  };
  return Object.keys(presence).filter((k) => {
    if (presence[k] <= 0) return false;
    const val = (quality[k] ?? {}).value;
    return val === undefined || val === null || val === "" || !Number.isFinite(n_(val));
  });
}

/* ── corrida ────────────────────────────────────────────────────────────────── */

const NOW = 1_754_092_800_000; // determinista
const filas = [];

for (const f of eatFichas) {
  const antes = f.data ?? {};
  const db = f.metricas ?? {};
  const control = partitionVieja(antes);
  const { data: normalizado } = normalizeEatUnits(antes, NOW);
  const nuevo = computeEAT(normalizado); // ← la implementación AUTORITATIVA
  filas.push({
    codigo: codigoPorId.get(f.individuoId) ?? f.individuoId,
    dbIpo: db.ipo ?? null, dbIch: db.ich ?? null, dbEat: db.eat ?? null,
    ctrlIpo: control.ipo, ctrlIch: control.ich, ctrlEat: control.eat,
    ipo: nuevo.ipo, ich: nuevo.ich, eat: nuevo.eat, totalPresent: nuevo.totalPresent,
    sinValor: gruposPresentesSinValor(antes),
  });
}

/* ── reporte ────────────────────────────────────────────────────────────────── */

const P = console.log;
const sec = (t) => P(`\n${"=".repeat(78)}\n${t}\n${"=".repeat(78)}`);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f2 = (n) => n.toFixed(2);
const maxAbs = (a) => (a.length ? Math.max(...a.map(Math.abs)) : 0);

const fallas = [];
const chequeo = (nombre, ok, detalle) => {
  P(`${ok ? "✅" : "❌"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallas.push(nombre);
};

P("VERIFICACIÓN de lib/metrics.ts — partición estricta + ICH hardened (SDD §4.5)");
P(`snapshot: ${snapshotDir}`);
P(`fichas EAT: ${eatFichas.length}  ·  zonación (no se tocan): ${fichas.length - eatFichas.length}`);
P(`EAT_UNIT_PARTITION_VERSION = ${EAT_UNIT_PARTITION_VERSION}`);

sec("0. CONTROL — la partición vieja reproduce las `metricas` de la DB");
const dCtrl = {
  ipo: filas.map((r) => r.ctrlIpo - (r.dbIpo ?? 0)),
  ich: filas.map((r) => r.ctrlIch - (r.dbIch ?? 0)),
  eat: filas.map((r) => r.ctrlEat - (r.dbEat ?? 0)),
};
P(`max |Δ IPO| = ${maxAbs(dCtrl.ipo).toFixed(6)}  ·  max |Δ ICH| = ${maxAbs(dCtrl.ich).toFixed(6)}  ·  max |Δ EAT| = ${maxAbs(dCtrl.eat).toFixed(6)}`);
chequeo(
  "el harness reproduce la DB bit a bit (los deltas son atribuibles al cambio)",
  maxAbs(dCtrl.ipo) === 0 && maxAbs(dCtrl.ich) === 0 && maxAbs(dCtrl.eat) === 0,
  `max |Δ| = ${maxAbs([...dCtrl.ipo, ...dCtrl.ich, ...dCtrl.eat]).toFixed(6)}`,
);

sec("1. DIFF de métricas — partición vieja → estricta (implementación autoritativa)");
const dIpo = filas.map((r) => r.ipo - r.ctrlIpo);
const dIch = filas.map((r) => r.ich - r.ctrlIch);
const dEat = filas.map((r) => r.eat - r.ctrlEat);
P(`IPO  ${f2(mean(filas.map((r) => r.ctrlIpo)))} → ${f2(mean(filas.map((r) => r.ipo)))}   Δ medio ${mean(dIpo) >= 0 ? "+" : ""}${f2(mean(dIpo))} pp  (min ${f2(Math.min(...dIpo))} · max ${f2(Math.max(...dIpo))})`);
P(`ICH  ${f2(mean(filas.map((r) => r.ctrlIch)))} → ${f2(mean(filas.map((r) => r.ich)))}   max |Δ| ${maxAbs(dIch).toFixed(6)}`);
P(`EAT  ${f2(mean(filas.map((r) => r.ctrlEat)))} → ${f2(mean(filas.map((r) => r.eat)))}   Δ medio ${f2(mean(dEat))} pp  (min ${f2(Math.min(...dEat))} · max ${f2(Math.max(...dEat))})`);

// Targets del SDD §2 / handoff §6.3.
chequeo("IPO medio viejo ≈ 80,05", Math.abs(mean(filas.map((r) => r.ctrlIpo)) - 80.05) < 0.01, f2(mean(filas.map((r) => r.ctrlIpo))));
chequeo("IPO medio estricto ≈ 81,17", Math.abs(mean(filas.map((r) => r.ipo)) - 81.17) < 0.01, f2(mean(filas.map((r) => r.ipo))));
chequeo("Δ IPO medio ≈ +1,12 pp", Math.abs(mean(dIpo) - 1.12) < 0.01, `${f2(mean(dIpo))} pp`);
chequeo("EAT medio viejo ≈ 32,28", Math.abs(mean(filas.map((r) => r.ctrlEat)) - 32.28) < 0.01, f2(mean(filas.map((r) => r.ctrlEat))));
chequeo("EAT medio estricto ≈ 31,34", Math.abs(mean(filas.map((r) => r.eat)) - 31.34) < 0.01, f2(mean(filas.map((r) => r.eat))));
chequeo("Δ EAT medio ≈ −0,94 pp", Math.abs(mean(dEat) + 0.94) < 0.01, `${f2(mean(dEat))} pp`);

sec("2. ICH — el hardening NO mueve ningún número (incidencia medida)");
const conBug = filas.filter((r) => r.sinValor.length > 0);
chequeo("ningún grupo presente sin `value` en los 60", conBug.length === 0, `${conBug.length}/${filas.length} fichas`);
chequeo("ICH idéntico al de la DB en las 60 fichas", maxAbs(filas.map((r) => r.ich - (r.dbIch ?? 0))) === 0, `max |Δ| = ${maxAbs(filas.map((r) => r.ich - (r.dbIch ?? 0))).toFixed(6)}`);
if (conBug.length) conBug.slice(0, 10).forEach((r) => P(`   ${r.codigo}: ${r.sinValor.join(", ")}`));

sec("3. CONTRASTE CRUZADO contra los cálculos independientes");
if (csvRef && fs.existsSync(csvRef)) {
  const lineas = fs.readFileSync(csvRef, "utf8").trim().split("\n");
  const head = lineas[0].split(",");
  const col = (nombre) => head.indexOf(nombre);
  const ref = new Map();
  for (const l of lineas.slice(1)) {
    const c = l.split(",");
    ref.set(c[col("codigo")], {
      ipo: parseFloat(c[col("ipo_best")]),
      eat: parseFloat(c[col("eat_best")]),
      ich: parseFloat(c[col("ich_fix")]),
    });
  }
  const dip = [], dea = [], dic = [];
  let faltantes = 0;
  for (const r of filas) {
    const v = ref.get(String(r.codigo));
    if (!v) { faltantes += 1; continue; }
    dip.push(r.ipo - v.ipo); dea.push(r.eat - v.eat); dic.push(r.ich - v.ich);
  }
  P(`CSV (${path.basename(csvRef)}): ${dip.length} fichas contrastadas, ${faltantes} sin fila`);
  P(`   max |Δ IPO| = ${maxAbs(dip).toFixed(4)}  ·  max |Δ EAT| = ${maxAbs(dea).toFixed(4)}  ·  max |Δ ICH| = ${maxAbs(dic).toFixed(4)}`);
  chequeo("coincide con `ipo_best`/`eat_best`/`ich_fix` del CSV (tolerancia de redondeo 0,02)", maxAbs([...dip, ...dea, ...dic]) < 0.02, `max |Δ| = ${maxAbs([...dip, ...dea, ...dic]).toFixed(4)}`);
} else {
  P("(sin CSV de referencia — se salta)");
}

if (dryrunRef && fs.existsSync(dryrunRef)) {
  const dry = JSON.parse(fs.readFileSync(dryrunRef, "utf8"));
  const ref = new Map(dry.filas.map((r) => [String(r.codigo), r]));
  const dip = [], dea = [], dic = [];
  let faltantes = 0;
  for (const r of filas) {
    const v = ref.get(String(r.codigo));
    if (!v) { faltantes += 1; continue; }
    dip.push(r.ipo - v.ipoEstricto); dea.push(r.eat - v.eatEstricto); dic.push(r.ich - v.ichEstricto);
  }
  P(`dry-run (${path.basename(dryrunRef)}): ${dip.length} fichas contrastadas, ${faltantes} sin fila`);
  chequeo("EXACTAMENTE igual a la partición de referencia del dry-run (Δ = 0)", maxAbs([...dip, ...dea, ...dic]) === 0, `max |Δ| = ${maxAbs([...dip, ...dea, ...dic]).toFixed(6)}`);
} else {
  P("(sin JSON de dry-run — se salta)");
}

sec("4. TOP 5 por |Δ IPO|");
[...filas]
  .sort((a, b) => Math.abs(b.ipo - b.ctrlIpo) - Math.abs(a.ipo - a.ctrlIpo))
  .slice(0, 5)
  .forEach((r) => P(`   ${String(r.codigo).padEnd(34)} ${f2(r.ctrlIpo)} → ${f2(r.ipo)}  (${r.ipo - r.ctrlIpo >= 0 ? "+" : ""}${f2(r.ipo - r.ctrlIpo)})`));

sec(fallas.length === 0 ? "RESULTADO: TODOS LOS CHEQUEOS VERDES ✅" : `RESULTADO: ${fallas.length} CHEQUEO(S) EN ROJO ❌`);
if (fallas.length) {
  fallas.forEach((f) => P(`   ❌ ${f}`));
  process.exit(1);
}
