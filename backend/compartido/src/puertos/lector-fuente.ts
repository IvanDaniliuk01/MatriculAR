import type { Intento, RegistroLeido } from "../dominio/consulta";

/** Configuración de lectura de una Fuente automatizable (`database/seed/fuentes.json`). */
export interface ConfigLectura {
  urlPagina: string;
  marcadorV2: string;
  prefijoPreferido: string;
  maxCandidatos: number;
  reintentos: {
    maxIntentos: number;
    esperasMs: readonly number[];
    timeoutPedidoMs: number;
    timeoutConsultaMs: number;
  };
  validacion: { umbralCaida: number; pisoRegistros: number };
}

export type ResultadoLectura =
  | {
      ok: true;
      intentos: readonly Intento[];
      huella: string;
      formato: "v1" | "v2";
      urlResuelta: string;
      registros: readonly RegistroLeido[];
      clavesNoEsperadas: readonly string[];
    }
  | {
      ok: false;
      motivo: "SOURCE_UNAVAILABLE" | "EXTRACTION_FAILED";
      detalle: string;
      intentos: readonly Intento[];
    };

/** Lee una Fuente completa: reintentos, descubrimiento del recurso y validaciones V1 a V5. */
export interface LectorDeFuente {
  leer(
    config: ConfigLectura,
    contexto: { cantidadAnterior: number | null },
  ): Promise<ResultadoLectura>;
}
