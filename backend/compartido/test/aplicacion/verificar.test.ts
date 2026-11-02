import { describe, expect, it } from "vitest";
import { repositoriosEnMemoria } from "../../src/adaptadores/memoria/repositorios";
import {
  type DependenciasVerificar,
  type PedidoVerificacion,
  verificar,
} from "../../src/aplicacion/verificar";
import type { RegistroLeido } from "../../src/dominio/consulta";
import type {
  ConfigLectura,
  LectorDeFuente,
  ResultadoLectura,
} from "../../src/puertos/lector-fuente";
import { casaSola, reglas } from "../dominio/ayudas";

const CONFIG: ConfigLectura = {
  urlPagina: "https://ecogas.example/listado",
  marcadorV2: "gasistasMatriculados",
  prefijoPreferido: "3182-",
  maxCandidatos: 20,
  reintentos: {
    maxIntentos: 3,
    esperasMs: [1000, 2000],
    timeoutPedidoMs: 20000,
    timeoutConsultaMs: 45000,
  },
  validacion: { umbralCaida: 0.5, pisoRegistros: 1 },
};

function leido(
  idInterno: string,
  nombre: string,
  categoria: string,
  localidad: string,
): RegistroLeido {
  return {
    registro: { idInterno, nombre, categoria, provincia: "CORDOBA", localidad },
    valoresFuente: {
      id: Number(idInterno),
      nombre_apellido: nombre,
      categoria: { numero: categoria },
    },
  };
}

const PADRON = [
  leido("1", "PERSONA FICTICIA UNO", "2", "VILLA MARIA"),
  leido("2", "PERSONA FICTICIA UNO", "3", "RIO CUARTO"),
  leido("3", "PERSONA FICTICIA DOS", "3", "CORDOBA"),
  ...Array.from({ length: 11 }, (_, i) =>
    leido(String(10 + i), `GONZALEZ JUAN ${i}`, "1", "CORDOBA"),
  ),
];

const exitosa = (registros = PADRON): ResultadoLectura => ({
  ok: true,
  intentos: [{ numero: 1, iniciadoEn: "", finalizadoEn: "", pedidos: [] }],
  huella: "a".repeat(64),
  formato: "v2",
  urlResuelta: CONFIG.urlPagina,
  registros,
  clavesNoEsperadas: [],
});

const fallida = (
  motivo: "SOURCE_UNAVAILABLE" | "EXTRACTION_FAILED",
  detalle: string,
): ResultadoLectura => ({
  ok: false,
  motivo,
  detalle,
  intentos: [{ numero: 1, iniciadoEn: "", finalizadoEn: "", pedidos: [], error: detalle }],
});

/** Arma las dependencias con un lector falso que devuelve las lecturas dadas, en orden. */
function escenario(...lecturas: Array<ResultadoLectura | Error>) {
  let ahora = new Date("2026-11-02T18:40:00Z").getTime();
  let id = 0;
  const llamadas: Array<{ cantidadAnterior: number | null }> = [];
  const lector: LectorDeFuente = {
    async leer(_config, contexto) {
      llamadas.push(contexto);
      const siguiente = lecturas.shift();
      if (!siguiente) throw new Error("El test no preparó más lecturas");
      if (siguiente instanceof Error) throw siguiente;
      ahora += 14_000; // la lectura tarda
      return siguiente;
    },
  };
  const deps: DependenciasVerificar = {
    reglas,
    configsLectura: new Map([["ecogas", CONFIG]]),
    lector,
    ...repositoriosEnMemoria(),
    reloj: { ahora: () => new Date(ahora), esperar: async () => {} },
    ids: { nuevo: () => `id-${++id}` },
  };
  const avanzar = (segundos: number) => {
    ahora += segundos * 1000;
  };
  return { deps, llamadas, avanzar };
}

function pedido(
  nombreApellido: string,
  cambios: Partial<PedidoVerificacion> = {},
): PedidoVerificacion {
  return {
    fuenteId: "ecogas",
    gasista: { nombreApellido },
    condiciones: casaSola(),
    provinciaTrabajo: "CORDOBA",
    ...cambios,
  };
}

async function respuestaDe(promesa: ReturnType<typeof verificar>) {
  const resultado = await promesa;
  if (!resultado.ok)
    throw new Error(`Se esperaba una respuesta: ${resultado.codigo} ${resultado.mensaje}`);
  return resultado.respuesta;
}

