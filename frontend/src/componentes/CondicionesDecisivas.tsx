import type { CondicionDecisiva, RespuestaCondicion } from "../api/tipos";

const OPCIONES: { valor: RespuestaCondicion; texto: string }[] = [
  { valor: "SI", texto: "Sí" },
  { valor: "NO", texto: "No" },
  { valor: "NO_SE", texto: "No sé" },
];

interface Props {
  condiciones: CondicionDecisiva[];
  respuestas: Record<string, RespuestaCondicion>;
  alResponder: (condicionId: string, respuesta: RespuestaCondicion) => void;
  deshabilitado: boolean;
}

export function CondicionesDecisivas({
  condiciones,
  respuestas,
  alResponder,
  deshabilitado,
}: Props) {
  return (
    <fieldset className="condiciones" disabled={deshabilitado}>
      <legend>Contanos sobre el trabajo</legend>
      {condiciones.map((c) => (
        <fieldset key={c.condicion_id} className="condicion">
          <legend>{c.pregunta}</legend>
          <div className="opciones">
            {OPCIONES.map((o) => (
              <label key={o.valor}>
                <input
                  type="radio"
                  name={c.condicion_id}
                  value={o.valor}
                  checked={respuestas[c.condicion_id] === o.valor}
                  onChange={() => alResponder(c.condicion_id, o.valor)}
                />
                {o.texto}
              </label>
            ))}
          </div>
          <p className="ayuda">
            {c.ayuda}{" "}
            <a href={c.fundamento.url} target="_blank" rel="noreferrer">
              {c.fundamento.norma}, {c.fundamento.articulo}
            </a>
          </p>
        </fieldset>
      ))}
    </fieldset>
  );
}
