# Metodología — Registro Osteológico

Fundamento científico de los dos métodos, su implementación cuantitativa en el sistema, y
el diseño del análisis comparativo. Complementa a [`arquitectura.md`](./arquitectura.md).

---

## 1. Contexto

La valoración del **estado de preservación** y la **fragmentación** de restos óseos es
central en antropología forense y bioarqueología: condiciona qué conclusiones pueden
sostenerse y permite inferir procesos tafonómicos y tratamiento funerario. El sistema
integra dos métodos complementarios por individuo:

- **Zonación** (cuantitativo, objetivo) — qué partes de cada hueso están presentes.
- **EAT** (semicuantitativo) — cuánto esqueleto hay y en qué calidad; incorpora un índice
  subjetivo (ICH).

---

## 2. Método de Zonación — Knüsel & Outram (2004)

Sistema de registro de restos **fragmentados y mezclados (commingled)**. Cada elemento óseo
se divide en **zonas anatómicas estandarizadas**; se registra la presencia de cada zona por
lado (Izq/Der). Es la base para cuantificar fragmentación y representación.

### 2.1 Zonas por elemento (máximos)

> **Nota metodológica.** Los máximos por elemento son la **operacionalización** del sistema
> de Knüsel & Outram (2004) en este software, **no cifras canónicas** del paper (K&O define el
> esquema de zonas por hueso, pero no publica un "total" único). El total que usa el sistema
> como denominador de completitud es una decisión de implementación, sujeta a revisión a
> medida que se afina la fidelidad al método.

| Elemento | Zonas | Elemento | Zonas |
|----------|------:|----------|------:|
| Cráneo | 15 | Cúbito | 18 |
| Mandíbula | 7 | Coxal | 24 |
| Vértebras (C/T/L) | 96 | Fémur | 22 |
| Sacro | 4 | Tibia | 20 |
| Esternón | 3 | Peroné | 12 |
| Clavícula | 6 | Mano | 130 |
| Costillas | 72 | Pie | 142 |
| Escápula | 18 | Rótula | 2 |
| Húmero | 22 | **Total** | **635** |
| Radio | 22 | | |

**Corrección metodológica 2026-06** (alineación con K&O contra una implementación previa de
658 zonas):
- **Sacro: 20 → 4 zonas.** K&O (Fig. 2d) define el sacro con **4 zonas-tipo** (cuerpo, ala
  derecha, ala izquierda, cresta/espinosa), no como 5 segmentos × 4. Las claves del sistema
  pasan de `S{1..5}_z{1..4}` a `sac_z{1..4}`.
- **Mandíbula: 14 → 7 zonas.** La completitud cuenta las **7 zonas-tipo** K&O; el lado
  (izq/der) se registra como **observación de lateralidad asociada**, no en el denominador
  (K&O p.87: el lado del que deriva el fragmento se anota como atributo, no duplica el conteo
  de zonas). Las claves pasan de `mand_{1..7}_{L|R}` a `mand_z{1..7}` (OR de ambos lados) +
  `mandibula_lateralidad_obs`.
- **Rótula: elemento propio.** Sale de "pie" (`fPatella_L/R` dentro de `foot_zones`) a
  elemento independiente `patella_zones` (`pat_L`, `pat_R`). Pie pasa de 144 a 142; rótula
  aporta 2. Neto sobre el total: 0.
- **Fusión solo en epífisis.** El estado de fusión (F/PUF/DUF) se registra únicamente en las
  zonas **epifisarias** de cada hueso largo; la fusión no entra en el cómputo de completitud.

> **Futuro — mandíbula a 13 zonas (propuesta a mediano plazo).** El esquema correcto para
> capturar lateralidad **sin perder información ni duplicar la sínfisis** sería **13 zonas**:
> 6 zonas bilaterales × 2 lados (12) + 1 zona de línea media única (sínfisis). El esquema de
> 14 zonas previo contaba la sínfisis dos veces (`mand_7_L` y `mand_7_R` para una estructura
> medial única). Por ahora se adopta la Opción A (7 zonas-tipo + observación de lateralidad)
> por comparabilidad del denominador; la propuesta de 13 queda documentada para una iteración
> posterior. (Ver también `sources/VALIDACION-METODOLOGICA.md`.)

### 2.2 Métricas derivadas
- **Completitud global** = zonas presentes / 635 × 100. Las falanges de mano y pie se
  registran **por dedo** (I–V × posición × 3 zonas × lado); el dedo I no tiene falange medial,
  por lo que hay 14 falanges por lado (5 proximales + 4 mediales + 5 distales).
- **Completitud por elemento** = zonas presentes / máximo del elemento × 100
  (porcentaje de completitud, *sensu* Morlan 1994).
