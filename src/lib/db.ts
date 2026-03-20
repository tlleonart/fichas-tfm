import { sql } from "@vercel/postgres";
import { Ficha, FichaInput } from "./types";

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS fichas (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL,
      individuo VARCHAR(100),
      proyecto VARCHAR(200),
      registrador VARCHAR(100),
      fecha_registro DATE,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

export async function getFichas(): Promise<Ficha[]> {
  await initDB();
  const { rows } = await sql`
    SELECT id, tipo, individuo, proyecto, registrador, fecha_registro, created_at, updated_at
    FROM fichas ORDER BY updated_at DESC
  `;
  return rows as Ficha[];
}

export async function getFicha(id: number): Promise<Ficha | null> {
  await initDB();
  const { rows } = await sql`
    SELECT * FROM fichas WHERE id = ${id}
  `;
  return (rows[0] as Ficha) ?? null;
}

export async function createFicha(input: FichaInput): Promise<Ficha> {
  await initDB();
  const { rows } = await sql`
    INSERT INTO fichas (tipo, individuo, proyecto, registrador, fecha_registro, data)
    VALUES (${input.tipo}, ${input.individuo}, ${input.proyecto}, ${input.registrador}, ${input.fecha_registro}, ${JSON.stringify(input.data)})
    RETURNING *
  `;
  return rows[0] as Ficha;
}

export async function updateFicha(id: number, input: FichaInput): Promise<Ficha | null> {
  await initDB();
  const { rows } = await sql`
    UPDATE fichas SET
      tipo = ${input.tipo},
      individuo = ${input.individuo},
      proyecto = ${input.proyecto},
      registrador = ${input.registrador},
      fecha_registro = ${input.fecha_registro},
      data = ${JSON.stringify(input.data)},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as Ficha) ?? null;
}

export async function deleteFicha(id: number): Promise<boolean> {
  await initDB();
  const { rowCount } = await sql`DELETE FROM fichas WHERE id = ${id}`;
  return (rowCount ?? 0) > 0;
}
