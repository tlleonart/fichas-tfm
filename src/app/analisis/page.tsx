"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

function Rho({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-faint">n insuficiente</span>;
  const strength =
    Math.abs(value) >= 0.7 ? "fuerte" : Math.abs(value) >= 0.4 ? "moderada" : "débil";
  return (
    <span className="font-semibold text-ink">
      ρ = {value} <span className="font-normal text-faint">({strength})</span>
    </span>
  );
}

export default function AnalisisPage() {
  const result = useQuery(api.analisis.comparacion, {});

  if (result === undefined)
    return <div className="card p-10 text-center text-sm text-muted">Cargando…</div>;

  const { resumen, pares, correlaciones } = result;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-ink">Análisis comparativo</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Comparación entre el método de Zonación (objetivo) y el EAT (que incorpora el
          índice subjetivo ICH), a nivel población y total. Correlación de Spearman; se
          requieren al menos 3 individuos con ambos métodos.
        </p>
      </header>

      {/* Summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Individuos" value={resumen.individuos} />
        <Card label="Pareados (Zon + EAT)" value={resumen.pareados} accent />
        <Card label="Solo Zonación" value={resumen.soloZonacion} />
        <Card label="Solo EAT" value={resumen.soloEat} />
      </section>

      {/* Correlations */}
      <section className="card p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Correlaciones</h2>
        {!resumen.nSuficienteParaCorrelacion && (
          <p className="mt-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
            Hay {resumen.pareados} individuo(s) pareado(s). Las correlaciones se calculan
            con n ≥ 3. La capacidad analítica ya está activa; los resultados se vuelven
            significativos a medida que se cargan más individuos.
          </p>
        )}
        <dl className="mt-4 space-y-4">
          <Hyp
            tag="H1"
            title="Validez convergente de presencia"
            desc="Completitud (Zonación) frente a IPO (EAT). Se espera correlación fuerte: ambos miden presencia."
            value={correlaciones.ipo_vs_completitud}
          />
          <Hyp
            tag="H2"
            title="Divergencia del EAT respecto a lo objetivo"
            desc="EAT frente a la afectación derivada de la completitud. La diferencia se atribuye al ICH."
            value={correlaciones.eat_vs_afectacionZonacion}
          />
          <Hyp
            tag="H3"
            title="¿El índice subjetivo (ICH) está fundamentado?"
            desc="ICH frente a medidas objetivas independientes (completitud, FFI). La correlación parcial controlando IPO es un paso siguiente documentado."
            value={correlaciones.ich_vs_completitud}
            extra={<>FFI: <Rho value={correlaciones.ich_vs_ffi} /></>}
          />
        </dl>
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
                  <th className="px-4 py-2.5 font-semibold">FFI medio</th>
                  <th className="px-4 py-2.5 font-semibold">Alter.</th>
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
                    <td className="px-4 py-2.5 text-muted">{p.ffiMedia === null ? "—" : String(p.ffiMedia)}</td>
                    <td className="px-4 py-2.5 text-muted">{String(p.alteraciones)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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

function Hyp({
  tag,
  title,
  desc,
  value,
  extra,
}: {
  tag: string;
  title: string;
  desc: string;
  value: number | null;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="max-w-prose">
        <div className="flex items-center gap-2">
          <span className="pill pill-accent">{tag}</span>
          <span className="font-medium text-ink">{title}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{desc}</p>
      </div>
      <div className="shrink-0 text-sm sm:text-right">
        <Rho value={value} />
        {extra && <div className="mt-1 text-xs">{extra}</div>}
      </div>
    </div>
  );
}
