"use client";

/**
 * Documento osteológico imprimible.
 *
 * Reemplaza al export por captura de pantalla (html2pdf.js): esto es un documento con
 * plantilla propia que el navegador imprime a PDF con texto vectorial real —
 * seleccionable, buscable, con encabezados de tabla que se repiten entre páginas.
 *
 * `?tipo=` completo (por defecto) · zonacion · eat
 */
import React, { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  seccionesZonacion, contextoZonacion, gruposEat, extremidadesEat, calidadEat,
  num, TOTAL_ZONAS, type Celda, type Seccion,
} from "@/lib/documento";
import { HOJA } from "./estilos";

type Dict = Record<string, unknown>;

const ELEMENTO: Record<string, string> = {
  cranium_zones: "Cráneo", mandible_zones: "Mandíbula", vertebrae_zones: "Vértebras",
  sacrum_zones: "Sacro", sternum_zones: "Esternón", clavicle_zones: "Clavícula",
  rib_zones: "Costillas", scapula_zones: "Escápula", humerus_zones: "Húmero",
  radius_zones: "Radio", ulna_zones: "Cúbito", os_coxae_zones: "Coxal",
  femur_zones: "Fémur", tibia_zones: "Tibia", fibula_zones: "Peroné",
  patella_zones: "Rótula", hand_zones: "Mano", foot_zones: "Pie",
};

function Marca({ v }: { v: Celda }) {
  if (v === null) return <span className="sin" title="no registrado">–</span>;
  return v ? <span className="si">✓</span> : <span className="no">·</span>;
}

function Metrica({ k, v, u }: { k: string; v: number | null | undefined; u?: string }) {
  return (
    <div className="metrica">
      <span className="k">{k}</span>
      <span className="v">{num(v)}</span>
      {u && v !== null && v !== undefined ? <span className="u">{u}</span> : null}
    </div>
  );
}

function Leyenda() {
  return (
    <div className="leyenda">
      <b><span className="si">✓</span> presente</b> · <b><span className="no">·</span> ausente</b>{" "}
      (registrado como no presente) · <b><span className="sin">–</span> sin registro</b>{" "}
      (la zona nunca se registró — no equivale a una ausencia).
    </div>
  );
}

