import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EcogasRecursoNext } from "../../src/adaptadores/fuentes/ecogas";
import { NoAutomatizable } from "../../src/adaptadores/fuentes/no-automatizable";
import { catalogoDesdeSeed } from "../../src/adaptadores/memoria/catalogo";
import { GeneradorIds, RepositorioEnMemoria } from "../../src/adaptadores/memoria/repositorios";
import { type DependenciasVerificar, estadoEfectivo, verificar } from "../../src/aplicacion/verificar";
import { ErrorDePedido } from "../../src/dominio/errores";
import { LIMITACION_FUERA_DEL_AREA, LIMITACION_ZONA } from "../../src/dominio/evaluacion";
import type { Fuente } from "../../src/dominio/tipos";
import type { Lectura, PuertoFuente } from "../../src/puertos/fuentes";
import { RelojFalso, URL_PAGINA, descargarFalso, guionNormal, registrosFalsos, type Guion } from "../adaptadores/fixtures/fabricar";

const seed = fileURLToPath(new URL("../../../../database/seed", import.meta.url));

/** Catálogo real de database/seed, con la URL de Ecogas apuntando al sitio ficticio. */
function armar(guion: Guion = guionNormal()) {
  const base = catalogoDesdeSeed(seed);
  const reloj = new RelojFalso();
  const catalogo = {
    ...base,
    fuente: (id: string) => {
      const f = base.fuente(id);
      return f && f.fuente_id === "ecogas" ? ({ ...f, url_pagina: URL_PAGINA } as Fuente) : f;
    },
  };
  const repo = new RepositorioEnMemoria();
  const estado = { guion };
  const { descargar } = descargarFalso((u, n) => estado.guion(u, n), reloj);
  const ecogas = new EcogasRecursoNext(descargar, reloj);
  const deps: DependenciasVerificar = {
    catalogo, repo, reloj, ids: new GeneradorIds(reloj.ahora, (() => { let i = 0; return () => ((i++ * 7919) % 1000) / 1000; })()),
    adaptadorDe: (f) => (f.modo_acceso === "AUTOMATED" ? ecogas : new NoAutomatizable()),
  };
  return { deps, repo, reloj, estado };
}

const pedido = (m: string, tipo = "artefacto-vivienda-unifamiliar", prov = "CORDOBA", fuente = "ecogas") => ({
  fuente_id: fuente, matricula: m, tipo_trabajo_id: tipo, provincia_trabajo: prov,
});

