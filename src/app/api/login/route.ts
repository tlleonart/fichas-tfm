import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  if (process.env.APP_PASSWORD && password === process.env.APP_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("osteo_auth", process.env.AUTH_TOKEN ?? "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }

  return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
}
