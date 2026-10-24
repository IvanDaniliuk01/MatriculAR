import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EcogasRecursoNext } from "../../compartido/src/adaptadores/fuentes/ecogas";
import { NoAutomatizable } from "../../compartido/src/adaptadores/fuentes/no-automatizable";
import { catalogoDesdeSeed } from "../../compartido/src/adaptadores/memoria/catalogo";
import { GeneradorIds, RepositorioEnMemoria } from "../../compartido/src/adaptadores/memoria/repositorios";
import type { Fuente } from "../../compartido/src/dominio/tipos";
import { RelojFalso, URL_PAGINA, descargarFalso, guionNormal, type Guion } from "../../compartido/test/adaptadores/fixtures/fabricar";
import { crearServidor } from "../src/handlers/servidor";
import { fileURLToPath } from "node:url";

const seed = fileURLToPath(new URL("../../../database/seed", import.meta.url));
let base = "";
const reloj = new RelojFalso();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const js = async (r: Response): Promise<any> => r.json();
let cerrar: () => Promise<void>;
const estado: { guion: Guion } = { guion: guionNormal() };

beforeAll(async () => {
  const orig = catalogoDesdeSeed(seed);
  const catalogo = { ...orig, fuente: (id: string) => { const f = orig.fuente(id); return f?.fuente_id === "ecogas" ? ({ ...f, url_pagina: URL_PAGINA } as Fuente) : f; } };
  const { descargar } = descargarFalso((u, n) => estado.guion(u, n), reloj);
  const ecogas = new EcogasRecursoNext(descargar, reloj);
  const srv = crearServidor({
    origenCors: "http://localhost:5173",
    deps: { catalogo, repo: new RepositorioEnMemoria(), reloj, ids: new GeneradorIds(reloj.ahora), adaptadorDe: (f) => (f.modo_acceso === "AUTOMATED" ? ecogas : new NoAutomatizable()) },
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  cerrar = () => new Promise((r) => srv.close(() => r()));
});
afterAll(() => cerrar());
beforeEach(() => {
  reloj.avanzar(60_000); // cada prueba ocurre un minuto después: el orden de las Consultas es inequívoco
  estado.guion = guionNormal();
});

const post = (cuerpo: unknown, crudo?: string) =>
  fetch(`${base}/verificaciones`, { method: "POST", headers: { "content-type": "application/json" }, body: crudo ?? JSON.stringify(cuerpo) });
const ok = { fuente_id: "ecogas", matricula: "99001", tipo_trabajo_id: "artefacto-vivienda-unifamiliar", provincia_trabajo: "CORDOBA" };

describe("Flujo completo por HTTP", () => {
  it("POST /verificaciones → 201 con forma fija, y GET devuelve lo mismo", async () => {
    const r = await post(ok);
    expect(r.status).toBe(201);
    expect(r.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const v = await js(r);
    expect(Object.keys(v).sort()).toEqual(["buscador_oficial", "consulta", "credencial", "credencial_previa", "evaluacion", "mensaje", "pedido", "resultado_verificacion", "solicitada_en", "verificacion_id"]);
    expect(v.resultado_verificacion).toBe("FOUND");
    expect(v.evaluacion.resultado).toBe("COMPATIBLE");
    const g = await js(await fetch(`${base}/verificaciones/${v.verificacion_id}`));
    expect(g).toEqual(v);
    const hist = await js(await fetch(`${base}/credenciales/ecogas/99001`));
    expect(hist.credenciales).toHaveLength(1);
    expect(hist.resultados[0].resultado).toBe("FOUND");
  });

  it("una Fuente que falla NO es un error HTTP: 201 con UNVERIFIABLE y la última evidencia como contexto", async () => {
    estado.guion = () => ({ status: 404, contentType: "text/html", body: "cambió la URL" });
    const r = await post(ok);
    expect(r.status).toBe(201);
    const v = await js(r);
    expect(v.resultado_verificacion).toBe("UNVERIFIABLE");
    expect(v.consulta.motivo_falla).toBe("EXTRACTION_FAILED");
    expect(v.evaluacion).toBeNull();
    expect(v.credencial_previa.matricula).toBe("99001");
    expect(v.buscador_oficial).toMatch(/ecogas/);
    const salud = await js(await fetch(`${base}/fuentes/ecogas/consultas`));
    expect(salud[0]).toMatchObject({ estado: "FAILED", motivo_falla: "EXTRACTION_FAILED" });
    expect(salud.some((c: { estado: string }) => c.estado === "SUCCEEDED")).toBe(true);
  });

  it("NOT_FOUND solo con consulta exitosa", async () => {
    const v = await js(await post({ ...ok, matricula: "99004" }));
    expect(v.resultado_verificacion).toBe("NOT_FOUND");
    expect(v.consulta.estado).toBe("SUCCEEDED");
  });

  it("MetroGAS → UNVERIFIABLE sin pedidos", async () => {
    const v = await js(await post({ ...ok, fuente_id: "metrogas", provincia_trabajo: "CIUDAD_AUTONOMA_DE_BUENOS_AIRES" }));
    expect(v.resultado_verificacion).toBe("UNVERIFIABLE");
    expect(v.consulta.estado).toBe("NOT_ATTEMPTED");
  });
});

describe("Errores del pedido (4xx) y de rutas", () => {
  it("campos faltantes o de más → 422", async () => {
    expect((await post({ fuente_id: "ecogas" })).status).toBe(422);
    expect((await post({ ...ok, extra: 1 })).status).toBe(422);
  });
  it("JSON roto → 400", async () => expect((await post(null, "{no es json")).status).toBe(400));
  it("Fuente inexistente → 404; matrícula inválida → 422", async () => {
    expect((await post({ ...ok, fuente_id: "otra" })).status).toBe(404);
    expect((await post({ ...ok, matricula: "12-34" })).status).toBe(422);
  });
  it("cuerpo enorme → 422", async () => expect((await post(null, JSON.stringify({ x: "a".repeat(10000) }))).status).toBe(422));
  it("verificación inexistente → 404, ruta inexistente → 404", async () => {
    expect((await fetch(`${base}/verificaciones/NOEXISTE`)).status).toBe(404);
    expect((await fetch(`${base}/nada`)).status).toBe(404);
  });
});

describe("Catálogos", () => {
  it("fuentes, tipos de trabajo, categorías y provincias", async () => {
    const f = await js(await fetch(`${base}/fuentes`));
    expect(f.map((x: { fuente_id: string }) => x.fuente_id).sort()).toEqual(["ecogas", "metrogas"]);
    expect((await js(await fetch(`${base}/tipos-trabajo`))).length).toBe(3);
    expect((await js(await fetch(`${base}/categorias`))).length).toBe(3);
    expect((await js(await fetch(`${base}/provincias`))).length).toBeGreaterThan(20);
  });
});
