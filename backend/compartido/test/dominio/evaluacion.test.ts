import { describe, expect, it } from "vitest";
import { type ClasificacionCubierta, clasificarTrabajo } from "../../src/dominio/clasificacion";
import type { Respuestas } from "../../src/dominio/condiciones";
import { evaluar } from "../../src/dominio/evaluacion";
import { casaSola, comercioConHornoIndustrial, ecogas, reglas } from "./ayudas";

function cubierta(respuestas: Respuestas): ClasificacionCubierta {
  const clasificacion = clasificarTrabajo(respuestas, reglas);
  if (!clasificacion.cubierto) throw new Error("La prueba espera un trabajo cubierto");
  return clasificacion;
}

function evaluarCon(
  categoriaInformada: string,
  respuestas: Respuestas,
  provinciaTrabajo = "CORDOBA",
) {
  return evaluar(
    { clasificacion: cubierta(respuestas), categoriaInformada, provinciaTrabajo, fuente: ecogas },
    reglas,
  );
}

describe("Evaluación: Criterio de categoría", () => {
  it("2ª en una casa sola es COMPATIBLE, con su fundamento", () => {
    const evaluacion = evaluarCon("2", casaSola());
    expect(evaluacion.resultado).toBe("COMPATIBLE");
    expect(evaluacion.criterios).toEqual([
      expect.objectContaining({ criterio: "CATEGORIA", resultado: "MET", categoriaInformada: "2" }),
    ]);
    expect(evaluacion.criterios[0]?.fundamento.map((f) => f.articulo)).toEqual(["8.3.1"]);
  });

  it("3ª en un departamento es INCOMPATIBLE, citando por qué", () => {
    const evaluacion = evaluarCon("3", casaSola({ unica_vivienda: "NO" }));
    expect(evaluacion.resultado).toBe("INCOMPATIBLE");
    expect(evaluacion.criterios[0]?.resultado).toBe("NOT_MET");
    expect(evaluacion.criterios[0]?.fundamento.map((f) => f.articulo)).toEqual(["8.4.1"]);
  });

  it("2ª en un comercio con horno industrial es INCOMPATIBLE, e informa la excepción que no se puede verificar", () => {
    const evaluacion = evaluarCon("2", comercioConHornoIndustrial());
    expect(evaluacion.resultado).toBe("INCOMPATIBLE");
    expect(evaluacion.limitaciones.map((l) => l.texto).join(" ")).toMatch(
      /autorización expresa de la distribuidora/,
    );
  });

  describe("categoría desconocida", () => {
    it.each(["4", "", "PRIMERA", " 2"])(
      "la categoría «%s» da INDETERMINATE, nunca un sí ni un no",
      (categoria) => {
        const evaluacion = evaluarCon(categoria, casaSola());
        expect(evaluacion.resultado).toBe("INDETERMINATE");
        expect(evaluacion.criterios[0]?.resultado).toBe("INDETERMINATE");
        expect(evaluacion.explicacion).toMatch(/no reconoce/);
      },
    );
  });
});

