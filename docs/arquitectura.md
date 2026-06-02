# Arquitectura técnica — Registro Osteológico

Documentación técnica de **alto y bajo nivel**. Para el detalle metodológico ver
[`metodologia.md`](./metodologia.md); para la visión de escalado ver
[`escalado.md`](./escalado.md); para el esquema de datos ver
[`esquema-datos.html`](./esquema-datos.html) / [`.pdf`](./esquema-datos.pdf).

---

## 1. Alto nivel

Aplicación web para el registro y análisis cuantitativo de restos óseos mediante dos
métodos complementarios (Zonación y EAT), centrada en el **Individuo** como entidad
canónica que vincula los métodos y habilita el análisis comparativo a nivel individuo,
población y total.

```
┌─────────────────────────────────────────────┐
│  Navegador (Next.js App Router, React 19)     │
│  · UI editorial + tema claro/oscuro           │
│  · Convex React hooks (useQuery/useMutation)  │
└───────────────┬───────────────────────────────┘
                │  WebSocket reactivo (Convex client)
                ▼
┌─────────────────────────────────────────────┐
│  Convex (backend serverless + base de datos)  │
│  · schema (individuos, fichas)                │
│  · mutations / queries                        │
│  · cómputo de métricas al guardar             │
└─────────────────────────────────────────────┘

Gate de acceso: proxy (Next.js) con cookie de sesión (contraseña única).
```

**Principio de diseño clave:** los formularios capturan insumos crudos heterogéneos en
`fichas.data` (JSON), y el backend **calcula y persiste las métricas derivadas al guardar**
(`fichas.metricas`). El análisis nunca recomputa: lee métricas ya materializadas.

---

## 2. Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + TypeScript |
| Estilos | Tailwind CSS v4 (tokens CSS, modo oscuro por clase) |
| Tipografía | Source Serif 4 (títulos) + Geist (texto/datos) |
| Backend + DB | Convex |
| Export PDF de fichas | html2pdf.js |
| Auth | Gate de contraseña (proxy de Next + cookie HttpOnly) |

---

## 3. Estructura de directorios

```
fichas-app/
├─ convex/                      # Backend
│  ├─ schema.ts                 # Tablas individuos + fichas e índices
│  ├─ individuos.ts             # CRUD de individuos + listar/obtener
│  ├─ fichas.ts                 # CRUD de fichas (calcula métricas al guardar)
│  ├─ analisis.ts               # Query de comparación (C4 / H1–H3, Spearman)
│  ├─ lib/metrics.ts            # Funciones puras: EAT, Zonación (fuente de verdad)
│  └─ _generated/               # Tipos y API generados por Convex
├─ src/
│  ├─ proxy.ts                  # Gate de acceso (Next 16 "proxy", ex-middleware)
│  ├─ app/
│  │  ├─ layout.tsx             # Layout, fuentes, providers, nav, tema
│  │  ├─ ConvexClientProvider.tsx
│  │  ├─ globals.css            # Sistema de diseño (tokens claro/oscuro)
│  │  ├─ page.tsx               # Home
│  │  ├─ login/page.tsx         # Pantalla de login
│  │  ├─ api/login|logout/      # Route handlers de sesión
│  │  ├─ individuos/
│  │  │  ├─ page.tsx            # Lista
│  │  │  ├─ nuevo/page.tsx      # Alta de individuo
│  │  │  └─ [id]/
│  │  │     ├─ page.tsx         # Detalle + comparación por individuo
│  │  │     ├─ zonacion/page.tsx# Host del formulario de Zonación
│  │  │     └─ eat/page.tsx     # Host del formulario de EAT
│  │  └─ analisis/page.tsx      # Análisis población/total
│  └─ components/
│     ├─ ZonacionForm.tsx       # Formulario Zonación (insumos crudos)
│     ├─ EATForm.tsx            # Formulario EAT (preview en vivo)
│     ├─ ExportPDF.tsx          # Exportar ficha a PDF
│     ├─ ThemeToggle.tsx        # Selector claro/oscuro
│     └─ LogoutButton.tsx
└─ docs/                        # Esta documentación
```

---

## 4. Backend (Convex) — bajo nivel

### 4.1 Esquema (`convex/schema.ts`)
Dos tablas: `individuos` (entidad canónica) y `fichas` (vinculadas por `individuoId`).
Detalle completo de campos e índices en [`esquema-datos.html`](./esquema-datos.html).

### 4.2 Funciones

