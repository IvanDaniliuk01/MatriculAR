import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraerDePagina, validarCantidad } from "../../src/adaptadores/fuentes/ecogas/extraccion";

/**
 * Prueba contra la Ecogas real. Nunca corre en CI: se corre a mano con `npm run test:fuente-real`.
 * - ECOGAS_PAGINA=<ruta> usa una página ya descargada (no vuelve a pedirla).
 * - Si no, MATRICULAR_CONTACTO=<mail> es obligatorio: va en el User-Agent.
 * Solo imprime conteos: el padrón tiene datos personales.
 */
const PAGINA =
  "https://www.ecogas.com.ar/hogares-comercios/tramites-y-servicios/listado-de-gasistas-matriculados";

async function obtenerPagina(): Promise<string> {
  const local = process.env.ECOGAS_PAGINA;
  if (local) return readFileSync(local, "utf8");
  const contacto = process.env.MATRICULAR_CONTACTO;
  if (!contacto) throw new Error("Definí MATRICULAR_CONTACTO o ECOGAS_PAGINA.");
  const respuesta = await fetch(PAGINA, {
    headers: { "User-Agent": `MatriculAR/0.1 (proyecto final UTN; contacto: ${contacto})` },
  });
  expect(respuesta.status).toBe(200);
  return respuesta.text();
}

describe("Ecogas real", () => {
  it("la página actual se extrae completa y pasa las validaciones", {
    timeout: 60_000,
  }, async () => {
    const extraccion = extraerDePagina(await obtenerPagina());
    if (!extraccion.ok) throw new Error(`${extraccion.validacion}: ${extraccion.detalle}`);

    const porCategoria = Object.groupBy(extraccion.registros, (r) => r.registro.categoria);
    const porProvincia = Object.groupBy(extraccion.registros, (r) => r.registro.provincia);
    console.info({
      formato: extraccion.formato,
      registros: extraccion.registros.length,
      clavesNoEsperadas: extraccion.clavesNoEsperadas,
      porCategoria: Object.fromEntries(
        Object.entries(porCategoria).map(([k, v]) => [k, v?.length]),
      ),
      porProvincia: Object.fromEntries(
        Object.entries(porProvincia).map(([k, v]) => [k, v?.length]),
      ),
    });
    expect(
      validarCantidad(extraccion.registros.length, null, { umbralCaida: 0.5, pisoRegistros: 1000 }),
    ).toBeNull();
  });
});
