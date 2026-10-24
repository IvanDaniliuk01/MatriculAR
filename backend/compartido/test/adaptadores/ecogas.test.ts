import { describe, expect, it } from "vitest";
import { EcogasRecursoNext, codigoProvincia, decodificarLiteralJs } from "../../src/adaptadores/fuentes/ecogas";
import type { Fuente, Provincia } from "../../src/dominio/tipos";
import type { Lectura, PedidoLectura } from "../../src/puertos/fuentes";
import {
  RelojFalso, URL_PAGE_JS, URL_PAGINA, URL_RECURSO, aLiteralJs, descargarFalso, guionNormal,
  htmlListado, recursoPadron, recursoPagina, registrosFalsos,
} from "./fixtures/fabricar";

const provincias: Provincia[] = [
  { codigo: "CORDOBA", nombre: "Córdoba", alias: [] },
  { codigo: "MENDOZA", nombre: "Mendoza", alias: [] },
  { codigo: "SAN_LUIS", nombre: "San Luis", alias: [] },
  { codigo: "SAN_JUAN", nombre: "San Juan", alias: [] },
  { codigo: "CATAMARCA", nombre: "Catamarca", alias: [] },
  { codigo: "LA_RIOJA", nombre: "La Rioja", alias: [] },
];

export const fuenteEcogas: Fuente = {
  fuente_id: "ecogas", version: 1, nombre: "Ecogas",
  area_concesion: ["CORDOBA", "CATAMARCA", "LA_RIOJA", "MENDOZA", "SAN_JUAN", "SAN_LUIS"],
  area_concesion_parcial: [], modo_acceso: "AUTOMATED", adaptador: "ECOGAS_NEXT_RESOURCE",
  url_pagina: URL_PAGINA, url_buscador_oficial: URL_PAGINA,
  config_extraccion: {
    prefijo_preferido: "3182-", max_candidatos: 20,
    claves_obligatorias: ["id", "nombre_apellido", "categoria", "provincia", "localidad"],
    claves_conocidas: ["correo_electronico", "telefono", "barrio"],
  },
  config_reintentos: { max_intentos: 3, esperas_ms: [1000, 2000], timeout_pedido_ms: 6000, timeout_consulta_ms: 24000 },
  config_validacion: { umbral_caida: 0.5, piso_registros: 1000 },
  limitaciones: [], activa: true,
};

const pedido = (matriculas = ["99001"], previos: number | null = null): PedidoLectura => ({
  fuente: fuenteEcogas, matriculas, provincias, registros_ultima_consulta_exitosa: previos,
});

function leer(guion = guionNormal(), p = pedido()) {
  const reloj = new RelojFalso();
  const { descargar, pedidos } = descargarFalso(guion, reloj);
  const adaptador = new EcogasRecursoNext(descargar, reloj);
  return adaptador.leer(p).then((lectura) => ({ lectura, pedidos, reloj }));
}

const fallida = (l: Lectura) => {
  if (l.tipo !== "FALLIDA") throw new Error(`se esperaba FALLIDA y fue ${l.tipo}`);
  return l;
};

