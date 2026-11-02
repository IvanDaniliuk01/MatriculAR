import { buscarCoincidencias, validarGasistaBuscado } from "../dominio/busqueda";
import { clasificarTrabajo } from "../dominio/clasificacion";
import type { Consulta, Credencial, RegistroLeido } from "../dominio/consulta";
import { type Evaluacion, evaluar } from "../dominio/evaluacion";
import type { Fuente, Reglas } from "../dominio/reglas";
import {
  mensajeVerificacion,
  type PedidoVerificacion,
  type ResultadoVerificacion,
  type Verificacion,
} from "../dominio/verificacion";
import type { GeneradorIds, Reloj } from "../puertos/infraestructura";
import type { ConfigLectura, LectorDeFuente } from "../puertos/lector-fuente";
import type {
  RepositorioConsultas,
  RepositorioCredenciales,
  RepositorioLecturas,
  RepositorioVerificaciones,
} from "../puertos/repositorios";

export type { PedidoVerificacion } from "../dominio/verificacion";

export interface DependenciasVerificar {
  reglas: Reglas;
  configsLectura: ReadonlyMap<string, ConfigLectura>;
  lector: LectorDeFuente;
  consultas: RepositorioConsultas;
  lecturas: RepositorioLecturas;
  credenciales: RepositorioCredenciales;
  verificaciones: RepositorioVerificaciones;
  reloj: Reloj;
  ids: GeneradorIds;
}

export interface RespuestaVerificacion {
  verificacion: Verificacion;
  consulta: Consulta;
  coincidencias: readonly { credencial: Credencial; evaluacion: Evaluacion }[];
  /** Solo si el resultado es UNVERIFIABLE: contexto con su fecha, nunca se usa para concluir. */
  evidenciaPrevia: readonly Credencial[];
  mensaje: string;
}

export type ResultadoVerificar =
  | { ok: true; respuesta: RespuestaVerificacion }
  | {
      ok: false;
      codigo: "INVALID_INPUT" | "WORK_NOT_COVERED" | "UNKNOWN_SOURCE";
      mensaje: string;
      detalles: readonly string[];
    };

const UN_DIA_MS = 24 * 60 * 60 * 1000;
const MAX_EVIDENCIA_PREVIA = 10;

/**
 * Caso de uso Verificar (P0): Fuente → Consulta (o reutilización) → Coincidencias → Credenciales →
 * Evaluaciones → respuesta explicable. Todo lo que se puede rechazar sin leer la Fuente, se rechaza
 * antes: MatriculAR no descarga el padrón para contestar algo que no puede responder.
 */
