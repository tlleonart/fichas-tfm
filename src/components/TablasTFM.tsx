"use client";

/**
 * Las Tablas 1–11 del TFM, dentro de la aplicación.
 *
 * Hasta ahora `/analisis` sólo mostraba cuatro correlaciones de Spearman: todo el
 * resto del análisis que el trabajo publica se calculaba por fuera, en planillas y
 * scripts verificados sesión a sesión. Esto consume `api.analisis.poblacional`, que
 * está cubierta por 66 tests pineados a los valores publicados.
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

/** Los valores de p muy chicos se reportan como en el trabajo. */
function p(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v < 0.0001) return "< 0,0001";
  return n(v, 4);
}

function Tabla({
  titulo, nota, cabeceras, children, alineDerecha = [],
}: {
  titulo: string;
  nota?: string;
  cabeceras: string[];
  children: React.ReactNode;
  alineDerecha?: number[];
}) {
  return (
    <section className="card p-5">
      <h3 className="font-serif text-base font-semibold text-ink">{titulo}</h3>
      {nota && <p className="mt-1 max-w-prose text-xs text-muted">{nota}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong">
              {cabeceras.map((c, i) => (
                <th
                  key={i}
                  className={`px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted ${
                    alineDerecha.includes(i) ? "text-right" : "text-left"
                  }`}
                >
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

  const filasDesc: [string, typeof d.ipo][] = [
    ["Completitud global (/635)", d.completitudGlobal],
    ["Completitud del núcleo (/363)", d.completitudNucleo],
    ["Completitud de manos y pies (/272)", d.completitudManosPies],
    ["IPO", d.ipo],
    ["ICH", d.ich],
    ["EAT", d.eat],
  ];

  const conc: [string, string, string][] = [
    ["r de Pearson", n(c.global.rPearson, 3), n(c.nucleo.rPearson, 3)],
    ["CCC de Lin", n(c.global.cccLin, 3), n(c.nucleo.cccLin, 3)],
    ["Sesgo (Bland-Altman)", n(c.global.sesgo), n(c.nucleo.sesgo)],
    ["Amplitud LoA 95 %", n(c.global.amplitudLoA95), n(c.nucleo.amplitudLoA95)],
    ["Discrepancia máxima", n(c.global.discrepanciaMaximaAbs), n(c.nucleo.discrepanciaMaximaAbs)],
  ];

  const nucleoNoSignificativo =
    c.nucleo.pendienteP !== null && c.nucleo.pendienteP >= 0.05;

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-serif text-xl font-semibold text-ink">Análisis poblacional del TFM</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Las tablas que el trabajo publica, calculadas por la aplicación sobre los datos
          cargados. Antes vivían en planillas externas.
        </p>
      </header>

      <Tabla
        titulo="Tabla 1 — Descriptivos globales"
        cabeceras={["Índice", "n", "Media ± DE", "Mediana", "Mín", "Máx"]}
        alineDerecha={[1, 2, 3, 4, 5]}
      >
        {filasDesc.map(([lbl, v]) => (
          <tr key={lbl}>
            <td className={td}>{lbl}</td>
            <td className={tdn}>{v.n}</td>
            <td className={tdn}>{n(v.media)} ± {n(v.de)}</td>
            <td className={tdn}>{n(v.mediana)}</td>
            <td className={tdn}>{n(v.min)}</td>
            <td className={tdn}>{n(v.max)}</td>
          </tr>
        ))}
      </Tabla>

      <Tabla
        titulo="Tabla 2 — ICH por sitio"
        nota="La dispersión del ICH es de otro orden en un sitio que en los otros: es el efecto techo que discute el trabajo."
        cabeceras={["Sitio", "n", "ICH (media ± DE)"]}
        alineDerecha={[1, 2]}
      >
        {a.ichPorSitio.map((s) => (
          <tr key={s.sitio}>
            <td className={td}>{s.sitio}</td>
            <td className={tdn}>{s.n}</td>
            <td className={tdn}>{n(s.media)} ± {n(s.de)}</td>
          </tr>
        ))}
      </Tabla>

      <Tabla
        titulo="Tablas 3 y 4 — Concordancia entre Zonación e IPO"
        nota={`Global sobre ${c.global.denominador} zonas · núcleo sobre ${c.nucleo.denominador}. Manos y pies casi no entran en el IPO: al sacarlos, la concordancia sube.`}
        cabeceras={["Estadístico", "Global (/635)", "Núcleo (/363)"]}
        alineDerecha={[1, 2]}
      >
        {conc.map(([lbl, g, nu]) => (
          <tr key={lbl}>
            <td className={td}>{lbl}</td>
            <td className={tdn}>{g}</td>
            <td className={tdn}>{nu}</td>
          </tr>
        ))}
        <tr>
          <td className={td}>Pendiente del sesgo</td>
          <td className={tdn}>
            {n(c.global.pendiente, 3)} <span className="text-faint">(p {p(c.global.pendienteP)})</span>
          </td>
          <td className={tdn}>
            {n(c.nucleo.pendiente, 3)} <span className="text-faint">(p = {n(c.nucleo.pendienteP, 3)})</span>
          </td>
        </tr>
      </Tabla>

      {nucleoNoSignificativo && (
        <div className="rounded-lg border border-line-strong bg-surface-2 px-4 py-3 text-sm">
          <b className="text-ink">La pendiente residual sobre el núcleo queda en el límite de la significación</b>{" "}
          <span className="text-muted">
            (p = {n(c.nucleo.pendienteP, 3)}, n = {c.nucleo.n}): no alcanza el umbral convencional de
            0,05. En el control que excluye los casos de completitud extrema
            (n = {c.controlSinExtremos.nucleo.n}) la pendiente es {n(c.controlSinExtremos.nucleo.pendiente, 3)}{" "}
            con p = {n(c.controlSinExtremos.nucleo.pendienteP, 3)}.
          </span>
        </div>
      )}

      <Tabla
        titulo="Tabla 5 — EAT en función de IPO e ICH"
        nota="El incremento de R² es lo que mide si el ICH aporta información propia, no redundante con la sola presencia ósea."
        cabeceras={["Magnitud", "Valor"]}
        alineDerecha={[1]}
      >
        <tr><td className={td}>Diferencia media entre EAT y (100 − IPO)</td>
            <td className={tdn}>{n(a.relacionEatIpoIch.diferenciaMediaEatVsPresencia)} pts (± {n(a.relacionEatIpoIch.deDiferencia)})</td></tr>
        <tr><td className={td}>… como proporción del EAT medio</td>
            <td className={tdn}>{n(a.relacionEatIpoIch.pctDelEatMedio, 1)} %</td></tr>
        <tr><td className={td}>ρ de Spearman, ICH ↔ IPO</td>
            <td className={tdn}>{n(a.relacionEatIpoIch.rhoIchIpo, 3)}</td></tr>
        <tr><td className={td}>R² del EAT explicado sólo por el IPO</td>
            <td className={tdn}>{n(a.relacionEatIpoIch.r2EatPorIpo, 3)}</td></tr>
        <tr><td className={td}>R² del EAT explicado sólo por el ICH</td>
            <td className={tdn}>{n(a.relacionEatIpoIch.r2EatPorIch, 3)}</td></tr>
        <tr><td className={td}>R² con ambos predictores</td>
            <td className={tdn}>{n(a.relacionEatIpoIch.r2Conjunto, 3)}</td></tr>
        <tr><td className={`${td} font-semibold text-ink`}>Incremento de R² que aporta el ICH</td>
            <td className={`${tdn} font-semibold text-ink`}>{n(a.relacionEatIpoIch.incrementoR2, 3)}</td></tr>
      </Tabla>

      <Tabla
        titulo="Tabla 6 — Efecto del sitio (Kruskal-Wallis)"
        nota="η²_H es el tamaño de efecto. El sitio pesa mucho más sobre los índices del EAT y sobre el núcleo que sobre la completitud global, donde manos y pies diluyen la señal."
        cabeceras={["Índice", "H", "gl", "η²_H", "p"]}
        alineDerecha={[1, 2, 3, 4]}
      >
        {a.variabilidadPorSitio.map((k) => (
          <tr key={k.variable}>
            <td className={td}>{k.variable}</td>
            <td className={tdn}>{n(k.H)}</td>
            <td className={tdn}>{k.gl}</td>
            <td className={tdn}>{n(k.etaCuadradoH, 3)}</td>
            <td className={tdn}>{p(k.p)}</td>
          </tr>
        ))}
      </Tabla>

      <Tabla
        titulo="Tabla 7 — Completitud por elemento"
        nota="«% en 0» y «% en 100» son la proporción de individuos en cada extremo. El peso es la participación del elemento en las 635 zonas."
        cabeceras={["Elemento", "Tejido", "Completitud media", "% en 0", "% en 100", "Peso"]}
        alineDerecha={[2, 3, 4, 5]}
      >
        {[...a.porElemento]
          .sort((x, y) => y.completitudMedia - x.completitudMedia)
          .map((e) => (
            <tr key={e.clave}>
              <td className={td}>{e.etiqueta}</td>
              <td className={`${td} text-xs text-muted`}>{e.tejido}</td>
              <td className={tdn}>{n(e.completitudMedia)} %</td>
              <td className={tdn}>{n(e.pctEn0, 1)} %</td>
              <td className={tdn}>{n(e.pctEn100, 1)} %</td>
              <td className={tdn}>{n(e.pctDelDenominador, 2)} %</td>
            </tr>
          ))}
      </Tabla>

      {a.corticalVsEsponjoso !== null && (() => {
        const cve = a.corticalVsEsponjoso;
        return (
      <Tabla
        titulo="Tejido cortical frente a esponjoso (Mann-Whitney)"
        nota="El orden de conservación sigue la densidad ósea — el principio que el trabajo cita como marco interpretativo, contrastado sobre los datos propios."
        cabeceras={["Grupo", "n elementos", "Completitud media"]}
        alineDerecha={[1, 2]}
      >
        <tr><td className={td}>Cortical</td>
            <td className={tdn}>{cve.nCortical}</td>
            <td className={tdn}>{n(cve.mediaCortical, 1)} %</td></tr>
        <tr><td className={td}>Esponjoso</td>
            <td className={tdn}>{cve.nEsponjoso}</td>
            <td className={tdn}>{n(cve.mediaEsponjoso, 1)} %</td></tr>
        <tr><td className={`${td} font-semibold text-ink`}>U de Mann-Whitney</td>
            <td className={tdn} />
            <td className={`${tdn} font-semibold text-ink`}>
              {n(cve.U, 0)} (p = {n(cve.pDosColas, 4)})
            </td></tr>
      </Tabla>
        );
      })()}

      {a.manosPiesVsNucleo.wilcoxonPorSitio.length > 0 && (
        <Tabla
          titulo="Manos y pies frente al núcleo (Wilcoxon pareado, por sitio)"
          nota={`Comparación intra-individuo. Criterio del subconjunto: ${a.manosPiesVsNucleo.criterio}.`}
          cabeceras={["Sitio", "n", "Manos y pies", "Núcleo", "Brecha", "p", "Con m+p mayor"]}
          alineDerecha={[1, 2, 3, 4, 5, 6]}
        >
          {a.manosPiesVsNucleo.wilcoxonPorSitio.map((w) => (
            <tr key={w.sitio}>
              <td className={td}>{w.sitio}</td>
              <td className={tdn}>{w.n}</td>
              <td className={tdn}>{n(w.manosPiesMedia, 1)} %</td>
              <td className={tdn}>{n(w.nucleoMedia, 1)} %</td>
              <td className={tdn}>{n(w.brechaPp, 1)} pp</td>
              <td className={tdn}>{p(w.p)}</td>
              <td className={tdn}>{w.individuosManosPiesMayor} / {w.n}</td>
            </tr>
          ))}
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