**`individuos.ts`**
| Función | Tipo | Descripción |
|---------|------|-------------|
| `crear` | mutation | Genera `codigoCanonico`, valida unicidad (`by_codigo`), inserta. |
| `actualizar` | mutation | Recalcula código y valida que no colisione con otro. |
| `eliminar` | mutation | Borra el individuo **y en cascada sus fichas**. |
| `listar` | query | Individuos + flags `tieneZonacion` / `tieneEat`. Filtro opcional por `sitio`. |
| `obtener` | query | Individuo + sus fichas. |

**`fichas.ts`**
| Función | Tipo | Descripción |
|---------|------|-------------|
| `crear` | mutation | Valida regla "1 ficha por método" (`by_individuo_tipo`), calcula `metricas`, inserta. |
| `actualizar` | mutation | Recalcula `metricas` y actualiza. |
| `eliminar` | mutation | Borra la ficha. |
| `obtener` | query | Una ficha por id. |

**`analisis.ts`**
- `comparacion` (query): junta los pares Zonación↔EAT por individuo (filtro opcional por
  `sitio`), alinea dirección (preservación ↔ afectación) y calcula correlación de
  **Spearman** para las hipótesis H1/H2/H3 (devuelve `null` con n < 3).

### 4.3 Módulo de métricas (`convex/lib/metrics.ts`)
Funciones **puras** y única fuente de verdad del cálculo:
- `computeEAT(data)` → `{ ipo, ich, eat, totalPresent }`.
- `computeZonacion(data)` → `{ completitudGlobal, completitudPorElemento, elementosPresentes, ffi, alteracionesCount, fragmentosCount }`.
- `computeMetrics(tipo, data)` → despacha según método.

> Los formularios muestran un *preview* en vivo con la misma lógica; el valor **persistido**
> siempre lo recalcula el backend al guardar, evitando divergencias.

---

## 5. Frontend — bajo nivel

### 5.1 Navegación (centrada en Individuo)
```
/                         Home
/login                    Acceso
/individuos               Lista
/individuos/nuevo         Alta de individuo
/individuos/[id]          Detalle + comparación por individuo
/individuos/[id]/zonacion Ficha de Zonación (crear/editar)
/individuos/[id]/eat      Ficha de EAT (crear/editar)
/analisis                 Comparación población/total
```

### 5.2 Sistema de diseño (`globals.css`)
- Tokens CSS en `:root` y `.dark` (canvas, surface, ink, muted, faint, line, accent…),
  mapeados a utilidades Tailwind vía `@theme inline`.
- Modo oscuro por clase (`@custom-variant dark`), togglado por `ThemeToggle` y persistido
  en `localStorage`; script anti-FOUC en `<head>` aplica el tema antes del primer paint.
- Componentes reutilizables: `.card`, `.field`, `.btn`, `.data-table`, `.section-bar`, `.pill`.
- Contraste verificado WCAG AA en ambos temas.

### 5.3 Acceso a datos
Páginas cliente usan `useQuery` / `useMutation` de `convex/react`. Las queries son
**reactivas**: la UI se actualiza sola cuando cambian los datos.

---

## 6. Autenticación

Gate de **contraseña única** (ver `escalado.md` para la evolución a multiusuario):
- `src/proxy.ts` redirige a `/login` toda request sin cookie de sesión válida.
- `POST /api/login` compara contra `APP_PASSWORD` y setea cookie `osteo_auth` (HttpOnly,
  SameSite=Lax) con el valor de `AUTH_TOKEN` (secreto de servidor).
- `POST /api/logout` limpia la cookie.

> **Alcance:** el gate protege la UI de Next. La URL del deployment de Convex es pública;
> la protección a nivel backend requeriría Convex Auth por usuario (ver roadmap).

### Variables de entorno (`.env.local`)
| Variable | Uso |
|----------|-----|
| `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` | Conexión a Convex (generadas por `npx convex dev`). |
| `APP_PASSWORD` | Contraseña de acceso a la app. |
| `AUTH_TOKEN` | Secreto del servidor para la cookie de sesión. |

---

## 7. Desarrollo local

```bash
npm install
npx convex dev      # backend + genera convex/_generated (login una vez)
npm run dev         # frontend en http://localhost:3000
```

`npx convex dev` debe quedar corriendo en paralelo durante el desarrollo (sincroniza
schema y funciones). Para producción: `npx convex deploy` + desplegar Next (p. ej. Vercel).