export async function verificar(
  pedido: PedidoVerificacion,
  deps: DependenciasVerificar,
): Promise<ResultadoVerificar> {
  const { reglas } = deps;
  const fuente = reglas.fuentes.find((f) => f.id === pedido.fuenteId);
  if (!fuente) {
    return rechazo("UNKNOWN_SOURCE", `No conocemos la Fuente ${pedido.fuenteId}.`, []);
  }

  const errores = validarPedido(pedido, reglas);
  if (errores.length > 0) return rechazo("INVALID_INPUT", "El pedido no es válido.", errores);

  const clasificacion = clasificarTrabajo(pedido.condiciones, reglas);
  if (!clasificacion.cubierto) {
    return rechazo(
      "WORK_NOT_COVERED",
      "Este tipo de trabajo todavía no está cubierto: MatriculAR solo evalúa conexiones de artefactos en viviendas y comercios con gas natural por red.",
      [],
    );
  }

  const { consulta, registros, reutilizada } = await obtenerConsulta(fuente, deps);

  let resultado: ResultadoVerificacion;
  let cantidad = 0;
  let coincidencias: RespuestaVerificacion["coincidencias"] = [];
  if (registros === null) {
    resultado = "UNVERIFIABLE";
  } else {
    const busqueda = buscarCoincidencias(
      registros.map((r) => r.registro),
      pedido.gasista,
    );
    resultado = busqueda.resultado;
    if (busqueda.resultado === "TOO_MANY_MATCHES") cantidad = busqueda.cantidad;
    if (busqueda.resultado === "FOUND") {
      cantidad = busqueda.coincidencias.length;
      const porId = new Map(registros.map((r) => [r.registro.idInterno, r]));
      coincidencias = await Promise.all(
        busqueda.coincidencias.map(async (registro) => {
          const leido = porId.get(registro.idInterno) as RegistroLeido;
          const credencial = credencialDe(fuente, consulta, leido);
          await deps.credenciales.guardar(credencial);
          const evaluacion = evaluar(
            {
              clasificacion,
              categoriaInformada: credencial.categoriaInformada,
              provinciaTrabajo: pedido.provinciaTrabajo,
              fuente,
            },
            reglas,
          );
          return { credencial, evaluacion };
        }),
      );
    }
  }

  const evidenciaPrevia =
    resultado === "UNVERIFIABLE"
      ? (await deps.credenciales.delGasista(fuente.id, pedido.gasista)).slice(
          0,
          MAX_EVIDENCIA_PREVIA,
        )
      : [];
  const mensaje = mensajeVerificacion(resultado, {
    fuente,
    consulta,
    cantidad,
    hayEvidenciaPrevia: evidenciaPrevia.length > 0,
  });

  const verificacion: Verificacion = {
    id: deps.ids.nuevo(),
    creadaEn: deps.reloj.ahora().toISOString(),
    pedido,
    consultaId: consulta.id,
    consultaReutilizada: reutilizada,
    resultado,
    cantidadCoincidencias: cantidad,
    credencialIds: coincidencias.map((c) => c.credencial.id),
    mensaje,
  };
  await deps.verificaciones.guardar(verificacion);

  return {
    ok: true,
    respuesta: { verificacion, consulta, coincidencias, evidenciaPrevia, mensaje },
  };
}

function validarPedido(pedido: PedidoVerificacion, reglas: Reglas): string[] {
  const errores = [...validarGasistaBuscado(pedido.gasista)];
  if (!reglas.provincias.some((p) => p.codigo === pedido.provinciaTrabajo)) {
    errores.push(`La provincia ${pedido.provinciaTrabajo} no existe en el catálogo.`);
  }
  const conocidas = new Set(reglas.condiciones.map((c) => c.id));
  for (const id of Object.keys(pedido.condiciones)) {
    if (!conocidas.has(id)) errores.push(`La condición ${id} no existe.`);
  }
  for (const condicion of reglas.condiciones) {
    const respuesta = pedido.condiciones[condicion.id];
    if (respuesta === undefined) errores.push(`Falta responder: ${condicion.pregunta}`);
    else if (!["SI", "NO", "NO_SE"].includes(respuesta)) {
      errores.push(`La respuesta a ${condicion.id} debe ser SI, NO o NO_SE.`);
    }
  }
  return errores;
}

/**
 * Protección de la Fuente (ADR-0006): reutiliza una lectura exitosa dentro de la ventana; después de
 * una falla reciente no vuelve a leer; y si hay que leer, registra la Consulta pase lo que pase.
 */
