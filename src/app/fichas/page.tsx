import Link from "next/link";
import { getFichas } from "@/lib/db";
import DeleteButton from "./DeleteButton";

export const dynamic = "force-dynamic";

export default async function FichasPage() {
  let fichas: Awaited<ReturnType<typeof getFichas>> = [];
  let error = "";
  try {
    fichas = await getFichas();
  } catch (e) {
    error = String(e);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fichas Guardadas</h1>
        <div className="flex gap-2">
          <Link href="/nueva/zonacion" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition">
            + Zonación
          </Link>
          <Link href="/nueva/eat" className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition">
            + EAT
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          No se pudo conectar a la base de datos. Asegurate de configurar POSTGRES_URL en tus variables de entorno.
          <details className="mt-2"><summary className="cursor-pointer">Detalle</summary><pre className="mt-1 text-xs">{error}</pre></details>
        </div>
      )}

      {fichas.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500">
          No hay fichas guardadas todavía. Creá una nueva para empezar.
        </div>
      )}

      {fichas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2 font-semibold">ID</th>
                <th className="px-4 py-2 font-semibold">Tipo</th>
                <th className="px-4 py-2 font-semibold">Individuo</th>
                <th className="px-4 py-2 font-semibold">Proyecto</th>
                <th className="px-4 py-2 font-semibold">Registrador</th>
                <th className="px-4 py-2 font-semibold">Fecha</th>
                <th className="px-4 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {fichas.map((f) => (
                <tr key={f.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{f.id}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      f.tipo === "zonacion" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
                    }`}>
                      {f.tipo === "zonacion" ? "Zonación" : "EAT"}
                    </span>
                  </td>
                  <td className="px-4 py-2">{f.individuo || "—"}</td>
                  <td className="px-4 py-2">{f.proyecto || "—"}</td>
                  <td className="px-4 py-2">{f.registrador || "—"}</td>
                  <td className="px-4 py-2 text-xs">{f.fecha_registro?.toString().slice(0, 10) || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Link href={`/fichas/${f.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                        Ver/Editar
                      </Link>
                      <DeleteButton id={f.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
