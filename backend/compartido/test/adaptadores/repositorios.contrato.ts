import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { clasificarTrabajo } from "../../src/dominio/clasificacion";
import type {
  Consulta,
  Credencial,
  EstadoConsulta,
  RegistroLeido,
} from "../../src/dominio/consulta";
import { evaluar } from "../../src/dominio/evaluacion";
import type { Verificacion } from "../../src/dominio/verificacion";
import type {
  RepositorioConsultas,
  RepositorioCredenciales,
  RepositorioLecturas,
  RepositorioVerificaciones,
} from "../../src/puertos/repositorios";
import { casaSola, ecogas, reglas } from "../dominio/ayudas";

export interface Repositorios {
  consultas: RepositorioConsultas;
  lecturas: RepositorioLecturas;
  credenciales: RepositorioCredenciales;
  verificaciones: RepositorioVerificaciones;
}

/**
 * Pruebas de contrato: el mismo comportamiento para todas las implementaciones de los
 * repositorios (memoria, archivo local, DynamoDB + S3). Cada prueba usa identificadores y una
 * Fuente propios, así que puede correr sobre tablas compartidas.
 */
export function probarContratoRepositorios(nombre: string, crear: () => Promise<Repositorios>) {
  describe(`Contrato de repositorios: ${nombre}`, () => {
    describe("Consultas", () => {
      it("guarda y obtiene una Consulta tal cual; una inexistente es null", async () => {
        const { consultas } = await crear();
        const { fuenteId, consulta } = contexto();
        const exitosa = consulta(fuenteId, "SUCCEEDED", "2026-11-02T03:00:00.000Z");
        await consultas.guardar(exitosa);
        expect(await consultas.obtener(exitosa.id)).toEqual(exitosa);
        expect(await consultas.obtener(`inexistente-${randomUUID()}`)).toBeNull();
      });

      it("ultima() devuelve la más reciente de la Fuente con ese estado", async () => {
        const { consultas } = await crear();
        const { fuenteId, consulta } = contexto();
        const vieja = consulta(fuenteId, "SUCCEEDED", "2026-11-02T01:00:00.000Z");
        const nueva = consulta(fuenteId, "SUCCEEDED", "2026-11-02T02:00:00.000Z");
        const fallida = consulta(fuenteId, "FAILED", "2026-11-02T03:00:00.000Z");
        const deOtraFuente = consulta(`${fuenteId}-otra`, "SUCCEEDED", "2026-11-02T04:00:00.000Z");
        for (const c of [nueva, vieja, fallida, deOtraFuente]) await consultas.guardar(c);

        expect((await consultas.ultima(fuenteId, "SUCCEEDED"))?.id).toBe(nueva.id);
        expect((await consultas.ultima(fuenteId, "FAILED"))?.id).toBe(fallida.id);
        expect(await consultas.ultima(fuenteId, "NOT_ATTEMPTED")).toBeNull();
      });

      it("recientes() ordena de la más nueva a la más vieja y respeta el límite", async () => {
        const { consultas } = await crear();
        const { fuenteId, consulta } = contexto();
        const horas = ["01", "03", "02", "04"];
        const guardadas = horas.map((h) =>
          consulta(fuenteId, "SUCCEEDED", `2026-11-02T${h}:00:00.000Z`),
        );
        for (const c of guardadas) await consultas.guardar(c);
        await consultas.guardar(
          consulta(`${fuenteId}-otra`, "SUCCEEDED", "2026-11-02T05:00:00.000Z"),
        );

        const recientes = await consultas.recientes(fuenteId, 3);
        expect(recientes.map((c) => c.iniciadaEn.slice(11, 13))).toEqual(["04", "03", "02"]);
      });
    });

    describe("Lecturas minimizadas", () => {
      it("van y vuelven iguales, con los valores de la Fuente tal como vinieron", async () => {
        const { lecturas } = await crear();
        const consultaId = randomUUID();
        const registros: RegistroLeido[] = [
          {
            registro: {
              idInterno: "4048",
              nombre: "PERSONA FICTICIA UNO",
              categoria: "2",
              provincia: "CORDOBA",
              localidad: "VILLA MARIA",
            },
            valoresFuente: {
              id: 4048,
              nombre_apellido: "Persona Ficticia Uno",
              categoria: { numero: "2", nombre: "Categor?a 2" },
              provincia: { nombre: "CORDOBA" },
              localidad: { nombre: "VILLA MARIA" },
            },
          },
        ];
        await lecturas.guardar(consultaId, registros, "2026-11-03T03:00:00.000Z");
        expect(await lecturas.obtener(consultaId)).toEqual(registros);
      });

      it("una Lectura que no existe es null", async () => {
        const { lecturas } = await crear();
        expect(await lecturas.obtener(randomUUID())).toBeNull();
      });
    });

    describe("Credenciales", () => {
      it("son idempotentes: la misma Credencial no se pisa", async () => {
        const { credenciales } = await crear();
        const { fuenteId, credencial } = contexto();
        const original = credencial(
          fuenteId,
          "PERSONA FICTICIA UNO",
          "VILLA MARIA",
          "2026-11-02T01:00:00.000Z",
        );
        await credenciales.guardar(original);
        await credenciales.guardar({ ...original, categoriaInformada: "9" });
        expect(await credenciales.obtener(original.id)).toEqual(original);
        expect(await credenciales.obtener(`inexistente-${randomUUID()}`)).toBeNull();
      });

      it("delGasista() encuentra homónimos de la Fuente, más nuevos primero, y nada de otras Fuentes", async () => {
        const { credenciales } = await crear();
        const { fuenteId, credencial } = contexto();
        const vieja = credencial(
          fuenteId,
          "PERSONA FICTICIA UNO",
          "VILLA MARIA",
          "2026-11-01T01:00:00.000Z",
        );
        const nueva = credencial(
          fuenteId,
          "PERSONA FICTICIA UNO",
          "RIO CUARTO",
          "2026-11-02T01:00:00.000Z",
        );
        const otra = credencial(
          fuenteId,
          "PERSONA FICTICIA DOS",
          "CORDOBA",
          "2026-11-02T02:00:00.000Z",
        );
        const otraFuente = credencial(
          `${fuenteId}-otra`,
          "PERSONA FICTICIA UNO",
          "CORDOBA",
          "2026-11-02T03:00:00.000Z",
        );
        for (const c of [vieja, nueva, otra, otraFuente]) await credenciales.guardar(c);

        const encontradas = await credenciales.delGasista(fuenteId, {
          nombreApellido: "Persona Uno",
        });
        expect(encontradas.map((c) => c.id)).toEqual([nueva.id, vieja.id]);

        const conLocalidad = await credenciales.delGasista(fuenteId, {
          nombreApellido: "Persona Ficticia Uno",
          localidad: "Villa María",
        });
        expect(conLocalidad.map((c) => c.id)).toEqual([vieja.id]);
        expect(
          await credenciales.delGasista(fuenteId, { nombreApellido: "Nadie Inexistente" }),
        ).toEqual([]);
      });
    });

    describe("Verificaciones", () => {
      it("vuelven idénticas, con sus Evaluaciones, aunque la categoría sea desconocida", async () => {
        const { verificaciones } = await crear();
        const verificacion = verificacionDePrueba();
        await verificaciones.guardar(verificacion);
        expect(await verificaciones.obtener(verificacion.id)).toEqual(verificacion);
        expect(await verificaciones.obtener(`inexistente-${randomUUID()}`)).toBeNull();
      });

      it("una Verificación sin Coincidencias también vuelve idéntica", async () => {
        const { verificaciones } = await crear();
        const verificacion: Verificacion = {
          ...verificacionDePrueba(),
          resultado: "UNVERIFIABLE",
          cantidadCoincidencias: 0,
          coincidencias: [],
          evidenciaPreviaIds: [randomUUID()],
          pedido: { ...verificacionDePrueba().pedido, gasista: { nombreApellido: "Persona Uno" } },
        };
        await verificaciones.guardar(verificacion);
        expect(await verificaciones.obtener(verificacion.id)).toEqual(verificacion);
      });
    });
  });
}