describe("Verificar: recorrido completo", () => {
  it("FOUND: guarda la Consulta con su huella, la Credencial y una Evaluación explicable", async () => {
    const { deps } = escenario(exitosa());
    const respuesta = await respuestaDe(verificar(pedido("Persona Ficticia Dos"), deps));

    expect(respuesta.verificacion.resultado).toBe("FOUND");
    expect(respuesta.consulta).toMatchObject({
      estado: "SUCCEEDED",
      huellaRecurso: "a".repeat(64),
      formatoRecurso: "v2",
      cantidadRegistros: PADRON.length,
    });
    const [coincidencia] = respuesta.coincidencias;
    expect(coincidencia?.credencial).toMatchObject({
      nombreInformado: "PERSONA FICTICIA DOS",
      categoriaInformada: "3",
      consultaId: respuesta.consulta.id,
      obtenidaEn: respuesta.consulta.finalizadaEn,
    });
    expect(coincidencia?.evaluacion.resultado).toBe("COMPATIBLE");
    expect(respuesta.mensaje).toMatch(
      /^Encontramos 1 gasista con ese nombre en el padrón de Ecogas \(lectura del 02\/11\/2026 15:40\)\. Confirmalo con su carné\.$/,
    );
    expect(await deps.verificaciones.obtener(respuesta.verificacion.id)).toEqual(
      respuesta.verificacion,
    );
  });

  it("con homónimos muestra todos, cada uno con su Evaluación, y pide elegir con el carné", async () => {
    const { deps } = escenario(exitosa());
    const respuesta = await respuestaDe(verificar(pedido("Persona Ficticia Uno"), deps));
    expect(
      respuesta.coincidencias.map((c) => [c.credencial.localidadInformada, c.evaluacion.resultado]),
    ).toEqual([
      ["VILLA MARIA", "COMPATIBLE"],
      ["RIO CUARTO", "COMPATIBLE"],
    ]);
    expect(respuesta.mensaje).toMatch(
      /Encontramos 2 gasistas .* elegí el que coincide con su carné/,
    );
  });

  it("NOT_FOUND aclara que no dice nada sobre otras distribuidoras", async () => {
    const { deps } = escenario(exitosa());
    const respuesta = await respuestaDe(verificar(pedido("Nadie Inexistente"), deps));
    expect(respuesta.verificacion.resultado).toBe("NOT_FOUND");
    expect(respuesta.coincidencias).toEqual([]);
    expect(respuesta.mensaje).toMatch(/no dice nada sobre otras distribuidoras/);
  });

  it("TOO_MANY_MATCHES pide precisar la búsqueda y no crea Credenciales", async () => {
    const { deps } = escenario(exitosa());
    const respuesta = await respuestaDe(verificar(pedido("Juan González"), deps));
    expect(respuesta.verificacion.resultado).toBe("TOO_MANY_MATCHES");
    expect(respuesta.coincidencias).toEqual([]);
    expect(respuesta.mensaje).toMatch(/Hay 11 gasistas .* Agregá la localidad/);
  });
});

describe("Protección de la Fuente (ADR-0006)", () => {
  it("dentro de la Ventana de reutilización no vuelve a leer, e informa la fecha real de la lectura", async () => {
    const { deps, llamadas, avanzar } = escenario(exitosa());
    const primera = await respuestaDe(verificar(pedido("Persona Ficticia Dos"), deps));
    avanzar(10 * 60);
    const segunda = await respuestaDe(verificar(pedido("Persona Ficticia Uno"), deps));

    expect(llamadas).toHaveLength(1);
    expect(segunda.verificacion.consultaReutilizada).toBe(true);
    expect(segunda.consulta.id).toBe(primera.consulta.id);
    expect(segunda.coincidencias[0]?.credencial.obtenidaEn).toBe(primera.consulta.finalizadaEn);
  });

  it("pasada la ventana vuelve a leer, y le pasa al lector la cantidad anterior para V5", async () => {
    const { deps, llamadas, avanzar } = escenario(exitosa(), exitosa());
    await verificar(pedido("Persona Ficticia Dos"), deps);
    avanzar(16 * 60);
    await verificar(pedido("Persona Ficticia Dos"), deps);
    expect(llamadas).toEqual([{ cantidadAnterior: null }, { cantidadAnterior: PADRON.length }]);
  });

  it("después de una falla espera un minuto antes de volver a leer: mientras tanto, SOURCE_RATE_LIMITED", async () => {
    const { deps, llamadas, avanzar } = escenario(
      fallida("SOURCE_UNAVAILABLE", "HTTP 503"),
      exitosa(),
    );
    await verificar(pedido("Persona Ficticia Dos"), deps);
    avanzar(30);
    const protegida = await respuestaDe(verificar(pedido("Persona Ficticia Dos"), deps));
    expect(protegida.consulta).toMatchObject({
      estado: "NOT_ATTEMPTED",
      motivo: "SOURCE_RATE_LIMITED",
    });
    expect(protegida.verificacion.resultado).toBe("UNVERIFIABLE");
    expect(protegida.mensaje).toMatch(/reintentá en un minuto/);
    expect(llamadas).toHaveLength(1);

    avanzar(31);
    const luego = await respuestaDe(verificar(pedido("Persona Ficticia Dos"), deps));
    expect(luego.verificacion.resultado).toBe("FOUND");
    expect(llamadas).toHaveLength(2);
  });
});

