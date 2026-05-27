"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ficha } from "@/lib/types";
import dynamic from "next/dynamic";
import ExportPDF from "@/components/ExportPDF";

const ZonacionForm = dynamic(() => import("@/components/ZonacionForm"), { ssr: false });
const EATForm = dynamic(() => import("@/components/EATForm"), { ssr: false });

export default function EditFichaClient({ ficha }: { ficha: Ficha }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/fichas/${ficha.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Error al guardar (HTTP ${res.status})`);
      }
      alert("Ficha actualizada correctamente");
      router.refresh();
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  }

  const initialData = {
    individuo: ficha.individuo,
    proyecto: ficha.proyecto,
    registrador: ficha.registrador,
    fecha_registro: ficha.fecha_registro?.toString().slice(0, 10) ?? "",
    ...(ficha.data as Record<string, unknown>),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Ficha #{ficha.id} —{" "}
            <span className={ficha.tipo === "zonacion" ? "text-blue-600" : "text-red-600"}>
              {ficha.tipo === "zonacion" ? "Zonación" : "EAT"}
            </span>
          </h1>
          <p className="text-sm text-gray-500">
            Creada: {new Date(ficha.created_at).toLocaleDateString("es")} | Última edición: {new Date(ficha.updated_at).toLocaleDateString("es")}
          </p>
        </div>
        <ExportPDF targetId="ficha-content" filename={`ficha-${ficha.id}-${ficha.tipo}.pdf`} />
      </div>

      <div id="ficha-content">
        {ficha.tipo === "zonacion" ? (
          <ZonacionForm initialData={initialData} onSave={handleSave} saving={saving} />
        ) : (
          <EATForm initialData={initialData} onSave={handleSave} saving={saving} />
        )}
      </div>
    </div>
  );
}
