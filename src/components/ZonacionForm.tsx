"use client";

import { useState, useMemo, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ZonacionFormProps {
  initialData?: Record<string, any>;
  onSave: (data: {
    tipo: "zonacion";
    individuo: string;
    proyecto: string;
    registrador: string;
    fecha_registro: string;
    data: Record<string, any>;
  }) => Promise<void>;
  saving?: boolean;
}

interface FFIRow {
  id: number;
  element: string;
  laterality: string;
  outline: string;
  angle: string;
  texture: string;
  observation: string;
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
  "hand",
  "foot",
  "fragments",
  "ffi",
  "taphonomy",
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
  hand: "Mano",
  foot: "Pie",
  fragments: "Fragmentos no identificables",
  ffi: "Análisis de fractura (FFI)",
  taphonomy: "Alteraciones tafonómicas",
};

const CRANIUM_ZONES: Record<number, string> = {
  1: "Frontal der",
  2: "Frontal izq",
  3: "Parietal der",
  4: "Parietal izq",
  5: "Occipital",
  6: "Temporal izq",
  7: "Temporal der",
  8: "Esfenoides izq",
  9: "Esfenoides der",
  10: "Cigomático izq",
  11: "Cigomático der",
  12: "Maxilar izq",
  13: "Maxilar der",
  14: "Nasal izq",
  15: "Nasal der",
};

const MANDIBLE_ZONES: Record<number, string> = {
  1: "Cuerpo PM/M",
  2: "Cuerpo canino",
  3: "Rama ascendente",
  4: "Proc. coronoides",
  5: "Rama post./cóndilo",
  6: "Ángulo gonial",
  7: "Cuerpo anterior/incisivos",
};

const VERTEBRA_ZONES: Record<number, string> = {
  1: "Cuerpo",
  2: "Transv. der",
  3: "Transv. izq",
  4: "Espinosa",
};

const STERNUM_ZONES: Record<number, string> = {
  1: "Manubrio",
  2: "Cuerpo",
  3: "Xifoides",
};

const CLAVICLE_ZONES: Record<number, string> = {
  1: "Ext. esternal",
  2: "Ext. acromial",
  3: "Diáfisis",
};

const RIB_ZONES: Record<number, string> = {
  1: "Cabeza",
  2: "Ángulo",
  3: "Cuerpo",
};

const FRAGMENT_TYPES = [
  "Axial (esponjoso)",
  "Apendicular (cortical)",
  "Indeterminado",
];

const FRAGMENT_SIZES = [
  "0-20",
  "21-30",
  "31-40",
  "41-50",
  "51-60",
  "61-70",
  "71-80",
  "81-90",
  "91-100",
  "100+",
];

const TAPHONOMY_OPTIONS = [
  { key: "root_marks", label: "Marcas de raíces" },
  { key: "rodent_marks", label: "Marcas de roedores" },
  { key: "carnivore_marks", label: "Marcas de carnívoros" },
  { key: "weathering", label: "Meteorización" },
  { key: "manganese", label: "Tinción de manganeso" },
  { key: "iron_oxide", label: "Óxido de hierro" },
  { key: "cut_marks", label: "Marcas de corte" },
  { key: "fire", label: "Exposición al fuego" },
  { key: "abrasion", label: "Abrasión" },
  { key: "concretions", label: "Concreciones" },
  { key: "cortical_flaking", label: "Descamación cortical" },
  { key: "other", label: "Otro" },
];

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
      className="w-full flex items-center justify-between bg-gray-800 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition text-left"
    >
      <span className="font-semibold text-sm">{label}</span>
      <span className="flex items-center gap-3">
        {badge && (
          <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
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
    <div className="text-xs text-gray-500 mt-1">
      {present}/{total} zonas ({pct(present, total)}%)
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ZonacionForm({ initialData, onSave, saving }: ZonacionFormProps) {
  /* ---------- section toggle state ---------- */
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const k of SECTION_KEYS) init[k] = k === "context";
    return init as Record<SectionKey, boolean>;
  });

  const toggle = useCallback((key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /* ---------- context fields ---------- */
  const [individuo, setIndividuo] = useState(initialData?.individuo ?? "");
  const [proyecto, setProyecto] = useState(initialData?.proyecto ?? "");
  const [registrador, setRegistrador] = useState(initialData?.registrador ?? "");
  const [fechaRegistro, setFechaRegistro] = useState(initialData?.fecha_registro ?? "");
  const [sexoEstimado, setSexoEstimado] = useState(initialData?.sexo_estimado ?? "");
  const [edadEstimada, setEdadEstimada] = useState(initialData?.edad_estimada ?? "");
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

  /* ---------- hand ---------- */
  const [handZones, setHandZones] = useState<Record<string, boolean>>(
    () => initialData?.hand_zones ?? {}
  );

  /* ---------- foot ---------- */
  const [footZones, setFootZones] = useState<Record<string, boolean>>(
    () => initialData?.foot_zones ?? {}
  );

  /* ---------- fragments ---------- */
  const [fragments, setFragments] = useState<Record<string, number>>(
    () => initialData?.fragments ?? {}
  );

  /* ---------- FFI ---------- */
  const [ffiRows, setFFIRows] = useState<FFIRow[]>(
    () =>
      initialData?.ffi_rows ?? [
        { id: 1, element: "", laterality: "", outline: "", angle: "", texture: "", observation: "" },
      ]
  );

  /* ---------- taphonomy ---------- */
  const [taphonomy, setTaphonomy] = useState<Record<string, boolean>>(
    () => initialData?.taphonomy ?? {}
  );
  const [weatheringDegree, setWeatheringDegree] = useState(
    initialData?.weathering_degree ?? ""
  );
  const [taphonomyObs, setTaphonomyObs] = useState(initialData?.taphonomy_obs ?? "");

  /* ---------------------------------------------------------------- */
  /*  Completeness calculations                                       */
  /* ---------------------------------------------------------------- */

  const craniumStats = useMemo(() => {
    const n = countChecked(craniumZones);
    return { present: n, total: 15, pct: pct(n, 15) };
  }, [craniumZones]);

  const mandibleStats = useMemo(() => {
    const n = countChecked(mandibleZones);
    return { present: n, total: 14, pct: pct(n, 14) };
  }, [mandibleZones]);

  const vertebraeStats = useMemo(() => {
    const n = countChecked(vertebraeZones);
    const total = (7 + 12 + 5) * 4; // 96
    return { present: n, total, pct: pct(n, total) };
  }, [vertebraeZones]);

  const sacrumStats = useMemo(() => {
    const n = countChecked(sacrumZones);
    return { present: n, total: 20, pct: pct(n, 20) };
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
  const toggleHand = makeToggle(setHandZones);
  const toggleFoot = makeToggle(setFootZones);
  const toggleTaph = makeToggle(setTaphonomy);

  /* ---------------------------------------------------------------- */
  /*  Submit                                                           */
  /* ---------------------------------------------------------------- */

  const handleSubmit = useCallback(async () => {
    await onSave({
      tipo: "zonacion",
      individuo,
      proyecto,
      registrador,
      fecha_registro: fechaRegistro,
      data: {
        sexo_estimado: sexoEstimado,
        edad_estimada: edadEstimada,
        unidad_rasgo: unidadRasgo,
        nivel_capa: nivelCapa,
        cranium_zones: craniumZones,
        cranium_obs: craniumObs,
        mandible_zones: mandibleZones,
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
        hand_zones: handZones,
        foot_zones: footZones,
        fragments,
        ffi_rows: ffiRows,
        taphonomy,
        weathering_degree: weatheringDegree,
        taphonomy_obs: taphonomyObs,
      },
    });
  }, [
    onSave, individuo, proyecto, registrador, fechaRegistro,
    sexoEstimado, edadEstimada, unidadRasgo, nivelCapa,
    craniumZones, craniumObs, mandibleZones, vertebraeZones,
    sacrumZones, sternumZones, clavicleZones, ribZones,
    scapulaZones, humerusZones, humerusFusion, radiusZones,
    radiusFusion, ulnaZones, ulnaFusion, osCoxaeZones,
    femurZones, femurFusion, tibiaZones, tibiaFusion,
    fibulaZones, fibulaFusion, handZones, footZones,
    fragments, ffiRows, taphonomy, weatheringDegree, taphonomyObs,
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
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1 text-left">Zona</th>
              <th className="border border-gray-300 px-2 py-1 text-center">Izq</th>
              <th className="border border-gray-300 px-2 py-1 text-center">Der</th>
            </tr>
          </thead>
          <tbody>
            {zoneKeys.map((z) => {
              const kL = `${prefix}_${z}_L`;
              const kR = `${prefix}_${z}_R`;
              return (
                <tr key={String(z)} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-1">
                    {zoneLabels ? `${z} - ${zoneLabels[z]}` : `Z${z}`}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={!!state[kL]}
                      onChange={() => toggler(kL)}
                      className="accent-blue-600"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={!!state[kR]}
                      onChange={() => toggler(kR)}
                      className="accent-blue-600"
                    />
                  </td>
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
  ) {
    const zoneKeys = zones ?? range(1, zoneCount);
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1 text-left">Zona</th>
              <th className="border border-gray-300 px-2 py-1 text-center">Izq</th>
              <th className="border border-gray-300 px-2 py-1 text-center">Der</th>
              <th className="border border-gray-300 px-2 py-1 text-center">Fusión Izq</th>
              <th className="border border-gray-300 px-2 py-1 text-center">Fusión Der</th>
            </tr>
          </thead>
          <tbody>
            {zoneKeys.map((z) => {
              const kL = `${prefix}_${z}_L`;
              const kR = `${prefix}_${z}_R`;
              const fL = `${prefix}_${z}_fusL`;
              const fR = `${prefix}_${z}_fusR`;
              return (
                <tr key={String(z)} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-1">Z{z}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={!!state[kL]}
                      onChange={() => toggler(kL)}
                      className="accent-blue-600"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={!!state[kR]}
                      onChange={() => toggler(kR)}
                      className="accent-blue-600"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <select
                      value={fusionState[fL] ?? ""}
                      onChange={(e) =>
                        fusionSetter((p) => ({ ...p, [fL]: e.target.value }))
                      }
                      className="text-xs border border-gray-300 rounded px-1 py-0.5"
                    >
                      <option value="">--</option>
                      <option value="F">Fusionado</option>
                      <option value="PUF">PUF</option>
                      <option value="DUF">DUF</option>
                    </select>
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <select
                      value={fusionState[fR] ?? ""}
                      onChange={(e) =>
                        fusionSetter((p) => ({ ...p, [fR]: e.target.value }))
                      }
                      className="text-xs border border-gray-300 rounded px-1 py-0.5"
                    >
                      <option value="">--</option>
                      <option value="F">Fusionado</option>
                      <option value="PUF">PUF</option>
                      <option value="DUF">DUF</option>
                    </select>
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
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1 text-left">{prefix}</th>
              {Object.entries(VERTEBRA_ZONES).map(([z, lbl]) => (
                <th key={z} className="border border-gray-300 px-2 py-1 text-center">
                  {z}-{lbl}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {range(1, count).map((i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-2 py-1 font-medium">
                  {prefix}{i}
                </td>
                {range(1, 4).map((z) => {
                  const key = `${prefix}${i}_z${z}`;
                  return (
                    <td
                      key={z}
                      className="border border-gray-300 px-2 py-1 text-center"
                    >
                      <input
                        type="checkbox"
                        checked={!!vertebraeZones[key]}
                        onChange={() => toggleVertebrae(key)}
                        className="accent-blue-600"
                      />
                    </td>
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Individuo", value: individuo, setter: setIndividuo },
              { label: "Proyecto", value: proyecto, setter: setProyecto },
              { label: "Registrador", value: registrador, setter: setRegistrador },
              { label: "Fecha de registro", value: fechaRegistro, setter: setFechaRegistro },
              { label: "Sexo estimado", value: sexoEstimado, setter: setSexoEstimado },
              { label: "Edad estimada", value: edadEstimada, setter: setEdadEstimada },
              { label: "Unidad/rasgo", value: unidadRasgo, setter: setUnidadRasgo },
              { label: "Nivel/capa", value: nivelCapa, setter: setNivelCapa },
            ].map(({ label, value, setter }) => (
              <label key={label} className="block text-sm">
                <span className="font-medium text-gray-700">{label}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(CRANIUM_ZONES).map(([z, lbl]) => {
                const key = `cran_${z}`;
                return (
                  <label
                    key={z}
                    className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5 hover:bg-gray-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!craniumZones[key]}
                      onChange={() => toggleCranium(key)}
                      className="accent-blue-600"
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
              <span className="font-medium text-gray-700">Observaciones</span>
              <textarea
                value={craniumObs}
                onChange={(e) => setCraniumObs(e.target.value)}
                rows={2}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </label>
          </div>
        )}
      </div>

      {/* ====== 3. Mandible ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.mandible}
          isOpen={openSections.mandible}
          onToggle={() => toggle("mandible")}
          badge={`${mandibleStats.present}/14 (${mandibleStats.pct}%)`}
        />
        {openSections.mandible && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left">Zona</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Izq</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Der</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(MANDIBLE_ZONES).map(([z, lbl]) => {
                    const kL = `mand_${z}_L`;
                    const kR = `mand_${z}_R`;
                    return (
                      <tr key={z} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-1">
                          {z}-{lbl}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={!!mandibleZones[kL]}
                            onChange={() => toggleMandible(kL)}
                            className="accent-blue-600"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={!!mandibleZones[kR]}
                            onChange={() => toggleMandible(kR)}
                            className="accent-blue-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <CompletionBadge present={mandibleStats.present} total={14} />
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white space-y-4">
            <h4 className="text-sm font-semibold text-gray-700">Cervicales (C1-C7)</h4>
            {renderVertebraeBlock("C", 7)}
            <h4 className="text-sm font-semibold text-gray-700">Torácicas (T1-T12)</h4>
            {renderVertebraeBlock("T", 12)}
            <h4 className="text-sm font-semibold text-gray-700">Lumbares (L1-L5)</h4>
            {renderVertebraeBlock("L", 5)}
            <CompletionBadge present={vertebraeStats.present} total={vertebraeStats.total} />
          </div>
        )}
      </div>

      {/* ====== 5. Sacrum ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.sacrum}
          isOpen={openSections.sacrum}
          onToggle={() => toggle("sacrum")}
          badge={`${sacrumStats.present}/20 (${sacrumStats.pct}%)`}
        />
        {openSections.sacrum && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left">Segmento</th>
                    {Object.entries(VERTEBRA_ZONES).map(([z, lbl]) => (
                      <th key={z} className="border border-gray-300 px-2 py-1 text-center">
                        {z}-{lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {range(1, 5).map((i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 font-medium">S{i}</td>
                      {range(1, 4).map((z) => {
                        const key = `S${i}_z${z}`;
                        return (
                          <td
                            key={z}
                            className="border border-gray-300 px-2 py-1 text-center"
                          >
                            <input
                              type="checkbox"
                              checked={!!sacrumZones[key]}
                              onChange={() => toggleSacrum(key)}
                              className="accent-blue-600"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CompletionBadge present={sacrumStats.present} total={20} />
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            <div className="flex flex-wrap gap-3">
              {Object.entries(STERNUM_ZONES).map(([z, lbl]) => {
                const key = `stern_${z}`;
                return (
                  <label
                    key={z}
                    className="flex items-center gap-2 text-xs bg-gray-50 rounded px-3 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!sternumZones[key]}
                      onChange={() => toggleSternum(key)}
                      className="accent-blue-600"
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left" rowSpan={2}>
                      Costilla
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>
                      Izquierda
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>
                      Derecha
                    </th>
                  </tr>
                  <tr className="bg-gray-100">
                    {["Cabeza", "Ángulo", "Cuerpo", "Cabeza", "Ángulo", "Cuerpo"].map(
                      (lbl, i) => (
                        <th
                          key={`${lbl}_${i}`}
                          className="border border-gray-300 px-2 py-1 text-center"
                        >
                          {lbl}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {range(1, 12).map((rib) => (
                    <tr key={rib} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 font-medium">
                        {rib}
                      </td>
                      {range(1, 3).map((z) => {
                        const key = `rib${rib}_z${z}_L`;
                        return (
                          <td
                            key={`L${z}`}
                            className="border border-gray-300 px-2 py-1 text-center"
                          >
                            <input
                              type="checkbox"
                              checked={!!ribZones[key]}
                              onChange={() => toggleRib(key)}
                              className="accent-blue-600"
                            />
                          </td>
                        );
                      })}
                      {range(1, 3).map((z) => {
                        const key = `rib${rib}_z${z}_R`;
                        return (
                          <td
                            key={`R${z}`}
                            className="border border-gray-300 px-2 py-1 text-center"
                          >
                            <input
                              type="checkbox"
                              checked={!!ribZones[key]}
                              onChange={() => toggleRib(key)}
                              className="accent-blue-600"
                            />
                          </td>
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            {renderBilateralZoneGrid(9, scapulaZones, toggleScapula, "scap")}
            <CompletionBadge present={scapulaStats.present} total={18} />
          </div>
        )}
      </div>

      {/* ====== 10. Humerus ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.humerus}
          isOpen={openSections.humerus}
          onToggle={() => toggle("humerus")}
          badge={`${humerusStats.present}/22 (${humerusStats.pct}%)`}
        />
        {openSections.humerus && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            {renderBilateralWithFusion(
              11,
              humerusZones,
              toggleHumerus,
              "hum",
              humerusFusion,
              setHumerusFusion
            )}
            <CompletionBadge present={humerusStats.present} total={22} />
          </div>
        )}
      </div>

      {/* ====== 11. Radius ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.radius}
          isOpen={openSections.radius}
          onToggle={() => toggle("radius")}
          badge={`${radiusStats.present}/22 (${radiusStats.pct}%)`}
        />
        {openSections.radius && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            {renderBilateralWithFusion(
              11,
              radiusZones,
              toggleRadius,
              "rad",
              radiusFusion,
              setRadiusFusion,
              [...range(1, 10), "J"]
            )}
            <CompletionBadge present={radiusStats.present} total={22} />
          </div>
        )}
      </div>

      {/* ====== 12. Ulna ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.ulna}
          isOpen={openSections.ulna}
          onToggle={() => toggle("ulna")}
          badge={`${ulnaStats.present}/18 (${ulnaStats.pct}%)`}
        />
        {openSections.ulna && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            {renderBilateralWithFusion(
              9,
              ulnaZones,
              toggleUlna,
              "uln",
              ulnaFusion,
              setUlnaFusion,
              ["A", "B", "C", "D", "E", "F", "G", "H", "J"]
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            {renderBilateralZoneGrid(12, osCoxaeZones, toggleOsCoxae, "cox")}
            <CompletionBadge present={osCoxaeStats.present} total={24} />
          </div>
        )}
      </div>

      {/* ====== 14. Femur ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.femur}
          isOpen={openSections.femur}
          onToggle={() => toggle("femur")}
          badge={`${femurStats.present}/22 (${femurStats.pct}%)`}
        />
        {openSections.femur && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            {renderBilateralWithFusion(
              11,
              femurZones,
              toggleFemur,
              "fem",
              femurFusion,
              setFemurFusion
            )}
            <CompletionBadge present={femurStats.present} total={22} />
          </div>
        )}
      </div>

      {/* ====== 15. Tibia ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.tibia}
          isOpen={openSections.tibia}
          onToggle={() => toggle("tibia")}
          badge={`${tibiaStats.present}/20 (${tibiaStats.pct}%)`}
        />
        {openSections.tibia && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            {renderBilateralWithFusion(
              10,
              tibiaZones,
              toggleTibia,
              "tib",
              tibiaFusion,
              setTibiaFusion
            )}
            <CompletionBadge present={tibiaStats.present} total={20} />
          </div>
        )}
      </div>

      {/* ====== 16. Fibula ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.fibula}
          isOpen={openSections.fibula}
          onToggle={() => toggle("fibula")}
          badge={`${fibulaStats.present}/12 (${fibulaStats.pct}%)`}
        />
        {openSections.fibula && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            {renderBilateralWithFusion(
              6,
              fibulaZones,
              toggleFibula,
              "fib",
              fibulaFusion,
              setFibulaFusion
            )}
            <CompletionBadge present={fibulaStats.present} total={12} />
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white space-y-4">
            {/* Metacarpals */}
            <h4 className="text-sm font-semibold text-gray-700">
              Metacarpos (MC1-MC5) - 3 zonas c/u
            </h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left" rowSpan={2}>
                      MC
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>
                      Izquierda
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>
                      Derecha
                    </th>
                  </tr>
                  <tr className="bg-gray-100">
                    {["Z1", "Z2", "Z3", "Z1", "Z2", "Z3"].map((lbl, i) => (
                      <th key={`${lbl}_${i}`} className="border border-gray-300 px-2 py-1 text-center">
                        {lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {range(1, 5).map((mc) => (
                    <tr key={mc} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 font-medium">MC{mc}</td>
                      {range(1, 3).map((z) => {
                        const key = `hMC${mc}_z${z}_L`;
                        return (
                          <td key={`L${z}`} className="border border-gray-300 px-2 py-1 text-center">
                            <input type="checkbox" checked={!!handZones[key]} onChange={() => toggleHand(key)} className="accent-blue-600" />
                          </td>
                        );
                      })}
                      {range(1, 3).map((z) => {
                        const key = `hMC${mc}_z${z}_R`;
                        return (
                          <td key={`R${z}`} className="border border-gray-300 px-2 py-1 text-center">
                            <input type="checkbox" checked={!!handZones[key]} onChange={() => toggleHand(key)} className="accent-blue-600" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phalanges */}
            <h4 className="text-sm font-semibold text-gray-700">
              Falanges (prox/med/dist) - 3 zonas c/u
            </h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left" rowSpan={2}>
                      Falange
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>
                      Izquierda
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>
                      Derecha
                    </th>
                  </tr>
                  <tr className="bg-gray-100">
                    {["Z1", "Z2", "Z3", "Z1", "Z2", "Z3"].map((lbl, i) => (
                      <th key={`${lbl}_${i}`} className="border border-gray-300 px-2 py-1 text-center">
                        {lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(["Prox", "Med", "Dist"] as const).map((ph) => (
                    <tr key={ph} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 font-medium">{ph}</td>
                      {range(1, 3).map((z) => {
                        const key = `hPh${ph}_z${z}_L`;
                        return (
                          <td key={`L${z}`} className="border border-gray-300 px-2 py-1 text-center">
                            <input type="checkbox" checked={!!handZones[key]} onChange={() => toggleHand(key)} className="accent-blue-600" />
                          </td>
                        );
                      })}
                      {range(1, 3).map((z) => {
                        const key = `hPh${ph}_z${z}_R`;
                        return (
                          <td key={`R${z}`} className="border border-gray-300 px-2 py-1 text-center">
                            <input type="checkbox" checked={!!handZones[key]} onChange={() => toggleHand(key)} className="accent-blue-600" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Carpals */}
            <h4 className="text-sm font-semibold text-gray-700">Carpos - presencia L/R</h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left">Carpo</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Izq</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Der</th>
                  </tr>
                </thead>
                <tbody>
                  {HAND_CARPALS.map((c) => {
                    const kL = `hCarp_${c}_L`;
                    const kR = `hCarp_${c}_R`;
                    return (
                      <tr key={c} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-1 font-medium">{c}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          <input type="checkbox" checked={!!handZones[kL]} onChange={() => toggleHand(kL)} className="accent-blue-600" />
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          <input type="checkbox" checked={!!handZones[kR]} onChange={() => toggleHand(kR)} className="accent-blue-600" />
                        </td>
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
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white space-y-4">
            {/* Metatarsals */}
            <h4 className="text-sm font-semibold text-gray-700">
              Metatarsos (MT1-MT5) - 3 zonas c/u
            </h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left" rowSpan={2}>MT</th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>Izquierda</th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>Derecha</th>
                  </tr>
                  <tr className="bg-gray-100">
                    {["Z1", "Z2", "Z3", "Z1", "Z2", "Z3"].map((lbl, i) => (
                      <th key={`${lbl}_${i}`} className="border border-gray-300 px-2 py-1 text-center">{lbl}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {range(1, 5).map((mt) => (
                    <tr key={mt} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 font-medium">MT{mt}</td>
                      {range(1, 3).map((z) => {
                        const key = `fMT${mt}_z${z}_L`;
                        return (
                          <td key={`L${z}`} className="border border-gray-300 px-2 py-1 text-center">
                            <input type="checkbox" checked={!!footZones[key]} onChange={() => toggleFoot(key)} className="accent-blue-600" />
                          </td>
                        );
                      })}
                      {range(1, 3).map((z) => {
                        const key = `fMT${mt}_z${z}_R`;
                        return (
                          <td key={`R${z}`} className="border border-gray-300 px-2 py-1 text-center">
                            <input type="checkbox" checked={!!footZones[key]} onChange={() => toggleFoot(key)} className="accent-blue-600" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phalanges */}
            <h4 className="text-sm font-semibold text-gray-700">
              Falanges (prox/med/dist) - 3 zonas c/u
            </h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left" rowSpan={2}>Falange</th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>Izquierda</th>
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>Derecha</th>
                  </tr>
                  <tr className="bg-gray-100">
                    {["Z1", "Z2", "Z3", "Z1", "Z2", "Z3"].map((lbl, i) => (
                      <th key={`${lbl}_${i}`} className="border border-gray-300 px-2 py-1 text-center">{lbl}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(["Prox", "Med", "Dist"] as const).map((ph) => (
                    <tr key={ph} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 font-medium">{ph}</td>
                      {range(1, 3).map((z) => {
                        const key = `fPh${ph}_z${z}_L`;
                        return (
                          <td key={`L${z}`} className="border border-gray-300 px-2 py-1 text-center">
                            <input type="checkbox" checked={!!footZones[key]} onChange={() => toggleFoot(key)} className="accent-blue-600" />
                          </td>
                        );
                      })}
                      {range(1, 3).map((z) => {
                        const key = `fPh${ph}_z${z}_R`;
                        return (
                          <td key={`R${z}`} className="border border-gray-300 px-2 py-1 text-center">
                            <input type="checkbox" checked={!!footZones[key]} onChange={() => toggleFoot(key)} className="accent-blue-600" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calcaneus */}
            <h4 className="text-sm font-semibold text-gray-700">Calcáneo (5 zonas, L/R)</h4>
            {renderBilateralZoneGrid(5, footZones, toggleFoot, "fCalc")}

            {/* Talus */}
            <h4 className="text-sm font-semibold text-gray-700">Astrágalo (4 zonas, L/R)</h4>
            {renderBilateralZoneGrid(4, footZones, toggleFoot, "fTalus")}

            {/* Tarsals */}
            <h4 className="text-sm font-semibold text-gray-700">Tarsos - presencia L/R</h4>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left">Tarso</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Izq</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Der</th>
                  </tr>
                </thead>
                <tbody>
                  {FOOT_TARSALS.map((t) => {
                    const kL = `fTars_${t}_L`;
                    const kR = `fTars_${t}_R`;
                    return (
                      <tr key={t} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-1 font-medium">{t}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          <input type="checkbox" checked={!!footZones[kL]} onChange={() => toggleFoot(kL)} className="accent-blue-600" />
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          <input type="checkbox" checked={!!footZones[kR]} onChange={() => toggleFoot(kR)} className="accent-blue-600" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Patella */}
            <h4 className="text-sm font-semibold text-gray-700">Rótula - presencia L/R</h4>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!footZones["fPatella_L"]}
                  onChange={() => toggleFoot("fPatella_L")}
                  className="accent-blue-600"
                />
                <span>Izquierda</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!footZones["fPatella_R"]}
                  onChange={() => toggleFoot("fPatella_R")}
                  className="accent-blue-600"
                />
                <span>Derecha</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ====== 19. Unidentifiable Fragments ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.fragments}
          isOpen={openSections.fragments}
          onToggle={() => toggle("fragments")}
        />
        {openSections.fragments && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white">
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left">Tipo</th>
                    {FRAGMENT_SIZES.map((s) => (
                      <th key={s} className="border border-gray-300 px-2 py-1 text-center">
                        {s}mm
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FRAGMENT_TYPES.map((ft) => (
                    <tr key={ft} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 font-medium whitespace-nowrap">
                        {ft}
                      </td>
                      {FRAGMENT_SIZES.map((s) => {
                        const key = `frag_${ft}_${s}`;
                        return (
                          <td
                            key={s}
                            className="border border-gray-300 px-1 py-1 text-center"
                          >
                            <input
                              type="number"
                              min={0}
                              value={fragments[key] ?? ""}
                              onChange={(e) =>
                                setFragments((prev) => ({
                                  ...prev,
                                  [key]: e.target.value === "" ? 0 : parseInt(e.target.value, 10),
                                }))
                              }
                              className="w-12 border border-gray-300 rounded px-1 py-0.5 text-center text-xs"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ====== 20. FFI ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.ffi}
          isOpen={openSections.ffi}
          onToggle={() => toggle("ffi")}
        />
        {openSections.ffi && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white space-y-3">
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left">Elemento</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Lateralidad</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Contorno (0-2)</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Ángulo (0-2)</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Textura (0-2)</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">FFI Total</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">Observación</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ffiRows.map((row, idx) => {
                    const outline = row.outline === "" ? NaN : parseInt(row.outline, 10);
                    const angle = row.angle === "" ? NaN : parseInt(row.angle, 10);
                    const texture = row.texture === "" ? NaN : parseInt(row.texture, 10);
                    const total =
                      isNaN(outline) || isNaN(angle) || isNaN(texture)
                        ? ""
                        : outline + angle + texture;

                    const updateRow = (field: keyof FFIRow, value: string) => {
                      setFFIRows((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, [field]: value } : r
                        )
                      );
                    };

                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-1 py-1">
                          <input
                            type="text"
                            value={row.element}
                            onChange={(e) => updateRow("element", e.target.value)}
                            className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs"
                          />
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <select
                            value={row.laterality}
                            onChange={(e) => updateRow("laterality", e.target.value)}
                            className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                          >
                            <option value="">--</option>
                            <option value="L">Izq</option>
                            <option value="R">Der</option>
                            <option value="A">Axial</option>
                            <option value="NA">N/A</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <select
                            value={row.outline}
                            onChange={(e) => updateRow("outline", e.target.value)}
                            className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                          >
                            <option value="">--</option>
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <select
                            value={row.angle}
                            onChange={(e) => updateRow("angle", e.target.value)}
                            className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                          >
                            <option value="">--</option>
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <select
                            value={row.texture}
                            onChange={(e) => updateRow("texture", e.target.value)}
                            className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                          >
                            <option value="">--</option>
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center font-semibold">
                          {total}
                        </td>
                        <td className="border border-gray-300 px-1 py-1">
                          <input
                            type="text"
                            value={row.observation}
                            onChange={(e) => updateRow("observation", e.target.value)}
                            className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs"
                          />
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setFFIRows((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-red-500 hover:text-red-700 text-xs font-bold"
                            title="Eliminar fila"
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                setFFIRows((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    element: "",
                    laterality: "",
                    outline: "",
                    angle: "",
                    texture: "",
                    observation: "",
                  },
                ])
              }
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition"
            >
              + Agregar fila
            </button>
          </div>
        )}
      </div>

      {/* ====== 21. Taphonomic Alterations ====== */}
      <div>
        <SectionHeader
          label={SECTION_LABELS.taphonomy}
          isOpen={openSections.taphonomy}
          onToggle={() => toggle("taphonomy")}
        />
        {openSections.taphonomy && (
          <div className="border border-gray-200 rounded-b-lg p-4 bg-white space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {TAPHONOMY_OPTIONS.map(({ key, label }) => (
                <div key={key}>
                  <label className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5 hover:bg-gray-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!taphonomy[key]}
                      onChange={() => toggleTaph(key)}
                      className="accent-blue-600"
                    />
                    <span>{label}</span>
                  </label>
                  {key === "weathering" && taphonomy[key] && (
                    <input
                      type="text"
                      placeholder="Grado (0-5)"
                      value={weatheringDegree}
                      onChange={(e) => setWeatheringDegree(e.target.value)}
                      className="mt-1 ml-6 border border-gray-300 rounded px-2 py-1 text-xs w-24"
                    />
                  )}
                </div>
              ))}
            </div>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Observaciones</span>
              <textarea
                value={taphonomyObs}
                onChange={(e) => setTaphonomyObs(e.target.value)}
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </label>
          </div>
        )}
      </div>

      {/* ====== Save button ====== */}
      <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 py-4 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-semibold"
        >
          {saving ? "Guardando..." : "Guardar ficha"}
        </button>
      </div>
    </div>
  );
}
