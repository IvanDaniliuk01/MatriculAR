import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Sirve el build del frontend desde la misma API, para que el sistema tenga un único enlace con
 * HTTPS. Responde solo a GET de archivos que existen en `directorio`; para todo lo demás devuelve
 * `undefined` y la petición sigue a las rutas de la API.
 *
 * `config.json` no viene del build: se arma con el host y la etapa del pedido, así el frontend
 * llama a la API del mismo origen.
 */
export function crearSitio(directorio: string) {
  const cache = new Map<string, Buffer>();

  function leer(relativa: string): Buffer | undefined {
    const ruta = normalize(join(directorio, relativa));
    if (!ruta.startsWith(directorio + sep) || !existsSync(ruta)) return undefined;
    let contenido = cache.get(ruta);
    if (!contenido) {
      contenido = readFileSync(ruta);
      cache.set(ruta, contenido);
    }
    return contenido;
  }

  return function sitio(evento: APIGatewayProxyEvent): APIGatewayProxyResult | undefined {
    if (evento.httpMethod !== "GET") return undefined;
    const ruta = (evento.path || "/").replace(/^\/v1(?=\/|$)/, "") || "/";
    const etapa = evento.requestContext?.stage;
    const rutaPublica = evento.requestContext?.path;

    if (ruta === "/") {
      // Sin la barra final, el navegador resolvería ./assets/… fuera de la etapa.
      if (rutaPublica && !rutaPublica.endsWith("/")) {
        return { statusCode: 301, headers: { Location: `${rutaPublica}/` }, body: "" };
      }
      return archivo("index.html", "no-cache");
    }

    if (ruta === "/config.json") {
      const host = evento.headers?.Host ?? evento.headers?.host;
      if (!host || !etapa) return undefined;
      return {
        statusCode: 200,
        headers: { "Content-Type": TIPOS[".json"] ?? "", "Cache-Control": "no-cache" },
        body: JSON.stringify({ api_url: `https://${host}/${etapa}` }),
      };
    }

    // Los archivos de assets/ llevan un hash en el nombre: se pueden cachear sin vencimiento.
    return archivo(ruta.slice(1), "public, max-age=31536000, immutable");
  };

  function archivo(relativa: string, cacheControl: string): APIGatewayProxyResult | undefined {
    const contenido = leer(relativa);
    if (!contenido) return undefined;
    return {
      statusCode: 200,
      headers: {
        "Content-Type": TIPOS[extname(relativa)] ?? "application/octet-stream",
        "Cache-Control": cacheControl,
      },
      body: contenido.toString("utf8"),
    };
  }
}
