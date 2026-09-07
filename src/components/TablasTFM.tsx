"use client";

/**
 * Las once tablas del TFM, dentro de la aplicación.
 *
 * La numeración y el orden siguen la **V5 del manuscrito (7 de septiembre)**: si la app
 * numerara distinto que el trabajo, contrastar una contra otro sería un ejercicio de
 * traducción. Cambiar esta numeración exige mirar el manuscrito primero.
 *
 * No recalcula nada acá: el cómputo vive en `convex/lib/poblacional.ts`.
 */
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

/** Coma decimal, como el manuscrito. */
function n(v: number | null | undefined, dec = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(dec).replace(".", ",");
}

function p(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v < 0.0001) return "< 0,0001";
  return n(v, 4);
}

/** "0,075 (p = 0,052)" — la pendiente se lee siempre junto a su p. */
function pendiente(valor: number | null, pv: number | null): string {
  if (valor === null) return "—";
  const pp = pv === null ? "—" : pv < 0.0001 ? "< 0,0001" : `= ${n(pv, 3)}`;
  return `${n(valor, 3)} (p ${pp})`;
}

/** "I5" a partir del código canónico, para que coincida con el manuscrito. */
const corto = (codigo: string) => {
  const s = codigo.split("-I").pop();
  return s ? `I${s}` : codigo;
};