describe("Evaluación con Condiciones decisivas en No sé", () => {
  const noSeSiEsCasaSola = casaSola({ unica_vivienda: "NO_SE" });

  it("2ª es COMPATIBLE: todos los Tipos de trabajo posibles la admiten, así que el dato no cambia la respuesta", () => {
    const evaluacion = evaluarCon("2", noSeSiEsCasaSola);
    expect(evaluacion.resultado).toBe("COMPATIBLE");
    expect(evaluacion.condicionesQueResuelven).toEqual([]);
  });

  it("1ª es COMPATIBLE", () => {
    expect(evaluarCon("1", noSeSiEsCasaSola).resultado).toBe("COMPATIBLE");
  });

  it("3ª es INDETERMINATE e informa qué dato lo resolvería", () => {
    const evaluacion = evaluarCon("3", noSeSiEsCasaSola);
    expect(evaluacion.resultado).toBe("INDETERMINATE");
    expect(evaluacion.condicionesQueResuelven.map((c) => c.id)).toEqual(["unica_vivienda"]);
    expect(evaluacion.explicacion).toContain("¿El terreno tiene una única vivienda?");
  });

  it("3ª con el consumo total en No sé depende solo del consumo", () => {
    const evaluacion = evaluarCon("3", casaSola({ consumo_total_hasta_5m3h: "NO_SE" }));
    expect(evaluacion.resultado).toBe("INDETERMINATE");
    expect(evaluacion.condicionesQueResuelven.map((c) => c.id)).toEqual([
      "consumo_total_hasta_5m3h",
    ]);
  });

  it("si alguna respuesta posible deja el trabajo sin regla, ni siquiera la 1ª es COMPATIBLE", () => {
    const respuestas = casaSola({ comercio_o_industria: "NO_SE", artefacto_mas_de_50000: "NO_SE" });
    const evaluacion = evaluarCon("1", respuestas);
    expect(evaluacion.resultado).toBe("INDETERMINATE");
    expect(evaluacion.explicacion).toMatch(/no está cubierto/);
  });
});

describe("Zona: es una Limitación, nunca un Criterio (ADR-0005)", () => {
  it("S4: matrícula de Ecogas y trabajo en San Luis es COMPATIBLE por categoría, con la Limitación de zona", () => {
    const evaluacion = evaluarCon("2", casaSola(), "SAN_LUIS");
    expect(evaluacion.resultado).toBe("COMPATIBLE");
    expect(evaluacion.criterios.map((c) => c.criterio)).toEqual(["CATEGORIA"]);
    const zona = evaluacion.limitaciones.find((l) => l.origen === "ZONA");
    expect(zona?.texto).toMatch(
      /no permite determinar si la matrícula habilita a trabajar en San Luis/,
    );
  });

  it("fuera del Área de concesión, la Limitación avisa que podría estar registrado en otra distribuidora", () => {
    const evaluacion = evaluarCon("2", casaSola(), "BUENOS_AIRES");
    expect(evaluacion.resultado).toBe("COMPATIBLE");
    const zona = evaluacion.limitaciones.find((l) => l.origen === "ZONA");
    expect(zona?.texto).toMatch(/Buenos Aires está fuera del área de concesión de Ecogas/);
  });

  it("una provincia que no está en el catálogo es un error de entrada, no una incertidumbre", () => {
    expect(() => evaluarCon("2", casaSola(), "ATLANTIDA")).toThrow(/ATLANTIDA/);
  });
});

describe("Cómo se expresa el resultado", () => {
  it("COMPATIBLE afirma compatibilidad de la categoría y aclara que la vigencia no pudo verificarse", () => {
    const { explicacion } = evaluarCon("2", casaSola());
    expect(explicacion).toMatch(
      /^La categoría informada \(2ª\) es compatible con este tipo de trabajo según la regla aplicada/,
    );
    expect(explicacion).toMatch(/La vigencia de la matrícula no pudo verificarse\.$/);
  });

  it.each([
    ["2", casaSola()],
    ["1", comercioConHornoIndustrial()],
    ["2", casaSola({ unica_vivienda: "NO_SE" })],
  ] as const)("nunca promete habilitación (categoría %s)", (categoria, respuestas) => {
    const { explicacion } = evaluarCon(categoria, respuestas);
    expect(explicacion).not.toMatch(/puede realizar|habilitad|apto|vigente\b/i);
  });

  it("toda Evaluación informa que la Fuente no publica la vigencia", () => {
    for (const categoria of ["1", "3", "9"]) {
      const { limitaciones } = evaluarCon(categoria, casaSola({ unica_vivienda: "NO" }));
      expect(limitaciones.some((l) => l.origen === "FUENTE" && /vigencia/.test(l.texto))).toBe(
        true,
      );
    }
  });
});
