/**
 * Modelo del documento imprimible — convierte el blob de una ficha en secciones
 * legibles, sin recalcular ninguna métrica.
 *
 * Port del generador verificado en `projects/fichas-tfm/export-pdf-2026-09-07/datos.py`,
 * que se contrastó contra las 62 fichas de producción: 635 celdas por ficha de zonación
 * y el mismo número de zonas presentes y la misma completitud que guarda la aplicación,
 * con 0 diferencias.
 *
 * Tres estados por zona, y la distinción importa:
 *   true  → registrada como PRESENTE
 *   false → registrada como AUSENTE
 *   null  → la clave no existe en el registro: NUNCA SE REGISTRÓ (no es un cero)
 */
import {
  CRANEO, MANDIBULA, VERTEBRA, VERTEBRA_COMPLETA, SACRO, ESTERNON, CLAVICULA,
  COSTILLA, ESCAPULA, HUMERO, RADIO, CUBITO, COXAL, FEMUR, TIBIA, PERONE,
  MC_MT, CALCANEO, ASTRAGALO, CARPIANOS, TARSIANOS, FALANGE_POS,
  CARPIANOS_ORDEN, TARSIANOS_ORDEN, DEDOS, ALTERACIONES,
  EAT_GRUPOS_CALIDAD, EAT_CRANEO, EAT_HUESOS_PLANOS, EAT_VERTEBRAS, EAT_COSTILLAS,
} from "./anatomia";

export type Celda = boolean | null;
export interface Fila { etiqueta: string; celdas: Celda[] }
export interface Seccion {
  titulo: string;
  cols: string[];
  filas: Fila[];
  nota?: string;
  presentes: number;
  total: number;
  pct: number | null;
}

type Dict = Record<string, unknown>;

/** El total oficial del método — `convex/lib/metrics.ts :: ZONATION_TOTAL_ZONES`. */
export const TOTAL_ZONAS = 635;

const celda = (d: Dict, k: string): Celda => (k in d ? Boolean(d[k]) : null);

function seccion(titulo: string, cols: string[], filas: Fila[], nota?: string): Seccion {
  let total = 0, presentes = 0, registradas = 0;
  for (const f of filas)
    for (const c of f.celdas) {
      total++;
      if (c === true) presentes++;
      if (c !== null) registradas++;
    }
  return {
    titulo, cols, filas, nota, presentes, total,
    pct: registradas ? Math.round((presentes / registradas) * 1000) / 10 : null,
  };
}

const LR = ["Izq", "Der"];

function bilateral(d: Dict, prefijo: string, nombres: Record<string, string>,
                   claves: (string | number)[], titulo: string): Seccion {
  const filas = claves.map((k) => ({
    etiqueta: `${k}. ${nombres[String(k)] ?? k}`,
    celdas: [celda(d, `${prefijo}_${k}_L`), celda(d, `${prefijo}_${k}_R`)],
  }));
  return seccion(titulo, LR, filas);
}

function simple(d: Dict, prefijo: string, nombres: Record<string, string>,
                claves: (string | number)[], titulo: string, sep = "_"): Seccion {
  const filas = claves.map((k) => ({
    etiqueta: `${k}. ${nombres[String(k)] ?? k}`,
    celdas: [celda(d, `${prefijo}${sep}${k}`)],
  }));
  return seccion(titulo, ["Presente"], filas);
}

const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const leyenda = (r: Record<string, string>) =>
  "Zonas: " + Object.entries(r).map(([k, v]) => `${k} = ${v}`).join(" · ");

/* ───────────────────────────── Zonación ───────────────────────────── */

