"use client";

import { useState } from "react";

import EATForm from "@/components/EATForm";
import { prepararEscrituraEat } from "@convex/lib/eatWrite";

/**
 * Fixture de una ficha EAT con el shape **pre-migración** (solo los conteos
 * agregados `falProxMedias` / `tarsianos`, sin `schemaVersion` ni `eatDerivation`).
 * Es el caso que el formulario nuevo tiene que abrir sin perder datos, porque el
 * backfill del histórico corre DESPUÉS de que este form esté en prod (SDD §5bis.1).
 */
const FICHA_SIN_MIGRAR: Record<string, unknown> = {
  craneo: { Frontal: true, "Parietal der": true, "Parietal izq": true, Occipital: true },
  vertebras: { C1: true, C2: true, T1: true, T2: true, L1: true },
  huesosLargos: { "Femur der": true, "Femur izq": true, "Tibia der": true },
  huesosPlanos: { "Coxal der": true, "Rotula der": true },
  costillas: { "Costilla 1 der": true, "Costilla 2 der": true },
  mandibula: true,
  hioides: false,
  // 6 carpianos, 5 metacarpianos, 7 de las 9 prox+medias, 3 distales
  manoDer: { carpianos: 6, metacarpianos: 5, falProxMedias: 7, falDistales: 3 },
  manoIzq: { carpianos: 8, metacarpianos: 5, falProxMedias: 9, falDistales: 5 },
  // 4 de los 7 tarsianos (agregado ambiguo: no dice CUÁLES)
  pieDer: { tarsianos: 4, metatarsianos: 5, falProx: 3, falMedias: 2, falDistales: 1 },
  pieIzq: { tarsianos: 7, metatarsianos: 5, falProx: 5, falMedias: 4, falDistales: 5 },
  quality: {
    craneo: { value: 75, obs: "" },
    vertebras: { value: 50, obs: "" },
    huesosLargos: { value: 80, obs: "" },
    huesosPlanos: { value: 60, obs: "" },
    costillas: { value: 40, obs: "" },
    mandibula: { value: 0, obs: "calidad nula" },
    manos: { value: 60, obs: "" },
    pies: { value: 40, obs: "" },
  },
  observations: "Ficha histórica de prueba (shape pre-migración).",
  _computed: { totalPresent: 0, IPO: 0, ICH: 0, EAT: 0 },
};

type Fixture = "nueva" | "sin-migrar" | "guardada";

export default function EatHarnessClient() {
  const [fixture, setFixture] = useState<Fixture>("nueva");
  const [initialData, setInitialData] = useState<Record<string, unknown> | undefined>(undefined);
  const [saved, setSaved] = useState<Record<string, unknown> | null>(null);
  const [nonce, setNonce] = useState(0);

  const cargar = (f: Fixture, data?: Record<string, unknown>) => {
    setFixture(f);
    setInitialData(data);
    setNonce((n) => n + 1);
  };

  /**
   * "Guardar" del banco de pruebas: NO llama a Convex. Corre el MISMO camino de
   * escritura del backend (`prepararEscrituraEat`: normalizar → validar →
   * recalcular) y guarda el resultado en memoria, así el E2E puede verificar el
   * round-trip exacto (payload → lo que se persistiría → reabrir la ficha).
   */
  async function handleSave(payload: {
    registrador: string;
    fechaRegistro: string;
    data: Record<string, unknown>;
  }) {
    const escritura = prepararEscrituraEat(payload.data, Date.now(), saved ?? undefined);
    setSaved({
      registrador: payload.registrador,
      fechaRegistro: payload.fechaRegistro,
      data: escritura.data,
      metricas: escritura.metricas,
      schemaVersion: escritura.schemaVersion,
    });
  }

  const savedData = saved?.data as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <div className="card space-y-2 border border-line p-4">
        <h1 className="font-serif text-lg font-semibold text-ink">
          Banco de pruebas — EATForm (E2E)
        </h1>
        <p className="text-xs text-faint">
          Sin conexión a Convex: el guardado corre en memoria por el mismo camino de
          escritura del backend. No toca ninguna ficha real.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="bulk-btn" data-testid="load-nueva" onClick={() => cargar("nueva", undefined)}>
            Ficha nueva
          </button>
          <button
            type="button"
            className="bulk-btn"
            data-testid="load-sin-migrar"
            onClick={() => cargar("sin-migrar", FICHA_SIN_MIGRAR)}
          >
            Ficha sin migrar
          </button>
          <button
            type="button"
            className="bulk-btn"
            data-testid="reopen-saved"
            disabled={!savedData}
            onClick={() => cargar("guardada", savedData)}
          >
            Reabrir lo guardado
          </button>
          <span className="pill" data-testid="fixture-actual">{fixture}</span>
        </div>
      </div>

      <pre className="hidden" data-testid="saved-payload">
        {saved ? JSON.stringify(saved) : ""}
      </pre>

      <EATForm key={`${fixture}-${nonce}`} initialData={initialData} onSave={handleSave} />
    </div>
  );
}
