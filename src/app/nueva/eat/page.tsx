"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const EATForm = dynamic(() => import("@/components/EATForm"), { ssr: false });

export default function NuevaEATPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/fichas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, tipo: "eat" }),
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
      <h1 className="text-2xl font-bold text-red-700">Nueva Ficha — Estado de Afectación Tafonómica</h1>
      <p className="text-sm text-gray-500">Serrulla &amp; Vázquez (2019)</p>
      <EATForm onSave={handleSave} saving={saving} />
    </div>
  );
}
