import type { ClasificacionCubierta, Escenario } from "./clasificacion";
import {
  type CategoriaId,
  type CondicionDecisiva,
  esCategoriaConocida,
  type Fuente,
  type FundamentoCategoria,
  type Reglas,
} from "./reglas";

export type ResultadoEvaluacion = "COMPATIBLE" | "INCOMPATIBLE" | "INDETERMINATE";
export type ResultadoCriterio = "MET" | "NOT_MET" | "INDETERMINATE";

export interface CriterioCategoria {
  criterio: "CATEGORIA";
  resultado: ResultadoCriterio;
  categoriaInformada: string;
  fundamento: readonly FundamentoCategoria[];
}

export interface Limitacion {
  origen: "FUENTE" | "ZONA" | "TIPO_TRABAJO";
  texto: string;
}

export interface Evaluacion {
  resultado: ResultadoEvaluacion;
  criterios: readonly CriterioCategoria[];
  tiposTrabajoPosibles: readonly { id: string; version: number; codigo: string; nombre: string }[];
  /** El resultado contra cada Tipo de trabajo posible, con una copia de la regla aplicada. */
  resultadosPorTipo: readonly ResultadoPorTipo[];
  /** Condiciones en No sé cuya respuesta cambiaría el resultado. */
  condicionesQueResuelven: readonly Pick<CondicionDecisiva, "id" | "pregunta">[];
  limitaciones: readonly Limitacion[];
  explicacion: string;
}

export interface ResultadoPorTipo {
  tipoTrabajoId: string;
  tipoTrabajoVersion: number;
  resultado: ResultadoEvaluacion;
  /** La cita para la categoría informada; null si la categoría es desconocida. */
  fundamento: FundamentoCategoria | null;
  reglaAplicada: { categoriasAdmitidas: readonly CategoriaId[] };
}

export interface EntradaEvaluacion {
  clasificacion: ClasificacionCubierta;
  /** Categoría tal como la informa la Credencial, sin interpretar. */
  categoriaInformada: string;
  /** Código de provincia del catálogo donde se hace el trabajo. */
  provinciaTrabajo: string;
  fuente: Fuente;
}

const RESULTADO_CRITERIO: Record<ResultadoEvaluacion, ResultadoCriterio> = {
  COMPATIBLE: "MET",
  INCOMPATIBLE: "NOT_MET",
  INDETERMINATE: "INDETERMINATE",
};

/**
 * Aplica las reglas a una Credencial. Solo juzga la categoría: la zona y la Vigencia son
 * Limitaciones (ADR-0003, ADR-0005). Si la evidencia no permite afirmar algo, no se afirma.
 */
export function evaluar(entrada: EntradaEvaluacion, reglas: Reglas): Evaluacion {
  const { clasificacion, categoriaInformada, fuente } = entrada;
  const provincia = reglas.provincias.find((p) => p.codigo === entrada.provinciaTrabajo);
  if (!provincia) throw new Error(`Provincia desconocida: ${entrada.provinciaTrabajo}.`);

  const categoria = esCategoriaConocida(categoriaInformada) ? categoriaInformada : null;
  const resultadoDe = (escenario: Escenario): ResultadoEvaluacion => {
    if (categoria === null || escenario.tipo === null) return "INDETERMINATE";
    return escenario.tipo.categoriasAdmitidas.includes(categoria) ? "COMPATIBLE" : "INCOMPATIBLE";
  };

  const resultados = new Set(clasificacion.escenarios.map(resultadoDe));
  const resultado: ResultadoEvaluacion =
    resultados.size === 1 ? ([...resultados][0] ?? "INDETERMINATE") : "INDETERMINATE";

  const condicionesQueResuelven =
    categoria === null ? [] : condicionesDecisivasPara(clasificacion, resultadoDe, reglas);
  const fundamento = categoria === null ? [] : fundamentoDe(categoria, clasificacion);
  const hayEscenarioSinRegla = clasificacion.escenarios.some((e) => e.tipo === null);

  return {
    resultado,
    criterios: [
      {
        criterio: "CATEGORIA",
        resultado: RESULTADO_CRITERIO[resultado],
        categoriaInformada,
        fundamento,
      },
    ],
    tiposTrabajoPosibles: clasificacion.tiposPosibles.map(({ id, version, codigo, nombre }) => ({
      id,
      version,
      codigo,
      nombre,
    })),
    resultadosPorTipo: clasificacion.tiposPosibles.map(
      (tipo): ResultadoPorTipo => ({
        tipoTrabajoId: tipo.id,
        tipoTrabajoVersion: tipo.version,
        resultado:
          categoria === null
            ? "INDETERMINATE"
            : tipo.categoriasAdmitidas.includes(categoria)
              ? "COMPATIBLE"
              : "INCOMPATIBLE",
        fundamento: tipo.fundamento.find((f) => f.categoria === categoria) ?? null,
        reglaAplicada: { categoriasAdmitidas: tipo.categoriasAdmitidas },
      }),
    ),
    condicionesQueResuelven,
    limitaciones: [
      ...fuente.limitaciones.map((texto): Limitacion => ({ origen: "FUENTE", texto })),
      { origen: "ZONA", texto: limitacionDeZona(fuente, provincia.codigo, provincia.nombre) },
      ...clasificacion.tiposPosibles.flatMap((tipo) =>
        tipo.limitaciones.map((texto): Limitacion => ({ origen: "TIPO_TRABAJO", texto })),
      ),
    ],
    explicacion: explicar({
      resultado,
      categoriaInformada,
      categoria,
      fundamento,
      condicionesQueResuelven,
      hayEscenarioSinRegla,
      variosTipos: clasificacion.tiposPosibles.length > 1,
    }),
  };
}

