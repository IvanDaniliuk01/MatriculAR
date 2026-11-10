import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { crearSitio } from "../src/handlers/sitio";

function armarBuild() {
  const directorio = mkdtempSync(join(tmpdir(), "sitio-"));
  mkdirSync(join(directorio, "assets"));
  writeFileSync(join(directorio, "index.html"), "<!doctype html><title>MatriculAR</title>");
  writeFileSync(join(directorio, "assets", "index-abc.js"), "console.log(1)");
  return directorio;
}

/** Evento como lo arma API Gateway: `path` sin la etapa y `requestContext.path` con ella. */
function evento(path: string, rutaPublica = `/v1${path}`, metodo = "GET") {
  return {
    httpMethod: metodo,
    path,
    headers: { Host: "abc123.execute-api.us-east-2.amazonaws.com" },
    requestContext: { stage: "v1", path: rutaPublica },
  } as unknown as APIGatewayProxyEvent;
}

describe("sitio servido por la API", () => {
  const sitio = crearSitio(armarBuild());

  it("sirve index.html en la raíz de la etapa, sin caché", () => {
    const respuesta = sitio(evento("/"));
    expect(respuesta?.statusCode).toBe(200);
    expect(respuesta?.headers?.["Content-Type"]).toMatch(/text\/html/);
    expect(respuesta?.headers?.["Cache-Control"]).toBe("no-cache");
    expect(respuesta?.body).toContain("MatriculAR");
  });

  it("redirige /v1 a /v1/ para que las rutas relativas de los assets resuelvan dentro de la etapa", () => {
    const respuesta = sitio(evento("/", "/v1"));
    expect(respuesta?.statusCode).toBe(301);
    expect(respuesta?.headers?.Location).toBe("/v1/");
  });

  it("sirve los assets con su tipo y caché larga", () => {
    const respuesta = sitio(evento("/assets/index-abc.js"));
    expect(respuesta?.statusCode).toBe(200);
    expect(respuesta?.headers?.["Content-Type"]).toMatch(/javascript/);
    expect(respuesta?.headers?.["Cache-Control"]).toContain("immutable");
  });

  it("arma config.json con la URL de la API del mismo origen", () => {
    const respuesta = sitio(evento("/config.json"));
    expect(JSON.parse(respuesta?.body ?? "{}")).toEqual({
      api_url: "https://abc123.execute-api.us-east-2.amazonaws.com/v1",
    });
  });

  it("deja pasar a la API las rutas que no son archivos del build", () => {
    expect(sitio(evento("/fuentes"))).toBeUndefined();
    expect(sitio(evento("/verificaciones", "/v1/verificaciones", "POST"))).toBeUndefined();
    expect(sitio(evento("/assets/no-existe.js"))).toBeUndefined();
  });

  it("no sirve archivos fuera del build", () => {
    expect(sitio(evento("/../../etc/passwd"))).toBeUndefined();
    expect(sitio(evento("/assets/../../secreto"))).toBeUndefined();
  });
});
