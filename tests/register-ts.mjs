/**
 * Hook de resolución para correr los módulos de `convex/` fuera de Convex.
 * ======================================================================
 * Los módulos de `convex/` usan imports SIN extensión (`import ... from
 * "./eatUnits"`), que es lo que exige el bundler de Convex (esbuild) y la
 * convención del repo. Node en ESM, en cambio, exige la extensión explícita.
 *
 * Este hook agrega `.ts` a los especificadores relativos sin extensión, así los
 * tests unitarios pueden importar `convex/lib/*.ts` tal cual, sin tocar el código
 * de producción ni agregar un bundler al proyecto.
 *
 * Uso:
 *   node --experimental-strip-types --import ./tests/register-ts.mjs --test "tests/*.test.mjs"
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./resolve-ts.mjs", pathToFileURL("./tests/"));
