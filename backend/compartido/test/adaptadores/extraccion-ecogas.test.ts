import { describe, expect, it } from "vitest";
import {
  extraerDeChunk,
  extraerDePagina,
  type ResultadoExtraccion,
  validarCantidad,
} from "../../src/adaptadores/fuentes/ecogas/extraccion";
import {
  chunkSoloColumnas,
  chunkV1,
  paginaConPayload,
  paginaV2,
  registroV1,
  registroV2,
} from "./fixtures/ecogas";

function registrosDe(extraccion: ResultadoExtraccion) {
  if (!extraccion.ok) throw new Error(`Se esperaba una extracción exitosa: ${extraccion.detalle}`);
  return extraccion.registros;
}

describe("Extracción de Ecogas, formato actual (página con payload de React, 02/11/2026)", () => {
  it("extrae los registros normalizados y conserva los valores tal como vinieron", () => {
    const extraccion = extraerDePagina(paginaV2());
    expect(extraccion.ok && extraccion.formato).toBe("PAGINA_RSC");
    const [primero] = registrosDe(extraccion);
    expect(primero?.registro).toEqual({
      idInterno: "1",
      nombre: "PERSONA FICTICIA UNO",
      categoria: "1",
      provincia: "CORDOBA",
      localidad: "CORDOBA",
    });
    expect(primero?.valoresFuente).toEqual({
      id: 1,
      nombre_apellido: "PERSONA FICTICIA UNO",
      categoria: { numero: "1", nombre: "Categoría 1" },
      provincia: { nombre: "CORDOBA" },
      localidad: { nombre: "CORDOBA" },
    });
  });

  it("nunca conserva email, teléfono ni barrio", () => {
    for (const { valoresFuente } of registrosDe(extraerDePagina(paginaV2()))) {
      expect(Object.keys(valoresFuente)).not.toEqual(
        expect.arrayContaining(["correo_electronico"]),
      );
      expect(valoresFuente).not.toHaveProperty("telefono");
      expect(valoresFuente).not.toHaveProperty("barrio");
    }
  });

  it("una categoría desconocida se conserva tal como vino: la Evaluación decide que es INDETERMINATE", () => {
    const pagina = paginaV2({
      registros: [registroV2(0, { categoria: { numero: "4", nombre: "?" } })],
    });
    expect(registrosDe(extraerDePagina(pagina))[0]?.registro.categoria).toBe("4");
  });

  it("una clave nueva (por ejemplo, de vigencia) se informa para revisarla", () => {
    const pagina = paginaV2({ registros: [registroV2(0, { vencimiento: "2027-03-31" })] });
    const extraccion = extraerDePagina(pagina);
    expect(extraccion.ok && extraccion.clavesNoEsperadas).toEqual(["vencimiento"]);
  });
});

describe("Extracción de Ecogas, formato de septiembre (chunk con JSON.parse)", () => {
  it("decodifica el literal de JavaScript, incluidos los escapes de tildes y Ñ", () => {
    const registros = [{ ...registroV1(0), nombre_apellido: "MUÑOZ JOSÉ" }];
    const extraccion = extraerDeChunk(chunkV1(registros));
    expect(extraccion.ok && extraccion.formato).toBe("CHUNK_JSON_PARSE");
    expect(registrosDe(extraccion)[0]?.registro.nombre).toBe("MUÑOZ JOSÉ");
  });

  it("el chunk que solo define las columnas no se confunde con el padrón", () => {
    const extraccion = extraerDeChunk(chunkSoloColumnas());
    expect(extraccion).toMatchObject({ ok: false, validacion: "V2" });
  });
});

describe("Cambio de estructura o extracción incompleta: siempre EXTRACTION_FAILED, nunca «0 matriculados»", () => {
  it.each([
    ["la propiedad del padrón cambió de nombre", paginaV2({ clave: "matriculados" }), "V2"],
    ["la página ya no trae el payload", "<html><body>Listado</body></html>", "V2"],
    ["el payload no se puede leer", paginaConPayload('13:["$",{"gasistasMatriculados":{'), "V3"],
    [
      "la Fuente informa success: false",
      paginaV2({ contenedor: { success: false, data: [] } }),
      "V3",
    ],
    ["el padrón viene vacío", paginaV2({ registros: [] }), "V4"],
    [
      "a un registro le falta una clave obligatoria",
      paginaV2({ registros: [registroV2(0), { ...registroV2(1), nombre_apellido: undefined }] }),
      "V4",
    ],
    [
      "hay identificadores repetidos",
      paginaV2({ registros: [registroV2(0), registroV2(0)] }),
      "V4",
    ],
  ] as const)("%s → falla %s", (_caso, pagina, validacion) => {
    const extraccion = extraerDePagina(pagina);
    expect(extraccion).toMatchObject({ ok: false, validacion });
    expect(extraccion).not.toHaveProperty("registros");
  });
});

describe("V5: caída brusca de la cantidad de registros", () => {
  const config = { umbralCaida: 0.5, pisoRegistros: 1000 };

  it("la variación real del 26/09 al 02/11 (5.031 → 4.836) es aceptable", () => {
    expect(validarCantidad(4836, 5031, config)).toBeNull();
  });

  it("una caída a menos de la mitad es sospechosa", () => {
    expect(validarCantidad(2000, 5031, config)).toMatch(/2000/);
  });

  it("menos registros que el piso es sospechoso aunque no haya lectura anterior", () => {
    expect(validarCantidad(900, null, config)).toMatch(/900/);
  });
});