describe("Escenarios del modelo de dominio (S1–S6)", () => {
  it("S1: 99001 (2ª) con A1 en Córdoba → FOUND y COMPATIBLE, con fuente y fecha", async () => {
    const { deps } = armar();
    const r = await verificar(pedido("99001"), deps);
    expect(r.resultado_verificacion).toBe("FOUND");
    expect(r.evaluacion?.resultado).toBe("COMPATIBLE");
    expect(r.evaluacion?.criterios.categoria.resultado).toBe("MET");
    expect(Object.keys(r.evaluacion?.criterios ?? {})).toEqual(["categoria"]);
    expect(r.mensaje).toBe("La matrícula 99001 figura en el padrón de Ecogas (consulta del 24/10/2026 12:00) con categoría 2ª, que la NAG-200 admite para este tipo de trabajo.");
    expect(r.credencial?.fuente).toEqual({ fuente_id: "ecogas", nombre: "Ecogas" });
    expect(r.credencial?.consultada_en).toBe("2026-10-24T15:00:00.000Z");
    expect(r.credencial_previa).toBeNull();
    expect(r.buscador_oficial).toBeNull();
    expect(r.evaluacion?.limitaciones).toContain(LIMITACION_ZONA);
    expect(r.evaluacion?.limitaciones).not.toContain(LIMITACION_FUERA_DEL_AREA);
  });

  it("S2: la misma matrícula con B → INCOMPATIBLE (misma evidencia, otro trabajo)", async () => {
    const { deps } = armar();
    const r = await verificar(pedido("99001", "comercio-artefacto-alto-consumo"), deps);
    expect(r.resultado_verificacion).toBe("FOUND");
    expect(r.evaluacion?.resultado).toBe("INCOMPATIBLE");
    expect(r.mensaje).toMatch(/no admite/);
  });

  it("S3: 99002 (1ª) con A2 en Mendoza → COMPATIBLE", async () => {
    const r = await verificar(pedido("99002", "artefacto-vivienda-general", "MENDOZA"), armar().deps);
    expect(r.evaluacion?.resultado).toBe("COMPATIBLE");
  });

  it("S4: provincia informada Córdoba, trabajo en San Luis → COMPATIBLE (la provincia informada no decide)", async () => {
    const r = await verificar(pedido("99001", "artefacto-vivienda-unifamiliar", "SAN_LUIS"), armar().deps);
    expect(r.credencial?.provincia_informada).toBe("CORDOBA");
    expect(r.evaluacion?.resultado).toBe("COMPATIBLE");
  });

  it("S5: 99003 (3ª) con A1 en Buenos Aires → COMPATIBLE con las dos Limitaciones de zona", async () => {
    const r = await verificar(pedido("99003", "artefacto-vivienda-unifamiliar", "BUENOS_AIRES"), armar().deps);
    expect(r.evaluacion?.resultado).toBe("COMPATIBLE");
    expect(r.evaluacion?.limitaciones).toContain(LIMITACION_ZONA);
    expect(r.evaluacion?.limitaciones).toContain(LIMITACION_FUERA_DEL_AREA);
  });

  it("S6: 99004 no figura → NOT_FOUND solo porque la consulta fue exitosa; sin Credencial ni Evaluación", async () => {
    const { deps, repo } = armar();
    const r = await verificar(pedido("99004"), deps);
    expect(r.resultado_verificacion).toBe("NOT_FOUND");
    expect(r.consulta.estado).toBe("SUCCEEDED");
    expect(r.credencial).toBeNull();
    expect(r.evaluacion).toBeNull();
    expect(r.mensaje).toBe("La matrícula 99004 no figura en el padrón de Ecogas según la consulta exitosa del 24/10/2026 12:00. Esto no dice nada sobre otras distribuidoras.");
    expect((await repo.historial("ecogas#99004")).credenciales).toHaveLength(0);
  });

  it("una categoría fuera del catálogo da una Evaluación INDETERMINATE", async () => {
    const r = await verificar(pedido("99007"), armar().deps);
    expect(r.resultado_verificacion).toBe("FOUND");
    expect(r.evaluacion?.resultado).toBe("INDETERMINATE");
    expect(r.mensaje).toMatch(/No podemos evaluar/);
  });

  it("la matrícula se normaliza (ceros a la izquierda y espacios)", async () => {
    const r = await verificar(pedido("  099001 "), armar().deps);
    expect(r.pedido.matricula).toBe("99001");
    expect(r.resultado_verificacion).toBe("FOUND");
  });
});

