"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar esta ficha? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    await fetch(`/api/fichas/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-red-600 hover:underline text-xs font-medium disabled:opacity-50"
    >
      {deleting ? "..." : "Eliminar"}
    </button>
  );
}
