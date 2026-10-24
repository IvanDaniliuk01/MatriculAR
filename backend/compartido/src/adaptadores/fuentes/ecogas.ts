import { createHash } from "node:crypto";
import { normalizarMatricula } from "../../dominio/matricula";
import type { Intento, MotivoFalla, PedidoHttp, Provincia, ResumenRecurso } from "../../dominio/tipos";
import {
  type Lectura,
  type MetadatosLectura,
  type PedidoLectura,
  type PuertoFuente,
  type RegistroNormalizado,
  type Reloj,
  relojReal,
} from "../../puertos/fuentes";

export type Descargar = (url: string, opciones: { timeoutMs: number }) => Promise<Response>;

/** Falla de una lectura: motivo, detalle, si conviene reintentar y qué validación falló. */
class FallaLectura extends Error {
  constructor(
    readonly motivo: Extract<MotivoFalla, "SOURCE_UNAVAILABLE" | "EXTRACTION_FAILED">,
    readonly detalle: string,
    readonly reintentable: boolean,
    readonly validacion?: "V1" | "V2" | "V3" | "V4" | "V5",
  ) {
    super(detalle);
  }
}

const MARCADOR = "JSON.parse('[{";

/** Recorta "ecogas.com.ar" de una URL absoluta o relativa contra la página. */
function resolver(base: string, ruta: string): string {
  return new URL(ruta, base).toString();
}

export function extraerCandidatos(html: string, base: string, prefijo: string, max: number): string[] {
  const vistos = new Set<string>();
  const re = /<script[^>]*\ssrc=["']([^"']*\/_next\/static\/chunks\/[^"']+\.js[^"']*)["']/gi;
  for (const m of html.matchAll(re)) {
    const src = m[1];
    if (src) vistos.add(resolver(base, src));
  }
  const todos = [...vistos];
  const nombre = (u: string) => u.split("/").pop() ?? "";
  const rango = (u: string) => (nombre(u).startsWith(prefijo) ? 0 : nombre(u).startsWith("page-") ? 1 : 2);
  // sort estable: conserva el orden original dentro de cada grupo
  return todos
    .map((u, i) => ({ u, i }))
    .sort((a, b) => rango(a.u) - rango(b.u) || a.i - b.i)
    .map((x) => x.u)
    .slice(0, max);
}

/**
 * Devuelve el literal (sin decodificar) entre `JSON.parse('` y su `')` de cierre, respetando
 * las comillas escapadas, o null si no está.
 */
function leerLiteral(js: string, desde: number): string | null {
  let i = desde;
  while (i < js.length) {
    const c = js[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "'") return js.slice(desde, i);
    i++;
  }
  return null;
}

/** Decodifica un literal de string de JavaScript (\xNN, \uNNNN, \\, \', \", \n…). */
export function decodificarLiteralJs(literal: string): string {
  let out = "";
  for (let i = 0; i < literal.length; i++) {
    const c = literal[i] as string;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = literal[++i];
    switch (n) {
      case "x": {
        const h = literal.slice(i + 1, i + 3);
        if (!/^[0-9a-fA-F]{2}$/.test(h)) throw new Error("escape \\x inválido");
        out += String.fromCharCode(Number.parseInt(h, 16));
        i += 2;
        break;
      }
      case "u": {
        const h = literal.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(h)) throw new Error("escape \\u inválido");
        out += String.fromCharCode(Number.parseInt(h, 16));
        i += 4;
        break;
      }
      case "n": out += "\n"; break;
      case "r": out += "\r"; break;
      case "t": out += "\t"; break;
      case "b": out += "\b"; break;
      case "f": out += "\f"; break;
      case "v": out += "\v"; break;
      case "0": out += "\0"; break;
      case undefined: throw new Error("escape incompleto al final del literal");
      default: out += n; // \\ \' \" \/ y cualquier otro carácter escapado
    }
  }
  return out;
}

interface ExtraccionBruta {
  registros: Record<string, unknown>[];
}

