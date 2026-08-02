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

    // --- Versión del schema de datos de `data` (idempotencia de migraciones) ---
    // Contador global monotónico; la semántica se documenta por bump y cada
    // migración filtra además por `tipo`. Fuente de verdad de los shapes:
    //   Zonación → `lib/zonacionMigration.ts` · EAT → `lib/eatUnits.ts`.
    //
    //   ausente / 1 → shape original (2026-06 y anterior).
    //   2           → Zonación: corrección metodológica 2026-06
    //                 (sacro 20→4, mandíbula 14→7, rótula fuera del pie).
    //   3           → EAT: unidades anatómicas de mano/pie desdobladas
    //                 (2026-08, SDD-fidelidad-EAT-unidades-anatomicas):
    //                 pieX.tarsianos → calcaneo/astragalo/restoTarso y
    //                 manoX.falProxMedias → falProximales/falMedias.
    //                 Las fichas de Zonación se quedan en 2 (no se tocan).
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
