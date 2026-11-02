// Empaqueta la función de verificación para Lambda: un solo archivo ESM con sus dependencias
// (AWS SDK v3 incluido) y las reglas del seed, más un .zip listo para Terraform.
//
// Uso: node scripts/empaquetar.mjs [entrada]   (por defecto, verificacion/src/handlers/api.ts)
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import { build } from "esbuild";

const raiz = resolve(import.meta.dirname, "..");
const entrada = resolve(raiz, process.argv[2] ?? "verificacion/src/handlers/api.ts");
const salida = join(raiz, "dist/verificacion");
const zip = join(raiz, "dist/verificacion.zip");

rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

const resultado = await build({
  entryPoints: [entrada],
  outfile: join(salida, "index.mjs"),
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  minify: true,
  sourcemap: true,
  metafile: true,
  legalComments: "none",
  // Algunas dependencias del SDK usan require(); en un bundle ESM hay que proveerlo.
  banner: {
    js: "import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);",
  },
});

const archivos = ["index.mjs", "index.mjs.map"].map((nombre) => join(salida, nombre));
writeFileSync(zip, comprimir(archivos));

const kb = (ruta) => `${Math.round(statSync(ruta).size / 1024)} KB`;
console.log(`Entrada: ${entrada}`);
console.log(`Bundle:  ${join(salida, "index.mjs")} (${kb(archivos[0])})`);
console.log(`Zip:     ${zip} (${kb(zip)})`);
console.log(`Módulos: ${Object.keys(resultado.metafile.inputs).length}`);

/** Un .zip mínimo (deflate, sin carpetas), para no depender del comando `zip` del sistema. */
function comprimir(rutas) {
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;
  // Fecha fija: el mismo código produce el mismo zip y Terraform no lo ve como un cambio.
  const hora = 0;
  const fecha = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const ruta of rutas) {
    const contenido = readFileSync(ruta);
    const comprimido = deflateRawSync(contenido, { level: 9 });
    const nombre = Buffer.from(basename(ruta));
    const crc = crc32(contenido);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(fecha, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(contenido.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombre, comprimido);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // hecho en Unix, versión 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(fecha, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(contenido.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // permisos rw-r--r--
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombre);

    desplazamiento += local.length + nombre.length + comprimido.length;
  }

  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(rutas.length, 8);
  fin.writeUInt16LE(rutas.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  mkdirSync(dirname(zip), { recursive: true });
  return Buffer.concat([...locales, directorio, fin]);
}
