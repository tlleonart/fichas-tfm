"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import RevisionesBanner, {
  type RevisionPendiente,
} from "@/components/RevisionesBanner";
import { useEsEditor } from "@/components/RolProvider";

interface EATMetrics {
  ipo: number;
  ich: number;
  eat: number;
  totalPresent: number;
}
interface ZonMetrics {
  completitudGlobal: number;
  elementosPresentes: number;
}

export default function IndividuoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"individuos">;
  const data = useQuery(api.individuos.obtener, { id });
  const eliminar = useMutation(api.individuos.eliminar);
  const marcarRevisionResuelta = useMutation(api.fichas.marcarRevisionResuelta);
  // El lector (corrector del TFM) no llega a ninguna mutation ni a los
  // formularios de carga; su vía es el documento imprimible.
  const esEditor = useEsEditor();

  if (data === undefined)
    return <div className="card p-10 text-center text-sm text-muted">Cargando…</div>;
  if (data === null)
    return (
      <div className="card p-12 text-center">
        <p className="text-muted">No se encontró el individuo.</p>
        <Link href="/individuos" className="btn btn-ghost mt-4">
          Volver
        </Link>
      </div>
    );

  const { individuo, fichas } = data;
  const zon = fichas.find((f) => f.tipo === "zonacion");
  const eat = fichas.find((f) => f.tipo === "eat");
  const zm = zon?.metricas as ZonMetrics | undefined;
  const em = eat?.metricas as EATMetrics | undefined;

  // Corrección metodológica (SDD §6): banners por revisión pendiente. Hoy solo
  // las fichas de zonación reciben revisiones; cada banner ancla al editor.
  const zonRevisiones = (zon?.revisionesPendientes ?? []) as RevisionPendiente[];
  const zonFichaId = zon?._id;

  async function handleMarcarRevision(codigo: string) {
    if (!zonFichaId) return;
    // Solo limpia el ítem de ese código; el query reactivo de Convex re-rendea
    // y el banner desaparece. No toca data/metricas (mutation de Ronan).
    await marcarRevisionResuelta({ fichaId: zonFichaId, codigo });
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este individuo y todas sus fichas? No se puede deshacer.")) return;
    await eliminar({ id });
    router.push("/individuos");
  }

  return (
    <div className="space-y-7">
      <nav className="text-sm text-muted">
        <Link href="/individuos" className="hover:text-ink hover:underline">
          Individuos
        </Link>
        <span className="px-2 text-faint">/</span>
        <span className="text-ink">{individuo.codigoCanonico}</span>
      </nav>

      {/* Identity */}
      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-ink">
              {individuo.codigoCanonico}
            </h1>
            <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <Meta label="Sitio" value={individuo.sitio} />
              <Meta label="Año" value={String(individuo.anioExcavacion)} />
              <Meta label="Fosa" value={individuo.numeroFosa} />
              <Meta label="UF" value={individuo.codigoUF} />
              <Meta label="Individuo" value={individuo.numeroIndividuo} />
              <Meta label="Sexo" value={individuo.sexoEstimado || "—"} />
              <Meta label="Edad" value={individuo.edadEstimada || "—"} />
            </dl>
            {individuo.observaciones && (
              <p className="mt-3 max-w-prose text-sm text-muted">{individuo.observaciones}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/individuos/${id}/documento`} className="btn btn-ghost">
              Informe PDF
            </Link>
            {esEditor && (
              <>
                <Link href={`/individuos/${id}/editar`} className="btn btn-ghost">
                  Editar
                </Link>
                <button onClick={handleDelete} className="btn btn-ghost text-danger">
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Revisiones pendientes (corrección metodológica) */}
      <RevisionesBanner
        revisiones={zonRevisiones}
        fichaHref={esEditor ? `/individuos/${id}/zonacion` : undefined}
        onMarcarRevisada={esEditor && zonFichaId ? handleMarcarRevision : undefined}
      />

      {/* Ficha slots */}
      <section className="grid gap-5 md:grid-cols-2">
        <FichaCard
          title="Método de Zonación"
          cite="Knüsel & Outram (2004)"
          href={esEditor ? `/individuos/${id}/zonacion` : undefined}
          present={!!zon}
        >
          {zm && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Completitud global" value={`${zm.completitudGlobal}%`} />
              <Stat label="Elementos presentes" value={`${zm.elementosPresentes}/18`} />
            </div>
          )}
        </FichaCard>

        <FichaCard
          title="Estado de Afectación Tafonómica"
          cite="Serrulla & Vázquez (2019)"
          href={esEditor ? `/individuos/${id}/eat` : undefined}
          present={!!eat}
        >
          {em && (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="IPO" value={`${em.ipo}%`} />
              <Stat label="ICH" value={`${em.ich}%`} />
              <Stat label="EAT" value={`${em.eat}%`} accent />
            </div>
          )}
        </FichaCard>
      </section>

      {/* Per-individual comparison */}
      {zm && em && (
        <section className="card p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Comparación de métodos
          </h2>
          <p className="mt-1 text-sm text-muted">
            Preservación objetiva (Zonación) frente a la valoración del EAT (incluye el
            índice subjetivo ICH).
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dimensión</th>
                  <th>Zonación (objetivo)</th>
                  <th>EAT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-muted">Preservación / presencia</td>
                  <td>{zm.completitudGlobal}% completitud</td>
                  <td>{em.ipo}% IPO</td>
                </tr>
                <tr>
                  <td className="text-muted">Afectación (↑ peor)</td>
                  <td>{Math.round((100 - zm.completitudGlobal) * 10) / 10}%</td>
                  <td>{em.eat}% EAT</td>
                </tr>
                <tr>
                  <td className="text-muted">Componente subjetivo</td>
                  <td className="text-faint">— (no aplica)</td>
                  <td>{em.ich}% ICH</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-faint">
            La comparación a nivel población y total está en la sección{" "}
            {esEditor ? (
              <Link href="/analisis" className="text-accent hover:underline">
                Análisis
              </Link>
            ) : (
              "Análisis"
            )}
            .
          </p>
        </section>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
      <div className="text-xs text-faint">{label}</div>
      <div className={`text-lg font-semibold ${accent ? "text-accent" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function FichaCard({
  title,
  cite,
  href,
  present,
  children,
}: {
  title: string;
  cite: string;
  /** Sin `href` (rol lector) la tarjeta no ofrece el formulario de carga. */
  href?: string;
  present: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article className="card flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-ink">{title}</h2>
          <p className="text-sm text-faint">{cite}</p>
        </div>
        <span className={present ? "pill pill-accent" : "pill"}>
          {present ? "Registrada" : "Pendiente"}
        </span>
      </div>
      <div className="mt-4 flex-1">{children}</div>
      {href && (
        <Link href={href} className={`btn mt-5 ${present ? "btn-ghost" : "btn-primary"}`}>
          {present ? "Ver / editar ficha" : "Registrar ficha"}
        </Link>
      )}
    </article>
  );
}
