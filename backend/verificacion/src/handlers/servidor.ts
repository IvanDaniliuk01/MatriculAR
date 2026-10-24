import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { EcogasRecursoNext, type Descargar } from "../../../compartido/src/adaptadores/fuentes/ecogas";
import { NoAutomatizable } from "../../../compartido/src/adaptadores/fuentes/no-automatizable";
import { catalogoDesdeSeed } from "../../../compartido/src/adaptadores/memoria/catalogo";
import { GeneradorIds, RepositorioEnMemoria } from "../../../compartido/src/adaptadores/memoria/repositorios";
import { construirRespuesta } from "../../../compartido/src/aplicacion/respuesta";
import { type DependenciasVerificar, verificar } from "../../../compartido/src/aplicacion/verificar";
import { ErrorDePedido } from "../../../compartido/src/dominio/errores";
import { PedidoVerificacionSchema } from "../../../compartido/src/esquemas/pedido";
import { relojReal } from "../../../compartido/src/puertos/fuentes";
import type { Catalogo, RepositorioEvidencia } from "../../../compartido/src/puertos/repositorios";

const MAX_CUERPO = 4 * 1024;

function json(res: ServerResponse, status: number, cuerpo: unknown, cors?: string) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(cors ? { "access-control-allow-origin": cors, vary: "Origin" } : {}),
  });
  res.end(texto);
}

async function leerCuerpo(req: IncomingMessage): Promise<string> {
  let total = 0;
  const trozos: Buffer[] = [];
  for await (const t of req) {
    total += (t as Buffer).length;
    if (total > MAX_CUERPO) throw new ErrorDePedido("MATRICULA_INVALIDA", "El cuerpo del pedido es demasiado grande.", 422);
    trozos.push(t as Buffer);
  }
  return Buffer.concat(trozos).toString("utf8");
}

export interface OpcionesApp {
  deps: DependenciasVerificar;
  /** Origen permitido por CORS (el frontend). */
  origenCors?: string;
}

/**
 * Handler HTTP mínimo del P0. Una Fuente que falla NO es un error HTTP:
 * POST /verificaciones responde 201 con resultado UNVERIFIABLE (docs/api.md).
 * 4xx = error del pedido; 5xx = falla propia de MatriculAR.
 */
