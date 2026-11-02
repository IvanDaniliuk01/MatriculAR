import type { Respuestas, RespuestasConocidas } from "./condiciones";
import { combinaciones, type Reglas, type TipoTrabajo, tipoAplica } from "./reglas";

/** Una forma concreta que podría tener el trabajo, y el Tipo de trabajo en el que cae (o ninguno). */
export interface Escenario {
  respuestas: RespuestasConocidas;
  tipo: TipoTrabajo | null;
}

export interface ClasificacionCubierta {
  cubierto: true;
  respuestas: Respuestas;
  escenarios: readonly Escenario[];
  tiposPosibles: readonly TipoTrabajo[];
}

export interface ClasificacionNoCubierta {
  cubierto: false;
  respuestas: Respuestas;
  escenarios: readonly Escenario[];
}

export type Clasificacion = ClasificacionCubierta | ClasificacionNoCubierta;

/**
 * Deduce qué Tipos de trabajo son posibles. Cada No sé abre los dos escenarios (Sí y No):
 * nunca se elige uno. Si ningún escenario cae en un Tipo de trabajo, el trabajo no está cubierto.
 */
export function clasificarTrabajo(respuestas: Respuestas, reglas: Reglas): Clasificacion {
  const faltantes = reglas.condiciones.filter((condicion) => !(condicion.id in respuestas));
  if (faltantes.length > 0) {
    throw new Error(`Faltan respuestas: ${faltantes.map((c) => c.id).join(", ")}.`);
  }

  const conocidas: Record<string, "SI" | "NO"> = {};
  const desconocidas: string[] = [];
  for (const { id } of reglas.condiciones) {
    const respuesta = respuestas[id];
    if (respuesta === "NO_SE") desconocidas.push(id);
    else if (respuesta === "SI" || respuesta === "NO") conocidas[id] = respuesta;
  }

  const escenarios = combinaciones(desconocidas).map((completadas): Escenario => {
    const escenario = { ...conocidas, ...completadas };
    return {
      respuestas: escenario,
      tipo: reglas.tipos.find((t) => tipoAplica(t, escenario)) ?? null,
    };
  });

  const tiposPosibles = reglas.tipos.filter((tipo) => escenarios.some((e) => e.tipo === tipo));
  if (tiposPosibles.length === 0) return { cubierto: false, respuestas, escenarios };
  return { cubierto: true, respuestas, escenarios, tiposPosibles };
}
