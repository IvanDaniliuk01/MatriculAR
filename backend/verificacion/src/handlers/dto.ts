import type { RespuestaVerificacion } from "../../../compartido/src/aplicacion/verificar";
import { normalizarTexto } from "../../../compartido/src/dominio/busqueda";
import type { Consulta, Credencial } from "../../../compartido/src/dominio/consulta";
import type { Evaluacion, ResultadoPorTipo } from "../../../compartido/src/dominio/evaluacion";
import type { Fuente, Reglas } from "../../../compartido/src/dominio/reglas";

/** Traducción del dominio a la forma pública de docs/api.md (snake_case). */

const CRITERIO = {
  COMPATIBLE: "MET",
  INCOMPATIBLE: "NOT_MET",
  INDETERMINATE: "INDETERMINATE",
} as const;

export function verificacionDto(respuesta: RespuestaVerificacion, reglas: Reglas) {
  const { verificacion, consulta } = respuesta;
  const { pedido } = verificacion;
  const fuente = reglas.fuentes.find((f) => f.id === pedido.fuenteId) as Fuente;
  const provincia = reglas.provincias.find((p) => p.codigo === pedido.provinciaTrabajo);
  const conBuscador = verificacion.resultado !== "FOUND";

  return {
    verificacion_id: verificacion.id,
    solicitada_en: verificacion.creadaEn,
    pedido: {
      fuente: fuenteBreve(fuente),
      gasista: {
        nombre_apellido: normalizarTexto(pedido.gasista.nombreApellido),
        localidad: pedido.gasista.localidad ? normalizarTexto(pedido.gasista.localidad) : null,
      },
      condiciones: pedido.condiciones,
      provincia_trabajo: { codigo: pedido.provinciaTrabajo, nombre: provincia?.nombre ?? null },
    },
    tipos_trabajo_posibles: verificacion.tiposTrabajoPosibles.map((t) => ({
      tipo_trabajo_id: t.id,
      codigo: t.codigo,
      nombre: t.nombre,
      version: t.version,
    })),
    resultado_verificacion: verificacion.resultado,
    mensaje: verificacion.mensaje,
    consulta: { ...consultaDto(consulta), reutilizada: verificacion.consultaReutilizada },
    coincidencias: respuesta.coincidencias.map(({ credencial, evaluacionId, evaluacion }) => ({
      credencial: credencialDto(credencial, fuente),
      evaluacion: evaluacionDto(evaluacionId, evaluacion),
    })),
    credenciales_previas: respuesta.evidenciaPrevia.map((c) => credencialDto(c, fuente)),
    buscador_oficial: conBuscador ? fuente.urlBuscadorOficial : null,
  };
}

export function consultaDto(consulta: Consulta) {
  return {
    consulta_id: consulta.id,
    estado: consulta.estado,
    motivo_falla: consulta.motivo ?? null,
    detalle_falla: consulta.detalle ?? null,
    iniciada_en: consulta.iniciadaEn,
    finalizada_en: consulta.finalizadaEn,
    cantidad_intentos: consulta.intentos.length,
    registros_extraidos: consulta.cantidadRegistros ?? null,
    formato_recurso: consulta.formatoRecurso ?? null,
    huella_recurso: consulta.huellaRecurso ?? null,
  };
}

export function credencialDto(credencial: Credencial, fuente: Fuente) {
  return {
    fuente: fuenteBreve(fuente),
    nombre_informado: credencial.nombreInformado,
    categoria_informada: credencial.categoriaInformada,
    provincia_informada: credencial.provinciaInformada,
    localidad_informada: credencial.localidadInformada,
    valores_fuente: credencial.valoresFuente,
    consultada_en: credencial.obtenidaEn,
  };
}

function evaluacionDto(id: string, evaluacion: Evaluacion) {
  const categoriaInformada = evaluacion.criterios[0]?.categoriaInformada ?? "";
  return {
    evaluacion_id: id,
    resultado: evaluacion.resultado,
    resultados_por_tipo: evaluacion.resultadosPorTipo.map((r) =>
      resultadoPorTipoDto(r, categoriaInformada),
    ),
    condiciones_que_resuelven: evaluacion.condicionesQueResuelven.map((c) => ({
      condicion_id: c.id,
      pregunta: c.pregunta,
    })),
    explicacion: evaluacion.explicacion,
    limitaciones: evaluacion.limitaciones.map((l) => l.texto),
  };
}

function resultadoPorTipoDto(r: ResultadoPorTipo, categoriaInformada: string) {
  const f = r.fundamento;
  return {
    tipo_trabajo_id: r.tipoTrabajoId,
    tipo_trabajo_version: r.tipoTrabajoVersion,
    resultado: r.resultado,
    criterio_categoria: {
      resultado: CRITERIO[r.resultado],
      categoria_informada: categoriaInformada,
      fundamento: f
        ? `La categoría ${f.categoria}ª ${f.admitida ? "está" : "no está"} admitida para este tipo de trabajo (${f.norma}, ${f.articulo}).`
        : null,
    },
    regla_aplicada: { categorias_admitidas: r.reglaAplicada.categoriasAdmitidas },
  };
}

function fuenteBreve(fuente: Fuente) {
  return { fuente_id: fuente.id, nombre: fuente.nombre };
}
