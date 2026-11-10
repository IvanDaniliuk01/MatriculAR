import type { Verificacion } from "../api/tipos";
import { categoria, fechaHora } from "../formato";
import { Coincidencia } from "./Coincidencia";
import { DetalleConsulta } from "./DetalleConsulta";

function encabezado(v: Verificacion): { texto: string; icono: string; clase: string } {
  const fuente = v.pedido.fuente.nombre;
  switch (v.resultado_verificacion) {
    case "FOUND": {
      const n = v.coincidencias.length;
      return n === 1
        ? {
            texto: `Encontramos 1 gasista con ese nombre en el padrón de ${fuente}. Confirmalo con su carné.`,
            icono: "●",
            clase: "neutro",
          }
        : {
            texto: `Encontramos ${n} gasistas con ese nombre: elegí el que coincide con su carné.`,
            icono: "●",
            clase: "neutro",
          };
    }
    case "NOT_FOUND":
      return {
        texto: `Nadie con ese nombre figura en el padrón de ${fuente}`,
        icono: "—",
        clase: "gris",
      };
    case "TOO_MANY_MATCHES":
      return { texto: "Hay demasiados gasistas con ese nombre", icono: "ⓘ", clase: "gris" };
    case "UNVERIFIABLE":
      return v.consulta.motivo_falla === "SOURCE_NOT_AUTOMATABLE"
        ? { texto: "Esta Fuente no permite consultas automáticas", icono: "ⓘ", clase: "gris" }
        : { texto: "No pudimos consultar la Fuente", icono: "⚠", clase: "ambar" };
  }
}

export function Resultado({ verificacion: v }: { verificacion: Verificacion }) {
  const e = encabezado(v);
  return (
    <section className="resultado" aria-labelledby="titulo-resultado">
      <h2 id="titulo-resultado" className={e.clase}>
        <span aria-hidden="true">{e.icono}</span> {e.texto}
      </h2>
      <p className="mensaje">{v.mensaje}</p>

      {v.coincidencias.map(({ credencial, evaluacion }) => (
        <Coincidencia
          key={evaluacion.evaluacion_id}
          credencial={credencial}
          evaluacion={evaluacion}
          tipos={v.tipos_trabajo_posibles}
        />
      ))}

      {v.credenciales_previas.length > 0 && (
        <section className="previas">
          <h3>Última evidencia disponible (no se usa para concluir)</h3>
          <ul>
            {v.credenciales_previas.map((c) => (
              <li key={`${c.nombre_informado}-${c.localidad_informada}-${c.consultada_en}`}>
                {c.nombre_informado} ({c.localidad_informada ?? "sin localidad"}): categoría{" "}
                {categoria(c.categoria_informada)} según la consulta del{" "}
                {fechaHora(c.consultada_en)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.buscador_oficial && (
        <p>
          Podés buscarlo a mano en el{" "}
          <a href={v.buscador_oficial} target="_blank" rel="noreferrer">
            buscador oficial de {v.pedido.fuente.nombre}
          </a>
          .
        </p>
      )}

      <DetalleConsulta consulta={v.consulta} verificacionId={v.verificacion_id} />
    </section>
  );
}
