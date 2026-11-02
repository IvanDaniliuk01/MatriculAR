import { describe, expect, it } from "vitest";
import { validarReglas } from "../../src/dominio/reglas";
import { reglas } from "./ayudas";

describe("Las reglas del seed son coherentes", () => {
  it("no tienen errores de integridad", () => {
    expect(validarReglas(reglas)).toEqual([]);
  });

  it("detecta dos Tipos de trabajo que se superponen", () => {
    const [primero] = reglas.tipos;
    if (!primero) throw new Error("El seed no tiene Tipos de trabajo");
    const duplicado = { ...primero, id: "duplicado", codigo: "X" };
    const errores = validarReglas({ ...reglas, tipos: [...reglas.tipos, duplicado] });
    expect(errores.join("\n")).toMatch(/A1.*X|X.*A1/);
  });

  it("detecta una Categoría admitida sin cita", () => {
    const [primero, ...resto] = reglas.tipos;
    if (!primero) throw new Error("El seed no tiene Tipos de trabajo");
    const sinCita = {
      ...primero,
      fundamento: primero.fundamento.filter((f) => f.categoria !== "3"),
    };
    expect(validarReglas({ ...reglas, tipos: [sinCita, ...resto] }).join("\n")).toMatch(/3/);
  });

  it("detecta una condición que no existe en el catálogo", () => {
    const [primero, ...resto] = reglas.tipos;
    if (!primero) throw new Error("El seed no tiene Tipos de trabajo");
    const conCondicionInventada = { ...primero, aplicaSi: [{ inventada: "SI" as const }] };
    expect(
      validarReglas({ ...reglas, tipos: [conCondicionInventada, ...resto] }).join("\n"),
    ).toMatch(/inventada/);
  });
});
