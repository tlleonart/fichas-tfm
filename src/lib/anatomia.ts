/**
 * Nomenclatura anatómica — nombres de zonas, piezas y grupos.
 *
 * ⚠️ GENERADO, no editar a mano. Sale de `labels.json`, que a su vez se extrae del
 * código de `ZonacionForm.tsx` y `EATForm.tsx` con
 * `projects/fichas-tfm/export-pdf-2026-09-07/extraer_labels.py`.
 *
 * Existe para que el documento imprimible use exactamente los mismos nombres que los
 * formularios sin tener que tocarlos. Los formularios siguen teniendo sus propias
 * constantes: consolidar ambas fuentes en esta es deuda anotada del rebuild, y no se
 * hizo ahora a propósito para no modificar el formulario de carga que Martina usa.
 */

export const CRANEO: Record<string, string> = {
  "1": "Frontal derecho (dividido sagitalmente por sutura metópica)",
  "2": "Frontal izquierdo",
  "3": "Parietal derecho",
  "4": "Parietal izquierdo",
  "5": "Occipital",
  "6": "Temporal izquierdo (incl. raíz del proceso cigomático)",
  "7": "Temporal derecho (incl. raíz del proceso cigomático)",
  "8": "Esfenoides izquierdo",
  "9": "Esfenoides derecho",
  "10": "Cigomático izquierdo",
  "11": "Cigomático derecho",
  "12": "Maxilar izquierdo (incl. proceso palatino)",
  "13": "Maxilar derecho (incl. proceso palatino)",
  "14": "Hueso nasal izquierdo",
  "15": "Hueso nasal derecho",
};

export const MANDIBULA: Record<string, string> = {
  "1": "Cuerpo: alveolos de premolares y molares",
  "2": "Cuerpo: alveolo del canino",
  "3": "Rama ascendente inferior al proceso coronoides",
  "4": "Proceso coronoides",
  "5": "Porción post. de la rama y cóndilo mandibular",
  "6": "Ángulo gonial, foramen mandibular, surco milohioideo (int.), inserción M. masetero (ext.)",
  "7": "Porción anterior del cuerpo: alveolos de incisivos",
};

export const VERTEBRA: Record<string, string> = {
  "1": "Cuerpo",
  "2": "Transv. der",
  "3": "Transv. izq",
  "4": "Espinosa",
};

export const VERTEBRA_COMPLETA: Record<string, string> = {
  "1": "Cuerpo vertebral",
  "2": "Proceso transverso derecho (incl. pedículo, pars interarticularis, facetas articulares)",
  "3": "Proceso transverso izquierdo (incl. pedículo, pars interarticularis, facetas articulares)",
  "4": "Proceso espinoso",
};

export const SACRO: Record<string, string> = {
  "sac_z1": "Cuerpo",
  "sac_z2": "Ala / proceso transverso derecho",
  "sac_z3": "Ala / proceso transverso izquierdo",
  "sac_z4": "Cresta / proceso espinoso",
};

export const ESTERNON: Record<string, string> = {
  "1": "Manubrio",
  "2": "Cuerpo (corpus sterni)",
  "3": "Proceso xifoides",
};

export const CLAVICULA: Record<string, string> = {
  "1": "Extremo esternal",
  "2": "Extremo acromial",
  "3": "Diáfisis",
};

export const COSTILLA: Record<string, string> = {
  "1": "Cabeza",
  "2": "Ángulo / tubérculo (facetas costales en C1-C10)",
  "3": "Cuerpo y extremo esternal",
};

export const ESCAPULA: Record<string, string> = {
  "1": "Proceso coracoides",
  "2": "Mitad superior cavidad glenoidea",
  "3": "Mitad inferior cavidad glenoidea",
  "4": "Extremo acromial y 1/3 axilar de la espina",
  "5": "1/3 axilar porción escamosa, cuello, área inf. al coracoides",
  "6": "1/3 medio porción escamosa sup. a espina, fosa supraespinosa",
  "7": "Mitad axilar porción escamosa inf. a espina, fosa infraespinosa",
  "8": "1/3 vertebral porción escamosa y espina, inserción M. romboides",
  "9": "Mitad vertebral porción escamosa inf. a espina",
};