/** V2 + V3: ubica el marcador de la lista y parsea la lista COMPLETA de una vez. */
export function extraerLista(js: string): ExtraccionBruta {
  let desde = 0;
  let hayMarcador = false;
  for (;;) {
    const pos = js.indexOf(MARCADOR, desde);
    if (pos === -1) break;
    const inicioLiteral = pos + "JSON.parse('".length;
    const literal = leerLiteral(js, inicioLiteral);
    desde = pos + MARCADOR.length;
    // El archivo de la página define columnas pero no contiene la lista de registros.
    if (literal === null || !literal.includes('"nombre_apellido"') || !literal.includes('"id"')) continue;
    hayMarcador = true;
    let lista: unknown;
    try {
      lista = JSON.parse(decodificarLiteralJs(literal));
    } catch (e) {
      throw new FallaLectura(
        "EXTRACTION_FAILED",
        `V3: no se pudo decodificar y parsear la lista completa (${(e as Error).message}).`,
        false,
        "V3",
      );
    }
    if (!Array.isArray(lista)) {
      throw new FallaLectura("EXTRACTION_FAILED", "V3: el literal no es una lista.", false, "V3");
    }
    return { registros: lista as Record<string, unknown>[] };
  }
  void hayMarcador;
  throw new FallaLectura("EXTRACTION_FAILED", "V2: no se encontró la lista de registros.", false, "V2");
}

export function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function codigoProvincia(texto: string, provincias: Provincia[]): string {
  const base = sinTildes(texto).toUpperCase().replace(/\s+/g, " ").trim();
  const clave = base.replace(/ /g, "_");
  for (const p of provincias) {
    if (p.codigo === clave) return p.codigo;
    if (p.alias.some((a) => sinTildes(a).toUpperCase().replace(/\s+/g, " ").trim() === base)) return p.codigo;
    if (sinTildes(p.nombre).toUpperCase() === base) return p.codigo;
  }
  return clave; // no está en el catálogo: se conserva normalizada
}

/** V4: más de 0 registros, claves obligatorias, ids únicos y no vacíos. */
function validarRegistros(
  registros: Record<string, unknown>[],
  obligatorias: string[],
  conocidas: string[],
): string[] {
  if (registros.length === 0) {
    throw new FallaLectura("EXTRACTION_FAILED", "V4: la lista no tiene registros.", false, "V4");
  }
  const ids = new Set<string>();
  const esperadas = new Set([...obligatorias, ...conocidas]);
  const noEsperadas = new Set<string>();
  registros.forEach((r, idx) => {
    if (r === null || typeof r !== "object") {
      throw new FallaLectura("EXTRACTION_FAILED", `V4: el registro ${idx} no es un objeto.`, false, "V4");
    }
    for (const k of obligatorias) {
      if (!(k in r) || typeof r[k] !== "string") {
        throw new FallaLectura(
          "EXTRACTION_FAILED",
          `V4: al registro ${idx} le falta la clave obligatoria "${k}" (¿cambió la estructura?).`,
          false,
          "V4",
        );
      }
    }
    const id = String(r.id).trim();
    if (id === "" || ids.has(id)) {
      throw new FallaLectura(
        "EXTRACTION_FAILED",
        `V4: id vacío o repetido en el registro ${idx}.`,
        false,
        "V4",
      );
    }
    ids.add(id);
    for (const k of Object.keys(r)) if (!esperadas.has(k)) noEsperadas.add(k);
  });
  return [...noEsperadas].sort();
}

function normalizar(r: Record<string, unknown>, provincias: Provincia[]): RegistroNormalizado {
  const texto = (k: string) => String(r[k] ?? "");
  const colapsar = (s: string) => s.replace(/\s+/g, " ").trim();
  return {
    matricula: normalizarMatricula(texto("id")),
    nombre_informado: colapsar(texto("nombre_apellido")).toUpperCase(),
    categoria_informada: texto("categoria").trim(),
    provincia_informada: codigoProvincia(texto("provincia"), provincias),
    localidad_informada: colapsar(texto("localidad")).toUpperCase(),
    // correo_electronico, telefono y barrio se descartan acá (INV-9).
  };
}

function resumir(registros: RegistroNormalizado[]): ResumenRecurso {
  const por_categoria: Record<string, number> = {};
  const por_provincia: Record<string, number> = {};
  for (const r of registros) {
    por_categoria[r.categoria_informada] = (por_categoria[r.categoria_informada] ?? 0) + 1;
    por_provincia[r.provincia_informada] = (por_provincia[r.provincia_informada] ?? 0) + 1;
  }
  return { por_categoria, por_provincia };
}

/** Adaptador de Ecogas: página HTML → archivo JavaScript de Next.js → lista JSON embebida. */
export class EcogasRecursoNext implements PuertoFuente {
  constructor(
    private readonly descargar: Descargar,
    private readonly reloj: Reloj = relojReal,
  ) {}

