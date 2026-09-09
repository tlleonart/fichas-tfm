"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  EPIPHYSEAL_ZONES,
  buildMandibulaLateralidadObs,
} from "@convex/lib/zonacionMigration";
import { clavesHeredadas } from "@/lib/fichaLegacy";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ZonacionFormProps {
  initialData?: Record<string, any>;   // the saved `data` blob (method-specific keys)
  registrador?: string;
  fechaRegistro?: string;
  saving?: boolean;
  onSave: (payload: { registrador: string; fechaRegistro: string; data: Record<string, any> }) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SECTION_KEYS = [
  "context",
  "cranium",
  "mandible",
  "vertebrae",
  "sacrum",
  "sternum",
  "clavicle",
  "ribs",
  "scapula",
  "humerus",
  "radius",
  "ulna",
  "osCoxae",
  "femur",
  "tibia",
  "fibula",
  "patella",
  "hand",
  "foot",
] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_LABELS: Record<SectionKey, string> = {
  context: "Datos de contexto",
  cranium: "Cráneo (15 zonas)",
  mandible: "Mandíbula (7 zonas)",
  vertebrae: "Vértebras",
  sacrum: "Sacro",
  sternum: "Esternón (3 zonas)",
  clavicle: "Clavícula (3 zonas, L/R)",
  ribs: "Costillas (12 × L/R)",
  scapula: "Escápula (9 zonas, L/R)",
  humerus: "Húmero (11 zonas, L/R)",
  radius: "Radio (11 zonas, L/R)",
  ulna: "Cúbito (9 zonas, L/R)",
  osCoxae: "Coxal (12 zonas, L/R)",
  femur: "Fémur (11 zonas, L/R)",
  tibia: "Tibia (10 zonas, L/R)",
  fibula: "Peroné (6 zonas, L/R)",
  patella: "Rótula (L/R)",
  hand: "Mano",
  foot: "Pie",
};

/* ------------------------------------------------------------------ */
/*  Descripciones anatómicas — texto completo de la ficha indicial     */
/*  (Knüsel & Outram 2004). Son SÓLO etiquetas de display; no afectan  */
/*  claves, modelo de datos ni el cómputo de métricas del backend.     */
/* ------------------------------------------------------------------ */

const CRANIUM_ZONES: Record<number, string> = {
  1: "Frontal derecho (dividido sagitalmente por sutura metópica)",
  2: "Frontal izquierdo",
  3: "Parietal derecho",
  4: "Parietal izquierdo",
  5: "Occipital",
  6: "Temporal izquierdo (incl. raíz del proceso cigomático)",
  7: "Temporal derecho (incl. raíz del proceso cigomático)",
  8: "Esfenoides izquierdo",
  9: "Esfenoides derecho",
  10: "Cigomático izquierdo",
  11: "Cigomático derecho",
  12: "Maxilar izquierdo (incl. proceso palatino)",
  13: "Maxilar derecho (incl. proceso palatino)",
  14: "Hueso nasal izquierdo",
  15: "Hueso nasal derecho",
};

const MANDIBLE_ZONES: Record<number, string> = {
  1: "Cuerpo: alveolos de premolares y molares",
  2: "Cuerpo: alveolo del canino",
  3: "Rama ascendente inferior al proceso coronoides",
  4: "Proceso coronoides",
  5: "Porción post. de la rama y cóndilo mandibular",
  6: "Ángulo gonial, foramen mandibular, surco milohioideo (int.), inserción M. masetero (ext.)",
  7: "Porción anterior del cuerpo: alveolos de incisivos",
};

const VERTEBRA_ZONES: Record<number, string> = {
  1: "Cuerpo",
  2: "Transv. der",
  3: "Transv. izq",
  4: "Espinosa",
};

/* Descripción completa de las 4 zonas-tipo de vértebra (para leyenda). */
const VERTEBRA_ZONES_FULL: Record<number, string> = {
  1: "Cuerpo vertebral",
  2: "Proceso transverso derecho (incl. pedículo, pars interarticularis, facetas articulares)",
  3: "Proceso transverso izquierdo (incl. pedículo, pars interarticularis, facetas articulares)",
  4: "Proceso espinoso",
};

/* Sacro — 4 zonas K&O (Fig 2d). Reemplaza los 5 segmentos × 4 = 20 previos.
 * Claves canónicas que el backend computa: sac_z1..4 (ver lib/metrics.ts). */
const SACRUM_ZONES: { key: string; label: string }[] = [
  { key: "sac_z1", label: "Cuerpo" },
  { key: "sac_z2", label: "Ala / proceso transverso derecho" },
  { key: "sac_z3", label: "Ala / proceso transverso izquierdo" },
  { key: "sac_z4", label: "Cresta / proceso espinoso" },
];

const STERNUM_ZONES: Record<number, string> = {
  1: "Manubrio",
  2: "Cuerpo (corpus sterni)",
  3: "Proceso xifoides",
};

const CLAVICLE_ZONES: Record<number, string> = {
  1: "Extremo esternal",
  2: "Extremo acromial",
  3: "Diáfisis",
};

/* Descripción completa de las 3 zonas-tipo de costilla (para leyenda). */
const RIB_ZONES_FULL: Record<number, string> = {
  1: "Cabeza",
  2: "Ángulo / tubérculo (facetas costales en C1-C10)",
  3: "Cuerpo y extremo esternal",
};

const SCAPULA_ZONES: Record<number, string> = {
  1: "Proceso coracoides",
  2: "Mitad superior cavidad glenoidea",
  3: "Mitad inferior cavidad glenoidea",
  4: "Extremo acromial y 1/3 axilar de la espina",
  5: "1/3 axilar porción escamosa, cuello, área inf. al coracoides",
  6: "1/3 medio porción escamosa sup. a espina, fosa supraespinosa",
  7: "Mitad axilar porción escamosa inf. a espina, fosa infraespinosa",
  8: "1/3 vertebral porción escamosa y espina, inserción M. romboides",
  9: "Mitad vertebral porción escamosa inf. a espina",
};

const HUMERUS_ZONES: Record<number | string, string> = {
  1: "Tubérculos mayor y menor",
  2: "Cabeza (caput)",
  3: "Epicóndilo lateral",
  4: "Epicóndilo medial",
  5: "Capitulum (proc. art. lateral del cóndilo)",
  6: "Tróclea (proc. art. medial del cóndilo)",
  7: "Mitad lateral distal diáfisis, fosa olecraniana/radial",
  8: "Mitad medial distal diáfisis, fosa olecraniana/coronoidea, for. nutricio",
  9: "Área tuberosidad deltoidea",
  10: "Área opuesta a Z9, mitad longitudinal diáfisis",
  11: "Porción proximal diáfisis, cuello quirúrgico",
};

const RADIUS_ZONES: Record<number | string, string> = {
  1: "Mitad lateral cabeza radial",
  2: "Mitad medial cabeza radial",
  3: "Porción lateral articulación distal",
  4: "Porción medial articulación distal",
  5: "Porción proximal diáfisis, tuberosidad radial",
  6: "Mitad lateral diáfisis hasta punto medio, inserción M. pronador redondo",
  7: "Mitad medial diáfisis hasta punto medio, foramen nutricio",
  8: "Mitad superior del tercio distal",
  9: "Tercio distal lateral diáfisis",
  10: "Tercio distal medial diáfisis",
  J: "Proceso estiloides",
};

const ULNA_ZONES: Record<string, string> = {
  A: "Proceso olecraniano (porción 1)",
  B: "Proceso olecraniano (porción 2)",
  C: "Escotadura troclear/semilunar, proceso coronoides",
  D: "Escotadura radial",
  E: "Mitad proximal diáfisis distal a C, for. nutricio",
  F: "Porción media diáfisis",
  G: "Mitad superior 1/3 distal diáfisis",
  H: "Mitad distal 1/3 distal, inserción M. pronador cuadrado",
  J: "Proceso estiloides y cabeza, surco M. ext. carpi ulnaris",
};

const OS_COXAE_ZONES: Record<number, string> = {
  1: "Porción superior acetábulo y áreas adyacentes",
  2: "Mitad post. porción inf. acetábulo",
  3: "Mitad ant. porción inf. acetábulo",
  4: "Porción sup. isquion, espina isquiática",
  5: "Porción inf. ilion, escotadura ciática mayor",
  6: "Porción sup. tuberosidad isquiática",
  7: "Superficie auricular del ilion",
  8: "Porción sup. pubis, línea pectínea, tubérculo púbico",
  9: "Porción inf. pubis, sínfisis púbica",
  10: "Porción mayor del ilion (sin cresta)",
  11: "Porción inf. isquion, mayoría tuberosidad isquiática",
  12: "Cresta ilíaca",
};

const FEMUR_ZONES: Record<number, string> = {
  1: "Trocánter mayor",
  2: "Área del trocánter menor",
  3: "Inserción craneal M. glúteo máximo",
  4: "Cabeza (caput)",
  5: "Cuello, línea intertrocantérica (ant.), cresta intertrocantérica (post.)",
  6: "Porción media diáfisis hasta bifurcación línea áspera, for. nutricio",
  7: "Mitad lateral 1/3 distal diáfisis, mitad espacio poplíteo",
  8: "Mitad medial 1/3 distal diáfisis, mitad espacio poplíteo",
  9: "Cóndilo y epicóndilo lateral",
  10: "Cóndilo y epicóndilo medial",
  11: "Espacio intercondíleo y articulación distal anteriormente",
};

const TIBIA_ZONES: Record<number, string> = {
  1: "Cóndilo proximal medial",
  2: "Fosa intercondílea / espinas tibiales, inserción lig. cruzado post.",
  3: "Cóndilo proximal lateral",
  4: "Tuberosidad tibial",
  5: "Maleólo medial",
  6: "Maleólo lateral",
  7: "1/4 proximal diáfisis, for. nutricio (post.)",
  8: "2.º cuarto diáfisis",
  9: "3.º cuarto diáfisis",
  10: "4.º cuarto (distal) diáfisis",
};

const FIBULA_ZONES: Record<number, string> = {
  1: "Extremo proximal (epífisis), proceso estiloides",
  2: "Extremo distal (epífisis)",
  3: "1/4 más distal diáfisis, inserción lig. interóseo inf.",
  4: "1/4 medio diáfisis, for. nutricio (post.)",
  5: "2.º cuarto diáfisis",
  6: "1/4 más proximal diáfisis",
};

/* Zonas de mano/pie por elemento largo (metacarpos/metatarsos/falanges). */
const LONG_BONE_MCMT_ZONES: Record<number, string> = {
  1: "Articulación proximal",
  2: "Cóndilo articular distal",
  3: "Diáfisis",
};

const CALCANEUS_ZONES: Record<number, string> = {
  1: "Tuber calcis",
  2: "Porción distal cuerpo",
  3: "Sustentaculum tali",
  4: "Articulación proximal",
  5: "Porción prox. cuerpo inf. a articulación",
};

const TALUS_ZONES: Record<number, string> = {
  1: "Mitad medial tróclea",
  2: "Mitad lateral tróclea",
  3: "Mitad medial porción prox.",
  4: "Mitad lateral porción prox.",
};

const HAND_CARPAL_NAMES: Record<string, string> = {
  TPM: "Trapecio",
  TRD: "Trapezoide",
  CAP: "Grande (capitatum)",
  HAM: "Ganchoso (hamatum)",
  SCP: "Escafoides",
  LUN: "Semilunar",
  TRI: "Piramidal",
  PIS: "Pisiforme",
};

const FOOT_TARSAL_NAMES: Record<string, string> = {
  CU1: "Cuneiforme medial",
  CU2: "Cuneiforme intermedio",
  CU3: "Cuneiforme lateral",
  NAV: "Navicular",
  CUB: "Cuboides",
};

/* ------------------------------------------------------------------ */
/*  Figuras de referencia (ficha indicial K&O) por sección            */
/*  Dibujos con los números de zona. PNG en /public/zonacion/.        */
/* ------------------------------------------------------------------ */

type RefFigure = { src: string; alt: string };
interface SectionFigures {
  caption: string;      // leyenda (norma / vistas + n.º de figura K&O)
  images: RefFigure[];
}

const REFERENCE_FIGURES: Partial<Record<SectionKey, SectionFigures>> = {
  cranium: {
    caption:
      "Cráneo — arriba: norma facialis, lateralis dextra y sinistra (Figs. 13-15). Abajo: norma verticalis, occipitalis y basalis (Figs. 16-18).",
    images: [
      { src: "/zonacion/cranium-facialis-1.png", alt: "Cráneo — norma facialis (Fig. 13)" },
      { src: "/zonacion/cranium-facialis-2.png", alt: "Cráneo — norma lateralis dextra (Fig. 14)" },
      { src: "/zonacion/cranium-facialis-3.png", alt: "Cráneo — norma lateralis sinistra (Fig. 15)" },
      { src: "/zonacion/cranium-verticalis-1.png", alt: "Cráneo — norma verticalis (Fig. 17)" },
      { src: "/zonacion/cranium-verticalis-2.png", alt: "Cráneo — norma occipitalis (Fig. 16)" },
      { src: "/zonacion/cranium-verticalis-3.png", alt: "Cráneo — norma basalis (Fig. 18)" },
    ],
  },
  mandible: {
    caption: "Mandíbula — vistas medial y lateral (Fig. 1).",
    images: [{ src: "/zonacion/mandible.png", alt: "Mandíbula — zonas 1-7 (Fig. 1)" }],
  },
  vertebrae: {
    caption: "Vértebra — vistas superior y lateral: cervical (2a), torácica (2b), lumbar (2c). Las 4 zonas-tipo aplican a toda la columna.",
    images: [
      { src: "/zonacion/vertebra-2a.png", alt: "Vértebra cervical (Fig. 2a)" },
      { src: "/zonacion/vertebra-2b.png", alt: "Vértebra torácica (Fig. 2b)" },
      { src: "/zonacion/vertebra-2c.png", alt: "Vértebra lumbar (Fig. 2c)" },
    ],
  },
  sacrum: {
    caption: "Sacro — vistas ventral y dorsal (Fig. 2d).",
    images: [{ src: "/zonacion/sacrum.png", alt: "Sacro — zonas 1-4 (Fig. 2d)" }],
  },
  sternum: {
    caption: "Esternón (Fig. 19).",
    images: [{ src: "/zonacion/sternum.png", alt: "Esternón — zonas 1-3 (Fig. 19)" }],
  },
  clavicle: {
    caption: "Clavícula (Fig. 20).",
    images: [{ src: "/zonacion/clavicle.png", alt: "Clavícula — zonas 1-3 (Fig. 20)" }],
  },
  ribs: {
    caption: "Costillas — 1.ª costilla (3a) y costilla tipo (3b) (Fig. 3).",
    images: [
      { src: "/zonacion/rib-3a.png", alt: "1.ª costilla (Fig. 3a)" },
      { src: "/zonacion/rib-3b.png", alt: "Costilla tipo (Fig. 3b)" },
    ],
  },
  scapula: {
    caption: "Escápula — vistas ventral y dorsal (Fig. 4).",
    images: [{ src: "/zonacion/scapula.png", alt: "Escápula — zonas 1-9 (Fig. 4)" }],
  },
  humerus: {
    caption: "Húmero — vistas posterior y anterior (Fig. 5).",
    images: [{ src: "/zonacion/humerus.png", alt: "Húmero — zonas 1-11 (Fig. 5)" }],
  },
  radius: {
    caption: "Radio — vistas posterior y anterior (Fig. 6).",
    images: [{ src: "/zonacion/radius.png", alt: "Radio — zonas 1-10 + J (Fig. 6)" }],
  },
  ulna: {
    caption: "Cúbito / ulna — vistas posterior y anterior (Fig. 7).",
    images: [{ src: "/zonacion/ulna.png", alt: "Cúbito — zonas A-J (Fig. 7)" }],
  },
  osCoxae: {
    caption: "Hueso coxal — vistas medial y lateral (Fig. 8).",
    images: [{ src: "/zonacion/os-coxae.png", alt: "Coxal — zonas 1-12 (Fig. 8)" }],
  },
  femur: {
    caption: "Fémur — vistas posterior y anterior (Fig. 9).",
    images: [{ src: "/zonacion/femur.png", alt: "Fémur — zonas 1-11 (Fig. 9)" }],
  },
  tibia: {
    caption: "Tibia — vistas posterior y anterior (Fig. 10).",
    images: [{ src: "/zonacion/tibia.png", alt: "Tibia — zonas 1-10 (Fig. 10)" }],
  },
  fibula: {
    caption: "Peroné / fíbula — vistas anterior y posterior (Fig. 21).",
    images: [{ src: "/zonacion/fibula.png", alt: "Peroné — zonas 1-6 (Fig. 21)" }],
  },
  hand: {
    caption: "Mano — vistas dorsal (11a) y palmar (11b) (Fig. 11).",
    images: [
      { src: "/zonacion/hand-11a.png", alt: "Mano — vista dorsal (Fig. 11a)" },
      { src: "/zonacion/hand-11b.png", alt: "Mano — vista palmar (Fig. 11b)" },
    ],
  },
  foot: {
    caption: "Pie — vistas dorsal (12a) y plantar (12b) (Fig. 12).",
    images: [
      { src: "/zonacion/foot-12a.png", alt: "Pie — vista dorsal (Fig. 12a)" },
      { src: "/zonacion/foot-12b.png", alt: "Pie — vista plantar (Fig. 12b)" },
    ],
  },
};

const HAND_CARPALS = ["TPM", "TRD", "CAP", "HAM", "SCP", "LUN", "TRI", "PIS"];
const FOOT_TARSALS = ["CU1", "CU2", "CU3", "NAV", "CUB"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function range(start: number, end: number): number[] {
  const arr: number[] = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

function pct(present: number, total: number): string {
  if (total === 0) return "0.0";
  return ((present / total) * 100).toFixed(1);
}

function countChecked(obj: Record<string, boolean>): number {
  return Object.values(obj).filter(Boolean).length;
}

/* Per-digit phalanx model. Digit I (pollex/hallux) has no medial phalanx. */
const PHALANX_DIGITS: { d: string; pos: ("P" | "M" | "D")[] }[] = [
  { d: "I", pos: ["P", "D"] },
  { d: "II", pos: ["P", "M", "D"] },
  { d: "III", pos: ["P", "M", "D"] },
  { d: "IV", pos: ["P", "M", "D"] },
  { d: "V", pos: ["P", "M", "D"] },
];
const PHALANX_POS_LABEL: Record<string, string> = {
  P: "Proximal",
  M: "Medial",
  D: "Distal",
};

/* ------------------------------------------------------------------ */
/*  Bulk-fill key generators (F1)                                      */
/*  Each returns the full list of PRESENCE checkbox keys for a section */
/*  (mirrors exactly what the section renders). Fusion selects,        */
/*  observations and taphonomy are intentionally excluded.             */
/* ------------------------------------------------------------------ */

function bilatKeys(prefix: string, zones: (number | string)[]): string[] {
  return zones.flatMap((z) => [`${prefix}_${z}_L`, `${prefix}_${z}_R`]);
}

function phalanxKeys(prefix: string): string[] {
  return PHALANX_DIGITS.flatMap(({ d, pos }) =>
    pos.flatMap((p) =>
      (["L", "R"] as const).flatMap((side) =>
        range(1, 3).map((z) => `${prefix}_d${d}_${p}_z${z}_${side}`),
      ),
    ),
  );
}

const CRANIUM_KEYS = Object.keys(CRANIUM_ZONES).map((z) => `cran_${z}`);
const MANDIBLE_KEYS = [1, 2, 3, 4, 5, 6, 7].flatMap((z) => [`mand_${z}_L`, `mand_${z}_R`]);
const VERTEBRAE_KEYS = ([["C", 7], ["T", 12], ["L", 5]] as const).flatMap(([p, c]) =>
  range(1, c).flatMap((i) => range(1, 4).map((z) => `${p}${i}_z${z}`)),
);
const SACRUM_KEYS = SACRUM_ZONES.map((z) => z.key);
const STERNUM_KEYS = [1, 2, 3].map((z) => `stern_${z}`);
const CLAVICLE_KEYS = bilatKeys("clav", range(1, 3));
const RIB_KEYS = range(1, 12).flatMap((r) =>
  range(1, 3).flatMap((z) => [`rib${r}_z${z}_L`, `rib${r}_z${z}_R`]),
);
const SCAPULA_KEYS = bilatKeys("scap", range(1, 9));
const HUMERUS_KEYS = bilatKeys("hum", range(1, 11));
const RADIUS_KEYS = bilatKeys("rad", [...range(1, 10), "J"]);
const ULNA_KEYS = bilatKeys("uln", ["A", "B", "C", "D", "E", "F", "G", "H", "J"]);
const OS_COXAE_KEYS = bilatKeys("cox", range(1, 12));
const FEMUR_KEYS = bilatKeys("fem", range(1, 11));
const TIBIA_KEYS = bilatKeys("tib", range(1, 10));
const FIBULA_KEYS = bilatKeys("fib", range(1, 6));
const PATELLA_KEYS = ["pat_L", "pat_R"];
const HAND_KEYS = [
  ...range(1, 5).flatMap((mc) =>
    range(1, 3).flatMap((z) => [`hMC${mc}_z${z}_L`, `hMC${mc}_z${z}_R`]),
  ),
  ...phalanxKeys("hPh"),
  ...HAND_CARPALS.flatMap((c) => [`hCarp_${c}_L`, `hCarp_${c}_R`]),
];
const FOOT_KEYS = [
  ...range(1, 5).flatMap((mt) =>
    range(1, 3).flatMap((z) => [`fMT${mt}_z${z}_L`, `fMT${mt}_z${z}_R`]),
  ),
  ...phalanxKeys("fPh"),
  ...bilatKeys("fCalc", range(1, 5)),
  ...bilatKeys("fTalus", range(1, 4)),
  ...FOOT_TARSALS.flatMap((t) => [`fTars_${t}_L`, `fTars_${t}_R`]),
];

/** Build a fully-checked state object from a key list. */
function fillKeys(keys: string[]): Record<string, boolean> {
  return Object.fromEntries(keys.map((k) => [k, true]));
}

/**
 * Per-digit phalanx grid: each digit's phalanges (I–V × position) with the 3
 * standard zones (Z1 proximal articulation, Z2 distal condyle, Z3 diaphysis)
 * per side. Keys are ASCII: `${prefix}_d${digit}_${pos}_z${z}_${side}`.
 */
function renderPhalanges(
  prefix: string,
  state: Record<string, boolean>,
  toggler: (k: string) => void,
) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr className="bg-surface-2">
            <th className="border border-line-strong px-2 py-1 text-left" rowSpan={2}>
              Dedo / Falange
            </th>
            <th className="border border-line-strong px-2 py-1 text-center" colSpan={3}>
              Izquierda
            </th>
            <th className="border border-line-strong px-2 py-1 text-center" colSpan={3}>
              Derecha
            </th>
          </tr>
          <tr className="bg-surface-2">
            {["Z1", "Z2", "Z3", "Z1", "Z2", "Z3"].map((lbl, i) => (
              <th key={`${lbl}_${i}`} className="border border-line-strong px-2 py-1 text-center">
                {lbl}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PHALANX_DIGITS.flatMap(({ d, pos }) =>
            pos.map((p) => (
              <tr key={`${d}_${p}`} className="hover:bg-surface-2">
                <td className="border border-line-strong px-2 py-1 font-medium whitespace-nowrap">
                  {d} · {PHALANX_POS_LABEL[p]}
                </td>
                {(["L", "R"] as const).flatMap((side) =>
                  range(1, 3).map((z) => {
                    const key = `${prefix}_d${d}_${p}_z${z}_${side}`;
                    return (
                      <CheckCell
                        key={`${side}${z}`}
                        checked={!!state[key]}
                        onChange={() => toggler(key)}
                      />
                    );
                  }),
                )}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  label,
  isOpen,
  onToggle,
  badge,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between bg-surface-2 text-ink px-4 py-3 rounded-lg hover:bg-line-strong transition text-left sticky top-14 z-20"
    >
      <span className="font-semibold text-sm">{label}</span>
      <span className="flex items-center gap-3">
        {badge && (
          <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
        <span className="text-xs">{isOpen ? "▲" : "▼"}</span>
      </span>
    </button>
  );
}

function CompletionBadge({ present, total }: { present: number; total: number }) {
  return (
    <div className="text-xs text-faint mt-1">
      {present}/{total} zonas ({pct(present, total)}%)
    </div>
  );
}

/* Full-cell tappable checkbox for data tables (F2 — >=44px touch target). */
function CheckCell({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <td className="border border-line-strong p-0 text-center">
      <label className="tap-cell">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="tap-check"
        />
      </label>
    </td>
  );
}

/* "Marcar todo" / "Limpiar" controls for a section (F1). */
function BulkControls({
  onAll,
  onClear,
  label,
}: {
  onAll: () => void;
  onClear: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onAll}
        className="bulk-btn"
        aria-label={`Marcar todo — ${label}`}
      >
        Marcar todo
      </button>
      <button
        type="button"
        onClick={onClear}
        className="bulk-btn"
        aria-label={`Limpiar — ${label}`}
      >
        Limpiar
      </button>
    </div>
  );
}

/* Figura(s) de referencia de la ficha indicial (dibujos con n.º de zona).
 * Panel plegable, visible por defecto. Las láminas son line-art negro sobre
 * blanco → se renderizan siempre sobre fondo claro para que se vean también
 * en modo oscuro. */
function ReferenceFigure({ section }: { section: SectionKey }) {
  const fig = REFERENCE_FIGURES[section];
  const [open, setOpen] = useState(true);
  if (!fig) return null;
  return (
    <div className="border border-line rounded-lg bg-surface-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted hover:bg-line-strong transition"
        aria-expanded={open}
      >
        <span>📖 Figura de referencia (Knüsel &amp; Outram)</span>
        <span>{open ? "Ocultar ▲" : "Ver figura ▼"}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2">
          <div className="flex flex-wrap gap-3 justify-center">
            {fig.images.map((im) => (
              <div key={im.src} className="bg-white rounded-md p-2 border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={im.src}
                  alt={im.alt}
                  loading="lazy"
                  className="block h-auto max-h-[420px] w-auto max-w-full object-contain"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-faint text-center">{fig.caption}</p>
        </div>
      )}
    </div>
  );
}

/* Leyenda compacta de descripciones de zona, para secciones que se registran
 * como matriz (vértebras, costillas, mano, pie) donde no cabe la descripción
 * completa en el encabezado de columna. */
function ZoneLegend({
  title,
  entries,
}: {
  title: string;
  entries: { z: string; label: string }[];
}) {
  return (
    <div className="text-xs text-muted bg-surface-2 rounded-md px-3 py-2">
      <span className="font-semibold">{title}:</span>{" "}
      {entries.map((e, i) => (
        <span key={e.z}>
          <span className="font-medium">{e.z}</span> {e.label}
          {i < entries.length - 1 ? " · " : ""}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ZonacionForm({ initialData, registrador: registradorProp, fechaRegistro: fechaRegistroProp, onSave, saving }: ZonacionFormProps) {
  /* Deep-link desde el banner de revisiones: si la URL trae #sec-<section>,
   * esa sección arranca abierta (además de "context"). */
  const hashSection = useMemo<SectionKey | null>(() => {
    if (typeof window === "undefined") return null;
    const m = window.location.hash.match(/^#sec-([a-zA-Z]+)$/);
    if (!m) return null;
    const key = m[1] as SectionKey;
    return SECTION_KEYS.includes(key) ? key : null;
  }, []);

  /* ---------- section toggle state ---------- */
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const k of SECTION_KEYS) init[k] = k === "context" || k === hashSection;
    return init as Record<SectionKey, boolean>;
  });

  const toggle = useCallback((key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /* Tras montar con un deep-link, traemos la sección abierta a la vista. */
  useEffect(() => {
    if (!hashSection) return;
    const t = setTimeout(() => {
      document
        .getElementById(`sec-${hashSection}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [hashSection]);

  /* ---------- context fields ---------- */
  const [registrador, setRegistrador] = useState(registradorProp ?? "");
  const [fechaRegistro, setFechaRegistro] = useState(fechaRegistroProp ?? "");
  const [unidadRasgo, setUnidadRasgo] = useState(initialData?.unidad_rasgo ?? "");
  const [nivelCapa, setNivelCapa] = useState(initialData?.nivel_capa ?? "");

  /* ---------- cranium ---------- */
  const [craniumZones, setCraniumZones] = useState<Record<string, boolean>>(
    () => initialData?.cranium_zones ?? {}
  );
  const [craniumObs, setCraniumObs] = useState(initialData?.cranium_obs ?? "");

  /* ---------- mandible ---------- */
  const [mandibleZones, setMandibleZones] = useState<Record<string, boolean>>(
    () => initialData?.mandible_zones ?? {}
  );

  /* ---------- vertebrae ---------- */
  const [vertebraeZones, setVertebraeZones] = useState<Record<string, boolean>>(
    () => initialData?.vertebrae_zones ?? {}
  );

  /* ---------- sacrum ---------- */
  const [sacrumZones, setSacrumZones] = useState<Record<string, boolean>>(
    () => initialData?.sacrum_zones ?? {}
  );

  /* ---------- sternum ---------- */
  const [sternumZones, setSternumZones] = useState<Record<string, boolean>>(
    () => initialData?.sternum_zones ?? {}
  );

  /* ---------- clavicle ---------- */
  const [clavicleZones, setClavicleZones] = useState<Record<string, boolean>>(
    () => initialData?.clavicle_zones ?? {}
  );

  /* ---------- ribs ---------- */
  const [ribZones, setRibZones] = useState<Record<string, boolean>>(
    () => initialData?.rib_zones ?? {}
  );

  /* ---------- scapula ---------- */
  const [scapulaZones, setScapulaZones] = useState<Record<string, boolean>>(
    () => initialData?.scapula_zones ?? {}
  );

  /* ---------- humerus ---------- */
  const [humerusZones, setHumerusZones] = useState<Record<string, boolean>>(
    () => initialData?.humerus_zones ?? {}
  );
  const [humerusFusion, setHumerusFusion] = useState<Record<string, string>>(
    () => initialData?.humerus_fusion ?? {}
  );

  /* ---------- radius ---------- */
  const [radiusZones, setRadiusZones] = useState<Record<string, boolean>>(
    () => initialData?.radius_zones ?? {}
  );
  const [radiusFusion, setRadiusFusion] = useState<Record<string, string>>(
    () => initialData?.radius_fusion ?? {}
  );

  /* ---------- ulna ---------- */
  const [ulnaZones, setUlnaZones] = useState<Record<string, boolean>>(
    () => initialData?.ulna_zones ?? {}
  );
  const [ulnaFusion, setUlnaFusion] = useState<Record<string, string>>(
    () => initialData?.ulna_fusion ?? {}
  );

  /* ---------- os coxae ---------- */
  const [osCoxaeZones, setOsCoxaeZones] = useState<Record<string, boolean>>(
    () => initialData?.os_coxae_zones ?? {}
  );

  /* ---------- femur ---------- */
  const [femurZones, setFemurZones] = useState<Record<string, boolean>>(
    () => initialData?.femur_zones ?? {}
  );
  const [femurFusion, setFemurFusion] = useState<Record<string, string>>(
    () => initialData?.femur_fusion ?? {}
  );

  /* ---------- tibia ---------- */
  const [tibiaZones, setTibiaZones] = useState<Record<string, boolean>>(
    () => initialData?.tibia_zones ?? {}
  );
  const [tibiaFusion, setTibiaFusion] = useState<Record<string, string>>(
    () => initialData?.tibia_fusion ?? {}
  );

  /* ---------- fibula ---------- */
  const [fibulaZones, setFibulaZones] = useState<Record<string, boolean>>(
    () => initialData?.fibula_zones ?? {}
  );
  const [fibulaFusion, setFibulaFusion] = useState<Record<string, string>>(
    () => initialData?.fibula_fusion ?? {}
  );

  /* ---------- patella (own element, K&O Z4 correction) ---------- */
  const [patellaZones, setPatellaZones] = useState<Record<string, boolean>>(
    () => {
      const prev = (initialData?.patella_zones ?? {}) as Record<string, boolean>;
      // Backward-compat: if a pre-migration ficha still carries fPatella_* in
      // foot_zones and no patella_zones yet, seed from foot so the form shows
      // what was recorded. (Read-only seed; foot_zones is left untouched.)
      const foot = (initialData?.foot_zones ?? {}) as Record<string, boolean>;
      return {
        pat_L: Boolean(prev.pat_L) || Boolean(foot.fPatella_L),
        pat_R: Boolean(prev.pat_R) || Boolean(foot.fPatella_R),
      };
    }
  );

  /* ---------- hand ---------- */
  const [handZones, setHandZones] = useState<Record<string, boolean>>(
    () => initialData?.hand_zones ?? {}
  );

  /* ---------- foot ---------- */
  const [footZones, setFootZones] = useState<Record<string, boolean>>(
    () => initialData?.foot_zones ?? {}
  );

  /* ---------------------------------------------------------------- */
  /*  Completeness calculations                                       */
  /* ---------------------------------------------------------------- */

  const craniumStats = useMemo(() => {
    const n = countChecked(craniumZones);
    return { present: n, total: 15, pct: pct(n, 15) };
  }, [craniumZones]);

  const mandibleStats = useMemo(() => {
    // Completitud sobre 7 zonas-tipo K&O: una zona cuenta si está de cualquier
    // lado (L o R). El lado se registra como observación de lateralidad, no en
    // el denominador (SDD §Z3 — coincide con computeZonacion `mand_z[1-7]`).
    let n = 0;
    for (const k of [1, 2, 3, 4, 5, 6, 7]) {
      if (mandibleZones[`mand_${k}_L`] || mandibleZones[`mand_${k}_R`]) n += 1;
    }
    return { present: n, total: 7, pct: pct(n, 7) };
  }, [mandibleZones]);

  const vertebraeStats = useMemo(() => {
    const n = countChecked(vertebraeZones);
    const total = (7 + 12 + 5) * 4; // 96
    return { present: n, total, pct: pct(n, total) };
  }, [vertebraeZones]);

  const sacrumStats = useMemo(() => {
    // 4 zonas-tipo K&O (sac_z1..4). El cómputo del backend cuenta sólo sac_z*.
    const n = SACRUM_ZONES.filter(({ key }) => sacrumZones[key]).length;
    return { present: n, total: 4, pct: pct(n, 4) };
  }, [sacrumZones]);

  const sternumStats = useMemo(() => {
    const n = countChecked(sternumZones);
    return { present: n, total: 3, pct: pct(n, 3) };
  }, [sternumZones]);

  const clavicleStats = useMemo(() => {
    const n = countChecked(clavicleZones);
    return { present: n, total: 6, pct: pct(n, 6) };
  }, [clavicleZones]);

  const ribStats = useMemo(() => {
    const n = countChecked(ribZones);
    return { present: n, total: 72, pct: pct(n, 72) };
  }, [ribZones]);

  const scapulaStats = useMemo(() => {
    const n = countChecked(scapulaZones);
    return { present: n, total: 18, pct: pct(n, 18) };
  }, [scapulaZones]);

  const humerusStats = useMemo(() => {
    const n = countChecked(humerusZones);
    return { present: n, total: 22, pct: pct(n, 22) };
  }, [humerusZones]);

  const radiusStats = useMemo(() => {
    const n = countChecked(radiusZones);
    return { present: n, total: 22, pct: pct(n, 22) };
  }, [radiusZones]);

  const ulnaStats = useMemo(() => {
    const n = countChecked(ulnaZones);
    return { present: n, total: 18, pct: pct(n, 18) };
  }, [ulnaZones]);

  const osCoxaeStats = useMemo(() => {
    const n = countChecked(osCoxaeZones);
    return { present: n, total: 24, pct: pct(n, 24) };
  }, [osCoxaeZones]);

  const femurStats = useMemo(() => {
    const n = countChecked(femurZones);
    return { present: n, total: 22, pct: pct(n, 22) };
  }, [femurZones]);

  const tibiaStats = useMemo(() => {
    const n = countChecked(tibiaZones);
    return { present: n, total: 20, pct: pct(n, 20) };
  }, [tibiaZones]);

  const fibulaStats = useMemo(() => {
    const n = countChecked(fibulaZones);
    return { present: n, total: 12, pct: pct(n, 12) };
  }, [fibulaZones]);

  const patellaStats = useMemo(() => {
    const n = countChecked(patellaZones);
    return { present: n, total: 2, pct: pct(n, 2) };
  }, [patellaZones]);

  /* ---------------------------------------------------------------- */
  /*  Generic checkbox toggler factories                               */
  /* ---------------------------------------------------------------- */

  function makeToggle(
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  ) {
    return (key: string) =>
      setter((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const toggleCranium = makeToggle(setCraniumZones);
  const toggleMandible = makeToggle(setMandibleZones);
  const toggleVertebrae = makeToggle(setVertebraeZones);
  const toggleSacrum = makeToggle(setSacrumZones);
  const toggleSternum = makeToggle(setSternumZones);
  const toggleClavicle = makeToggle(setClavicleZones);
  const toggleRib = makeToggle(setRibZones);
  const toggleScapula = makeToggle(setScapulaZones);
  const toggleHumerus = makeToggle(setHumerusZones);
  const toggleRadius = makeToggle(setRadiusZones);
  const toggleUlna = makeToggle(setUlnaZones);
  const toggleOsCoxae = makeToggle(setOsCoxaeZones);
  const toggleFemur = makeToggle(setFemurZones);
  const toggleTibia = makeToggle(setTibiaZones);
  const toggleFibula = makeToggle(setFibulaZones);
  const togglePatella = makeToggle(setPatellaZones);
  const toggleHand = makeToggle(setHandZones);
  const toggleFoot = makeToggle(setFootZones);

  /* ---------------------------------------------------------------- */
  /*  Claves retiradas (2026-09-09)                                    */
  /*  Fragmentos, FFI y alteraciones tafonómicas salieron de la ficha, */
  /*  pero `fichas.actualizar` REEMPLAZA `data` entera: si el payload   */
  /*  no las incluyera, reguardar una ficha que las tiene borraría el   */
  /*  dato. Se arrastran tal como vinieron. Ver `@/lib/fichaLegacy`.    */
  /* ---------------------------------------------------------------- */
  const heredado = useMemo(() => clavesHeredadas(initialData), [initialData]);

  /* ---------------------------------------------------------------- */
  /*  Submit                                                           */
  /* ---------------------------------------------------------------- */

  const handleSubmit = useCallback(async () => {
    // Mandíbula: el form captura presencia por lado (mand_{k}_L/R). Derivamos
    // las 7 zonas-tipo canónicas mand_z{k} = OR(L,R) que el backend computa, y
    // la observación de lateralidad legible con el helper canónico de Ronan.
    const mandibleOut: Record<string, boolean> = { ...mandibleZones };
    for (const k of [1, 2, 3, 4, 5, 6, 7]) {
      mandibleOut[`mand_z${k}`] =
        Boolean(mandibleZones[`mand_${k}_L`]) || Boolean(mandibleZones[`mand_${k}_R`]);
    }
    const mandibulaLateralidadObs = buildMandibulaLateralidadObs(mandibleZones);

    await onSave({
      registrador,
      fechaRegistro,
      data: {
        // Primero lo heredado: ninguna clave viva puede ser pisada.
        ...heredado,
        unidad_rasgo: unidadRasgo,
        nivel_capa: nivelCapa,
        cranium_zones: craniumZones,
        cranium_obs: craniumObs,
        mandible_zones: mandibleOut,
        mandibula_lateralidad_obs: mandibulaLateralidadObs,
        vertebrae_zones: vertebraeZones,
        sacrum_zones: sacrumZones,
        sternum_zones: sternumZones,
        clavicle_zones: clavicleZones,
        rib_zones: ribZones,
        scapula_zones: scapulaZones,
        humerus_zones: humerusZones,
        humerus_fusion: humerusFusion,
        radius_zones: radiusZones,
        radius_fusion: radiusFusion,
        ulna_zones: ulnaZones,
        ulna_fusion: ulnaFusion,
        os_coxae_zones: osCoxaeZones,
        femur_zones: femurZones,
        femur_fusion: femurFusion,
        tibia_zones: tibiaZones,
        tibia_fusion: tibiaFusion,
        fibula_zones: fibulaZones,
        fibula_fusion: fibulaFusion,
        patella_zones: patellaZones,
        hand_zones: handZones,
        foot_zones: footZones,
      },
    });
  }, [
    onSave, registrador, fechaRegistro,
    unidadRasgo, nivelCapa,
    craniumZones, craniumObs, mandibleZones, vertebraeZones,
    sacrumZones, sternumZones, clavicleZones, ribZones,
    scapulaZones, humerusZones, humerusFusion, radiusZones,
    radiusFusion, ulnaZones, ulnaFusion, osCoxaeZones,
    femurZones, femurFusion, tibiaZones, tibiaFusion,
    fibulaZones, fibulaFusion, patellaZones, handZones, footZones,
    heredado,
  ]);

  /* ---------------------------------------------------------------- */
  /*  Rendering helpers                                                */
  /* ---------------------------------------------------------------- */

  /** A grid of checkboxes for a bilateral bone (L/R) with numbered zones */
  function renderBilateralZoneGrid(
    zoneCount: number,
    state: Record<string, boolean>,
    toggler: (k: string) => void,
    prefix: string,
    zoneLabels?: Record<number | string, string>,
    zones?: (number | string)[],
  ) {
    const zoneKeys = zones ?? range(1, zoneCount);
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-surface-2">
              <th className="border border-line-strong px-2 py-1 text-left">Zona</th>
              <th className="border border-line-strong px-2 py-1 text-center">Izq</th>
              <th className="border border-line-strong px-2 py-1 text-center">Der</th>
            </tr>
          </thead>
          <tbody>
            {zoneKeys.map((z) => {
              const kL = `${prefix}_${z}_L`;
              const kR = `${prefix}_${z}_R`;
              return (
                <tr key={String(z)} className="hover:bg-surface-2">
                  <td className="border border-line-strong px-2 py-1">
                    {zoneLabels ? `${z} - ${zoneLabels[z]}` : `Z${z}`}
                  </td>
                  <CheckCell checked={!!state[kL]} onChange={() => toggler(kL)} />
                  <CheckCell checked={!!state[kR]} onChange={() => toggler(kR)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  /** Bilateral zone grid WITH fusion state column */
  function renderBilateralWithFusion(
    zoneCount: number,
    state: Record<string, boolean>,
    toggler: (k: string) => void,
    prefix: string,
    fusionState: Record<string, string>,
    fusionSetter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    zones?: (number | string)[],
    zoneLabels?: Record<number | string, string>,
  ) {
    const zoneKeys = zones ?? range(1, zoneCount);
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-surface-2">
              <th className="border border-line-strong px-2 py-1 text-left">Zona</th>
              <th className="border border-line-strong px-2 py-1 text-center">Izq</th>
              <th className="border border-line-strong px-2 py-1 text-center">Der</th>
              <th className="border border-line-strong px-2 py-1 text-center">Fusión Izq</th>
              <th className="border border-line-strong px-2 py-1 text-center">Fusión Der</th>
            </tr>
          </thead>
          <tbody>
            {zoneKeys.map((z) => {
              const kL = `${prefix}_${z}_L`;
              const kR = `${prefix}_${z}_R`;
              const fL = `${prefix}_${z}_fusL`;
              const fR = `${prefix}_${z}_fusR`;
              // Fusión SOLO en zonas epifisarias (SDD §Z1, tabla EPIPHYSEAL_ZONES).
              // En diáfisis no se registra fusión → mostramos un guion atenuado.
              const isEpiphysis = (EPIPHYSEAL_ZONES[prefix] ?? []).includes(String(z));
              const fusionCell = (fKey: string) =>
                isEpiphysis ? (
                  <select
                    value={fusionState[fKey] ?? ""}
                    onChange={(e) =>
                      fusionSetter((p) => ({ ...p, [fKey]: e.target.value }))
                    }
                    className="text-xs border border-line-strong rounded px-1 py-0.5"
                  >
                    <option value="">--</option>
                    <option value="F">Fusionado</option>
                    <option value="PUF">PUF</option>
                    <option value="DUF">DUF</option>
                  </select>
                ) : (
                  <span className="text-faint" title="Diáfisis — no se registra fusión">
                    —
                  </span>
                );
              return (
                <tr key={String(z)} className="hover:bg-surface-2">
                  <td className="border border-line-strong px-2 py-1">
                    <span className="font-medium">Z{z}</span>
                    {zoneLabels?.[z] ? ` - ${zoneLabels[z]}` : null}
                    {!isEpiphysis && (
                      <span className="ml-1 text-faint" title="Diáfisis">
                        (diáfisis)
                      </span>
                    )}
                  </td>
                  <CheckCell checked={!!state[kL]} onChange={() => toggler(kL)} />
                  <CheckCell checked={!!state[kR]} onChange={() => toggler(kR)} />
                  <td className="border border-line-strong px-2 py-1 text-center">
                    {fusionCell(fL)}
                  </td>
                  <td className="border border-line-strong px-2 py-1 text-center">
                    {fusionCell(fR)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  /** Vertebrae sub-grid for a column group (C, T, or L) */
  function renderVertebraeBlock(prefix: string, count: number) {
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-surface-2">
              <th className="border border-line-strong px-2 py-1 text-left">{prefix}</th>
              {Object.entries(VERTEBRA_ZONES).map(([z, lbl]) => (
                <th key={z} className="border border-line-strong px-2 py-1 text-center">
                  {z}-{lbl}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {range(1, count).map((i) => (
              <tr key={i} className="hover:bg-surface-2">
                <td className="border border-line-strong px-2 py-1 font-medium">
                  {prefix}{i}
                </td>
                {range(1, 4).map((z) => {
                  const key = `${prefix}${i}_z${z}`;
                  return (
                    <CheckCell
                      key={z}
                      checked={!!vertebraeZones[key]}
                      onChange={() => toggleVertebrae(key)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-3" id="zonacion-form">
      {/* ====== 1. Context ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.context}
          isOpen={openSections.context}
          onToggle={() => toggle("context")}
        />
        {openSections.context && (
          <div className="border border-line rounded-b-lg p-4 bg-surface grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: "Registrador", value: registrador, setter: setRegistrador },
              { label: "Fecha de registro", value: fechaRegistro, setter: setFechaRegistro },
              { label: "Unidad/rasgo", value: unidadRasgo, setter: setUnidadRasgo },
              { label: "Nivel/capa", value: nivelCapa, setter: setNivelCapa },
            ].map(({ label, value, setter }) => (
              <label key={label} className="block text-sm">
                <span className="font-medium text-muted">{label}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="mt-1 block w-full border border-line-strong rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-accent"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ====== 2. Cranium ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.cranium}
          isOpen={openSections.cranium}
          onToggle={() => toggle("cranium")}
          badge={`${craniumStats.present}/15 (${craniumStats.pct}%)`}
        />
        {openSections.cranium && (
          <div className="border border-line rounded-b-lg p-4 bg-surface space-y-3">
            <ReferenceFigure section="cranium" />
            <div className="flex justify-end">
              <BulkControls
                label={SECTION_LABELS.cranium}
                onAll={() => setCraniumZones(fillKeys(CRANIUM_KEYS))}
                onClear={() => setCraniumZones({})}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(CRANIUM_ZONES).map(([z, lbl]) => {
                const key = `cran_${z}`;
                return (
                  <label
                    key={z}
                    className="tap-label flex items-center gap-2 text-xs bg-surface-2 rounded px-2 py-1.5 hover:bg-surface-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!craniumZones[key]}
                      onChange={() => toggleCranium(key)}
                      className="tap-check"
                    />
                    <span>
                      {z}-{lbl}
                    </span>
                  </label>
                );
              })}
            </div>
            <CompletionBadge present={craniumStats.present} total={15} />
            <label className="block text-sm">
              <span className="font-medium text-muted">Observaciones</span>
              <textarea
                value={craniumObs}
                onChange={(e) => setCraniumObs(e.target.value)}
                rows={2}
                className="mt-1 block w-full border border-line-strong rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-accent"
              />
            </label>
          </div>
        )}
      </div>

      {/* ====== 3. Mandible ====== */}
      <div id="sec-mandible" className="scroll-mt-4">
        <SectionHeader
          label={SECTION_LABELS.mandible}
          isOpen={openSections.mandible}
          onToggle={() => toggle("mandible")}
          badge={`${mandibleStats.present}/7 (${mandibleStats.pct}%)`}
        />
        {openSections.mandible && (
          <div className="border border-line rounded-b-lg p-4 bg-surface space-y-3">
            <ReferenceFigure section="mandible" />
            <p className="text-xs text-faint">
              Completitud sobre <strong>7 zonas-tipo</strong> (Knüsel &amp; Outram): una
              zona cuenta como presente si está de cualquier lado. Marcá el lado (izq/der)
              para registrar la lateralidad — se guarda como observación, no en el
              denominador.
            </p>
            <div className="flex justify-end">
              <BulkControls
                label={SECTION_LABELS.mandible}
                onAll={() => setMandibleZones(fillKeys(MANDIBLE_KEYS))}
                onClear={() => setMandibleZones({})}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="border border-line-strong px-2 py-1 text-left">Zona</th>
                    <th className="border border-line-strong px-2 py-1 text-center">Izq</th>
                    <th className="border border-line-strong px-2 py-1 text-center">Der</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(MANDIBLE_ZONES).map(([z, lbl]) => {
                    const kL = `mand_${z}_L`;
                    const kR = `mand_${z}_R`;
                    return (
                      <tr key={z} className="hover:bg-surface-2">
                        <td className="border border-line-strong px-2 py-1">
                          {z}-{lbl}
                        </td>
                        <CheckCell checked={!!mandibleZones[kL]} onChange={() => toggleMandible(kL)} />
                        <CheckCell checked={!!mandibleZones[kR]} onChange={() => toggleMandible(kR)} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <CompletionBadge present={mandibleStats.present} total={7} />
            {(() => {
              const obs = buildMandibulaLateralidadObs(mandibleZones);
              return obs ? (
                <p className="text-xs text-muted">
                  <span className="font-medium">Observación de lateralidad (derivada):</span>{" "}
                  {obs}
                </p>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* ====== 4. Vertebrae ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.vertebrae}
          isOpen={openSections.vertebrae}
          onToggle={() => toggle("vertebrae")}
          badge={`${vertebraeStats.present}/${vertebraeStats.total} (${vertebraeStats.pct}%)`}
        />
        {openSections.vertebrae && (
          <div className="border border-line rounded-b-lg p-4 bg-surface space-y-4">
            <ReferenceFigure section="vertebrae" />
            <ZoneLegend
              title="Zonas (todas las vértebras)"
              entries={Object.entries(VERTEBRA_ZONES_FULL).map(([z, label]) => ({
                z: `Z${z}`,
                label,
              }))}
            />
            <div className="flex justify-end">
              <BulkControls
                label={SECTION_LABELS.vertebrae}
                onAll={() => setVertebraeZones(fillKeys(VERTEBRAE_KEYS))}
                onClear={() => setVertebraeZones({})}
              />
            </div>
            <h4 className="text-sm font-semibold text-muted">Cervicales (C1-C7)</h4>
            {renderVertebraeBlock("C", 7)}
            <h4 className="text-sm font-semibold text-muted">Torácicas (T1-T12)</h4>
            {renderVertebraeBlock("T", 12)}
            <h4 className="text-sm font-semibold text-muted">Lumbares (L1-L5)</h4>
            {renderVertebraeBlock("L", 5)}
            <CompletionBadge present={vertebraeStats.present} total={vertebraeStats.total} />
          </div>
        )}
      </div>

      {/* ====== 5. Sacrum ====== */}
      <div id="sec-sacrum" className="scroll-mt-4">
        <SectionHeader
          label={SECTION_LABELS.sacrum}
          isOpen={openSections.sacrum}
          onToggle={() => toggle("sacrum")}
          badge={`${sacrumStats.present}/4 (${sacrumStats.pct}%)`}
        />
        {openSections.sacrum && (
          <div className="border border-line rounded-b-lg p-4 bg-surface space-y-3">
            <ReferenceFigure section="sacrum" />
            <p className="text-xs text-faint">
              4 zonas-tipo de Knüsel &amp; Outram (Fig. 2d). Reemplaza el esquema previo
              de 5 segmentos × 4 zonas.
            </p>
            <div className="flex justify-end">
              <BulkControls
                label={SECTION_LABELS.sacrum}
                onAll={() => setSacrumZones(fillKeys(SACRUM_KEYS))}
                onClear={() => setSacrumZones({})}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SACRUM_ZONES.map(({ key, label }, i) => (
                <label
                  key={key}
                  className="tap-label flex items-center gap-2 text-xs bg-surface-2 rounded px-2 py-1.5 hover:bg-surface-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!sacrumZones[key]}
                    onChange={() => toggleSacrum(key)}
                    className="tap-check"
                  />
                  <span>
                    {i + 1} - {label}
                  </span>
                </label>
              ))}
            </div>
            <CompletionBadge present={sacrumStats.present} total={4} />
          </div>
        )}
      </div>

      {/* ====== 6. Sternum ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.sternum}
          isOpen={openSections.sternum}
          onToggle={() => toggle("sternum")}
          badge={`${sternumStats.present}/3 (${sternumStats.pct}%)`}
        />
        {openSections.sternum && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="sternum" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.sternum}
                onAll={() => setSternumZones(fillKeys(STERNUM_KEYS))}
                onClear={() => setSternumZones({})}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(STERNUM_ZONES).map(([z, lbl]) => {
                const key = `stern_${z}`;
                return (
                  <label
                    key={z}
                    className="tap-label flex items-center gap-2 text-xs bg-surface-2 rounded px-3 py-2 hover:bg-surface-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!sternumZones[key]}
                      onChange={() => toggleSternum(key)}
                      className="tap-check"
                    />
                    <span>
                      {z}-{lbl}
                    </span>
                  </label>
                );
              })}
            </div>
            <CompletionBadge present={sternumStats.present} total={3} />
          </div>
        )}
      </div>

      {/* ====== 7. Clavicle ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.clavicle}
          isOpen={openSections.clavicle}
          onToggle={() => toggle("clavicle")}
          badge={`${clavicleStats.present}/6 (${clavicleStats.pct}%)`}
        />
        {openSections.clavicle && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="clavicle" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.clavicle}
                onAll={() => setClavicleZones(fillKeys(CLAVICLE_KEYS))}
                onClear={() => setClavicleZones({})}
              />
            </div>
            {renderBilateralZoneGrid(3, clavicleZones, toggleClavicle, "clav", CLAVICLE_ZONES)}
            <CompletionBadge present={clavicleStats.present} total={6} />
          </div>
        )}
      </div>

      {/* ====== 8. Ribs ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.ribs}
          isOpen={openSections.ribs}
          onToggle={() => toggle("ribs")}
          badge={`${ribStats.present}/72 (${ribStats.pct}%)`}
        />
        {openSections.ribs && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3 space-y-2">
              <ReferenceFigure section="ribs" />
              <ZoneLegend
                title="Zonas (todas las costillas)"
                entries={Object.entries(RIB_ZONES_FULL).map(([z, label]) => ({
                  z: `Z${z}`,
                  label,
                }))}
              />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.ribs}
                onAll={() => setRibZones(fillKeys(RIB_KEYS))}
                onClear={() => setRibZones({})}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="border border-line-strong px-2 py-1 text-left" rowSpan={2}>
                      Costilla
                    </th>
                    <th className="border border-line-strong px-2 py-1 text-center" colSpan={3}>
                      Izquierda
                    </th>
                    <th className="border border-line-strong px-2 py-1 text-center" colSpan={3}>
                      Derecha
                    </th>
                  </tr>
                  <tr className="bg-surface-2">
                    {["Cabeza", "Ángulo", "Cuerpo", "Cabeza", "Ángulo", "Cuerpo"].map(
                      (lbl, i) => (
                        <th
                          key={`${lbl}_${i}`}
                          className="border border-line-strong px-2 py-1 text-center"
                        >
                          {lbl}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {range(1, 12).map((rib) => (
                    <tr key={rib} className="hover:bg-surface-2">
                      <td className="border border-line-strong px-2 py-1 font-medium">
                        {rib}
                      </td>
                      {range(1, 3).map((z) => {
                        const key = `rib${rib}_z${z}_L`;
                        return (
                          <CheckCell key={`L${z}`} checked={!!ribZones[key]} onChange={() => toggleRib(key)} />
                        );
                      })}
                      {range(1, 3).map((z) => {
                        const key = `rib${rib}_z${z}_R`;
                        return (
                          <CheckCell key={`R${z}`} checked={!!ribZones[key]} onChange={() => toggleRib(key)} />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CompletionBadge present={ribStats.present} total={72} />
          </div>
        )}
      </div>

      {/* ====== 9. Scapula ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.scapula}
          isOpen={openSections.scapula}
          onToggle={() => toggle("scapula")}
          badge={`${scapulaStats.present}/18 (${scapulaStats.pct}%)`}
        />
        {openSections.scapula && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="scapula" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.scapula}
                onAll={() => setScapulaZones(fillKeys(SCAPULA_KEYS))}
                onClear={() => setScapulaZones({})}
              />
            </div>
            {renderBilateralZoneGrid(9, scapulaZones, toggleScapula, "scap", SCAPULA_ZONES)}
            <CompletionBadge present={scapulaStats.present} total={18} />
          </div>
        )}
      </div>

      {/* ====== 10. Humerus ====== */}
      <div id="sec-humerus" className="scroll-mt-4">
        <SectionHeader
          label={SECTION_LABELS.humerus}
          isOpen={openSections.humerus}
          onToggle={() => toggle("humerus")}
          badge={`${humerusStats.present}/22 (${humerusStats.pct}%)`}
        />
        {openSections.humerus && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="humerus" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.humerus}
                onAll={() => setHumerusZones(fillKeys(HUMERUS_KEYS))}
                onClear={() => setHumerusZones({})}
              />
            </div>
            {renderBilateralWithFusion(
              11,
              humerusZones,
              toggleHumerus,
              "hum",
              humerusFusion,
              setHumerusFusion,
              undefined,
              HUMERUS_ZONES
            )}
            <CompletionBadge present={humerusStats.present} total={22} />
          </div>
        )}
      </div>

      {/* ====== 11. Radius ====== */}
      <div id="sec-radius" className="scroll-mt-4">
        <SectionHeader
          label={SECTION_LABELS.radius}
          isOpen={openSections.radius}
          onToggle={() => toggle("radius")}
          badge={`${radiusStats.present}/22 (${radiusStats.pct}%)`}
        />
        {openSections.radius && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="radius" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.radius}
                onAll={() => setRadiusZones(fillKeys(RADIUS_KEYS))}
                onClear={() => setRadiusZones({})}
              />
            </div>
            {renderBilateralWithFusion(
              11,
              radiusZones,
              toggleRadius,
              "rad",
              radiusFusion,
              setRadiusFusion,
              [...range(1, 10), "J"],
              RADIUS_ZONES
            )}
            <CompletionBadge present={radiusStats.present} total={22} />
          </div>
        )}
      </div>

      {/* ====== 12. Ulna ====== */}
      <div id="sec-ulna" className="scroll-mt-4">
        <SectionHeader
          label={SECTION_LABELS.ulna}
          isOpen={openSections.ulna}
          onToggle={() => toggle("ulna")}
          badge={`${ulnaStats.present}/18 (${ulnaStats.pct}%)`}
        />
        {openSections.ulna && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="ulna" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.ulna}
                onAll={() => setUlnaZones(fillKeys(ULNA_KEYS))}
                onClear={() => setUlnaZones({})}
              />
            </div>
            {renderBilateralWithFusion(
              9,
              ulnaZones,
              toggleUlna,
              "uln",
              ulnaFusion,
              setUlnaFusion,
              ["A", "B", "C", "D", "E", "F", "G", "H", "J"],
              ULNA_ZONES
            )}
            <CompletionBadge present={ulnaStats.present} total={18} />
          </div>
        )}
      </div>

      {/* ====== 13. Os Coxae ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.osCoxae}
          isOpen={openSections.osCoxae}
          onToggle={() => toggle("osCoxae")}
          badge={`${osCoxaeStats.present}/24 (${osCoxaeStats.pct}%)`}
        />
        {openSections.osCoxae && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="osCoxae" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.osCoxae}
                onAll={() => setOsCoxaeZones(fillKeys(OS_COXAE_KEYS))}
                onClear={() => setOsCoxaeZones({})}
              />
            </div>
            {renderBilateralZoneGrid(12, osCoxaeZones, toggleOsCoxae, "cox", OS_COXAE_ZONES)}
            <CompletionBadge present={osCoxaeStats.present} total={24} />
          </div>
        )}
      </div>

      {/* ====== 14. Femur ====== */}
      <div id="sec-femur" className="scroll-mt-4">
        <SectionHeader
          label={SECTION_LABELS.femur}
          isOpen={openSections.femur}
          onToggle={() => toggle("femur")}
          badge={`${femurStats.present}/22 (${femurStats.pct}%)`}
        />
        {openSections.femur && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="femur" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.femur}
                onAll={() => setFemurZones(fillKeys(FEMUR_KEYS))}
                onClear={() => setFemurZones({})}
              />
            </div>
            {renderBilateralWithFusion(
              11,
              femurZones,
              toggleFemur,
              "fem",
              femurFusion,
              setFemurFusion,
              undefined,
              FEMUR_ZONES
            )}
            <CompletionBadge present={femurStats.present} total={22} />
          </div>
        )}
      </div>

      {/* ====== 15. Tibia ====== */}
      <div id="sec-tibia" className="scroll-mt-4">
        <SectionHeader
          label={SECTION_LABELS.tibia}
          isOpen={openSections.tibia}
          onToggle={() => toggle("tibia")}
          badge={`${tibiaStats.present}/20 (${tibiaStats.pct}%)`}
        />
        {openSections.tibia && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="tibia" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.tibia}
                onAll={() => setTibiaZones(fillKeys(TIBIA_KEYS))}
                onClear={() => setTibiaZones({})}
              />
            </div>
            {renderBilateralWithFusion(
              10,
              tibiaZones,
              toggleTibia,
              "tib",
              tibiaFusion,
              setTibiaFusion,
              undefined,
              TIBIA_ZONES
            )}
            <CompletionBadge present={tibiaStats.present} total={20} />
          </div>
        )}
      </div>

      {/* ====== 16. Fibula ====== */}
      <div id="sec-fibula" className="scroll-mt-4">
        <SectionHeader
          label={SECTION_LABELS.fibula}
          isOpen={openSections.fibula}
          onToggle={() => toggle("fibula")}
          badge={`${fibulaStats.present}/12 (${fibulaStats.pct}%)`}
        />
        {openSections.fibula && (
          <div className="border border-line rounded-b-lg p-4 bg-surface">
            <div className="mb-3">
              <ReferenceFigure section="fibula" />
            </div>
            <div className="flex justify-end mb-3">
              <BulkControls
                label={SECTION_LABELS.fibula}
                onAll={() => setFibulaZones(fillKeys(FIBULA_KEYS))}
                onClear={() => setFibulaZones({})}
              />
            </div>
            {renderBilateralWithFusion(
              6,
              fibulaZones,
              toggleFibula,
              "fib",
              fibulaFusion,
              setFibulaFusion,
              undefined,
              FIBULA_ZONES
            )}
            <CompletionBadge present={fibulaStats.present} total={12} />
          </div>
        )}
      </div>

      {/* ====== 16b. Patella (own element — K&O Z4 correction) ====== */}
      <div id="sec-patella" className="scroll-mt-4">
        <SectionHeader
          label={SECTION_LABELS.patella}
          isOpen={openSections.patella}
          onToggle={() => toggle("patella")}
          badge={`${patellaStats.present}/2 (${patellaStats.pct}%)`}
        />
        {openSections.patella && (
          <div className="border border-line rounded-b-lg p-4 bg-surface space-y-3">
            <p className="text-xs text-faint">
              La rótula es un elemento propio (sale de “Pie”). Presencia por lado.
            </p>
            <div className="flex justify-end">
              <BulkControls
                label={SECTION_LABELS.patella}
                onAll={() => setPatellaZones(fillKeys(PATELLA_KEYS))}
                onClear={() => setPatellaZones({})}
              />
            </div>
            <div className="flex gap-6">
              <label className="tap-label flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!patellaZones["pat_L"]}
                  onChange={() => togglePatella("pat_L")}
                  className="tap-check"
                />
                <span>Izquierda</span>
              </label>
              <label className="tap-label flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!patellaZones["pat_R"]}
                  onChange={() => togglePatella("pat_R")}
                  className="tap-check"
                />
                <span>Derecha</span>
              </label>
            </div>
            <CompletionBadge present={patellaStats.present} total={2} />
          </div>
        )}
      </div>

      {/* ====== 17. Hand ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.hand}
          isOpen={openSections.hand}
          onToggle={() => toggle("hand")}
        />
        {openSections.hand && (
          <div className="border border-line rounded-b-lg p-4 bg-surface space-y-4">
            <ReferenceFigure section="hand" />
            <ZoneLegend
              title="Zonas de metacarpos y falanges"
              entries={Object.entries(LONG_BONE_MCMT_ZONES).map(([z, label]) => ({
                z: `Z${z}`,
                label,
              }))}
            />
            <div className="flex justify-end">
              <BulkControls
                label={SECTION_LABELS.hand}
                onAll={() => setHandZones(fillKeys(HAND_KEYS))}
                onClear={() => setHandZones({})}
              />
            </div>
            {/* Metacarpals */}
            <h4 className="text-sm font-semibold text-muted">
              Metacarpos (MC1-MC5) - 3 zonas c/u
            </h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="border border-line-strong px-2 py-1 text-left" rowSpan={2}>
                      MC
                    </th>
                    <th className="border border-line-strong px-2 py-1 text-center" colSpan={3}>
                      Izquierda
                    </th>
                    <th className="border border-line-strong px-2 py-1 text-center" colSpan={3}>
                      Derecha
                    </th>
                  </tr>
                  <tr className="bg-surface-2">
                    {["Z1", "Z2", "Z3", "Z1", "Z2", "Z3"].map((lbl, i) => (
                      <th key={`${lbl}_${i}`} className="border border-line-strong px-2 py-1 text-center">
                        {lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {range(1, 5).map((mc) => (
                    <tr key={mc} className="hover:bg-surface-2">
                      <td className="border border-line-strong px-2 py-1 font-medium">MC{mc}</td>
                      {range(1, 3).map((z) => {
                        const key = `hMC${mc}_z${z}_L`;
                        return (
                          <CheckCell key={`L${z}`} checked={!!handZones[key]} onChange={() => toggleHand(key)} />
                        );
                      })}
                      {range(1, 3).map((z) => {
                        const key = `hMC${mc}_z${z}_R`;
                        return (
                          <CheckCell key={`R${z}`} checked={!!handZones[key]} onChange={() => toggleHand(key)} />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phalanges (per digit, I–V) */}
            <h4 className="text-sm font-semibold text-muted">
              Falanges por dedo (I–V) — 3 zonas c/u (Z1 base · Z2 cabeza · Z3 diáfisis)
            </h4>
            {renderPhalanges("hPh", handZones, toggleHand)}

            {/* Carpals */}
            <h4 className="text-sm font-semibold text-muted">Carpos - presencia L/R</h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="border border-line-strong px-2 py-1 text-left">Carpo</th>
                    <th className="border border-line-strong px-2 py-1 text-center">Izq</th>
                    <th className="border border-line-strong px-2 py-1 text-center">Der</th>
                  </tr>
                </thead>
                <tbody>
                  {HAND_CARPALS.map((c) => {
                    const kL = `hCarp_${c}_L`;
                    const kR = `hCarp_${c}_R`;
                    return (
                      <tr key={c} className="hover:bg-surface-2">
                        <td className="border border-line-strong px-2 py-1 font-medium whitespace-nowrap">
                          {c} — {HAND_CARPAL_NAMES[c]}
                        </td>
                        <CheckCell checked={!!handZones[kL]} onChange={() => toggleHand(kL)} />
                        <CheckCell checked={!!handZones[kR]} onChange={() => toggleHand(kR)} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ====== 18. Foot ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.foot}
          isOpen={openSections.foot}
          onToggle={() => toggle("foot")}
        />
        {openSections.foot && (
          <div className="border border-line rounded-b-lg p-4 bg-surface space-y-4">
            <ReferenceFigure section="foot" />
            <ZoneLegend
              title="Zonas de metatarsos y falanges"
              entries={Object.entries(LONG_BONE_MCMT_ZONES).map(([z, label]) => ({
                z: `Z${z}`,
                label,
              }))}
            />
            <div className="flex justify-end">
              <BulkControls
                label={SECTION_LABELS.foot}
                onAll={() => setFootZones(fillKeys(FOOT_KEYS))}
                onClear={() => setFootZones({})}
              />
            </div>
            {/* Metatarsals */}
            <h4 className="text-sm font-semibold text-muted">
              Metatarsos (MT1-MT5) - 3 zonas c/u
            </h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="border border-line-strong px-2 py-1 text-left" rowSpan={2}>MT</th>
                    <th className="border border-line-strong px-2 py-1 text-center" colSpan={3}>Izquierda</th>
                    <th className="border border-line-strong px-2 py-1 text-center" colSpan={3}>Derecha</th>
                  </tr>
                  <tr className="bg-surface-2">
                    {["Z1", "Z2", "Z3", "Z1", "Z2", "Z3"].map((lbl, i) => (
                      <th key={`${lbl}_${i}`} className="border border-line-strong px-2 py-1 text-center">{lbl}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {range(1, 5).map((mt) => (
                    <tr key={mt} className="hover:bg-surface-2">
                      <td className="border border-line-strong px-2 py-1 font-medium">MT{mt}</td>
                      {range(1, 3).map((z) => {
                        const key = `fMT${mt}_z${z}_L`;
                        return (
                          <CheckCell key={`L${z}`} checked={!!footZones[key]} onChange={() => toggleFoot(key)} />
                        );
                      })}
                      {range(1, 3).map((z) => {
                        const key = `fMT${mt}_z${z}_R`;
                        return (
                          <CheckCell key={`R${z}`} checked={!!footZones[key]} onChange={() => toggleFoot(key)} />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phalanges (per digit, I–V) */}
            <h4 className="text-sm font-semibold text-muted">
              Falanges por dedo (I–V) — 3 zonas c/u (Z1 base · Z2 cabeza · Z3 diáfisis)
            </h4>
            {renderPhalanges("fPh", footZones, toggleFoot)}

            {/* Calcaneus */}
            <h4 className="text-sm font-semibold text-muted">Calcáneo (5 zonas, L/R)</h4>
            {renderBilateralZoneGrid(5, footZones, toggleFoot, "fCalc", CALCANEUS_ZONES)}

            {/* Talus */}
            <h4 className="text-sm font-semibold text-muted">Astrágalo (4 zonas, L/R)</h4>
            {renderBilateralZoneGrid(4, footZones, toggleFoot, "fTalus", TALUS_ZONES)}

            {/* Tarsals */}
            <h4 className="text-sm font-semibold text-muted">Tarsos - presencia L/R</h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="border border-line-strong px-2 py-1 text-left">Tarso</th>
                    <th className="border border-line-strong px-2 py-1 text-center">Izq</th>
                    <th className="border border-line-strong px-2 py-1 text-center">Der</th>
                  </tr>
                </thead>
                <tbody>
                  {FOOT_TARSALS.map((t) => {
                    const kL = `fTars_${t}_L`;
                    const kR = `fTars_${t}_R`;
                    return (
                      <tr key={t} className="hover:bg-surface-2">
                        <td className="border border-line-strong px-2 py-1 font-medium whitespace-nowrap">
                          {t} — {FOOT_TARSAL_NAMES[t]}
                        </td>
                        <CheckCell checked={!!footZones[kL]} onChange={() => toggleFoot(kL)} />
                        <CheckCell checked={!!footZones[kR]} onChange={() => toggleFoot(kR)} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-faint">
              La rótula dejó de registrarse acá: es ahora un elemento propio (sección
              “Rótula”).
            </p>
          </div>
        )}
      </div>

      {/* ====== Save button ====== */}
      <div className="sticky bottom-0 bg-canvas border-t border-line py-4 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="btn btn-primary px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
        >
          {saving ? "Guardando..." : "Guardar ficha"}
        </button>
      </div>
    </div>
  );
}
