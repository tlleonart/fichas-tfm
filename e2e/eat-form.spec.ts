import { expect, test, type Locator, type Page } from "@playwright/test";

import { AUTH_TOKEN, E2E_BASE_URL } from "./env";

/**
 * EAT — captura por unidad anatómica (Serrulla & Vázquez 2019).
 * ============================================================
 * Verificación end-to-end del `EATForm` en el navegador, sobre `/dev/eat-harness`
 * (el form real, fixtures en memoria, cero llamadas a Convex — ver el header de
 * `src/app/dev/eat-harness/page.tsx`: el `.env.local` del repo apunta a PROD).
 *
 * Casos de aceptación (handoff §5):
 *   1. mano con los 5 inputs al máximo → 4,00 pts
 *   2. pie con los 7 inputs al máximo  → 5,00 pts
 *   3. pie con SOLO calcáneo + astrágalo → 2,00 pts  ← caso testigo (antes 0,29)
 *   4. ficha SIN migrar: abre con los valores derivados, sin perder datos
 *   5. `quality.value = 0` sigue siendo `0` después de guardar y reabrir
 */

const MANO_COMPLETA: Record<string, string> = {
  carpianos: "8",
  metacarpianos: "5",
  falProximales: "5",
  falMedias: "4",
  falDistales: "5",
};

const PIE_SPINNERS_COMPLETO: Record<string, string> = {
  restoTarso: "5",
  metatarsianos: "5",
  falProx: "5",
  falMedias: "4",
  falDistales: "5",
};

async function abrirHarness(page: Page) {
  await page.context().addCookies([
    { name: "osteo_auth", value: AUTH_TOKEN, url: E2E_BASE_URL },
  ]);
  await page.goto("/dev/eat-harness");
  await expect(page.getByRole("heading", { name: /Banco de pruebas/ })).toBeVisible();
}

/** Idempotente: la sección del ICH abre desplegada y las de manos/pies cerradas. */
async function abrirSeccion(page: Page, id: "manos" | "pies" | "ich") {
  const probe =
    id === "ich"
      ? page.getByText("indique la calidad del hueso", { exact: false })
      : page.getByTestId(id === "manos" ? "mano-der-carpianos" : "pie-der-restoTarso");
  if (!(await probe.isVisible())) await page.getByTestId(`section-${id}`).click();
  await expect(probe).toBeVisible();
}

async function fill(page: Page, testId: string, value: string) {
  const input = page.getByTestId(testId);
  await input.fill(value);
  await expect(input).toHaveValue(value);
}

async function llenarMano(page: Page, side: "der" | "izq") {
  for (const [key, value] of Object.entries(MANO_COMPLETA)) {
    await fill(page, `mano-${side}-${key}`, value);
  }
}

async function llenarPie(page: Page, side: "der" | "izq") {
  await page.getByTestId(`pie-${side}-calcaneo`).check();
  await page.getByTestId(`pie-${side}-astragalo`).check();
  for (const [key, value] of Object.entries(PIE_SPINNERS_COMPLETO)) {
    await fill(page, `pie-${side}-${key}`, value);
  }
}

function shot(page: Locator | Page, name: string, project: string) {
  return page.screenshot({ path: `e2e/screenshots/${project}-${name}.png` });
}

