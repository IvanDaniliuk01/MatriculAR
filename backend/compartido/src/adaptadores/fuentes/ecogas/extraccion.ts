import { z } from "zod";
import { normalizarTexto, type RegistroFuente } from "../../../dominio/busqueda";

/**
 * Extracción del padrón de Ecogas a partir de los recursos ya descargados (sin HTTP).
 * Ecogas cambió de formato al menos dos veces; el adaptador reconoce ambos y, si no encuentra
 * ninguno, falla con EXTRACTION_FAILED. Nunca interpreta un recurso irreconocible como
 * "0 matriculados" (docs/fuentes-y-adaptadores.md).
 */

export type FormatoEcogas = "PAGINA_RSC" | "CHUNK_JSON_PARSE";

/** Validación que falló: V2 marcador, V3 lectura del contenido, V4 registros, V5 cantidad. */
export type Validacion = "V2" | "V3" | "V4" | "V5";

export interface RegistroExtraido {
  registro: RegistroFuente;
  /** Campos mínimos tal como los publicó la Fuente, sin datos de contacto. */
  valoresFuente: Readonly<Record<string, unknown>>;
}

export type ResultadoExtraccion =
  | {
      ok: true;
      formato: FormatoEcogas;
      registros: readonly RegistroExtraido[];
      clavesNoEsperadas: readonly string[];
    }
  | { ok: false; validacion: Validacion; detalle: string };

const CLAVES_CONSERVADAS = ["id", "nombre_apellido", "categoria", "provincia", "localidad"];
const CLAVES_DESCARTADAS = ["barrio", "correo_electronico", "telefono"];
const CLAVES_CONOCIDAS = new Set([...CLAVES_CONSERVADAS, ...CLAVES_DESCARTADAS]);

const conNombre = z.object({ nombre: z.string() }).nullable();

const registroPagina = z.looseObject({
  id: z.union([z.number(), z.string()]),
  nombre_apellido: z.string().min(1),
  categoria: z
    .object({ numero: z.union([z.string(), z.number()]).nullable(), nombre: z.string().nullish() })
    .nullable(),
  provincia: conNombre,
  localidad: conNombre,
});

const registroChunk = z.looseObject({
  id: z.union([z.number(), z.string()]),
  nombre_apellido: z.string().min(1),
  categoria: z.string().nullable(),
  provincia: z.string().nullable(),
  localidad: z.string().nullable(),
});

const contenedorPagina = z.looseObject({ success: z.literal(true), data: z.array(z.unknown()) });

const MARCADOR_PAGINA = "gasistasMatriculados";
const PUSH = "self.__next_f.push(";

/** Formato 2 (desde el 02/11/2026): el padrón viaja en el payload de React dentro del HTML. */
export function extraerDePagina(html: string): ResultadoExtraccion {
  const payloads = payloadsDeReact(html);
  const linea = payloads
    .flatMap((payload) => payload.split("\n"))
    .find((l) => l.includes(`"${MARCADOR_PAGINA}"`));
  if (linea === undefined) {
    return falla("V2", `La página no contiene la propiedad "${MARCADOR_PAGINA}".`);
  }

  let valor: unknown;
  try {
    valor = JSON.parse(linea.slice(linea.indexOf(":") + 1));
  } catch (error) {
    return falla("V3", `La línea del payload que trae el padrón no es JSON: ${mensaje(error)}`);
  }
  const contenedor = contenedorPagina.safeParse(buscarPropiedad(valor, MARCADOR_PAGINA));
  if (!contenedor.success) {
    return falla("V3", `"${MARCADOR_PAGINA}" no tiene la forma { success: true, data: [...] }.`);
  }

  return validarRegistros("PAGINA_RSC", contenedor.data.data, registroPagina, (r) => ({
    idInterno: String(r.id),
    nombre: r.nombre_apellido,
    categoria: r.categoria?.numero == null ? "" : String(r.categoria.numero),
    provincia: r.provincia?.nombre ?? "",
    localidad: r.localidad?.nombre ?? "",
  }));
}

const MARCADOR_CHUNK = "JSON.parse('[{";

/** Formato 1 (hasta septiembre de 2026): un chunk de webpack con `JSON.parse('[{"id":…}]')`. */
export function extraerDeChunk(js: string): ResultadoExtraccion {
  const inicio = js.indexOf(MARCADOR_CHUNK);
  if (inicio === -1 || !js.includes('"nombre_apellido"', inicio)) {
    return falla(
      "V2",
      "El chunk no contiene la lista de registros (JSON.parse con nombre_apellido).",
    );
  }

  let datos: unknown;
  try {
    datos = JSON.parse(leerLiteralJs(js, inicio + "JSON.parse(".length));
  } catch (error) {
    return falla("V3", `El literal del chunk no se pudo leer como JSON: ${mensaje(error)}`);
  }
  if (!Array.isArray(datos)) return falla("V3", "El literal del chunk no es una lista.");

  return validarRegistros("CHUNK_JSON_PARSE", datos, registroChunk, (r) => ({
    idInterno: String(r.id),
    nombre: r.nombre_apellido,
    categoria: r.categoria ?? "",
    provincia: r.provincia ?? "",
    localidad: r.localidad ?? "",
  }));
}

