/**
 * Demo del recorrido completo SIN tocar el sitio real de Ecogas.
 * Levanta un "Ecogas ficticio" local (datos 100 % inventados), el servidor de MatriculAR apuntando a él,
 * y recorre los casos: compatible, incompatible, no figura, y tres formas de falla de la Fuente.
 *
 *   npm run demo              recorre los casos y termina
 *   npm run demo -- --servir  además deja los dos servidores levantados (MatriculAR en :3000)
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { catalogoDesdeSeed } from "../../../compartido/src/adaptadores/memoria/catalogo";
import type { Fuente } from "../../../compartido/src/dominio/tipos";
import {
  htmlListado, recursoPadron, recursoPagina, registrosFalsos,
} from "../../../compartido/test/adaptadores/fixtures/fabricar";
import { crearServidor, dependenciasLocales, descargarReal } from "./servidor";

type Modo = "normal" | "url-cambiada" | "estructura-cambiada" | "caido" | "vacio";
let modo: Modo = "normal";

const normales = registrosFalsos();
const rotos = normales.map(({ categoria, ...r }) => ({ ...r, categoria_matricula: categoria }));

const ecogasFalso = createServer((req, res) => {
  const ruta = req.url ?? "/";
  const js = (body: string) => { res.writeHead(200, { "content-type": "application/javascript; charset=UTF-8" }); res.end(body); };
  if (modo === "caido") { res.writeHead(503); return res.end("mantenimiento"); }
  if (ruta === "/listado") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(htmlListado(["/_next/static/chunks/app/page-aa11.js", "/_next/static/chunks/3182-5194.js"]));
  }
  if (ruta.includes("page-aa11")) return js(recursoPagina());
  if (ruta.includes("3182-5194")) {
    if (modo === "url-cambiada") { res.writeHead(404, { "content-type": "text/html" }); return res.end("<html>404</html>"); }
    return js(recursoPadron(modo === "estructura-cambiada" ? rotos : modo === "vacio" ? [] : normales));
  }
  res.writeHead(404, { "content-type": "text/html" });
  res.end("<html>404</html>");
});

const servir = process.argv.includes("--servir");
await new Promise<void>((r) => ecogasFalso.listen(0, "127.0.0.1", r));
const urlEcogas = `http://127.0.0.1:${(ecogasFalso.address() as AddressInfo).port}/listado`;

const base = catalogoDesdeSeed(fileURLToPath(new URL("../../../../database/seed", import.meta.url)));
const catalogo = {
  ...base,
  fuente: (id: string) => {
    const f = base.fuente(id);
    // Misma Fuente, pero apuntando al Ecogas ficticio y con esperas cortas para que el demo sea ágil.
    return f?.fuente_id === "ecogas"
      ? ({ ...f, url_pagina: urlEcogas, config_reintentos: { ...f.config_reintentos!, esperas_ms: [50, 100] } } as Fuente)
      : f;
  },
};
const app = crearServidor({ deps: dependenciasLocales({ catalogo, descargar: descargarReal("MatriculAR-demo/0.1") }), origenCors: "http://localhost:5173" });
await new Promise<void>((r) => app.listen(servir ? 3000 : 0, "127.0.0.1", r));
const API = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;

async function caso(titulo: string, m: Modo, cuerpo: Record<string, string>) {
  modo = m;
  const r = await fetch(`${API}/verificaciones`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  const v: any = await r.json();
  console.log(`\n▶ ${titulo}   [HTTP ${r.status}]`);
  console.log(`  resultado:  ${v.resultado_verificacion}${v.evaluacion ? ` → ${v.evaluacion.resultado}` : ""}`);
  console.log(`  consulta:   ${v.consulta.estado}${v.consulta.motivo_falla ? ` (${v.consulta.motivo_falla})` : ""}, intentos: ${v.consulta.cantidad_intentos}, registros: ${v.consulta.registros_extraidos ?? "—"}`);
  if (v.consulta.detalle_falla) console.log(`  detalle:    ${v.consulta.detalle_falla}`);
  console.log(`  mensaje:    ${v.mensaje}`);
  if (v.evaluacion) console.log(`  limitaciones: ${v.evaluacion.limitaciones.length} (zona incluida: ${v.evaluacion.limitaciones.some((l: string) => l.includes("alcance territorial"))})`);
  if (v.credencial_previa) console.log(`  evidencia previa (solo contexto): categoría ${v.credencial_previa.categoria_informada}ª del ${v.credencial_previa.consultada_en}`);
}

const A1 = { fuente_id: "ecogas", matricula: "99001", tipo_trabajo_id: "artefacto-vivienda-unifamiliar", provincia_trabajo: "CORDOBA" };
console.log("Demo MatriculAR P0 — datos ficticios, sin tocar el sitio real de Ecogas");
await caso("1. Compatible (2ª con A1 en Córdoba)", "normal", A1);
await caso("2. Misma matrícula, trabajo B → incompatible", "normal", { ...A1, tipo_trabajo_id: "comercio-artefacto-alto-consumo" });
await caso("3. Matrícula que no figura (consulta exitosa)", "normal", { ...A1, matricula: "99004" });
await caso("4. Ecogas cambió la URL del recurso (404)", "url-cambiada", A1);
await caso("5. Ecogas cambió la estructura (clave renombrada)", "estructura-cambiada", A1);
await caso("6. Ecogas en mantenimiento (503, con reintentos)", "caido", A1);
await caso("7. Ecogas devuelve una lista vacía", "vacio", A1);
await caso("8. Ecogas vuelve a la normalidad", "normal", A1);
await caso("9. MetroGAS (captcha: no se consulta)", "normal", { ...A1, fuente_id: "metrogas", provincia_trabajo: "CIUDAD_AUTONOMA_DE_BUENOS_AIRES" });

if (servir) {
  modo = "normal";
  console.log(`\nServidores levantados. MatriculAR: ${API}   (Ecogas ficticio: ${urlEcogas})\nCtrl+C para salir.`);
} else {
  app.close();
  ecogasFalso.close();
}
