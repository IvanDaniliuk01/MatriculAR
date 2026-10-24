import { evaluar } from "../dominio/evaluacion";
import { ErrorDePedido } from "../dominio/errores";
import { claveFuenteMatricula, esMatriculaValida, normalizarMatricula } from "../dominio/matricula";
import type {
  Consulta,
  Credencial,
  Fuente,
  MotivoFalla,
  ResultadoVerificacion,
  Verificacion,
} from "../dominio/tipos";
import type { PuertoFuente, Reloj } from "../puertos/fuentes";
import type { Catalogo, Ids, RepositorioEvidencia } from "../puertos/repositorios";
import { mensajeFound, mensajeNotFound, mensajeUnverifiable } from "./mensajes";
import { type RespuestaVerificacion, construirRespuesta } from "./respuesta";

export interface PedidoVerificacion {
  fuente_id: string;
  matricula: string;
  tipo_trabajo_id: string;
  provincia_trabajo: string;
}

export interface DependenciasVerificar {
  catalogo: Catalogo;
  repo: RepositorioEvidencia;
  /** Devuelve el adaptador que corresponde a la Fuente. */
  adaptadorDe: (fuente: Fuente) => PuertoFuente;
  reloj: Reloj;
  ids: Ids;
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Caso de uso Verificar: el recorrido completo.
 * pedido → Consulta registrada (IN_PROGRESS) → lectura → Credencial (si figura) →
 * Evaluación (solo con Credencial nueva) → Resultado → Verificación guardada.
 *
 * Reglas: una falla de la Fuente NUNCA produce NOT_FOUND ni "0 matriculados" (INV-3, INV-4);
 * una lectura fallida no toca la evidencia anterior (INV-1) y se la muestra solo como contexto.
 */
export async function verificar(
  entrada: PedidoVerificacion,
  d: DependenciasVerificar,
): Promise<RespuestaVerificacion> {
  const { catalogo, repo, reloj, ids } = d;

  // 1. El pedido: los errores acá son del Cliente (4xx).
  const fuente = catalogo.fuente(entrada.fuente_id);
  if (!fuente) throw new ErrorDePedido("FUENTE_INEXISTENTE", `La Fuente "${entrada.fuente_id}" no existe o no está activa.`, 404);
  const tipo = catalogo.tipoTrabajo(entrada.tipo_trabajo_id);
  if (!tipo) throw new ErrorDePedido("TIPO_TRABAJO_INEXISTENTE", `El Tipo de trabajo "${entrada.tipo_trabajo_id}" no existe o no está activo.`, 404);
  if (!catalogo.provincias().some((p) => p.codigo === entrada.provincia_trabajo)) {
    throw new ErrorDePedido("PROVINCIA_INEXISTENTE", `La provincia "${entrada.provincia_trabajo}" no está en el catálogo.`, 422);
  }
  if (!esMatriculaValida(entrada.matricula)) {
    throw new ErrorDePedido("MATRICULA_INVALIDA", "La matrícula debe tener de 1 a 20 caracteres alfanuméricos.", 422);
  }
  const matricula = normalizarMatricula(entrada.matricula);
  const fuenteMatricula = claveFuenteMatricula(fuente.fuente_id, matricula);

  const solicitadaMs = reloj.ahora();
  const verificacionId = ids.nuevo();
  const consultaId = ids.nuevo();
  const timeoutConsulta = fuente.config_reintentos?.timeout_consulta_ms ?? 0;

  // 2. La Consulta queda asentada ANTES del primer pedido.
  const consulta: Consulta = {
    consulta_id: consultaId,
    fuente_id: fuente.fuente_id,
    fuente_version: fuente.version,
    origen: "VERIFICATION",
    matriculas_buscadas: [matricula],
    estado: "IN_PROGRESS",
    motivo_falla: null,
    detalle_falla: null,
    iniciada_en: iso(solicitadaMs),
    plazo_maximo_en: iso(solicitadaMs + timeoutConsulta),
    finalizada_en: null,
    intentos: [],
    url_recurso: null,
    huella_recurso: null,
    bytes_recurso: null,
    registros_extraidos: null,
    resumen: null,
    claves_no_esperadas: [],
  };
  await repo.iniciarConsulta(consulta);

  // 3. La lectura.
  const previaConsultaExitosa = await repo.ultimaConsultaExitosa(fuente.fuente_id);
  const lectura = await d.adaptadorDe(fuente).leer({
    fuente,
    matriculas: [matricula],
    provincias: catalogo.provincias(),
    registros_ultima_consulta_exitosa: previaConsultaExitosa?.registros_extraidos ?? null,
  });
  const finMs = reloj.ahora();
  const finalizadaEn = iso(finMs);
  consulta.intentos = lectura.intentos;
  consulta.finalizada_en = finalizadaEn;

  let resultado: ResultadoVerificacion;
  let credencial: Credencial | null = null;
  let credencialPrevia: Credencial | undefined;
  let motivo: MotivoFalla | null = null;

  if (lectura.tipo === "EXITOSA") {
    consulta.estado = "SUCCEEDED";
    Object.assign(consulta, {
      url_recurso: lectura.metadatos.url_recurso,
      huella_recurso: lectura.metadatos.huella_recurso,
      bytes_recurso: lectura.metadatos.bytes_recurso,
      registros_extraidos: lectura.metadatos.registros_extraidos,
      resumen: lectura.metadatos.resumen,
      claves_no_esperadas: lectura.metadatos.claves_no_esperadas,
    });
    const registro = lectura.resultados.get(matricula);
    if (registro) {
      resultado = "FOUND";
      credencial = {
        fuente_matricula: fuenteMatricula,
        evidencia_id: `${finalizadaEn}#${consultaId}`,
        fuente_id: fuente.fuente_id,
        matricula,
        consulta_id: consultaId,
        consultada_en: finalizadaEn,
        nombre_informado: registro.nombre_informado,
        categoria_informada: registro.categoria_informada,
        provincia_informada: registro.provincia_informada,
        localidad_informada: registro.localidad_informada,
        creada_en: finalizadaEn,
      };
    } else {
      // Solo una Consulta exitosa puede producir NOT_FOUND.
      resultado = "NOT_FOUND";
    }
  } else {
    resultado = "UNVERIFIABLE";
    if (lectura.tipo === "FALLIDA") {
      consulta.estado = "FAILED";
      consulta.motivo_falla = lectura.motivo;
      consulta.detalle_falla = lectura.detalle;
      motivo = lectura.motivo;
    } else {
      consulta.estado = "NOT_ATTEMPTED";
      consulta.motivo_falla = lectura.motivo;
      motivo = lectura.motivo;
    }
    // La última evidencia válida se conserva y se muestra como contexto, sin concluir.
    credencialPrevia = await repo.ultimaCredencial(fuenteMatricula);
  }

  // 4. La Evaluación solo existe con una Credencial nueva (INV-2).
  const evaluacion = credencial
    ? evaluar({
        evaluacion_id: ids.nuevo(),
        verificacion_id: verificacionId,
        credencial,
        tipo_trabajo: tipo,
        fuente,
        categorias: catalogo.categorias(),
        provincia_trabajo: entrada.provincia_trabajo,
        ahora: finalizadaEn,
      })
    : null;

  const mensaje =
    resultado === "FOUND" && credencial && evaluacion
      ? mensajeFound(credencial, fuente, evaluacion)
      : resultado === "NOT_FOUND"
        ? mensajeNotFound(matricula, fuente, finalizadaEn)
        : mensajeUnverifiable(fuente, motivo, finalizadaEn, credencialPrevia);

  const verificacion: Verificacion = {
    verificacion_id: verificacionId,
    solicitada_en: iso(solicitadaMs),
    origen: "DIRECT",
    fuente_id: fuente.fuente_id,
    matricula,
    fuente_matricula: fuenteMatricula,
    tipo_trabajo_id: tipo.tipo_trabajo_id,
    tipo_trabajo_version: tipo.version,
    provincia_trabajo: entrada.provincia_trabajo,
    consulta_id: consultaId,
    resultado_verificacion: resultado,
    credencial_ref: credencial
      ? { fuente_matricula: credencial.fuente_matricula, evidencia_id: credencial.evidencia_id }
      : null,
    evaluacion_id: evaluacion?.evaluacion_id ?? null,
    resultado_evaluacion: evaluacion?.resultado ?? null,
    credencial_previa_ref: credencialPrevia
      ? { fuente_matricula: credencialPrevia.fuente_matricula, evidencia_id: credencialPrevia.evidencia_id }
      : null,
    mensaje,
  };

  // 5. Todo o nada: fuente, fecha y resultado quedan persistidos juntos.
  await repo.guardarPaquete({
    consulta,
    resultado: {
      consulta_id: consultaId,
      matricula,
      fuente_id: fuente.fuente_id,
      fuente_matricula: fuenteMatricula,
      resultado,
      determinado_en: finalizadaEn,
      credencial_evidencia_id: credencial?.evidencia_id ?? null,
    },
    credencial,
    evaluacion,
    verificacion,
  });

  return construirRespuesta(
    { verificacion, consulta, credencial, evaluacion, credencialPrevia: credencialPrevia ?? null },
    catalogo,
  );
}

/** Una Consulta que sigue IN_PROGRESS pasado su plazo se interpreta como FAILED/INTERRUPTED (falla propia). */
export function estadoEfectivo(c: Consulta, ahoraMs: number): Consulta["estado"] | "FAILED" {
  if (c.estado === "IN_PROGRESS" && ahoraMs > Date.parse(c.plazo_maximo_en)) return "FAILED";
  return c.estado;
}
