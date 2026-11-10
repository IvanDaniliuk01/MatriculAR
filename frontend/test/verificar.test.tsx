import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { reiniciarUrlApi, urlApi } from "../src/api/cliente";
import type { CondicionDecisiva, Verificacion } from "../src/api/tipos";

const API = "https://api.ejemplo.test/v1";

const condiciones: CondicionDecisiva[] = [
  {
    condicion_id: "comercio_o_industria",
    orden: 1,
    pregunta: "¿El trabajo es en un comercio o una industria?",
    ayuda: "Ayuda 1",
    fundamento: { norma: "NAG-200", articulo: "8.4.1", url: "https://ejemplo.test/nag200" },
  },
  {
    condicion_id: "unica_vivienda",
    orden: 2,
    pregunta: "¿El terreno tiene una única vivienda?",
    ayuda: "Ayuda 2",
    fundamento: { norma: "NAG-200", articulo: "8.4.1", url: "https://ejemplo.test/nag200" },
  },
];

const consulta = {
  consulta_id: "C1",
  estado: "SUCCEEDED",
  motivo_falla: null,
  detalle_falla: null,
  iniciada_en: "2026-11-02T18:40:10.205Z",
  finalizada_en: "2026-11-02T18:40:24.345Z",
  cantidad_intentos: 1,
  registros_extraidos: 4836,
  formato_recurso: "v2",
  huella_recurso: "abc123",
  reutilizada: false,
};

const fuente = { fuente_id: "ecogas", nombre: "Ecogas" };

function verificacion(cambios: Partial<Verificacion>): Verificacion {
  return {
    verificacion_id: "V1",
    solicitada_en: "2026-11-02T18:40:10.205Z",
    pedido: {
      fuente,
      gasista: { nombre_apellido: "PERSONA FICTICIA UNO", localidad: null },
      provincia_trabajo: { codigo: "CORDOBA", nombre: "Córdoba" },
    },
    tipos_trabajo_posibles: [
      {
        tipo_trabajo_id: "artefacto-vivienda-unifamiliar",
        codigo: "A1",
        nombre: "Artefacto",
        version: 1,
      },
    ],
    resultado_verificacion: "FOUND",
    mensaje: "PERSONA FICTICIA UNO figura en el padrón de Ecogas con categoría 2ª.",
    consulta,
    coincidencias: [],
    credenciales_previas: [],
    buscador_oficial: null,
    ...cambios,
  };
}

const encontrada = verificacion({
  coincidencias: [
    {
      credencial: {
        fuente,
        nombre_informado: "PERSONA FICTICIA UNO",
        categoria_informada: "2",
        provincia_informada: "CORDOBA",
        localidad_informada: "RIO CUARTO",
        valores_fuente: { id: 1 },
        consultada_en: "2026-11-02T18:40:24.345Z",
      },
      evaluacion: {
        evaluacion_id: "E1",
        resultado: "COMPATIBLE",
        resultados_por_tipo: [
          {
            tipo_trabajo_id: "artefacto-vivienda-unifamiliar",
            tipo_trabajo_version: 1,
            resultado: "COMPATIBLE",
            criterio_categoria: {
              resultado: "MET",
              categoria_informada: "2",
              fundamento:
                "La categoría 2ª está admitida para este tipo de trabajo (NAG-200, 8.3.1).",
            },
            regla_aplicada: { categorias_admitidas: ["1", "2", "3"] },
          },
        ],
        condiciones_que_resuelven: [],
        explicacion: "La categoría informada (2ª) es compatible.",
        limitaciones: ["La Fuente no informa la vigencia de la matrícula."],
      },
    },
  ],
});

type Respuesta = { estado: number; cuerpo?: unknown };

/** fetch falso: config.json y catálogos fijos; POST /verificaciones responde `alVerificar`. */
function simularApi(alVerificar: Respuesta, config: Respuesta = { estado: 404 }) {
  const fetchFalso = vi.fn(async (entrada: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(entrada);
    const responder = ({ estado, cuerpo }: Respuesta) =>
      new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado });
    if (url.endsWith("/config.json")) return responder(config);
    if (url === `${API}/fuentes`)
      return responder({ estado: 200, cuerpo: [{ ...fuente, modo_acceso: "AUTOMATED" }] });
    if (url === `${API}/provincias`)
      return responder({ estado: 200, cuerpo: [{ codigo: "CORDOBA", nombre: "Córdoba" }] });
    if (url === `${API}/tipos-trabajo`)
      return responder({
        estado: 200,
        cuerpo: { tipos_trabajo: [], condiciones_decisivas: condiciones },
      });
    if (url === `${API}/verificaciones`) return responder(alVerificar);
    return responder({ estado: 404 });
  });
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