- **Elementos presentes** = elementos con ≥ 1 zona (de 18, con la rótula como elemento propio).
- **FFI (Fracture Freshness Index, Outram)** — por fragmento de diáfisis: contorno + ángulo
  + textura, **0–2 cada uno → 0–6**. **0–2 = fractura fresca (perimortem); ≥ 3 = hueso seco
  (postmortem).** Se resume como {n, media, frescas, secas}.
- **Alteraciones tafonómicas** — raíces, roedores, carnívoros, meteorización, manganeso,
  óxido de hierro, corte, fuego, abrasión, concreciones, descamación.
- **Fragmentos no identificables** — por tipo (axial/apendicular/indeterminado) y clase de
  tamaño.
- **Estado de fusión** (F/PUF/DUF) en huesos largos → información de edad. Se registra
  **solo en las zonas epifisarias** de cada hueso (la fusión ocurre en las epífisis, no en la
  diáfisis) y **no entra en el cómputo de completitud**.

> A nivel de **conjunto** (varios individuos) la Zonación habilita MNE, MNI y NISP. En este
> sistema esas agregaciones se ubican en la capa de análisis (ver §4 y `escalado.md`).

---

## 3. EAT — Serrulla & Vázquez (2019)

Método de antropología **forense** para expresar cuánto esqueleto se valoró y en qué
calidad — clave para comunicar la fiabilidad de las conclusiones. Combina un índice de
**presencia** y un índice de **calidad** de forma **multiplicativa** (§3.2).

> **Nota terminológica — «IPO» e «ICH» no son acrónimos de los autores.** El artículo de
> Serrulla & Vázquez (2019) abrevia únicamente «EAT»; nunca escribe «IPO» ni «ICH». Ambas
> siglas provienen de **TCA Arqueología (2021)** (ref. 7) y se adoptan acá como
> **convención de uso posterior**, por comodidad expositiva. No deben atribuirse a los
> autores del método.

### 3.1 Componentes
- **IPO — Índice de Preservación Ósea** (objetivo) = huesos presentes / **115** × 100.
  Grupos y máximos: cráneo 18, vértebras 32, huesos largos 14, huesos planos 7, costillas
  24, mandíbula 1, hioides 1, **manos 8, pies 10**.
  Manos y pies se **ponderan por unidad anatómica** (cada unidad aporta por igual; máx. 4
  pts/mano y 5 pts/pie), no por conteo bruto de huesos → detalle de la partición en §3.3.
- **ICH — Índice de Calidad del Hueso** (subjetivo) = promedio de la calidad estimada
  (0–100 %) de los **grupos con huesos presentes** (los grupos sin presencia se omiten del
  promedio).

**El denominador 115 no es una elección nuestra ni una suma arbitraria de grupos:** los
autores lo declaran en su planilla de cálculo, tomado del recuento de elementos óseos de
**Walker, Johnson & Lambert (1988)** (ref. 6) — el mismo trabajo de sesgos de preservación
que ya está en la bibliografía. Se replica tal cual (`EAT_IPO_MAX = 115`).

**La rótula se cuenta en HUESOS PLANOS** (7 = escápula ×2 + esternón + coxal ×2 +
**rótula ×2**). Es evidencia primaria de la planilla de los autores, no una interpretación.
Constituye la **excepción autorizada** a la regla general de este sistema de separar la
rótula de manos y pies: en la **Zonación** (K&O) la rótula sí es un elemento propio
(`patella_zones`, §2.1), pero en el **EAT** entra en el grupo de huesos planos, porque así
lo hacen los autores y el denominador 115 depende de ello.

### 3.2 Fórmula del EAT — corrección importante

> El sistema **corrigió** la fórmula respecto de una implementación previa que usaba un
> promedio aditivo (`100 − (IPO+ICH)/2`). La fórmula correcta, **verificada contra la
> planilla original** (celda `J5 = 1 − H5*H17`) y el ejemplo publicado (IPO 16 %, ICH 80 %
> → EAT 87 %), es **multiplicativa**:

```
EAT = 100 − (IPO × ICH) / 100
```

Interpretación: la preservación efectiva es el producto de *presencia* × *calidad* — solo
se "tiene" información útil de un hueso si está presente **y** en buena calidad. Escala de
color (semáforo): 0–20 muy buen estado … 81–100 muy mal estado.

### 3.3 Unidades anatómicas de mano y pie (corrección 2026-08-02)

Manos y pies **no** se puntúan por conteo bruto de huesos: se dividen en **unidades
anatómicas** y cada unidad aporta **como máximo 1 punto**. Ésta es la partición de los
autores, verificada contra el diagrama coloreado de mano/pie de su planilla:

