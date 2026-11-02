import { join } from "node:path";
import { parseArgs } from "node:util";
import { repositoriosEnArchivo } from "../../compartido/src/adaptadores/archivo/repositorios";
import { type RespuestaVerificacion, verificar } from "../../compartido/src/aplicacion/verificar";
import { normalizarTexto } from "../../compartido/src/dominio/busqueda";
import type { Respuesta } from "../../compartido/src/dominio/condiciones";
import { fechaParaCliente } from "../../compartido/src/dominio/verificacion";
import { componerVerificar } from "./componer";

const AYUDA = `Verifica a un gasista contra la Fuente real, desde la línea de comandos.

  npm run verificar -- --nombre "Nombre Apellido" --provincia Córdoba \\
    --condicion comercio_o_industria=NO --condicion unica_vivienda=NO_SE ... [--localidad "Villa María"]

Opciones:
  --nombre       nombre y apellido del gasista (al menos dos palabras)
  --localidad    localidad del gasista (opcional, filtra homónimos)
  --provincia    provincia donde se hace el trabajo (nombre o código)
  --fuente       Fuente a consultar (por defecto: ecogas)
  --condicion    id=SI|NO|NO_SE, una por cada Condición decisiva
  --json         imprime la respuesta completa en JSON

Variables: MATRICULAR_CONTACTO (contacto en el User-Agent; por defecto, la URL del repositorio).
Las lecturas se guardan en backend/.datos-locales/ y se reutilizan 15 minutos (ADR-0006).`;

async function main() {
  const { values } = parseArgs({
    options: {
      nombre: { type: "string" },
      localidad: { type: "string" },
      provincia: { type: "string" },
      fuente: { type: "string", default: "ecogas" },
      condicion: { type: "string", multiple: true, default: [] },
      json: { type: "boolean", default: false },
      ayuda: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.ayuda || !values.nombre || !values.provincia) {
    console.log(AYUDA);
    process.exitCode = values.ayuda ? 0 : 2;
    return;
  }

  const contacto =
    process.env.MATRICULAR_CONTACTO ?? "https://github.com/IvanDaniliuk01/MatriculAR";
  const repositorios = repositoriosEnArchivo(join(import.meta.dirname, "../../.datos-locales"));
  const deps = componerVerificar(repositorios, contacto);

  const provincia = deps.reglas.provincias.find(
    (p) =>
      p.codigo === values.provincia ||
      normalizarTexto(p.nombre) === normalizarTexto(values.provincia ?? ""),
  );
  const condiciones = Object.fromEntries(
    values.condicion.map((par) => {
      const [id, valor] = par.split("=");
      return [id?.trim(), valor?.trim().toUpperCase().replace("NOSE", "NO_SE") as Respuesta];
    }),
  );

  const resultado = await verificar(
    {
      fuenteId: values.fuente,
      gasista: { nombreApellido: values.nombre, localidad: values.localidad },
      condiciones,
      provinciaTrabajo: provincia?.codigo ?? values.provincia,
    },
    deps,
  );

  if (!resultado.ok) {
    console.error(`${resultado.codigo}: ${resultado.mensaje}`);
    for (const detalle of resultado.detalles) console.error(`  - ${detalle}`);
    if (resultado.codigo === "INVALID_INPUT") {
      console.error("\nCondiciones decisivas (respondé SI, NO o NO_SE):");
      for (const c of deps.reglas.condiciones) console.error(`  ${c.id}: ${c.pregunta}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    values.json ? JSON.stringify(resultado.respuesta, null, 2) : texto(resultado.respuesta),
  );
}

function texto({
  consulta,
  verificacion,
  coincidencias,
  evidenciaPrevia,
  mensaje,
}: RespuestaVerificacion): string {
  const lineas: string[] = [];
  const origen = verificacion.consultaReutilizada ? "lectura reutilizada" : "lectura nueva";
  const detalle =
    consulta.estado === "SUCCEEDED"
      ? `${origen} · formato ${consulta.formatoRecurso} · ${consulta.cantidadRegistros} registros · huella ${consulta.huellaRecurso?.slice(0, 12)}…`
      : `${consulta.estado} · ${consulta.motivo}${consulta.detalle ? ` · ${consulta.detalle}` : ""}`;
  lineas.push(`Consulta ${fechaParaCliente(consulta.finalizadaEn)} · ${detalle}`, "", mensaje);

  coincidencias.forEach(({ credencial, evaluacion }, i) => {
    lineas.push(
      "",
      `[${i + 1}] ${credencial.nombreInformado} · categoría informada «${credencial.categoriaInformada}» · ${credencial.localidadInformada} (${credencial.provinciaInformada})`,
      `    ${evaluacion.resultado}: ${evaluacion.explicacion}`,
      `    Tipos de trabajo posibles: ${evaluacion.tiposTrabajoPosibles.map((t) => t.codigo).join(", ")}`,
      "    Qué no podemos afirmar:",
      ...evaluacion.limitaciones.map((l) => `      - ${l.texto}`),
    );
  });
  if (evidenciaPrevia.length > 0) {
    lineas.push("", "Última evidencia disponible (no se usa para concluir):");
    for (const c of evidenciaPrevia) {
      lineas.push(
        `  - ${c.nombreInformado} · «${c.categoriaInformada}» · ${c.localidadInformada} · ${fechaParaCliente(c.obtenidaEn)}`,
      );
    }
  }
  return lineas.join("\n");
}

await main();
