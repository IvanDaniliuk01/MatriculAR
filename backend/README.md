# Backend

> **Estado (10/11/2026): P0 completo y desplegado en AWS** (<https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1/>). Está implementado:
> - el **dominio de la Evaluación**: clasificación del trabajo por Condiciones decisivas, Criterio de categoría, Limitaciones y explicación, con las reglas cargadas desde [`database/seed/`](../database/seed/);
> - la **búsqueda del gasista** por nombre y localidad ([ADR-0007](../docs/adr/0007-identificacion-por-nombre-y-localidad.md));
> - el **extractor y el lector HTTP de Ecogas**: los dos formatos conocidos del recurso, validaciones V1 a V5, reintentos, descubrimiento del recurso y clasificación de fallas;
> - el **caso de uso Verificar**, con Ventana de reutilización y Protección de la Fuente;
> - los **repositorios** en memoria, en archivo, y en **DynamoDB y S3**;
> - el **handler de la Lambda** con todas las rutas de [`docs/api.md`](../docs/api.md), que además sirve el frontend;
> - un **CLI** (`npm run verificar`) y un **servidor local** (`npm run servir`) que recorren todo contra la Ecogas real.

## Cómo correrlo

Requiere Node.js 24 (`nvm use` toma la versión de `.nvmrc`).

```bash
cd backend
npm install
npm test            # pruebas (Vitest)
npm run check       # lint (Biome) + tipos (tsc) + pruebas: lo mismo que corre la CI

# La misma API que la Lambda, en http://localhost:3000 (para el frontend: npm run dev en frontend/)
npm run servir

# Recorrido completo contra la Fuente real, desde la terminal (ver --ayuda)
npm run verificar -- --nombre "Nombre Apellido" --provincia "Córdoba" \
  --condicion comercio_o_industria=NO --condicion unica_vivienda=NO_SE \
  --condicion consumo_total_hasta_5m3h=NO_SE --condicion artefacto_mas_de_50000=NO \
  --condicion gas_natural_red_baja_presion=SI

# Paquete de la Lambda (incluye el build del frontend si existe frontend/dist)
npm run empaquetar  # → dist/verificacion.zip
```

El CLI y el servidor local guardan las Consultas, Lecturas minimizadas, Credenciales y Verificaciones en `backend/.datos-locales/`, que no se versiona. Así respetan la Ventana de reutilización de 15 minutos entre corridas. Ecogas responde desde una conexión residencial y desde AWS; desde GitHub Actions (Azure) responde 403.

| Variable | Para qué | Valor por defecto |
|---|---|---|
| `MATRICULAR_CONTACTO` | Contacto en el `User-Agent` con que el adaptador se identifica ante Ecogas | URL del repositorio |
| `PORT` | Puerto de `npm run servir` | `3000` |
| `MATRICULAR_ORIGEN_CORS` | Origen admitido por CORS | `*` |
| `MATRICULAR_TABLA_*`, `MATRICULAR_BUCKET_LECTURAS` | Tablas y bucket en AWS. Las define Terraform en la Lambda | — |
| `MATRICULAR_PRUEBAS_AWS` | Habilita `npm run test:aws` (pruebas de contrato contra DynamoDB y S3; crean y borran sus propias tablas y bucket) | apagado |