export function seccionesZonacion(data: Dict): Seccion[] {
  const g = (k: string) => (data[k] ?? {}) as Dict;
  const S: Seccion[] = [];

  S.push(simple(g("cranium_zones"), "cran", CRANEO, rango(1, 15), "Cráneo"));

  // ⚠️ Corrección metodológica (2026-08): la mandíbula son 7 zonas-tipo con claves
  // `mand_z1..z7`; el lado es observación, no denominador. Las claves viejas
  // `mand_N_L/R` siguen en el blob pero `metrics.ts` LAS IGNORA — mostrarlas pondría
  // en el documento datos que la aplicación no cuenta.
  S.push(simple(g("mandible_zones"), "mand_z", MANDIBULA, rango(1, 7), "Mandíbula", ""));

  const v = g("vertebrae_zones");
  const filasV: Fila[] = [];
  for (const [pref, n] of [["C", 7], ["T", 12], ["L", 5]] as [string, number][])
    for (const i of rango(1, n))
      filasV.push({
        etiqueta: `${pref}${i}`,
        celdas: rango(1, 4).map((z) => celda(v, `${pref}${i}_z${z}`)),
      });
  S.push(seccion("Vértebras", rango(1, 4).map((z) => VERTEBRA[String(z)]), filasV,
                 leyenda(VERTEBRA_COMPLETA)));

  const sac = g("sacrum_zones");
  S.push(seccion("Sacro", ["Presente"],
                 Object.entries(SACRO).map(([k, lbl]) => ({ etiqueta: lbl, celdas: [celda(sac, k)] }))));

  S.push(simple(g("sternum_zones"), "stern", ESTERNON, rango(1, 3), "Esternón"));
  S.push(bilateral(g("clavicle_zones"), "clav", CLAVICULA, rango(1, 3), "Clavícula"));

  const r = g("rib_zones");
  const filasR = rango(1, 12).map((n) => ({
    etiqueta: `Costilla ${n}`,
    celdas: (["L", "R"] as const).flatMap((s) => rango(1, 3).map((z) => celda(r, `rib${n}_z${z}_${s}`))),
  }));
  S.push(seccion("Costillas", ["Izq z1", "Izq z2", "Izq z3", "Der z1", "Der z2", "Der z3"],
                 filasR, leyenda(COSTILLA)));

  S.push(bilateral(g("scapula_zones"), "scap", ESCAPULA, rango(1, 9), "Escápula"));
  S.push(bilateral(g("humerus_zones"), "hum", HUMERO, rango(1, 11), "Húmero"));
  S.push(bilateral(g("radius_zones"), "rad", RADIO, [...rango(1, 10), "J"], "Radio"));
  S.push(bilateral(g("ulna_zones"), "uln", CUBITO, "ABCDEFGHJ".split(""), "Cúbito"));
  S.push(bilateral(g("os_coxae_zones"), "cox", COXAL, rango(1, 12), "Coxal"));
  S.push(bilateral(g("femur_zones"), "fem", FEMUR, rango(1, 11), "Fémur"));
  S.push(bilateral(g("tibia_zones"), "tib", TIBIA, rango(1, 10), "Tibia"));
  S.push(bilateral(g("fibula_zones"), "fib", PERONE, rango(1, 6), "Peroné"));

  const pat = g("patella_zones");
  S.push(seccion("Rótula", LR, [{ etiqueta: "Rótula", celdas: [celda(pat, "pat_L"), celda(pat, "pat_R")] }]));

  S.push(...extremidad(g("hand_zones"), "mano"));
  S.push(...extremidad(g("foot_zones"), "pie"));
  return S;
}

