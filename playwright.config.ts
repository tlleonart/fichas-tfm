import { defineConfig, devices } from "@playwright/test";

import { AUTH_TOKEN, E2E_BASE_URL, E2E_CONVEX_URL, E2E_PORT } from "./e2e/env";

/**
 * E2E del formulario (Playwright).
 *
 * 🔒 Los tests corren contra `next dev` local con `NEXT_PUBLIC_EAT_HARNESS=1`, que
 * habilita `/dev/eat-harness`: el `EATForm` real, con fixtures en memoria y sin
 * ninguna llamada a Convex. El `.env.local` del repo apunta a PRODUCCIÓN, así que
 * ningún E2E escribe (ni lee) fichas reales.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "e2e/.report", open: "never" }]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // Tablet portrait: el escenario real de carga con el material a la vista
      // (SDD-ux-carga-rapida F3). Chromium, que es el navegador instalado.
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_EAT_HARNESS: "1",
      NEXT_PUBLIC_CONVEX_URL: E2E_CONVEX_URL,
      // Solo si se pudo leer: un string vacío rompería el gate de `/login`.
      ...(AUTH_TOKEN ? { AUTH_TOKEN } : {}),
    },
  },
});
