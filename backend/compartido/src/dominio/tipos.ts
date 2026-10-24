/**
 * Tipos del dominio. Vocabulario: CONTEXT.md. Los nombres de los campos coinciden con los
 * ítems de `database/seed/` para que los ejemplos ficticios sean datos de prueba válidos.
 */

export type ResultadoVerificacion = "FOUND" | "NOT_FOUND" | "UNVERIFIABLE";
export type ResultadoCriterio = "MET" | "NOT_MET" | "INDETERMINATE";
export type ResultadoEvaluacion = "COMPATIBLE" | "INCOMPATIBLE" | "INDETERMINATE";
export type EstadoConsulta = "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "NOT_ATTEMPTED";
export type MotivoFalla =
  | "SOURCE_UNAVAILABLE"
  | "EXTRACTION_FAILED"
  | "SOURCE_NOT_AUTOMATABLE"
  | "INTERRUPTED";

export interface Provincia {
  codigo: string;
  nombre: string;
  alias: string[];
}

export interface Fundamento {
  categoria: string;
  admitida: boolean;
  norma: string;
  articulo: string;
  cita: string;
  url: string;
  nota?: string;
}

export interface Categoria {
  categoria_id: string;
  nombre: string;
  version: number;
  alcance: string;
}

export interface TipoTrabajo {
  tipo_trabajo_id: string;
  version: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  condiciones: string[];
  categorias_admitidas: string[];
  fundamento: Fundamento[];
  limitaciones: string[];
  activo: boolean;
}

export interface ConfigExtraccion {
  prefijo_preferido: string;
  max_candidatos: number;
  claves_obligatorias: string[];
  claves_conocidas: string[];
}
export interface ConfigReintentos {
  max_intentos: number;
  esperas_ms: number[];
  timeout_pedido_ms: number;
  timeout_consulta_ms: number;
}
export interface ConfigValidacion {
  umbral_caida: number;
  piso_registros: number;
}

export interface Fuente {
  fuente_id: string;
  version: number;
  nombre: string;
  area_concesion: string[];
  area_concesion_parcial: string[];
  modo_acceso: "AUTOMATED" | "NOT_AUTOMATABLE";
  adaptador: string;
  url_pagina: string | null;
  url_buscador_oficial: string;
  config_extraccion: ConfigExtraccion | null;
  config_reintentos: ConfigReintentos | null;
  config_validacion: ConfigValidacion | null;
  limitaciones: string[];
  activa: boolean;
}

/** Evidencia inmutable: lo que la Fuente informó, y cuándo. Sin estado de aptitud (ADR-0003). */
export interface Credencial {
  fuente_matricula: string; // "ecogas#99001"
  evidencia_id: string; // "<consultada_en>#<consulta_id>"
  fuente_id: string;
  matricula: string;
  consulta_id: string;
  consultada_en: string;
  nombre_informado: string;
  categoria_informada: string;
  provincia_informada: string;
  localidad_informada: string;
  creada_en: string;
}

export interface CredencialRef {
  fuente_matricula: string;
  evidencia_id: string;
}

export interface PedidoHttp {
  url: string;
  metodo: "GET";
  status: number | null;
  content_type: string | null;
  bytes: number | null;
  duracion_ms: number;
  error: string | null;
}

export interface Intento {
  numero: number;
  iniciado_en: string;
  duracion_ms: number;
  resultado: "SUCCESS" | MotivoFalla;
  reintentable: boolean;
  pedidos: PedidoHttp[];
}

export interface ResumenRecurso {
  por_categoria: Record<string, number>;
  por_provincia: Record<string, number>;
}

export interface Consulta {
  consulta_id: string;
  fuente_id: string;
  fuente_version: number;
  origen: "VERIFICATION";
  matriculas_buscadas: string[];
  estado: EstadoConsulta;
  motivo_falla: MotivoFalla | null;
  detalle_falla: string | null;
  iniciada_en: string;
  plazo_maximo_en: string;
  finalizada_en: string | null;
  intentos: Intento[];
  url_recurso: string | null;
  huella_recurso: string | null;
  bytes_recurso: number | null;
  registros_extraidos: number | null;
  resumen: ResumenRecurso | null;
  claves_no_esperadas: string[];
}

export interface ResultadoDeVerificacion {
  consulta_id: string;
  matricula: string;
  fuente_id: string;
  fuente_matricula: string;
  resultado: ResultadoVerificacion;
  determinado_en: string;
  credencial_evidencia_id: string | null;
}

export interface Criterio {
  resultado: ResultadoCriterio;
  categoria_informada: string;
  fundamento: string;
}

export interface ReglaAplicada {
  categorias_admitidas: string[];
  condiciones: string[];
  fundamento: Fundamento[];
  area_concesion_aplicada: string[];
}

export interface Evaluacion {
  evaluacion_id: string;
  verificacion_id: string;
  credencial_ref: CredencialRef;
  tipo_trabajo_id: string;
  tipo_trabajo_version: number;
  fuente_version: number;
  regla_aplicada: ReglaAplicada;
  criterios: { categoria: Criterio };
  resultado: ResultadoEvaluacion;
  limitaciones: string[];
  evaluada_en: string;
}

export interface Verificacion {
  verificacion_id: string;
  solicitada_en: string;
  origen: "DIRECT";
  fuente_id: string;
  matricula: string;
  fuente_matricula: string;
  tipo_trabajo_id: string;
  tipo_trabajo_version: number;
  provincia_trabajo: string;
  consulta_id: string;
  resultado_verificacion: ResultadoVerificacion;
  credencial_ref: CredencialRef | null;
  evaluacion_id: string | null;
  resultado_evaluacion: ResultadoEvaluacion | null;
  credencial_previa_ref: CredencialRef | null;
  mensaje: string;
}