export const HUMERO: Record<string, string> = {
  "1": "Tubérculos mayor y menor",
  "2": "Cabeza (caput)",
  "3": "Epicóndilo lateral",
  "4": "Epicóndilo medial",
  "5": "Capitulum (proc. art. lateral del cóndilo)",
  "6": "Tróclea (proc. art. medial del cóndilo)",
  "7": "Mitad lateral distal diáfisis, fosa olecraniana/radial",
  "8": "Mitad medial distal diáfisis, fosa olecraniana/coronoidea, for. nutricio",
  "9": "Área tuberosidad deltoidea",
  "10": "Área opuesta a Z9, mitad longitudinal diáfisis",
  "11": "Porción proximal diáfisis, cuello quirúrgico",
};

export const RADIO: Record<string, string> = {
  "1": "Mitad lateral cabeza radial",
  "2": "Mitad medial cabeza radial",
  "3": "Porción lateral articulación distal",
  "4": "Porción medial articulación distal",
  "5": "Porción proximal diáfisis, tuberosidad radial",
  "6": "Mitad lateral diáfisis hasta punto medio, inserción M. pronador redondo",
  "7": "Mitad medial diáfisis hasta punto medio, foramen nutricio",
  "8": "Mitad superior del tercio distal",
  "9": "Tercio distal lateral diáfisis",
  "10": "Tercio distal medial diáfisis",
  "J": "Proceso estiloides",
};

export const CUBITO: Record<string, string> = {
  "A": "Proceso olecraniano (porción 1)",
  "B": "Proceso olecraniano (porción 2)",
  "C": "Escotadura troclear/semilunar, proceso coronoides",
  "D": "Escotadura radial",
  "E": "Mitad proximal diáfisis distal a C, for. nutricio",
  "F": "Porción media diáfisis",
  "G": "Mitad superior 1/3 distal diáfisis",
  "H": "Mitad distal 1/3 distal, inserción M. pronador cuadrado",
  "J": "Proceso estiloides y cabeza, surco M. ext. carpi ulnaris",
};

export const COXAL: Record<string, string> = {
  "1": "Porción superior acetábulo y áreas adyacentes",
  "2": "Mitad post. porción inf. acetábulo",
  "3": "Mitad ant. porción inf. acetábulo",
  "4": "Porción sup. isquion, espina isquiática",
  "5": "Porción inf. ilion, escotadura ciática mayor",
  "6": "Porción sup. tuberosidad isquiática",
  "7": "Superficie auricular del ilion",
  "8": "Porción sup. pubis, línea pectínea, tubérculo púbico",
  "9": "Porción inf. pubis, sínfisis púbica",
  "10": "Porción mayor del ilion (sin cresta)",
  "11": "Porción inf. isquion, mayoría tuberosidad isquiática",
  "12": "Cresta ilíaca",
};

export const FEMUR: Record<string, string> = {
  "1": "Trocánter mayor",
  "2": "Área del trocánter menor",
  "3": "Inserción craneal M. glúteo máximo",
  "4": "Cabeza (caput)",
  "5": "Cuello, línea intertrocantérica (ant.), cresta intertrocantérica (post.)",
  "6": "Porción media diáfisis hasta bifurcación línea áspera, for. nutricio",
  "7": "Mitad lateral 1/3 distal diáfisis, mitad espacio poplíteo",
  "8": "Mitad medial 1/3 distal diáfisis, mitad espacio poplíteo",
  "9": "Cóndilo y epicóndilo lateral",
  "10": "Cóndilo y epicóndilo medial",
  "11": "Espacio intercondíleo y articulación distal anteriormente",
};

export const TIBIA: Record<string, string> = {
  "1": "Cóndilo proximal medial",
  "2": "Fosa intercondílea / espinas tibiales, inserción lig. cruzado post.",
  "3": "Cóndilo proximal lateral",
  "4": "Tuberosidad tibial",
  "5": "Maleólo medial",
  "6": "Maleólo lateral",
  "7": "1/4 proximal diáfisis, for. nutricio (post.)",
  "8": "2.º cuarto diáfisis",
  "9": "3.º cuarto diáfisis",
  "10": "4.º cuarto (distal) diáfisis",
};

export const PERONE: Record<string, string> = {
  "1": "Extremo proximal (epífisis), proceso estiloides",
  "2": "Extremo distal (epífisis)",
  "3": "1/4 más distal diáfisis, inserción lig. interóseo inf.",
  "4": "1/4 medio diáfisis, for. nutricio (post.)",
  "5": "2.º cuarto diáfisis",
  "6": "1/4 más proximal diáfisis",
};

export const MC_MT: Record<string, string> = {
  "1": "Articulación proximal",
  "2": "Cóndilo articular distal",
  "3": "Diáfisis",
};

