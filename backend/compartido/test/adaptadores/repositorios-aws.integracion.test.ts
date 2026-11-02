import { randomUUID } from "node:crypto";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  definicionesTablas,
  type NombresTablas,
} from "../../src/adaptadores/dynamodb/esquema-tablas";
import { repositoriosAws } from "../../src/adaptadores/dynamodb/repositorios";
import { probarContratoRepositorios } from "./repositorios.contrato";

/**
 * Repositorios contra DynamoDB y S3 reales (LocalStack). Solo corre con MATRICULAR_PRUEBAS_AWS=1
 * (`npm run test:aws`) y AWS_ENDPOINT_URL apuntando a LocalStack. Crea tablas y bucket propios y
 * los borra al terminar.
 */
const habilitada = process.env.MATRICULAR_PRUEBAS_AWS === "1";

if (!habilitada) {
  describe.skip("Contrato de repositorios: DynamoDB + S3 (definí MATRICULAR_PRUEBAS_AWS=1)", () => {
    it("requiere LocalStack", () => {});
  });
} else {
  const sufijo = randomUUID().slice(0, 8);
  const tablas: NombresTablas = {
    consultas: `matricular-prueba-${sufijo}-consultas`,
    credenciales: `matricular-prueba-${sufijo}-credenciales`,
    verificaciones: `matricular-prueba-${sufijo}-verificaciones`,
    evaluaciones: `matricular-prueba-${sufijo}-evaluaciones`,
  };
  const bucketLecturas = `matricular-prueba-${sufijo}-lecturas`;
  const dynamo = new DynamoDBClient({});
  const s3 = new S3Client({ forcePathStyle: true });

  beforeAll(async () => {
    for (const definicion of Object.values(definicionesTablas(tablas))) {
      await dynamo.send(new CreateTableCommand(definicion));
      await waitUntilTableExists(
        { client: dynamo, maxWaitTime: 60 },
        { TableName: definicion.TableName },
      );
    }
    await s3.send(new CreateBucketCommand({ Bucket: bucketLecturas }));
  }, 120_000);

  afterAll(async () => {
    for (const nombre of Object.values(tablas)) {
      await dynamo.send(new DeleteTableCommand({ TableName: nombre }));
    }
    const { Contents = [] } = await s3.send(new ListObjectsV2Command({ Bucket: bucketLecturas }));
    if (Contents.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucketLecturas,
          Delete: { Objects: Contents.map(({ Key }) => ({ Key })) },
        }),
      );
    }
    await s3.send(new DeleteBucketCommand({ Bucket: bucketLecturas }));
  }, 120_000);

  probarContratoRepositorios("DynamoDB + S3 (LocalStack)", async () =>
    repositoriosAws({ tablas, bucketLecturas, s3 }),
  );
}
