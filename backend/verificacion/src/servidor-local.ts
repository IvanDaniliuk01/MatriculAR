import { createServer } from "node:http";
import { join } from "node:path";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { repositoriosEnArchivo } from "../../compartido/src/adaptadores/archivo/repositorios";
import { componerVerificar } from "./componer";
import { crearRutas } from "./handlers/rutas";

/**
 * Sirve la misma API que la Lambda en http://localhost:3000, con los repositorios de archivo de
 * backend/.datos-locales/. Sirve para desarrollar el frontend y para demostrar el recorrido
 * completo desde una IP residencial (Ecogas rechaza las IP de nube).
 */
const puerto = Number(process.env.PORT ?? 3000);
const contacto = process.env.MATRICULAR_CONTACTO ?? "https://github.com/IvanDaniliuk01/MatriculAR";

const rutas = crearRutas(
  componerVerificar(
    repositoriosEnArchivo(join(import.meta.dirname, "../../.datos-locales")),
    contacto,
  ),
  {
    origenCors: process.env.MATRICULAR_ORIGEN_CORS ?? "*",
    log: (registro) => console.log(JSON.stringify(registro)),
  },
);

createServer(async (pedido, respuesta) => {
  const partes: Buffer[] = [];
  for await (const parte of pedido) partes.push(parte as Buffer);
  const url = new URL(pedido.url ?? "/", `http://localhost:${puerto}`);

  const resultado = await rutas({
    httpMethod: pedido.method ?? "GET",
    path: url.pathname,
    body: partes.length > 0 ? Buffer.concat(partes).toString("utf8") : null,
    queryStringParameters: url.searchParams.size > 0 ? Object.fromEntries(url.searchParams) : null,
  } as APIGatewayProxyEvent);

  respuesta.writeHead(resultado.statusCode, resultado.headers as Record<string, string>);
  respuesta.end(resultado.body);
}).listen(puerto, () => {
  console.log(`API de MatriculAR en http://localhost:${puerto} (datos en backend/.datos-locales/)`);
});
