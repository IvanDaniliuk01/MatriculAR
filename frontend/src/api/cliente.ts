import type {
  Catalogos,
  CondicionDecisiva,
  ErrorApi,
  Fuente,
  PedidoVerificacion,
  Provincia,
  Verificacion,
} from "./tipos";

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: ErrorApi };

let base: Promise<string> | undefined;

/**
 * URL de la API. En AWS, Terraform escribe `config.json` en la raíz del sitio con `api_url`;
 * si no está (desarrollo), se usa `VITE_API_URL` y después `http://localhost:3000`.
 */
export function urlApi(): Promise<string> {
  base ??= resolverUrlApi();
  return base;
}

/** Solo para pruebas: olvida la URL resuelta. */
export function reiniciarUrlApi(): void {
  base = undefined;
}

async function resolverUrlApi(): Promise<string> {
  try {
    const respuesta = await fetch(new URL("config.json", document.baseURI));
    if (respuesta.ok) {
      // El servidor de desarrollo de Vite responde index.html si el archivo no existe: json() falla.
      const config = (await respuesta.json()) as { api_url?: unknown };
      if (typeof config.api_url === "string" && config.api_url)
        return sinBarraFinal(config.api_url);
    }
  } catch {
    // Sin config.json: se usa la configuración de compilación.
  }
  return sinBarraFinal(import.meta.env.VITE_API_URL || "http://localhost:3000");
}

function sinBarraFinal(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Mensajes para los errores que no vienen con el formato de la API (API Gateway o la red). */
const MENSAJES_POR_ESTADO: Record<number, string> = {
  0: "No pudimos conectarnos con MatriculAR. Revisá tu conexión e intentá de nuevo.",
  429: "Hay demasiados pedidos en este momento. Esperá unos segundos e intentá de nuevo.",
  504: "La lectura del padrón tardó más de lo que permite la API. Intentá de nuevo en un minuto: si la lectura terminó, se reutiliza.",
};

async function pedir<T>(ruta: string, init?: RequestInit): Promise<Resultado<T>> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${await urlApi()}${ruta}`, init);
  } catch {
    return { ok: false, error: errorSinCuerpo(0) };
  }
  let cuerpo: unknown = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // Algunas respuestas de API Gateway (429, 504) no traen JSON.
  }
  if (respuesta.ok) return { ok: true, datos: cuerpo as T };

  const error = (cuerpo as { error?: Partial<ErrorApi> } | null)?.error;
  if (error?.codigo && error.mensaje) {
    return {
      ok: false,
      error: {
        estado: respuesta.status,
        codigo: error.codigo,
        mensaje: error.mensaje,
        detalles: error.detalles ?? [],
      },
    };
  }
  return { ok: false, error: errorSinCuerpo(respuesta.status) };
}

function errorSinCuerpo(estado: number): ErrorApi {
  return {
    estado,
    codigo: estado === 0 ? "NETWORK_ERROR" : `HTTP_${estado}`,
    mensaje:
      MENSAJES_POR_ESTADO[estado] ?? "Falla de MatriculAR. Intentá de nuevo en unos minutos.",
    detalles: [],
  };
}

export async function obtenerCatalogos(): Promise<Resultado<Catalogos>> {
  const [fuentes, provincias, tipos] = await Promise.all([
    pedir<Fuente[]>("/fuentes"),
    pedir<Provincia[]>("/provincias"),
    pedir<{ condiciones_decisivas: CondicionDecisiva[] }>("/tipos-trabajo"),
  ]);
  if (!fuentes.ok) return fuentes;
  if (!provincias.ok) return provincias;
  if (!tipos.ok) return tipos;
  return {
    ok: true,
    datos: {
      fuentes: fuentes.datos,
      provincias: provincias.datos,
      condiciones: tipos.datos.condiciones_decisivas,
    },
  };
}

export function crearVerificacion(pedido: PedidoVerificacion): Promise<Resultado<Verificacion>> {
  return pedir<Verificacion>("/verificaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
  });
}
