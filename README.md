# Registro Osteológico

Aplicación web para el **registro y análisis cuantitativo de restos óseos** en antropología
forense y bioarqueología. Integra dos métodos complementarios por individuo y permite cruzar
sus resultados a nivel individuo, población y total.

- **Método de Zonación** — Knüsel & Outram (2004): presencia de zonas anatómicas, completitud
  y análisis de fractura (FFI).
- **EAT (Estado de Afectación Tafonómica)** — Serrulla & Vázquez (2019): Índice de
  Preservación Ósea (IPO) e Índice de Calidad del Hueso (ICH).

El modelo es **centrado en el Individuo**: una entidad canónica (sitio · año · fosa · UF · nº)
vincula las fichas de ambos métodos y habilita el análisis comparativo.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · **Convex** (backend + DB).

## Puesta en marcha

```bash
npm install
npx convex dev      # backend (login una vez); deja corriendo en paralelo
npm run dev         # http://localhost:3000
```

Variables en `.env.local`: `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` (las genera
`npx convex dev`), más `APP_PASSWORD` (contraseña de acceso) y `AUTH_TOKEN` (secreto de
sesión). **Cambiá `APP_PASSWORD`** antes de usar.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`docs/arquitectura.md`](./docs/arquitectura.md) | Arquitectura técnica, alto y bajo nivel. |
| [`docs/metodologia.md`](./docs/metodologia.md) | Fundamento científico, fórmulas, hipótesis. |
| [`docs/escalado.md`](./docs/escalado.md) | Roadmap y multiobservador. |
| [`docs/esquema-datos.html`](./docs/esquema-datos.html) · [`.pdf`](./docs/esquema-datos.pdf) | Esquema de base de datos. |

## Notas

- La fórmula del EAT es **multiplicativa**: `EAT = 100 − (IPO × ICH) / 100` (verificada contra
  la planilla original de Serrulla & Vázquez).
- El acceso está protegido por un gate de contraseña única; ver evolución a multiusuario en
  [`docs/escalado.md`](./docs/escalado.md).
