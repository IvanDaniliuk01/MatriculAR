import { describe, expect, it } from "vitest";
import { extraerDePagina } from "../src/adaptadores/fuentes/ecogas/extraccion";
import { buscarCoincidencias } from "../src/dominio/busqueda";
import { clasificarTrabajo } from "../src/dominio/clasificacion";
import { evaluar } from "../src/dominio/evaluacion";
import { paginaV2, registroV2 } from "./adaptadores/fixtures/ecogas";
import { casaSola, ecogas, reglas } from "./dominio/ayudas";

/**
 * El recorrido que pidió el tutor, sin infraestructura: página de Ecogas → extracción válida →
 * gasista → trabajo → Evaluación → respuesta explicable. Persistencia y HTTP vienen después.
 */
function verificar(pagina: string, nombreApellido: string, localidad?: string) {
  const extraccion = extraerDePagina(pagina);
  if (!extraccion.ok) return { resultado: "UNVERIFIABLE" as const, motivo: extraccion.detalle };

  const clasificacion = clasificarTrabajo(casaSola(), reglas);
  if (!clasificacion.cubierto) throw new Error("La prueba usa un trabajo cubierto");

  const busqueda = buscarCoincidencias(
    extraccion.registros.map((r) => r.registro),
    { nombreApellido, localidad },
  );
  if (busqueda.resultado !== "FOUND") return busqueda;
  return {
    resultado: "FOUND" as const,
    coincidencias: busqueda.coincidencias.map((registro) => ({
      registro,
      evaluacion: evaluar(
        {
          clasificacion,
          categoriaInformada: registro.categoria,
          provinciaTrabajo: "CORDOBA",
          fuente: ecogas,
        },
        reglas,
      ),
    })),
  };
}

describe("Recorrido completo sobre un fixture de la página actual de Ecogas", () => {
  const pagina = paginaV2({
    registros: [
      registroV2(0, { categoria: { numero: "2", nombre: "Categoría 2" } }),
      registroV2(1, { categoria: { numero: "3", nombre: "Categoría 3" } }),
      registroV2(3, {
        nombre_apellido: "PERSONA FICTICIA UNO",
        localidad: { nombre: "RIO CUARTO" },
        categoria: { numero: "9", nombre: "Categoría desconocida" },
      }),
    ],
  });

  it("encuentra al gasista y explica la Evaluación con su fundamento y sus Limitaciones", () => {
    const respuesta = verificar(pagina, "Persona Ficticia Dos");
    expect(respuesta.resultado).toBe("FOUND");
    if (respuesta.resultado !== "FOUND") return;
    const [{ evaluacion }] = respuesta.coincidencias as [(typeof respuesta.coincidencias)[number]];
    expect(evaluacion.resultado).toBe("COMPATIBLE");
    expect(evaluacion.explicacion).toContain("según la regla aplicada (NAG-200, 8.4.1)");
    expect(evaluacion.explicacion).toContain("La vigencia de la matrícula no pudo verificarse.");
  });

  it("con homónimos muestra cada uno con su propia Evaluación, incluida la categoría desconocida", () => {
    const respuesta = verificar(pagina, "Persona Ficticia Uno");
    expect(
      respuesta.resultado === "FOUND" && respuesta.coincidencias.map((c) => c.evaluacion.resultado),
    ).toEqual(["COMPATIBLE", "INDETERMINATE"]);
  });

  it("si la Fuente cambió de estructura, la respuesta es UNVERIFIABLE y no «no encontrado»", () => {
    const respuesta = verificar(paginaV2({ clave: "listado" }), "Persona Ficticia Dos");
    expect(respuesta).toMatchObject({ resultado: "UNVERIFIABLE" });
  });

  it("si la Fuente se leyó bien y nadie coincide, es NOT_FOUND", () => {
    expect(verificar(pagina, "Nadie Inexistente")).toEqual({ resultado: "NOT_FOUND" });
  });
});
