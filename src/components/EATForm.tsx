"use client";

import { useState, useMemo, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Constants & bone definitions                                       */
/* ------------------------------------------------------------------ */

const CRANEO_BONES = [
  "Frontal",
  "Parietal der",
  "Parietal izq",
  "Occipital",
  "Temporal der",
  "Temporal izq",
  "Esfenoides",
  "Etmoides",
  "Malar der",
  "Malar izq",
  "Maxilar der",
  "Maxilar izq",
  "Nasal der",
  "Nasal izq",
  "Lacrimal der",
  "Lacrimal izq",
  "Palatino der",
  "Palatino izq",
] as const;

const VERTEBRAS_CERVICALES = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"] as const;
const VERTEBRAS_TORACICAS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"] as const;
const VERTEBRAS_LUMBARES = ["L1", "L2", "L3", "L4", "L5"] as const;
const VERTEBRAS_SACRAS = ["S1", "S2", "S3", "S4", "S5"] as const;
const VERTEBRAS_COCCIGEAS = ["Co1", "Co2", "Co3"] as const;
const ALL_VERTEBRAS = [
  ...VERTEBRAS_CERVICALES,
  ...VERTEBRAS_TORACICAS,
  ...VERTEBRAS_LUMBARES,
  ...VERTEBRAS_SACRAS,
  ...VERTEBRAS_COCCIGEAS,
] as const;

const HUESOS_LARGOS_NAMES = [
  "Clavícula",
  "Húmero",
  "Radio",
  "Cúbito",
  "Fémur",
  "Tibia",
  "Peroné",
] as const;

const HUESOS_PLANOS = [
  "Escápula der",
  "Escápula izq",
  "Coxal der",
  "Coxal izq",
  "Rótula der",
  "Rótula izq",
  "Esternón",
] as const;

const COSTILLAS_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const MANO_UNITS = [
  { key: "carpianos", label: "Carpianos", max: 8 },
  { key: "metacarpianos", label: "Metacarpianos", max: 5 },
  { key: "falProxMedias", label: "Fal. prox + medias", max: 9 },
  { key: "falDistales", label: "Fal. distales", max: 5 },
] as const;
const MANO_TOTAL_BONES = 27;
const MANO_MAX_PTS = 4;

const PIE_UNITS = [
  { key: "tarsianos", label: "Tarsianos", max: 7 },
  { key: "metatarsianos", label: "Metatarsianos", max: 5 },
  { key: "falProx", label: "Fal. prox", max: 5 },
  { key: "falMedias", label: "Fal. medias", max: 4 },
  { key: "falDistales", label: "Fal. distales", max: 5 },
] as const;
const PIE_TOTAL_BONES = 26;
const PIE_MAX_PTS = 5;

/* Quality groups (ICH) - mapped to the inventory groups */
const QUALITY_GROUPS = [
  { key: "craneo", label: "Cráneo" },
  { key: "vertebras", label: "Vértebras" },
  { key: "huesosLargos", label: "Huesos Largos" },
  { key: "huesosPlanos", label: "Huesos Planos" },
  { key: "costillas", label: "Costillas" },
  { key: "mandibula", label: "Mandíbula" },
  { key: "hioides", label: "Hioides" },
  { key: "manos", label: "Manos" },
  { key: "pies", label: "Pies" },
] as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EATFormProps {
  initialData?: Record<string, any>;
  onSave: (data: {
    tipo: "eat";
    individuo: string;
    proyecto: string;
    registrador: string;
    fecha_registro: string;
    data: Record<string, any>;
  }) => Promise<void>;
  saving?: boolean;
}

interface ManoData {
  carpianos: number;
  metacarpianos: number;
  falProxMedias: number;
  falDistales: number;
}

interface PieData {
  tarsianos: number;
  metatarsianos: number;
  falProx: number;
  falMedias: number;
  falDistales: number;
}

interface QualityEntry {
  value: number;
  obs: string;
}

/* ------------------------------------------------------------------ */
/*  Helper: collapsible section                                        */
/* ------------------------------------------------------------------ */

function Section({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 hover:bg-gray-200 transition text-left"
      >
        <div>
          <span className="font-semibold text-gray-800">{title}</span>
          {subtitle && (
            <span className="ml-2 text-sm text-gray-500">{subtitle}</span>
          )}
        </div>
        <span className="text-gray-500 text-lg select-none">
          {open ? "\u25B2" : "\u25BC"}
        </span>
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Checkbox grid helper                                               */
/* ------------------------------------------------------------------ */

function CheckboxGrid({
  items,
  checked,
  onChange,
  columns = 4,
}: {
  items: readonly string[];
  checked: Record<string, boolean>;
  onChange: (key: string, val: boolean) => void;
  columns?: number;
}) {
  const gridCols =
    columns === 6
      ? "grid-cols-3 sm:grid-cols-6"
      : columns === 4
        ? "grid-cols-2 sm:grid-cols-4"
        : columns === 3
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className={`grid ${gridCols} gap-1`}>
      {items.map((item) => (
        <label
          key={item}
          className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
        >
          <input
            type="checkbox"
            checked={!!checked[item]}
            onChange={(e) => onChange(item, e.target.checked)}
            className="accent-blue-600 w-4 h-4"
          />
          <span className="truncate">{item}</span>
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function EATForm({ initialData, onSave, saving }: EATFormProps) {
  /* ---------- Context ---------- */
  const [individuo, setIndividuo] = useState(initialData?.individuo ?? "");
  const [proyecto, setProyecto] = useState(initialData?.proyecto ?? "");
  const [registrador, setRegistrador] = useState(initialData?.registrador ?? "");
  const [fechaRegistro, setFechaRegistro] = useState(initialData?.fecha_registro ?? "");
  const [sexoEstimado, setSexoEstimado] = useState(initialData?.data?.sexo_estimado ?? "");
  const [edadEstimada, setEdadEstimada] = useState(initialData?.data?.edad_estimada ?? "");

  /* ---------- Bone Inventory (IPO) ---------- */
  const [craneoChecked, setCraneoChecked] = useState<Record<string, boolean>>(
    initialData?.data?.craneo ?? {}
  );
  const [vertebrasChecked, setVertebrasChecked] = useState<Record<string, boolean>>(
    initialData?.data?.vertebras ?? {}
  );
  const [largosChecked, setLargosChecked] = useState<Record<string, boolean>>(
    initialData?.data?.huesosLargos ?? {}
  );
  const [planosChecked, setPlanosChecked] = useState<Record<string, boolean>>(
    initialData?.data?.huesosPlanos ?? {}
  );
  const [costillasChecked, setCostillasChecked] = useState<Record<string, boolean>>(
    initialData?.data?.costillas ?? {}
  );
  const [mandibula, setMandibula] = useState<boolean>(
    initialData?.data?.mandibula ?? false
  );
  const [hioides, setHioides] = useState<boolean>(
    initialData?.data?.hioides ?? false
  );

  const emptyMano: ManoData = { carpianos: 0, metacarpianos: 0, falProxMedias: 0, falDistales: 0 };
  const [manoDer, setManoDer] = useState<ManoData>(initialData?.data?.manoDer ?? { ...emptyMano });
  const [manoIzq, setManoIzq] = useState<ManoData>(initialData?.data?.manoIzq ?? { ...emptyMano });

  const emptyPie: PieData = { tarsianos: 0, metatarsianos: 0, falProx: 0, falMedias: 0, falDistales: 0 };
  const [pieDer, setPieDer] = useState<PieData>(initialData?.data?.pieDer ?? { ...emptyPie });
  const [pieIzq, setPieIzq] = useState<PieData>(initialData?.data?.pieIzq ?? { ...emptyPie });

  /* ---------- Bone Quality (ICH) ---------- */
  const emptyQuality: Record<string, QualityEntry> = Object.fromEntries(
    QUALITY_GROUPS.map((g) => [g.key, { value: 0, obs: "" }])
  );
  const [quality, setQuality] = useState<Record<string, QualityEntry>>(
    initialData?.data?.quality ?? emptyQuality
  );

  /* ---------- Observations ---------- */
  const [observations, setObservations] = useState(initialData?.data?.observations ?? "");

  /* ================================================================ */
  /*  Derived / computed values                                        */
  /* ================================================================ */

  const countChecked = (obj: Record<string, boolean>) =>
    Object.values(obj).filter(Boolean).length;

  /* Huesos largos: generate keys "Clavícula der", "Clavícula izq", etc. */
  const largosAllKeys = useMemo(
    () => HUESOS_LARGOS_NAMES.flatMap((n) => [`${n} der`, `${n} izq`]),
    []
  );

  /* Costillas keys */
  const costillasAllKeys = useMemo(
    () =>
      COSTILLAS_NUMBERS.flatMap((n) => [
        `Costilla ${n} der`,
        `Costilla ${n} izq`,
      ]),
    []
  );

  /* Mano weighted points */
  const manoDerTotal = useMemo(
    () => manoDer.carpianos + manoDer.metacarpianos + manoDer.falProxMedias + manoDer.falDistales,
    [manoDer]
  );
  const manoIzqTotal = useMemo(
    () => manoIzq.carpianos + manoIzq.metacarpianos + manoIzq.falProxMedias + manoIzq.falDistales,
    [manoIzq]
  );
  const manoDerPts = useMemo(
    () => (manoDerTotal / MANO_TOTAL_BONES) * MANO_MAX_PTS,
    [manoDerTotal]
  );
  const manoIzqPts = useMemo(
    () => (manoIzqTotal / MANO_TOTAL_BONES) * MANO_MAX_PTS,
    [manoIzqTotal]
  );

  /* Pie weighted points */
  const pieDerTotal = useMemo(
    () => pieDer.tarsianos + pieDer.metatarsianos + pieDer.falProx + pieDer.falMedias + pieDer.falDistales,
    [pieDer]
  );
  const pieIzqTotal = useMemo(
    () => pieIzq.tarsianos + pieIzq.metatarsianos + pieIzq.falProx + pieIzq.falMedias + pieIzq.falDistales,
    [pieIzq]
  );
  const pieDerPts = useMemo(
    () => (pieDerTotal / PIE_TOTAL_BONES) * PIE_MAX_PTS,
    [pieDerTotal]
  );
  const pieIzqPts = useMemo(
    () => (pieIzqTotal / PIE_TOTAL_BONES) * PIE_MAX_PTS,
    [pieIzqTotal]
  );

  /* Group present counts (for quality gating) */
  const groupCounts = useMemo(
    () => ({
      craneo: countChecked(craneoChecked),
      vertebras: countChecked(vertebrasChecked),
      huesosLargos: countChecked(largosChecked),
      huesosPlanos: countChecked(planosChecked),
      costillas: countChecked(costillasChecked),
      mandibula: mandibula ? 1 : 0,
      hioides: hioides ? 1 : 0,
      manos: manoDerTotal + manoIzqTotal,
      pies: pieDerTotal + pieIzqTotal,
    }),
    [craneoChecked, vertebrasChecked, largosChecked, planosChecked, costillasChecked, mandibula, hioides, manoDerTotal, manoIzqTotal, pieDerTotal, pieIzqTotal]
  );

  /* Total present bones (simple checkboxes count as 1 each; manos/pies use weighted pts) */
  const totalPresent = useMemo(() => {
    const simple =
      groupCounts.craneo +
      groupCounts.vertebras +
      groupCounts.huesosLargos +
      groupCounts.huesosPlanos +
      groupCounts.costillas +
      groupCounts.mandibula +
      groupCounts.hioides;
    const weighted = manoDerPts + manoIzqPts + pieDerPts + pieIzqPts;
    return simple + weighted;
  }, [groupCounts, manoDerPts, manoIzqPts, pieDerPts, pieIzqPts]);

  /* Max possible = 18 + 32 + 14 + 7 + 24 + 1 + 1 + 8 + 10 = 115 */
  const IPO = useMemo(() => (totalPresent / 115) * 100, [totalPresent]);

  /* ICH = average quality of groups that have bones */
  const ICH = useMemo(() => {
    const filled = QUALITY_GROUPS.filter(
      (g) => groupCounts[g.key as keyof typeof groupCounts] > 0
    );
    if (filled.length === 0) return 0;
    const sum = filled.reduce((acc, g) => acc + (quality[g.key]?.value ?? 0), 0);
    return sum / filled.length;
  }, [quality, groupCounts]);

  /* EAT = 100 - (IPO + ICH) / 2 */
  const EAT = useMemo(() => 100 - (IPO + ICH) / 2, [IPO, ICH]);

  const eatColor = useMemo(() => {
    if (EAT <= 20) return "bg-green-500";
    if (EAT <= 40) return "bg-lime-500";
    if (EAT <= 60) return "bg-yellow-500";
    if (EAT <= 80) return "bg-orange-500";
    return "bg-red-600";
  }, [EAT]);

  const eatLabel = useMemo(() => {
    if (EAT <= 20) return "Muy buen estado";
    if (EAT <= 40) return "Buen estado";
    if (EAT <= 60) return "Estado moderado";
    if (EAT <= 80) return "Mal estado";
    return "Muy mal estado";
  }, [EAT]);

  /* ================================================================ */
  /*  Handlers                                                         */
  /* ================================================================ */

  const updateQuality = useCallback(
    (key: string, field: "value" | "obs", val: number | string) => {
      setQuality((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: val },
      }));
    },
    []
  );

  const updateMano = useCallback(
    (side: "der" | "izq", field: keyof ManoData, val: number) => {
      const setter = side === "der" ? setManoDer : setManoIzq;
      setter((prev) => ({ ...prev, [field]: val }));
    },
    []
  );

  const updatePie = useCallback(
    (side: "der" | "izq", field: keyof PieData, val: number) => {
      const setter = side === "der" ? setPieDer : setPieIzq;
      setter((prev) => ({ ...prev, [field]: val }));
    },
    []
  );

  /* ---- Submit ---- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      tipo: "eat",
      individuo,
      proyecto,
      registrador,
      fecha_registro: fechaRegistro,
      data: {
        sexo_estimado: sexoEstimado,
        edad_estimada: edadEstimada,
        craneo: craneoChecked,
        vertebras: vertebrasChecked,
        huesosLargos: largosChecked,
        huesosPlanos: planosChecked,
        costillas: costillasChecked,
        mandibula,
        hioides,
        manoDer,
        manoIzq,
        pieDer,
        pieIzq,
        quality,
        observations,
        /* Computed results stored for later reference */
        _computed: {
          totalPresent: +totalPresent.toFixed(2),
          IPO: +IPO.toFixed(2),
          ICH: +ICH.toFixed(2),
          EAT: +EAT.toFixed(2),
        },
      },
    });
  };

  /* ================================================================ */
  /*  Render helpers                                                   */
  /* ================================================================ */

  const textInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { type?: string; placeholder?: string }
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={opts?.type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  /* Mano / Pie number input table */
  const renderExtremityTable = (
    label: string,
    units: readonly { key: string; label: string; max: number }[],
    derData: Record<string, number>,
    izqData: Record<string, number>,
    derTotal: number,
    izqTotal: number,
    derPts: number,
    izqPts: number,
    totalBones: number,
    maxPts: number,
    onUpdate: (side: "der" | "izq", field: string, val: number) => void
  ) => (
    <div>
      <h4 className="font-medium text-gray-700 mb-2">{label}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-2 py-1 border-b">Unidad</th>
              <th className="text-center px-2 py-1 border-b">Max</th>
              <th className="text-center px-2 py-1 border-b">Derecho</th>
              <th className="text-center px-2 py-1 border-b">Izquierdo</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.key} className="border-b border-gray-100">
                <td className="px-2 py-1">{u.label}</td>
                <td className="text-center px-2 py-1 text-gray-400">/{u.max}</td>
                <td className="text-center px-2 py-1">
                  <input
                    type="number"
                    min={0}
                    max={u.max}
                    value={derData[u.key] ?? 0}
                    onChange={(e) =>
                      onUpdate("der", u.key, Math.min(u.max, Math.max(0, +e.target.value || 0)))
                    }
                    className="w-14 border border-gray-300 rounded text-center py-0.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </td>
                <td className="text-center px-2 py-1">
                  <input
                    type="number"
                    min={0}
                    max={u.max}
                    value={izqData[u.key] ?? 0}
                    onChange={(e) =>
                      onUpdate("izq", u.key, Math.min(u.max, Math.max(0, +e.target.value || 0)))
                    }
                    className="w-14 border border-gray-300 rounded text-center py-0.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-medium">
            <tr>
              <td className="px-2 py-1">Total huesos</td>
              <td className="text-center px-2 py-1">/{totalBones}</td>
              <td className="text-center px-2 py-1">{derTotal}</td>
              <td className="text-center px-2 py-1">{izqTotal}</td>
            </tr>
            <tr>
              <td className="px-2 py-1">Puntos ponderados</td>
              <td className="text-center px-2 py-1">/{maxPts}</td>
              <td className="text-center px-2 py-1">{derPts.toFixed(2)}</td>
              <td className="text-center px-2 py-1">{izqPts.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  /* ================================================================ */
  /*  JSX                                                              */
  /* ================================================================ */

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl mx-auto pb-12">
      <h2 className="text-2xl font-bold text-gray-900">
        EAT &mdash; Estado de Afectaci&oacute;n Tafon&oacute;mica
      </h2>
      <p className="text-sm text-gray-500">Serrulla &amp; V&aacute;zquez (2019)</p>

      {/* ============================================================ */}
      {/*  1. Context Data                                              */}
      {/* ============================================================ */}
      <Section title="1. Datos de Contexto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {textInput("Individuo", individuo, setIndividuo, { placeholder: "Ej: IND-001" })}
          {textInput("Proyecto", proyecto, setProyecto)}
          {textInput("Registrador", registrador, setRegistrador)}
          {textInput("Fecha de registro", fechaRegistro, setFechaRegistro, { type: "date" })}
          {textInput("Sexo estimado", sexoEstimado, setSexoEstimado, { placeholder: "M / F / Indet." })}
          {textInput("Edad estimada", edadEstimada, setEdadEstimada, { placeholder: "Ej: 30-40 a." })}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  2. Bone Inventory (IPO)                                      */}
      {/* ============================================================ */}
      <Section
        title="2. Inventario \u00D3seo (IPO)"
        subtitle={`${totalPresent.toFixed(1)} / 115 \u2014 IPO = ${IPO.toFixed(1)}%`}
      >
        {/* Cráneo */}
        <Section title="Cr\u00E1neo" subtitle={`${countChecked(craneoChecked)} / 18`} defaultOpen={false}>
          <CheckboxGrid
            items={CRANEO_BONES}
            checked={craneoChecked}
            onChange={(k, v) => setCraneoChecked((p) => ({ ...p, [k]: v }))}
            columns={3}
          />
        </Section>

        {/* Vértebras */}
        <Section title="V\u00E9rtebras" subtitle={`${countChecked(vertebrasChecked)} / 32`} defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Cervicales (C1-C7)</p>
              <CheckboxGrid
                items={VERTEBRAS_CERVICALES}
                checked={vertebrasChecked}
                onChange={(k, v) => setVertebrasChecked((p) => ({ ...p, [k]: v }))}
                columns={4}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Tor&aacute;cicas (T1-T12)</p>
              <CheckboxGrid
                items={VERTEBRAS_TORACICAS}
                checked={vertebrasChecked}
                onChange={(k, v) => setVertebrasChecked((p) => ({ ...p, [k]: v }))}
                columns={6}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Lumbares (L1-L5)</p>
              <CheckboxGrid
                items={VERTEBRAS_LUMBARES}
                checked={vertebrasChecked}
                onChange={(k, v) => setVertebrasChecked((p) => ({ ...p, [k]: v }))}
                columns={4}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Sacras (S1-S5)</p>
              <CheckboxGrid
                items={VERTEBRAS_SACRAS}
                checked={vertebrasChecked}
                onChange={(k, v) => setVertebrasChecked((p) => ({ ...p, [k]: v }))}
                columns={4}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Cocc&iacute;geas (Co1-Co3)</p>
              <CheckboxGrid
                items={VERTEBRAS_COCCIGEAS}
                checked={vertebrasChecked}
                onChange={(k, v) => setVertebrasChecked((p) => ({ ...p, [k]: v }))}
                columns={3}
              />
            </div>
          </div>
        </Section>

        {/* Huesos Largos */}
        <Section title="Huesos Largos" subtitle={`${countChecked(largosChecked)} / 14`} defaultOpen={false}>
          <CheckboxGrid
            items={largosAllKeys}
            checked={largosChecked}
            onChange={(k, v) => setLargosChecked((p) => ({ ...p, [k]: v }))}
            columns={4}
          />
        </Section>

        {/* Huesos Planos */}
        <Section title="Huesos Planos" subtitle={`${countChecked(planosChecked)} / 7`} defaultOpen={false}>
          <CheckboxGrid
            items={HUESOS_PLANOS}
            checked={planosChecked}
            onChange={(k, v) => setPlanosChecked((p) => ({ ...p, [k]: v }))}
            columns={4}
          />
        </Section>

        {/* Costillas */}
        <Section title="Costillas" subtitle={`${countChecked(costillasChecked)} / 24`} defaultOpen={false}>
          <CheckboxGrid
            items={costillasAllKeys}
            checked={costillasChecked}
            onChange={(k, v) => setCostillasChecked((p) => ({ ...p, [k]: v }))}
            columns={4}
          />
        </Section>

        {/* Mandíbula & Hioides */}
        <div className="flex gap-6 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={mandibula}
              onChange={(e) => setMandibula(e.target.checked)}
              className="accent-blue-600 w-4 h-4"
            />
            <span className="font-medium">Mand&iacute;bula</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={hioides}
              onChange={(e) => setHioides(e.target.checked)}
              className="accent-blue-600 w-4 h-4"
            />
            <span className="font-medium">Hioides</span>
          </label>
        </div>

        {/* Manos */}
        <Section
          title="Manos"
          subtitle={`D: ${manoDerPts.toFixed(2)} + I: ${manoIzqPts.toFixed(2)} = ${(manoDerPts + manoIzqPts).toFixed(2)} / 8 pts`}
          defaultOpen={false}
        >
          {renderExtremityTable(
            "Manos (ponderaci\u00F3n: max 4 pts por mano)",
            MANO_UNITS,
            manoDer as unknown as Record<string, number>,
            manoIzq as unknown as Record<string, number>,
            manoDerTotal,
            manoIzqTotal,
            manoDerPts,
            manoIzqPts,
            MANO_TOTAL_BONES,
            MANO_MAX_PTS,
            updateMano as (side: "der" | "izq", field: string, val: number) => void
          )}
        </Section>

        {/* Pies */}
        <Section
          title="Pies"
          subtitle={`D: ${pieDerPts.toFixed(2)} + I: ${pieIzqPts.toFixed(2)} = ${(pieDerPts + pieIzqPts).toFixed(2)} / 10 pts`}
          defaultOpen={false}
        >
          {renderExtremityTable(
            "Pies (ponderaci\u00F3n: max 5 pts por pie)",
            PIE_UNITS,
            pieDer as unknown as Record<string, number>,
            pieIzq as unknown as Record<string, number>,
            pieDerTotal,
            pieIzqTotal,
            pieDerPts,
            pieIzqPts,
            PIE_TOTAL_BONES,
            PIE_MAX_PTS,
            updatePie as (side: "der" | "izq", field: string, val: number) => void
          )}
        </Section>

        {/* IPO summary bar */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold text-blue-800">\u00CDndice de Preservaci\u00F3n \u00D3sea (IPO)</span>
            <span className="text-lg font-bold text-blue-700">{IPO.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, IPO)}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 mt-1">
            {totalPresent.toFixed(1)} presentes de 115 posibles
          </p>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  3. Bone Quality (ICH)                                        */}
      {/* ============================================================ */}
      <Section
        title="3. Calidad del Hueso (ICH)"
        subtitle={`ICH = ${ICH.toFixed(1)}%`}
      >
        <p className="text-sm text-gray-500 mb-3">
          Para cada grupo que tenga huesos presentes, indique la calidad del hueso con el slider (0-100%) y, opcionalmente, una observaci&oacute;n.
        </p>
        <div className="space-y-4">
          {QUALITY_GROUPS.map((g) => {
            const hasPresence = groupCounts[g.key as keyof typeof groupCounts] > 0;
            return (
              <div
                key={g.key}
                className={`border rounded-lg p-3 transition ${hasPresence ? "border-gray-300 bg-white" : "border-gray-100 bg-gray-50 opacity-50"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{g.label}</span>
                  {hasPresence ? (
                    <span className="text-sm font-bold text-gray-800">
                      {quality[g.key]?.value ?? 0}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Sin huesos presentes</span>
                  )}
                </div>
                {hasPresence && (
                  <>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={quality[g.key]?.value ?? 0}
                      onChange={(e) => updateQuality(g.key, "value", +e.target.value)}
                      className="w-full accent-emerald-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                    <input
                      type="text"
                      value={quality[g.key]?.obs ?? ""}
                      onChange={(e) => updateQuality(g.key, "obs", e.target.value)}
                      placeholder="Observaci\u00F3n (opcional)"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ICH summary bar */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold text-emerald-800">\u00CDndice de Calidad del Hueso (ICH)</span>
            <span className="text-lg font-bold text-emerald-700">{ICH.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-emerald-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, ICH)}%` }}
            />
          </div>
          <p className="text-xs text-emerald-600 mt-1">
            Promedio de calidad de los {QUALITY_GROUPS.filter((g) => groupCounts[g.key as keyof typeof groupCounts] > 0).length} grupos con presencia
          </p>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  4. Final Result                                              */}
      {/* ============================================================ */}
      <Section title="4. Resultado Final &mdash; EAT">
        <div className="text-center space-y-4 py-4">
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-blue-600 font-medium">IPO</p>
              <p className="text-2xl font-bold text-blue-800">{IPO.toFixed(1)}%</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-emerald-600 font-medium">ICH</p>
              <p className="text-2xl font-bold text-emerald-800">{ICH.toFixed(1)}%</p>
            </div>
            <div className={`rounded-lg p-3 text-white ${eatColor}`}>
              <p className="font-medium opacity-90">EAT</p>
              <p className="text-3xl font-bold">{EAT.toFixed(1)}%</p>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            EAT = 100 &minus; (IPO + ICH) / 2 = 100 &minus; ({IPO.toFixed(1)} + {ICH.toFixed(1)}) / 2
          </p>

          <div className={`inline-block px-4 py-2 rounded-full text-white font-semibold ${eatColor}`}>
            {eatLabel}
          </div>

          {/* Color scale legend */}
          <div className="flex justify-center gap-1 text-xs mt-2">
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500" /> 0-20</div>
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-lime-500" /> 21-40</div>
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-yellow-500" /> 41-60</div>
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-500" /> 61-80</div>
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-600" /> 81-100</div>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  5. Observations                                              */}
      {/* ============================================================ */}
      <Section title="5. Observaciones">
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={4}
          placeholder="Observaciones generales sobre el estado tafonómico del individuo..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </Section>

      {/* ============================================================ */}
      {/*  Submit                                                       */}
      {/* ============================================================ */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="bg-gray-900 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando..." : "Guardar ficha"}
        </button>
      </div>
    </form>
  );
}
