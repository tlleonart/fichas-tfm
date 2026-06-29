import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Modelo de datos — Fichas Osteológicas
 * --------------------------------------
 * Entidad canónica: `individuos`. Cada individuo se identifica de forma
 * estructurada (año · sitio · fosa · UF · nº individuo) y es la CLAVE que
 * permite cruzar los dos métodos (Zonación y EAT) del mismo sujeto.
 *
 * Regla de negocio (decisión de diseño): 1 ficha por método por individuo.
 * La unicidad de `codigoCanonico` y la regla "1 ficha por tipo" se validan
 * en las mutations (Convex no fuerza índices únicos por sí solo).
 */
export default defineSchema({
  individuos: defineTable({
    // --- Identidad estructurada ---
    anioExcavacion: v.number(),
    sitio: v.string(),
    numeroFosa: v.string(),
    codigoUF: v.string(),
    numeroIndividuo: v.string(),
    // Clave de deduplicación legible: "{sitio}-{anio}-F{fosa}-UF{uf}-I{ind}"
    codigoCanonico: v.string(),

    // --- Perfil biológico (canónico, covariables para análisis poblacional) ---
    sexoEstimado: v.optional(v.string()),
    edadEstimada: v.optional(v.string()),

    observaciones: v.optional(v.string()),
  })
    .index("by_codigo", ["codigoCanonico"])
    .index("by_sitio", ["sitio"])
    .index("by_uf", ["sitio", "codigoUF"]),

  fichas: defineTable({
    individuoId: v.id("individuos"), // <- vinculación al individuo canónico
    tipo: v.union(v.literal("zonacion"), v.literal("eat")),
    registrador: v.string(),
    fechaRegistro: v.string(),

    // Insumos crudos del método (lo que capturan los formularios hoy).
    // Estructura heterogénea por método -> se valida en la mutation.
    data: v.any(),

    // Métricas derivadas, calculadas AL GUARDAR para no recomputar en cada
    // análisis. EAT: { ipo, ich, eat, totalPresent }.
    // Zonación: { completitudGlobal, completitudPorElemento, mne, ffi, ... }.
    metricas: v.optional(v.any()),

    // --- Corrección metodológica de Zonación (aditivo, idempotencia) ---
    // Versión del schema de datos de la ficha. Idempotencia de la migración
    // 2026-06-zonacion: ausente/undefined o < 2 = sin migrar; = 2 = migrada.
    // Ronan setea = 2 al terminar de migrar cada ficha de zonación.
    schemaVersion: v.optional(v.number()),

    // Revisiones que Martina debe atender tras la corrección metodológica.
    // Render en UI (Johan): badge en /individuos + banner por revisión en el
    // detalle de la ficha. severidad "corregir" = rojo; "revisar" = ámbar.
    revisionesPendientes: v.optional(
      v.array(
        v.object({
          // Identificador estable de la revisión.
          codigo: v.string(), // "SACRO_COLAPSO" | "FUSION_FUERA_DE_EPIFISIS" | "MANDIBULA_REVISAR_NOTA"
          severidad: v.union(v.literal("corregir"), v.literal("revisar")),
          titulo: v.string(),
          instrucciones: v.string(), // texto claro para Martina, dentro de la ficha
          campos: v.array(v.string()), // claves de `data` afectadas
        }),
      ),
    ),
  })
    .index("by_individuo", ["individuoId"])
    .index("by_individuo_tipo", ["individuoId", "tipo"])
    .index("by_tipo", ["tipo"]),
});