describe("Persistencia: fuente, fecha y resultado de la consulta", () => {
  it("guarda la Consulta (intentos, huella, registros), el Resultado, la Credencial, la Evaluación y la Verificación", async () => {
    const { deps, repo } = armar();
    const r = await verificar(pedido("99001"), deps);
    const consulta = await repo.consulta(r.consulta.consulta_id);
    expect(consulta?.estado).toBe("SUCCEEDED");
    expect(consulta?.fuente_id).toBe("ecogas");
    expect(consulta?.fuente_version).toBe(1);
    expect(consulta?.intentos).toHaveLength(1);
    expect(consulta?.huella_recurso).toMatch(/^[0-9a-f]{64}$/);
    expect(consulta?.registros_extraidos).toBe(1500);
    expect(consulta?.finalizada_en).toBe("2026-10-24T15:00:00.000Z");
    const h = await repo.historial("ecogas#99001");
    expect(h.resultados).toHaveLength(1);
    expect(h.resultados[0]).toMatchObject({ fuente_id: "ecogas", resultado: "FOUND", determinado_en: "2026-10-24T15:00:00.000Z" });
    expect(h.credenciales).toHaveLength(1);
    const v = await repo.verificacion(r.verificacion_id);
    expect(v?.evaluacion_id).toBe(r.evaluacion?.evaluacion_id);
    expect(v?.resultado_evaluacion).toBe("COMPATIBLE");
  });

  it("no persiste email, teléfono ni barrio (INV-9)", async () => {
    const { deps, repo } = armar();
    const r = await verificar(pedido("99001"), deps);
    const todo = JSON.stringify([
      await repo.consulta(r.consulta.consulta_id), await repo.historial("ecogas#99001"),
      await repo.verificacion(r.verificacion_id), r,
    ]);
    expect(todo).not.toMatch(/ejemplo\.invalid|BARRIO FICTICIO|000-99001/);
  });

  it("la Consulta queda asentada en IN_PROGRESS ANTES del primer pedido", async () => {
    const { deps, repo } = armar();
    let visto: string | undefined;
    const espia: PuertoFuente = {
      async leer(p) {
        const c = (await repo.consultasDeFuente("ecogas", 10))[0];
        visto = c?.estado;
        return new NoAutomatizable().leer(p);
      },
    };
    await verificar(pedido("99001"), { ...deps, adaptadorDe: () => espia });
    expect(visto).toBe("IN_PROGRESS");
  });

  it("GET: se puede reconstruir la misma respuesta desde lo persistido", async () => {
    const { deps, repo } = armar();
    const r = await verificar(pedido("99001"), deps);
    const v = await repo.verificacion(r.verificacion_id);
    expect(v?.mensaje).toBe(r.mensaje);
    expect(await repo.credencial(v!.credencial_ref!)).toMatchObject({ matricula: "99001", categoria_informada: "2" });
  });

  it("si falla el guardado, no se guarda nada a medias y la Consulta queda IN_PROGRESS (→ INTERRUPTED)", async () => {
    const { deps, repo } = armar();
    repo.falloAlGuardar = new Error("DynamoDB no responde");
    await expect(verificar(pedido("99001"), deps)).rejects.toThrow(/DynamoDB/);
    const c = (await repo.consultasDeFuente("ecogas", 10))[0]!;
    expect(c.estado).toBe("IN_PROGRESS");
    expect((await repo.historial("ecogas#99001")).credenciales).toHaveLength(0);
    expect(estadoEfectivo(c, Date.parse(c.plazo_maximo_en) + 1)).toBe("FAILED");
    expect(estadoEfectivo(c, Date.parse(c.iniciada_en))).toBe("IN_PROGRESS");
  });
});

