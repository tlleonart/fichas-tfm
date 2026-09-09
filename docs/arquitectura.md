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
  > Desde el 2026-09-09 `ffi`, `alteracionesCount` y `fragmentosCount` **se siguen
  > calculando y guardando**, pero ya no se renderizan en ninguna pantalla ni salen en
  > los exports: Martina no usó esos campos. El backend no se tocó a propósito, para que
  > la limpieza sea reversible con un revert de front y no se toque la fuente de verdad
  > del cálculo.
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
/individuos/[id]/editar   Edición de la identidad del individuo
/datos                    Dashboard de datos (filtros + export crudo/maestra)
/cobertura                Cobertura de costillas y vértebras (vacíos por individuo y sitio)
/planilla                 Planilla de totales de ambos métodos (individuo y sitio)
/analisis                 Comparación población/total
/docs                     Documentación renderizada
```

### 5.1.1 Cobertura y planilla (`convex/cobertura.ts`)
Una sola query de **solo lectura** (`cobertura:cobertura`) alimenta las dos vistas. No
recalcula métricas: lee las `metricas` ya guardadas (`lib/metrics.ts` sigue siendo la
única fuente de verdad) y solo cuenta las marcas crudas de los grupos costillas y
vértebras, que no están desagregadas en `metricas`.

- **`/cobertura`** — individuos sin ninguna marca cargada en costillas, en vértebras o en
  ambos, con su sitio y sus valores totales (completitud, IPO, ICH, EAT).
- **`/planilla`** — totales de los dos métodos por individuo y agregados por sitio
  (media ± DE, mediana, mín/máx y agregado sobre sumas), más fila TOTAL.

Dos advertencias metodológicas que las vistas explicitan:

1. **"Sin información" = cero marcas cargadas.** Los formularios persisten solo casillas
   tildadas, así que en la base *no se distingue* "el hueso no se preservó" de "el hueso no
   se registró". Lo que sí discrimina es la **discrepancia entre métodos** (un grupo
   presente en un método y vacío en el otro ⇒ casi seguro un vacío de registro).
2. **Los denominadores difieren.** Zonación: costillas 72 zonas, vértebras 96 zonas, y el
   **sacro es un elemento aparte** (4 zonas). EAT: costillas 24, vértebras 32 — y ahí el
   sacro y el cóccix van *dentro* de vértebras. No son comparables uno a uno.

El **EAT de un sitio** se reporta como media/mediana de los EAT individuales. No se aplica
`EAT = 100 − (IPO×ICH)/100` sobre promedios: la fórmula está definida por individuo.

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

Gate de **contraseña por rol** (ver `escalado.md` para la evolución a multiusuario):
- `src/proxy.ts` redirige a `/login` toda request sin cookie de sesión válida.
- `POST /api/login` compara primero contra `APP_PASSWORD` (rol **editor** → cookie con
  `AUTH_TOKEN`) y después contra `VIEWER_PASSWORD` (rol **lector** → cookie con
  `VIEWER_TOKEN`). Cookie `osteo_auth`, HttpOnly, SameSite=Lax, 30 días. La respuesta
  es idéntica en los dos casos: no se filtra qué rol se obtuvo.
- `POST /api/logout` limpia la cookie.

### 6.1 Roles (2026-09-09)
`src/lib/rol.ts` resuelve el rol desde la cookie y decide el acceso; `src/proxy.ts` solo
ejecuta esa decisión. El **lector** (correctores del TFM) tiene una **allowlist
deny-by-default**:

| Rol | Puede ver |
|-----|-----------|
| editor | todo (comportamiento histórico) |
| lector | `/` · `/individuos` · `/datos` · `/cobertura` · `/planilla` · `/individuos/<id>` · `/individuos/<id>/documento` |

Todo lo demás (Análisis, `/docs`, `/dev/*`, `/individuos/nuevo`, editar, y los formularios
de carga de Zonación/EAT) rebota a `/individuos`. Cualquier ruta nueva nace denegada para
el lector hasta que se la agregue a la allowlist. La matriz está testeada en
`tests/rol-proxy.test.mjs`.

🔒 Si `VIEWER_TOKEN` está vacío o es igual a `AUTH_TOKEN`, el rol lector queda
**deshabilitado**: una configuración a medias no puede terminar dando permisos de editor.

> **Alcance:** el gate protege la UI de Next. La URL del deployment de Convex es pública;
> la protección a nivel backend requeriría Convex Auth por usuario (ver roadmap). El
> bloqueo del lector es a nivel de aplicación.

### Variables de entorno (`.env.local`)
| Variable | Uso |
|----------|-----|
| `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` | Conexión a Convex (generadas por `npx convex dev`). |
| `APP_PASSWORD` | Contraseña de acceso a la app (rol editor). |
| `AUTH_TOKEN` | Secreto del servidor para la cookie de sesión del editor. |
| `VIEWER_PASSWORD` | Contraseña de solo lectura para los correctores. Sin ella, el rol lector no existe. |
| `VIEWER_TOKEN` | Secreto del servidor para la cookie del lector. **Distinto** de `AUTH_TOKEN`. |

---

## 7. Desarrollo local

```bash
npm install
npx convex dev      # backend + genera convex/_generated (login una vez)
npm run dev         # frontend en http://localhost:3000
```

`npx convex dev` debe quedar corriendo en paralelo durante el desarrollo (sincroniza
schema y funciones). Para producción: `npx convex deploy` + desplegar Next (p. ej. Vercel).
