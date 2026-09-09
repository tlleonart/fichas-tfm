"use client";

import { createContext, useContext } from "react";
import type { Rol } from "@/lib/rol";

/**
 * Rol de la sesión, resuelto en el servidor (`layout.tsx`) y bajado al árbol de
 * cliente. Solo viaja la cadena "editor" / "lector": el token NUNCA cruza.
 *
 * Es un ayudante de UI (esconder lo que el lector no puede usar). El bloqueo de
 * verdad es el de `src/proxy.ts`, en el servidor.
 */
const RolContext = createContext<Rol | null>(null);

export default function RolProvider({
  rol,
  children,
}: {
  rol: Rol | null;
  children: React.ReactNode;
}) {
  return <RolContext.Provider value={rol}>{children}</RolContext.Provider>;
}

export function useRol(): Rol | null {
  return useContext(RolContext);
}

/** Atajo: ¿la sesión puede escribir (crear, editar, eliminar)? */
export function useEsEditor(): boolean {
  return useContext(RolContext) === "editor";
}