export function crearManejador({ deps, origenCors }: OpcionesApp) {
  const { catalogo, repo } = deps;
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://local");
    const ruta = url.pathname.replace(/\/+$/, "") || "/";
    const out = (s: number, c: unknown) => json(res, s, c, origenCors);
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": origenCors ?? "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type",
        });
        return res.end();
      }
      if (req.method === "POST" && ruta === "/verificaciones") {
        let cuerpo: unknown;
        try {
          cuerpo = JSON.parse(await leerCuerpo(req));
        } catch (e) {
          if (e instanceof ErrorDePedido) return out(e.status, { error: e.codigo, mensaje: e.message });
          return out(400, { error: "JSON_INVALIDO", mensaje: "El cuerpo no es JSON válido." });
        }
        const p = PedidoVerificacionSchema.safeParse(cuerpo);
        if (!p.success) {
          return out(422, { error: "PEDIDO_INVALIDO", mensaje: "El pedido no es válido.", detalles: p.error.issues.map((i) => ({ campo: i.path.join("."), problema: i.message })) });
        }
        return out(201, await verificar(p.data, deps));
      }
      const mVer = /^\/verificaciones\/([^/]+)$/.exec(ruta);
      if (req.method === "GET" && mVer) {
        const v = await repo.verificacion(decodeURIComponent(mVer[1] as string));
        if (!v) return out(404, { error: "NO_ENCONTRADA", mensaje: "No existe esa Verificación." });
        const consulta = await repo.consulta(v.consulta_id);
        if (!consulta) return out(500, { error: "INCONSISTENTE", mensaje: "Falta la Consulta de la Verificación." });
        const credencial = v.credencial_ref ? ((await repo.credencial(v.credencial_ref)) ?? null) : null;
        const evaluacion = v.evaluacion_id ? ((await repo.evaluacion(v.evaluacion_id)) ?? null) : null;
        const previa = v.credencial_previa_ref ? ((await repo.credencial(v.credencial_previa_ref)) ?? null) : null;
        return out(200, construirRespuesta({ verificacion: v, consulta, credencial, evaluacion, credencialPrevia: previa }, catalogo));
      }
      const mCred = /^\/credenciales\/([^/]+)\/([^/]+)$/.exec(ruta);
      if (req.method === "GET" && mCred) {
        const fuenteId = decodeURIComponent(mCred[1] as string);
        const matricula = decodeURIComponent(mCred[2] as string);
        if (!catalogo.fuente(fuenteId)) return out(404, { error: "FUENTE_INEXISTENTE", mensaje: "No existe esa Fuente." });
        return out(200, await repo.historial(`${fuenteId}#${matricula}`));
      }
      const mCons = /^\/fuentes\/([^/]+)\/consultas$/.exec(ruta);
      if (req.method === "GET" && mCons) {
        const fuenteId = decodeURIComponent(mCons[1] as string);
        if (!catalogo.fuente(fuenteId)) return out(404, { error: "FUENTE_INEXISTENTE", mensaje: "No existe esa Fuente." });
        const consultas = await repo.consultasDeFuente(fuenteId, 20);
        return out(200, consultas.map(({ consulta_id, estado, motivo_falla, detalle_falla, iniciada_en, finalizada_en, registros_extraidos, huella_recurso, intentos }) => ({
          consulta_id, estado, motivo_falla, detalle_falla, iniciada_en, finalizada_en, registros_extraidos, huella_recurso, cantidad_intentos: intentos.length,
        })));
      }
      if (req.method === "GET" && ruta === "/fuentes")
        return out(200, catalogo.fuentes().map((f) => ({ fuente_id: f.fuente_id, nombre: f.nombre, modo_acceso: f.modo_acceso, area_concesion: f.area_concesion, area_concesion_parcial: f.area_concesion_parcial, url_buscador_oficial: f.url_buscador_oficial })));
      if (req.method === "GET" && ruta === "/tipos-trabajo")
        return out(200, catalogo.tiposTrabajo().map(({ tipo_trabajo_id, codigo, nombre, descripcion, condiciones, categorias_admitidas, fundamento, limitaciones }) => ({ tipo_trabajo_id, codigo, nombre, descripcion, condiciones, categorias_admitidas, fundamento, limitaciones })));
      if (req.method === "GET" && ruta === "/categorias") return out(200, catalogo.categorias());
      if (req.method === "GET" && ruta === "/provincias") return out(200, catalogo.provincias());
      return out(404, { error: "RUTA_INEXISTENTE", mensaje: "Ruta inexistente." });
    } catch (e) {
      if (e instanceof ErrorDePedido) return out(e.status, { error: e.codigo, mensaje: e.message });
      // Falla propia de MatriculAR (no de la Fuente): 500 sin detalles internos.
      console.error("Error interno:", e);
      return out(500, { error: "ERROR_INTERNO", mensaje: "Ocurrió un error interno. Intentá de nuevo." });
    }
  };
}

export function crearServidor(opciones: OpcionesApp): Server {
  return createServer((req, res) => void crearManejador(opciones)(req, res));
}

/** `fetch` real con límite de tiempo. */
export function descargarReal(userAgent: string): Descargar {
  return (url, { timeoutMs }) =>
    fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": userAgent, accept: "*/*" } });
}

export function dependenciasLocales(opts: { catalogo?: Catalogo; descargar: Descargar; repo?: RepositorioEvidencia }): DependenciasVerificar {
  const seed = fileURLToPath(new URL("../../../../database/seed", import.meta.url));
  const catalogo = opts.catalogo ?? catalogoDesdeSeed(seed);
  const ecogas = new EcogasRecursoNext(opts.descargar);
  return {
    catalogo,
    repo: opts.repo ?? new RepositorioEnMemoria(),
    reloj: relojReal,
    ids: new GeneradorIds(),
    adaptadorDe: (f) => (f.modo_acceso === "AUTOMATED" ? ecogas : new NoAutomatizable()),
  };
}

// Arranque: `npm run dev`. Consulta la Fuente REAL (con pedidos mínimos); no persiste en disco.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const puerto = Number(process.env.PORT ?? 3000);
  const ua = process.env.USER_AGENT ?? "MatriculAR/0.1 (proyecto academico UTN)";
  const servidor = crearServidor({
    deps: dependenciasLocales({ descargar: descargarReal(ua) }),
    origenCors: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  });
  servidor.listen(puerto, () => console.log(`MatriculAR (P0) escuchando en http://localhost:${puerto}`));
}