function contexto() {
  const fuenteId = `fuente-${randomUUID().slice(0, 8)}`;
  const consulta = (fuente: string, estado: EstadoConsulta, fecha: string): Consulta => ({
    id: randomUUID(),
    fuenteId: fuente,
    fuenteVersion: 1,
    iniciadaEn: fecha,
    finalizadaEn: fecha.replace(":00.000Z", ":14.000Z"),
    estado,
    ...(estado === "SUCCEEDED"
      ? {
          huellaRecurso: "a".repeat(64),
          formatoRecurso: "v2",
          urlResuelta: "https://ecogas.example/listado",
          cantidadRegistros: 4836,
          clavesNoEsperadas: [],
        }
      : { motivo: "SOURCE_UNAVAILABLE" as const, detalle: "HTTP 403" }),
    intentos: [
      {
        numero: 1,
        iniciadoEn: fecha,
        finalizadoEn: fecha,
        pedidos: [
          { url: "https://ecogas.example/listado", estadoHttp: 200, bytes: 1514746, ms: 13600 },
        ],
      },
      {
        numero: 2,
        iniciadoEn: fecha,
        finalizadoEn: fecha,
        pedidos: [
          {
            url: "https://ecogas.example/listado",
            estadoHttp: null,
            bytes: 0,
            ms: 20000,
            error: "TIMEOUT",
          },
        ],
        error: "Tiempo agotado",
      },
    ],
  });
  const credencial = (
    fuente: string,
    nombre: string,
    localidad: string,
    fecha: string,
  ): Credencial => {
    const consultaId = randomUUID();
    return {
      id: `${consultaId}#1`,
      fuenteId: fuente,
      consultaId,
      obtenidaEn: fecha,
      idInterno: "1",
      nombreInformado: nombre,
      categoriaInformada: "2",
      provinciaInformada: "CORDOBA",
      localidadInformada: localidad,
      valoresFuente: {
        id: 1,
        nombre_apellido: nombre,
        categoria: { numero: "2", nombre: "Categor?a 2" },
      },
    };
  };
  return { fuenteId, consulta, credencial };
}

