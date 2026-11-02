import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buscarCoincidencias } from "../../dominio/busqueda";
import type { Consulta, Credencial, RegistroLeido } from "../../dominio/consulta";
import type { Verificacion } from "../../dominio/verificacion";
import type {
  RepositorioConsultas,
  RepositorioCredenciales,
  RepositorioLecturas,
  RepositorioVerificaciones,
} from "../../puertos/repositorios";

interface Estado {
  consultas: Consulta[];
  lecturas: Record<string, { registros: RegistroLeido[]; venceEn: string }>;
  credenciales: Record<string, Credencial>;
  verificaciones: Record<string, Verificacion>;
}

/**
 * Repositorios en un archivo JSON local, para el CLI: así la Ventana de reutilización se respeta
 * entre ejecuciones y no se descarga el padrón cada vez. El directorio no se versiona: las
 * Lecturas minimizadas tienen nombres de personas, y se descartan al vencer (al día siguiente).
 */
export function repositoriosEnArchivo(directorio: string) {
  mkdirSync(directorio, { recursive: true });
  const archivo = join(directorio, "estado.json");
  const estado = cargar(archivo);
  const ahora = new Date().toISOString();
  for (const [id, lectura] of Object.entries(estado.lecturas)) {
    if (lectura.venceEn < ahora) delete estado.lecturas[id];
  }
  const persistir = () => writeFileSync(archivo, JSON.stringify(estado));
  persistir();

  const consultas: RepositorioConsultas = {
    async guardar(consulta) {
      estado.consultas.push(consulta);
      persistir();
    },
    async obtener(id) {
      return estado.consultas.find((c) => c.id === id) ?? null;
    },
    async ultima(fuenteId, estadoConsulta) {
      const candidatas = estado.consultas
        .filter((c) => c.fuenteId === fuenteId && c.estado === estadoConsulta)
        .sort((a, b) => a.finalizadaEn.localeCompare(b.finalizadaEn));
      return candidatas.at(-1) ?? null;
    },
    async recientes(fuenteId, limite) {
      return estado.consultas
        .filter((c) => c.fuenteId === fuenteId)
        .sort((a, b) => b.iniciadaEn.localeCompare(a.iniciadaEn))
        .slice(0, limite);
    },
  };
  const lecturas: RepositorioLecturas = {
    async guardar(consultaId, registros, venceEn) {
      estado.lecturas[consultaId] = { registros: [...registros], venceEn };
      persistir();
    },
    async obtener(consultaId) {
      return estado.lecturas[consultaId]?.registros ?? null;
    },
  };
  const credenciales: RepositorioCredenciales = {
    async guardar(credencial) {
      estado.credenciales[credencial.id] ??= credencial;
      persistir();
    },
    async obtener(id) {
      return estado.credenciales[id] ?? null;
    },
    async delGasista(fuenteId, gasista) {
      const deLaFuente = Object.values(estado.credenciales).filter((c) => c.fuenteId === fuenteId);
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
  };
  const verificaciones: RepositorioVerificaciones = {
    async guardar(verificacion) {
      estado.verificaciones[verificacion.id] = verificacion;
      persistir();
    },
    async obtener(id) {
      return estado.verificaciones[id] ?? null;
    },
  };
  return { consultas, lecturas, credenciales, verificaciones };
}

function cargar(archivo: string): Estado {
  try {
    return JSON.parse(readFileSync(archivo, "utf8")) as Estado;
  } catch {
    return { consultas: [], lecturas: {}, credenciales: {}, verificaciones: {} };
  }
}