function Tabla({
  numero, titulo, nota, cabeceras, children, alineDerecha = [],
}: {
  numero: number;
  titulo: string;
  nota?: string;
  cabeceras: string[];
  children: React.ReactNode;
  alineDerecha?: number[];
}) {
  return (
    <section className="card p-5">
      <h3 className="font-serif text-base font-semibold text-ink">
        Tabla {numero}. <span className="font-normal">{titulo}</span>
      </h3>
      {nota && <p className="mt-1 max-w-prose text-xs text-muted">{nota}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong">
              {cabeceras.map((c, i) => (
                <th key={i} className={`px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted ${
                  alineDerecha.includes(i) ? "text-right" : "text-left"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

const td = "px-2 py-1.5 border-b border-line";
const tdn = `${td} text-right tabular-nums`;
const tdGrupo =
  "px-2 py-1.5 border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted";

/** Nombres de la Tabla 7 tal como los escribe el manuscrito. */
const ETIQUETA_KW: Record<string, string> = {
  ich: "ICH",
  eat: "EAT",
  ipo: "IPO",
  completitudNucleo: "Completitud núcleo /363",
  completitudGlobal: "Completitud global /635",
};

export default function TablasTFM() {
  const res = useQuery(api.analisis.poblacional, {});

  if (res === undefined)
    return <div className="card p-8 text-center text-sm text-muted">Calculando el análisis poblacional…</div>;

  // `analisis` es null cuando no hay individuos con los dos métodos: sin pares no hay
  // concordancia que calcular, y la pantalla lo dice en vez de romperse.
  const a = res.analisis;
  if (a === null)
    return (
      <div className="card p-8 text-center text-sm text-muted">
        Todavía no hay individuos con los dos métodos cargados: el análisis poblacional necesita
        pares (Zonación + EAT) para calcularse.
      </div>
    );

  const d = a.descriptivos;
  const c = a.concordancia;
  const ce = c.controlSinExtremos;
  const rel = a.relacionEatIpoIch;
  // Puede no venir si el backend desplegado es anterior a este bloque: durante esa
  // ventana la Tabla 11 no se muestra, en vez de romper toda la pantalla.
  const disc = a.discrepanciasSeriados as typeof a.discrepanciasSeriados | undefined;
  const cve = a.corticalVsEsponjoso;
  const wil = a.manosPiesVsNucleo.wilcoxonPorSitio;

  const filasDesc: [string, typeof d.ipo][] = [
    ["Completitud zonación /635", d.completitudGlobal],
    ["Completitud zonación núcleo /363", d.completitudNucleo],
    ["IPO", d.ipo],
    ["ICH", d.ich],
    ["EAT", d.eat],
  ];

  const concordancia = (b: typeof c.global): [string, string][] => [
    ["r de Pearson", n(b.rPearson, 3)],
    ["CCC de Lin", n(b.cccLin, 3)],
    ["Sesgo (Bland-Altman)", n(b.sesgo)],
    ["Pendiente (sesgo proporcional)", pendiente(b.pendiente, b.pendienteP)],
    ["Amplitud LoA 95 %", n(b.amplitudLoA95)],
  ];

  const nucleoNoSignificativo = c.nucleo.pendienteP !== null && c.nucleo.pendienteP >= 0.05;

  // El manuscrito agrupa la Tabla 8 por tejido y ordena de menor a mayor completitud.
  const porTejido = (t: "esponjoso" | "cortical") =>
    a.porElemento.filter((e) => e.tejido === t).sort((x, y) => x.completitudMedia - y.completitudMedia);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-serif text-xl font-semibold text-ink">Análisis poblacional del TFM</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Las once tablas del trabajo, calculadas por la aplicación sobre los datos cargados.
          La numeración es la del manuscrito.
        </p>
      </header>

      <Tabla numero={1}
        titulo={`Media y desviación estándar de los cinco índices centrales sobre los ${d.ipo.n} individuos de la muestra.`}
        cabeceras={["Índice", "μ", "σ"]} alineDerecha={[1, 2]}>
        {filasDesc.map(([lbl, v]) => (
          <tr key={lbl}>
            <td className={td}>{lbl}</td>
            <td className={tdn}>{n(v.media)}</td>
            <td className={tdn}>{n(v.de)}</td>
          </tr>
        ))}
      </Tabla>

      <Tabla numero={2} titulo="Media y desviación estándar del ICH por sitio de procedencia."
        cabeceras={["Sitio", "n", "μ", "σ"]} alineDerecha={[1, 2, 3]}>
        {a.ichPorSitio.map((s) => (
          <tr key={s.sitio}>
            <td className={td}>{s.sitio}</td>
            <td className={tdn}>{s.n}</td>
            <td className={tdn}>{n(s.media)}</td>
            <td className={tdn}>{n(s.de)}</td>
          </tr>
        ))}
      </Tabla>

      <Tabla numero={3}
        titulo={`Concordancia entre la completitud por zonación y el IPO sobre el denominador completo de ${c.global.denominador} zonas (n=${c.global.n}).`}
        cabeceras={["Estadístico", "Valor"]} alineDerecha={[1]}>
        {concordancia(c.global).map(([k, v]) => (
          <tr key={k}><td className={td}>{k}</td><td className={tdn}>{v}</td></tr>
        ))}
      </Tabla>

      <Tabla numero={4}
        titulo={`Concordancia sobre el núcleo de ${c.nucleo.denominador} zonas, excluidas manos y pies (n=${c.nucleo.n}).`}
        cabeceras={["Estadístico", "Valor"]} alineDerecha={[1]}>
        {concordancia(c.nucleo).map(([k, v]) => (
          <tr key={k}><td className={td}>{k}</td><td className={tdn}>{v}</td></tr>
        ))}
      </Tabla>

      {nucleoNoSignificativo && (
        <div className="rounded-lg border border-line-strong bg-surface-2 px-4 py-3 text-sm">
          <b className="text-ink">La pendiente residual sobre el núcleo queda en el límite de la significación</b>{" "}
          <span className="text-muted">
            (p = {n(c.nucleo.pendienteP, 3)}, n = {c.nucleo.n}): no alcanza el umbral convencional de
            0,05. En el control sin los casos de completitud extrema (n = {ce.nucleo.n}) la pendiente
            es {n(ce.nucleo.pendiente, 3)} con p = {n(ce.nucleo.pendienteP, 3)}.
          </span>
        </div>
      )}

      <Tabla numero={5}
        titulo={`Comparación de los estadísticos de concordancia con los ${c.global.n} individuos y excluyendo a los de menos del 5 % del esqueleto recuperado.`}
        nota={`Excluidos: ${ce.excluidos.map((e) => corto(e.codigo)).join(", ")}.`}
        cabeceras={["Estadístico", `Con los ${c.global.n}`, `Sin extremos (n=${ce.global.n})`]}
        alineDerecha={[1, 2]}>
        <tr><td className={td}>r de Pearson (/635)</td>
          <td className={tdn}>{n(c.global.rPearson, 3)}</td><td className={tdn}>{n(ce.global.rPearson, 3)}</td></tr>
        <tr><td className={td}>CCC de Lin (/635)</td>
          <td className={tdn}>{n(c.global.cccLin, 3)}</td><td className={tdn}>{n(ce.global.cccLin, 3)}</td></tr>
        <tr><td className={td}>Pendiente (/635)</td>
          <td className={tdn}>{n(c.global.pendiente, 3)}</td><td className={tdn}>{n(ce.global.pendiente, 3)}</td></tr>
        <tr><td className={td}>CCC de Lin (núcleo)</td>
          <td className={tdn}>{n(c.nucleo.cccLin, 3)}</td><td className={tdn}>{n(ce.nucleo.cccLin, 3)}</td></tr>
        <tr><td className={td}>Pendiente (núcleo)</td>
          <td className={tdn}>{pendiente(c.nucleo.pendiente, c.nucleo.pendienteP)}</td>
          <td className={tdn}>{pendiente(ce.nucleo.pendiente, ce.nucleo.pendienteP)}</td></tr>
      </Tabla>

      <Tabla numero={6}
        titulo="Proporción de la varianza del EAT explicada por el IPO y el ICH, por separado y en conjunto (R²)."
        nota={`El manuscrito no lo tabula, pero el dato que sostiene el argumento está acá: IPO e ICH correlacionan entre sí (ρ de Spearman = ${n(rel.rhoIchIpo, 3)}), y por eso hace falta el R² incremental para decidir si el ICH aporta algo propio.`}
        cabeceras={["Modelo", "R²"]} alineDerecha={[1]}>
        <tr><td className={td}>IPO</td><td className={tdn}>{n(rel.r2EatPorIpo, 3)}</td></tr>
        <tr><td className={td}>ICH</td><td className={tdn}>{n(rel.r2EatPorIch, 3)}</td></tr>
        <tr><td className={td}>IPO + ICH</td><td className={tdn}>{n(rel.r2Conjunto, 3)}</td></tr>
        <tr><td className={`${td} font-semibold text-ink`}>Incremento sobre el modelo con IPO</td>
          <td className={`${tdn} font-semibold text-ink`}>{n(rel.incrementoR2, 3)}</td></tr>
      </Tabla>

      <Tabla numero={7}
        titulo={`Efecto del sitio de procedencia sobre el ICH, el EAT, el IPO y la completitud en sus dos versiones (Kruskal-Wallis, n=${c.global.n}).`}
        cabeceras={["Variable", "H", "p", "η²_H"]} alineDerecha={[1, 2, 3]}>
        {a.variabilidadPorSitio.map((k) => (
          <tr key={k.variable}>
            <td className={td}>{ETIQUETA_KW[k.variable] ?? k.variable}</td>
            <td className={tdn}>{n(k.H)}</td>
            <td className={tdn}>{p(k.p)}</td>
            <td className={tdn}>{n(k.etaCuadradoH, 3)}</td>
          </tr>
        ))}
      </Tabla>

      <Tabla numero={8}
        titulo={`Completitud media por elemento anatómico sobre los ${c.global.n} individuos, agrupada según el tejido óseo predominante y ordenada de menor a mayor.`}
        nota={cve
          ? `Comparación entre grupos (Mann-Whitney): U = ${n(cve.U, 0)}, p = ${n(cve.pDosColas, 4)}. Media del esponjoso ${n(cve.mediaEsponjoso, 1)} % frente a ${n(cve.mediaCortical, 1)} % del cortical.`
          : undefined}
        cabeceras={["Elemento", "Completitud media (%)"]} alineDerecha={[1]}>
        <tr><td className={tdGrupo} colSpan={2}>Hueso esponjoso o de paredes finas</td></tr>
        {porTejido("esponjoso").map((e) => (
          <tr key={e.clave}><td className={td}>{e.etiqueta}</td><td className={tdn}>{n(e.completitudMedia)}</td></tr>
        ))}
        <tr><td className={tdGrupo} colSpan={2}>Hueso cortical compacto</td></tr>
        {porTejido("cortical").map((e) => (
          <tr key={e.clave}><td className={td}>{e.etiqueta}</td><td className={tdn}>{n(e.completitudMedia)}</td></tr>
        ))}
      </Tabla>

      <Tabla numero={9} titulo="Completitud media de manos y pies frente a la del núcleo, por sitio de procedencia."
        cabeceras={["Sitio", "n", "Manos + pies", "Núcleo", "Brecha (pp)"]} alineDerecha={[1, 2, 3, 4]}>
        {wil.map((w) => (
          <tr key={w.sitio}>
            <td className={td}>{w.sitio}</td>
            <td className={tdn}>{w.n}</td>
            <td className={tdn}>{n(w.manosPiesMedia)} %</td>
            <td className={tdn}>{n(w.nucleoMedia)} %</td>
            <td className={tdn}>{w.brechaPp > 0 ? "+" : ""}{n(w.brechaPp)}</td>
          </tr>
        ))}
      </Tabla>

      <Tabla numero={10}
        titulo="Comparación de la completitud de manos y pies frente a la del núcleo dentro de cada individuo (Wilcoxon de rangos signados)."
        nota={`Subconjunto: ${a.manosPiesVsNucleo.criterio}.`}
        cabeceras={["Sitio", "n", "Diferencia media (pp)", "p", "Manos+pies > núcleo"]}
        alineDerecha={[1, 2, 3, 4]}>
        {wil.map((w) => (
          <tr key={w.sitio}>
            <td className={td}>{w.sitio}</td>
            <td className={tdn}>{w.n}</td>
            <td className={tdn}>{w.brechaPp > 0 ? "+" : ""}{n(w.brechaPp)}</td>
            <td className={tdn}>{p(w.p)}</td>
            <td className={tdn}>{w.individuosManosPiesMayor} de {w.n}</td>
          </tr>
        ))}
      </Tabla>

      {disc && (
      <Tabla numero={11}
        titulo={`Registro de vértebras y costillas por individuo en los ${disc.total} casos de discrepancia entre la zonación y el IPO.`}
        nota={`Criterio: la zonación registra cero y el EAT registra presencia. ${disc.enVertebras} en vértebras, ${disc.enCostillas} en costillas; ${n(disc.pctDeLaMuestra, 1)} % de la muestra${disc.fueraDelSitioDominante === 0 && disc.casos.length ? `, todos de ${disc.casos[0].sitio}` : ""}.`}
        cabeceras={["Individuo", "Vért. zonación", "Vért. IPO", "Cost. zonación", "Cost. IPO"]}
        alineDerecha={[1, 2, 3, 4]}>
        {disc.casos.map((k) => (
          <tr key={k.codigo}>
            <td className={td} title={k.codigo}>{corto(k.codigo)}</td>
            <td className={tdn}>{k.vertebrasZonacion}/{k.vertebrasZonacionMax}</td>
            <td className={tdn}>{k.vertebrasEat}/{k.vertebrasEatMax}</td>
            <td className={tdn}>{k.costillasZonacion}/{k.costillasZonacionMax}</td>
            <td className={tdn}>{k.costillasEat}/{k.costillasEatMax}</td>
          </tr>
        ))}
        {disc.casos.length === 0 && (
          <tr><td className={td} colSpan={5}>Sin discrepancias registradas.</td></tr>
        )}
      </Tabla>
      )}

      {a.diagnostico.filasConReconstruccionIncoherente > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <b>{a.diagnostico.filasConReconstruccionIncoherente} individuo(s)</b> con reconstrucción
          incoherente entre métricas: {a.diagnostico.codigosIncoherentes.join(", ")}.
        </div>
      )}
    </div>
  );
}
