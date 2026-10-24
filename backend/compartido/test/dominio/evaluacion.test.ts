import { describe, expect, it } from "vitest";
import { catalogoDesdeSeed } from "../../src/adaptadores/memoria/catalogo";
import {
  LIMITACION_FUERA_DEL_AREA, LIMITACION_ZONA, evaluar, evaluarCategoria, limitacionesDe, resultadoGlobal,
} from "../../src/dominio/evaluacion";
import { claveFuenteMatricula, esMatriculaValida, normalizarMatricula } from "../../src/dominio/matricula";
import type { Credencial } from "../../src/dominio/tipos";
import { fileURLToPath } from "node:url";

const seed = fileURLToPath(new URL("../../../../database/seed", import.meta.url));
const cat = catalogoDesdeSeed(seed);
const A1 = cat.tipoTrabajo("artefacto-vivienda-unifamiliar")!;
const A2 = cat.tipoTrabajo("artefacto-vivienda-general")!;
const B = cat.tiposTrabajo().find((t) => t.codigo === "B")!;
const ecogas = cat.fuente("ecogas")!;
const metrogas = cat.fuente("metrogas")!;

const credencial = (categoria: string): Credencial => ({
  fuente_matricula: "ecogas#99001", evidencia_id: "2026-10-24T15:00:00.000Z#C1", fuente_id: "ecogas", matricula: "99001",
  consulta_id: "C1", consultada_en: "2026-10-24T15:00:00.000Z", nombre_informado: "PERSONA FICTICIA UNO",
  categoria_informada: categoria, provincia_informada: "CORDOBA", localidad_informada: "CORDOBA", creada_en: "2026-10-24T15:00:00.000Z",
});

describe("Criterio de categoría: lista explícita, sin orden (INV-7)", () => {
  it("A1 admite 1ª, 2ª y 3ª", () => {
    for (const c of ["1", "2", "3"]) expect(evaluarCategoria(c, A1, cat.categorias()).resultado).toBe("MET");
  });
  it("A2 no admite la 3ª; B solo admite la 1ª", () => {
    expect(evaluarCategoria("3", A2, cat.categorias()).resultado).toBe("NOT_MET");
    expect(evaluarCategoria("2", B, cat.categorias()).resultado).toBe("NOT_MET");
    expect(evaluarCategoria("3", B, cat.categorias()).resultado).toBe("NOT_MET");
    expect(evaluarCategoria("1", B, cat.categorias()).resultado).toBe("MET");
  });
  it("la 2ª con el tipo B es NOT_MET aunque '2 ≥ 1' (no se compara por número)", () => {
    const c = evaluarCategoria("2", B, cat.categorias());
    expect(c.resultado).toBe("NOT_MET");
    expect(c.fundamento).toMatch(/NAG-200, 8\.3\.1/);
  });
  it("una categoría que no está en el catálogo o vacía es INDETERMINATE, nunca NOT_MET ni MET", () => {
    expect(evaluarCategoria("9", A1, cat.categorias()).resultado).toBe("INDETERMINATE");
    expect(evaluarCategoria("", A1, cat.categorias()).resultado).toBe("INDETERMINATE");
    expect(evaluarCategoria("  ", A1, cat.categorias()).resultado).toBe("INDETERMINATE");
  });
});

describe("Resultado global", () => {
  it("NOT_MET > INDETERMINATE > MET", () => {
    expect(resultadoGlobal(["MET"])).toBe("COMPATIBLE");
    expect(resultadoGlobal(["MET", "INDETERMINATE"])).toBe("INDETERMINATE");
    expect(resultadoGlobal(["INDETERMINATE", "NOT_MET"])).toBe("INCOMPATIBLE");
  });
});