export const CALCANEO: Record<string, string> = {
  "1": "Tuber calcis",
  "2": "Porción distal cuerpo",
  "3": "Sustentaculum tali",
  "4": "Articulación proximal",
  "5": "Porción prox. cuerpo inf. a articulación",
};

export const ASTRAGALO: Record<string, string> = {
  "1": "Mitad medial tróclea",
  "2": "Mitad lateral tróclea",
  "3": "Mitad medial porción prox.",
  "4": "Mitad lateral porción prox.",
};

export const CARPIANOS: Record<string, string> = {
  "TPM": "Trapecio",
  "TRD": "Trapezoide",
  "CAP": "Grande (capitatum)",
  "HAM": "Ganchoso (hamatum)",
  "SCP": "Escafoides",
  "LUN": "Semilunar",
  "TRI": "Piramidal",
  "PIS": "Pisiforme",
};

export const TARSIANOS: Record<string, string> = {
  "CU1": "Cuneiforme medial",
  "CU2": "Cuneiforme intermedio",
  "CU3": "Cuneiforme lateral",
  "NAV": "Navicular",
  "CUB": "Cuboides",
};

export const FALANGE_POS: Record<string, string> = {
  "P": "Proximal",
  "M": "Medial",
  "D": "Distal",
};

export const ALTERACIONES: Record<string, string> = {
  "root_marks": "Marcas de raíces",
  "rodent_marks": "Marcas de roedores",
  "carnivore_marks": "Marcas de carnívoros",
  "weathering": "Meteorización",
  "manganese": "Tinción de manganeso",
  "iron_oxide": "Óxido de hierro",
  "cut_marks": "Marcas de corte",
  "fire": "Exposición al fuego",
  "abrasion": "Abrasión",
  "concretions": "Concreciones",
  "cortical_flaking": "Descamación cortical",
  "other": "Otro",
};

export const CARPIANOS_ORDEN = ["TPM", "TRD", "CAP", "HAM", "SCP", "LUN", "TRI", "PIS"] as const;

export const TARSIANOS_ORDEN = ["CU1", "CU2", "CU3", "NAV", "CUB"] as const;

export const DEDOS: { d: string; pos: string[] }[] = [{"d": "I", "pos": ["P", "D"]}, {"d": "II", "pos": ["P", "M", "D"]}, {"d": "III", "pos": ["P", "M", "D"]}, {"d": "IV", "pos": ["P", "M", "D"]}, {"d": "V", "pos": ["P", "M", "D"]}];

export const EAT_GRUPOS_CALIDAD: Record<string, string> = {
  "craneo": "Cráneo",
  "vertebras": "Vértebras",
  "huesosLargos": "Huesos Largos",
  "huesosPlanos": "Huesos Planos",
  "costillas": "Costillas",
  "mandibula": "Mandíbula",
  "hioides": "Hioides",
  "manos": "Manos",
  "pies": "Pies",
};

export const EAT_CRANEO = ["Frontal", "Parietal der", "Parietal izq", "Occipital", "Temporal der", "Temporal izq", "Esfenoides", "Etmoides", "Malar der", "Malar izq", "Maxilar der", "Maxilar izq", "Nasal der", "Nasal izq", "Lacrimal der", "Lacrimal izq", "Palatino der", "Palatino izq"];

export const EAT_HUESOS_PLANOS = ["Escápula der", "Escápula izq", "Coxal der", "Coxal izq", "Rótula der", "Rótula izq", "Esternón"];

export const EAT_VERTEBRAS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "L1", "L2", "L3", "L4", "L5", "S1", "S2", "S3", "S4", "S5", "Co1", "Co2", "Co3"];

/** El registro guarda "Costilla N der" / "Costilla N izq" — 24 claves. */

export const EAT_COSTILLAS = ["Costilla 1 der", "Costilla 1 izq", "Costilla 2 der", "Costilla 2 izq", "Costilla 3 der", "Costilla 3 izq", "Costilla 4 der", "Costilla 4 izq", "Costilla 5 der", "Costilla 5 izq", "Costilla 6 der", "Costilla 6 izq", "Costilla 7 der", "Costilla 7 izq", "Costilla 8 der", "Costilla 8 izq", "Costilla 9 der", "Costilla 9 izq", "Costilla 10 der", "Costilla 10 izq", "Costilla 11 der", "Costilla 11 izq", "Costilla 12 der", "Costilla 12 izq"];
