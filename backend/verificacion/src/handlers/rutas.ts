import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import categoriasJson from "../../../../database/seed/categorias.json" with { type: "json" };
import condicionesJson from "../../../../database/seed/condiciones-decisivas.json" with {
  type: "json",
};
import provinciasJson from "../../../../database/seed/provincias.json" with { type: "json" };
import tiposJson from "../../../../database/seed/tipos-trabajo.json" with { type: "json" };
import {
  consultarVerificacion,
  type DependenciasVerificar,
  type RespuestaVerificacion,
  verificar,
} from "../../../compartido/src/aplicacion/verificar";
import { consultaHistorial, pedidoVerificacion } from "../../../compartido/src/esquemas/api";
import { consultaDto, credencialDto, verificacionDto } from "./dto";

export interface OpcionesRutas {
  origenCors: string;
  /** Registro estructurado (una línea JSON por evento en CloudWatch). */
  log: (registro: Record<string, unknown>) => void;
}

type Respuesta = APIGatewayProxyResult;
type Detalle = { campo?: string; problema: string };

/**
 * Adaptador de entrada HTTP: valida, llama al caso de uso y traduce el resultado (docs/api.md).
 * Una Fuente que falla no es un error HTTP: es un 201 con UNVERIFIABLE.
 */
export function crearRutas(deps: DependenciasVerificar, opciones: OpcionesRutas) {
  const { reglas } = deps;
  const cors = {
    "Access-Control-Allow-Origin": opciones.origenCors,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  const json = (statusCode: number, cuerpo: unknown): Respuesta => ({
    statusCode,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(cuerpo),
  });
  const error = (statusCode: number, codigo: string, mensaje: string, detalles: Detalle[] = []) =>
    json(statusCode, { error: { codigo, mensaje, detalles } });

  async function postVerificacion(cuerpo: string | null): Promise<Respuesta> {
    let datos: unknown;
    try {
      datos = JSON.parse(cuerpo || "");
    } catch {
      return error(400, "VALIDATION_ERROR", "El cuerpo del pedido no es JSON válido.");
    }
    const pedido = pedidoVerificacion.safeParse(datos);
    if (!pedido.success) {
      return error(
        400,
        "VALIDATION_ERROR",
        "El pedido no cumple el esquema.",
        pedido.error.issues.map((i) => ({ campo: i.path.join("."), problema: i.message })),
      );
    }

    const { fuente_id, gasista, condiciones, provincia_trabajo } = pedido.data;
    const resultado = await verificar(
      {
        fuenteId: fuente_id,
        gasista: { nombreApellido: gasista.nombre_apellido, localidad: gasista.localidad },
        condiciones,
        provinciaTrabajo: provincia_trabajo,
      },
      deps,
    );
    if (!resultado.ok) {
      const detalles = resultado.detalles.map((problema) => ({ problema }));
      if (resultado.codigo === "UNKNOWN_SOURCE") {
        return error(404, "SOURCE_NOT_FOUND", resultado.mensaje, detalles);
      }
      if (resultado.codigo === "WORK_NOT_COVERED") {
        return error(422, "WORK_NOT_COVERED", resultado.mensaje, detalles);
      }
      return error(400, "VALIDATION_ERROR", resultado.mensaje, detalles);
    }
    registrarConsulta(resultado.respuesta);
    return json(201, verificacionDto(resultado.respuesta, reglas));
  }

  /** Cada lectura real de la Fuente deja una línea: de ahí sale la alarma de fallas. */
  function registrarConsulta({ consulta, verificacion }: RespuestaVerificacion) {
    if (verificacion.consultaReutilizada) return;
    opciones.log({
      evento: "consulta_finalizada",
      fuente_id: consulta.fuenteId,
      consulta_id: consulta.id,
      estado: consulta.estado,
      motivo: consulta.motivo ?? null,
      intentos: consulta.intentos.length,
      registros: consulta.cantidadRegistros ?? null,
      formato: consulta.formatoRecurso ?? null,
      ms: Date.parse(consulta.finalizadaEn) - Date.parse(consulta.iniciadaEn),
    });
  }

  async function getVerificacion(id: string): Promise<Respuesta> {
    const respuesta = await consultarVerificacion(id, deps);
    if (!respuesta) return error(404, "VERIFICATION_NOT_FOUND", `No existe la Verificación ${id}.`);
    return json(200, verificacionDto(respuesta, reglas));
  }

  async function getConsultas(fuenteId: string, limite: string | undefined): Promise<Respuesta> {
    if (!reglas.fuentes.some((f) => f.id === fuenteId)) {
      return error(404, "SOURCE_NOT_FOUND", `No conocemos la Fuente ${fuenteId}.`);
    }
    const cantidad = Math.min(Math.max(Number(limite) || 20, 1), 100);
    const consultas = await deps.consultas.recientes(fuenteId, cantidad);
    return json(200, consultas.map(consultaDto));
  }

  async function getCredenciales(
    fuenteId: string,
    parametros: Record<string, string | undefined> | null,
  ): Promise<Respuesta> {
    const fuente = reglas.fuentes.find((f) => f.id === fuenteId);
    if (!fuente) return error(404, "SOURCE_NOT_FOUND", `No conocemos la Fuente ${fuenteId}.`);
    const consulta = consultaHistorial.safeParse(parametros ?? {});
    if (!consulta.success) {
      return error(
        400,
        "VALIDATION_ERROR",
        "Hacen falta nombre_apellido y localidad, para no mezclar homónimos.",
        consulta.error.issues.map((i) => ({ campo: i.path.join("."), problema: i.message })),
      );
    }
    const { nombre_apellido, localidad } = consulta.data;
    const credenciales = await deps.credenciales.delGasista(fuenteId, {
      nombreApellido: nombre_apellido,
      localidad,
    });
    return json(200, {
      fuente_id: fuenteId,
      nombre_apellido,
      localidad,
      credenciales: credenciales.map((c) => credencialDto(c, fuente)),
    });
  }

  function getFuentes(): Respuesta {
    return json(
      200,
      reglas.fuentes.map((f) => ({
        fuente_id: f.id,
        nombre: f.nombre,
        modo_acceso: f.modoAcceso,
        area_concesion: f.areaConcesion,
        buscador_oficial: f.urlBuscadorOficial,
        version: f.version,
      })),
    );
  }

  function getTiposTrabajo(): Respuesta {
    return json(200, {
      tipos_trabajo: tiposJson
        .filter((t) => t.activo)
        .map(
          ({
            tipo_trabajo_id,
            version,
            codigo,
            nombre,
            descripcion,
            condiciones,
            categorias_admitidas,
            fundamento,
            limitaciones,
          }) => ({
            tipo_trabajo_id,
            version,
            codigo,
            nombre,
            descripcion,
            condiciones,
            categorias_admitidas,
            fundamento,
            limitaciones,
          }),
        ),
      condiciones_decisivas: [...condicionesJson].sort((a, b) => a.orden - b.orden),
    });
  }

  return async function rutas(evento: APIGatewayProxyEvent): Promise<Respuesta> {
    const metodo = evento.httpMethod;
    const ruta = (evento.path || "/").replace(/^\/v1(?=\/)/, "").replace(/\/+$/, "") || "/";
    const partes = ruta.split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (metodo === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
      if (metodo === "POST" && ruta === "/verificaciones")
        return await postVerificacion(evento.body);
      if (metodo === "GET") {
        const [primera, segunda, tercera] = partes;
        if (primera === "verificaciones" && segunda && !tercera)
          return await getVerificacion(segunda);
        if (primera === "fuentes" && !segunda) return getFuentes();
        if (primera === "fuentes" && segunda && tercera === "consultas" && partes.length === 3) {
          return await getConsultas(segunda, evento.queryStringParameters?.limite);
        }
        if (primera === "credenciales" && segunda && !tercera) {
          return await getCredenciales(segunda, evento.queryStringParameters);
        }
        if (ruta === "/tipos-trabajo") return getTiposTrabajo();
        if (ruta === "/categorias") return json(200, categoriasJson);
        if (ruta === "/provincias") return json(200, provinciasJson);
      }
      return error(404, "NOT_FOUND", `No existe ${metodo} ${ruta}.`);
    } catch (falla) {
      opciones.log({
        evento: "error_interno",
        metodo,
        ruta,
        error: falla instanceof Error ? falla.message : String(falla),
      });
      return error(500, "INTERNAL_ERROR", "Falla de MatriculAR. Intentá de nuevo en unos minutos.");
    }
  };
}
