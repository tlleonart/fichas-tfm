/**
 * Resolve hook: `./eatUnits` → `./eatUnits.ts` (ver `tests/register-ts.mjs`).
 * Actúa sobre:
 *   - especificadores RELATIVOS sin extensión (módulos de `convex/`), y
 *   - los ALIAS del `tsconfig.json` del repo: `@convex/*` → `convex/*` y
 *     `@/*` → `src/*`, para poder testear los módulos del front (que usan el
 *     alias por convención) con el mismo runner de Node, sin bundler.
 * Todo lo demás pasa derecho al resolver por defecto.
 */

const CON_EXTENSION = /\.(m|c)?(j|t)sx?$/;

/** Raíz del repo, derivada de la ubicación de este hook (`<repo>/tests/`). */
const CONVEX_DIR = new URL("../convex/", import.meta.url);
const SRC_DIR = new URL("../src/", import.meta.url);

const ALIASES = [
  ["@convex/", CONVEX_DIR],
  ["@/", SRC_DIR],
];

export async function resolve(specifier, context, nextResolve) {
  for (const [prefix, base] of ALIASES) {
    if (specifier.startsWith(prefix)) {
      const target = new URL(specifier.slice(prefix.length), base).href;
      if (!CON_EXTENSION.test(target)) {
        try {
          return await nextResolve(`${target}.ts`, context);
        } catch {
          // No es un `.ts`: que resuelva (o falle) con el especificador mapeado.
        }
      }
      return nextResolve(target, context);
    }
  }

  if (specifier.startsWith(".") && !CON_EXTENSION.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // No es un .ts: que falle (o resuelva) con el especificador original.
    }
  }
  return nextResolve(specifier, context);
}
