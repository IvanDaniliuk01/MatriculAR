import { type FormEvent, useCallback, useEffect, useState } from "react";
import { crearVerificacion, obtenerCatalogos } from "../api/cliente";
import type { Catalogos, ErrorApi, RespuestaCondicion, Verificacion } from "../api/tipos";
import { CondicionesDecisivas } from "../componentes/CondicionesDecisivas";
import { Resultado } from "../componentes/Resultado";

const FUENTE_INICIAL = "ecogas";
const PROVINCIA_INICIAL = "CORDOBA";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "cargando" }
  | { tipo: "resultado"; verificacion: Verificacion }
  | { tipo: "error"; error: ErrorApi };

/** Pantalla del P0 (M05): verificar a un gasista por nombre y localidad. */
export function Verificar() {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [errorCatalogos, setErrorCatalogos] = useState<ErrorApi | null>(null);
  const [fuenteId, setFuenteId] = useState(FUENTE_INICIAL);
  const [nombre, setNombre] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState(PROVINCIA_INICIAL);
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaCondicion>>({});
  const [problemas, setProblemas] = useState<string[]>([]);
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });

  const cargarCatalogos = useCallback(async () => {
    setErrorCatalogos(null);
    const resultado = await obtenerCatalogos();
    if (resultado.ok) setCatalogos(resultado.datos);
    else setErrorCatalogos(resultado.error);
  }, []);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  if (errorCatalogos) {
    return (
      <div className="aviso error" role="alert">
        <p>No pudimos cargar los datos iniciales. {errorCatalogos.mensaje}</p>
        <button type="button" onClick={() => void cargarCatalogos()}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!catalogos) return <p aria-live="polite">Cargando…</p>;

  const cargando = estado.tipo === "cargando";

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!catalogos) return;
    const encontrados = validar(nombre, respuestas, catalogos);
    setProblemas(encontrados);
    if (encontrados.length > 0) return;

    setEstado({ tipo: "cargando" });
    const resultado = await crearVerificacion({
      fuente_id: fuenteId,
      gasista: {
        nombre_apellido: nombre.trim(),
        ...(localidad.trim() ? { localidad: localidad.trim() } : {}),
      },
      condiciones: respuestas,
      provincia_trabajo: provincia,
    });
    setEstado(
      resultado.ok
        ? { tipo: "resultado", verificacion: resultado.datos }
        : { tipo: "error", error: resultado.error },
    );
  }

  return (
    <>
      <form className="formulario" onSubmit={enviar} noValidate aria-busy={cargando}>
        <h2>Verificar a un gasista</h2>

        <label>
          Distribuidora
          <select
            value={fuenteId}
            onChange={(e) => setFuenteId(e.target.value)}
            disabled={cargando}
          >
            {catalogos.fuentes.map((f) => (
              <option key={f.fuente_id} value={f.fuente_id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Nombre y apellido
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="off"
            maxLength={120}
            disabled={cargando}
          />
        </label>

        <label>
          Localidad (opcional)
          <input
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
            autoComplete="off"
            maxLength={120}
            disabled={cargando}
          />
          <span className="ayuda">Sirve para separar a gasistas con el mismo nombre.</span>
        </label>

        <label>
          Provincia del trabajo
          <select
            value={provincia}
            onChange={(e) => setProvincia(e.target.value)}
            disabled={cargando}
          >
            {catalogos.provincias.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <CondicionesDecisivas
          condiciones={catalogos.condiciones}
          respuestas={respuestas}
          alResponder={(id, r) => setRespuestas((previas) => ({ ...previas, [id]: r }))}
          deshabilitado={cargando}
        />

        {problemas.length > 0 && (
          <ul className="aviso error" role="alert">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <button type="submit" disabled={cargando}>
          {cargando ? "Consultando…" : "Verificar"}
        </button>
      </form>

      <div aria-live="polite">
        {cargando && (
          <p className="aviso">
            Consultando el padrón de la distribuidora. Puede tardar unos 15 segundos.
          </p>
        )}
        {estado.tipo === "error" && <ErrorPedido error={estado.error} />}
        {estado.tipo === "resultado" && <Resultado verificacion={estado.verificacion} />}
      </div>
    </>
  );
}

function ErrorPedido({ error }: { error: ErrorApi }) {
  return (
    <div className="aviso error" role="alert">
      <p>{error.mensaje}</p>
      {error.detalles.length > 0 && (
        <ul>
          {error.detalles.map((d) => (
            <li key={`${d.campo ?? ""}-${d.problema}`}>
              {d.campo ? `${d.campo}: ` : ""}
              {d.problema}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function validar(
  nombre: string,
  respuestas: Record<string, RespuestaCondicion>,
  catalogos: Catalogos,
): string[] {
  const problemas: string[] = [];
  if (nombre.trim().split(/\s+/).filter(Boolean).length < 2) {
    problemas.push("Escribí el nombre y el apellido del gasista (al menos dos palabras).");
  }
  const sinResponder = catalogos.condiciones.filter((c) => !respuestas[c.condicion_id]);
  if (sinResponder.length > 0) {
    problemas.push(
      `Respondé todas las preguntas sobre el trabajo (si no sabés, elegí "No sé"). Faltan ${sinResponder.length}.`,
    );
  }
  return problemas;
}