```
MANO — 4 U.A., máx 4 pts/mano:
  carpianos /8 · metacarpianos /5 · fal. PROXIMALES /5 · (fal. medias + distales) /9

PIE — 5 U.A., máx 5 pts/pie:
  calcáneo /1 · astrágalo /1 · resto del tarso /5 · metatarsianos /5 · (todas las falanges) /10
```

El coeficiente de cada unidad es:

```
coef = min(1, huesos presentes de la unidad / total de la unidad)
```

y el aporte de la extremidad al IPO es la suma de los coeficientes de sus unidades. El
**denominador global no cambia**: manos 8 pts + pies 10 pts, `EAT_IPO_MAX = 115` sigue
igual. Lo que se corrigió es **qué hueso entra en qué unidad**, no el total.

> **Qué estaba mal.** La implementación previa agrupaba **al revés** en ambas extremidades:
> en la mano juntaba proximales + medias `/9` y dejaba las distales solas `/5` (invirtiendo
> las U.A. 3 y 4); en el pie trataba el tarso como **una sola unidad `/7`** y repartía las
> falanges en **tres** unidades. El efecto no era neutro: la fuente carga el peso en los
> huesos grandes y densos (tarso = 60 % del pie), y la versión previa lo cargaba en las
> falanges (60 %), que son lo primero que se pierde — penalizando el IPO justamente en los
> restos más fragmentarios. Caso ilustrativo: un pie con solo calcáneo y astrágalo daba
> `min(1, 2/7) = 0,29` pts en vez de los **2,0** pts de la fuente.
>
> El chequeo agregado no lo detectaba porque **ambas particiones dan la misma cantidad de
> unidades y el mismo máximo por extremidad**; lo que difería era el reparto interno. Por eso
> `sources/VALIDACION-METODOLOGICA.md` había declarado el EAT «todo verificado» por error;
> la corrección está registrada en su **§A.1** (hallazgo 2026-08-01). La partición fiel se
> desplegó el **2026-08-02** y el histórico se migró.

El contrato de campos (nombres de clave, máximos, a qué unidad aporta cada uno) es único y
vive en `convex/lib/eatUnits.ts`; el formulario, las métricas y el export de datos lo
consumen de ahí, no hardcodean listas propias.

### 3.4 Inconsistencias de la fuente — se declaran, no se corrigen

🔒 **Principio rector:** se prioriza **ser fiel a los autores**, marcando las
inconsistencias y los puntos a mejorar. No se "arregla" el método publicado: se replica y se
documenta la rareza. Un índice ajustado a criterio propio **deja de ser comparable** con
cualquier otro estudio que use el EAT, y la comparabilidad es la razón de usar un método
publicado.

| # | Inconsistencia de la fuente | Qué hace el sistema |
|---|-----------------------------|---------------------|
| 1 | Las **falanges del pie** puntúan con denominador **`/10`** cuando anatómicamente son **14** (5 proximales + 4 medias + 5 distales). Un pie con 11–14 falanges satura en 1,0. | Se **capturan las 14** (más información para la tesis) y se **puntúa sobre 10** (fidelidad). |
| 2 | El **pie de la fuente suma 22 huesos** (1+1+5+5+10) cuando el pie tiene **26**. Los denominadores de puntuación no cierran con la anatomía. | Se replica: el total de captura es 26, la suma de denominadores de puntuación es 22. La diferencia es de la fuente, no un bug de implementación. |
| 3 | El artículo **nunca imprime la fórmula del EAT en prosa**. Su frase de «valoración conjunta al **50 %**» de ambos índices es **engañosa**: sugiere un promedio, y la fórmula real (recuperada de la planilla, `J5 = 1−H5*H17`) es multiplicativa. Es el **origen probable** del error del promedio aditivo corregido en §3.2. | Se usa la fórmula multiplicativa verificada y se deja constancia de que la frase del artículo no la describe. |
| 4 | Los acrónimos **«IPO»** e **«ICH»** no son de los autores (ver nota terminológica al inicio de §3). | Se usan como convención posterior (TCA Arqueología 2021), sin atribuírselos a Serrulla & Vázquez. |

### 3.5 Nota metodológica — el supuesto de derivación del histórico

La partición correcta (§3.3) **corta al medio** dos conteos agregados que el sistema venía
guardando (`tarsianos` 0..7 y `falProxMedias` 0..9): esos campos registran *cuántos* huesos
hay, no *cuáles*. Para migrar las fichas históricas sin volver a examinar los restos se
aplicó un **supuesto tafonómico declarado**, el *best-case*: **los huesos de mayor tamaño y
densidad se preservan y se recuperan primero** (p. ej. `tarsianos = 4` → calcáneo 1 +
astrágalo 1 + resto del tarso 2). Es el orden esperado según la atrición mediada por
densidad (ref. 5), pero **es un supuesto, no una observación**.

