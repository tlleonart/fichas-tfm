"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import TablasTFM from "@/components/TablasTFM";

export default function AnalisisPage() {
  const result = useQuery(api.analisis.comparacion, {});

  if (result === undefined)
    return <div className="card p-10 text-center text-sm text-muted">Cargando…</div>;

  const { resumen, pares } = result;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-ink">Análisis comparativo</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Comparación entre el método de Zonación (objetivo) y el EAT (que incorpora el
          índice subjetivo ICH), a nivel población y total: resumen de la muestra,
          detalle por individuo pareado y las tablas del TFM.
        </p>
      </header>

      {/* Summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Individuos" value={resumen.individuos} />
        <Card label="Pareados (Zon + EAT)" value={resumen.pareados} accent />
        <Card label="Solo Zonación" value={resumen.soloZonacion} />
        <Card label="Solo EAT" value={resumen.soloEat} />
      </section>

      {/* Paired data table */}
      {pares.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3">
            <h2 className="font-serif text-lg font-semibold text-ink">
              Individuos pareados
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-4 py-2.5 font-semibold">Completitud</th>
                  <th className="px-4 py-2.5 font-semibold">IPO</th>
                  <th className="px-4 py-2.5 font-semibold">ICH</th>
                  <th className="px-4 py-2.5 font-semibold">EAT</th>
                </tr>
              </thead>
              <tbody>
                {pares.map((p) => (
                  <tr key={String(p.individuoId)} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink">{String(p.codigo)}</td>
                    <td className="px-4 py-2.5 text-muted">{String(p.completitudGlobal)}%</td>
                    <td className="px-4 py-2.5 text-muted">{String(p.ipo)}%</td>
                    <td className="px-4 py-2.5 text-muted">{String(p.ich)}%</td>
                    <td className="px-4 py-2.5 font-medium text-accent">{String(p.eat)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Las tablas del TFM, calculadas por la app: antes vivían en planillas externas. */}
      <TablasTFM />
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-faint">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ? "text-accent" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