describe("Ecogas · lectura exitosa", () => {
  it("encuentra el recurso en 2 pedidos (página + archivo) cuando el prefijo preferido es correcto", async () => {
    const { lectura, pedidos } = await leer();
    expect(lectura.tipo).toBe("EXITOSA");
    expect(pedidos).toEqual([URL_PAGINA, URL_RECURSO]);
  });

  it("normaliza el registro y NO devuelve email, teléfono ni barrio (INV-9)", async () => {
    const { lectura } = await leer();
    if (lectura.tipo !== "EXITOSA") throw new Error("falló");
    const r = lectura.resultados.get("99001");
    expect(r).toEqual({
      matricula: "99001", nombre_informado: "PERSONA FICTICIA UNO", categoria_informada: "2",
      provincia_informada: "CORDOBA", localidad_informada: "CORDOBA",
    });
    expect(JSON.stringify(lectura)).not.toMatch(/ejemplo\.invalid|BARRIO FICTICIO|000-99001/);
  });

  it("la categoría se conserva como texto, sin convertirla a número (INV-7)", async () => {
    const { lectura } = await leer(guionNormal(), pedido(["99007"]));
    if (lectura.tipo !== "EXITOSA") throw new Error("falló");
    expect(lectura.resultados.get("99007")?.categoria_informada).toBe("9");
  });

  it("una matrícula que no está en el recurso es null (no figura)", async () => {
    const { lectura } = await leer(guionNormal(), pedido(["99004"]));
    if (lectura.tipo !== "EXITOSA") throw new Error("falló");
    expect(lectura.resultados.get("99004")).toBeNull();
  });

  it("no pierde registros con tildes, Ñ, apóstrofos ni barras (parsea la lista completa)", async () => {
    const { lectura } = await leer(guionNormal(), pedido(["99005", "99006"]));
    if (lectura.tipo !== "EXITOSA") throw new Error("falló");
    expect(lectura.resultados.get("99005")?.nombre_informado).toBe("MUÑOZ, JOSÉ D'ANGELO");
    expect(lectura.resultados.get("99006")?.nombre_informado).toBe("NÚÑEZ \\ ÑANDÚ");
    expect(lectura.metadatos.registros_extraidos).toBe(1500);
  });

  it("registra huella SHA-256, bytes, resumen y claves no esperadas (aviso, no falla)", async () => {
    const registros = registrosFalsos().map((r, i) => (i === 0 ? { ...r, fecha_vencimiento: "2027-03-31" } : r));
    const { lectura } = await leer(guionNormal(registros));
    if (lectura.tipo !== "EXITOSA") throw new Error("falló");
    expect(lectura.metadatos.huella_recurso).toMatch(/^[0-9a-f]{64}$/);
    expect(lectura.metadatos.bytes_recurso).toBeGreaterThan(1000);
    expect(lectura.metadatos.claves_no_esperadas).toEqual(["fecha_vencimiento"]);
    expect(Object.values(lectura.metadatos.resumen.por_categoria).reduce((a, b) => a + b, 0)).toBe(1500);
    expect(lectura.metadatos.resumen.por_provincia.SAN_LUIS).toBeGreaterThan(0);
  });

  it("dos lecturas del mismo contenido dan la misma huella", async () => {
    const a = await leer();
    const b = await leer();
    if (a.lectura.tipo !== "EXITOSA" || b.lectura.tipo !== "EXITOSA") throw new Error("falló");
    expect(a.lectura.metadatos.huella_recurso).toBe(b.lectura.metadatos.huella_recurso);
  });

  it("si el prefijo preferido cambia, recorre los otros candidatos sin fallar", async () => {
    const padron = recursoPadron(registrosFalsos());
    const nuevo = "https://www.ecogas.test/_next/static/chunks/9999-ffff.js";
    const { lectura, pedidos } = await leer((url) => {
      if (url === URL_PAGINA) return { contentType: "text/html", body: htmlListado([URL_PAGE_JS, nuevo]) };
      if (url === URL_PAGE_JS) return { contentType: "application/javascript", body: recursoPagina() };
      if (url === nuevo) return { contentType: "application/javascript", body: padron };
      return { status: 404, contentType: "text/html", body: "x" };
    });
    expect(lectura.tipo).toBe("EXITOSA");
    // primero el archivo de la página (no sirve: define columnas), después el resto
    expect(pedidos).toEqual([URL_PAGINA, URL_PAGE_JS, nuevo]);
  });
});