function TablaSeccion({ s }: { s: Seccion }) {
  return (
    <section className={s.filas.length > 14 ? "larga" : undefined}>
      <h2>
        {s.titulo}
        <span className="cuenta">
          {s.presentes} / {s.total} zonas presentes{s.pct !== null ? ` · ${num(s.pct)} %` : ""}
        </span>
      </h2>
      {s.nota ? <div className="nota">{s.nota}</div> : null}
      <table>
        <thead>
          <tr>
            <th>Zona</th>
            {s.cols.map((c, i) => <th key={i} className="c">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {s.filas.map((f, i) => (
            <tr key={i}>
              <td>{f.etiqueta}</td>
              {f.celdas.map((c, j) => <td key={j} className="c"><Marca v={c} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ─────────────────────────── bloques ─────────────────────────── */

function BloqueZonacion({ ficha, conTitulo }: { ficha: Dict; conTitulo?: boolean }) {
  const data = (ficha.data ?? {}) as Dict;
  const met = (ficha.metricas ?? {}) as Dict;
  const secs = useMemo(() => seccionesZonacion(data), [data]);
  const ctx = useMemo(() => contextoZonacion(data), [data]);
  const porElemento = Object.entries((met.completitudPorElemento ?? {}) as Record<string, number>).sort();
  const mitad = Math.ceil(porElemento.length / 2);

  return (
    <>
      {conTitulo ? <h2 style={{ fontSize: "12.5pt" }}>Método de Zonación (Knüsel &amp; Outram)</h2> : null}
      <div className="nota">
        Registrado por <b>{String(ficha.registrador || "(sin registrador)")}</b>
        {ficha.fechaRegistro ? ` · fecha de registro ${String(ficha.fechaRegistro)}` : ""}
      </div>
      <div className="metricas">
        <Metrica k="Completitud global" v={met.completitudGlobal as number} u=" %" />
        <Metrica k="Zonas presentes" v={met.zonasPresentes as number} u={` / ${TOTAL_ZONAS}`} />
        <Metrica k="Elementos presentes" v={met.elementosPresentes as number} u=" / 18" />
      </div>

      <section>
        <h2>Completitud por elemento<span className="cuenta">18 elementos</span></h2>
        <table>
          <thead>
            <tr><th>Elemento</th><th className="n">Completitud</th><th>Elemento</th><th className="n">Completitud</th></tr>
          </thead>
          <tbody>
            {Array.from({ length: mitad }, (_, i) => {
              const a = porElemento[i], b = porElemento[i + mitad];
              return (
                <tr key={i}>
                  <td>{ELEMENTO[a[0]] ?? a[0]}</td><td className="n">{num(a[1])} %</td>
                  {b ? <><td>{ELEMENTO[b[0]] ?? b[0]}</td><td className="n">{num(b[1])} %</td></>
                     : <><td /><td /></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <Leyenda />
      {secs.map((s, i) => <TablaSeccion key={i} s={s} />)}

      <section>
        <h2>Contexto</h2>
        <table>
          <tbody>
            <tr><th style={{ width: "26%" }}>Unidad / rasgo</th><td>{ctx.unidadRasgo || "—"}</td></tr>
            <tr><th>Nivel / capa</th><td>{ctx.nivelCapa || "—"}</td></tr>
            {ctx.craneoObs ? <tr><th>Obs. de cráneo</th><td>{ctx.craneoObs}</td></tr> : null}
            {ctx.mandibulaObs ? <tr><th>Obs. lateralidad mandíbula</th><td>{ctx.mandibulaObs}</td></tr> : null}
          </tbody>
        </table>
      </section>
    </>
  );
}

function BloqueEat({ ficha, conTitulo }: { ficha: Dict; conTitulo?: boolean }) {
  const data = (ficha.data ?? {}) as Dict;
  const met = (ficha.metricas ?? {}) as Dict;
  const grupos = useMemo(() => gruposEat(data), [data]);
  const extremidades = useMemo(() => extremidadesEat(data), [data]);
  const calidad = useMemo(() => calidadEat(data), [data]);
  const unicos = grupos.filter((g) => g.tipo === "unico");
  const listas = grupos.filter((g) => g.tipo === "lista");

  return (
    <>
      {conTitulo ? <h2 style={{ fontSize: "12.5pt" }}>Método EAT (Serrulla &amp; Vázquez)</h2> : null}
      <div className="nota">
        Registrado por <b>{String(ficha.registrador || "(sin registrador)")}</b>
        {ficha.fechaRegistro ? ` · fecha de registro ${String(ficha.fechaRegistro)}` : ""}
      </div>
      <div className="metricas">
        <Metrica k="IPO" v={met.ipo as number} u=" %" />
        <Metrica k="ICH" v={met.ich as number} u=" %" />
        <Metrica k="EAT" v={met.eat as number} u=" %" />
        <Metrica k="Total presente" v={met.totalPresent as number} u=" %" />
      </div>
      <div className="leyenda">
        <b>EAT = 100 − (IPO × ICH) / 100.</b> El <b>IPO</b> mide presencia ósea y el <b>ICH</b> la
        calidad de los grupos <i>presentes</i> — un grupo sin hueso queda fuera del promedio del ICH.
      </div>

      {unicos.length ? (
        <section>
          <h2>Piezas únicas
            <span className="cuenta">{unicos.filter((u) => u.presente).length} / {unicos.length} presentes</span>
          </h2>
          <table>
            <thead><tr>{unicos.map((u) => <th key={u.titulo} className="c">{u.titulo}</th>)}</tr></thead>
            <tbody><tr>{unicos.map((u) => (
              <td key={u.titulo} className="c"><Marca v={u.presente ?? null} /></td>
            ))}</tr></tbody>
          </table>
        </section>
      ) : null}

      <Leyenda />

      {listas.map((g) => {
        const filas = Math.ceil(g.items.length / 4);
        return (
          <section key={g.titulo} className={g.items.length > 16 ? "larga" : undefined}>
            <h2>{g.titulo}<span className="cuenta">{g.presentes} / {g.total} presentes</span></h2>
            {g.items.length ? (
              <table>
                <thead>
                  <tr>{[0, 1, 2, 3].map((i) => (
                    <React.Fragment key={i}><th>Pieza</th><th className="c">Pres.</th></React.Fragment>
                  ))}</tr>
                </thead>
                <tbody>
                  {Array.from({ length: filas }, (_, r) => (
                    <tr key={r}>
                      {[0, 1, 2, 3].map((col) => {
                        const it = g.items[col * filas + r];
                        return it
                          ? <React.Fragment key={col}><td>{it.nombre}</td><td className="c"><Marca v={it.presente} /></td></React.Fragment>
                          : <React.Fragment key={col}><td /><td /></React.Fragment>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="vacio">Sin piezas registradas en este grupo.</p>}
          </section>
        );
      })}

      <section>
        <h2>Manos y pies<span className="cuenta">conteos por unidad anatómica</span></h2>
        <div className="nota">
          Las falanges de mano y pie se registran por dedo. Los conteos son los del registro;
          la conversión a unidades anatómicas puntuables la hace el backend.
        </div>
        <table>
          <thead><tr><th>Segmento</th><th>Campo</th><th className="n">Conteo</th></tr></thead>
          <tbody>
            {extremidades.map((ex) =>
              ex.filas.length
                ? ex.filas.map((f, i) => (
                    <tr key={`${ex.titulo}-${i}`}>
                      {i === 0 ? <td rowSpan={ex.filas.length}><b>{ex.titulo}</b></td> : null}
                      <td>{f.campo}</td><td className="n">{num(f.valor)}</td>
                    </tr>
                  ))
                : <tr key={ex.titulo}><td><b>{ex.titulo}</b></td>
                    <td colSpan={2} className="vacio">sin registro</td></tr>,
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Calidad ósea por grupo (ICH)<span className="cuenta">0 – 100</span></h2>
        <table>
          <thead><tr><th>Grupo anatómico</th><th className="n">Calidad</th><th>Observación</th></tr></thead>
          <tbody>
            {calidad.map((q) => (
              <tr key={q.grupo}><td>{q.grupo}</td><td className="n">{num(q.valor)}</td><td>{q.obs}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.observations ? (
        <section><h2>Observaciones generales</h2><div className="obs">{String(data.observations)}</div></section>
      ) : null}
    </>
  );
}

/* ─────────────────────────── página ─────────────────────────── */

export default function DocumentoPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params.id as Id<"individuos">;
  const tipo = (search.get("tipo") ?? "completo") as "completo" | "zonacion" | "eat";
  const data = useQuery(api.individuos.obtener, { id });

  if (data === undefined)
    return <div className="card p-10 text-center text-sm text-muted">Cargando…</div>;
  if (data === null)
    return (
      <div className="card p-12 text-center">
        <p className="text-muted">No se encontró el individuo.</p>
        <Link href="/individuos" className="btn btn-ghost mt-4">Volver</Link>
      </div>
    );

  const { individuo, fichas } = data as { individuo: Dict; fichas: Dict[] };
  const zon = fichas.find((f) => f.tipo === "zonacion");
  const eat = fichas.find((f) => f.tipo === "eat");
  const hoy = new Date().toLocaleDateString("es-ES");

  const titulo = tipo === "zonacion" ? "Ficha osteológica · Método de Zonación"
    : tipo === "eat" ? "Ficha osteológica · Método EAT"
    : "Informe osteológico del individuo";
  const sub = tipo === "zonacion" ? "Knüsel & Outram · 635 zonas · 18 elementos"
    : tipo === "eat" ? "Serrulla & Vázquez · Estado de Alteración Tafonómica"
    : "Registro Osteológico — los dos métodos y su comparación";

  const mz = (zon?.metricas ?? {}) as Dict;
  const me = (eat?.metricas ?? {}) as Dict;
  const delta = mz.completitudGlobal !== undefined && me.ipo !== undefined
    ? Math.round(((mz.completitudGlobal as number) - (me.ipo as number)) * 100) / 100
    : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HOJA }} />

      <div className="no-imprimir mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => window.print()} className="btn btn-primary">
          Imprimir / Guardar PDF
        </button>
        <Link href={`/individuos/${id}`} className="btn btn-ghost">Volver al individuo</Link>
        <span className="ml-auto flex gap-2 text-xs">
          <Link href={`/individuos/${id}/documento?tipo=completo`} className="btn btn-ghost">Informe completo</Link>
          <Link href={`/individuos/${id}/documento?tipo=zonacion`} className="btn btn-ghost">Solo Zonación</Link>
          <Link href={`/individuos/${id}/documento?tipo=eat`} className="btn btn-ghost">Solo EAT</Link>
        </span>
      </div>

      <div className="doc">
        <div className="doc-head">
          <div className="tipo">{titulo}</div>
          <h1>{String(individuo.codigoCanonico)}</h1>
          <div className="sub">{sub}</div>
        </div>

        <div className="identidad">
          <div className="ancho"><span className="k">Código canónico</span>
            <span className="v">{String(individuo.codigoCanonico)}</span></div>
          <div><span className="k">Sitio</span><span className="v">{String(individuo.sitio)}</span></div>
          <div><span className="k">Año de excavación</span><span className="v">{String(individuo.anioExcavacion)}</span></div>
          <div><span className="k">Fosa</span><span className="v">{String(individuo.numeroFosa || "—")}</span></div>
          <div><span className="k">Unidad funeraria</span><span className="v">{String(individuo.codigoUF || "—")}</span></div>
          <div><span className="k">Individuo</span><span className="v">{String(individuo.numeroIndividuo)}</span></div>
          <div><span className="k">Sexo estimado</span><span className="v">{String(individuo.sexoEstimado || "—")}</span></div>
          <div><span className="k">Edad estimada</span><span className="v">{String(individuo.edadEstimada || "—")}</span></div>
          <div><span className="k">Observaciones</span><span className="v">{String(individuo.observaciones || "—")}</span></div>
        </div>

        {tipo === "completo" && zon && eat ? (
          <section>
            <h2>Síntesis comparada<span className="cuenta">Zonación · EAT</span></h2>
            <div className="metricas">
              <Metrica k="Completitud (Zonación)" v={mz.completitudGlobal as number} u=" %" />
              <Metrica k="IPO (EAT)" v={me.ipo as number} u=" %" />
              <Metrica k="ICH (EAT)" v={me.ich as number} u=" %" />
              <Metrica k="EAT" v={me.eat as number} u=" %" />
            </div>
            <table>
              <thead><tr><th>Indicador</th><th className="n">Valor</th><th>Qué mide</th></tr></thead>
              <tbody>
                <tr><td>Completitud global (Zonación)</td><td className="n">{num(mz.completitudGlobal as number)} %</td>
                    <td>Zonas presentes sobre las {TOTAL_ZONAS} del método</td></tr>
                <tr><td>Zonas presentes</td><td className="n">{num(mz.zonasPresentes as number)} / {TOTAL_ZONAS}</td>
                    <td>Recuento directo del registro</td></tr>
                <tr><td>Elementos presentes</td><td className="n">{num(mz.elementosPresentes as number)} / 18</td>
                    <td>Elementos con al menos una zona presente</td></tr>
                <tr><td>IPO</td><td className="n">{num(me.ipo as number)} %</td><td>Índice de presencia ósea (EAT)</td></tr>
                <tr><td>ICH</td><td className="n">{num(me.ich as number)} %</td><td>Índice de calidad ósea de los grupos presentes</td></tr>
                <tr><td><b>EAT</b></td><td className="n"><b>{num(me.eat as number)} %</b></td>
                    <td>Estado de alteración tafonómica: 100 − (IPO × ICH) / 100</td></tr>
                {delta !== null ? (
                  <tr><td>Diferencia completitud − IPO</td><td className="n">{num(delta)} pts</td>
                      <td>Concordancia entre métodos para este individuo</td></tr>
                ) : null}
              </tbody>
            </table>
            <div className="nota">
              Los dos métodos miden cosas distintas: la Zonación registra <i>qué partes hay</i> zona por
              zona; el EAT combina presencia (IPO) con calidad de conservación (ICH). Una diferencia
              entre ambos no es un error: suele señalar huesos seriados fragmentados que un método
              captura y el otro no.
            </div>
          </section>
        ) : null}

        {(tipo === "completo" || tipo === "zonacion") && zon ? (
          <>
            {tipo === "completo" ? <div className="salto" /> : null}
            <BloqueZonacion ficha={zon} conTitulo={tipo === "completo"} />
          </>
        ) : null}

        {(tipo === "completo" || tipo === "eat") && eat ? (
          <>
            {tipo === "completo" ? <div className="salto" /> : null}
            <BloqueEat ficha={eat} conTitulo={tipo === "completo"} />
          </>
        ) : null}

        {!zon && !eat ? <p className="vacio">Este individuo no tiene fichas cargadas.</p> : null}

        <div className="pie-doc">
          Registro Osteológico — documento generado el {hoy} desde la base de datos de la aplicación.
          Las métricas son las calculadas y almacenadas por el sistema; no se recalculan para este
          documento. La mandíbula se reporta sobre 7 zonas-tipo y el sacro sobre 4, conforme a la
          corrección metodológica vigente.
        </div>
      </div>
    </>
  );
}