function condicionesDecisivasPara(
  clasificacion: ClasificacionCubierta,
  resultadoDe: (escenario: Escenario) => ResultadoEvaluacion,
  reglas: Reglas,
): Pick<CondicionDecisiva, "id" | "pregunta">[] {
  const { escenarios, respuestas } = clasificacion;
  return reglas.condiciones
    .filter((condicion) => respuestas[condicion.id] === "NO_SE")
    .filter((condicion) =>
      escenarios.some((escenario) => {
        const opuesto = escenarios.find(
          (otro) =>
            otro.respuestas[condicion.id] !== escenario.respuestas[condicion.id] &&
            Object.keys(escenario.respuestas).every(
              (id) => id === condicion.id || otro.respuestas[id] === escenario.respuestas[id],
            ),
        );
        return opuesto !== undefined && resultadoDe(opuesto) !== resultadoDe(escenario);
      }),
    )
    .map(({ id, pregunta }) => ({ id, pregunta }));
}

function fundamentoDe(
  categoria: CategoriaId,
  clasificacion: ClasificacionCubierta,
): FundamentoCategoria[] {
  const fundamentos = clasificacion.tiposPosibles.flatMap((tipo) =>
    tipo.fundamento.filter((f) => f.categoria === categoria),
  );
  return fundamentos.filter(
    (f, i) =>
      fundamentos.findIndex(
        (otro) => otro.articulo === f.articulo && otro.admitida === f.admitida,
      ) === i,
  );
}

function limitacionDeZona(fuente: Fuente, provincia: string, nombreProvincia: string): string {
  if (fuente.areaConcesion.includes(provincia)) {
    return `La Fuente no permite determinar si la matrícula habilita a trabajar en ${nombreProvincia}: ${fuente.nombre} publica un único listado y no informa en qué zona está registrado cada gasista.`;
  }
  if (fuente.areaConcesionParcial.includes(provincia)) {
    return `${fuente.nombre} opera solo en parte de ${nombreProvincia}: MatriculAR no puede determinar si el lugar del trabajo está en su área ni si la matrícula habilita a trabajar ahí.`;
  }
  return `${nombreProvincia} está fuera del área de concesión de ${fuente.nombre}: el gasista podría estar registrado en otra distribuidora que MatriculAR no consultó.`;
}

interface DatosExplicacion {
  resultado: ResultadoEvaluacion;
  categoriaInformada: string;
  categoria: CategoriaId | null;
  fundamento: readonly FundamentoCategoria[];
  condicionesQueResuelven: readonly Pick<CondicionDecisiva, "pregunta">[];
  hayEscenarioSinRegla: boolean;
  variosTipos: boolean;
}

function explicar(datos: DatosExplicacion): string {
  const { resultado, categoria, fundamento } = datos;
  if (categoria === null) {
    const valor = datos.categoriaInformada === "" ? "vacía" : `«${datos.categoriaInformada}»`;
    return `La Fuente informa la categoría ${valor}, que MatriculAR no reconoce. No se puede determinar si es compatible con este tipo de trabajo.`;
  }

  const categoriaTexto = `La categoría informada (${categoria}ª)`;
  const citas = (admitida: boolean) => {
    const articulos = fundamento
      .filter((f) => f.admitida === admitida)
      .map((f) => `${f.norma}, ${f.articulo}`);
    return articulos.length > 0 ? ` (${articulos.join("; ")})` : "";
  };
  const paraTodos = datos.variosTipos ? ", cualquiera sea la respuesta que no sabés," : "";

  if (resultado === "COMPATIBLE") {
    return `${categoriaTexto} es compatible con este tipo de trabajo${paraTodos} según la regla aplicada${citas(true)}. La vigencia de la matrícula no pudo verificarse.`;
  }
  if (resultado === "INCOMPATIBLE") {
    return `${categoriaTexto} no es compatible con este tipo de trabajo${paraTodos} según la regla aplicada${citas(false)}.`;
  }

  const preguntas = datos.condicionesQueResuelven.map((c) => `«${c.pregunta}»`).join(" y ");
  const sinRegla = datos.hayEscenarioSinRegla
    ? " Con alguna de esas respuestas, el trabajo no está cubierto por las reglas de MatriculAR."
    : "";
  return `No se puede determinar si ${categoriaTexto.charAt(0).toLowerCase()}${categoriaTexto.slice(1)} es compatible con este trabajo: depende de tu respuesta a ${preguntas}.${sinRegla}`;
}
