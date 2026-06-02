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
| Elemento | Zonas | Elemento | Zonas |
|----------|------:|----------|------:|
| Cráneo | 15 | Cúbito | 18 |
| Mandíbula | 14 | Coxal | 24 |
| Vértebras (C/T/L) | 96 | Fémur | 22 |
| Sacro | 20 | Tibia | 20 |
| Esternón | 3 | Peroné | 12 |
| Clavícula | 6 | Mano | 64 |
| Costillas | 72 | Pie | 78 |
| Escápula | 18 | **Total** | **526** |
| Húmero | 22 | | |
| Radio | 22 | | |

### 2.2 Métricas derivadas
- **Completitud global** = zonas presentes / 526 × 100.
- **Completitud por elemento** = zonas presentes / máximo del elemento × 100
  (porcentaje de completitud, *sensu* Morlan 1994).
- **Elementos presentes** = elementos con ≥ 1 zona (de 17).
- **FFI (Fracture Freshness Index, Outram)** — por fragmento de diáfisis: contorno + ángulo
  + textura, **0–2 cada uno → 0–6**. **0–2 = fractura fresca (perimortem); ≥ 3 = hueso seco
  (postmortem).** Se resume como {n, media, frescas, secas}.
- **Alteraciones tafonómicas** — raíces, roedores, carnívoros, meteorización, manganeso,
  óxido de hierro, corte, fuego, abrasión, concreciones, descamación.
- **Fragmentos no identificables** — por tipo (axial/apendicular/indeterminado) y clase de
  tamaño.
- **Estado de fusión** (PUF/DUF) en huesos largos → información de edad.

> A nivel de **conjunto** (varios individuos) la Zonación habilita MNE, MNI y NISP. En este
> sistema esas agregaciones se ubican en la capa de análisis (ver §4 y `escalado.md`).

---

## 3. EAT — Serrulla & Vázquez (2019)

Método de antropología **forense** para expresar cuánto esqueleto se valoró y en qué
calidad — clave para comunicar la fiabilidad de las conclusiones. Combina dos índices al
50% conceptual.

### 3.1 Componentes
- **IPO — Índice de Preservación Ósea** (objetivo) = huesos presentes / **115** × 100.
  Grupos y máximos: cráneo 18, vértebras 32, huesos largos 14, huesos planos 7, costillas
  24, mandíbula 1, hioides 1, **manos 8, pies 10**.
  Manos y pies se **ponderan por unidad anatómica** (cada unidad aporta por igual; máx. 4
  pts/mano y 5 pts/pie), no por conteo bruto de huesos.
- **ICH — Índice de Calidad del Hueso** (subjetivo) = promedio de la calidad estimada
  (0–100 %) de los **grupos con huesos presentes** (los grupos sin presencia se omiten del
  promedio).

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
   estado de afectación tafonómica.* Revista Internacional de Antropología y Odontología
   Forense, 2(2).
3. Outram, A. K. (1998–2002). Fracture Freshness Index (bone fracture analysis).
4. Morlan, R. E. (1994). *Percent completeness* (fragmentación por elemento).
5. Lyman, R. L. *Bone density and density-mediated attrition* (supervivencia diferencial).
6. Walker, P. L., Johnson, J. R. & Lambert, P. M. (1988). *Age and sex biases in the
   preservation of human skeletal remains.* Am J Phys Anthropol 76, 183–188.