describe("NOT_FOUND frente a UNVERIFIABLE: una falla nunca es 'no figura'", () => {
  it("la Fuente no responde → UNVERIFIABLE (SOURCE_UNAVAILABLE), con link al buscador oficial", async () => {
    const r = await verificar(pedido("99001"), armar(() => ({ errorRed: "ECONNREFUSED" })).deps);
    expect(r.resultado_verificacion).toBe("UNVERIFIABLE");
    expect(r.consulta).toMatchObject({ estado: "FAILED", motivo_falla: "SOURCE_UNAVAILABLE", cantidad_intentos: 3 });
    expect(r.credencial).toBeNull();
    expect(r.evaluacion).toBeNull();
    expect(r.buscador_oficial).toMatch(/^https:\/\/www\.ecogas\.com\.ar/);
    expect(r.mensaje).toMatch(/^No pudimos consultar el padrón de Ecogas/);
    expect(r.mensaje).not.toMatch(/no figura|0 matriculados|no está matriculad/i);
  });

  it("el recurso cambió de estructura → UNVERIFIABLE (EXTRACTION_FAILED), nunca '0 matriculados'", async () => {
    const roto = registrosFalsos().map(({ categoria, ...r }) => ({ ...r, categoria_matricula: categoria }));
    const r = await verificar(pedido("99001"), armar(guionNormal(roto)).deps);
    expect(r.resultado_verificacion).toBe("UNVERIFIABLE");
    expect(r.consulta.motivo_falla).toBe("EXTRACTION_FAILED");
    expect(r.consulta.detalle_falla).toMatch(/V4/);
    expect(r.consulta.registros_extraidos).toBeNull();
    expect(r.consulta.cantidad_intentos).toBe(1);
    expect(r.mensaje).toMatch(/el formato del recurso cambió/);
    expect(r.mensaje).not.toMatch(/0 matriculados|no figura/);
  });

  it("URL del recurso vieja (404 con HTML) → UNVERIFIABLE, no NOT_FOUND", async () => {
    const r = await verificar(pedido("99001"), armar((u) =>
      u === URL_PAGINA ? guionNormal()(u, 1) : { status: 404, contentType: "text/html", body: "<html>404</html>" },
    ).deps);
    expect(r.resultado_verificacion).toBe("UNVERIFIABLE");
  });

  it("falla después de un éxito: conserva la última evidencia válida, con su fecha, como contexto y sin concluir", async () => {
    const { deps, repo, reloj, estado } = armar();
    const ok = await verificar(pedido("99001"), deps);
    expect(ok.resultado_verificacion).toBe("FOUND");
    const fechaOk = ok.credencial!.consultada_en;

    reloj.avanzar(3 * 24 * 3600 * 1000);
    estado.guion = (u, n) => (u === URL_PAGINA ? { status: 404, contentType: "text/html", body: "x" } : guionNormal()(u, n));
    const r = await verificar(pedido("99001"), deps);

    expect(r.resultado_verificacion).toBe("UNVERIFIABLE");
    expect(r.evaluacion).toBeNull(); // no se concluye con evidencia vieja
    expect(r.credencial).toBeNull();
    expect(r.credencial_previa?.consultada_en).toBe(fechaOk);
    expect(r.credencial_previa?.categoria_informada).toBe("2");
    expect(r.mensaje).toMatch(/Última evidencia disponible: figuraba con categoría 2ª según la consulta del 24\/10\/2026 12:00\./);
    // INV-1: la Credencial anterior no se modificó ni se borró
    const h = await repo.historial("ecogas#99001");
    expect(h.credenciales).toHaveLength(1);
    expect(h.credenciales[0]?.consultada_en).toBe(fechaOk);
    expect(h.resultados.map((x) => x.resultado)).toEqual(["UNVERIFIABLE", "FOUND"]);
  });

  it("V5: una caída brusca de registros respecto de la última consulta exitosa no se toma por 'no figura'", async () => {
    const { deps, estado } = armar(guionNormal(registrosFalsos(4000)));
    const a = await verificar(pedido("99001"), deps);
    expect(a.consulta.registros_extraidos).toBe(4000);
    estado.guion = guionNormal(registrosFalsos(1500));
    const b = await verificar(pedido("99001"), deps);
    expect(b.resultado_verificacion).toBe("UNVERIFIABLE");
    expect(b.consulta.detalle_falla).toMatch(/V5.*caída/);
  });

  it("MetroGAS no es automatizable → UNVERIFIABLE sin pedidos y sin evadir el captcha", async () => {
    const { deps, repo } = armar();
    const r = await verificar(pedido("12345", "artefacto-vivienda-unifamiliar", "CIUDAD_AUTONOMA_DE_BUENOS_AIRES", "metrogas"), deps);
    expect(r.resultado_verificacion).toBe("UNVERIFIABLE");
    expect(r.consulta).toMatchObject({ estado: "NOT_ATTEMPTED", motivo_falla: "SOURCE_NOT_AUTOMATABLE", cantidad_intentos: 0 });
    expect(r.mensaje).toBe("MetroGAS no permite consultas automáticas: su buscador exige un captcha. Podés verificar la matrícula manualmente en el buscador oficial: https://www.metrogas.com.ar/colaboradores/listado-de-gasistas-con-matricula/.");
    expect(r.buscador_oficial).toMatch(/metrogas\.com\.ar/);
    expect((await repo.consultasDeFuente("metrogas", 5))[0]?.estado).toBe("NOT_ATTEMPTED");
  });
});

describe("Errores del pedido (4xx), distintos de una Fuente que falla", () => {
  const falla = async (p: ReturnType<typeof pedido>) => {
    try { await verificar(p, armar().deps); } catch (e) { return e as ErrorDePedido; }
    throw new Error("no falló");
  };
  it("Fuente inexistente → 404", async () => expect((await falla(pedido("1", undefined, undefined, "otra"))).status).toBe(404));
  it("Tipo de trabajo inexistente → 404", async () => expect((await falla(pedido("1", "no-existe"))).status).toBe(404));
  it("Provincia fuera del catálogo → 422", async () => expect((await falla(pedido("1", undefined, "ATLANTIDA"))).status).toBe(422));
  it("Matrícula inválida → 422", async () => expect((await falla(pedido("12-34"))).status).toBe(422));
  it("un pedido inválido no crea ninguna Consulta", async () => {
    const a = armar();
    await verificar(pedido("12-34"), a.deps).catch(() => undefined);
    expect(await a.repo.consultasDeFuente("ecogas", 5)).toHaveLength(0);
  });
});
