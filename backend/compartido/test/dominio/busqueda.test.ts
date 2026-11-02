import { describe, expect, it } from "vitest";
import {
  buscarCoincidencias,
  MAX_COINCIDENCIAS,
  type RegistroFuente,
  validarGasistaBuscado,
} from "../../src/dominio/busqueda";

function registro(idInterno: string, nombre: string, localidad = "CORDOBA"): RegistroFuente {
  return { idInterno, nombre, categoria: "2", provincia: "CORDOBA", localidad };
}

const padron: RegistroFuente[] = [
  registro("1", "PEREZ JOSE LUIS"),
  registro("2", "GOMEZ SUSANA", "VILLA MARIA"),
  registro("3", "FICTICIA UNO PERSONA", "VILLA MARIA"),
  registro("4", "FICTICIA UNO PERSONA", "RIO CUARTO"),
  registro("5", "MUÑOZ ANA"),
];

describe("Gasista buscado", () => {
  it("exige al menos nombre y apellido", () => {
    expect(validarGasistaBuscado({ nombreApellido: "Pérez" })).toEqual([
      "Ingresá al menos nombre y apellido.",
    ]);
    expect(validarGasistaBuscado({ nombreApellido: "  José   Pérez " })).toEqual([]);
  });
});

describe("Coincidencias en la Fuente", () => {
  it("encuentra sin importar el orden, las mayúsculas ni las tildes", () => {
    const busqueda = buscarCoincidencias(padron, { nombreApellido: "José Pérez" });
    expect(busqueda).toEqual({ resultado: "FOUND", coincidencias: [padron[0]] });
  });

  it("compara palabras completas: Ana no coincide con Susana", () => {
    const busqueda = buscarCoincidencias(padron, { nombreApellido: "Ana Gómez" });
    expect(busqueda.resultado).toBe("NOT_FOUND");
  });

  it("la Ñ también se normaliza", () => {
    const busqueda = buscarCoincidencias(padron, { nombreApellido: "ana munoz" });
    expect(busqueda.resultado).toBe("FOUND");
  });

  it("con homónimos devuelve todas las Coincidencias: MatriculAR nunca elige", () => {
    const busqueda = buscarCoincidencias(padron, { nombreApellido: "Persona Ficticia Uno" });
    expect(
      busqueda.resultado === "FOUND" && busqueda.coincidencias.map((r) => r.idInterno),
    ).toEqual(["3", "4"]);
  });

  it("la localidad filtra, normalizada", () => {
    const busqueda = buscarCoincidencias(padron, {
      nombreApellido: "Persona Ficticia Uno",
      localidad: "Villa María",
    });
    expect(
      busqueda.resultado === "FOUND" && busqueda.coincidencias.map((r) => r.idInterno),
    ).toEqual(["3"]);
  });

  it("si nadie coincide es NOT_FOUND", () => {
    expect(buscarCoincidencias(padron, { nombreApellido: "Nadie Inexistente" })).toEqual({
      resultado: "NOT_FOUND",
    });
  });

  it("si coinciden demasiados no los muestra y pide precisar: no es NOT_FOUND", () => {
    const muchos = Array.from({ length: MAX_COINCIDENCIAS + 1 }, (_, i) =>
      registro(String(i), `GONZALEZ JUAN ${i}`),
    );
    expect(buscarCoincidencias(muchos, { nombreApellido: "Juan González" })).toEqual({
      resultado: "TOO_MANY_MATCHES",
      cantidad: MAX_COINCIDENCIAS + 1,
    });
  });

  it("con exactamente el máximo todavía las muestra", () => {
    const justos = Array.from({ length: MAX_COINCIDENCIAS }, (_, i) =>
      registro(String(i), `GONZALEZ JUAN ${i}`),
    );
    const busqueda = buscarCoincidencias(justos, { nombreApellido: "Juan González" });
    expect(busqueda.resultado === "FOUND" && busqueda.coincidencias).toHaveLength(
      MAX_COINCIDENCIAS,
    );
  });
});
