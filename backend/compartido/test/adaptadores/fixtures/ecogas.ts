/**
 * Fixtures sintéticos de Ecogas. Copian la estructura exacta de los recursos reales (página del
 * 02/11/2026 y chunk de septiembre), con datos inventados: el padrón real tiene emails y teléfonos
 * de personas y no puede entrar al repositorio.
 */

const NOMBRES = ["PERSONA FICTICIA UNO", "PERSONA FICTICIA DOS", "PERSONA FICTICIA TRES"];
const LOCALIDADES = ["CORDOBA", "VILLA MARIA", "SAN RAFAEL"];
const PROVINCIAS = ["CORDOBA", "CORDOBA", "MENDOZA"];

/** Registro con la forma de la página actual (formato 2): categoría, provincia y localidad como objetos. */
export function registroV2(indice: number, cambios: Record<string, unknown> = {}) {
  const i = indice % NOMBRES.length;
  const categoria = String((indice % 3) + 1);
  return {
    id: indice + 1,
    nombre_apellido: NOMBRES[i] ?? "PERSONA FICTICIA",
    categoria: { numero: categoria, nombre: `Categoría ${categoria}` },
    provincia: { nombre: PROVINCIAS[i] ?? "CORDOBA" },
    localidad: { nombre: LOCALIDADES[i] ?? "CORDOBA" },
    barrio: null,
    correo_electronico: `ficticio${indice + 1}@example.invalid`,
    telefono: `0000-${String(indice + 1).padStart(6, "0")}`,
    ...cambios,
  };
}

/** Registro con la forma del chunk de septiembre (formato 1): todo texto. */
export function registroV1(indice: number) {
  const { categoria, provincia, localidad, ...resto } = registroV2(indice);
  return {
    ...resto,
    id: String(resto.id),
    categoria: categoria.numero,
    provincia: provincia.nombre,
    localidad: localidad.nombre,
    barrio: "BARRIO FICTICIO",
  };
}

interface OpcionesPagina {
  registros?: unknown[];
  /** Reemplaza el contenedor `{ success, message, data }` entero. */
  contenedor?: unknown;
  /** Nombre de la propiedad que trae el padrón. */
  clave?: string;
}

/** Página del listado como la sirve Ecogas desde el 02/11: el padrón viaja en el payload de React. */
export function paginaV2({
  registros = [0, 1, 2].map((i) => registroV2(i)),
  contenedor = { success: true, message: "Gasistas matriculados", data: registros },
  clave = "gasistasMatriculados",
}: OpcionesPagina = {}): string {
  const lineas = [
    '1:"$Sreact.fragment"',
    '2a:"static/chunks/app/(website)/hogares-comercios/tramites-y-servicios/listado-de-gasistas-matriculados/page-cef93b68c1826158.js"',
    '2b:I[34314,["6174","$29","7374","$2a"],"default"]',
    `13:${JSON.stringify(["$", "$L2b", null, { [clave]: contenedor }])}`,
  ];
  return paginaConPayload(`${lineas.join("\n")}\n`);
}

export function paginaConPayload(payload: string): string {
  return [
    '<!DOCTYPE html><html lang="es"><head>',
    '<script src="/_next/static/chunks/6174-35ac6fded7304203.js" async=""></script>',
    "</head><body>",
    '<main class="ListadoDeGasistasMatriculados_main__xTpHC"><h1>GASISTAS MATRICULADOS</h1>',
    '<form class="GasistasMatriculadosFiltersForm_filtersContainer__YLN6E">',
    '<label for="provincia">Provincia</label><label for="nombre-apellido">Nombre y apellido</label>',
    "</form></main>",
    `<script nonce="ficticio">self.__next_f.push([1,${JSON.stringify(payload)}])</script>`,
    "</body></html>",
  ].join("");
}

/** Escapa como un literal de JavaScript entre comillas simples, igual que el chunk de septiembre. */
function literalJs(texto: string): string {
  return texto.replace(/[\\'\u0080-￿]/g, (c) => {
    if (c === "\\") return "\\\\";
    if (c === "'") return "\\'";
    const codigo = c.charCodeAt(0);
    return codigo <= 0xff
      ? `\\x${codigo.toString(16).padStart(2, "0")}`
      : `\\u${codigo.toString(16).padStart(4, "0")}`;
  });
}

/** Chunk de webpack como el de septiembre (formato 1): `JSON.parse('[{"id":"…`. */
export function chunkV1(registros: unknown[] = [0, 1, 2].map(registroV1)): string {
  return `(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[3182],{61942:function(e){e.exports=JSON.parse('${literalJs(JSON.stringify(registros))}')}}]);`;
}

/** Chunk de la página que define las columnas de la tabla pero no trae datos (la trampa de V2). */
export function chunkSoloColumnas(): string {
  return '(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[7374],{34314:function(e,t,a){let c=[{accessorKey:"nombre_apellido",header:"Nombre y apellido"},{accessorKey:"categoria",header:"Categoría"}]}}]);';
}
