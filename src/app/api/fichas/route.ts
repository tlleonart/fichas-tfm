import { NextResponse } from "next/server";
import { getFichas, createFicha } from "@/lib/db";

export async function GET() {
  try {
    const fichas = await getFichas();
    return NextResponse.json(fichas);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ficha = await createFicha(body);
    return NextResponse.json(ficha, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
