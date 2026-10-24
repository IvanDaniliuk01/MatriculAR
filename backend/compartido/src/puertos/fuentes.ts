import type {
  Fuente,
  Intento,
  MotivoFalla,
  Provincia,
  ResumenRecurso,
} from "../dominio/tipos";

/** Registro ya normalizado. Nunca lleva email, teléfono ni barrio (INV-9). */
export interface RegistroNormalizado {
  matricula: string;
  nombre_informado: string;
  categoria_informada: string;
  provincia_informada: string;
  localidad_informada: string;
}

export interface MetadatosLectura {
  url_recurso: string;
  huella_recurso: string;
  bytes_recurso: number;
  registros_extraidos: number;
  resumen: ResumenRecurso;
  claves_no_esperadas: string[];
}

export type Lectura =
  | {
      tipo: "EXITOSA";
      /** Una entrada por matrícula buscada: el registro, o null si no figura. */
      resultados: Map<string, RegistroNormalizado | null>;
      metadatos: MetadatosLectura;
      intentos: Intento[];
    }
  | {
      tipo: "FALLIDA";
      motivo: Extract<MotivoFalla, "SOURCE_UNAVAILABLE" | "EXTRACTION_FAILED">;
      detalle: string;
      intentos: Intento[];
    }
  | { tipo: "NO_REALIZADA"; motivo: "SOURCE_NOT_AUTOMATABLE"; intentos: Intento[] };

export interface PedidoLectura {
  fuente: Fuente;
  matriculas: string[];
  provincias: Provincia[];
  /** Registros de la última Consulta exitosa de la Fuente (para la validación V5). */
  registros_ultima_consulta_exitosa: number | null;
}

/**
 * Puerto de Fuentes. El adaptador solo lee, valida y normaliza: no evalúa nada del dominio,
 * no escribe en la base y no devuelve datos de contacto.
 */
export interface PuertoFuente {
  leer(pedido: PedidoLectura): Promise<Lectura>;
}

export interface Reloj {
  /** Milisegundos desde epoch. */
  ahora(): number;
  esperar(ms: number): Promise<void>;
}

export const relojReal: Reloj = {
  ahora: () => Date.now(),
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
};
