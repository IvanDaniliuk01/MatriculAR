import { randomUUID } from "node:crypto";
import { LectorEcogas } from "../../compartido/src/adaptadores/fuentes/ecogas/lector-ecogas";
import { ClienteFetch } from "../../compartido/src/adaptadores/http/cliente-fetch";
import {
  configsLecturaDelSeed,
  reglasDelSeed,
} from "../../compartido/src/adaptadores/reglas/reglas-seed";
import { relojSistema } from "../../compartido/src/adaptadores/sistema/reloj-sistema";
import type { DependenciasVerificar } from "../../compartido/src/aplicacion/verificar";
import type {
  RepositorioConsultas,
  RepositorioCredenciales,
  RepositorioLecturas,
  RepositorioVerificaciones,
} from "../../compartido/src/puertos/repositorios";

/** El adaptador se identifica siempre (devolución v3): nunca se hace pasar por un navegador. */
export function userAgent(contacto: string): string {
  return `MatriculAR/0.1 (proyecto final UTN; contacto: ${contacto})`;
}

/**
 * Raíz de composición de la función de verificación: arma el caso de uso con sus adaptadores.
 * Los repositorios se inyectan (archivo local en el CLI, DynamoDB en la Lambda).
 */
export function componerVerificar(
  repositorios: {
    consultas: RepositorioConsultas;
    lecturas: RepositorioLecturas;
    credenciales: RepositorioCredenciales;
    verificaciones: RepositorioVerificaciones;
  },
  contacto: string,
): DependenciasVerificar {
  return {
    reglas: reglasDelSeed(),
    configsLectura: configsLecturaDelSeed(),
    lector: new LectorEcogas(new ClienteFetch(), relojSistema, userAgent(contacto)),
    ...repositorios,
    reloj: relojSistema,
    ids: { nuevo: randomUUID },
  };
}
