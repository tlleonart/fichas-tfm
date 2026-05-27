"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const ZonacionForm = dynamic(() => import("@/components/ZonacionForm"), { ssr: false });

export default function NuevaZonacionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/fichas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, tipo: "zonacion" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Error al guardar (HTTP ${res.status})`);
      alert("Ficha creada correctamente");
      router.push(`/fichas/${body.id}`);
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-blue-700">Nueva Ficha — Método de Zonación</h1>
      <p className="text-sm text-gray-500">Knüsel &amp; Outram (2004)</p>
      <ZonacionForm onSave={handleSave} saving={saving} />
    </div>
  );
}
