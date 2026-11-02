import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { definicionesTablas } from "../../src/adaptadores/dynamodb/esquema-tablas";
import { configAwsDesdeEntorno } from "../../src/adaptadores/dynamodb/repositorios";

const TABLAS = join(import.meta.dirname, "../../../../database/tablas");

describe("Esquema de las tablas del P0", () => {
  it("database/tablas/*.json coincide con lo que usa el código (la documentación no se desactualiza)", () => {
    const definiciones = definicionesTablas({
      consultas: "Consultas",
      credenciales: "Credenciales",
      verificaciones: "Verificaciones",
      evaluaciones: "Evaluaciones",
    });
    for (const definicion of Object.values(definiciones)) {
      const documentada = JSON.parse(
        readFileSync(join(TABLAS, `${definicion.TableName}.json`), "utf8"),
      );
      expect(documentada).toEqual(definicion);
    }
  });

  it("la configuración de almacenamiento falla con un mensaje claro si falta una variable", () => {
    expect(() =>
      configAwsDesdeEntorno({
        MATRICULAR_TABLA_CONSULTAS: "c",
        MATRICULAR_TABLA_CREDENCIALES: "cr",
      }),
    ).toThrow(
      /MATRICULAR_TABLA_VERIFICACIONES, MATRICULAR_TABLA_EVALUACIONES, MATRICULAR_BUCKET_LECTURAS/,
    );
  });
});
