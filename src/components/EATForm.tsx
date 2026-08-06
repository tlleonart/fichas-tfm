"use client";

import { Fragment, useState, useMemo, useCallback } from "react";
import {
  MANO_MAX_PTS,
  MANO_ROWS,
  MANO_TOTAL_BONES,
  MANO_UNITS,
  PIE_MAX_PTS,
  PIE_ROWS,
  PIE_TOTAL_BONES,
  PIE_UNITS,
  buildEatData,
  clampCount,
  fmtPts,
  footBoneTotal,
  footPreviewPoints,
  handBoneTotal,
  handPreviewPoints,
  hydrateMano,
  hydratePie,
  presenceCounts,
  previewMetrics,
  unitPoints,
  type EatInputRow,
  type EatUnitSpec,
  type ManoData,
  type PieData,
  type QualityEntry,
} from "@/lib/eatPreview";

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

/*
 * Manos y pies: las filas de captura, las unidades anatómicas de puntuación y los
 * totales salen de `@/lib/eatPreview`, que los DERIVA del contrato
 * (`convex/lib/eatUnits.ts`). Acá no se hardcodea ninguna clave ni denominador:
 * mano = 5 inputs → 4 U.A. (máx 4 pts) · pie = 7 inputs → 5 U.A. (máx 5 pts).
 */

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
  initialData?: Record<string, unknown>;   // the saved `data` blob (method-specific keys)
  registrador?: string;
  fechaRegistro?: string;
  saving?: boolean;
  onSave: (payload: { registrador: string; fechaRegistro: string; data: Record<string, unknown> }) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Lectores del `data` guardado (`v.any()` en Convex → llega unknown)  */
/* ------------------------------------------------------------------ */

/** Mapa de presencia guardado → `Record<string, boolean>`. */
function asBoolMap(v: unknown): Record<string, boolean> {
  if (!v || typeof v !== "object") return {};
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, Boolean(val)]),
  );
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * `data.quality` guardado → estado del formulario.
 *
 * 🔒 NO fabrica valores: si un grupo no tiene `value` registrado, sigue sin
 * tenerlo (el ICH lo excluye del promedio). Y un `value = 0` se conserva como
 * `0`, que es una observación válida de calidad nula (SDD §5bis.2).
 */
function asQuality(
  v: unknown,
  fallback: Record<string, QualityEntry>,
): Record<string, QualityEntry> {
  if (!v || typeof v !== "object") return fallback;
  const out: Record<string, QualityEntry> = {};
  for (const [k, entry] of Object.entries(v as Record<string, unknown>)) {
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const raw = e.value;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw));
    out[k] = {
      // `undefined` se PRESERVA como `undefined` (no observado ≠ calidad 0).
      ...(Number.isFinite(n) ? { value: n } : {}),
      obs: asString(e.obs),
    };
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Helper: collapsible section                                        */
/* ------------------------------------------------------------------ */

