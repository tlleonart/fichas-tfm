# Escalado y roadmap — Registro Osteológico

Hacia dónde puede crecer el sistema. El diseño actual ya deja las costuras preparadas para
estas extensiones.

---

## 1. Multiobservador (prioridad declarada)

Hoy la regla es **1 ficha por método por individuo** (decisión de alcance). El objetivo de
escalado es soportar **múltiples valoraciones del mismo individuo por distintos
registradores**, lo que habilita la hipótesis **H4** (confiabilidad inter-observador del
índice subjetivo ICH).

### Qué requiere
- **Esquema:** levantar la restricción "1 por método". Opciones:
  - permitir varias `fichas` del mismo `tipo` por individuo, etiquetadas por
    `registrador` + `fechaRegistro` (versionado por observador); o
  - introducir una entidad `valoraciones` hija de `fichas`.
  - Quitar/relajar la validación en `fichas.crear` (índice `by_individuo_tipo`).
- **Autenticación por usuario:** pasar del gate de contraseña única a **Convex Auth**
  (cuentas individuales), de modo que cada valoración quede atribuida a un usuario real
  (no solo a un texto libre `registrador`). Esto también protege el backend a nivel de
  función (la URL de Convex hoy es pública).
- **Estadística inter-observador:** **ICC** (coeficiente de correlación intraclase) y
  **kappa ponderado de Cohen** sobre el ICH (y opcionalmente sobre la completitud) entre
  observadores del mismo individuo.

---

## 2. Profundización analítica

El `analisis.comparacion` actual entrega Spearman para H1/H2/H3. Próximos pasos:

- **Correlación parcial** (H3): aislar el ICH del componente de presencia compartido
  (controlar por IPO) para responder con rigor si el índice subjetivo está fundamentado.
- **Acuerdo, no solo correlación:** Bland–Altman y CCC de Lin entre escalas alineadas.
- **Agregaciones de conjunto (Zonación):** MNE, MNI y NISP por sitio / unidad funeraria.
- **Supervivencia de elementos:** perfiles de qué elementos se conservan, contrastados con
  la **atrición mediada por densidad ósea** (Lyman) — desviaciones delatan transporte,
  curación selectiva de cráneos o tratamiento funerario.
- **Sesgo de preservación por edad/sexo** (Walker et al. 1988), usando el perfil biológico
  canónico del individuo como covariable.
- **Representación de partes corporales** para inferencia de ritual funerario.

---

## 3. Archivos multimedia vinculados al individuo

Poder **cargar y vincular archivos multimedia** (fotografías de campo y laboratorio, fotos
por elemento/zona, radiografías, documentos) a cada individuo —y eventualmente a cada
ficha o zona—.

### Qué requiere
- **Almacenamiento:** Convex File Storage (`ctx.storage`) para subir y servir los archivos;
  se guarda el `storageId` y se obtiene una URL firmada al leer.
- **Esquema:** nueva tabla `adjuntos` (`individuoId`, `fichaId?` opcional, `storageId`,
  `nombre`, `tipo`/MIME, `descripcion?`, `tomadaEn?`) indexada por individuo.
- **UI:** zona de carga (drag & drop) en el detalle del individuo, galería con miniaturas,
  vista previa y descarga; idealmente etiquetado por elemento/zona para correlacionar con
  la ficha de Zonación.
- **Consideraciones:** límite de tamaño y tipos permitidos; las imágenes pueden enriquecer
  la valoración de calidad (ICH) y documentar alteraciones tafonómicas.

## 4. Producto / plataforma

- **Exportación de datos:** CSV/JSON del dataset y de los pares de comparación para análisis
  externo (R, Python).
- **Filtros y agrupación** por sitio, año, UF en lista y análisis.
- **Edición de identidad** del individuo (hoy: alta y baja; falta edición in situ).
- **Adjuntos:** fotos por ficha / por zona.
- **Internacionalización** si el proyecto suma colaboradores.
- **Auditoría / historial** de cambios por ficha.

---

## 5. Operación

- **Producción:** `npx convex deploy` (backend) + despliegue de Next (p. ej. Vercel), con
  `APP_PASSWORD`/`AUTH_TOKEN` y variables de Convex en el entorno del host.
- **Backups:** Convex gestiona persistencia; conviene un export periódico del dataset.
- **Migración de auth:** al adoptar Convex Auth, el gate de contraseña se retira y la
  protección pasa a nivel de función backend.

---

## 6. Estado actual vs objetivo

| Capacidad | Hoy | Objetivo |
|-----------|-----|----------|
| Vínculo individuo × métodos | ✔ | ✔ |
| Métricas por ficha (EAT corregido, completitud, FFI) | ✔ | ✔ |
| Comparación H1–H3 (Spearman) | ✔ | + parcial / acuerdo |
| Multiobservador (H4) | — | ✔ (esquema + Convex Auth) |
| Archivos multimedia por individuo | — | ✔ (Convex File Storage) |
| Agregación de conjunto (MNI/MNE/supervivencia) | — | ✔ |
| Auth | contraseña única | cuentas por usuario |
| Export de datos | — | ✔ |
