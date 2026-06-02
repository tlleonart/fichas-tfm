"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import ExportPDF from "@/components/ExportPDF";

const EATForm = dynamic(() => import("@/components/EATForm"), { ssr: false });

export default function EATFichaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"individuos">;
  const data = useQuery(api.individuos.obtener, { id });
  const crear = useMutation(api.fichas.crear);
  const actualizar = useMutation(api.fichas.actualizar);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (data === undefined)
    return <div className="card p-10 text-center text-sm text-muted">Cargando…</div>;
  if (data === null)
    return <div className="card p-10 text-center text-sm text-muted">Individuo no encontrado.</div>;

  const { individuo, fichas } = data;
  const existing = fichas.find((f) => f.tipo === "eat");

  async function handleSave(payload: {
    registrador: string;
    fechaRegistro: string;
    data: Record<string, unknown>;
  }) {
    setError("");
    setSaving(true);
    try {
      if (existing) {
        await actualizar({ id: existing._id, ...payload });
      } else {
        await crear({ individuoId: id, tipo: "eat", ...payload });
      }
      router.push(`/individuos/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <nav className="text-sm text-muted">
        <Link href="/individuos" className="hover:text-ink hover:underline">Individuos</Link>
        <span className="px-2 text-faint">/</span>
        <Link href={`/individuos/${id}`} className="hover:text-ink hover:underline">
          {individuo.codigoCanonico}
        </Link>
        <span className="px-2 text-faint">/</span>
        <span className="text-ink">EAT</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            Ficha EAT
          </h1>
          <p className="text-sm text-faint">
            {individuo.codigoCanonico} · Serrulla &amp; Vázquez (2019)
          </p>
        </div>
        {existing && <ExportPDF targetId="ficha-content" filename={`eat-${individuo.codigoCanonico}.pdf`} />}
      </header>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div id="ficha-content">
        <EATForm
          initialData={existing?.data as Record<string, unknown> | undefined}
          registrador={existing?.registrador}
          fechaRegistro={existing?.fechaRegistro}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  );
}