function verificacionDePrueba(): Verificacion {
  const clasificacion = clasificarTrabajo(casaSola({ unica_vivienda: "NO_SE" }), reglas);
  if (!clasificacion.cubierto) throw new Error("La prueba usa un trabajo cubierto");
  const evaluacion = (categoriaInformada: string) =>
    evaluar(
      { clasificacion, categoriaInformada, provinciaTrabajo: "SAN_LUIS", fuente: ecogas },
      reglas,
    );
  return {
    id: randomUUID(),
    creadaEn: "2026-11-02T03:40:00.000Z",
    pedido: {
      fuenteId: "ecogas",
      gasista: { nombreApellido: "Persona Ficticia Uno", localidad: "Villa María" },
      condiciones: casaSola({ unica_vivienda: "NO_SE" }),
      provinciaTrabajo: "SAN_LUIS",
    },
    consultaId: randomUUID(),
    consultaReutilizada: true,
    resultado: "FOUND",
    cantidadCoincidencias: 2,
    tiposTrabajoPosibles: clasificacion.tiposPosibles.map(({ id, version, codigo, nombre }) => ({
      id,
      version,
      codigo,
      nombre,
    })),
    coincidencias: [
      {
        credencialId: `${randomUUID()}#1`,
        evaluacionId: randomUUID(),
        evaluacion: evaluacion("3"),
      },
      // Categoría desconocida: el fundamento por tipo queda en null y tiene que volver así.
      {
        credencialId: `${randomUUID()}#2`,
        evaluacionId: randomUUID(),
        evaluacion: evaluacion("9"),
      },
    ],
    evidenciaPreviaIds: [],
    mensaje: "Encontramos 2 gasistas con ese nombre en el padrón de Ecogas.",
  };
}
