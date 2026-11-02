import { buscarCoincidencias } from "../../dominio/busqueda";
import type { Consulta, Credencial, RegistroLeido } from "../../dominio/consulta";
import type { Verificacion } from "../../dominio/verificacion";
import type {
  RepositorioConsultas,
  RepositorioCredenciales,
  RepositorioLecturas,
  RepositorioVerificaciones,
} from "../../puertos/repositorios";

/** Repositorios en memoria: para las pruebas y el recorrido local antes de DynamoDB. */
export function repositoriosEnMemoria(): {
  consultas: RepositorioConsultas;
  lecturas: RepositorioLecturas;
  credenciales: RepositorioCredenciales;
  verificaciones: RepositorioVerificaciones;
} {
  const consultas: Consulta[] = [];
  const lecturas = new Map<string, readonly RegistroLeido[]>();
  const credenciales = new Map<string, Credencial>();
  const verificaciones = new Map<string, Verificacion>();

  return {
    consultas: {
      async guardar(consulta) {
        consultas.push(structuredClone(consulta));
      },
      async obtener(id) {
        return structuredClone(consultas.find((c) => c.id === id) ?? null);
      },
      async ultima(fuenteId, estado) {
        const candidatas = consultas.filter((c) => c.fuenteId === fuenteId && c.estado === estado);
        candidatas.sort((a, b) => a.finalizadaEn.localeCompare(b.finalizadaEn));
        return structuredClone(candidatas.at(-1) ?? null);
      },
      async recientes(fuenteId, limite) {
        return structuredClone(
          consultas
            .filter((c) => c.fuenteId === fuenteId)
            .sort((a, b) => b.iniciadaEn.localeCompare(a.iniciadaEn))
            .slice(0, limite),
        );
      },
    },
    lecturas: {
      async guardar(consultaId, registros) {
        lecturas.set(consultaId, structuredClone(registros));
      },
      async obtener(consultaId) {
        return lecturas.get(consultaId) ?? null;
      },
    },
    credenciales: {
      async guardar(credencial) {
        if (!credenciales.has(credencial.id))
          credenciales.set(credencial.id, structuredClone(credencial));
      },
      async obtener(id) {
        return structuredClone(credenciales.get(id) ?? null);
      },
      async delGasista(fuenteId, gasista) {
        const deLaFuente = [...credenciales.values()].filter((c) => c.fuenteId === fuenteId);
        const busqueda = buscarCoincidencias(
          deLaFuente.map((c) => ({
            idInterno: c.id,
            nombre: c.nombreInformado,
            categoria: c.categoriaInformada,
            provincia: c.provinciaInformada,
            localidad: c.localidadInformada,
          })),
          gasista,
        );
        if (busqueda.resultado !== "FOUND") return [];
        const ids = new Set(busqueda.coincidencias.map((r) => r.idInterno));
        return deLaFuente
          .filter((c) => ids.has(c.id))
          .sort((a, b) => b.obtenidaEn.localeCompare(a.obtenidaEn));
      },
    },
    verificaciones: {
      async guardar(verificacion) {
        verificaciones.set(verificacion.id, structuredClone(verificacion));
      },
      async obtener(id) {
        return structuredClone(verificaciones.get(id) ?? null);
      },
    },
  };
}