test.describe("EAT — unidades anatómicas de mano y pie", () => {
  test("mano completa → 4,00 pts (5 inputs, 4 U.A., 27 huesos)", async ({ page }, info) => {
    await abrirHarness(page);
    await abrirSeccion(page, "manos");
    await llenarMano(page, "der");

    await expect(page.getByTestId("mano-der-pts")).toHaveText("4.00");
    await expect(page.getByTestId("mano-der-total")).toHaveText("27");
    // Punto por unidad: 8/8 · 5/5 · 5/5 · (4+5)/9
    for (const u of [1, 2, 3, 4]) {
      await expect(page.getByTestId(`mano-u${u}-pts`)).toContainText("D 1.00");
    }

    await llenarMano(page, "izq");
    await expect(page.getByTestId("mano-izq-pts")).toHaveText("4.00");
    await expect(page.getByTestId("section-manos")).toContainText("= 8.00 / 8 pts");

    await shot(page.getByTestId("section-manos").locator("xpath=.."), "mano-completa", info.project.name);
  });

  test("pie completo → 5,00 pts (7 inputs, 5 U.A., 26 huesos)", async ({ page }, info) => {
    await abrirHarness(page);
    await abrirSeccion(page, "pies");
    await llenarPie(page, "der");

    await expect(page.getByTestId("pie-der-pts")).toHaveText("5.00");
    await expect(page.getByTestId("pie-der-total")).toHaveText("26");
    // U.A.5: 14 falanges sobre denominador 10 (rareza de la fuente) → satura en 1,00
    await expect(page.getByTestId("pie-u5-pts")).toContainText("D 1.00");

    await llenarPie(page, "izq");
    await expect(page.getByTestId("pie-izq-pts")).toHaveText("5.00");
    await expect(page.getByTestId("section-pies")).toContainText("= 10.00 / 10 pts");

    await shot(page.getByTestId("section-pies").locator("xpath=.."), "pie-completo", info.project.name);
  });

  test("CASO TESTIGO: pie con solo calcáneo + astrágalo → 2,00 pts (antes 0,29)", async ({ page }, info) => {
    await abrirHarness(page);
    await abrirSeccion(page, "pies");

    await page.getByTestId("pie-der-calcaneo").check();
    await expect(page.getByTestId("pie-der-pts")).toHaveText("1.00");
    await page.getByTestId("pie-der-astragalo").check();

    await expect(page.getByTestId("pie-der-pts")).toHaveText("2.00");
    await expect(page.getByTestId("pie-der-total")).toHaveText("2");
    await expect(page.getByTestId("pie-u1-pts")).toContainText("D 1.00");
    await expect(page.getByTestId("pie-u2-pts")).toContainText("D 1.00");
    await expect(page.getByTestId("pie-u3-pts")).toContainText("D 0.00");

    await shot(page.getByTestId("section-pies").locator("xpath=.."), "caso-testigo-2pts", info.project.name);
  });

  test("ficha SIN migrar: abre con los valores derivados y no pierde datos", async ({ page }, info) => {
    await abrirHarness(page);
    await page.getByTestId("load-sin-migrar").click();
    await expect(page.getByTestId("fixture-actual")).toHaveText("sin-migrar");

    await abrirSeccion(page, "manos");
    // manoDer legacy: falProxMedias = 7 → proximales 5 + medias 2 (best-case)
    await expect(page.getByTestId("mano-der-carpianos")).toHaveValue("6");
    await expect(page.getByTestId("mano-der-metacarpianos")).toHaveValue("5");
    await expect(page.getByTestId("mano-der-falProximales")).toHaveValue("5");
    await expect(page.getByTestId("mano-der-falMedias")).toHaveValue("2");
    await expect(page.getByTestId("mano-der-falDistales")).toHaveValue("3");
    await expect(page.getByTestId("mano-der-total")).toHaveText("21");
    await expect(page.getByTestId("mano-izq-pts")).toHaveText("4.00");

    await abrirSeccion(page, "pies");
    // pieDer legacy: tarsianos = 4 → calcáneo + astrágalo + 2 del resto
    await expect(page.getByTestId("pie-der-calcaneo")).toBeChecked();
    await expect(page.getByTestId("pie-der-astragalo")).toBeChecked();
    await expect(page.getByTestId("pie-der-restoTarso")).toHaveValue("2");
    await expect(page.getByTestId("pie-der-metatarsianos")).toHaveValue("5");
    await expect(page.getByTestId("pie-der-falProx")).toHaveValue("3");
    await expect(page.getByTestId("pie-der-falMedias")).toHaveValue("2");
    await expect(page.getByTestId("pie-der-falDistales")).toHaveValue("1");
    await expect(page.getByTestId("pie-der-total")).toHaveText("15");
    await expect(page.getByTestId("pie-izq-pts")).toHaveText("5.00");

    // Y las métricas de pantalla salen (no explota con el shape viejo).
    await expect(page.getByTestId("ipo-value")).not.toHaveText("0.0%");
    await shot(page, "ficha-sin-migrar", info.project.name);
  });

  test("quality.value = 0 se guarda como 0 y sobrevive al reabrir", async ({ page }, info) => {
    await abrirHarness(page);
    await page.getByTestId("load-sin-migrar").click();
    await abrirSeccion(page, "ich");

    // La fixture trae `mandibula: { value: 0 }` — calidad nula, observación válida.
    await expect(page.getByTestId("quality-mandibula-value")).toHaveText("0%");
    // Y otro grupo se baja a 0 a mano (teclado real sobre el slider: `Home` = mín).
    await expect(page.getByTestId("quality-costillas-value")).toHaveText("40%");
    await page.getByTestId("quality-costillas").focus();
    await page.keyboard.press("Home");
    await expect(page.getByTestId("quality-costillas-value")).toHaveText("0%");

    const ipoAntes = await page.getByTestId("ipo-value").textContent();
    const ichAntes = await page.getByTestId("ich-value").textContent();

    await page.getByRole("button", { name: "Guardar ficha" }).click();
    const payload = await page.getByTestId("saved-payload").textContent();
    const saved = JSON.parse(payload ?? "{}");

    // 🔒 `0` persiste como `0` (no `undefined`, no `""`, no `null`).
    expect(saved.data.quality.mandibula.value).toBe(0);
    expect(saved.data.quality.costillas.value).toBe(0);
    // 🔒 el front no manda los espejos legacy: los reescribe el backend.
    expect(saved.data.manoDer.falProximales).toBe(5);
    expect(saved.data.manoDer.falProxMedias).toBe(7); // reescrito por normalizeEatUnits
    expect(saved.data.pieDer.tarsianos).toBe(4);
    expect(saved.data.manoDer.falMediasDistales).toBeUndefined();
    expect(saved.schemaVersion).toBe(3);
    // El preview de pantalla coincide con la métrica que persiste el backend.
    expect(`${saved.metricas.ipo.toFixed(1)}%`).toBe(ipoAntes);
    expect(`${saved.metricas.ich.toFixed(1)}%`).toBe(ichAntes);

    // Reabrir la ficha guardada: los 12 valores y el 0 de calidad siguen ahí.
    await page.getByTestId("reopen-saved").click();
    await expect(page.getByTestId("fixture-actual")).toHaveText("guardada");
    await abrirSeccion(page, "ich");
    await expect(page.getByTestId("quality-mandibula-value")).toHaveText("0%");
    await expect(page.getByTestId("quality-costillas-value")).toHaveText("0%");
    await expect(page.getByTestId("ipo-value")).toHaveText(ipoAntes ?? "");
    await expect(page.getByTestId("ich-value")).toHaveText(ichAntes ?? "");

    await abrirSeccion(page, "manos");
    await expect(page.getByTestId("mano-der-falProximales")).toHaveValue("5");
    await expect(page.getByTestId("mano-der-falMedias")).toHaveValue("2");
    await abrirSeccion(page, "pies");
    await expect(page.getByTestId("pie-der-calcaneo")).toBeChecked();
    await expect(page.getByTestId("pie-der-restoTarso")).toHaveValue("2");

    await shot(page, "quality-cero-round-trip", info.project.name);
  });

  test("la tabla de captura no exige scroll horizontal", async ({ page }, info) => {
    await abrirHarness(page);
    await abrirSeccion(page, "pies");
    const wrapper = page.getByTestId("pie-der-restoTarso").locator("xpath=ancestor::div[contains(@class,'overflow-x-auto')]");
    const box = await wrapper.evaluate((el) => ({
      scroll: (el as HTMLElement).scrollWidth,
      client: (el as HTMLElement).clientWidth,
    }));
    expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
    await shot(page.getByTestId("section-pies").locator("xpath=.."), "tabla-pie-sin-scroll", info.project.name);
  });
});