async function obtenerConsulta(
  fuente: Fuente,
  deps: DependenciasVerificar,
): Promise<{
  consulta: Consulta;
  registros: readonly RegistroLeido[] | null;
  reutilizada: boolean;
}> {
  const ahora = deps.reloj.ahora();
  const config = deps.configsLectura.get(fuente.id);
  if (fuente.modoAcceso === "NOT_AUTOMATABLE" || !config || !fuente.proteccion) {
    const consulta = noRealizada(fuente, ahora, deps, "SOURCE_NOT_AUTOMATABLE");
    await deps.consultas.guardar(consulta);
    return { consulta, registros: null, reutilizada: false };
  }

  const ultimaExitosa = await deps.consultas.ultima(fuente.id, "SUCCEEDED");
  if (
    ultimaExitosa &&
    antiguedadS(ultimaExitosa, ahora) < fuente.proteccion.ventanaReutilizacionS
  ) {
    const registros = await deps.lecturas.obtener(ultimaExitosa.id);
    if (registros) return { consulta: ultimaExitosa, registros, reutilizada: true };
  }

  const ultimaFallida = await deps.consultas.ultima(fuente.id, "FAILED");
  if (
    ultimaFallida &&
    (!ultimaExitosa || ultimaFallida.finalizadaEn > ultimaExitosa.finalizadaEn) &&
    antiguedadS(ultimaFallida, ahora) < fuente.proteccion.esperaTrasFallaS
  ) {
    const consulta = noRealizada(fuente, ahora, deps, "SOURCE_RATE_LIMITED");
    await deps.consultas.guardar(consulta);
    return { consulta, registros: null, reutilizada: false };
  }

  const base = {
    id: deps.ids.nuevo(),
    fuenteId: fuente.id,
    fuenteVersion: fuente.version,
    iniciadaEn: ahora.toISOString(),
  };
  let consulta: Consulta;
  let registros: readonly RegistroLeido[] | null = null;
  try {
    const lectura = await deps.lector.leer(config, {
      cantidadAnterior: ultimaExitosa?.cantidadRegistros ?? null,
    });
    const finalizadaEn = deps.reloj.ahora().toISOString();
    if (lectura.ok) {
      registros = lectura.registros;
      consulta = {
        ...base,
        finalizadaEn,
        estado: "SUCCEEDED",
        intentos: lectura.intentos,
        huellaRecurso: lectura.huella,
        formatoRecurso: lectura.formato,
        urlResuelta: lectura.urlResuelta,
        cantidadRegistros: lectura.registros.length,
        clavesNoEsperadas: lectura.clavesNoEsperadas,
      };
    } else {
      consulta = {
        ...base,
        finalizadaEn,
        estado: "FAILED",
        motivo: lectura.motivo,
        detalle: lectura.detalle,
        intentos: lectura.intentos,
      };
    }
  } catch (error) {
    consulta = {
      ...base,
      finalizadaEn: deps.reloj.ahora().toISOString(),
      estado: "FAILED",
      motivo: "INTERRUPTED",
      detalle: error instanceof Error ? error.message : String(error),
      intentos: [],
    };
  }

  await deps.consultas.guardar(consulta);
  if (registros) {
    const venceEn = new Date(Date.parse(consulta.finalizadaEn) + UN_DIA_MS).toISOString();
    await deps.lecturas.guardar(consulta.id, registros, venceEn);
  }
  return { consulta, registros, reutilizada: false };
}

function noRealizada(
  fuente: Fuente,
  ahora: Date,
  deps: DependenciasVerificar,
  motivo: "SOURCE_NOT_AUTOMATABLE" | "SOURCE_RATE_LIMITED",
): Consulta {
  return {
    id: deps.ids.nuevo(),
    fuenteId: fuente.id,
    fuenteVersion: fuente.version,
    iniciadaEn: ahora.toISOString(),
    finalizadaEn: ahora.toISOString(),
    estado: "NOT_ATTEMPTED",
    motivo,
    intentos: [],
  };
}

function antiguedadS(consulta: Consulta, ahora: Date): number {
  return (ahora.getTime() - Date.parse(consulta.finalizadaEn)) / 1000;
}

function credencialDe(fuente: Fuente, consulta: Consulta, leido: RegistroLeido): Credencial {
  const { registro } = leido;
  return {
    // La misma Consulta y el mismo registro producen siempre la misma Credencial.
    id: `${consulta.id}#${registro.idInterno}`,
    fuenteId: fuente.id,
    consultaId: consulta.id,
    obtenidaEn: consulta.finalizadaEn,
    idInterno: registro.idInterno,
    nombreInformado: registro.nombre,
    categoriaInformada: registro.categoria,
    provinciaInformada: registro.provincia,
    localidadInformada: registro.localidad,
    valoresFuente: leido.valoresFuente,
  };
}

function rechazo(
  codigo: "INVALID_INPUT" | "WORK_NOT_COVERED" | "UNKNOWN_SOURCE",
  mensaje: string,
  detalles: readonly string[],
): ResultadoVerificar {
  return { ok: false, codigo, mensaje, detalles };
}
