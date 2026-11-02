import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LectorEcogas } from "../../src/adaptadores/fuentes/ecogas/lector-ecogas";
import type { ClienteHttp, Reloj, RespuestaHttp } from "../../src/puertos/infraestructura";
import type { ConfigLectura } from "../../src/puertos/lector-fuente";
import {
  chunkSoloColumnas,
  chunkV1,
  paginaV1,
  paginaV2,
  registroV1,
  registroV2,
} from "./fixtures/ecogas";

const BASE = "https://www.ecogas.com.ar";
const PAGINA = `${BASE}/hogares-comercios/tramites-y-servicios/listado-de-gasistas-matriculados`;
const CHUNK_VIEJO = "/_next/static/chunks/3182-ad3160686a0b7005.js";
const CHUNK_NUEVO = "/_next/static/chunks/3182-5194f519f6f9f5b0.js";
const CHUNK_OTRO = "/_next/static/chunks/6174-35ac6fded7304203.js";

const config: ConfigLectura = {
  urlPagina: PAGINA,
  marcadorV2: "gasistasMatriculados",
  prefijoPreferido: "3182-",
  maxCandidatos: 20,
  reintentos: {
    maxIntentos: 3,
    esperasMs: [1000, 2000],
    timeoutPedidoMs: 20_000,
    timeoutConsultaMs: 45_000,
  },
  validacion: { umbralCaida: 0.5, pisoRegistros: 1 },
};

/** Reloj controlable: esperar avanza el tiempo y queda registrado. */
class RelojFalso implements Reloj {
  private t = Date.parse("2026-11-02T12:00:00Z");
  readonly esperas: number[] = [];
  ahora() {
    return new Date(this.t);
  }
  async esperar(ms: number) {
    this.esperas.push(ms);
    this.t += ms;
  }
  avanzar(ms: number) {
    this.t += ms;
  }
}

/** Cliente HTTP con un guion por URL: cada pedido consume la siguiente respuesta (la última se repite). */
class HttpFalso implements ClienteHttp {
  readonly pedidos: string[] = [];
  constructor(
    private readonly reloj: RelojFalso,
    private readonly guiones: Record<string, RespuestaHttp[]>,
  ) {}
  async obtener(url: string, { timeoutMs }: { userAgent: string; timeoutMs: number }) {
    this.pedidos.push(url);
    const guion = this.guiones[url];
    const respuesta = (guion && guion.length > 1 ? guion.shift() : guion?.[0]) ?? estado(404);
    const ms = !respuesta.ok && respuesta.error === "TIMEOUT" ? timeoutMs : respuesta.ms;
    this.reloj.avanzar(ms);
    return { ...respuesta, ms };
  }
}

function html(cuerpo: string): RespuestaHttp {
  return { ok: true, estado: 200, tipoContenido: "text/html; charset=utf-8", cuerpo, ms: 100 };
}
function js(cuerpo: string): RespuestaHttp {
  return { ok: true, estado: 200, tipoContenido: "application/javascript", cuerpo, ms: 50 };
}
function estado(codigo: number): RespuestaHttp {
  return { ok: true, estado: codigo, tipoContenido: "text/html", cuerpo: "error", ms: 50 };
}
const timeout: RespuestaHttp = { ok: false, error: "TIMEOUT", detalle: "sin respuesta", ms: 0 };

function preparar(guiones: Record<string, RespuestaHttp[]>) {
  const reloj = new RelojFalso();
  const http = new HttpFalso(reloj, guiones);
  const lector = new LectorEcogas(http, reloj, "MatriculAR/prueba");
  return { reloj, http, lector };
}

const sinAnterior = { cantidadAnterior: null };

