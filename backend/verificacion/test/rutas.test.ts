import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { repositoriosEnMemoria } from "../../compartido/src/adaptadores/memoria/repositorios";
import {
  configsLecturaDelSeed,
  reglasDelSeed,
} from "../../compartido/src/adaptadores/reglas/reglas-seed";
import type { DependenciasVerificar } from "../../compartido/src/aplicacion/verificar";
import type { ResultadoLectura } from "../../compartido/src/puertos/lector-fuente";
import { crearRutas } from "../src/handlers/rutas";

const leido = (id: string, nombre: string, categoria: string, localidad: string) => ({
  registro: { idInterno: id, nombre, categoria, provincia: "CORDOBA", localidad },
  valoresFuente: { id: Number(id), nombre_apellido: nombre, categoria: { numero: categoria } },
});

const LECTURA: ResultadoLectura = {
  ok: true,
  intentos: [{ numero: 1, iniciadoEn: "", finalizadoEn: "", pedidos: [] }],
  huella: "b".repeat(64),
  formato: "v2",
  urlResuelta: "https://ecogas.example/listado",
  registros: [
    leido("1", "PERSONA FICTICIA UNO", "2", "RIO CUARTO"),
    leido("2", "PERSONA FICTICIA DOS", "4", "VILLA MARIA"),
  ],
  clavesNoEsperadas: [],
};

function armar(lectura: ResultadoLectura | Error = LECTURA) {
  let id = 0;
  const repos = repositoriosEnMemoria();
  const deps: DependenciasVerificar = {
    reglas: reglasDelSeed(),
    configsLectura: configsLecturaDelSeed(),
    lector: {
      async leer() {
        if (lectura instanceof Error) throw lectura;
        return lectura;
      },
    },
    ...repos,
    reloj: { ahora: () => new Date("2026-11-02T18:40:00Z"), esperar: async () => {} },
    ids: { nuevo: () => `id-${++id}` },
  };
  const registros: unknown[] = [];
  const rutas = crearRutas(deps, {
    origenCors: "https://matricular.example",
    log: (r) => registros.push(r),
  });
  return { rutas, deps, repos, registros };
}

function evento(httpMethod: string, path: string, cambios: Partial<APIGatewayProxyEvent> = {}) {
  return {
    httpMethod,
    path,
    body: null,
    queryStringParameters: null,
    ...cambios,
  } as APIGatewayProxyEvent;
}

const condiciones = {
  comercio_o_industria: "NO",
  unica_vivienda: "SI",
  consumo_total_hasta_5m3h: "SI",
  artefacto_mas_de_50000: "NO",
  gas_natural_red_baja_presion: "SI",
};

