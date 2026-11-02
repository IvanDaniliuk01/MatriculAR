import type { CondicionId, RespuestaConocida, RespuestasConocidas } from "./condiciones";

/** Categorías del catálogo (NAG-200). Son alcances, no niveles: nunca se comparan. */
export const CATEGORIAS = ["1", "2", "3"] as const;
export type CategoriaId = (typeof CATEGORIAS)[number];

export function esCategoriaConocida(valor: string): valor is CategoriaId {
  return (CATEGORIAS as readonly string[]).includes(valor);
}

export interface Fundamento {
  norma: string;
  articulo: string;
  cita: string;
  url: string;
  nota?: string | undefined;
}

export interface FundamentoCategoria extends Fundamento {
  categoria: CategoriaId;
  admitida: boolean;
}

export interface CondicionDecisiva {
  id: CondicionId;
  orden: number;
  pregunta: string;
  fundamento: Fundamento;
}

export interface TipoTrabajo {
  id: string;
  version: number;
  codigo: string;
  nombre: string;
  categoriasAdmitidas: readonly CategoriaId[];
  fundamento: readonly FundamentoCategoria[];
  /** Alternativas: el Tipo aplica si las respuestas cumplen alguna de ellas por completo. */
  aplicaSi: readonly Readonly<Record<CondicionId, RespuestaConocida>>[];
  limitaciones: readonly string[];
}

export interface Fuente {
  id: string;
  version: number;
  nombre: string;
  areaConcesion: readonly string[];
  areaConcesionParcial: readonly string[];
  modoAcceso: "AUTOMATED" | "NOT_AUTOMATABLE";
  urlBuscadorOficial: string;
  /** Protección de la Fuente (ADR-0006). Nula si la Fuente no se lee automáticamente. */
  proteccion: { ventanaReutilizacionS: number; esperaTrasFallaS: number } | null;
  limitaciones: readonly string[];
}

export interface Provincia {
  codigo: string;
  nombre: string;
}

export interface Reglas {
  condiciones: readonly CondicionDecisiva[];
  tipos: readonly TipoTrabajo[];
  fuentes: readonly Fuente[];
  provincias: readonly Provincia[];
}

export function tipoAplica(tipo: TipoTrabajo, respuestas: RespuestasConocidas): boolean {
  return tipo.aplicaSi.some((alternativa) =>
    Object.entries(alternativa).every(([condicion, valor]) => respuestas[condicion] === valor),
  );
}

/** Todas las combinaciones de Sí y No para las condiciones dadas. */
export function combinaciones(condiciones: readonly CondicionId[]): RespuestasConocidas[] {
  return condiciones.reduce<RespuestasConocidas[]>(
    (parciales, condicion) =>
      parciales.flatMap((parcial) => [
        { ...parcial, [condicion]: "SI" },
        { ...parcial, [condicion]: "NO" },
      ]),
    [{}],
  );
}

/**
 * Errores de integridad de las reglas. Una regla sin cita, o dos Tipos de trabajo que se
 * superponen, no pueden entrar al sistema: con errores, el sistema no arranca.
 */
export function validarReglas(reglas: Reglas): string[] {
  const errores: string[] = [];
  const condicionesConocidas = new Set(reglas.condiciones.map((condicion) => condicion.id));

  for (const condicion of reglas.condiciones) {
    if (!condicion.fundamento.cita.trim()) {
      errores.push(`La Condición decisiva ${condicion.id} no tiene cita.`);
    }
  }

  for (const tipo of reglas.tipos) {
    for (const alternativa of tipo.aplicaSi) {
      for (const condicion of Object.keys(alternativa)) {
        if (!condicionesConocidas.has(condicion)) {
          errores.push(
            `El Tipo de trabajo ${tipo.codigo} usa la condición ${condicion}, que no existe.`,
          );
        }
      }
    }
    for (const categoria of CATEGORIAS) {
      const fundamento = tipo.fundamento.find((f) => f.categoria === categoria);
      const admitida = tipo.categoriasAdmitidas.includes(categoria);
      if (!fundamento?.cita.trim()) {
        errores.push(
          `El Tipo de trabajo ${tipo.codigo} no tiene cita para la categoría ${categoria}.`,
        );
      } else if (fundamento.admitida !== admitida) {
        errores.push(
          `El Tipo de trabajo ${tipo.codigo} admite la categoría ${categoria} en una lista y no en la otra.`,
        );
      }
    }
  }

  for (const escenario of combinaciones([...condicionesConocidas])) {
    const aplicables = reglas.tipos.filter((tipo) => tipoAplica(tipo, escenario));
    if (aplicables.length > 1) {
      const codigos = aplicables.map((tipo) => tipo.codigo).join(" y ");
      errores.push(
        `Los Tipos de trabajo ${codigos} se superponen en ${JSON.stringify(escenario)}.`,
      );
    }
  }

  return errores;
}
