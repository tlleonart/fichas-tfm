export interface Ficha {
  id: number;
  tipo: "zonacion" | "eat";
  individuo: string;
  proyecto: string;
  registrador: string;
  fecha_registro: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FichaInput {
  tipo: "zonacion" | "eat";
  individuo: string;
  proyecto: string;
  registrador: string;
  fecha_registro: string;
  data: Record<string, unknown>;
}
