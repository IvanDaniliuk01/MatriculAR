import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  configAwsDesdeEntorno,
  repositoriosAws,
} from "../../../compartido/src/adaptadores/dynamodb/repositorios";
import { componerVerificar } from "../componer";
import { crearRutas } from "./rutas";

const CONTACTO_POR_DEFECTO = "https://github.com/IvanDaniliuk01/MatriculAR";

let rutas: ReturnType<typeof crearRutas> | undefined;

/** Punto de entrada de la Lambda: se compone una vez por contenedor y atiende todas las rutas. */
export async function handler(evento: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  rutas ??= crearRutas(
    componerVerificar(
      repositoriosAws(configAwsDesdeEntorno(process.env)),
      process.env.MATRICULAR_CONTACTO ?? CONTACTO_POR_DEFECTO,
    ),
    {
      origenCors: process.env.MATRICULAR_ORIGEN_CORS ?? "*",
      log: (registro) => console.log(JSON.stringify(registro)),
    },
  );
  return rutas(evento);
}