Alcance y sensibilidad del backfill (2026-08-02):

| | |
|---|---|
| Fichas EAT con al menos un lado derivado bajo supuesto | **27 de 60** |
| Lados (mano/pie individuales) derivados bajo supuesto | **39** |
| Banda de sensibilidad best/worst — IPO, promedio | **0,19 pp** |
| Banda de sensibilidad best/worst — IPO, peor caso individual | **2,32 pp** |

Efecto total de la corrección de la partición sobre las 60 fichas: **IPO 80,05 → 81,17**;
**EAT 32,28 → 31,34**; **ICH sin cambio** (el ICH no depende de la partición). La banda de
sensibilidad es **un orden de magnitud menor** que el efecto de la corrección, así que el
supuesto no gobierna el resultado.

La traza queda **por ficha y por lado** en `data.eatDerivation` (estado, conteo de origen,
valores derivados, si el lado es ambiguo). Un lado re-registrado a mano en el formulario
pasa a `registrado` y **sale** del análisis de sensibilidad: la nota metodológica de la
tesis se recalcula sola a medida que Martina verifique fichas contra los restos.

---

## 4. Análisis comparativo (objetivo C4)

Comparar los resultados de ambos métodos a nivel **individuo, población y total**,
considerando que la Zonación es cuantitativa y el EAT incorpora un índice subjetivo (ICH),
para evaluar si correlacionan.

### 4.1 La cautela metodológica
El **IPO** (dentro del EAT) y la **completitud** (Zonación) miden ambos *presencia*: una
correlación cruda entre EAT y Zonación es alta **por construcción**, no por hallazgo. La
pregunta científica real es si el **componente subjetivo (ICH)** está anclado en la realidad
objetiva.

### 4.2 Hipótesis
| # | Hipótesis | Compara | Esperado |
|---|-----------|---------|----------|
| H1 | Validez convergente de presencia | completitud ↔ IPO | correlación fuerte (control) |
| H2 | Divergencia del EAT vs lo objetivo | EAT ↔ afectación (100 − completitud) | divergencia atribuible al ICH |
| H3 | ¿El ICH está fundamentado? | ICH ↔ medidas objetivas (completitud, FFI), **controlando IPO** | si correlaciona, el ICH captura señal real |
| H4 | Confiabilidad inter-observador del ICH | ICH del mismo individuo por distintos valoradores | requiere multiobservador (ver `escalado.md`) |

### 4.3 Estadística
- **Spearman ρ** (no paramétrico, robusto a n chico) — implementado en `analisis.comparacion`;
  devuelve `null` con n < 3.
- Pendiente (documentado): **correlación parcial** para H3 (aislar el ICH del componente de
  presencia compartido), **Bland–Altman / CCC** para acuerdo, e **ICC / kappa ponderado**
  para H4.
- **Tamaño muestral:** los resultados se vuelven significativos a partir de ~20–30 individuos
  pareados. El sistema construye la *capacidad analítica*; la evidencia se acumula con la
  carga.

---

## 5. Referencias

1. Knüsel, C. J. & Outram, A. K. (2004). *Fragmentation: The Zonation Method Applied to
   Fragmented Human Remains from Archaeological and Forensic Contexts.* Environmental
   Archaeology 9, 85–97.
2. Serrulla Rech, F. & Vázquez López, R. A. (2019). *Método cuantitativo de valoración del
   estado de afectación tafonómica* [Nota técnica]. *Revista Internacional de Antropología y
   Odontología Forense*, 2(2), **46–51**. ISSN **2603-6797**. *(Sin DOI — la revista no
   asigna DOI.)*
3. Outram, A. K. (1998–2002). Fracture Freshness Index (bone fracture analysis).
4. Morlan, R. E. (1994). *Percent completeness* (fragmentación por elemento).
5. Lyman, R. L. *Bone density and density-mediated attrition* (supervivencia diferencial).
6. Walker, P. L., Johnson, J. R. & Lambert, P. M. (1988). *Age and sex biases in the
   preservation of human skeletal remains.* Am J Phys Anthropol 76, 183–188.
   → **Origen del denominador 115 del IPO**, declarado por Serrulla & Vázquez en su planilla
   de cálculo (§3.1).
7. TCA Arqueología (2021). Documentación de aplicación del EAT. → **Origen de los acrónimos
   «IPO» e «ICH»**, que el artículo de Serrulla & Vázquez no usa (§3, nota terminológica y
   §3.4 punto 4).
