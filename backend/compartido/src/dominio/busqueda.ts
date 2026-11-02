/**
 * Búsqueda del Gasista buscado en una Lectura de la Fuente (ADR-0007). Ecogas no publica el
 * número de matrícula, así que se identifica por nombre y, opcionalmente, por localidad.
 */

/** Un registro de la Fuente, ya normalizado, tal como lo conserva la Lectura minimizada. */
export interface RegistroFuente {
  /** Identificador interno de la Fuente: se conserva, pero nunca identifica a un gasista. */
  idInterno: string;
  nombre: string;
  categoria: string;
  provincia: string;
  localidad: string;
}

export interface GasistaBuscado {
  nombreApellido: string;
  localidad?: string | undefined;
}

/** Más Coincidencias que estas no se muestran: se pide precisar la búsqueda. */
export const MAX_COINCIDENCIAS = 10;

export type ResultadoBusqueda =
  | { resultado: "FOUND"; coincidencias: readonly RegistroFuente[] }
  | { resultado: "NOT_FOUND" }
  | { resultado: "TOO_MANY_MATCHES"; cantidad: number };

/** Mayúsculas, sin tildes ni diéresis (la Ñ pasa a N), sin puntuación y con espacios simples. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function palabras(texto: string): string[] {
  const normalizado = normalizarTexto(texto);
  return normalizado === "" ? [] : normalizado.split(" ");
}

export function validarGasistaBuscado(gasista: GasistaBuscado): string[] {
  return palabras(gasista.nombreApellido).length < 2 ? ["Ingresá al menos nombre y apellido."] : [];
}

export function buscarCoincidencias(
  registros: readonly RegistroFuente[],
  gasista: GasistaBuscado,
): ResultadoBusqueda {
  const buscadas = palabras(gasista.nombreApellido);
  const localidad = gasista.localidad ? normalizarTexto(gasista.localidad) : null;

  const coincidencias = registros.filter((registro) => {
    if (localidad !== null && normalizarTexto(registro.localidad) !== localidad) return false;
    const delRegistro = new Set(palabras(registro.nombre));
    return buscadas.every((palabra) => delRegistro.has(palabra));
  });

  if (coincidencias.length === 0) return { resultado: "NOT_FOUND" };
  if (coincidencias.length > MAX_COINCIDENCIAS) {
    return { resultado: "TOO_MANY_MATCHES", cantidad: coincidencias.length };
  }
  return { resultado: "FOUND", coincidencias };
}