  async leer(pedido: PedidoLectura): Promise<Lectura> {
    const { fuente } = pedido;
    const cfg = fuente.config_extraccion;
    const reint = fuente.config_reintentos;
    const val = fuente.config_validacion;
    if (!cfg || !reint || !val || !fuente.url_pagina) {
      throw new Error(`La Fuente ${fuente.fuente_id} no tiene configuración de extracción.`);
    }
    const inicio = this.reloj.ahora();
    const intentos: Intento[] = [];
    let ultima: FallaLectura | null = null;

    for (let n = 1; n <= reint.max_intentos; n++) {
      const restante = reint.timeout_consulta_ms - (this.reloj.ahora() - inicio);
      // Un Intento solo arranca si entra al menos un pedido completo en el presupuesto.
      if (restante < reint.timeout_pedido_ms) break;

      const t0 = this.reloj.ahora();
      const pedidos: PedidoHttp[] = [];
      try {
        const exito = await this.intentar(pedido, pedidos, inicio);
        intentos.push({
          numero: n,
          iniciado_en: new Date(t0).toISOString(),
          duracion_ms: this.reloj.ahora() - t0,
          resultado: "SUCCESS",
          reintentable: false,
          pedidos,
        });
        return { tipo: "EXITOSA", ...exito, intentos };
      } catch (e) {
        const falla =
          e instanceof FallaLectura
            ? e
            : new FallaLectura("SOURCE_UNAVAILABLE", `Error inesperado: ${(e as Error).message}`, true);
        ultima = falla;
        const hayOtro = n < reint.max_intentos;
        intentos.push({
          numero: n,
          iniciado_en: new Date(t0).toISOString(),
          duracion_ms: this.reloj.ahora() - t0,
          resultado: falla.motivo,
          reintentable: falla.reintentable && hayOtro,
          pedidos,
        });
        if (!falla.reintentable || !hayOtro) break;
        const espera = reint.esperas_ms[n - 1] ?? 0;
        const queda = reint.timeout_consulta_ms - (this.reloj.ahora() - inicio);
        if (queda - espera < reint.timeout_pedido_ms) break;
        await this.reloj.esperar(espera);
      }
    }

    if (ultima === null) {
      return {
        tipo: "FALLIDA",
        motivo: "SOURCE_UNAVAILABLE",
        detalle: "Se agotó el tiempo total de la Consulta antes de poder intentar la lectura.",
        intentos,
      };
    }
    return { tipo: "FALLIDA", motivo: ultima.motivo, detalle: ultima.detalle, intentos };
  }

  /** Un pedido con límite de tiempo = min(timeout_pedido, tiempo que queda de la Consulta). */
  private async pedir(
    url: string,
    pedidos: PedidoHttp[],
    pedido: PedidoLectura,
    inicioConsulta: number,
  ): Promise<{ res: Response; cuerpo: Buffer; contentType: string }> {
    const reint = pedido.fuente.config_reintentos as NonNullable<typeof pedido.fuente.config_reintentos>;
    const restante = reint.timeout_consulta_ms - (this.reloj.ahora() - inicioConsulta);
    const timeoutMs = Math.max(1, Math.min(reint.timeout_pedido_ms, restante));
    const t0 = this.reloj.ahora();
    const registro: PedidoHttp = {
      url,
      metodo: "GET",
      status: null,
      content_type: null,
      bytes: null,
      duracion_ms: 0,
      error: null,
    };
    pedidos.push(registro);
    try {
      const res = await this.descargar(url, { timeoutMs });
      const contentType = res.headers.get("content-type") ?? "";
      const cuerpo = Buffer.from(await res.arrayBuffer());
      Object.assign(registro, {
        status: res.status,
        content_type: contentType,
        bytes: cuerpo.length,
        duracion_ms: this.reloj.ahora() - t0,
      });
      return { res, cuerpo, contentType };
    } catch (e) {
      const nombre = (e as Error).name;
      registro.duracion_ms = this.reloj.ahora() - t0;
      registro.error = nombre === "TimeoutError" || nombre === "AbortError" ? "TIMEOUT" : `RED: ${(e as Error).message}`;
      throw new FallaLectura("SOURCE_UNAVAILABLE", `No se pudo obtener ${url}: ${registro.error}.`, true);
    }
  }

  /** Cada pedido HTTP traduce su código de estado a una falla clasificada (docs § 4.5). */
  private clasificarEstado(status: number, url: string, esPagina: boolean): FallaLectura | null {
    if (status === 429 || status >= 500)
      return new FallaLectura("SOURCE_UNAVAILABLE", `HTTP ${status} en ${url}.`, true);
    if (status === 403)
      return new FallaLectura("SOURCE_UNAVAILABLE", `HTTP 403 en ${url} (posible bloqueo): no se reintenta.`, false);
    if (esPagina && status !== 200)
      return new FallaLectura(
        "EXTRACTION_FAILED",
        `La página del listado respondió HTTP ${status}: cambió de dirección o de formato.`,
        false,
        "V1",
      );
    return null;
  }

