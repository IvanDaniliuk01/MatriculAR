import type {
  Consulta,
  Credencial,
  Evaluacion,
  Fuente,
  Verificacion,
} from "../dominio/tipos";
import type { Catalogo } from "../puertos/repositorios";

const vista = (c: Credencial, fuente: Fuente) => ({
  fuente: { fuente_id: fuente.fuente_id, nombre: fuente.nombre },
  matricula: c.matricula,
  nombre_informado: c.nombre_informado,
  categoria_informada: c.categoria_informada,
  provincia_informada: c.provincia_informada,
  localidad_informada: c.localidad_informada,
  consultada_en: c.consultada_en,
});

export interface PartesVerificacion {
  verificacion: Verificacion;
  consulta: Consulta;
  credencial: Credencial | null;
  evaluacion: Evaluacion | null;
  credencialPrevia: Credencial | null;
}

/** Forma única de la respuesta (docs/api.md § 3.2): los campos que no aplican vienen en null. */
export function construirRespuesta(p: PartesVerificacion, catalogo: Catalogo) {
  const { verificacion: v, consulta: c } = p;
  const fuente = catalogo.fuente(v.fuente_id);
  const tipo = catalogo.tipoTrabajo(v.tipo_trabajo_id);
  const prov = catalogo.provincias().find((x) => x.codigo === v.provincia_trabajo);
  if (!fuente) throw new Error(`Fuente ${v.fuente_id} sin definición en el catálogo`);
  const unverifiable = v.resultado_verificacion === "UNVERIFIABLE";
  return {
    verificacion_id: v.verificacion_id,
    solicitada_en: v.solicitada_en,
    pedido: {
      fuente: { fuente_id: fuente.fuente_id, nombre: fuente.nombre },
      matricula: v.matricula,
      tipo_trabajo: tipo
        ? { tipo_trabajo_id: tipo.tipo_trabajo_id, codigo: tipo.codigo, nombre: tipo.nombre }
        : { tipo_trabajo_id: v.tipo_trabajo_id, codigo: null, nombre: null },
      provincia_trabajo: { codigo: v.provincia_trabajo, nombre: prov?.nombre ?? v.provincia_trabajo },
    },
    resultado_verificacion: v.resultado_verificacion,
    mensaje: v.mensaje,
    consulta: {
      consulta_id: c.consulta_id,
      estado: c.estado,
      motivo_falla: c.motivo_falla,
      detalle_falla: c.detalle_falla,
      iniciada_en: c.iniciada_en,
      finalizada_en: c.finalizada_en,
      cantidad_intentos: c.intentos.length,
      registros_extraidos: c.registros_extraidos,
      huella_recurso: c.huella_recurso,
    },
    credencial: p.credencial ? vista(p.credencial, fuente) : null,
    evaluacion: p.evaluacion
      ? {
          evaluacion_id: p.evaluacion.evaluacion_id,
          resultado: p.evaluacion.resultado,
          criterios: p.evaluacion.criterios,
          limitaciones: p.evaluacion.limitaciones,
          tipo_trabajo_version: p.evaluacion.tipo_trabajo_version,
          regla_aplicada: p.evaluacion.regla_aplicada,
        }
      : null,
    credencial_previa: unverifiable && p.credencialPrevia ? vista(p.credencialPrevia, fuente) : null,
    buscador_oficial: unverifiable ? fuente.url_buscador_oficial : null,
  };
}

export type RespuestaVerificacion = ReturnType<typeof construirRespuesta>;
