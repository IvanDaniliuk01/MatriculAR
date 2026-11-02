import { gunzipSync, gzipSync } from "node:zlib";
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  BatchGetCommand,
  type BatchGetCommandOutput,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { buscarCoincidencias } from "../../dominio/busqueda";
import type { Respuestas } from "../../dominio/condiciones";
import type {
  Consulta,
  Credencial,
  EstadoConsulta,
  Intento,
  MotivoFalla,
  RegistroLeido,
} from "../../dominio/consulta";
import type { Evaluacion, ResultadoEvaluacion } from "../../dominio/evaluacion";
import type { FundamentoCategoria } from "../../dominio/reglas";
import type { ResultadoVerificacion, Verificacion } from "../../dominio/verificacion";
import type {
  RepositorioConsultas,
  RepositorioCredenciales,
  RepositorioLecturas,
  RepositorioVerificaciones,
} from "../../puertos/repositorios";
import type { NombresTablas } from "./esquema-tablas";

/**
 * Repositorios sobre DynamoDB (una tabla por entidad, ADR-0004) y S3 (Lecturas minimizadas,
 * ADR-0006). La evidencia nunca se modifica ni se borra: solo hay escrituras condicionales
 * (`attribute_not_exists`) y lecturas. Los ítems usan snake_case, igual que database/tablas/.
 */

export interface ConfigAws {
  tablas: NombresTablas;
  bucketLecturas: string;
}

const VARIABLES = {
  consultas: "MATRICULAR_TABLA_CONSULTAS",
  credenciales: "MATRICULAR_TABLA_CREDENCIALES",
  verificaciones: "MATRICULAR_TABLA_VERIFICACIONES",
  evaluaciones: "MATRICULAR_TABLA_EVALUACIONES",
} as const;

