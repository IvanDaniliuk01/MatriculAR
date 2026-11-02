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
