import type { Consulta } from "../api/tipos";
import { fechaHora } from "../formato";

export function DetalleConsulta({
  consulta,
  verificacionId,
}: {
  consulta: Consulta;
  verificacionId: string;
}) {
  const filas: [string, string][] = [
    ["Verificación", verificacionId],
    ["Consulta", consulta.consulta_id],
    ["Estado", consulta.estado],
    ["Motivo de la falla", consulta.motivo_falla ?? "—"],
    ["Detalle de la falla", consulta.detalle_falla ?? "—"],
    ["Iniciada", fechaHora(consulta.iniciada_en)],
    ["Finalizada", fechaHora(consulta.finalizada_en)],
    ["Intentos", String(consulta.cantidad_intentos)],
    ["Registros leídos", consulta.registros_extraidos?.toString() ?? "—"],
    ["Formato del recurso", consulta.formato_recurso ?? "—"],
    ["Huella del recurso (SHA-256)", consulta.huella_recurso ?? "—"],
    [
      "Reutilizada",
      consulta.reutilizada ? "Sí, se apoya en una Consulta reciente" : "No, lectura nueva",
    ],
  ];
  return (
    <details className="detalle">
      <summary>Detalle técnico (Consulta, intentos, huella del recurso)</summary>
      <dl>
        {filas.map(([clave, valor]) => (
          <div key={clave}>
            <dt>{clave}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
