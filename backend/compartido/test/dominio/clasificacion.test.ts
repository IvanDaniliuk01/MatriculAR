import { describe, expect, it } from "vitest";
import { clasificarTrabajo } from "../../src/dominio/clasificacion";
import { casaSola, comercioConHornoIndustrial, reglas } from "./ayudas";

function codigosPosibles(clasificacion: ReturnType<typeof clasificarTrabajo>) {
  return clasificacion.cubierto ? clasificacion.tiposPosibles.map((tipo) => tipo.codigo) : [];
}

describe("Clasificación del trabajo a partir de las Condiciones decisivas", () => {
  it("una casa sola con artefactos comunes es A1", () => {
    expect(codigosPosibles(clasificarTrabajo(casaSola(), reglas))).toEqual(["A1"]);
  });

  it("un departamento es A2", () => {
    expect(codigosPosibles(clasificarTrabajo(casaSola({ unica_vivienda: "NO" }), reglas))).toEqual([
      "A2",
    ]);
  });

  it("una casa sola que consume más de 5 m³/h es A2", () => {
    const respuestas = casaSola({ consumo_total_hasta_5m3h: "NO" });
    expect(codigosPosibles(clasificarTrabajo(respuestas, reglas))).toEqual(["A2"]);
  });

  it("un comercio con un artefacto de más de 50.000 kcal/h es B", () => {
    expect(codigosPosibles(clasificarTrabajo(comercioConHornoIndustrial(), reglas))).toEqual(["B"]);
  });

  it("un No sé nunca se toma como Sí: deja abiertos todos los Tipos de trabajo compatibles con las demás respuestas", () => {
    const respuestas = casaSola({ unica_vivienda: "NO_SE" });
    expect(codigosPosibles(clasificarTrabajo(respuestas, reglas))).toEqual(["A1", "A2"]);
  });

  describe("trabajo no cubierto", () => {
    it("un comercio sin artefactos de alto consumo no tiene regla documentada", () => {
      const respuestas = { ...comercioConHornoIndustrial(), artefacto_mas_de_50000: "NO" as const };
      expect(clasificarTrabajo(respuestas, reglas).cubierto).toBe(false);
    });

    it("el gas envasado o a granel no tiene regla documentada", () => {
      const respuestas = casaSola({ gas_natural_red_baja_presion: "NO" });
      expect(clasificarTrabajo(respuestas, reglas).cubierto).toBe(false);
    });

    it("si algún escenario posible queda sin regla, la clasificación lo informa", () => {
      const respuestas = casaSola({
        comercio_o_industria: "NO_SE",
        artefacto_mas_de_50000: "NO_SE",
      });
      const clasificacion = clasificarTrabajo(respuestas, reglas);
      expect(clasificacion.cubierto).toBe(true);
      expect(clasificacion.escenarios.some((escenario) => escenario.tipo === null)).toBe(true);
    });
  });

  it("rechaza respuestas incompletas en lugar de suponerlas", () => {
    const { unica_vivienda: _omitida, ...incompletas } = casaSola();
    expect(() => clasificarTrabajo(incompletas, reglas)).toThrow(/unica_vivienda/);
  });
});