/** V5: una caída brusca o un padrón demasiado chico indican un recurso equivocado o incompleto. */
export function validarCantidad(
  cantidad: number,
  anterior: number | null,
  config: { umbralCaida: number; pisoRegistros: number },
): string | null {
  if (cantidad < config.pisoRegistros) {
    return `Se leyeron ${cantidad} registros, menos que el piso de ${config.pisoRegistros}.`;
  }
  if (anterior !== null && cantidad < anterior * (1 - config.umbralCaida)) {
    return `Se leyeron ${cantidad} registros; la lectura anterior tenía ${anterior}.`;
  }
  return null;
}

function validarRegistros<T extends Record<string, unknown>>(
  formato: FormatoEcogas,
  datos: readonly unknown[],
  esquema: z.ZodType<T>,
  aRegistro: (crudo: T) => Omit<RegistroFuente, "nombre"> & { nombre: string },
): ResultadoExtraccion {
  if (datos.length === 0) return falla("V4", "El padrón vino sin registros.");

  const registros: RegistroExtraido[] = [];
  const ids = new Set<string>();
  const clavesNoEsperadas = new Set<string>();
  for (const [posicion, dato] of datos.entries()) {
    const leido = esquema.safeParse(dato);
    if (!leido.success) {
      const campos = leido.error.issues.map((i) => i.path.join(".") || "(registro)").join(", ");
      return falla("V4", `El registro ${posicion + 1} no tiene la forma esperada (${campos}).`);
    }
    const crudo = leido.data;
    const id = String(crudo.id);
    if (ids.has(id)) return falla("V4", `El identificador interno ${id} está repetido.`);
    ids.add(id);

    for (const clave of Object.keys(crudo)) {
      if (!CLAVES_CONOCIDAS.has(clave)) clavesNoEsperadas.add(clave);
    }
    const registro = aRegistro(crudo);
    registros.push({
      registro: {
        idInterno: registro.idInterno,
        nombre: mayusculas(registro.nombre),
        categoria: registro.categoria.trim(),
        provincia: normalizarTexto(registro.provincia).replaceAll(" ", "_"),
        localidad: mayusculas(registro.localidad),
      },
      valoresFuente: Object.fromEntries(CLAVES_CONSERVADAS.map((clave) => [clave, crudo[clave]])),
    });
  }
  return { ok: true, formato, registros, clavesNoEsperadas: [...clavesNoEsperadas] };
}

function falla(validacion: Validacion, detalle: string): ResultadoExtraccion {
  return { ok: false, validacion, detalle };
}

function mayusculas(texto: string): string {
  return texto.toUpperCase().replace(/\s+/g, " ").trim();
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Los strings de cada `self.__next_f.push([1, "..."])` de la página. */
function payloadsDeReact(html: string): string[] {
  const payloads: string[] = [];
  for (let desde = html.indexOf(PUSH); desde !== -1; desde = html.indexOf(PUSH, desde + 1)) {
    const fin = html.indexOf("</script>", desde);
    const llamada = html.slice(desde + PUSH.length, fin === -1 ? undefined : fin).trimEnd();
    try {
      const argumento: unknown = JSON.parse(llamada.endsWith(")") ? llamada.slice(0, -1) : llamada);
      if (Array.isArray(argumento) && typeof argumento[1] === "string") payloads.push(argumento[1]);
    } catch {
      // Un push que no es JSON no trae el padrón; si ninguno lo trae, falla V2.
    }
  }
  return payloads;
}

/** Busca una propiedad en cualquier nivel de un valor JSON. */
function buscarPropiedad(valor: unknown, propiedad: string): unknown {
  if (Array.isArray(valor)) {
    for (const elemento of valor) {
      const encontrado = buscarPropiedad(elemento, propiedad);
      if (encontrado !== undefined) return encontrado;
    }
  } else if (valor !== null && typeof valor === "object") {
    if (propiedad in valor) return (valor as Record<string, unknown>)[propiedad];
    return buscarPropiedad(Object.values(valor), propiedad);
  }
  return undefined;
}

/** Lee un literal de JavaScript entre comillas simples que empieza en `inicio` y lo decodifica. */
function leerLiteralJs(js: string, inicio: number): string {
  if (js[inicio] !== "'") throw new Error("No empieza un literal entre comillas simples.");
  let resultado = "";
  for (let i = inicio + 1; i < js.length; i++) {
    const c = js[i];
    if (c === "'") return resultado;
    if (c !== "\\") {
      resultado += c;
      continue;
    }
    const siguiente = js[++i];
    if (siguiente === "x" || siguiente === "u") {
      const largo = siguiente === "x" ? 2 : 4;
      resultado += String.fromCharCode(Number.parseInt(js.slice(i + 1, i + 1 + largo), 16));
      i += largo;
    } else {
      const escapes: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };
      resultado += escapes[siguiente ?? ""] ?? siguiente ?? "";
    }
  }
  throw new Error("El literal no se cierra.");
}
