import { reglasDelSeed } from "../../src/adaptadores/reglas/reglas-seed";
import type { Respuestas } from "../../src/dominio/condiciones";
import type { Fuente } from "../../src/dominio/reglas";

export const reglas = reglasDelSeed();

const ecogasEncontrada = reglas.fuentes.find((fuente) => fuente.id === "ecogas");
if (!ecogasEncontrada) throw new Error("El seed no tiene la Fuente ecogas");
export const ecogas: Fuente = ecogasEncontrada;

/** Respuestas de una casa sola con artefactos comunes: el caso A1. */
export function casaSola(cambios: Partial<Record<string, Respuestas[string]>> = {}): Respuestas {
  return {
    comercio_o_industria: "NO",
    unica_vivienda: "SI",
    consumo_total_hasta_5m3h: "SI",
    artefacto_mas_de_50000: "NO",
    gas_natural_red_baja_presion: "SI",
    ...cambios,
  } as Respuestas;
}

/** Respuestas de un comercio con un horno industrial: el caso B. */
export function comercioConHornoIndustrial(): Respuestas {
  return {
    comercio_o_industria: "SI",
    unica_vivienda: "NO",
    consumo_total_hasta_5m3h: "NO",
    artefacto_mas_de_50000: "SI",
    gas_natural_red_baja_presion: "SI",
  };
}
