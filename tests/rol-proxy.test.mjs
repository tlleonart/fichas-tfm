/**
 * Roles y ruteo de acceso (`src/lib/rol.ts`, consumido por `src/proxy.ts`).
 * =========================================================================
 * El bloqueo del rol lector es deny-by-default EN EL SERVIDOR: si esta matriz
 * se afloja, un corrector del TFM ve Análisis o llega a un formulario de carga.
 *
 * Dos trampas cubiertas a propósito:
 *   1. `/individuos/nuevo` matchea `^/individuos/[^/]+$` — tiene que denegarse
 *      ANTES de evaluar el patrón de ficha.
 *   2. `VIEWER_TOKEN` vacío o igual a `AUTH_TOKEN` no puede resolver rol alguno:
 *      una config a medias no puede terminar dando permisos de editor.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";

const {
  rolDesdeTokens, lectorHabilitado, lectorPuedeVer, rutaPublica, decidirAcceso,
} = await import("../src/lib/rol.ts");

const CFG = { authToken: "tok-editor", viewerToken: "tok-lector" };

/* ══════════════════════════════════════════════════════════════════════ */
/*  1. Resolución de rol                                                  */
/* ══════════════════════════════════════════════════════════════════════ */

describe("rol a partir del token de la cookie", () => {
  test("cada token resuelve su rol", () => {
    assert.equal(rolDesdeTokens("tok-editor", CFG), "editor");
    assert.equal(rolDesdeTokens("tok-lector", CFG), "lector");
  });

  test("un token desconocido, vacío o ausente no resuelve nada", () => {
    assert.equal(rolDesdeTokens("otra-cosa", CFG), null);
    assert.equal(rolDesdeTokens("", CFG), null);
    assert.equal(rolDesdeTokens(undefined, CFG), null);
  });

  test("sin VIEWER_TOKEN el rol lector no existe", () => {
    const cfg = { authToken: "tok-editor", viewerToken: "" };
    assert.equal(lectorHabilitado(cfg), false);
    assert.equal(rolDesdeTokens("", cfg), null);
    assert.equal(rolDesdeTokens(undefined, cfg), null);
    assert.equal(rolDesdeTokens("tok-editor", cfg), "editor");
  });

  test("VIEWER_TOKEN indefinido tampoco habilita al lector", () => {
    const cfg = { authToken: "tok-editor" };
    assert.equal(lectorHabilitado(cfg), false);
    assert.equal(rolDesdeTokens(undefined, cfg), null);
  });

  test("VIEWER_TOKEN igual a AUTH_TOKEN deshabilita al lector (no lo asciende)", () => {
    const cfg = { authToken: "mismo", viewerToken: "mismo" };
    assert.equal(lectorHabilitado(cfg), false);
    // El token sigue siendo el del editor: gana `editor`, nunca "lector".
    assert.equal(rolDesdeTokens("mismo", cfg), "editor");
  });

  test("sin AUTH_TOKEN configurado, una cookie vacía no entra", () => {
    assert.equal(rolDesdeTokens("", { authToken: "", viewerToken: "" }), null);
    assert.equal(rolDesdeTokens(undefined, {}), null);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  2. Allowlist del lector                                               */
/* ══════════════════════════════════════════════════════════════════════ */

describe("allowlist del lector", () => {
  test("permitidas: home, listado, datos, cobertura y planilla", () => {
    for (const p of ["/", "/individuos", "/datos", "/cobertura", "/planilla"])
      assert.equal(lectorPuedeVer(p), true, p);
  });

  test("permitidas: la ficha del individuo y su documento imprimible", () => {
    assert.equal(lectorPuedeVer("/individuos/j57abc123"), true);
    assert.equal(lectorPuedeVer("/individuos/j57abc123/documento"), true);
  });

  test("`/individuos/nuevo` NO se cuela por el patrón de ficha", () => {
    assert.equal(lectorPuedeVer("/individuos/nuevo"), false);
  });

  test("denegadas: edición, formularios de carga, análisis, docs y dev", () => {
    for (const p of [
      "/analisis",
      "/docs",
      "/dev/eat-harness",
      "/individuos/j57abc123/editar",
      "/individuos/j57abc123/zonacion",
      "/individuos/j57abc123/eat",
      "/individuos/j57abc123/documento/algo",
    ])
      assert.equal(lectorPuedeVer(p), false, p);
  });

  test("cualquier ruta futura queda denegada por defecto", () => {
    assert.equal(lectorPuedeVer("/adjuntos"), false);
    assert.equal(lectorPuedeVer("/individuos/j57/borrar"), false);
    assert.equal(lectorPuedeVer("/api/lo-que-sea"), false);
  });

  test("las rutas públicas son las de la puerta de acceso", () => {
    for (const p of ["/login", "/api/login", "/api/logout", "/robots.txt"])
      assert.equal(rutaPublica(p), true, p);
    assert.equal(rutaPublica("/datos"), false);
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  3. Matriz completa de decisión (lo que ejecuta `src/proxy.ts`)        */
/* ══════════════════════════════════════════════════════════════════════ */

describe("decisión de acceso", () => {
  const editor = (p) => decidirAcceso(p, "tok-editor", CFG);
  const lector = (p) => decidirAcceso(p, "tok-lector", CFG);
  const anon = (p) => decidirAcceso(p, undefined, CFG);

  test("sin sesión: todo a /login, salvo lo público", () => {
    assert.deepEqual(anon("/datos"), { accion: "redirigir", destino: "/login" });
    assert.deepEqual(anon("/"), { accion: "redirigir", destino: "/login" });
    assert.deepEqual(anon("/login"), { accion: "permitir" });
    assert.deepEqual(anon("/api/login"), { accion: "permitir" });
  });

  test("editor: pasa por todo (comportamiento histórico)", () => {
    for (const p of [
      "/", "/individuos", "/individuos/nuevo", "/individuos/j57/editar",
      "/individuos/j57/zonacion", "/individuos/j57/eat", "/analisis", "/docs",
      "/dev/eat-harness", "/datos", "/cobertura", "/planilla",
    ])
      assert.deepEqual(editor(p), { accion: "permitir" }, p);
  });

  test("lector: pasa por su allowlist", () => {
    for (const p of [
      "/", "/individuos", "/datos", "/cobertura", "/planilla",
      "/individuos/j57", "/individuos/j57/documento",
    ])
      assert.deepEqual(lector(p), { accion: "permitir" }, p);
  });

  test("lector: todo lo demás rebota a /individuos", () => {
    for (const p of [
      "/analisis", "/docs", "/dev/eat-harness", "/individuos/nuevo",
      "/individuos/j57/editar", "/individuos/j57/zonacion", "/individuos/j57/eat",
    ])
      assert.deepEqual(lector(p), { accion: "redirigir", destino: "/individuos" }, p);
  });

  test("con el lector deshabilitado, su token viejo cae a /login (no a editor)", () => {
    const cfg = { authToken: "tok-editor", viewerToken: "" };
    assert.deepEqual(decidirAcceso("/datos", "tok-lector", cfg),
      { accion: "redirigir", destino: "/login" });
    assert.deepEqual(decidirAcceso("/analisis", "tok-lector", cfg),
      { accion: "redirigir", destino: "/login" });
  });
});
