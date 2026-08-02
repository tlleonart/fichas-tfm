/**
 * EAT — camino de ESCRITURA de una ficha (normalizar → validar → recalcular).
 * ==========================================================================
 * SDD: `SDD-fidelidad-EAT-unidades-anatomicas.md` §3.2/§3.3 · handoff §4.3
 *
 * Módulo PURO (sin imports de `convex/server`), para que la composición exacta
 * que corren las mutations se pueda testear offline. `fichas.crear` y
 * `fichas.actualizar` no hacen nada más que llamar a esto y escribir el resultado.
 *
 * 🔒 Invariante #2 del proyecto: **las métricas las recalcula SIEMPRE el backend
 * al guardar.** `lib/metrics.ts` es la única fuente de verdad; los previews del
 * formulario (`data._computed`) solo muestran, y acá se sobreescriben con el
 * cálculo autoritativo si venían en el payload.
 *
 * El ORDEN importa:
 *   1. `normalizeEatUnits` → shape granular v3 (deriva las claves nuevas si faltan
 *      y reescribe los espejos legacy). Sin esto, la partición estricta de
 *      `computeEAT` leería `falProximales`/`calcaneo` inexistentes y puntuaría bajo.
 *   2. `validateEatUnits`  → rechazo con error legible (en `schema.ts` `data` es
 *      `v.any()`: no hay validación de tipos posible ahí).
 *   3. `computeEAT`        → métricas persistidas.
 */

import { computeEAT, type EATMetrics } from "./metrics";
import { EAT_SCHEMA_VERSION, normalizeEatUnits, validateEatUnits } from "./eatUnits";

export interface EatWriteResult {
  /** `data` normalizado, listo para persistir (incluye `data.eatDerivation`). */
  data: Record<string, unknown>;
  /** Métricas recalculadas por el backend. */
  metricas: EATMetrics;
  /** Siempre `EAT_SCHEMA_VERSION`: toda escritura deja la ficha en el shape vigente. */
  schemaVersion: number;
}

/**
 * Prepara una ficha EAT para escribirse. Lanza si el inventario está fuera de
 * contrato (rango, tipo o espejo legacy inconsistente).
 *
 * @param rawData      `data` que manda el cliente (`EATForm`).
 * @param now          timestamp (inyectado: mantiene la función testeable).
 * @param previousData ⚠️ **OBLIGATORIO en `actualizar`**: el `ficha.data` ya
 *   persistido. `EATForm` reconstruye el payload desde cero y NO devuelve
 *   `data.eatDerivation`; sin este argumento, cada edición borraría la traza de
 *   derivación y la ficha se caería del análisis de sensibilidad (handoff §4.3).
 *   En `crear` no se pasa (no hay nada previo que rescatar).
 */
export function prepararEscrituraEat(
  rawData: unknown,
  now: number,
  previousData?: unknown,
): EatWriteResult {
  const { data } = normalizeEatUnits(rawData ?? {}, now, previousData);

  const issues = validateEatUnits(data);
  if (issues.length > 0) {
    const detalle = issues
      .map((i) => `${i.side}.${i.key}=${String(i.value)} (${i.problem}, esperado ${i.expected})`)
      .join("; ");
    throw new Error(`Inventario EAT inválido: ${detalle}`);
  }

  const metricas = computeEAT(data);

  // El preview del formulario queda dentro de `data` y duplica `metricas`. Se
  // refresca (nunca se crea) para no persistir un número obsoleto al lado del
  // autoritativo. Debería dejar de escribirse desde el front — ítem de limpieza.
  if (data._computed && typeof data._computed === "object") {
    data._computed = {
      ...(data._computed as Record<string, unknown>),
      IPO: metricas.ipo,
      ICH: metricas.ich,
      EAT: metricas.eat,
      totalPresent: metricas.totalPresent,
    };
  }

  return { data, metricas, schemaVersion: EAT_SCHEMA_VERSION };
}
