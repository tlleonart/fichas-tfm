/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analisis from "../analisis.js";
import type * as cobertura from "../cobertura.js";
import type * as fichas from "../fichas.js";
import type * as individuos from "../individuos.js";
import type * as lib_metrics from "../lib/metrics.js";
import type * as lib_zonacionMigration from "../lib/zonacionMigration.js";
import type * as migrations_zonacion_2026_06 from "../migrations/zonacion_2026_06.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analisis: typeof analisis;
  cobertura: typeof cobertura;
  fichas: typeof fichas;
  individuos: typeof individuos;
  "lib/metrics": typeof lib_metrics;
  "lib/zonacionMigration": typeof lib_zonacionMigration;
  "migrations/zonacion_2026_06": typeof migrations_zonacion_2026_06;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