  private async intentar(
    pedido: PedidoLectura,
    pedidos: PedidoHttp[],
    inicioConsulta: number,
  ): Promise<{ resultados: Map<string, RegistroNormalizado | null>; metadatos: MetadatosLectura }> {
    const { fuente } = pedido;
    const cfg = fuente.config_extraccion as NonNullable<typeof fuente.config_extraccion>;
    const val = fuente.config_validacion as NonNullable<typeof fuente.config_validacion>;
    const urlPagina = fuente.url_pagina as string;

    // 1. Página del listado.
    const pag = await this.pedir(urlPagina, pedidos, pedido, inicioConsulta);
    const fallaPag = this.clasificarEstado(pag.res.status, urlPagina, true);
    if (fallaPag) throw fallaPag;
    if (!/text\/html/i.test(pag.contentType)) {
      throw new FallaLectura(
        "EXTRACTION_FAILED",
        `V1: la página del listado no devolvió HTML (content-type: ${pag.contentType || "vacío"}).`,
        false,
        "V1",
      );
    }
    const candidatos = extraerCandidatos(pag.cuerpo.toString("utf8"), urlPagina, cfg.prefijo_preferido, cfg.max_candidatos);
    if (candidatos.length === 0) {
      throw new FallaLectura("EXTRACTION_FAILED", "La página no referencia archivos JavaScript del sitio.", false, "V2");
    }

    // 2. Candidatos: se prueba cada uno hasta que uno pase V1 y V2.
    let encontrado: { url: string; cuerpo: Buffer; lista: ExtraccionBruta } | null = null;
    const descartados: string[] = [];
    for (const url of candidatos) {
      const c = await this.pedir(url, pedidos, pedido, inicioConsulta);
      const falla = this.clasificarEstado(c.res.status, url, false);
      if (falla) throw falla;
      if (c.res.status !== 200 || !/javascript/i.test(c.contentType)) {
        descartados.push(`V1: ${url.split("/").pop()} no es JavaScript (HTTP ${c.res.status}, ${c.contentType || "sin content-type"})`);
        continue;
      }
      try {
        const lista = extraerLista(c.cuerpo.toString("utf8"));
        encontrado = { url, cuerpo: c.cuerpo, lista };
        break;
      } catch (e) {
        if (e instanceof FallaLectura && e.validacion === "V2") {
          descartados.push(`V2: ${url.split("/").pop()} no contiene la lista`);
          continue;
        }
        throw e; // V3 u otro: el recurso correcto estaba, pero no se pudo leer
      }
    }
    if (!encontrado) {
      throw new FallaLectura(
        "EXTRACTION_FAILED",
        `V2: ningún archivo candidato (${candidatos.length}) contiene la lista de registros. Descartados: ${descartados.join("; ")}.`,
        false,
        "V2",
      );
    }

    // 3. V4 y V5.
    const noEsperadas = validarRegistros(encontrado.lista.registros, cfg.claves_obligatorias, cfg.claves_conocidas);
    const cantidad = encontrado.lista.registros.length;
    if (cantidad < val.piso_registros) {
      throw new FallaLectura(
        "EXTRACTION_FAILED",
        `V5: ${cantidad} registros, por debajo del piso de ${val.piso_registros}.`,
        false,
        "V5",
      );
    }
    const previos = pedido.registros_ultima_consulta_exitosa;
    if (previos !== null && cantidad < previos * (1 - val.umbral_caida)) {
      throw new FallaLectura(
        "EXTRACTION_FAILED",
        `V5: caída brusca de registros (${previos} → ${cantidad}, más del ${Math.round(val.umbral_caida * 100)} %).`,
        false,
        "V5",
      );
    }

    // 4. Normalizar, indexar y buscar.
    const normalizados = encontrado.lista.registros.map((r) => normalizar(r, pedido.provincias));
    const indice = new Map(normalizados.map((r) => [r.matricula, r] as const));
    const resultados = new Map<string, RegistroNormalizado | null>();
    for (const m of pedido.matriculas) resultados.set(m, indice.get(normalizarMatricula(m)) ?? null);

    return {
      resultados,
      metadatos: {
        url_recurso: encontrado.url,
        huella_recurso: createHash("sha256").update(encontrado.cuerpo).digest("hex"),
        bytes_recurso: encontrado.cuerpo.length,
        registros_extraidos: cantidad,
        resumen: resumir(normalizados),
        claves_no_esperadas: noEsperadas,
      },
    };
  }
}
