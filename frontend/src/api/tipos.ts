/** Forma pública de la API (docs/api.md, snake_case), tal como la arma backend/verificacion/src/handlers/dto.ts. */

export type RespuestaCondicion = "SI" | "NO" | "NO_SE";

export interface PedidoVerificacion {
  fuente_id: string;
  gasista: { nombre_apellido: string; localidad?: string };
  condiciones: Record<string, RespuestaCondicion>;
  provincia_trabajo: string;
}

export interface Fuente {
  fuente_id: string;
  nombre: string;
  modo_acceso: string;
  buscador_oficial: string | null;
}

export interface Provincia {
  codigo: string;
  nombre: string;
}

export interface CondicionDecisiva {
  condicion_id: string;
  orden: number;
  pregunta: string;
  ayuda: string;
  fundamento: { norma: string; articulo: string; url: string };
}

export interface Catalogos {
  fuentes: Fuente[];
  provincias: Provincia[];
  condiciones: CondicionDecisiva[];
}

export type ResultadoVerificacion = "FOUND" | "NOT_FOUND" | "TOO_MANY_MATCHES" | "UNVERIFIABLE";
export type ResultadoEvaluacion = "COMPATIBLE" | "INCOMPATIBLE" | "INDETERMINATE";

export interface FuenteBreve {
  fuente_id: string;
  nombre: string;
}

export interface Consulta {
  consulta_id: string;
  estado: string;
  motivo_falla: string | null;
  detalle_falla: string | null;
  iniciada_en: string;
  finalizada_en: string;
  cantidad_intentos: number;
  registros_extraidos: number | null;
  formato_recurso: string | null;
  huella_recurso: string | null;
  reutilizada: boolean;
}

export interface Credencial {
  fuente: FuenteBreve;
  nombre_informado: string;
  categoria_informada: string;
  provincia_informada: string | null;
  localidad_informada: string | null;
  valores_fuente: Record<string, unknown>;
  consultada_en: string;
}

export interface ResultadoPorTipo {
  tipo_trabajo_id: string;
  tipo_trabajo_version: number;
  resultado: ResultadoEvaluacion;
  criterio_categoria: {
    resultado: string;
    categoria_informada: string;
    fundamento: string | null;
  };
  regla_aplicada: { categorias_admitidas: string[] };
}

export interface Evaluacion {
  evaluacion_id: string;
  resultado: ResultadoEvaluacion;
  resultados_por_tipo: ResultadoPorTipo[];
  condiciones_que_resuelven: { condicion_id: string; pregunta: string }[];
  explicacion: string;
  limitaciones: string[];
}

export interface TipoTrabajoPosible {
  tipo_trabajo_id: string;
  codigo: string;
  nombre: string;
  version: number;
}

export interface Verificacion {
  verificacion_id: string;
  solicitada_en: string;
  pedido: {
    fuente: FuenteBreve;
    gasista: { nombre_apellido: string; localidad: string | null };
    provincia_trabajo: { codigo: string; nombre: string | null };
  };
  tipos_trabajo_posibles: TipoTrabajoPosible[];
  resultado_verificacion: ResultadoVerificacion;
  mensaje: string;
  consulta: Consulta;
  coincidencias: { credencial: Credencial; evaluacion: Evaluacion }[];
  credenciales_previas: Credencial[];
  buscador_oficial: string | null;
}

export interface ErrorApi {
  /** Código HTTP; 0 si no hubo respuesta (sin conexión). */
  estado: number;
  codigo: string;
  mensaje: string;
  detalles: { campo?: string; problema: string }[];
}
