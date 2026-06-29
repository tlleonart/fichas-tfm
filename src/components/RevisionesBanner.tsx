"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Revisiones pendientes (corrección metodológica de Zonación, SDD §6).
 * Shape idéntico al `revisionesPendientes` del schema de `fichas`.
 */
export interface RevisionPendiente {
  codigo: string;
  severidad: "corregir" | "revisar";
  titulo: string;
  instrucciones: string;
  campos: string[];
}

/**
 * Mapa de clave de `data` (campo afectado) → ancla de sección del formulario de
 * Zonación. El form expone estos ids en cada sección relevante para que el
 * banner pueda llevar a Martina directo a corregir.
 */
const CAMPO_TO_ANCHOR: Record<string, string> = {
  sacrum_zones: "sec-sacrum",
  mandible_zones: "sec-mandible",
  mandibula_lateralidad_obs: "sec-mandible",
  patella_zones: "sec-patella",
  humerus_fusion: "sec-humerus",
  radius_fusion: "sec-radius",
  ulna_fusion: "sec-ulna",
  femur_fusion: "sec-femur",
  tibia_fusion: "sec-tibia",
  fibula_fusion: "sec-fibula",
};

function severityClasses(sev: RevisionPendiente["severidad"]) {
  // corregir = rojo (danger); revisar = ámbar.
  if (sev === "corregir") {
    return {
      box: "border-danger/40 bg-danger/10",
      tag: "bg-danger text-white",
      tagLabel: "Corregir",
    };
  }
  return {
    box: "border-amber-500/40 bg-amber-500/10",
    tag: "bg-amber-500 text-white",
    tagLabel: "Revisar",
  };
}

/**
 * Banner por cada revisión pendiente de una ficha. Render condicional: si no
 * hay revisiones devuelve null.
 *
 * @param fichaHref  link al editor de la ficha (Zonación) para anclar a la sección.
 * @param onMarcarRevisada  callback opcional para "Marcar como revisada".
 */
export default function RevisionesBanner({
  revisiones,
  fichaHref,
  onMarcarRevisada,
}: {
  revisiones: RevisionPendiente[] | undefined | null;
  fichaHref?: string;
  onMarcarRevisada?: () => void | Promise<void>;
}) {
  const [working, setWorking] = useState(false);

  if (!revisiones || revisiones.length === 0) return null;

  async function handleMarcar() {
    if (!onMarcarRevisada) return;
    setWorking(true);
    try {
      await onMarcarRevisada();
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="space-y-3" aria-label="Revisiones pendientes">
      {revisiones.map((r, i) => {
        const sc = severityClasses(r.severidad);
        const anchor = r.campos
          .map((c) => CAMPO_TO_ANCHOR[c])
          .find(Boolean);
        const target =
          fichaHref && anchor ? `${fichaHref}#${anchor}` : fichaHref;
        return (
          <div
            key={`${r.codigo}-${i}`}
            className={`rounded-lg border px-4 py-3 ${sc.box}`}
            role="alert"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`pill ${sc.tag}`}
                style={{ borderColor: "transparent" }}
              >
                {sc.tagLabel}
              </span>
              <h3 className="text-sm font-semibold text-ink">{r.titulo}</h3>
            </div>
            <p className="mt-1.5 text-sm text-muted">{r.instrucciones}</p>
            {target && (
              <Link
                href={target}
                className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
              >
                Ir a la sección →
              </Link>
            )}
          </div>
        );
      })}
      {onMarcarRevisada && (
        <button
          type="button"
          onClick={handleMarcar}
          disabled={working}
          className="btn btn-ghost text-sm disabled:opacity-50"
        >
          {working ? "Marcando…" : "Marcar como revisada"}
        </button>
      )}
    </section>
  );
}
