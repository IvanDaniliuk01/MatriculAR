import type { Descargar } from "../../../src/adaptadores/fuentes/ecogas";

/**
 * Fabrica un "padrón de Ecogas" 100 % FICTICIO con la misma forma que el recurso real
 * (docs/fuentes-y-adaptadores.md § 4.1): un módulo de webpack con JSON.parse('[{"id":…}]').
 * Los nombres, emails y teléfonos son inventados; sirven para probar que el adaptador los descarta.
 */

export interface RegistroFalso {
  id: string;
  nombre_apellido: string;
  categoria: string;
  provincia: string;
  localidad: string;
  barrio: string;
  correo_electronico: string;
  telefono: string;
  [extra: string]: string;
}

/** Los escenarios del modelo de dominio (S1–S6) más relleno hasta llegar al piso de 1.000. */
export function registrosFalsos(total = 1500): RegistroFalso[] {
  const base: RegistroFalso[] = [
    reg("99001", "PERSONA FICTICIA UNO", "2", "CORDOBA", "CORDOBA"),
    reg("99002", "PERSONA FICTICIA DOS", "1", "MENDOZA", "GODOY CRUZ"),
    reg("99003", "PERSONA FICTICIA TRES", "3", "CORDOBA", "VILLA MARÍA"),
    // Acentos, Ñ, apóstrofo y barra invertida: lo que rompe al parsear fragmento por fragmento.
    reg("99005", "MUÑOZ, JOSÉ D'ANGELO", "2", "SAN LUIS", "VILLA MERCEDES"),
    reg("99006", "NÚÑEZ \\ ÑANDÚ", "1", "SAN JUAN", "RIVADAVIA"),
    reg("99007", "PERSONA FICTICIA SIETE", "9", "CORDOBA", "CORDOBA"), // categoría fuera del catálogo
  ];
  const relleno: RegistroFalso[] = [];
  const provs = ["CORDOBA", "MENDOZA", "SAN LUIS", "SAN JUAN", "CATAMARCA", "LA RIOJA"];
  for (let i = 0; relleno.length + base.length < total; i++) {
    relleno.push(
      reg(String(1000 + i), `PERSONA FICTICIA ${1000 + i}`, String((i % 3) + 1), provs[i % provs.length] as string, "LOCALIDAD FICTICIA"),
    );
  }
  return [...base, ...relleno]; // la matrícula 99004 NO figura (escenario NOT_FOUND)
}

function reg(id: string, nombre: string, categoria: string, provincia: string, localidad: string): RegistroFalso {
  return {
    id,
    nombre_apellido: nombre,
    categoria,
    provincia,
    localidad,
    barrio: "BARRIO FICTICIO",
    correo_electronico: `ficticio${id}@ejemplo.invalid`,
    telefono: `000-${id}`,
  };
}

/** Codifica un string como literal de JS entre comillas simples, con escapes \xNN / \uNNNN como Next.js. */
export function aLiteralJs(texto: string): string {
  let out = "";
  for (const ch of texto) {
    const cp = ch.codePointAt(0) as number;
    if (ch === "\\") out += "\\\\";
    else if (ch === "'") out += "\\'";
    else if (cp < 0x80) out += ch;
    else if (cp <= 0xff) out += `\\x${cp.toString(16).padStart(2, "0")}`;
    else if (cp <= 0xffff) out += `\\u${cp.toString(16).padStart(4, "0")}`;
    else {
      const s = ch.split("").map((u) => `\\u${u.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
      out += s;
    }
  }
  return out;
}

export function recursoPadron(registros: unknown[], opciones: { prefijoRelleno?: number } = {}): string {
  const literal = aLiteralJs(JSON.stringify(registros));
  const relleno = "/*".concat("x".repeat(opciones.prefijoRelleno ?? 200), "*/");
  return `${relleno}(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[3182],{4891:function(e){"use strict";e.exports=JSON.parse('${literal}')}}]);`;
}

/** El archivo de la página define las columnas de la tabla: contiene "nombre_apellido" pero NO la lista. */
export function recursoPagina(): string {
  return `(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[931],{1:function(e,t,n){var c=[{accessorKey:"nombre_apellido",header:"Nombre"},{accessorKey:"categoria",header:"Categoría"}];t.default=c}}]);`;
}

export const URL_PAGINA = "https://www.ecogas.test/listado-de-gasistas-matriculados";
export const URL_RECURSO = "https://www.ecogas.test/_next/static/chunks/3182-5194f519f6f9f5b0.js";
export const URL_PAGE_JS = "https://www.ecogas.test/_next/static/chunks/app/page-aa11bb22cc33dd44.js";

export function htmlListado(scripts: string[]): string {
  const tags = scripts.map((s) => `<script src="${s}" async=""></script>`).join("");
  return `<!DOCTYPE html><html lang="es"><head><title>Listado</title></head><body><div id="root"></div>${tags}</body></html>`;
}

export interface RespuestaFalsa {
  status?: number;
  contentType?: string;
  body?: string | Buffer;
  /** Simula una caída de red. */
  errorRed?: string;
  /** Simula que el pedido tarda más que el límite. */
  excedeTimeout?: boolean;
  /** Cuánto "tarda" el pedido en el reloj falso. */
  tardaMs?: number;
}

export class RelojFalso {
  constructor(public t = Date.parse("2026-10-24T15:00:00.000Z")) {}
  ahora = () => this.t;
  esperar = async (ms: number) => {
    this.t += ms;
  };
  avanzar(ms: number) {
    this.t += ms;
  }
}

export type Guion = (url: string, intento: number) => RespuestaFalsa;

/** Un `Descargar` en memoria: no hace ningún pedido real. Cuenta pedidos por URL. */
export function descargarFalso(guion: Guion, reloj?: RelojFalso): { descargar: Descargar; pedidos: string[] } {
  const pedidos: string[] = [];
  const porUrl = new Map<string, number>();
  const descargar: Descargar = async (url) => {
    pedidos.push(url);
    const n = (porUrl.get(url) ?? 0) + 1;
    porUrl.set(url, n);
    const r = guion(url, n);
    reloj?.avanzar(r.tardaMs ?? 0);
    if (r.errorRed) throw new Error(r.errorRed);
    if (r.excedeTimeout) {
      const e = new Error("timeout");
      e.name = "TimeoutError";
      throw e;
    }
    return new Response(r.body ?? "", {
      status: r.status ?? 200,
      headers: r.contentType ? { "content-type": r.contentType } : {},
    });
  };
  return { descargar, pedidos };
}

/** El guion del caso feliz: página + archivo del padrón + archivo de la página. */
export function guionNormal(registros: unknown[] = registrosFalsos()): Guion {
  const padron = recursoPadron(registros);
  return (url) => {
    if (url === URL_PAGINA)
      return { contentType: "text/html; charset=utf-8", body: htmlListado([URL_PAGE_JS, URL_RECURSO]) };
    if (url === URL_RECURSO) return { contentType: "application/javascript; charset=UTF-8", body: padron };
    if (url === URL_PAGE_JS) return { contentType: "application/javascript", body: recursoPagina() };
    return { status: 404, contentType: "text/html", body: "<html>no existe</html>" };
  };
}
