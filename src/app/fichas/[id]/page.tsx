import { getFicha } from "@/lib/db";
import { notFound } from "next/navigation";
import EditFichaClient from "./EditFichaClient";

export const dynamic = "force-dynamic";

export default async function FichaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ficha = await getFicha(Number(id));
  if (!ficha) notFound();

  return <EditFichaClient ficha={JSON.parse(JSON.stringify(ficha))} />;
}