async function completarYEnviar(nombre: string) {
  const usuario = userEvent.setup();
  await usuario.type(await screen.findByLabelText("Nombre y apellido"), nombre);
  for (const grupo of screen.getAllByRole("group").slice(1)) {
    const no = Array.from(grupo.querySelectorAll<HTMLInputElement>('input[value="NO"]'))[0];
    if (no) await usuario.click(no);
  }
  await usuario.click(screen.getByRole("button", { name: "Verificar" }));
}

beforeEach(() => {
  reiniciarUrlApi();
  vi.stubEnv("VITE_API_URL", API);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Verificar a un gasista", () => {
  it("muestra el formulario con las Condiciones decisivas que da la API", async () => {
    simularApi({ estado: 201, cuerpo: encontrada });
    render(<App />);
    expect(await screen.findByLabelText("Nombre y apellido")).toBeTruthy();
    expect(screen.getByText("¿El trabajo es en un comercio o una industria?")).toBeTruthy();
    expect(screen.getByText("¿El terreno tiene una única vivienda?")).toBeTruthy();
    expect(screen.getAllByLabelText("No sé")).toHaveLength(2);
  });

  it("envía el pedido y muestra el resultado con su evidencia y limitaciones", async () => {
    const fetchFalso = simularApi({ estado: 201, cuerpo: encontrada });
    render(<App />);
    await completarYEnviar("Persona Ficticia Uno");

    expect(await screen.findByText("Compatible según la regla aplicada")).toBeTruthy();
    expect(screen.getByText("RIO CUARTO", { exact: false })).toBeTruthy();
    expect(screen.getByText("La Fuente no informa la vigencia de la matrícula.")).toBeTruthy();

    const post = fetchFalso.mock.calls.find(([url]) => String(url).endsWith("/verificaciones"));
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      fuente_id: "ecogas",
      gasista: { nombre_apellido: "Persona Ficticia Uno" },
      condiciones: { comercio_o_industria: "NO", unica_vivienda: "NO" },
      provincia_trabajo: "CORDOBA",
    });
  });

  it("no envía el pedido si falta el apellido o alguna respuesta", async () => {
    const fetchFalso = simularApi({ estado: 201, cuerpo: encontrada });
    render(<App />);
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText("Nombre y apellido"), "Persona");
    await usuario.click(screen.getByRole("button", { name: "Verificar" }));

    expect(screen.getByText(/al menos dos palabras/)).toBeTruthy();
    expect(screen.getByText(/Faltan 2/)).toBeTruthy();
    expect(fetchFalso.mock.calls.some(([url]) => String(url).endsWith("/verificaciones"))).toBe(
      false,
    );
  });

  it("si la Fuente no responde, lo dice y muestra la evidencia previa como contexto", async () => {
    simularApi({
      estado: 201,
      cuerpo: verificacion({
        resultado_verificacion: "UNVERIFIABLE",
        mensaje: "No pudimos consultar el padrón de Ecogas.",
        consulta: { ...consulta, estado: "FAILED", motivo_falla: "SOURCE_UNAVAILABLE" },
        credenciales_previas: [
          {
            fuente,
            nombre_informado: "PERSONA FICTICIA UNO",
            categoria_informada: "2",
            provincia_informada: "CORDOBA",
            localidad_informada: "RIO CUARTO",
            valores_fuente: {},
            consultada_en: "2026-10-20T13:05:02.140Z",
          },
        ],
        buscador_oficial: "https://www.ecogas.com.ar/buscador",
      }),
    });
    render(<App />);
    await completarYEnviar("Persona Ficticia Uno");

    expect(await screen.findByText("No pudimos consultar la Fuente")).toBeTruthy();
    expect(screen.getByText("Última evidencia disponible (no se usa para concluir)")).toBeTruthy();
    expect(screen.getByRole("link", { name: "buscador oficial de Ecogas" })).toBeTruthy();
  });

  it("muestra el mensaje de la API cuando responde 422", async () => {
    simularApi({
      estado: 422,
      cuerpo: {
        error: {
          codigo: "WORK_NOT_COVERED",
          mensaje: "Con esas respuestas no queda ningún tipo de trabajo cubierto.",
          detalles: [],
        },
      },
    });
    render(<App />);
    await completarYEnviar("Persona Ficticia Uno");

    expect(
      await screen.findByText("Con esas respuestas no queda ningún tipo de trabajo cubierto."),
    ).toBeTruthy();
  });
});

describe("URL de la API", () => {
  it("usa api_url de config.json si existe", async () => {
    simularApi({ estado: 201 }, { estado: 200, cuerpo: { api_url: "https://nube.test/v1/" } });
    expect(await urlApi()).toBe("https://nube.test/v1");
  });

  it("sin config.json usa VITE_API_URL", async () => {
    simularApi({ estado: 201 });
    expect(await urlApi()).toBe(API);
  });

  it("sin config.json ni VITE_API_URL usa localhost:3000", async () => {
    vi.stubEnv("VITE_API_URL", "");
    simularApi({ estado: 201 });
    expect(await urlApi()).toBe("http://localhost:3000");
  });
});
