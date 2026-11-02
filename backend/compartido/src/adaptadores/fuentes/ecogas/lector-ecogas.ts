import { createHash } from "node:crypto";
import type { Intento, MotivoFalla, PedidoHttp, RegistroLeido } from "../../../dominio/consulta";
import type { ClienteHttp, Reloj, RespuestaHttp } from "../../../puertos/infraestructura";
import type {
  ConfigLectura,
  LectorDeFuente,
  ResultadoLectura,
} from "../../../puertos/lector-fuente";
import { extraerDeChunk, extraerDePagina, validarCantidad } from "./extraccion";

/**
 * Lector de Ecogas: cada Intento pide la página, reconoce el formato (v2 en la página o v1 en un
 * chunk descubierto desde el HTML), valida y calcula la huella. Solo las fallas transitorias se
 * reintentan (docs/fuentes-y-adaptadores.md §4.3 y §4.7).
 */

type MotivoLectura = Extract<MotivoFalla, "SOURCE_UNAVAILABLE" | "EXTRACTION_FAILED">;

interface Falla {
  motivo: MotivoLectura;
  detalle: string;
  reintentable: boolean;
}

interface Datos {
  formato: "v1" | "v2";
  contenido: string;
  url: string;
  registros: readonly RegistroLeido[];
  clavesNoEsperadas: readonly string[];
}

