import type {
  Categoria,
  Consulta,
  Credencial,
  CredencialRef,
  Evaluacion,
  Fuente,
  Provincia,
  ResultadoDeVerificacion,
  TipoTrabajo,
  Verificacion,
} from "../dominio/tipos";

/** Reglas y catálogos: datos versionados (solo lectura para el caso de uso). */
export interface Catalogo {
  fuente(fuenteId: string): Fuente | undefined;
  fuentes(): Fuente[];
  tipoTrabajo(tipoTrabajoId: string): TipoTrabajo | undefined;
  tiposTrabajo(): TipoTrabajo[];
  categorias(): Categoria[];
  provincias(): Provincia[];
}

export interface PaqueteVerificacion {
  consulta: Consulta;
  resultado: ResultadoDeVerificacion;
  credencial: Credencial | null;
  evaluacion: Evaluacion | null;
  verificacion: Verificacion;
}

/**
 * Persistencia de la evidencia. `guardarPaquete` debe ser atómico (en DynamoDB, una
 * TransactWriteItems): o se guarda todo, o nada. La Consulta se registra antes de leer.
 */
export interface RepositorioEvidencia {
  /** Registra la Consulta en IN_PROGRESS antes del primer pedido. */
  iniciarConsulta(consulta: Consulta): Promise<void>;
  guardarPaquete(paquete: PaqueteVerificacion): Promise<void>;

  ultimaConsultaExitosa(fuenteId: string): Promise<Consulta | undefined>;
  ultimaCredencial(fuenteMatricula: string): Promise<Credencial | undefined>;

  verificacion(verificacionId: string): Promise<Verificacion | undefined>;
  consulta(consultaId: string): Promise<Consulta | undefined>;
  credencial(ref: CredencialRef): Promise<Credencial | undefined>;
  evaluacion(evaluacionId: string): Promise<Evaluacion | undefined>;
  historial(fuenteMatricula: string): Promise<{
    credenciales: Credencial[];
    resultados: ResultadoDeVerificacion[];
  }>;
  consultasDeFuente(fuenteId: string, limite: number): Promise<Consulta[]>;
}

export interface Ids {
  nuevo(): string;
}