describe("Ecogas · las cinco validaciones (nunca '0 matriculados')", () => {
  it("V1: la URL vieja da 404 con HTML → no es el recurso; si no hay otro, EXTRACTION_FAILED", async () => {
    const { lectura } = await leer((url) =>
      url === URL_PAGINA
        ? { contentType: "text/html", body: htmlListado([URL_RECURSO]) }
        : { status: 404, contentType: "text/html", body: "<html>404</html>" },
    );
    const f = fallida(lectura);
    expect(f.motivo).toBe("EXTRACTION_FAILED");
    expect(f.detalle).toMatch(/V[12]/);
    expect(f.intentos).toHaveLength(1); // cambio estructural: no se reintenta
  });

  it("V1: 200 pero con content-type HTML (en vez de JavaScript) no se acepta como recurso", async () => {
    const { lectura } = await leer((url) =>
      url === URL_PAGINA
        ? { contentType: "text/html", body: htmlListado([URL_RECURSO]) }
        : { contentType: "text/html", body: recursoPadron(registrosFalsos()) },
    );
    expect(fallida(lectura).motivo).toBe("EXTRACTION_FAILED");
  });

  it("V1: la página del listado cambia de dirección (404) → EXTRACTION_FAILED sin reintentos", async () => {
    const { lectura, pedidos } = await leer(() => ({ status: 404, contentType: "text/html", body: "x" }));
    expect(fallida(lectura).motivo).toBe("EXTRACTION_FAILED");
    expect(pedidos).toHaveLength(1);
  });

  it("la página no referencia ningún script del sitio → EXTRACTION_FAILED", async () => {
    const { lectura } = await leer(() => ({ contentType: "text/html", body: "<html><body>Sitio nuevo</body></html>" }));
    expect(fallida(lectura).motivo).toBe("EXTRACTION_FAILED");
  });

  it("V2: solo está el archivo de la página (define columnas, sin lista) → marcador no encontrado", async () => {
    const { lectura } = await leer((url) =>
      url === URL_PAGINA
        ? { contentType: "text/html", body: htmlListado([URL_PAGE_JS]) }
        : { contentType: "application/javascript", body: recursoPagina() },
    );
    const f = fallida(lectura);
    expect(f.motivo).toBe("EXTRACTION_FAILED");
    expect(f.detalle).toMatch(/V2/);
  });

  it("V3: literal truncado o corrupto → EXTRACTION_FAILED con detalle de parseo", async () => {
    const roto = recursoPadron(registrosFalsos()).replace(/\}\]\\*'\)\}\}\]\);$/, "");
    const { lectura } = await leer((url) =>
      url === URL_PAGINA
        ? { contentType: "text/html", body: htmlListado([URL_RECURSO]) }
        : { contentType: "application/javascript", body: roto },
    );
    expect(fallida(lectura).motivo).toBe("EXTRACTION_FAILED");
  });

  it("V3: un escape inválido en el literal no se ignora", async () => {
    expect(() => decodificarLiteralJs("abc\\xZZ")).toThrow();
    expect(decodificarLiteralJs("a\\x41\\u00f1\\\\\\'")).toBe("aAñ\\'");
  });

it("lista vacía → EXTRACTION_FAILED (V2: sin marcador de registros), nunca 'éxito sin registros'", async () => {
    const { lectura } = await leer(guionNormal([]));
    const f = fallida(lectura);
    expect(f.motivo).toBe("EXTRACTION_FAILED");
    expect(f.detalle).toMatch(/V[24]/);
  });

  it("V4: registros con la forma esperada pero sin id → EXTRACTION_FAILED", async () => {
    const sinId = registrosFalsos().map(({ id, ...r }) => ({ ...r, id: "" }));
    const { lectura } = await leer(guionNormal(sinId));
    expect(fallida(lectura).detalle).toMatch(/V4/);
  });

  it("V4: una clave obligatoria renombrada (cambio de estructura) → EXTRACTION_FAILED", async () => {
    const renombrados = registrosFalsos().map(({ categoria, ...r }) => ({ ...r, categoria_matricula: categoria }));
    const { lectura } = await leer(guionNormal(renombrados));
    const f = fallida(lectura);
    expect(f.detalle).toMatch(/V4.*categoria/);
  });

  it("V4: ids repetidos → EXTRACTION_FAILED", async () => {
    const dup = registrosFalsos();
    dup[1] = { ...(dup[1] as object), id: "99001" } as (typeof dup)[number];
    const { lectura } = await leer(guionNormal(dup));
    expect(fallida(lectura).detalle).toMatch(/V4/);
  });

  it("V4: el orden de las claves cambia pero la estructura es la misma → sigue funcionando", async () => {
    const reordenados = registrosFalsos().map((r) => Object.fromEntries(Object.entries(r).reverse()));
    const { lectura } = await leer(guionNormal(reordenados));
    expect(lectura.tipo).toBe("EXITOSA");
  });

  it("V5: por debajo del piso absoluto de 1.000 registros → EXTRACTION_FAILED", async () => {
    const { lectura } = await leer(guionNormal(registrosFalsos(300)));
    expect(fallida(lectura).detalle).toMatch(/V5.*piso/);
  });

  it("V5: caída de más del 50 % respecto de la última consulta exitosa → EXTRACTION_FAILED", async () => {
    const { lectura } = await leer(guionNormal(registrosFalsos(1500)), pedido(["99001"], 5031));
    expect(fallida(lectura).detalle).toMatch(/V5.*caída/);
  });

  it("V5: una caída moderada (o crecimiento) sí se acepta", async () => {
    const { lectura } = await leer(guionNormal(registrosFalsos(1500)), pedido(["99001"], 2000));
    expect(lectura.tipo).toBe("EXITOSA");
  });
});