| Pruebas | Qué demuestran |
|---|---|
| [`compartido/test/dominio/`](compartido/test/dominio/) | Categoría desconocida, "No sé" en una Condición decisiva, Limitación de zona, trabajo no cubierto, el texto de `COMPATIBLE`, la búsqueda con homónimos y la coherencia de las reglas del seed. |
| [`compartido/test/adaptadores/`](compartido/test/adaptadores/) | Los dos formatos de Ecogas, cambio de estructura, extracción incompleta y caída brusca. Siempre `EXTRACTION_FAILED`, nunca "0 matriculados". Los fixtures son sintéticos, con la estructura exacta del recurso real. |
| [`compartido/test/adaptadores/lector-ecogas.test.ts`](compartido/test/adaptadores/lector-ecogas.test.ts) | Lector HTTP: cambio de URL del recurso, 403, 404, 5xx con reintento, presupuesto de tiempo y V5. |
| [`compartido/test/aplicacion/`](compartido/test/aplicacion/) | Caso de uso Verificar: FOUND, homónimos, NOT_FOUND, TOO_MANY_MATCHES, Ventana de reutilización, espera tras una falla, UNVERIFIABLE con la evidencia anterior, MetroGAS y rechazos antes de leer la Fuente. |
| [`compartido/test/recorrido.test.ts`](compartido/test/recorrido.test.ts) | El recorrido página → extracción → gasista → trabajo → Evaluación → explicación. |
| [`compartido/test/adaptadores/repositorios-*.test.ts`](compartido/test/adaptadores/) | Las mismas pruebas de contrato para los repositorios en memoria, en archivo y en AWS: escrituras idempotentes, evidencia que no se pisa, última Consulta por estado e historial de un gasista. La variante de AWS solo corre a mano (`npm run test:aws`). |
| [`compartido/test/adaptadores/esquema-tablas.test.ts`](compartido/test/adaptadores/esquema-tablas.test.ts) | Que las definiciones de [`database/tablas/`](../database/tablas/) sean exactamente las que usa el código. |
| [`verificacion/test/rutas.test.ts`](verificacion/test/rutas.test.ts) | Las rutas de la API: 201, 400, 404, 500, CORS, `/v1` y el formato de las respuestas de [`docs/api.md`](../docs/api.md). Una Fuente que falla responde `201 UNVERIFIABLE`, nunca un `5xx`. |
| [`verificacion/test/sitio.test.ts`](verificacion/test/sitio.test.ts) | El frontend servido por la API: redirección a `/v1/`, tipos, caché, `config.json` del mismo origen y que no se sirvan archivos fuera del build. |
| [`compartido/test/fuente-real/`](compartido/test/fuente-real/) | Lectura de la Ecogas real. Solo corre a mano (`npm run test:fuente-real`) y nunca en CI: el padrón tiene datos personales y no hay que cargar a la Fuente. |

**Resultado al 10/11/2026:** 140 pruebas pasan y 1 se omite en `npm run check`: la de integración con DynamoDB y S3, que crea y borra tablas y un bucket temporales y necesita credenciales de AWS (o `AWS_ENDPOINT_URL` apuntando a LocalStack). Corrida a mano contra AWS real (`AWS_REGION=us-east-2 npm run test:aws`), sus **9 pruebas pasaron** el 10/11/2026.

Backend **serverless** en **TypeScript 7** sobre **Node.js 24** (`nodejs24.x` en AWS Lambda), con arquitectura **hexagonal**: el dominio en el centro, sin dependencias de AWS ni de las Fuentes. Ver [`docs/arquitectura.md`](../docs/arquitectura.md).

## Estructura

```
backend/
├── compartido/        núcleo compartido por todas las funciones (dominio, casos de uso, puertos, adaptadores)
├── verificacion/      λ verificacion · P0 · handlers HTTP del núcleo de verificación
├── profesionales/     λ profesionales · P1 · fuera del alcance de la entrega final
├── contrataciones/    λ contrataciones · P2 · fuera del alcance de la entrega final
├── revalidacion/      λ revalidacion · P3 · fuera del alcance de la entrega final
└── notificaciones/    λ notificaciones · P3 · fuera del alcance de la entrega final
```

**¿Por qué un núcleo compartido?** Las reglas de verificación se usan desde cuatro funciones: verificación, búsqueda, contratación y revalidación. En lugar de que se llamen entre sí por HTTP, cada función incluye el núcleo al empaquetarse (con esbuild). Así hay **una sola implementación de las reglas** y ninguna llamada de red interna.

**Regla de dependencias:** `handlers → aplicacion → dominio`. Los adaptadores implementan los puertos. El dominio no importa nada de `adaptadores/` ni del SDK de AWS.

## Herramientas

| Herramienta | Uso |
|---|---|
| TypeScript 7.0 (`tsc --noEmit`) | Chequeo de tipos |
| esbuild | Un paquete por función, con el AWS SDK v3 incluido ([`scripts/empaquetar.mjs`](scripts/empaquetar.mjs)) |
| Zod | Validación de pedidos, registros de las Fuentes e ítems |
| Vitest | Pruebas unitarias, de contrato y de rutas; las de integración contra AWS, a mano |
| Biome | Lint y formato |