describe("Lector de Ecogas", () => {
  it("formato actual (v2): lee el padrón de la página y calcula la huella del HTML", async () => {
    const pagina = paginaV2();
    const { lector } = preparar({ [PAGINA]: [html(pagina)] });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura).toMatchObject({
      ok: true,
      formato: "v2",
      urlResuelta: PAGINA,
      huella: createHash("sha256").update(pagina).digest("hex"),
    });
    expect(lectura.ok && lectura.registros).toHaveLength(3);
    expect(lectura.intentos).toHaveLength(1);
  });

  it("CAMBIO DE URL DEL RECURSO: descubre el chunk nuevo desde el HTML en lugar de usar una URL fija", async () => {
    const chunk = chunkV1();
    const { lector, http } = preparar({
      [PAGINA]: [html(paginaV1([CHUNK_OTRO, CHUNK_NUEVO]))],
      [`${BASE}${CHUNK_NUEVO}`]: [js(chunk)],
      [`${BASE}${CHUNK_OTRO}`]: [js(chunkSoloColumnas())],
    });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura).toMatchObject({
      ok: true,
      formato: "v1",
      urlResuelta: `${BASE}${CHUNK_NUEVO}`,
    });
    expect(http.pedidos).not.toContain(`${BASE}${CHUNK_VIEJO}`);
    // El prefijo preferido se prueba primero.
    expect(http.pedidos[1]).toBe(`${BASE}${CHUNK_NUEVO}`);
  });

  it("si el prefijo preferido ya no existe, recorre los demás candidatos", async () => {
    const renombrado = "/_next/static/chunks/9999-abcdef.js";
    const { lector } = preparar({
      [PAGINA]: [html(paginaV1([CHUNK_OTRO, renombrado]))],
      [`${BASE}${CHUNK_OTRO}`]: [js(chunkSoloColumnas())],
      [`${BASE}${renombrado}`]: [js(chunkV1([registroV1(0), registroV1(1)]))],
    });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura).toMatchObject({ ok: true, formato: "v1", urlResuelta: `${BASE}${renombrado}` });
  });

  it("CAMBIO DE ESTRUCTURA: formato desconocido es EXTRACTION_FAILED, sin reintento y nunca «0 matriculados»", async () => {
    const { lector, reloj } = preparar({
      [PAGINA]: [html(paginaV1([CHUNK_OTRO]))],
      [`${BASE}${CHUNK_OTRO}`]: [js(chunkSoloColumnas())],
    });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura).toMatchObject({ ok: false, motivo: "EXTRACTION_FAILED" });
    expect(lectura.ok || lectura.detalle).toMatch(/Formato desconocido/);
    expect(lectura.intentos).toHaveLength(1);
    expect(reloj.esperas).toEqual([]);
  });

  it("EXTRACCIÓN INCOMPLETA: un registro sin clave obligatoria es EXTRACTION_FAILED, sin reintento", async () => {
    const incompleto = paginaV2({
      registros: [registroV2(0), { ...registroV2(1), nombre_apellido: undefined }],
    });
    const { lector } = preparar({ [PAGINA]: [html(incompleto)] });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura).toMatchObject({ ok: false, motivo: "EXTRACTION_FAILED" });
    expect(lectura.intentos).toHaveLength(1);
  });

  it("la página del listado devuelve 404: cambió de dirección, EXTRACTION_FAILED sin reintento", async () => {
    const { lector } = preparar({ [PAGINA]: [estado(404)] });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura).toMatchObject({ ok: false, motivo: "EXTRACTION_FAILED" });
    expect(lectura.intentos).toHaveLength(1);
  });

  it("403 (lo que respondió Ecogas a una IP de nube el 02/11) es SOURCE_UNAVAILABLE y no se reintenta", async () => {
    const { lector, reloj } = preparar({ [PAGINA]: [estado(403)] });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura).toMatchObject({ ok: false, motivo: "SOURCE_UNAVAILABLE" });
    expect(lectura.ok || lectura.detalle).toMatch(/403/);
    expect(lectura.intentos).toHaveLength(1);
    expect(reloj.esperas).toEqual([]);
  });

  it("una falla transitoria (503) se reintenta después de 1 s, y la lectura registra los dos Intentos", async () => {
    const { lector, reloj } = preparar({ [PAGINA]: [estado(503), html(paginaV2())] });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura.ok).toBe(true);
    expect(lectura.intentos.map((i) => i.pedidos[0]?.estadoHttp)).toEqual([503, 200]);
    expect(lectura.intentos[0]?.error).toMatch(/503/);
    expect(reloj.esperas).toEqual([1000]);
  });

  it("con tiempos agotados respeta el presupuesto: 20 s + 1 s + 20 s, y el tercer Intento no arranca", async () => {
    const { lector, reloj } = preparar({ [PAGINA]: [timeout] });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura).toMatchObject({ ok: false, motivo: "SOURCE_UNAVAILABLE" });
    expect(lectura.intentos).toHaveLength(2);
    expect(lectura.intentos.map((i) => i.pedidos[0]?.error)).toEqual(["TIMEOUT", "TIMEOUT"]);
    expect(reloj.esperas).toEqual([1000]);
    expect(lectura.ok || lectura.detalle).toMatch(/Se agotó el tiempo de la Consulta/);
  });

  it("V5: una caída brusca respecto de la lectura anterior es EXTRACTION_FAILED", async () => {
    const { lector } = preparar({ [PAGINA]: [html(paginaV2())] });
    const lectura = await lector.leer(config, { cantidadAnterior: 5031 });
    expect(lectura).toMatchObject({ ok: false, motivo: "EXTRACTION_FAILED" });
    expect(lectura.ok || lectura.detalle).toMatch(/^V5/);
  });

  it("nunca devuelve una lectura exitosa sin registros", async () => {
    const { lector } = preparar({ [PAGINA]: [html(paginaV2({ registros: [] }))] });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura.ok).toBe(false);
  });

  it("una respuesta que no es HTML no se interpreta", async () => {
    const { lector } = preparar({
      [PAGINA]: [
        { ok: true, estado: 200, tipoContenido: "application/json", cuerpo: "{}", ms: 10 },
      ],
    });
    const lectura = await lector.leer(config, sinAnterior);
    expect(lectura).toMatchObject({ ok: false, motivo: "EXTRACTION_FAILED" });
  });
});