/** Lee los nombres de tablas y del bucket de las variables de entorno que define Terraform. */
export function configAwsDesdeEntorno(
  env: Record<string, string | undefined> = process.env,
): ConfigAws {
  const faltantes = [...Object.values(VARIABLES), "MATRICULAR_BUCKET_LECTURAS"].filter(
    (variable) => !env[variable],
  );
  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno de almacenamiento: ${faltantes.join(", ")}.`);
  }
  const leer = (variable: string) => env[variable] as string;
  return {
    tablas: {
      consultas: leer(VARIABLES.consultas),
      credenciales: leer(VARIABLES.credenciales),
      verificaciones: leer(VARIABLES.verificaciones),
      evaluaciones: leer(VARIABLES.evaluaciones),
    },
    bucketLecturas: leer("MATRICULAR_BUCKET_LECTURAS"),
  };
}

/** Tope de Credenciales que se recorren para la evidencia previa (simplificación del P0). */
const MAX_CREDENCIALES_HISTORIAL = 1000;

export function repositoriosAws(
  config: ConfigAws & { dynamo?: DynamoDBDocumentClient; s3?: S3Client },
): {
  consultas: RepositorioConsultas;
  lecturas: RepositorioLecturas;
  credenciales: RepositorioCredenciales;
  verificaciones: RepositorioVerificaciones;
} {
  const { tablas, bucketLecturas } = config;
  const dynamo =
    config.dynamo ??
    DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  // En LocalStack (AWS_ENDPOINT_URL definida) S3 necesita rutas de estilo path.
  const s3 = config.s3 ?? new S3Client({ forcePathStyle: Boolean(process.env.AWS_ENDPOINT_URL) });

  const consultas: RepositorioConsultas = {
    async guardar(consulta) {
      await dynamo.send(
        new PutCommand({
          TableName: tablas.consultas,
          Item: consultaAItem(consulta),
          ConditionExpression: "attribute_not_exists(consulta_id)",
        }),
      );
    },
    async obtener(id) {
      const { Item } = await dynamo.send(
        new GetCommand({ TableName: tablas.consultas, Key: { consulta_id: id } }),
      );
      return Item ? itemAConsulta(Item as ItemConsulta) : null;
    },
    async ultima(fuenteId, estado) {
      const { Items } = await dynamo.send(
        new QueryCommand({
          TableName: tablas.consultas,
          IndexName: "por-fuente-estado",
          KeyConditionExpression: "fuente_estado = :clave",
          ExpressionAttributeValues: { ":clave": `${fuenteId}#${estado}` },
          ScanIndexForward: false,
          Limit: 1,
        }),
      );
      const item = Items?.[0];
      return item ? itemAConsulta(item as ItemConsulta) : null;
    },
    async recientes(fuenteId, limite) {
      const { Items = [] } = await dynamo.send(
        new QueryCommand({
          TableName: tablas.consultas,
          IndexName: "por-fuente",
          KeyConditionExpression: "fuente_id = :fuente",
          ExpressionAttributeValues: { ":fuente": fuenteId },
          ScanIndexForward: false,
          Limit: limite,
        }),
      );
      return Items.map((item) => itemAConsulta(item as ItemConsulta));
    },
  };

  const lecturas: RepositorioLecturas = {
    async guardar(consultaId, registros, venceEn) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucketLecturas,
          Key: claveLectura(consultaId),
          Body: gzipSync(JSON.stringify(registros)),
          ContentType: "application/gzip",
          Metadata: { "vence-en": venceEn },
        }),
      );
    },
    async obtener(consultaId) {
      try {
        const { Body } = await s3.send(
          new GetObjectCommand({ Bucket: bucketLecturas, Key: claveLectura(consultaId) }),
        );
        if (!Body) return null;
        const bytes = await Body.transformToByteArray();
        return JSON.parse(gunzipSync(bytes).toString("utf8")) as RegistroLeido[];
      } catch (error) {
        if (error instanceof Error && error.name === "NoSuchKey") return null;
        throw error;
      }
    },
  };

  const credenciales: RepositorioCredenciales = {
    async guardar(credencial) {
      try {
        await dynamo.send(
          new PutCommand({
            TableName: tablas.credenciales,
            Item: credencialAItem(credencial),
            ConditionExpression: "attribute_not_exists(credencial_id)",
          }),
        );
      } catch (error) {
        // Idempotente: la misma Consulta y el mismo registro ya produjeron esta Credencial.
        if (!(error instanceof ConditionalCheckFailedException)) throw error;
      }
    },
    async obtener(id) {
      const { Item } = await dynamo.send(
        new GetCommand({ TableName: tablas.credenciales, Key: { credencial_id: id } }),
      );
      return Item ? itemACredencial(Item as ItemCredencial) : null;
    },
    async delGasista(fuenteId, gasista) {
      const deLaFuente: Credencial[] = [];
      let desde: Record<string, unknown> | undefined;
      do {
        const pagina = await dynamo.send(
          new QueryCommand({
            TableName: tablas.credenciales,
            IndexName: "por-fuente",
            KeyConditionExpression: "fuente_id = :fuente",
            ExpressionAttributeValues: { ":fuente": fuenteId },
            ScanIndexForward: false,
            Limit: MAX_CREDENCIALES_HISTORIAL - deLaFuente.length,
            ExclusiveStartKey: desde,
          }),
        );
        for (const item of pagina.Items ?? [])
          deLaFuente.push(itemACredencial(item as ItemCredencial));
        desde = pagina.LastEvaluatedKey;
      } while (desde && deLaFuente.length < MAX_CREDENCIALES_HISTORIAL);

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
      await dynamo.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: tablas.verificaciones,
                Item: verificacionAItem(verificacion),
                ConditionExpression: "attribute_not_exists(verificacion_id)",
              },
            },
            ...verificacion.coincidencias.map((c) => ({
              Put: {
                TableName: tablas.evaluaciones,
                Item: {
                  evaluacion_id: c.evaluacionId,
                  verificacion_id: verificacion.id,
                  credencial_id: c.credencialId,
                  evaluacion: evaluacionAItem(c.evaluacion),
                } satisfies ItemEvaluacion,
                ConditionExpression: "attribute_not_exists(evaluacion_id)",
              },
            })),
          ],
        }),
      );
    },
    async obtener(id) {
      const { Item } = await dynamo.send(
        new GetCommand({ TableName: tablas.verificaciones, Key: { verificacion_id: id } }),
      );
      if (!Item) return null;
      const item = Item as ItemVerificacion;
      const evaluaciones = await obtenerEvaluaciones(
        dynamo,
        tablas.evaluaciones,
        item.coincidencias.map((c) => c.evaluacion_id),
      );
      return itemAVerificacion(item, evaluaciones);
    },
  };

  return { consultas, lecturas, credenciales, verificaciones };
}

