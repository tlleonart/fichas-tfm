/**
 * Resolve hook: `./eatUnits` → `./eatUnits.ts` (ver `tests/register-ts.mjs`).
 * Solo actúa sobre especificadores RELATIVOS sin extensión; todo lo demás pasa
 * derecho al resolver por defecto.
 */

const CON_EXTENSION = /\.(m|c)?(j|t)sx?$/;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !CON_EXTENSION.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // No es un .ts: que falle (o resuelva) con el especificador original.
    }
  }
  return nextResolve(specifier, context);
}
