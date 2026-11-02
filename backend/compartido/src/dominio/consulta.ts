import type { RegistroFuente } from "./busqueda";

/** Un registro leído de la Fuente: normalizado, más los campos mínimos tal como vinieron. */
export interface RegistroLeido {
  registro: RegistroFuente;
  /** Campos mínimos tal como los publicó la Fuente, sin datos de contacto. */
  valoresFuente: Readonly<Record<string, unknown>>;
}

export type EstadoConsulta = "SUCCEEDED" | "FAILED" | "NOT_ATTEMPTED";

export type MotivoFalla =
  | "SOURCE_UNAVAILABLE"
  | "EXTRACTION_FAILED"
  | "INTERRUPTED"
  | "SOURCE_NOT_AUTOMATABLE"
  | "SOURCE_RATE_LIMITED";

/** Un pedido HTTP dentro de un Intento. */
export interface PedidoHttp {
  url: string;
  estadoHttp: number | null;
  bytes: number;
  ms: number;
  error?: string | undefined;
}

/** Cada ejecución completa de la lectura de una Fuente dentro de una Consulta. */
export interface Intento {
  numero: number;
  iniciadoEn: string;
  finalizadoEn: string;
  pedidos: readonly PedidoHttp[];
  error?: string | undefined;
}

/** Lectura de una Fuente en un momento dado. Nunca se modifica después de finalizada. */
export interface Consulta {
  id: string;
  fuenteId: string;
  fuenteVersion: number;
  iniciadaEn: string;
  finalizadaEn: string;
  estado: EstadoConsulta;
  motivo?: MotivoFalla | undefined;
  detalle?: string | undefined;
  intentos: readonly Intento[];
  /** Solo en una Consulta exitosa. */
  huellaRecurso?: string | undefined;
  formatoRecurso?: string | undefined;
  urlResuelta?: string | undefined;
  cantidadRegistros?: number | undefined;
  clavesNoEsperadas?: readonly string[] | undefined;
}

/** Evidencia de que un gasista figura en una Fuente según una Consulta. Inmutable. */
export interface Credencial {
  id: string;
  fuenteId: string;
  consultaId: string;
  /** Fecha real de la Consulta, no la del pedido. */
  obtenidaEn: string;
  idInterno: string;
  nombreInformado: string;
  categoriaInformada: string;
  provinciaInformada: string;
  localidadInformada: string;
  valoresFuente: Readonly<Record<string, unknown>>;
}
