import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraerDePagina, validarCantidad } from "../../src/adaptadores/fuentes/ecogas/extraccion";
import { LectorEcogas } from "../../src/adaptadores/fuentes/ecogas/lector-ecogas";
import { ClienteFetch } from "../../src/adaptadores/http/cliente-fetch";
import { relojSistema } from "../../src/adaptadores/sistema/reloj-sistema";
import type { RegistroLeido } from "../../src/dominio/consulta";
import type { ConfigLectura } from "../../src/puertos/lector-fuente";

/**
 * Prueba contra la Ecogas real. Nunca corre en CI: se corre a mano con `npm run test:fuente-real`.
 * - ECOGAS_PAGINA=<ruta> usa una página ya descargada (no vuelve a pedirla).
 * - Si no, MATRICULAR_CONTACTO=<mail> es obligatorio: va en el User-Agent, y la lectura usa el
 *   lector completo (reintentos, descubrimiento y validaciones) con la configuración del seed.
 * Solo imprime conteos: el padrón tiene datos personales.
 */

interface FuenteSeed {
  fuente_id: string;
  url_pagina: string;
  config_extraccion: { marcador_v2: string; prefijo_preferido: string; max_candidatos: number };
  config_reintentos: {
    max_intentos: number;
    esperas_ms: number[];
    timeout_pedido_ms: number;
    timeout_consulta_ms: number;
  };
  config_validacion: { umbral_caida: number; piso_registros: number };
}

/** Configuración real de ecogas, leída de `database/seed/fuentes.json`. */
function configEcogas(): ConfigLectura {
  const ruta = new URL("../../../../database/seed/fuentes.json", import.meta.url);
  const fuentes = JSON.parse(readFileSync(ruta, "utf8")) as FuenteSeed[];
  const ecogas = fuentes.find((f) => f.fuente_id === "ecogas");
  if (!ecogas) throw new Error("El seed no tiene la Fuente ecogas.");
  const { config_extraccion: e, config_reintentos: r, config_validacion: v } = ecogas;
  return {
    urlPagina: ecogas.url_pagina,
    marcadorV2: e.marcador_v2,
    prefijoPreferido: e.prefijo_preferido,
    maxCandidatos: e.max_candidatos,
    reintentos: {
      maxIntentos: r.max_intentos,
      esperasMs: r.esperas_ms,
      timeoutPedidoMs: r.timeout_pedido_ms,
      timeoutConsultaMs: r.timeout_consulta_ms,
    },
    validacion: { umbralCaida: v.umbral_caida, pisoRegistros: v.piso_registros },
  };
}

async function leerRegistros(): Promise<{ formato: string; registros: readonly RegistroLeido[] }> {
  const local = process.env.ECOGAS_PAGINA;
  if (local) {
    const extraccion = extraerDePagina(readFileSync(local, "utf8"));
    if (!extraccion.ok) throw new Error(`${extraccion.validacion}: ${extraccion.detalle}`);
    return extraccion;
  }
  const contacto = process.env.MATRICULAR_CONTACTO;
  if (!contacto) throw new Error("Definí MATRICULAR_CONTACTO o ECOGAS_PAGINA.");
  const lector = new LectorEcogas(
    new ClienteFetch(),
    relojSistema,
    `MatriculAR/0.1 (proyecto final UTN; contacto: ${contacto})`,
  );
  const lectura = await lector.leer(configEcogas(), { cantidadAnterior: null });
  console.info({
    intentos: lectura.intentos.map((i) => i.pedidos.map((p) => [p.estadoHttp ?? p.error, p.ms])),
  });
  if (!lectura.ok) throw new Error(`${lectura.motivo}: ${lectura.detalle}`);
  return lectura;
}

describe("Ecogas real", () => {
  it("la página actual se extrae completa y pasa las validaciones", {
    timeout: 60_000,
  }, async () => {
    const { formato, registros } = await leerRegistros();

    const porCategoria = Object.groupBy(registros, (r) => r.registro.categoria);
    const porProvincia = Object.groupBy(registros, (r) => r.registro.provincia);
    console.info({
      formato,
      registros: registros.length,
      porCategoria: Object.fromEntries(
        Object.entries(porCategoria).map(([k, v]) => [k, v?.length]),
      ),
      porProvincia: Object.fromEntries(
        Object.entries(porProvincia).map(([k, v]) => [k, v?.length]),
      ),
    });
    expect(
      validarCantidad(registros.length, null, { umbralCaida: 0.5, pisoRegistros: 1000 }),
    ).toBeNull();
  });
});