describe("La ausencia de evidencia no se convierte en certeza", () => {
  it("si la Fuente bloquea el pedido (403) es UNVERIFIABLE, y la evidencia anterior se muestra sin usarse para concluir", async () => {
    const { deps, avanzar } = escenario(exitosa(), fallida("SOURCE_UNAVAILABLE", "HTTP 403"));
    await verificar(pedido("Persona Ficticia Dos"), deps);
    avanzar(20 * 60);
    const respuesta = await respuestaDe(verificar(pedido("Persona Ficticia Dos"), deps));

    expect(respuesta.verificacion.resultado).toBe("UNVERIFIABLE");
    expect(respuesta.consulta).toMatchObject({ estado: "FAILED", motivo: "SOURCE_UNAVAILABLE" });
    expect(respuesta.coincidencias).toEqual([]);
    expect(respuesta.evidenciaPrevia.map((c) => c.nombreInformado)).toEqual([
      "PERSONA FICTICIA DOS",
    ]);
    expect(respuesta.mensaje).toMatch(/No pudimos consultar Ecogas/);
    expect(respuesta.mensaje).toMatch(/no se usa para concluir/);
  });

  it("si Ecogas cambió la estructura es UNVERIFIABLE, nunca NOT_FOUND", async () => {
    const { deps } = escenario(fallida("EXTRACTION_FAILED", "V2: no hay marcador"));
    const respuesta = await respuestaDe(verificar(pedido("Persona Ficticia Dos"), deps));
    expect(respuesta.verificacion.resultado).toBe("UNVERIFIABLE");
    expect(respuesta.consulta.motivo).toBe("EXTRACTION_FAILED");
    expect(respuesta.mensaje).toMatch(/cambió la forma de publicar el padrón/);
  });

  it("una falla propia de MatriculAR queda como INTERRUPTED", async () => {
    const { deps } = escenario(new Error("se cortó el proceso"));
    const respuesta = await respuestaDe(verificar(pedido("Persona Ficticia Dos"), deps));
    expect(respuesta.consulta).toMatchObject({ estado: "FAILED", motivo: "INTERRUPTED" });
    expect(respuesta.verificacion.resultado).toBe("UNVERIFIABLE");
  });

  it("MetroGAS no se consulta automáticamente: NOT_ATTEMPTED y el link al buscador oficial", async () => {
    const { deps, llamadas } = escenario();
    const respuesta = await respuestaDe(
      verificar(
        pedido("Persona Ficticia Dos", {
          fuenteId: "metrogas",
          provinciaTrabajo: "CIUDAD_AUTONOMA_DE_BUENOS_AIRES",
        }),
        deps,
      ),
    );
    expect(respuesta.consulta).toMatchObject({
      estado: "NOT_ATTEMPTED",
      motivo: "SOURCE_NOT_AUTOMATABLE",
    });
    expect(respuesta.mensaje).toMatch(/https:\/\/www\.metrogas\.com\.ar/);
    expect(llamadas).toHaveLength(0);
  });
});

describe("Pedidos que se rechazan antes de consultar la Fuente", () => {
  it("un trabajo sin regla documentada es WORK_NOT_COVERED y no descarga el padrón", async () => {
    const { deps, llamadas } = escenario();
    const resultado = await verificar(
      pedido("Persona Ficticia Dos", {
        condiciones: casaSola({ gas_natural_red_baja_presion: "NO" }),
      }),
      deps,
    );
    expect(resultado).toMatchObject({ ok: false, codigo: "WORK_NOT_COVERED" });
    expect(llamadas).toHaveLength(0);
  });

  it.each([
    ["un nombre de una sola palabra", pedido("Pérez"), "INVALID_INPUT"],
    [
      "una provincia que no existe",
      pedido("Persona Ficticia Dos", { provinciaTrabajo: "ATLANTIDA" }),
      "INVALID_INPUT",
    ],
    [
      "una condición sin responder",
      pedido("Persona Ficticia Dos", { condiciones: { comercio_o_industria: "NO" } }),
      "INVALID_INPUT",
    ],
    [
      "una condición que no existe",
      pedido("Persona Ficticia Dos", { condiciones: { ...casaSola(), inventada: "SI" } }),
      "INVALID_INPUT",
    ],
    [
      "una Fuente desconocida",
      pedido("Persona Ficticia Dos", { fuenteId: "camuzzi" }),
      "UNKNOWN_SOURCE",
    ],
  ] as const)("%s se rechaza (%s)", async (_caso, p, codigo) => {
    const { deps, llamadas } = escenario();
    expect(await verificar(p, deps)).toMatchObject({ ok: false, codigo });
    expect(llamadas).toHaveLength(0);
  });
});
