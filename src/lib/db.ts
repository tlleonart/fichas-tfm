import { Pool } from "pg";
import { Ficha, FichaInput } from "./types";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let initialized = false;

async function initDB() {
  if (initialized) return;
  await pool.query(`
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
  `);
  initialized = true;
}

export async function getFichas(): Promise<Ficha[]> {
  await initDB();
  const { rows } = await pool.query(
    `SELECT id, tipo, individuo, proyecto, registrador, fecha_registro, created_at, updated_at
     FROM fichas ORDER BY updated_at DESC`
  );
  return rows as Ficha[];
}

export async function getFicha(id: number): Promise<Ficha | null> {
  await initDB();
  const { rows } = await pool.query(
    `SELECT * FROM fichas WHERE id = $1`,
    [id]
  );
  return (rows[0] as Ficha) ?? null;
}

export async function createFicha(input: FichaInput): Promise<Ficha> {
  await initDB();
  const { rows } = await pool.query(
    `INSERT INTO fichas (tipo, individuo, proyecto, registrador, fecha_registro, data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.tipo, input.individuo, input.proyecto, input.registrador, input.fecha_registro || null, JSON.stringify(input.data)]
  );
  return rows[0] as Ficha;
}

export async function updateFicha(id: number, input: FichaInput): Promise<Ficha | null> {
  await initDB();
  const { rows } = await pool.query(
    `UPDATE fichas SET
       tipo = $1, individuo = $2, proyecto = $3, registrador = $4,
       fecha_registro = $5, data = $6, updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [input.tipo, input.individuo, input.proyecto, input.registrador, input.fecha_registro || null, JSON.stringify(input.data), id]
  );
  return (rows[0] as Ficha) ?? null;
}

export async function deleteFicha(id: number): Promise<boolean> {
  await initDB();
  const { rowCount } = await pool.query(
    `DELETE FROM fichas WHERE id = $1`,
    [id]
  );
  return (rowCount ?? 0) > 0;
}
