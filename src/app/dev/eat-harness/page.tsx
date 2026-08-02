import { notFound } from "next/navigation";

import EatHarnessClient from "./EatHarnessClient";

/**
 * Banco de pruebas del `EATForm` (solo para los E2E de Playwright).
 * ================================================================
 * 🔒 **Por qué existe.** El `.env.local` de este repo apunta al deployment de
 * **PRODUCCIÓN** (`vibrant-otter-229`), que tiene los datos reales de la tesis.
 * Verificar el formulario contra `/individuos/<id>/eat` implicaría leer y —al
 * probar el guardado— **escribir sobre fichas reales**. Esta página monta el mismo
 * `EATForm` con fixtures en memoria y un "guardar" que NO habla con Convex: el
 * E2E corre de punta a punta en el navegador con cero riesgo para los datos.
 *
 * Solo se renderiza con `NEXT_PUBLIC_EAT_HARNESS=1` (lo setea `playwright.config.ts`).
 * En cualquier despliegue normal la ruta devuelve 404.
 */
export const dynamic = "force-dynamic";

export default function EatHarnessPage() {
  if (process.env.NEXT_PUBLIC_EAT_HARNESS !== "1") notFound();
  return <EatHarnessClient />;
}
