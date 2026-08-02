import fs from "node:fs";
import path from "node:path";

/**
 * Entorno de los E2E. Se lee acá (y no en cada spec) porque Playwright carga la
 * config y los módulos compartidos tanto en el proceso principal como en cada
 * worker.
 */

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3311);
/**
 * `localhost` y no `127.0.0.1`: Next 16 bloquea por defecto los recursos de dev
 * (HMR) pedidos desde otro origen, y con el HMR caído la página no hidrata → los
 * `onClick` de React nunca se enganchan y el E2E clickea al vacío.
 */
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** Parser mínimo de `.env.local` (el repo no tiene dotenv). */
function readEnvLocal(): Record<string, string> {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const envLocal = readEnvLocal();

/**
 * Cookie del gate de contraseña única (`src/proxy.ts` redirige todo a `/login`
 * sin ella). Se toma del `.env.local` local; nunca se imprime.
 */
export const AUTH_TOKEN = process.env.AUTH_TOKEN ?? envLocal.AUTH_TOKEN ?? "";

/**
 * 🔒 URL de Convex para el server de pruebas. El `.env.local` apunta a
 * **PRODUCCIÓN** (`vibrant-otter-229`, datos reales de la tesis); acá se fuerza el
 * deployment de desarrollo, que está VACÍO. El banco de pruebas del formulario no
 * hace ninguna llamada a Convex, así que esto es solo el segundo cinturón.
 */
export const E2E_CONVEX_URL = "https://marvelous-marten-374.convex.cloud";
