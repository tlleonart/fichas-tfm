/**
 * Hoja de impresión del documento osteológico.
 *
 * Se inyecta sólo en esta ruta (no toca el resto de la app) y está pensada para papel
 * A4, no para pantalla. Es la misma hoja validada en el generador offline
 * (`projects/fichas-tfm/export-pdf-2026-09-07/plantillas/base.css`).
 *
 * Al imprimir se ocultan el header y el footer del layout y se fuerza el esquema claro:
 * el tema oscuro de la app da un PDF ilegible en papel.
 */
export const HOJA = `
@page { size: A4 portrait; margin: 16mm 14mm 15mm 14mm; }

.doc {
  --tinta: #1a1a1a; --suave: #5c5c5c; --tenue: #8e8e8e;
  --linea: #c8c8c8; --linea-f: #6f6f6f; --fondo: #f2f2f0; --acento: #4a5d23;
  color: var(--tinta); background: #fff;
  font: 9.5pt/1.42 var(--font-geist), "Segoe UI", Arial, sans-serif;
  max-width: 210mm; margin: 0 auto; padding: 10mm;
}
.doc h1, .doc h2, .doc h3 { font-family: var(--font-serif), Georgia, serif; }

/* El documento NO sigue el tema de la app: es una hoja, y una hoja es clara.
   Sin esto, con el tema oscuro activo los títulos heredan el color claro del tema
   y salen en gris ilegible sobre el papel blanco. */
.doc, .doc h1, .doc h2, .doc h3, .doc p, .doc td, .doc th,
.doc div, .doc span, .doc b, .doc i, .doc li { color: var(--tinta); }
.doc .doc-head .tipo, .doc .si { color: var(--acento); }
.doc .doc-head .sub, .doc h2 .cuenta, .doc .leyenda, .doc .obs { color: var(--suave); }
.doc .identidad .k, .doc .metrica .k, .doc .metrica .u,
.doc .nota, .doc .no, .doc .vacio, .doc .pie-doc { color: var(--tenue); }
.doc .sin { color: #d0d0d0; }
.doc .leyenda b, .doc .identidad .v, .doc .metrica .v { color: var(--tinta); }

.doc .doc-head { border-bottom: 2.5pt solid var(--tinta); padding-bottom: 6pt; margin-bottom: 12pt; }
.doc .doc-head .tipo { font-size: 7.5pt; letter-spacing: .16em; text-transform: uppercase;
  color: var(--acento); font-weight: 700; margin-bottom: 3pt; }
.doc .doc-head h1 { font-size: 17pt; margin: 0 0 3pt; line-height: 1.2; }
.doc .doc-head .sub { font-size: 8.5pt; color: var(--suave); }

.doc .identidad { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5pt 10pt;
  background: var(--fondo); border: .5pt solid var(--linea); padding: 7pt 9pt;
  margin-bottom: 11pt; break-inside: avoid; }
.doc .identidad .k { font-size: 6.8pt; letter-spacing: .09em; text-transform: uppercase;
  color: var(--tenue); display: block; margin-bottom: 1pt; }
.doc .identidad .v { font-size: 9.5pt; font-weight: 600; }
.doc .identidad .ancho { grid-column: 1 / -1; }

.doc .metricas { display: flex; gap: 7pt; margin-bottom: 12pt; break-inside: avoid; }
.doc .metrica { flex: 1; border: .5pt solid var(--linea); border-top: 2pt solid var(--acento);
  padding: 6pt 7pt; text-align: center; }
.doc .metrica .k { font-size: 6.8pt; letter-spacing: .09em; text-transform: uppercase;
  color: var(--tenue); display: block; }
.doc .metrica .v { font-size: 15pt; font-weight: 700; font-family: var(--font-serif), Georgia, serif; }
.doc .metrica .u { font-size: 7.5pt; color: var(--tenue); }

.doc section { margin-bottom: 11pt; break-inside: avoid; }
.doc section.larga { break-inside: auto; }
.doc h2 { font-size: 11pt; margin: 0 0 5pt; padding-bottom: 2.5pt;
  border-bottom: 1pt solid var(--linea-f); display: flex;
  justify-content: space-between; align-items: baseline; gap: 8pt; }
.doc h2 .cuenta { font: 400 8pt/1 var(--font-geist), sans-serif; color: var(--suave); white-space: nowrap; }
.doc .nota { font-size: 7.3pt; color: var(--tenue); margin: 3pt 0 4pt; line-height: 1.35; }

.doc table { width: 100%; border-collapse: collapse; font-size: 8.3pt; }
.doc thead { display: table-header-group; }
.doc tr { break-inside: avoid; }
.doc th, .doc td { border: .5pt solid var(--linea); padding: 2.2pt 4pt;
  text-align: left; vertical-align: top; }
.doc th { background: var(--fondo); font-size: 7pt; font-weight: 700;
  letter-spacing: .04em; text-transform: uppercase; color: var(--suave); }
.doc td.n, .doc th.n { text-align: right; font-variant-numeric: tabular-nums; }
.doc td.c, .doc th.c { text-align: center; }
.doc tbody tr:nth-child(even) td { background: #fafafa; }

.doc .si { color: var(--acento); font-weight: 700; }
.doc .no { color: var(--tenue); }
.doc .sin { color: #d0d0d0; }

.doc .leyenda { font-size: 7.3pt; color: var(--suave); margin: 4pt 0 10pt;
  padding: 4pt 6pt; background: var(--fondo); border-left: 2pt solid var(--acento); }
.doc .leyenda b { color: var(--tinta); }
.doc .obs { font-size: 8.3pt; background: var(--fondo); border-left: 2pt solid var(--linea-f);
  padding: 5pt 7pt; margin: 4pt 0; white-space: pre-wrap; line-height: 1.4; }
.doc .vacio { color: var(--tenue); font-style: italic; font-size: 8.3pt; }
.doc .pill { display: inline-block; border: .5pt solid var(--linea-f); border-radius: 8pt;
  padding: 1pt 6pt; font-size: 7.5pt; margin: 0 3pt 3pt 0; }
.doc .salto { break-before: page; }
.doc .pie-doc { margin-top: 14pt; padding-top: 5pt; border-top: .5pt solid var(--linea);
  font-size: 7pt; color: var(--tenue); line-height: 1.5; }

@media print {
  /* el cromo de la app no va al papel */
  body > header, body > footer, .no-imprimir { display: none !important; }
  /* el fondo oscuro del tema llegaba al papel como un marco negro */
  html, body, body > div, body > main { background: #fff !important; }
  html { color-scheme: light !important; }
  .doc { max-width: none; margin: 0; padding: 0; background: #fff !important; }
}
`;
