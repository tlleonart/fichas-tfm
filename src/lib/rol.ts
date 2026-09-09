/**
 * Roles de acceso — editor (Martina) y lector (correctores del TFM).
 * ==================================================================
 * Server-only: se usa en `src/proxy.ts`, en el `layout.tsx` (server component)
 * y en la API de login. El valor de los tokens NUNCA cruza al cliente; lo único
 * que baja al árbol de React es la cadena `"editor"` / `"lector"`.
 *
 * Dos contraseñas, dos tokens:
 *   APP_PASSWORD    → AUTH_TOKEN    → rol "editor" (todo, como hasta hoy)
 *   VIEWER_PASSWORD → VIEWER_TOKEN  → rol "lector" (allowlist de solo lectura)
 *
 * 🔒 Guarda dura: si `VIEWER_TOKEN` está vacío o es IGUAL a `AUTH_TOKEN`, el rol
 * lector queda deshabilitado y nunca se resuelve. Una configuración a medias no
 * puede terminar dando permisos de editor a un corrector.
 *
 * ⚠️ Límite conocido (D8 del proyecto, riesgo ya aceptado): el bloqueo es a
 * nivel de aplicación. `NEXT_PUBLIC_CONVEX_URL` viaja en el bundle y las
 * funciones de Convex no tienen autenticación propia. Cerrarlo de verdad exige
 * Convex Auth, que está en el roadmap y fuera de este alcance.
 *
 * Las funciones de decisión son PURAS y aceptan la configuración por parámetro
 * para poder testearlas (`tests/rol-proxy.test.mjs`).
 */

export type Rol = "editor" | "lector";

export interface TokensConfig {
  authToken?: string;
  viewerToken?: string;
}

/** Lee los secretos del entorno del servidor. */
export function tokensDeEntorno(): TokensConfig {
  return {
    authToken: process.env.AUTH_TOKEN,
    viewerToken: process.env.VIEWER_TOKEN,
  };
}

/** ¿Está habilitado el rol lector con esta configuración? */
export function lectorHabilitado(cfg: TokensConfig): boolean {
  const { authToken, viewerToken } = cfg;
  if (!viewerToken) return false;
  // Un VIEWER_TOKEN igual al AUTH_TOKEN convertiría al corrector en editor.
  if (viewerToken === authToken) return false;
  return true;
}

/** Rol que corresponde a un valor de cookie, con la configuración dada. */
export function rolDesdeTokens(
  token: string | undefined,
  cfg: TokensConfig,
): Rol | null {
  if (!token) return null;
  if (cfg.authToken && token === cfg.authToken) return "editor";
  if (lectorHabilitado(cfg) && token === cfg.viewerToken) return "lector";
  return null;
}

/** Rol que corresponde a un valor de cookie, leyendo el entorno. */
export function rolDesdeToken(token: string | undefined): Rol | null {
  return rolDesdeTokens(token, tokensDeEntorno());
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Ruteo por rol — allowlist deny-by-default para el lector                   */
/* ══════════════════════════════════════════════════════════════════════════ */

/** Rutas accesibles sin sesión. */
const PUBLICAS = new Set(["/login", "/api/login", "/api/logout", "/robots.txt"]);

/** Rutas exactas que el lector puede ver. */
const LECTOR_EXACTAS = new Set([
  "/",
  "/individuos",
  "/datos",
  "/cobertura",
  "/planilla",
]);

/**
 * Rutas de individuo que el lector puede ver: la ficha consolidada y su
 * documento imprimible (D-C: la "ficha completa" del corrector).
 */
const LECTOR_PATRONES = [
  /^\/individuos\/[^/]+$/,
  /^\/individuos\/[^/]+\/documento$/,
];

/**
 * Sub-rutas de `/individuos/...` denegadas SIEMPRE al lector. Se evalúan
 * ANTES que `LECTOR_PATRONES`, porque `/individuos/nuevo` matchea
 * `^/individuos/[^/]+$` y se colaría por ahí.
 */
const LECTOR_DENEGADAS = new Set(["/individuos/nuevo"]);

export function rutaPublica(pathname: string): boolean {
  return PUBLICAS.has(pathname);
}

/**
 * Allowlist del lector. Todo lo que no esté acá queda denegado por defecto:
 * `/analisis`, `/docs`, `/dev/*`, `/individuos/<id>/editar|zonacion|eat` y
 * cualquier ruta futura. La lista blanca es la única puerta.
 */
export function lectorPuedeVer(pathname: string): boolean {
  if (LECTOR_DENEGADAS.has(pathname)) return false;
  if (LECTOR_EXACTAS.has(pathname)) return true;
  return LECTOR_PATRONES.some((re) => re.test(pathname));
}

export type Decision =
  | { accion: "permitir" }
  | { accion: "redirigir"; destino: "/login" | "/individuos" };

/**
 * Decisión de acceso para una request. Pura: no toca `NextRequest` ni el
 * entorno si se le pasa la configuración.
 *
 *   pública          → permitir
 *   sin rol          → /login
 *   editor           → permitir (comportamiento histórico, sin cambios)
 *   lector permitido → permitir
 *   lector, resto    → /individuos
 */
export function decidirAcceso(
  pathname: string,
  token: string | undefined,
  cfg: TokensConfig = tokensDeEntorno(),
): Decision {
  if (rutaPublica(pathname)) return { accion: "permitir" };

  const rol = rolDesdeTokens(token, cfg);
  if (rol === null) return { accion: "redirigir", destino: "/login" };
  if (rol === "editor") return { accion: "permitir" };

  return lectorPuedeVer(pathname)
    ? { accion: "permitir" }
    : { accion: "redirigir", destino: "/individuos" };
}