function extremidad(d: Dict, cual: "mano" | "pie"): Seccion[] {
  const S: Seccion[] = [];
  const esMano = cual === "mano";
  const preMC = esMano ? "hMC" : "fMT";
  const prePh = esMano ? "hPh" : "fPh";
  const preH = esMano ? "hCarp" : "fTars";
  const titulo = esMano ? "Mano" : "Pie";
  const cols = ["Izq z1", "Izq z2", "Izq z3", "Der z1", "Der z2", "Der z3"];

  const filasMC = rango(1, 5).map((n) => ({
    etiqueta: `${esMano ? "Metacarpiano" : "Metatarsiano"} ${n}`,
    celdas: (["L", "R"] as const).flatMap((s) => rango(1, 3).map((z) => celda(d, `${preMC}${n}_z${z}_${s}`))),
  }));
  S.push(seccion(`${titulo} — ${esMano ? "metacarpianos" : "metatarsianos"}`, cols, filasMC, leyenda(MC_MT)));

  const filasPh: Fila[] = [];
  for (const { d: dig, pos } of DEDOS)
    for (const p of pos)
      filasPh.push({
        etiqueta: `Dedo ${dig} — ${FALANGE_POS[p] ?? p}`,
        celdas: (["L", "R"] as const).flatMap((s) =>
          rango(1, 3).map((z) => celda(d, `${prePh}_d${dig}_${p}_z${z}_${s}`))),
      });
  S.push(seccion(`${titulo} — falanges (por dedo)`, cols, filasPh));

  if (!esMano) {
    const filas: Fila[] = [
      ...rango(1, 5).map((n) => ({
        etiqueta: `Calcáneo z${n} — ${CALCANEO[String(n)] ?? ""}`,
        celdas: [celda(d, `fCalc_${n}_L`), celda(d, `fCalc_${n}_R`)],
      })),
      ...rango(1, 4).map((n) => ({
        etiqueta: `Astrágalo z${n} — ${ASTRAGALO[String(n)] ?? ""}`,
        celdas: [celda(d, `fTalus_${n}_L`), celda(d, `fTalus_${n}_R`)],
      })),
    ];
    S.push(seccion("Pie — calcáneo y astrágalo", LR, filas));
  }

  const orden = esMano ? CARPIANOS_ORDEN : TARSIANOS_ORDEN;
  const nombres = esMano ? CARPIANOS : TARSIANOS;
  S.push(seccion(`${titulo} — ${esMano ? "carpianos" : "tarsianos"}`, LR,
                 orden.map((c) => ({
                   etiqueta: `${c} — ${nombres[c] ?? c}`,
                   celdas: [celda(d, `${preH}_${c}_L`), celda(d, `${preH}_${c}_R`)],
                 }))));
  return S;
}

export interface ContextoZonacion {
  nivelCapa: string; unidadRasgo: string; weathering: string;
  craneoObs: string; mandibulaObs: string;
  alteraciones: string[]; alteracionesObs: string;
  ffi: Record<string, string>[];
  fragmentos: Record<string, unknown>[];
}

export function contextoZonacion(data: Dict): ContextoZonacion {
  const tap = (data.taphonomy ?? {}) as Dict;
  const ffiRaw = (data.ffi_rows ?? []) as Record<string, string>[];
  let frags = (data.fragments ?? []) as unknown;
  if (frags && !Array.isArray(frags)) frags = Object.values(frags as Dict);
  return {
    nivelCapa: String(data.nivel_capa ?? ""),
    unidadRasgo: String(data.unidad_rasgo ?? ""),
    weathering: String(data.weathering_degree ?? ""),
    craneoObs: String(data.cranium_obs ?? ""),
    mandibulaObs: String(data.mandibula_lateralidad_obs ?? ""),
    alteraciones: Object.entries(ALTERACIONES).filter(([k]) => tap[k]).map(([, v]) => v),
    alteracionesObs: String(data.taphonomy_obs ?? ""),
    ffi: ffiRaw.filter((r) =>
      ["element", "outline", "angle", "texture", "observation"].some((c) => String(r?.[c] ?? "").trim())),
    fragmentos: (frags ?? []) as Record<string, unknown>[],
  };
}

/* ───────────────────────────── EAT ───────────────────────────── */

export interface ItemEat { nombre: string; presente: Celda }
export interface GrupoEat {
  titulo: string; tipo: "lista" | "unico";
  items: ItemEat[]; presente?: boolean;
  presentes: number; total: number;
}