function Section({
  title,
  subtitle,
  children,
  defaultOpen = true,
  testId,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Ancla estable para los E2E (el título y el subtítulo cambian con los datos). */
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-line rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid={testId ? `section-${testId}` : undefined}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-2 hover:bg-surface-2 transition text-left"
      >
        <div>
          <span className="font-semibold text-ink">{title}</span>
          {subtitle && (
            <span className="ml-2 text-sm text-faint">{subtitle}</span>
          )}
        </div>
        <span className="text-faint text-lg select-none">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Checkbox grid helper                                               */
/* ------------------------------------------------------------------ */

/**
 * Convex object field names must be ASCII. Bone labels carry accents
 * ("Clavícula der"), so we store state under a diacritic-stripped key while
 * still displaying the accented label. Metrics count truthy values regardless
 * of key, so this is safe.
 */
function asciiKey(s: string): string {
  return s.normalize("NFD").replace(/[^\x00-\x7F]/g, "");
}

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
      ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
      : columns === 4
        ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
        : columns === 3
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";

  return (
    <div className={`grid ${gridCols} gap-1`}>
      {items.map((item) => (
        <label
          key={item}
          className="tap-label flex items-center gap-2 text-sm cursor-pointer hover:bg-surface-2 rounded px-1 py-0.5"
        >
          <input
            type="checkbox"
            checked={!!checked[asciiKey(item)]}
            onChange={(e) => onChange(asciiKey(item), e.target.checked)}
            className="tap-check"
          />
          <span className="truncate">{item}</span>
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bulk-fill controls (F1)                                            */
/* ------------------------------------------------------------------ */

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
    <div className="flex items-center gap-2 mb-3">
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

/** Build a fully-checked state object for a list of display labels. */
function allTrue(items: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(items.map((i) => [asciiKey(i), true]));
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function EATForm({ initialData, registrador: registradorProp, fechaRegistro: fechaRegistroProp, onSave, saving }: EATFormProps) {
  /* ---------- Context ---------- */
  const [registrador, setRegistrador] = useState(registradorProp ?? "");
  const [fechaRegistro, setFechaRegistro] = useState(fechaRegistroProp ?? "");

  /* ---------- Bone Inventory (IPO) ---------- */
  const [craneoChecked, setCraneoChecked] = useState<Record<string, boolean>>(() =>
    asBoolMap(initialData?.craneo)
  );
  const [vertebrasChecked, setVertebrasChecked] = useState<Record<string, boolean>>(() =>
    asBoolMap(initialData?.vertebras)
  );
  const [largosChecked, setLargosChecked] = useState<Record<string, boolean>>(() =>
    asBoolMap(initialData?.huesosLargos)
  );
  const [planosChecked, setPlanosChecked] = useState<Record<string, boolean>>(() =>
    asBoolMap(initialData?.huesosPlanos)
  );
  const [costillasChecked, setCostillasChecked] = useState<Record<string, boolean>>(() =>
    asBoolMap(initialData?.costillas)
  );
  const [mandibula, setMandibula] = useState<boolean>(Boolean(initialData?.mandibula));
  const [hioides, setHioides] = useState<boolean>(Boolean(initialData?.hioides));

  /*
   * Manos y pies: `hydrateMano`/`hydratePie` abren tanto una ficha ya migrada
   * (claves granulares) como una SIN migrar (solo `falProxMedias`/`tarsianos`),
   * derivando en ese caso con las funciones del contrato. El backfill del
   * histórico corre DESPUÉS de que este formulario esté en prod (SDD §5bis.1).
   */
  const [manoDer, setManoDer] = useState<ManoData>(() => hydrateMano(initialData?.manoDer));
  const [manoIzq, setManoIzq] = useState<ManoData>(() => hydrateMano(initialData?.manoIzq));
  const [pieDer, setPieDer] = useState<PieData>(() => hydratePie(initialData?.pieDer));
  const [pieIzq, setPieIzq] = useState<PieData>(() => hydratePie(initialData?.pieIzq));

  /* ---------- Bone Quality (ICH) ---------- */
  /* 🔒 Default `value: 0` para los 9 grupos — NO cambiar a `undefined`: movería el
     ICH de las 60 fichas históricas (handoff §3 punto 5 / SDD §5bis.2). */
  const [quality, setQuality] = useState<Record<string, QualityEntry>>(() =>
    asQuality(
      initialData?.quality,
      Object.fromEntries(QUALITY_GROUPS.map((g) => [g.key, { value: 0, obs: "" }])),
    )
  );

  /* ---------- Observations ---------- */
  const [observations, setObservations] = useState(() => asString(initialData?.observations));

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

  /*
   * Huesos presentes por lado. Usa las allowlists del contrato
   * (`handBoneTotal`/`footBoneTotal`): ⚠️ sumar `Object.values(manoDer)` genérico
   * duplicaría los huesos si algún día vuelve a convivir el espejo legacy.
   */
  const manoDerTotal = useMemo(() => handBoneTotal(manoDer), [manoDer]);
  const manoIzqTotal = useMemo(() => handBoneTotal(manoIzq), [manoIzq]);
  const pieDerTotal = useMemo(() => footBoneTotal(pieDer), [pieDer]);
  const pieIzqTotal = useMemo(() => footBoneTotal(pieIzq), [pieIzq]);

  /* Puntos ponderados por lado (mano máx 4, pie máx 5) — partición estricta. */
  const manoDerPts = useMemo(() => handPreviewPoints(manoDer), [manoDer]);
  const manoIzqPts = useMemo(() => handPreviewPoints(manoIzq), [manoIzq]);
  const pieDerPts = useMemo(() => footPreviewPoints(pieDer), [pieDer]);
  const pieIzqPts = useMemo(() => footPreviewPoints(pieIzq), [pieIzq]);

  /*
   * Estado completo del formulario → `data` de la ficha. Es EL MISMO objeto que
   * se manda al guardar, así que el preview de abajo se calcula sobre exactamente
   * lo que se persiste.
   */
  const formState = useMemo(
    () => ({
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
    }),
    [craneoChecked, vertebrasChecked, largosChecked, planosChecked, costillasChecked, mandibula, hioides, manoDer, manoIzq, pieDer, pieIzq, quality, observations]
  );

  /* Group present counts (for quality gating) — mismo criterio que el backend. */
  const groupCounts = useMemo(() => presenceCounts(formState), [formState]);

  /*
   * 🔒 Invariante #2: el backend recalcula las métricas al guardar. Para que el
   * preview NO pueda divergir de lo persistido, acá se llama a `computeEAT()`, la
   * MISMA función de `convex/lib/metrics.ts` que corre `fichas.crear/actualizar`.
   * Nada de fórmulas duplicadas en el front.
   */
  const metrics = useMemo(() => previewMetrics(buildEatData(formState)), [formState]);
  const totalPresent = metrics.totalPresent;
  const IPO = metrics.ipo;
  const ICH = metrics.ich;
  const EAT = metrics.eat;

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
    /* `buildEatData` es la única armadora del payload: emite solo las claves
       autoritativas (nunca `falProxMedias`/`tarsianos`, que reescribe el backend)
       y no toca `quality` (los `0` viajan como `0`). */
    await onSave({ registrador, fechaRegistro, data: buildEatData(formState) });
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
      <label className="text-sm font-medium text-muted">{label}</label>
      <input
        type={opts?.type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        className="border border-line-strong rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );

  /**
   * Celda de captura de un hueso. `max === 1` (calcáneo, astrágalo) → checkbox:
   * es UN hueso por lado, no un conteo (handoff §2.2). Resto → spinner clampeado.
   */
  const renderBoneCell = (
    prefix: string,
    side: "der" | "izq",
    row: EatInputRow,
    value: number,
    onUpdate: (side: "der" | "izq", field: string, val: number) => void
  ) => {
    const testId = `${prefix}-${side}-${row.key}`;
    if (row.kind === "checkbox") {
      return (
        <label className="tap-cell" aria-label={`${row.label} — ${side === "der" ? "derecho" : "izquierdo"}`}>
          <input
            type="checkbox"
            className="tap-check"
            data-testid={testId}
            checked={value >= 1}
            onChange={(e) => onUpdate(side, row.key, e.target.checked ? 1 : 0)}
          />
        </label>
      );
    }
    return (
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={row.max}
        data-testid={testId}
        aria-label={`${row.label} — ${side === "der" ? "derecho" : "izquierdo"} (0 a ${row.max})`}
        value={value}
        onChange={(e) => onUpdate(side, row.key, clampCount(e.target.value, row.max))}
        className="w-16 min-h-11 border border-line-strong rounded text-center py-1 focus:ring-2 focus:ring-accent focus:outline-none"
      />
    );
  };

  /**
   * Tabla de captura de una extremidad, AGRUPADA por unidad anatómica.
   *
   * Cada unidad abre con una banda que dice cuál es (`U.A.n`), sobre qué denominador
   * puntúa en la fuente y cuántos puntos aporta hoy por lado — así se lee de un
   * vistazo qué input pertenece a qué unidad, que es lo que se complica al pasar de
   * 4 a 5 inputs por mano y de 5 a 7 por pie.
   */
  const renderExtremityTable = (
    prefix: string,
    label: string,
    units: readonly EatUnitSpec[],
    rows: readonly EatInputRow[],
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
      <h4 className="font-medium text-muted mb-2">{label}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-line rounded">
          <thead className="bg-surface-2">
            <tr>
              <th className="text-left px-2 py-1 border-b">Hueso</th>
              <th className="text-center px-2 py-1 border-b">Max</th>
              <th className="text-center px-2 py-1 border-b">Derecho</th>
              <th className="text-center px-2 py-1 border-b">Izquierdo</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <Fragment key={u.unit}>
                <tr className="border-b border-line bg-surface-2">
                  <td colSpan={4} className="px-2 py-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="pill pill-accent">U.A.{u.unit}</span>
                      <span className="text-xs font-semibold text-muted">{u.label}</span>
                      <span className="text-xs text-faint">puntúa sobre {u.denominator}</span>
                      <span
                        className="text-xs font-semibold text-accent"
                        data-testid={`${prefix}-u${u.unit}-pts`}
                      >
                        D {fmtPts(unitPoints(derData, u))} · I {fmtPts(unitPoints(izqData, u))} pts
                      </span>
                    </div>
                  </td>
                </tr>
                {rows
                  .filter((r) => r.unit === u.unit)
                  .map((r) => (
                    <tr key={r.key} className="border-b border-line">
                      <td className="px-2 py-1 pl-4">
                        <span>{r.label}</span>
                        {r.hint && (
                          <span className="block text-xs text-faint">({r.hint})</span>
                        )}
                      </td>
                      <td className="text-center px-2 py-1 text-faint">/{r.max}</td>
                      <td className="text-center px-1 py-1">
                        {renderBoneCell(prefix, "der", r, derData[r.key] ?? 0, onUpdate)}
                      </td>
                      <td className="text-center px-1 py-1">
                        {renderBoneCell(prefix, "izq", r, izqData[r.key] ?? 0, onUpdate)}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot className="bg-surface-2 font-medium">
            <tr>
              <td className="px-2 py-1">Total huesos</td>
              <td className="text-center px-2 py-1">/{totalBones}</td>
              <td className="text-center px-2 py-1" data-testid={`${prefix}-der-total`}>{derTotal}</td>
              <td className="text-center px-2 py-1" data-testid={`${prefix}-izq-total`}>{izqTotal}</td>
            </tr>
            <tr>
              <td className="px-2 py-1">Puntos ponderados</td>
              <td className="text-center px-2 py-1">/{maxPts}</td>
              <td className="text-center px-2 py-1" data-testid={`${prefix}-der-pts`}>{fmtPts(derPts)}</td>
              <td className="text-center px-2 py-1" data-testid={`${prefix}-izq-pts`}>{fmtPts(izqPts)}</td>
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
      <h2 className="text-2xl font-bold text-ink">
        EAT &mdash; Estado de Afectaci&oacute;n Tafon&oacute;mica
      </h2>
      <p className="text-sm text-faint">Serrulla &amp; V&aacute;zquez (2019)</p>

      {/* ============================================================ */}
      {/*  1. Context Data                                              */}
      {/* ============================================================ */}
      <Section title="1. Datos de Contexto">
        <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {textInput("Registrador", registrador, setRegistrador)}
          {textInput("Fecha de registro", fechaRegistro, setFechaRegistro, { type: "date" })}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  2. Bone Inventory (IPO)                                      */}
      {/* ============================================================ */}
      <Section
        title="2. Inventario Óseo (IPO)"
        subtitle={`${totalPresent.toFixed(1)} / 115 — IPO = ${IPO.toFixed(1)}%`}
      >
        {/* Cráneo */}
        <Section title="Cráneo" subtitle={`${countChecked(craneoChecked)} / 18`} defaultOpen={false}>
          <BulkControls
            label="Cráneo"
            onAll={() => setCraneoChecked(allTrue(CRANEO_BONES))}
            onClear={() => setCraneoChecked({})}
          />
          <CheckboxGrid
            items={CRANEO_BONES}
            checked={craneoChecked}
            onChange={(k, v) => setCraneoChecked((p) => ({ ...p, [k]: v }))}
            columns={3}
          />
        </Section>

        {/* Vértebras */}
        <Section title="Vértebras" subtitle={`${countChecked(vertebrasChecked)} / 32`} defaultOpen={false}>
          <BulkControls
            label="Vértebras"
            onAll={() => setVertebrasChecked(allTrue(ALL_VERTEBRAS))}
            onClear={() => setVertebrasChecked({})}
          />
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-faint mb-1">Cervicales (C1-C7)</p>
              <CheckboxGrid
                items={VERTEBRAS_CERVICALES}
                checked={vertebrasChecked}
                onChange={(k, v) => setVertebrasChecked((p) => ({ ...p, [k]: v }))}
                columns={4}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-faint mb-1">Tor&aacute;cicas (T1-T12)</p>
              <CheckboxGrid
                items={VERTEBRAS_TORACICAS}
                checked={vertebrasChecked}
                onChange={(k, v) => setVertebrasChecked((p) => ({ ...p, [k]: v }))}
                columns={6}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-faint mb-1">Lumbares (L1-L5)</p>
              <CheckboxGrid
                items={VERTEBRAS_LUMBARES}
                checked={vertebrasChecked}
                onChange={(k, v) => setVertebrasChecked((p) => ({ ...p, [k]: v }))}
                columns={4}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-faint mb-1">Sacras (S1-S5)</p>
              <CheckboxGrid
                items={VERTEBRAS_SACRAS}
                checked={vertebrasChecked}
                onChange={(k, v) => setVertebrasChecked((p) => ({ ...p, [k]: v }))}
                columns={4}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-faint mb-1">Cocc&iacute;geas (Co1-Co3)</p>
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
          <BulkControls
            label="Huesos Largos"
            onAll={() => setLargosChecked(allTrue(largosAllKeys))}
            onClear={() => setLargosChecked({})}
          />
          <CheckboxGrid
            items={largosAllKeys}
            checked={largosChecked}
            onChange={(k, v) => setLargosChecked((p) => ({ ...p, [k]: v }))}
            columns={4}
          />
        </Section>

        {/* Huesos Planos */}
        <Section title="Huesos Planos" subtitle={`${countChecked(planosChecked)} / 7`} defaultOpen={false}>
          <BulkControls
            label="Huesos Planos"
            onAll={() => setPlanosChecked(allTrue(HUESOS_PLANOS))}
            onClear={() => setPlanosChecked({})}
          />
          <CheckboxGrid
            items={HUESOS_PLANOS}
            checked={planosChecked}
            onChange={(k, v) => setPlanosChecked((p) => ({ ...p, [k]: v }))}
            columns={4}
          />
        </Section>

        {/* Costillas */}
        <Section title="Costillas" subtitle={`${countChecked(costillasChecked)} / 24`} defaultOpen={false}>
          <BulkControls
            label="Costillas"
            onAll={() => setCostillasChecked(allTrue(costillasAllKeys))}
            onClear={() => setCostillasChecked({})}
          />
          <CheckboxGrid
            items={costillasAllKeys}
            checked={costillasChecked}
            onChange={(k, v) => setCostillasChecked((p) => ({ ...p, [k]: v }))}
            columns={4}
          />
        </Section>

        {/* Mandíbula & Hioides */}
        <div className="space-y-2">
          <BulkControls
            label="Mandíbula e hioides"
            onAll={() => {
              setMandibula(true);
              setHioides(true);
            }}
            onClear={() => {
              setMandibula(false);
              setHioides(false);
            }}
          />
          <div className="flex gap-6 flex-wrap">
            <label className="tap-label flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={mandibula}
                onChange={(e) => setMandibula(e.target.checked)}
                className="tap-check"
              />
              <span className="font-medium">Mand&iacute;bula</span>
            </label>
            <label className="tap-label flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={hioides}
                onChange={(e) => setHioides(e.target.checked)}
                className="tap-check"
              />
              <span className="font-medium">Hioides</span>
            </label>
          </div>
        </div>

        {/* Manos */}
        <Section
          title="Manos"
          subtitle={`D: ${fmtPts(manoDerPts)} + I: ${fmtPts(manoIzqPts)} = ${fmtPts(manoDerPts + manoIzqPts)} / ${MANO_MAX_PTS * 2} pts`}
          defaultOpen={false}
          testId="manos"
        >
          {renderExtremityTable(
            "mano",
            "Manos — 4 unidades anatómicas, máx 4 pts por mano",
            MANO_UNITS,
            MANO_ROWS,
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
          subtitle={`D: ${fmtPts(pieDerPts)} + I: ${fmtPts(pieIzqPts)} = ${fmtPts(pieDerPts + pieIzqPts)} / ${PIE_MAX_PTS * 2} pts`}
          defaultOpen={false}
          testId="pies"
        >
          {renderExtremityTable(
            "pie",
            "Pies — 5 unidades anatómicas, máx 5 pts por pie",
            PIE_UNITS,
            PIE_ROWS,
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
        <div className="bg-accent-soft border border-line rounded-lg p-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold text-accent">Índice de Preservación Ósea (IPO)</span>
            <span className="text-lg font-bold text-accent">{IPO.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${Math.min(100, IPO)}%` }}
            />
          </div>
          <p className="text-xs text-accent mt-1">
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
        testId="ich"
      >
        <p className="text-sm text-faint mb-3">
          Para cada grupo que tenga huesos presentes, indique la calidad del hueso con el slider (0-100%) y, opcionalmente, una observaci&oacute;n.
        </p>
        <div className="space-y-4">
          {QUALITY_GROUPS.map((g) => {
            const hasPresence = groupCounts[g.key as keyof typeof groupCounts] > 0;
            /* Calidad que quedó cargada de antes y ya no corresponde, porque el
               grupo dejó de tener huesos presentes. El slider está oculto, así que
               sin este aviso el valor sería invisible: se limpia al guardar
               (`pruneQualityForAbsentGroups`) y acá se dice explícitamente. */
            const huerfana =
              !hasPresence &&
              (Number(quality[g.key]?.value) > 0 || (quality[g.key]?.obs ?? "").trim() !== "");
            return (
              <div
                key={g.key}
                className={`border rounded-lg p-3 transition ${hasPresence ? "border-line-strong bg-surface" : huerfana ? "border-amber-500/40 bg-amber-500/10" : "border-line bg-surface-2 opacity-50"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted">{g.label}</span>
                  {hasPresence ? (
                    <span className="text-sm font-bold text-ink" data-testid={`quality-${g.key}-value`}>
                      {quality[g.key]?.value ?? 0}%
                    </span>
                  ) : (
                    <span className="text-xs text-faint">Sin huesos presentes</span>
                  )}
                </div>
                {huerfana && (
                  <p
                    className="text-xs text-muted"
                    data-testid={`quality-${g.key}-huerfana`}
                  >
                    Este grupo tenía una calidad cargada
                    {Number(quality[g.key]?.value) > 0 ? ` (${quality[g.key]?.value}%)` : ""}
                    {(quality[g.key]?.obs ?? "").trim() !== ""
                      ? ` y la observación «${quality[g.key]?.obs}»`
                      : ""}
                    , pero el grupo no tiene huesos marcados como presentes. Al guardar
                    se va a limpiar. Si la calidad era correcta, marcá primero la presencia
                    del hueso y volvé a cargarla.
                  </p>
                )}
                {hasPresence && (
                  <>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      data-testid={`quality-${g.key}`}
                      aria-label={`Calidad — ${g.label} (0 a 100%)`}
                      value={quality[g.key]?.value ?? 0}
                      onChange={(e) => updateQuality(g.key, "value", +e.target.value)}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-xs text-faint mb-2">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                    <input
                      type="text"
                      value={quality[g.key]?.obs ?? ""}
                      onChange={(e) => updateQuality(g.key, "obs", e.target.value)}
                      placeholder="Observación (opcional)"
                      className="w-full border border-line rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ICH summary bar */}
        <div className="bg-accent-soft border border-line rounded-lg p-3 mt-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold text-accent">Índice de Calidad del Hueso (ICH)</span>
            <span className="text-lg font-bold text-accent">{ICH.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${Math.min(100, ICH)}%` }}
            />
          </div>
          <p className="text-xs text-accent mt-1">
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
            <div className="bg-accent-soft rounded-lg p-3">
              <p className="text-accent font-medium">IPO</p>
              <p className="text-2xl font-bold text-accent" data-testid="ipo-value">{IPO.toFixed(1)}%</p>
            </div>
            <div className="bg-accent-soft rounded-lg p-3">
              <p className="text-accent font-medium">ICH</p>
              <p className="text-2xl font-bold text-accent" data-testid="ich-value">{ICH.toFixed(1)}%</p>
            </div>
            <div className={`rounded-lg p-3 text-white ${eatColor}`}>
              <p className="font-medium opacity-90">EAT</p>
              <p className="text-3xl font-bold" data-testid="eat-value">{EAT.toFixed(1)}%</p>
            </div>
          </div>

          <p className="text-sm text-faint">
            EAT = 100 − (IPO × ICH) / 100 = 100 − ({IPO.toFixed(1)} × {ICH.toFixed(1)}) / 100
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
          className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
        />
      </Section>

      {/* ============================================================ */}
      {/*  Submit                                                       */}
      {/* ============================================================ */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary px-8 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando..." : "Guardar ficha"}
        </button>
      </div>
    </form>
  );
}
