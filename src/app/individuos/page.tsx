"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

function Coverage({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={
        on
          ? "pill pill-accent"
          : "pill opacity-60"
      }
      title={on ? `${label}: registrada` : `${label}: pendiente`}
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-current" : "bg-faint"}`}
      />
      {label}
    </span>
  );
}

export default function IndividuosPage() {
  const individuos = useQuery(api.individuos.listar, {});

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Individuos</h1>
          <p className="mt-1 text-sm text-muted">
            Cada individuo integra sus fichas de Zonación y EAT.
          </p>
        </div>
        <Link href="/individuos/nuevo" className="btn btn-primary">
          Nuevo individuo
        </Link>
      </header>

      {individuos === undefined ? (
        <div className="card p-10 text-center text-sm text-muted">Cargando…</div>
      ) : individuos.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted">Todavía no hay individuos cargados.</p>
          <Link href="/individuos/nuevo" className="btn btn-primary mt-4">
            Crear el primero
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Sitio</th>
                  <th className="px-4 py-3 font-semibold">Fosa / UF</th>
                  <th className="px-4 py-3 font-semibold">Sexo</th>
                  <th className="px-4 py-3 font-semibold">Edad</th>
                  <th className="px-4 py-3 font-semibold">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {individuos.map((ind) => (
                  <tr
                    key={ind._id}
                    className="border-b border-line last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/individuos/${ind._id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {ind.codigoCanonico}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{ind.sitio}</td>
                    <td className="px-4 py-3 text-muted">
                      F{ind.numeroFosa} · UF{ind.codigoUF}
                    </td>
                    <td className="px-4 py-3 text-muted">{ind.sexoEstimado || "—"}</td>
                    <td className="px-4 py-3 text-muted">{ind.edadEstimada || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <Coverage on={ind.tieneZonacion} label="Zonación" />
                        <Coverage on={ind.tieneEat} label="EAT" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 sm:hidden">
            {individuos.map((ind) => (
              <Link
                key={ind._id}
                href={`/individuos/${ind._id}`}
                className="card block p-4 transition-colors hover:border-line-strong"
              >
                <div className="font-medium text-accent">{ind.codigoCanonico}</div>
                <div className="mt-1 text-sm text-muted">
                  {ind.sitio} · F{ind.numeroFosa} · UF{ind.codigoUF}
                </div>
                <div className="mt-1 text-sm text-faint">
                  {ind.sexoEstimado || "sexo —"} · {ind.edadEstimada || "edad —"}
                </div>
                <div className="mt-3 flex gap-1.5">
                  <Coverage on={ind.tieneZonacion} label="Zonación" />
                  <Coverage on={ind.tieneEat} label="EAT" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
