import type { Credencial, Evaluacion, ResultadoEvaluacion, TipoTrabajoPosible } from "../api/tipos";
import { categoria, fechaHora } from "../formato";

const ENCABEZADO: Record<ResultadoEvaluacion, { texto: string; icono: string; clase: string }> = {
  COMPATIBLE: { texto: "Compatible según la regla aplicada", icono: "✔", clase: "verde" },
  INCOMPATIBLE: { texto: "No compatible con este trabajo", icono: "✖", clase: "rojo" },
  INDETERMINATE: { texto: "No podemos determinarlo", icono: "?", clase: "ambar" },
};

interface Props {
  credencial: Credencial;
  evaluacion: Evaluacion;
  tipos: TipoTrabajoPosible[];
}

export function Coincidencia({ credencial, evaluacion, tipos }: Props) {
  const encabezado = ENCABEZADO[evaluacion.resultado];
  const nombreTipo = (id: string) => {
    const tipo = tipos.find((t) => t.tipo_trabajo_id === id);
    return tipo ? `${tipo.codigo} · ${tipo.nombre}` : id;
  };

  return (
    <article className={`tarjeta ${encabezado.clase}`}>
      <h3>
        <span aria-hidden="true">{encabezado.icono}</span> {encabezado.texto}
      </h3>
      <p>{evaluacion.explicacion}</p>

      <h4>Qué sabemos · evidencia</h4>
      <dl className="evidencia">
        <dt>Nombre informado</dt>
        <dd>{credencial.nombre_informado}</dd>
        <dt>Categoría informada</dt>
        <dd>{categoria(credencial.categoria_informada)}</dd>
        <dt>Localidad informada</dt>
        <dd>
          {credencial.localidad_informada ?? "—"}
          {credencial.provincia_informada ? ` (${credencial.provincia_informada})` : ""} · domicilio
          del matriculado
        </dd>
        <dt>Fuente · fecha</dt>
        <dd>
          {credencial.fuente.nombre} · {fechaHora(credencial.consultada_en)}
        </dd>
      </dl>

      <h4>Qué concluimos · criterio</h4>
      <ul className="criterios">
        {evaluacion.resultados_por_tipo.map((r) => (
          <li key={r.tipo_trabajo_id}>
            <strong>{nombreTipo(r.tipo_trabajo_id)}:</strong>{" "}
            {r.criterio_categoria.fundamento ?? ENCABEZADO[r.resultado].texto} (categorías
            admitidas: {r.regla_aplicada.categorias_admitidas.map(categoria).join(", ")}; regla
            versión {r.tipo_trabajo_version})
          </li>
        ))}
      </ul>

      {evaluacion.condiciones_que_resuelven.length > 0 && (
        <>
          <h4>Qué lo resolvería</h4>
          <ul>
            {evaluacion.condiciones_que_resuelven.map((c) => (
              <li key={c.condicion_id}>{c.pregunta}</li>
            ))}
          </ul>
        </>
      )}

      <h4>Qué no podemos afirmar · limitaciones</h4>
      <ul className="limitaciones">
        {evaluacion.limitaciones.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </article>
  );
}
