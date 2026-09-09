import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decidirAcceso } from "@/lib/rol";

/**
 * Puerta de acceso por contraseña (convención "proxy" de Next 16, ex middleware).
 *
 * Dos roles (SDD limpieza-y-acceso-lector §4): **editor** (Martina, la cookie
 * vale `AUTH_TOKEN`) ve todo; **lector** (correctores del TFM, la cookie vale
 * `VIEWER_TOKEN`) solo la allowlist de solo lectura. Sin cookie válida → /login.
 * El valor de la cookie tiene que ser igual a un secreto de servidor, así que no
 * se puede falsificar desde el cliente.
 *
 * El bloqueo del lector es **deny-by-default en el servidor**: no alcanza con
 * esconder links, la ruta ni se renderiza. La matriz completa y la única
 * allowlist viven en `@/lib/rol` (`decidirAcceso`), que está testeada.
 *
 * NOTA: esta puerta protege la UI de Next. La URL del deployment de Convex es
 * pública y las funciones no tienen auth propia; eso exige Convex Auth (fuera de
 * alcance, ver `@/lib/rol`).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("osteo_auth")?.value;

  const decision = decidirAcceso(pathname, token);
  if (decision.accion === "permitir") return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = decision.destino;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except the auth APIs, Next internals and static assets.
  matcher: ["/((?!api/login|api/logout|_next/static|_next/image|favicon.ico).*)"],
};