/** Sin acentos y en minúsculas: el formulario escribe "Escápula der" y el dato
 *  guarda "Escapula der". Comparar literal duplicaba el grupo entero. */
const norm = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

const ESPERADO: Record<string, readonly string[]> = {
  craneo: EAT_CRANEO,
  vertebras: EAT_VERTEBRAS,
  huesosPlanos: EAT_HUESOS_PLANOS,
  costillas: EAT_COSTILLAS,
};

const GRUPOS: [string, string][] = [
  ["craneo", "Cráneo"], ["mandibula", "Mandíbula"], ["hioides", "Hioides"],
  ["vertebras", "Vértebras"], ["costillas", "Costillas"],
  ["huesosLargos", "Huesos largos"], ["huesosPlanos", "Huesos planos"],
];

export function gruposEat(data: Dict): GrupoEat[] {
  return GRUPOS.map(([key, titulo]) => {
    const v = data[key];
    if (typeof v === "boolean")
      return { titulo, tipo: "unico" as const, items: [], presente: v, presentes: v ? 1 : 0, total: 1 };

    const dict = (v ?? {}) as Dict;
    const indice = new Map(Object.keys(dict).map((k) => [norm(k), k]));
    const esperados = ESPERADO[key] ?? Object.keys(dict).sort();
    const usadas = new Set<string>();
    const items: ItemEat[] = esperados.map((nombre) => {
      const real = indice.get(norm(nombre));
      if (real !== undefined) usadas.add(real);
      return { nombre, presente: real === undefined ? null : Boolean(dict[real]) };
    });
    // Cualquier clave del registro que la nomenclatura no previó se muestra igual:
    // nunca se descarta en silencio.
    for (const k of Object.keys(dict).sort())
      if (!usadas.has(k)) items.push({ nombre: k, presente: Boolean(dict[k]) });

    return {
      titulo, tipo: "lista" as const, items,
      presentes: items.filter((i) => i.presente === true).length,
      total: items.length,
    };
  });
}

const CAMPO_EXTREMIDAD: Record<string, string> = {
  carpianos: "Carpianos", metacarpianos: "Metacarpianos", falProximales: "Falanges proximales",
  falMedias: "Falanges mediales", falDistales: "Falanges distales",
  falProxMedias: "Falanges prox. + mediales (agregado)", tarsianos: "Tarsianos (agregado)",
  calcaneo: "Calcáneo", astragalo: "Astrágalo", restoTarso: "Resto del tarso",
  metatarsianos: "Metatarsianos", falProx: "Falanges proximales",
};

export function extremidadesEat(data: Dict) {
  return ([["manoDer", "Mano derecha"], ["manoIzq", "Mano izquierda"],
           ["pieDer", "Pie derecho"], ["pieIzq", "Pie izquierdo"]] as [string, string][])
    .map(([key, titulo]) => ({
      titulo,
      filas: Object.entries((data[key] ?? {}) as Dict).sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => ({ campo: CAMPO_EXTREMIDAD[k] ?? k, valor: Number(val) })),
    }));
}

export function calidadEat(data: Dict) {
  const q = (data.quality ?? {}) as Dict;
  return Object.entries(EAT_GRUPOS_CALIDAD).map(([k, grupo]) => {
    const e = q[k] as { value?: number; obs?: string } | number | undefined;
    if (e && typeof e === "object")
      return { grupo, valor: e.value ?? null, obs: e.obs ?? "" };
    return { grupo, valor: typeof e === "number" ? e : null, obs: "" };
  });
}

/* ───────────────────────────── formato ───────────────────────────── */

/** Coma decimal, como el manuscrito del TFM. */
export function num(v: number | null | undefined, dec?: number): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const s = dec === undefined ? String(v) : v.toFixed(dec);
  return s.replace(".", ",");
}