function claveLectura(consultaId: string): string {
  return `lecturas/${consultaId}.json.gz`;
}

async function obtenerEvaluaciones(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  ids: readonly string[],
): Promise<Map<string, Evaluacion>> {
  const resultado = new Map<string, Evaluacion>();
  let pendientes: Record<string, unknown>[] = ids.map((id) => ({ evaluacion_id: id }));
  while (pendientes.length > 0) {
    const lote = pendientes.slice(0, 100);
    pendientes = pendientes.slice(100);
    let claves: Record<string, unknown>[] | undefined = lote;
    while (claves && claves.length > 0) {
      const respuesta: BatchGetCommandOutput = await dynamo.send(
        new BatchGetCommand({ RequestItems: { [tabla]: { Keys: claves } } }),
      );
      for (const item of respuesta.Responses?.[tabla] ?? []) {
        const evaluacion = item as ItemEvaluacion;
        resultado.set(evaluacion.evaluacion_id, itemAEvaluacion(evaluacion.evaluacion));
      }
      claves = respuesta.UnprocessedKeys?.[tabla]?.Keys;
    }
  }
  return resultado;
}

// ---------------------------------------------------------------------------------------------
// Mapeo explícito entre el dominio (camelCase) y los ítems (snake_case).

interface ItemPedidoHttp {
  url: string;
  estado_http: number | null;
  bytes: number;
  ms: number;
  error?: string | undefined;
}

interface ItemIntento {
  numero: number;
  iniciado_en: string;
  finalizado_en: string;
  pedidos: ItemPedidoHttp[];
  error?: string | undefined;
}

interface ItemConsulta {
  consulta_id: string;
  fuente_id: string;
  fuente_version: number;
  /** Clave del índice por-fuente-estado: `${fuente_id}#${estado}`. */
  fuente_estado: string;
  iniciada_en: string;
  finalizada_en: string;
  estado: EstadoConsulta;
  motivo?: MotivoFalla | undefined;
  detalle?: string | undefined;
  intentos: ItemIntento[];
  huella_recurso?: string | undefined;
  formato_recurso?: string | undefined;
  url_resuelta?: string | undefined;
  cantidad_registros?: number | undefined;
  claves_no_esperadas?: string[] | undefined;
}

function consultaAItem(c: Consulta): ItemConsulta {
  return {
    consulta_id: c.id,
    fuente_id: c.fuenteId,
    fuente_version: c.fuenteVersion,
    fuente_estado: `${c.fuenteId}#${c.estado}`,
    iniciada_en: c.iniciadaEn,
    finalizada_en: c.finalizadaEn,
    estado: c.estado,
    motivo: c.motivo,
    detalle: c.detalle,
    intentos: c.intentos.map(
      (i): ItemIntento => ({
        numero: i.numero,
        iniciado_en: i.iniciadoEn,
        finalizado_en: i.finalizadoEn,
        pedidos: i.pedidos.map((p) => ({
          url: p.url,
          estado_http: p.estadoHttp,
          bytes: p.bytes,
          ms: p.ms,
          error: p.error,
        })),
        error: i.error,
      }),
    ),
    huella_recurso: c.huellaRecurso,
    formato_recurso: c.formatoRecurso,
    url_resuelta: c.urlResuelta,
    cantidad_registros: c.cantidadRegistros,
    claves_no_esperadas: c.clavesNoEsperadas ? [...c.clavesNoEsperadas] : undefined,
  };
}

function itemAConsulta(i: ItemConsulta): Consulta {
  return sinIndefinidos({
    id: i.consulta_id,
    fuenteId: i.fuente_id,
    fuenteVersion: i.fuente_version,
    iniciadaEn: i.iniciada_en,
    finalizadaEn: i.finalizada_en,
    estado: i.estado,
    motivo: i.motivo,
    detalle: i.detalle,
    intentos: i.intentos.map(
      (intento): Intento =>
        sinIndefinidos({
          numero: intento.numero,
          iniciadoEn: intento.iniciado_en,
          finalizadoEn: intento.finalizado_en,
          pedidos: intento.pedidos.map((p) =>
            sinIndefinidos({
              url: p.url,
              estadoHttp: p.estado_http,
              bytes: p.bytes,
              ms: p.ms,
              error: p.error,
            }),
          ),
          error: intento.error,
        }),
    ),
    huellaRecurso: i.huella_recurso,
    formatoRecurso: i.formato_recurso,
    urlResuelta: i.url_resuelta,
    cantidadRegistros: i.cantidad_registros,
    clavesNoEsperadas: i.claves_no_esperadas,
  });
}

