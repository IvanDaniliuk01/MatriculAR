import type { GasistaBuscado } from "./busqueda";
import type { Respuestas } from "./condiciones";
import type { Consulta } from "./consulta";
import type { Evaluacion } from "./evaluacion";
import type { Fuente } from "./reglas";

export type ResultadoVerificacion = "FOUND" | "NOT_FOUND" | "TOO_MANY_MATCHES" | "UNVERIFIABLE";

export interface PedidoVerificacion {
  fuenteId: string;
  gasista: GasistaBuscado;
  condiciones: Respuestas;
  /** Código de provincia del catálogo donde se hace el trabajo. */
  provinciaTrabajo: string;
}

/** Pedido de saber si un Gasista buscado es compatible con un trabajo. Se guarda tal como se respondió. */
export interface Verificacion {
  id: string;
  creadaEn: string;
  pedido: PedidoVerificacion;
  consultaId: string;
  /** La Consulta se reutilizó dentro de la Ventana de reutilización. */
  consultaReutilizada: boolean;
  resultado: ResultadoVerificacion;
  /** Coincidencias encontradas (también cuando son demasiadas para mostrarlas). */
  cantidadCoincidencias: number;
  /** Los Tipos de trabajo que dejaron abiertos las Condiciones decisivas. */
  tiposTrabajoPosibles: readonly { id: string; version: number; codigo: string; nombre: string }[];
  /** Una por Coincidencia: la Credencial en la que se apoya y la Evaluación, que nunca se recalcula. */
  coincidencias: readonly { credencialId: string; evaluacionId: string; evaluacion: Evaluacion }[];
  /** Solo si es UNVERIFIABLE: Credenciales anteriores mostradas como contexto, sin concluir. */
  evidenciaPreviaIds: readonly string[];
  mensaje: string;
}

/** Fecha y hora de Argentina, como la ve el Cliente: "02/11/2026 15:40". */
export function fechaParaCliente(iso: string): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

/** El mensaje principal de la respuesta: qué se encontró, en qué Fuente y según qué lectura. */
export function mensajeVerificacion(
  resultado: ResultadoVerificacion,
  datos: { fuente: Fuente; consulta: Consulta; cantidad: number; hayEvidenciaPrevia: boolean },
): string {
  const { fuente, consulta, cantidad } = datos;
  const lectura = `(lectura del ${fechaParaCliente(consulta.finalizadaEn)})`;

  switch (resultado) {
    case "FOUND":
      return cantidad === 1
        ? `Encontramos 1 gasista con ese nombre en el padrón de ${fuente.nombre} ${lectura}. Confirmalo con su carné.`
        : `Encontramos ${cantidad} gasistas con ese nombre en el padrón de ${fuente.nombre} ${lectura}: elegí el que coincide con su carné.`;
    case "NOT_FOUND":
      return `Nadie con ese nombre figura en el padrón de ${fuente.nombre} ${lectura}. Esto no dice nada sobre otras distribuidoras.`;
    case "TOO_MANY_MATCHES":
      return `Hay ${cantidad} gasistas que coinciden con ese nombre en el padrón de ${fuente.nombre}. Agregá la localidad o el nombre completo.`;
    case "UNVERIFIABLE": {
      const previa = datos.hayEvidenciaPrevia
        ? " Abajo está la última evidencia disponible, con su fecha: se muestra como contexto y no se usa para concluir."
        : "";
      return `${motivoUnverifiable(fuente, consulta)}${previa}`;
    }
  }
}

function motivoUnverifiable(fuente: Fuente, consulta: Consulta): string {
  switch (consulta.motivo) {
    case "SOURCE_NOT_AUTOMATABLE":
      return `${fuente.nombre} no permite consultas automáticas. Verificalo en su buscador oficial: ${fuente.urlBuscadorOficial}`;
    case "SOURCE_RATE_LIMITED":
      return `${fuente.nombre} se consultó hace instantes sin éxito; reintentá en un minuto. No se puede afirmar nada nuevo.`;
    case "EXTRACTION_FAILED":
      return `${fuente.nombre} cambió la forma de publicar el padrón y no pudimos leerlo con seguridad. No se puede afirmar nada nuevo.`;
    default:
      return `No pudimos consultar ${fuente.nombre}. No se puede afirmar nada nuevo.`;
  }
}
