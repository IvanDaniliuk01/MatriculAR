import type { GasistaBuscado } from "../dominio/busqueda";
import type { Consulta, Credencial, EstadoConsulta, RegistroLeido } from "../dominio/consulta";
import type { Verificacion } from "../dominio/verificacion";

/** La evidencia nunca se modifica ni se borra: los repositorios solo agregan y leen. */

export interface RepositorioConsultas {
  guardar(consulta: Consulta): Promise<void>;
  /** La última Consulta finalizada de la Fuente con ese estado, o null. */
  ultima(fuenteId: string, estado: EstadoConsulta): Promise<Consulta | null>;
}

/** Lectura minimizada de una Consulta exitosa (ADR-0006): sin datos de contacto y con vencimiento. */
export interface RepositorioLecturas {
  guardar(consultaId: string, registros: readonly RegistroLeido[], venceEn: string): Promise<void>;
  obtener(consultaId: string): Promise<readonly RegistroLeido[] | null>;
}

export interface RepositorioCredenciales {
  /** Idempotente: la misma Consulta y el mismo registro producen la misma Credencial. */
  guardar(credencial: Credencial): Promise<void>;
  /** Credenciales anteriores de la Fuente cuyo nombre coincide con el Gasista buscado, más nuevas primero. */
  delGasista(fuenteId: string, gasista: GasistaBuscado): Promise<readonly Credencial[]>;
}

export interface RepositorioVerificaciones {
  guardar(verificacion: Verificacion): Promise<void>;
  obtener(id: string): Promise<Verificacion | null>;
}
