"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError("Contraseña incorrecta");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-sm p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Acceso
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">
          Registro Osteológico
        </h1>
        {/* Copy neutro a propósito: no se menciona que hay más de una clave. */}
        <p className="mt-1 text-sm text-muted">Ingresá tu contraseña para continuar.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">Contraseña</span>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
