/**
 * Arrastre de las claves retiradas de la ficha de Zonación (2026-09-09).
 * =====================================================================
 * Martina pidió sacar de la ficha tres bloques que nunca usó: "Fragmentos no
 * identificables", "Análisis de fractura (FFI)" y "Alteraciones tafonómicas"
 * (que incluye el grado de meteorización y su observación). Salen de la UI;
 * **en la base no se borra nada**.
 *
 * ⚠️ POR QUÉ ESTE MÓDULO EXISTE — `fichas.actualizar` **reemplaza `data`
 * entera**. Si el formulario dejara de emitir esas claves, la primera vez que
 * alguien reguarde una ficha que sí las tiene cargadas el dato se perdería en
 * silencio. Sobre las 62 fichas de producción hay **2 con `taphonomy`** (y su
 * `taphonomy_obs`). Por eso el form arrastra las claves heredadas tal como
 * vinieron, y por eso esto vive en un módulo puro y testeado
 * (`tests/ficha-legacy.test.mjs`): es la única pieza del cambio que puede
 * destruir datos.
 *
 * Ver `SDD-limpieza-y-acceso-lector-2026-09-09.md` §3.1 y §7.5.
 */

/** Claves que el formulario ya no captura pero que siguen viviendo en `data`. */
export const CLAVES_RETIRADAS = [
  "fragments",
  "ffi_rows",
  "taphonomy",
  "weathering_degree",
  "taphonomy_obs",
] as const;

export type ClaveRetirada = (typeof CLAVES_RETIRADAS)[number];

/**
 * Devuelve las claves retiradas que la ficha guardada ya traía, tal cual.
 *
 * - Una clave ausente (`undefined`) NO se inventa: el objeto resultante no la
 *   incluye, así una ficha nueva no nace con basura.
 * - Un valor "vacío pero registrado" (`""`, `{}`, `[]`, `null`) SÍ se conserva:
 *   la distinción entre "no registrado" y "registrado vacío" es del método.
 *
 * El resultado va **primero** en el spread del `data` que arma el formulario,
 * para que ninguna clave viva pueda ser pisada por una heredada.
 */
export function clavesHeredadas(
  initialData?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!initialData) return {};
  const out: Record<string, unknown> = {};
  for (const k of CLAVES_RETIRADAS) {
    if (initialData[k] !== undefined) out[k] = initialData[k];
  }
  return out;
}
