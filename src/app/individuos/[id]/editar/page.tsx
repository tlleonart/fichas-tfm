"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export default function EditarIndividuoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"individuos">;

  const data = useQuery(api.individuos.obtener, { id });
  const actualizar = useMutation(api.individuos.actualizar);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    anioExcavacion: new Date().getFullYear(),
    sitio: "",
    numeroFosa: "",
    codigoUF: "",
    numeroIndividuo: "",
    sexoEstimado: "",
    edadEstimada: "",
    observaciones: "",
  });

  // Prefill UNA sola vez cuando llega el individuo. El query de Convex es
  // reactivo y devuelve referencias nuevas en cada tick; sin este guard, el
  // efecto pisaría lo que Martina esté editando. (Regresión detectada en QA.)
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !data?.individuo) return;
    prefilled.current = true;
    const i = data.individuo;
    setForm({
      anioExcavacion: i.anioExcavacion,
      sitio: i.sitio,
      numeroFosa: i.numeroFosa,
      codigoUF: i.codigoUF,
      numeroIndividuo: i.numeroIndividuo,
      sexoEstimado: i.sexoEstimado ?? "",
      edadEstimada: i.edadEstimada ?? "",
      observaciones: i.observaciones ?? "",
    });
  }, [data]);

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((p) => ({ ...p, [k]: v }));

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await actualizar({
        id,
        anioExcavacion: Number(form.anioExcavacion),
        sitio: form.sitio.trim(),
        numeroFosa: form.numeroFosa.trim(),
        codigoUF: form.codigoUF.trim(),
        numeroIndividuo: form.numeroIndividuo.trim(),
        sexoEstimado: form.sexoEstimado.trim() || undefined,
        edadEstimada: form.edadEstimada.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
      });
      router.push(`/individuos/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const required =
    form.sitio && form.numeroFosa && form.codigoUF && form.numeroIndividuo;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/individuos" className="hover:text-ink hover:underline">
          Individuos
        </Link>
        <span className="px-2 text-faint">/</span>
        <Link href={`/individuos/${id}`} className="hover:text-ink hover:underline">
          {data.individuo.codigoCanonico}
        </Link>
        <span className="px-2 text-faint">/</span>
        <span className="text-ink">Editar</span>
      </nav>

      <header>
        <h1 className="font-serif text-3xl font-semibold text-ink">Editar individuo</h1>
        <p className="mt-1 text-sm text-muted">
          Corregí o completá los datos de identidad y el perfil biológico. El código
          canónico se regenera automáticamente. No afecta las fichas ni sus métricas.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-faint">
            Identidad
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Año de excavación">
              <input
                type="number"
                className="field"
                value={form.anioExcavacion}
                min={1900}
                max={2100}
                onChange={(e) => set("anioExcavacion", e.target.value)}
                required
              />
            </Field>
            <Field label="Sitio">
              <input
                type="text"
                className="field"
                value={form.sitio}
                onChange={(e) => set("sitio", e.target.value)}
                placeholder="Ej: Pozos de Caldera"
                required
              />
            </Field>
            <Field label="Número de fosa">
              <input
                type="text"
                className="field"
                value={form.numeroFosa}
                onChange={(e) => set("numeroFosa", e.target.value)}
                placeholder="Ej: 4"
                required
              />
            </Field>
            <Field label="Código de unidad funeraria (UF)">
              <input
                type="text"
                className="field"
                value={form.codigoUF}
                onChange={(e) => set("codigoUF", e.target.value)}
                placeholder="Ej: 3301"
                required
              />
            </Field>
            <Field label="Número de individuo">
              <input
                type="text"
                className="field"
                value={form.numeroIndividuo}
                onChange={(e) => set("numeroIndividuo", e.target.value)}
                placeholder="Ej: 1"
                required
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-faint">
            Perfil biológico (opcional)
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sexo estimado">
              <input
                type="text"
                className="field"
                value={form.sexoEstimado}
                onChange={(e) => set("sexoEstimado", e.target.value)}
                placeholder="M / F / Indet."
              />
            </Field>
            <Field label="Edad estimada">
              <input
                type="text"
                className="field"
                value={form.edadEstimada}
                onChange={(e) => set("edadEstimada", e.target.value)}
                placeholder="Ej: 30–40 años"
              />
            </Field>
          </div>
          <Field label="Observaciones">
            <textarea
              className="field resize-y"
              rows={3}
              value={form.observaciones}
              onChange={(e) => set("observaciones", e.target.value)}
            />
          </Field>
        </fieldset>

        {error && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Link href={`/individuos/${id}`} className="btn btn-ghost">
            Cancelar
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !required}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
