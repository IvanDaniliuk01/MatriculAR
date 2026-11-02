import type { CreateTableCommandInput } from "@aws-sdk/client-dynamodb";

/**
 * Esquema de las tablas del P0, igual al de `database/tablas/*.json` (una prueba verifica que
 * coincidan). Terraform crea las mismas tablas; las pruebas de integración las crean con esto.
 */

export interface NombresTablas {
  consultas: string;
  credenciales: string;
  verificaciones: string;
  evaluaciones: string;
}

type Tipo = "S" | "N";

function tabla(
  nombre: string,
  clave: string,
  indices: { nombre: string; particion: string; orden: string }[],
): CreateTableCommandInput {
  const atributos = new Map<string, Tipo>([[clave, "S"]]);
  for (const indice of indices) {
    atributos.set(indice.particion, "S");
    atributos.set(indice.orden, "S");
  }
  return {
    TableName: nombre,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [...atributos].map(([AttributeName, AttributeType]) => ({
      AttributeName,
      AttributeType,
    })),
    KeySchema: [{ AttributeName: clave, KeyType: "HASH" }],
    ...(indices.length > 0 && {
      GlobalSecondaryIndexes: indices.map((indice) => ({
        IndexName: indice.nombre,
        KeySchema: [
          { AttributeName: indice.particion, KeyType: "HASH" },
          { AttributeName: indice.orden, KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      })),
    }),
  };
}

export function definicionesTablas(
  nombres: NombresTablas,
): Record<keyof NombresTablas, CreateTableCommandInput> {
  return {
    consultas: tabla(nombres.consultas, "consulta_id", [
      { nombre: "por-fuente", particion: "fuente_id", orden: "iniciada_en" },
      { nombre: "por-fuente-estado", particion: "fuente_estado", orden: "finalizada_en" },
    ]),
    credenciales: tabla(nombres.credenciales, "credencial_id", [
      { nombre: "por-fuente", particion: "fuente_id", orden: "obtenida_en" },
    ]),
    verificaciones: tabla(nombres.verificaciones, "verificacion_id", []),
    evaluaciones: tabla(nombres.evaluaciones, "evaluacion_id", []),
  };
}