const CHUNKS = /\/_next\/static\/chunks\/[^"'\s<>]+\.js/g;

export class LectorEcogas implements LectorDeFuente {
  constructor(
    private readonly http: ClienteHttp,
    private readonly reloj: Reloj,
    private readonly userAgent: string,
  ) {}

  async leer(
    config: ConfigLectura,
    contexto: { cantidadAnterior: number | null },
  ): Promise<ResultadoLectura> {
    const { maxIntentos, esperasMs, timeoutPedidoMs, timeoutConsultaMs } = config.reintentos;
    const inicio = this.reloj.ahora().getTime();
    const restante = () => timeoutConsultaMs - (this.reloj.ahora().getTime() - inicio);
    const intentos: Intento[] = [];
    let ultima: Falla | null = null;

    for (let numero = 1; numero <= maxIntentos; numero++) {
      const espera = numero === 1 ? 0 : (esperasMs[numero - 2] ?? esperasMs.at(-1) ?? 0);
      // Un Intento solo arranca si queda presupuesto para un pedido completo.
      if (restante() - espera < timeoutPedidoMs) {
        return fallida(
          "SOURCE_UNAVAILABLE",
          `Se agotó el tiempo de la Consulta (${timeoutConsultaMs} ms) después de ${intentos.length} Intentos. Última falla: ${ultima?.detalle ?? "ninguna"}`,
          intentos,
        );
      }
      if (espera > 0) await this.reloj.esperar(espera);

      const { intento, resultado } = await this.intentar(numero, config, contexto, restante);
      intentos.push(intento);
      if (!("motivo" in resultado)) {
        return {
          ok: true,
          intentos,
          huella: createHash("sha256").update(resultado.contenido).digest("hex"),
          formato: resultado.formato,
          urlResuelta: resultado.url,
          registros: resultado.registros,
          clavesNoEsperadas: resultado.clavesNoEsperadas,
        };
      }
      ultima = resultado;
      if (!resultado.reintentable) return fallida(resultado.motivo, resultado.detalle, intentos);
    }

    return fallida(
      ultima?.motivo ?? "SOURCE_UNAVAILABLE",
      `${ultima?.detalle ?? "Sin Intentos"} (después de ${intentos.length} Intentos)`,
      intentos,
    );
  }

  private async intentar(
    numero: number,
    config: ConfigLectura,
    contexto: { cantidadAnterior: number | null },
    restante: () => number,
  ): Promise<{ intento: Intento; resultado: Datos | Falla }> {
    const iniciadoEn = this.reloj.ahora().toISOString();
    const pedidos: PedidoHttp[] = [];
    const pedir = async (url: string) => {
      const timeoutMs = Math.max(0, Math.min(config.reintentos.timeoutPedidoMs, restante()));
      const respuesta = await this.http.obtener(url, { userAgent: this.userAgent, timeoutMs });
      pedidos.push(
        respuesta.ok
          ? {
              url,
              estadoHttp: respuesta.estado,
              bytes: Buffer.byteLength(respuesta.cuerpo),
              ms: respuesta.ms,
            }
          : { url, estadoHttp: null, bytes: 0, ms: respuesta.ms, error: respuesta.error },
      );
      return respuesta;
    };

    const resultado = await this.leerRecurso(config, contexto, pedir);
    return {
      intento: {
        numero,
        iniciadoEn,
        finalizadoEn: this.reloj.ahora().toISOString(),
        pedidos,
        error: "motivo" in resultado ? resultado.detalle : undefined,
      },
      resultado,
    };
  }

  private async leerRecurso(
    config: ConfigLectura,
    contexto: { cantidadAnterior: number | null },
    pedir: (url: string) => Promise<RespuestaHttp>,
  ): Promise<Datos | Falla> {
    const pagina = await pedir(config.urlPagina);
    const fallaHttp = clasificar(pagina, "la página del listado");
    if (fallaHttp) return fallaHttp;
    if (!pagina.ok) return transitoria("Respuesta inválida de la página del listado.");
    if (!/html/i.test(pagina.tipoContenido) || pagina.cuerpo.length === 0) {
      return estructural(`V1: la página no es HTML (${pagina.tipoContenido || "sin tipo"}).`);
    }

    const v2 = extraerDePagina(pagina.cuerpo);
    // Con el marcador presente pero ilegible es un cambio de estructura: no se prueba el formato v1.
    if (!v2.ok && v2.validacion !== "V2") {
      return estructural(`Formato v2, ${v2.validacion}: ${v2.detalle}`);
    }
    const datos = v2.ok
      ? datosDe("v2", pagina.cuerpo, config.urlPagina, v2)
      : await this.buscarEnChunks(config, pagina.cuerpo, pedir);
    if ("motivo" in datos) return datos;

    if (datos.registros.length === 0) return estructural("V4: el recurso no trae registros.");
    const caida = validarCantidad(
      datos.registros.length,
      contexto.cantidadAnterior,
      config.validacion,
    );
    if (caida) return estructural(`V5: ${caida}`);
    return datos;
  }

  /** Formato v1: el recurso se descubre desde el HTML, así un cambio de nombre no lo rompe. */
  private async buscarEnChunks(
    config: ConfigLectura,
    html: string,
    pedir: (url: string) => Promise<RespuestaHttp>,
  ): Promise<Datos | Falla> {
    const candidatos = candidatosV1(html, config.prefijoPreferido, config.maxCandidatos);
    for (const ruta of candidatos) {
      const url = new URL(ruta, config.urlPagina).href;
      const respuesta = await pedir(url);
      if (!respuesta.ok) {
        return transitoria(`Falla de red al pedir un candidato (${respuesta.error}).`);
      }
      if (respuesta.estado === 429 || respuesta.estado >= 500) {
        return transitoria(`HTTP ${respuesta.estado} al pedir un candidato.`);
      }
      if (respuesta.estado !== 200) continue;
      const v1 = extraerDeChunk(respuesta.cuerpo);
      if (v1.ok) return datosDe("v1", respuesta.cuerpo, url, v1);
      if (v1.validacion !== "V2") return estructural(`Formato v1, ${v1.validacion}: ${v1.detalle}`);
    }
    return estructural(
      `Formato desconocido: la página no contiene "${config.marcadorV2}" y ninguno de los ${candidatos.length} chunks candidatos trae el padrón.`,
    );
  }
}

function datosDe(
  formato: Datos["formato"],
  contenido: string,
  url: string,
  extraccion: Pick<Datos, "registros" | "clavesNoEsperadas">,
): Datos {
  const { registros, clavesNoEsperadas } = extraccion;
  return { formato, contenido, url, registros, clavesNoEsperadas };
}

/** Candidatos del formato v1: sin duplicados, primero los del prefijo preferido. */
export function candidatosV1(html: string, prefijo: string, maximo: number): string[] {
  const unicos = [...new Set(html.match(CHUNKS) ?? [])];
  const preferido = (ruta: string) => ruta.split("/").at(-1)?.startsWith(prefijo) ?? false;
  return [...unicos.filter(preferido), ...unicos.filter((r) => !preferido(r))].slice(0, maximo);
}

/** Clasifica la respuesta de la página según la tabla de fallas (§4.7). Null si es 200. */
function clasificar(respuesta: RespuestaHttp, que: string): Falla | null {
  if (!respuesta.ok) {
    return respuesta.error === "TIMEOUT"
      ? transitoria(`Tiempo agotado al pedir ${que} (${respuesta.ms} ms).`)
      : transitoria(`Falla de red al pedir ${que}: ${respuesta.detalle}`);
  }
  const { estado } = respuesta;
  if (estado === 200) return null;
  if (estado === 429 || estado >= 500) return transitoria(`HTTP ${estado} al pedir ${que}.`);
  if (estado === 403) {
    return {
      motivo: "SOURCE_UNAVAILABLE",
      detalle: `HTTP 403 al pedir ${que}: la Fuente rechazó el pedido (puede bloquear IPs de nube). No se reintenta.`,
      reintentable: false,
    };
  }
  if (estado === 404 || estado === 410) {
    return estructural(`HTTP ${estado} al pedir ${que}: cambió de dirección.`);
  }
  return {
    motivo: "SOURCE_UNAVAILABLE",
    detalle: `HTTP ${estado} inesperado al pedir ${que}.`,
    reintentable: false,
  };
}

function transitoria(detalle: string): Falla {
  return { motivo: "SOURCE_UNAVAILABLE", detalle, reintentable: true };
}

function estructural(detalle: string): Falla {
  return { motivo: "EXTRACTION_FAILED", detalle, reintentable: false };
}

function fallida(motivo: MotivoLectura, detalle: string, intentos: Intento[]): ResultadoLectura {
  return { ok: false, motivo, detalle, intentos };
}