interface ItemCredencial {
  credencial_id: string;
  fuente_id: string;
  consulta_id: string;
  obtenida_en: string;
  id_interno: string;
  nombre_informado: string;
  categoria_informada: string;
  provincia_informada: string;
  localidad_informada: string;
  valores_fuente: Record<string, unknown>;
}

function credencialAItem(c: Credencial): ItemCredencial {
  return {
    credencial_id: c.id,
    fuente_id: c.fuenteId,
    consulta_id: c.consultaId,
    obtenida_en: c.obtenidaEn,
    id_interno: c.idInterno,
    nombre_informado: c.nombreInformado,
    categoria_informada: c.categoriaInformada,
    provincia_informada: c.provinciaInformada,
    localidad_informada: c.localidadInformada,
    valores_fuente: { ...c.valoresFuente },
  };
}

function itemACredencial(i: ItemCredencial): Credencial {
  return {
    id: i.credencial_id,
    fuenteId: i.fuente_id,
    consultaId: i.consulta_id,
    obtenidaEn: i.obtenida_en,
    idInterno: i.id_interno,
    nombreInformado: i.nombre_informado,
    categoriaInformada: i.categoria_informada,
    provinciaInformada: i.provincia_informada,
    localidadInformada: i.localidad_informada,
    valoresFuente: i.valores_fuente,
  };
}

interface ItemTipoPosible {
  tipo_trabajo_id: string;
  version: number;
  codigo: string;
  nombre: string;
}

interface ItemVerificacion {
  verificacion_id: string;
  creada_en: string;
  pedido: {
    fuente_id: string;
    gasista: { nombre_apellido: string; localidad?: string | undefined };
    condiciones: Respuestas;
    provincia_trabajo: string;
  };
  consulta_id: string;
  consulta_reutilizada: boolean;
  resultado: ResultadoVerificacion;
  cantidad_coincidencias: number;
  tipos_trabajo_posibles: ItemTipoPosible[];
  coincidencias: { credencial_id: string; evaluacion_id: string }[];
  evidencia_previa_ids: string[];
  mensaje: string;
}

function verificacionAItem(v: Verificacion): ItemVerificacion {
  return {
    verificacion_id: v.id,
    creada_en: v.creadaEn,
    pedido: {
      fuente_id: v.pedido.fuenteId,
      gasista: {
        nombre_apellido: v.pedido.gasista.nombreApellido,
        localidad: v.pedido.gasista.localidad,
      },
      condiciones: { ...v.pedido.condiciones },
      provincia_trabajo: v.pedido.provinciaTrabajo,
    },
    consulta_id: v.consultaId,
    consulta_reutilizada: v.consultaReutilizada,
    resultado: v.resultado,
    cantidad_coincidencias: v.cantidadCoincidencias,
    tipos_trabajo_posibles: v.tiposTrabajoPosibles.map(tipoPosibleAItem),
    coincidencias: v.coincidencias.map((c) => ({
      credencial_id: c.credencialId,
      evaluacion_id: c.evaluacionId,
    })),
    evidencia_previa_ids: [...v.evidenciaPreviaIds],
    mensaje: v.mensaje,
  };
}

function itemAVerificacion(
  i: ItemVerificacion,
  evaluaciones: Map<string, Evaluacion>,
): Verificacion {
  return {
    id: i.verificacion_id,
    creadaEn: i.creada_en,
    pedido: {
      fuenteId: i.pedido.fuente_id,
      gasista: sinIndefinidos({
        nombreApellido: i.pedido.gasista.nombre_apellido,
        localidad: i.pedido.gasista.localidad,
      }),
      condiciones: i.pedido.condiciones,
      provinciaTrabajo: i.pedido.provincia_trabajo,
    },
    consultaId: i.consulta_id,
    consultaReutilizada: i.consulta_reutilizada,
    resultado: i.resultado,
    cantidadCoincidencias: i.cantidad_coincidencias,
    tiposTrabajoPosibles: i.tipos_trabajo_posibles.map(itemATipoPosible),
    coincidencias: i.coincidencias.map((c) => {
      const evaluacion = evaluaciones.get(c.evaluacion_id);
      if (!evaluacion) {
        throw new Error(
          `La Verificación ${i.verificacion_id} apunta a la Evaluación ${c.evaluacion_id}, que no existe.`,
        );
      }
      return { credencialId: c.credencial_id, evaluacionId: c.evaluacion_id, evaluacion };
    }),
    evidenciaPreviaIds: i.evidencia_previa_ids,
    mensaje: i.mensaje,
  };
}

