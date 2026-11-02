import condicionesJson from "../../../../../database/seed/condiciones-decisivas.json" with {
  type: "json",
};
import fuentesJson from "../../../../../database/seed/fuentes.json" with { type: "json" };
import provinciasJson from "../../../../../database/seed/provincias.json" with { type: "json" };
import tiposJson from "../../../../../database/seed/tipos-trabajo.json" with { type: "json" };
import { type Reglas, validarReglas } from "../../dominio/reglas";
import {
  condicionDecisivaSeed,
  fuenteSeed,
  provinciaSeed,
  tipoTrabajoSeed,
} from "../../esquemas/reglas";
import type { ConfigLectura } from "../../puertos/lector-fuente";

/**
 * Carga las reglas desde `database/seed/`, la única fuente de verdad. Si un archivo no pasa el
 * esquema o las reglas no son coherentes, falla: una regla sin cita no puede entrar al sistema.
 */
export function reglasDelSeed(): Reglas {
  const reglas: Reglas = {
    condiciones: condicionDecisivaSeed
      .array()
      .parse(condicionesJson)
      .map((c) => ({
        id: c.condicion_id,
        orden: c.orden,
        pregunta: c.pregunta,
        fundamento: c.fundamento,
      }))
      .sort((a, b) => a.orden - b.orden),
    tipos: tipoTrabajoSeed
      .array()
      .parse(tiposJson)
      .filter((t) => t.activo)
      .map((t) => ({
        id: t.tipo_trabajo_id,
        version: t.version,
        codigo: t.codigo,
        nombre: t.nombre,
        categoriasAdmitidas: t.categorias_admitidas,
        fundamento: t.fundamento,
        aplicaSi: t.aplica_si,
        limitaciones: t.limitaciones,
      })),
    fuentes: fuenteSeed
      .array()
      .parse(fuentesJson)
      .filter((f) => f.activa)
      .map((f) => ({
        id: f.fuente_id,
        version: f.version,
        nombre: f.nombre,
        areaConcesion: f.area_concesion,
        areaConcesionParcial: f.area_concesion_parcial,
        modoAcceso: f.modo_acceso,
        urlBuscadorOficial: f.url_buscador_oficial,
        proteccion: f.config_proteccion && {
          ventanaReutilizacionS: f.config_proteccion.ventana_reutilizacion_s,
          esperaTrasFallaS: f.config_proteccion.espera_tras_falla_s,
        },
        limitaciones: f.limitaciones,
      })),
    provincias: provinciaSeed.array().parse(provinciasJson),
  };

  const errores = validarReglas(reglas);
  if (errores.length > 0) {
    throw new Error(`Las reglas del seed no son coherentes:\n${errores.join("\n")}`);
  }
  return reglas;
}

/** Configuración de lectura de cada Fuente automatizable, por `fuente_id`. */
export function configsLecturaDelSeed(): ReadonlyMap<string, ConfigLectura> {
  const configs = new Map<string, ConfigLectura>();
  for (const f of fuenteSeed.array().parse(fuentesJson)) {
    const { url_pagina, config_extraccion, config_reintentos, config_validacion } = f;
    if (f.modo_acceso !== "AUTOMATED" || !f.activa) continue;
    if (!url_pagina || !config_extraccion || !config_reintentos || !config_validacion) {
      throw new Error(
        `La Fuente automatizada ${f.fuente_id} no tiene configuración de lectura completa.`,
      );
    }
    configs.set(f.fuente_id, {
      urlPagina: url_pagina,
      marcadorV2: config_extraccion.marcador_v2,
      prefijoPreferido: config_extraccion.prefijo_preferido,
      maxCandidatos: config_extraccion.max_candidatos,
      reintentos: {
        maxIntentos: config_reintentos.max_intentos,
        esperasMs: config_reintentos.esperas_ms,
        timeoutPedidoMs: config_reintentos.timeout_pedido_ms,
        timeoutConsultaMs: config_reintentos.timeout_consulta_ms,
      },
      validacion: {
        umbralCaida: config_validacion.umbral_caida,
        pisoRegistros: config_validacion.piso_registros,
      },
    });
  }
  return configs;
}
