import { NextResponse } from "next/server";
import { getFicha, updateFicha, deleteFicha } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ficha = await getFicha(Number(id));
    if (!ficha) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(ficha);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const ficha = await updateFicha(Number(id), body);
    if (!ficha) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(ficha);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ok = await deleteFicha(Number(id));
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