interface ItemEvaluacion {
  evaluacion_id: string;
  verificacion_id: string;
  credencial_id: string;
  evaluacion: ItemDatosEvaluacion;
}

interface ItemDatosEvaluacion {
  resultado: ResultadoEvaluacion;
  criterios: {
    criterio: "CATEGORIA";
    resultado: Evaluacion["criterios"][number]["resultado"];
    categoria_informada: string;
    fundamento: FundamentoCategoria[];
  }[];
  tipos_trabajo_posibles: ItemTipoPosible[];
  resultados_por_tipo: {
    tipo_trabajo_id: string;
    tipo_trabajo_version: number;
    resultado: ResultadoEvaluacion;
    fundamento: FundamentoCategoria | null;
    regla_aplicada: { categorias_admitidas: FundamentoCategoria["categoria"][] };
  }[];
  condiciones_que_resuelven: { condicion_id: string; pregunta: string }[];
  limitaciones: Evaluacion["limitaciones"][number][];
  explicacion: string;
}

function evaluacionAItem(e: Evaluacion): ItemDatosEvaluacion {
  return {
    resultado: e.resultado,
    criterios: e.criterios.map((c) => ({
      criterio: c.criterio,
      resultado: c.resultado,
      categoria_informada: c.categoriaInformada,
      fundamento: c.fundamento.map((f) => ({ ...f })),
    })),
    tipos_trabajo_posibles: e.tiposTrabajoPosibles.map(tipoPosibleAItem),
    resultados_por_tipo: e.resultadosPorTipo.map((r) => ({
      tipo_trabajo_id: r.tipoTrabajoId,
      tipo_trabajo_version: r.tipoTrabajoVersion,
      resultado: r.resultado,
      fundamento: r.fundamento && { ...r.fundamento },
      regla_aplicada: { categorias_admitidas: [...r.reglaAplicada.categoriasAdmitidas] },
    })),
    condiciones_que_resuelven: e.condicionesQueResuelven.map((c) => ({
      condicion_id: c.id,
      pregunta: c.pregunta,
    })),
    limitaciones: e.limitaciones.map((l) => ({ ...l })),
    explicacion: e.explicacion,
  };
}

function itemAEvaluacion(i: ItemDatosEvaluacion): Evaluacion {
  return {
    resultado: i.resultado,
    criterios: i.criterios.map((c) => ({
      criterio: c.criterio,
      resultado: c.resultado,
      categoriaInformada: c.categoria_informada,
      fundamento: c.fundamento,
    })),
    tiposTrabajoPosibles: i.tipos_trabajo_posibles.map(itemATipoPosible),
    resultadosPorTipo: i.resultados_por_tipo.map((r) => ({
      tipoTrabajoId: r.tipo_trabajo_id,
      tipoTrabajoVersion: r.tipo_trabajo_version,
      resultado: r.resultado,
      fundamento: r.fundamento,
      reglaAplicada: { categoriasAdmitidas: r.regla_aplicada.categorias_admitidas },
    })),
    condicionesQueResuelven: i.condiciones_que_resuelven.map((c) => ({
      id: c.condicion_id,
      pregunta: c.pregunta,
    })),
    limitaciones: i.limitaciones,
    explicacion: i.explicacion,
  };
}

function tipoPosibleAItem(t: Verificacion["tiposTrabajoPosibles"][number]): ItemTipoPosible {
  return { tipo_trabajo_id: t.id, version: t.version, codigo: t.codigo, nombre: t.nombre };
}

function itemATipoPosible(t: ItemTipoPosible): Verificacion["tiposTrabajoPosibles"][number] {
  return { id: t.tipo_trabajo_id, version: t.version, codigo: t.codigo, nombre: t.nombre };
}

/** DynamoDB no guarda atributos indefinidos: al leer, tampoco se los agrega. */
function sinIndefinidos<T extends object>(objeto: T): T {
  return Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined)) as T;
}