describe("Ecogas · fallas transitorias y reintentos", () => {
  it("HTTP 503 dos veces y luego éxito: 3 Intentos, esperas de 1 s y 2 s", async () => {
    const normal = guionNormal();
    const { lectura, reloj } = await leer((url, n) => (url === URL_PAGINA && n <= 2 ? { status: 503, body: "x" } : normal(url, n)));
    if (lectura.tipo !== "EXITOSA") throw new Error("falló");
    expect(lectura.intentos.map((i) => i.resultado)).toEqual(["SOURCE_UNAVAILABLE", "SOURCE_UNAVAILABLE", "SUCCESS"]);
    expect(lectura.intentos[0]?.reintentable).toBe(true);
    expect(reloj.t - Date.parse("2026-10-24T15:00:00.000Z")).toBe(3000);
  });

  it("falla de red en los 3 Intentos → SOURCE_UNAVAILABLE (no EXTRACTION_FAILED ni 'no figura')", async () => {
    const { lectura } = await leer(() => ({ errorRed: "ECONNREFUSED" }));
    const f = fallida(lectura);
    expect(f.motivo).toBe("SOURCE_UNAVAILABLE");
    expect(f.intentos).toHaveLength(3);
    expect(f.intentos[0]?.pedidos[0]?.error).toMatch(/ECONNREFUSED/);
  });

  it("timeout de un pedido se registra como TIMEOUT y se reintenta", async () => {
    const normal = guionNormal();
    const { lectura } = await leer((url, n) => (url === URL_PAGINA && n === 1 ? { excedeTimeout: true, tardaMs: 6000 } : normal(url, n)));
    if (lectura.tipo !== "EXITOSA") throw new Error("falló");
    expect(lectura.intentos[0]?.pedidos[0]?.error).toBe("TIMEOUT");
    expect(lectura.intentos).toHaveLength(2);
  });

  it("HTTP 403 (posible bloqueo) NO se reintenta", async () => {
    const { lectura } = await leer(() => ({ status: 403, body: "bloqueado" }));
    const f = fallida(lectura);
    expect(f.motivo).toBe("SOURCE_UNAVAILABLE");
    expect(f.intentos).toHaveLength(1);
  });

  it("HTTP 429 se reintenta", async () => {
    const normal = guionNormal();
    const { lectura } = await leer((url, n) => (url === URL_PAGINA && n === 1 ? { status: 429 } : normal(url, n)));
    expect(lectura.tipo).toBe("EXITOSA");
    expect(lectura.intentos).toHaveLength(2);
  });

  it("se respeta el presupuesto total de 24 s: no arranca un Intento que no entra", async () => {
    // Cada pedido tarda 6 s y falla: 6 + 1 + 6 + 2 = 15 s; el tercer Intento arranca (quedan 9 s ≥ 6 s).
    const { lectura, reloj } = await leer(() => ({ excedeTimeout: true, tardaMs: 6000 }));
    expect(fallida(lectura).intentos).toHaveLength(3);
    expect(reloj.t - Date.parse("2026-10-24T15:00:00.000Z")).toBeLessThanOrEqual(24000);
  });

  it("una EXTRACTION_FAILED nunca se reintenta (fallaría igual)", async () => {
    const { lectura, pedidos } = await leer(guionNormal([]));
    expect(fallida(lectura).intentos).toHaveLength(1);
    expect(pedidos.filter((u) => u === URL_PAGINA)).toHaveLength(1);
  });
});

describe("utilidades", () => {
  it("codigoProvincia normaliza tildes y espacios al catálogo", () => {
    expect(codigoProvincia("San Luis", provincias)).toBe("SAN_LUIS");
    expect(codigoProvincia("CÓRDOBA", provincias)).toBe("CORDOBA");
    expect(codigoProvincia("Tierra del Fuego", provincias)).toBe("TIERRA_DEL_FUEGO");
  });
  it("aLiteralJs y decodificarLiteralJs son inversos", () => {
    const t = `MUÑOZ 'Ñ' \\ ✓ "q"`;
    expect(decodificarLiteralJs(aLiteralJs(t))).toBe(t);
  });
});
