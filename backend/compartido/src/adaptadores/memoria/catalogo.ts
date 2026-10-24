import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Categoria, Fuente, Provincia, TipoTrabajo } from "../../dominio/tipos";
import type { Catalogo } from "../../puertos/repositorios";

/** Catálogo cargado de `database/seed/` (las mismas reglas versionadas que irán a DynamoDB). */
export function catalogoDesdeSeed(dirSeed: string): Catalogo {
  const leer = <T>(archivo: string): T => JSON.parse(readFileSync(join(dirSeed, archivo), "utf8")) as T;
  const fuentes = leer<Fuente[]>("fuentes.json");
  const tipos = leer<TipoTrabajo[]>("tipos-trabajo.json");
  const categorias = leer<Categoria[]>("categorias.json");
  const provincias = leer<Provincia[]>("provincias.json");
  return crearCatalogo({ fuentes, tipos, categorias, provincias });
}

export function crearCatalogo(d: {
  fuentes: Fuente[];
  tipos: TipoTrabajo[];
  categorias: Categoria[];
  provincias: Provincia[];
}): Catalogo {
  return {
    fuente: (id) => d.fuentes.find((f) => f.fuente_id === id && f.activa),
    fuentes: () => d.fuentes.filter((f) => f.activa),
    tipoTrabajo: (id) => d.tipos.find((t) => t.tipo_trabajo_id === id && t.activo),
    tiposTrabajo: () => d.tipos.filter((t) => t.activo),
    categorias: () => d.categorias,
    provincias: () => d.provincias,
  };
}
