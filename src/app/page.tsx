import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-gray-900">Fichas de Registro Osteológico</h1>
        <p className="mt-2 text-gray-600">Seleccioná el tipo de ficha que querés completar</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Link
          href="/nueva/zonacion"
          className="block border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:shadow-lg transition-all group"
        >
          <div className="text-center space-y-3">
            <div className="text-4xl">🦴</div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600">
              Método de Zonación
            </h2>
            <p className="text-sm text-gray-500">Knüsel &amp; Outram (2004)</p>
            <p className="text-sm text-gray-600">
              Registro de zonas anatómicas presentes por elemento óseo. Cálculo de % de completitud. Análisis de fractura (FFI).
            </p>
            <span className="inline-block mt-2 text-sm font-medium text-blue-600 group-hover:text-blue-700">
              Crear ficha →
            </span>
          </div>
        </Link>

        <Link
          href="/nueva/eat"
          className="block border-2 border-gray-200 rounded-xl p-6 hover:border-red-500 hover:shadow-lg transition-all group"
        >
          <div className="text-center space-y-3">
            <div className="text-4xl">📊</div>
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-red-600">
              Estado de Afectación Tafonómica
            </h2>
            <p className="text-sm text-gray-500">Serrulla &amp; Vázquez (2019)</p>
            <p className="text-sm text-gray-600">
              Índice de Preservación Ósea + Calidad del Hueso. Cálculo cuantitativo del EAT.
            </p>
            <span className="inline-block mt-2 text-sm font-medium text-red-600 group-hover:text-red-700">
              Crear ficha →
            </span>
          </div>
        </Link>
      </div>

      <div className="text-center">
        <Link href="/fichas" className="inline-block bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition">
          Ver fichas guardadas
        </Link>
      </div>
    </div>
  );
}