describe("La zona es una Limitación, no un Criterio (ADR-0005)", () => {
  const e = (prov: string, t = A1, f = ecogas) =>
    evaluar({ evaluacion_id: "E1", verificacion_id: "V1", credencial: credencial("2"), tipo_trabajo: t, fuente: f, categorias: cat.categorias(), provincia_trabajo: prov, ahora: "2026-10-24T15:00:00.000Z" });

  it("la Evaluación tiene un solo Criterio: categoría", () => {
    expect(Object.keys(e("CORDOBA").criterios)).toEqual(["categoria"]);
  });
  it("dentro del área de Ecogas: solo la Limitación fija de zona", () => {
    const l = e("SAN_LUIS").limitaciones;
    expect(l).toContain(LIMITACION_ZONA);
    expect(l).not.toContain(LIMITACION_FUERA_DEL_AREA);
  });
  it("la provincia informada (CORDOBA) no impide ni habilita un trabajo en San Luis", () => {
    expect(e("SAN_LUIS").resultado).toBe("COMPATIBLE");
  });
  it("fuera del área: se agrega la segunda Limitación pero el resultado NO cambia", () => {
    const ev = e("BUENOS_AIRES");
    expect(ev.limitaciones).toContain(LIMITACION_ZONA);
    expect(ev.limitaciones).toContain(LIMITACION_FUERA_DEL_AREA);
    expect(ev.resultado).toBe("COMPATIBLE");
  });
  it("provincia de concesión parcial (MetroGAS en Buenos Aires) también agrega la segunda Limitación", () => {
    expect(limitacionesDe(metrogas, A1, "BUENOS_AIRES")).toContain(LIMITACION_FUERA_DEL_AREA);
    expect(limitacionesDe(metrogas, A1, "CIUDAD_AUTONOMA_DE_BUENOS_AIRES")).not.toContain(LIMITACION_FUERA_DEL_AREA);
  });
});

describe("Evaluación: copia de la regla y limitaciones", () => {
  const ev = evaluar({ evaluacion_id: "E1", verificacion_id: "V1", credencial: credencial("2"), tipo_trabajo: B, fuente: ecogas, categorias: cat.categorias(), provincia_trabajo: "CORDOBA", ahora: "2026-10-24T15:00:00.000Z" });
  it("INCOMPATIBLE para 2ª con B, con la Limitación de la excepción 8.3.1 atribuida a los Sectores Técnicos", () => {
    expect(ev.resultado).toBe("INCOMPATIBLE");
    expect(ev.limitaciones.join(" ")).toMatch(/Sectores Técnicos/);
  });
  it("incluye siempre la Vigencia como Limitación y nunca la afirma", () => {
    expect(ev.limitaciones[0]).toMatch(/no informa la vigencia/);
    expect(JSON.stringify(ev)).not.toMatch(/"vigente"|vencimiento/i);
  });
  it("conserva una copia de la regla aplicada (no una referencia)", () => {
    expect(ev.regla_aplicada.categorias_admitidas).toEqual(B.categorias_admitidas);
    expect(ev.regla_aplicada.categorias_admitidas).not.toBe(B.categorias_admitidas);
    expect(ev.tipo_trabajo_version).toBe(B.version);
  });
  it("las condiciones asumidas van como Limitación", () => {
    expect(ev.limitaciones.at(-1)).toMatch(/^Esta evaluación supone que el trabajo cumple las condiciones/);
  });
});

describe("Matrícula", () => {
  it("se normaliza sin espacios ni ceros a la izquierda", () => {
    expect(normalizarMatricula(" 00091 ")).toBe("91");
    expect(normalizarMatricula("9 9001")).toBe("99001");
    expect(normalizarMatricula("000")).toBe("0");
  });
  it("valida 1 a 20 alfanuméricos", () => {
    expect(esMatriculaValida("99001")).toBe(true);
    expect(esMatriculaValida("")).toBe(false);
    expect(esMatriculaValida("12-34")).toBe(false);
    expect(esMatriculaValida("1".repeat(21))).toBe(false);
  });
  it("clave fuente#matrícula", () => expect(claveFuenteMatricula("ecogas", "99001")).toBe("ecogas#99001"));
});
