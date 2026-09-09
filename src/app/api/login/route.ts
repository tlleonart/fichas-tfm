import { NextResponse } from "next/server";
import { lectorHabilitado, tokensDeEntorno } from "@/lib/rol";

/**
 * Login de contraseña única por rol. Se compara primero contra `APP_PASSWORD`
 * (editor) y después contra `VIEWER_PASSWORD` (lector, correctores del TFM).
 * La respuesta es idéntica en los dos casos: no se filtra qué rol se obtuvo.
 */
function sesion(token: string) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("osteo_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  return res;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  const cfg = tokensDeEntorno();

  if (process.env.APP_PASSWORD && password === process.env.APP_PASSWORD) {
    return sesion(cfg.authToken ?? "");
  }

  // El rol lector solo existe si su configuración está completa y es distinta
  // de la del editor (guarda dura de `@/lib/rol`).
  if (
    process.env.VIEWER_PASSWORD &&
    password === process.env.VIEWER_PASSWORD &&
    password !== process.env.APP_PASSWORD &&
    lectorHabilitado(cfg)
  ) {
    return sesion(cfg.viewerToken ?? "");
  }

  return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
}
