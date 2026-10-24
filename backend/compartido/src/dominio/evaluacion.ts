import type {
  Categoria,
  Credencial,
  Criterio,
  Evaluacion,
  Fuente,
  ReglaAplicada,
  ResultadoCriterio,
  ResultadoEvaluacion,
  TipoTrabajo,
} from "./tipos";

/**
 * Limitación fija de zona (ADR-0005). La zona NO es un Criterio: ninguna Fuente informa dónde
 * está habilitado el matriculado, así que el sistema no infiere ni afirma el alcance territorial.
 */
export const LIMITACION_ZONA =
  "La Fuente no informa en qué zonas está habilitado el matriculado: la provincia que publica corresponde a su domicilio. MatriculAR no verifica el alcance territorial de la habilitación.";

export const LIMITACION_FUERA_DEL_AREA =
  "El trabajo es en una provincia donde la Fuente consultada no opera por completo. El gasista podría estar registrado en la distribuidora local, que no consultamos.";

export interface EntradaEvaluacion {
  evaluacion_id: string;
  verificacion_id: string;
  credencial: Credencial;
  tipo_trabajo: TipoTrabajo;
  fuente: Fuente;
  categorias: Categoria[];
  provincia_trabajo: string;
  ahora: string;
}

/** Criterio de categoría: lista explícita, sin comparar por orden (INV-7). */
export function evaluarCategoria(
  categoriaInformada: string,
  tipo: TipoTrabajo,
  catalogo: Categoria[],
): Criterio {
  const c = categoriaInformada.trim();
  const conocida = catalogo.some((x) => x.categoria_id === c);
  if (c === "" || !conocida) {
    return {
      resultado: "INDETERMINATE",
      categoria_informada: categoriaInformada,
      fundamento:
        c === ""
          ? "La Fuente no informa la categoría de la matrícula: no se puede evaluar."
          : `La categoría "${categoriaInformada}" informada por la Fuente no figura en el catálogo de categorías: no se puede evaluar.`,
    };
  }
  const fund = tipo.fundamento.find((f) => f.categoria === c);
  const cita = fund ? ` (${fund.norma}, ${fund.articulo})` : "";
  if (tipo.categorias_admitidas.includes(c)) {
    return {
      resultado: "MET",
      categoria_informada: c,
      fundamento: `La categoría ${c}ª está admitida para este tipo de trabajo${cita}.`,
    };
  }
  const nota = fund?.nota ? ` ${fund.nota}` : "";
  return {
    resultado: "NOT_MET",
    categoria_informada: c,
    fundamento: `La categoría ${c}ª no está admitida para este tipo de trabajo.${nota}${cita}.`,
  };
}

/** Con un único Criterio el global es el del Criterio; se conserva la regla general (NOT_MET > INDETERMINATE). */
export function resultadoGlobal(criterios: ResultadoCriterio[]): ResultadoEvaluacion {
  if (criterios.includes("NOT_MET")) return "INCOMPATIBLE";
  if (criterios.includes("INDETERMINATE")) return "INDETERMINATE";
  return "COMPATIBLE";
}

export function limitacionesDe(
  fuente: Fuente,
  tipo: TipoTrabajo,
  provinciaTrabajo: string,
): string[] {
  const limitaciones = [...fuente.limitaciones];
  const dentro = fuente.area_concesion.includes(provinciaTrabajo);
  const parcial = fuente.area_concesion_parcial.includes(provinciaTrabajo);
  if (!dentro || parcial) limitaciones.push(LIMITACION_FUERA_DEL_AREA);
  limitaciones.push(...tipo.limitaciones);
  if (tipo.condiciones.length > 0) {
    limitaciones.push(
      `Esta evaluación supone que el trabajo cumple las condiciones del tipo elegido: ${tipo.condiciones.join(" ")}`,
    );
  }
  return limitaciones;
}

/** Función pura. Las Limitaciones nunca modifican el resultado global. */
export function evaluar(e: EntradaEvaluacion): Evaluacion {
  const categoria = evaluarCategoria(
    e.credencial.categoria_informada,
    e.tipo_trabajo,
    e.categorias,
  );
  const regla: ReglaAplicada = {
    categorias_admitidas: [...e.tipo_trabajo.categorias_admitidas],
    condiciones: [...e.tipo_trabajo.condiciones],
    fundamento: e.tipo_trabajo.fundamento.map((f) => ({ ...f })),
    area_concesion_aplicada: [...e.fuente.area_concesion],
  };
  return {
    evaluacion_id: e.evaluacion_id,
    verificacion_id: e.verificacion_id,
    credencial_ref: {
      fuente_matricula: e.credencial.fuente_matricula,
      evidencia_id: e.credencial.evidencia_id,
    },
    tipo_trabajo_id: e.tipo_trabajo.tipo_trabajo_id,
    tipo_trabajo_version: e.tipo_trabajo.version,
    fuente_version: e.fuente.version,
    regla_aplicada: regla,
    criterios: { categoria },
    resultado: resultadoGlobal([categoria.resultado]),
    limitaciones: limitacionesDe(e.fuente, e.tipo_trabajo, e.provincia_trabajo),
    evaluada_en: e.ahora,
  };
}