function postVerificacion(cuerpo: unknown) {
  return evento("POST", "/verificaciones", {
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

const pedido = (cambios: Record<string, unknown> = {}) => ({
  fuente_id: "ecogas",
  gasista: { nombre_apellido: "Persona Ficticia Uno" },
  condiciones,
  provincia_trabajo: "CORDOBA",
  ...cambios,
});

const cuerpo = (r: { body: string }) => JSON.parse(r.body);

describe("POST /verificaciones", () => {
  it("201 con la forma de docs/api.md § 3.2", async () => {
    const { rutas } = armar();
    const respuesta = await rutas(postVerificacion(pedido()));
    expect(respuesta.statusCode).toBe(201);
    const v = cuerpo(respuesta);
    expect(v).toMatchObject({
      verificacion_id: expect.any(String),
      solicitada_en: "2026-11-02T18:40:00.000Z",
      pedido: {
        fuente: { fuente_id: "ecogas", nombre: "Ecogas" },
        gasista: { nombre_apellido: "PERSONA FICTICIA UNO", localidad: null },
        condiciones,
        provincia_trabajo: { codigo: "CORDOBA", nombre: "Córdoba" },
      },
      tipos_trabajo_posibles: [
        { tipo_trabajo_id: "artefacto-vivienda-unifamiliar", codigo: "A1", version: 1 },
      ],
      resultado_verificacion: "FOUND",
      consulta: {
        estado: "SUCCEEDED",
        motivo_falla: null,
        cantidad_intentos: 1,
        registros_extraidos: 2,
        formato_recurso: "v2",
        huella_recurso: "b".repeat(64),
        reutilizada: false,
      },
      credenciales_previas: [],
      buscador_oficial: null,
    });
    const [coincidencia] = v.coincidencias;
    expect(coincidencia.credencial).toMatchObject({
      fuente: { fuente_id: "ecogas", nombre: "Ecogas" },
      nombre_informado: "PERSONA FICTICIA UNO",
      categoria_informada: "2",
      localidad_informada: "RIO CUARTO",
      valores_fuente: { id: 1 },
      consultada_en: v.consulta.finalizada_en,
    });
    expect(coincidencia.evaluacion).toMatchObject({
      evaluacion_id: expect.any(String),
      resultado: "COMPATIBLE",
      resultados_por_tipo: [
        {
          tipo_trabajo_id: "artefacto-vivienda-unifamiliar",
          tipo_trabajo_version: 1,
          resultado: "COMPATIBLE",
          criterio_categoria: {
            resultado: "MET",
            categoria_informada: "2",
            fundamento: "La categoría 2ª está admitida para este tipo de trabajo (NAG-200, 8.3.1).",
          },
          regla_aplicada: { categorias_admitidas: ["1", "2", "3"] },
        },
      ],
      condiciones_que_resuelven: [],
    });
    expect(coincidencia.evaluacion.explicacion).toMatch(
      /La vigencia de la matrícula no pudo verificarse/,
    );
    expect(coincidencia.evaluacion.limitaciones).toEqual(
      expect.arrayContaining([expect.stringMatching(/no publica el número de matrícula/)]),
    );
  });

  it("una categoría desconocida no tiene fundamento: el Criterio queda INDETERMINATE", async () => {
    const { rutas } = armar();
    const v = cuerpo(
      await rutas(
        postVerificacion(pedido({ gasista: { nombre_apellido: "Persona Ficticia Dos" } })),
      ),
    );
    expect(v.coincidencias[0].evaluacion.resultados_por_tipo[0].criterio_categoria).toEqual({
      resultado: "INDETERMINATE",
      categoria_informada: "4",
      fundamento: null,
    });
  });

  it("si la Fuente falla responde 201 UNVERIFIABLE, nunca 5xx, y registra la falla para la alarma", async () => {
    const { rutas, registros } = armar({
      ok: false,
      motivo: "SOURCE_UNAVAILABLE",
      detalle: "HTTP 403",
      intentos: [{ numero: 1, iniciadoEn: "", finalizadoEn: "", pedidos: [] }],
    });
    const respuesta = await rutas(postVerificacion(pedido()));
    expect(respuesta.statusCode).toBe(201);
    expect(cuerpo(respuesta)).toMatchObject({
      resultado_verificacion: "UNVERIFIABLE",
      consulta: { estado: "FAILED", motivo_falla: "SOURCE_UNAVAILABLE", detalle_falla: "HTTP 403" },
      buscador_oficial: expect.stringMatching(/^https:\/\/www\.ecogas\.com\.ar/),
    });
    expect(registros).toContainEqual(
      expect.objectContaining({
        evento: "consulta_finalizada",
        estado: "FAILED",
        motivo: "SOURCE_UNAVAILABLE",
        fuente_id: "ecogas",
      }),
    );
  });

  it.each([
    ["JSON inválido", "{no es json", 400, "VALIDATION_ERROR"],
    ["sin cuerpo", "", 400, "VALIDATION_ERROR"],
    [
      "falta una Condición decisiva",
      pedido({ condiciones: { comercio_o_industria: "NO" } }),
      400,
      "VALIDATION_ERROR",
    ],
    [
      "una respuesta inválida",
      pedido({ condiciones: { ...condiciones, unica_vivienda: "TAL_VEZ" } }),
      400,
      "VALIDATION_ERROR",
    ],
    [
      "un nombre de una palabra",
      pedido({ gasista: { nombre_apellido: "Pérez" } }),
      400,
      "VALIDATION_ERROR",
    ],
    ["una Fuente desconocida", pedido({ fuente_id: "camuzzi" }), 404, "SOURCE_NOT_FOUND"],
    [
      "un trabajo no cubierto",
      pedido({ condiciones: { ...condiciones, gas_natural_red_baja_presion: "NO" } }),
      422,
      "WORK_NOT_COVERED",
    ],
  ] as const)("%s → %i %s", async (_caso, entrada, estado, codigo) => {
    const { rutas } = armar();
    const respuesta = await rutas(postVerificacion(entrada));
    expect(respuesta.statusCode).toBe(estado);
    expect(cuerpo(respuesta).error).toMatchObject({
      codigo,
      mensaje: expect.any(String),
      detalles: expect.any(Array),
    });
  });

  it("una falla propia de MatriculAR es 500 INTERNAL_ERROR, sin detalles internos", async () => {
    const { rutas, repos } = armar();
    vi.spyOn(repos.verificaciones, "guardar").mockRejectedValue(new Error("DynamoDB no responde"));
    const respuesta = await rutas(postVerificacion(pedido()));
    expect(respuesta.statusCode).toBe(500);
    expect(cuerpo(respuesta).error.codigo).toBe("INTERNAL_ERROR");
    expect(respuesta.body).not.toMatch(/DynamoDB/);
  });
});

describe("GET /verificaciones/{id}", () => {
  it("devuelve la misma Verificación sin volver a consultar la Fuente", async () => {
    const { rutas, deps } = armar();
    const creada = cuerpo(await rutas(postVerificacion(pedido())));
    const leer = vi.spyOn(deps.lector, "leer");
    const respuesta = await rutas(evento("GET", `/verificaciones/${creada.verificacion_id}`));
    expect(respuesta.statusCode).toBe(200);
    expect(cuerpo(respuesta)).toEqual(creada);
    expect(leer).not.toHaveBeenCalled();
  });

  it("404 si no existe", async () => {
    const { rutas } = armar();
    const respuesta = await rutas(evento("GET", "/verificaciones/no-existe"));
    expect(respuesta.statusCode).toBe(404);
    expect(cuerpo(respuesta).error.codigo).toBe("VERIFICATION_NOT_FOUND");
  });
});

describe("Catálogos y salud de la Fuente", () => {
  it("GET /fuentes lista las Fuentes sin la configuración interna", async () => {
    const { rutas } = armar();
    const fuentes = cuerpo(await rutas(evento("GET", "/fuentes")));
    expect(fuentes.map((f: { fuente_id: string }) => f.fuente_id)).toEqual(["ecogas", "metrogas"]);
    expect(fuentes[0]).toMatchObject({
      modo_acceso: "AUTOMATED",
      area_concesion: expect.arrayContaining(["SAN_LUIS"]),
    });
    expect(JSON.stringify(fuentes)).not.toMatch(/timeout|umbral|ventana/);
  });

  it("GET /fuentes/{id}/consultas informa la salud sin datos de gasistas", async () => {
    const { rutas } = armar();
    await rutas(postVerificacion(pedido()));
    const respuesta = await rutas(evento("GET", "/fuentes/ecogas/consultas"));
    expect(respuesta.statusCode).toBe(200);
    const [consulta] = cuerpo(respuesta);
    expect(consulta).toMatchObject({
      estado: "SUCCEEDED",
      registros_extraidos: 2,
      formato_recurso: "v2",
    });
    expect(respuesta.body).not.toMatch(/PERSONA/);
  });

  it("GET /fuentes/{id}/consultas de una Fuente desconocida es 404", async () => {
    const { rutas } = armar();
    expect((await rutas(evento("GET", "/fuentes/camuzzi/consultas"))).statusCode).toBe(404);
  });

  it("GET /tipos-trabajo incluye las cinco Condiciones decisivas con su ayuda y su cita", async () => {
    const { rutas } = armar();
    const catalogo = cuerpo(await rutas(evento("GET", "/tipos-trabajo")));
    expect(catalogo.tipos_trabajo.map((t: { codigo: string }) => t.codigo)).toEqual([
      "A1",
      "A2",
      "B",
    ]);
    expect(catalogo.condiciones_decisivas).toHaveLength(5);
    expect(catalogo.condiciones_decisivas[0]).toMatchObject({
      condicion_id: "comercio_o_industria",
      pregunta: expect.any(String),
      ayuda: expect.any(String),
      fundamento: { norma: "NAG-200" },
    });
  });

  it.each(["/categorias", "/provincias"])("GET %s responde el catálogo", async (ruta) => {
    const { rutas } = armar();
    const respuesta = await rutas(evento("GET", ruta));
    expect(respuesta.statusCode).toBe(200);
    expect(cuerpo(respuesta).length).toBeGreaterThan(0);
  });

  it("GET /credenciales/{fuente} exige nombre y localidad, y devuelve el historial", async () => {
    const { rutas } = armar();
    await rutas(postVerificacion(pedido()));
    expect(
      (
        await rutas(
          evento("GET", "/credenciales/ecogas", {
            queryStringParameters: { nombre_apellido: "Persona Ficticia Uno" },
          }),
        )
      ).statusCode,
    ).toBe(400);
    const respuesta = await rutas(
      evento("GET", "/credenciales/ecogas", {
        queryStringParameters: { nombre_apellido: "Persona Ficticia Uno", localidad: "Río Cuarto" },
      }),
    );
    expect(cuerpo(respuesta)).toMatchObject({
      fuente_id: "ecogas",
      credenciales: [{ nombre_informado: "PERSONA FICTICIA UNO", categoria_informada: "2" }],
    });
  });
});

describe("HTTP", () => {
  it("OPTIONS responde CORS solo para el origen del frontend", async () => {
    const { rutas } = armar();
    const respuesta = await rutas(evento("OPTIONS", "/verificaciones"));
    expect(respuesta.statusCode).toBe(204);
    expect(respuesta.headers).toMatchObject({
      "Access-Control-Allow-Origin": "https://matricular.example",
    });
  });

  it("una ruta desconocida es 404", async () => {
    const { rutas } = armar();
    expect((await rutas(evento("GET", "/nada"))).statusCode).toBe(404);
  });

  it("tolera el prefijo del stage en la ruta", async () => {
    const { rutas } = armar();
    expect((await rutas(evento("GET", "/v1/fuentes"))).statusCode).toBe(200);
  });
});
