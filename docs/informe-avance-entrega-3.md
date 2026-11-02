# Informe de avance · Respuesta a la devolución de la segunda entrega

> **Fecha:** 02/11/2026 · **Etapa de la hoja de ruta:** 4. Informe final, video y despliegue (implementación)
> Responde a la devolución v3 del tutor ("Modelo y Arquitectura: conforme con correcciones importantes").

## Índice

1. [Resumen](#1-resumen)
2. [Hallazgo principal: Ecogas no publica el número de matrícula](#2-hallazgo-principal-ecogas-no-publica-el-número-de-matrícula)
3. [Respuesta a la devolución, punto por punto](#3-respuesta-a-la-devolución-punto-por-punto)
4. [Qué demuestran hoy el código y los tests](#4-qué-demuestran-hoy-el-código-y-los-tests)
5. [Decisiones nuevas (ADR)](#5-decisiones-nuevas-adr)
6. [Preguntas para el tutor](#6-preguntas-para-el-tutor)
7. [Próximos pasos](#7-próximos-pasos)

---

## 1. Resumen

- **Empezó la implementación.** El dominio de la Evaluación, la búsqueda del gasista y el extractor de Ecogas están en TypeScript, con **62 pruebas** en Vitest y CI en GitHub Actions (lint, tipos y pruebas en cada push). Instrucciones en [`backend/README.md`](../backend/README.md).
- **Aplicamos la regla de la devolución a todas las reglas:** si la evidencia no permite afirmar algo, el software tampoco lo afirma. La zona pasó a ser una Limitación, un "No sé" nunca se toma como "Sí" y `COMPATIBLE` ya no promete habilitación.
- **Al probar el adaptador contra la Ecogas real apareció un hallazgo que cambia el núcleo:** el padrón **no publica el número de matrícula**. El campo `id`, que tomamos como matrícula en la primera entrega, es una numeración interna. Ahora el gasista se identifica por nombre y localidad ([§ 2](#2-hallazgo-principal-ecogas-no-publica-el-número-de-matrícula)).
- Corregimos la documentación según cada punto ([§ 3](#3-respuesta-a-la-devolución-punto-por-punto)) y registramos tres decisiones nuevas: ADR-0005, 0006 y 0007.

---

## 2. Hallazgo principal: Ecogas no publica el número de matrícula

El 02/11 corrimos el adaptador contra la página actual de Ecogas, identificándonos con un User-Agent honesto ([`scripts/probar-ecogas.sh`](../scripts/probar-ecogas.sh)). Encontramos dos cosas.

**1. La estructura cambió por tercera vez.** Los datos ya no están en un archivo JavaScript aparte: vienen dentro del HTML de la página (1,5 MB), en el contenido que Next.js le pasa a React (`self.__next_f.push`). Además, `categoria`, `provincia` y `localidad` pasaron a ser objetos. El extractor de septiembre habría fallado. Con el diseño actual, falla como `EXTRACTION_FAILED` y nunca como "0 matriculados". El extractor nuevo reconoce los dos formatos y, contra la página real, lee los **4.836 registros** sin claves inesperadas.

**2. El `id` no es la matrícula.** Los 4.836 registros tienen `id` 1, 2, 3… 4836, consecutivos y sin huecos. Ninguna otra clave contiene la matrícula, y el buscador oficial de Ecogas filtra por provincia, localidad, categoría y nombre, nunca por matrícula. La investigación de septiembre afirmó "`id` (matrícula)" sin verificarlo.

Es el mismo aprendizaje de la primera prueba, ahora sobre la identidad: **obtener un dato no implica interpretarlo correctamente.** Sin este hallazgo, MatriculAR habría respondido "la matrícula 91 figura con categoría 2ª" sobre una persona cualquiera, la que estaba en la fila 91.

**Qué cambiamos** ([ADR-0007](adr/0007-identificacion-por-nombre-y-localidad.md)):

- El Cliente busca al gasista por **nombre y apellido, y opcionalmente la localidad**. Una Coincidencia es un registro que contiene todas las palabras buscadas, sin importar el orden, las mayúsculas ni las tildes.
- Si hay **homónimos**, se muestran todos, cada uno con su Credencial y su Evaluación, y el Cliente elige con el carné. MatriculAR nunca elige por él. En la lectura del 02/11 hay 12 nombres repetidos, y 4 que además comparten localidad.
- Si coinciden más de 10, el resultado es `TOO_MANY_MATCHES`, no `NOT_FOUND`: la persona puede estar entre ellos.
- Toda Credencial de Ecogas lleva la Limitación *"Ecogas no publica el número de matrícula: la identificación es por nombre y localidad. Confirmala con el carné del gasista"*.
- Sumamos una pregunta a la consulta a Ecogas: si podrían publicar el número de matrícula.

Otros datos de esa lectura: el padrón bajó de 5.031 a 4.836 registros (−3,9 %, dentro del umbral de la validación V5) y la descarga tardó 13,6 s. El timeout de 6 s que habíamos diseñado la habría hecho fallar siempre, así que lo ajustamos ([fuentes y adaptadores](fuentes-y-adaptadores.md)).

---

## 3. Respuesta a la devolución, punto por punto

| Observación del tutor | Qué hicimos | Dónde |
|---|---|---|
| **Zona:** con I4 abierta, S4 no puede concluir `MET`. | La zona dejó de ser un Criterio y pasó a ser una **Limitación**. Además, el padrón no informa en qué licenciataria (Centro o Cuyana) está registrado cada gasista, así que ninguna provincia puede afirmarse sin inventar una regla. S4 da `COMPATIBLE` por categoría, con la Limitación de zona. | [ADR-0005](adr/0005-zona-como-limitacion-en-el-p0.md) · [reglas § 4](reglas-de-categoria.md) · test *"Zona: es una Limitación"* |
| **Clasificación del trabajo:** elegir A1 supone condiciones que el Cliente puede no conocer. | El Cliente ya no elige un Tipo de trabajo: responde cinco **Condiciones decisivas** (Sí, No o No sé), cada una con su cita, y el sistema deduce los Tipos posibles. Un No sé abre las dos posibilidades. Si todas dan el mismo resultado, se informa ese resultado. Si no, `INDETERMINATE`, diciendo qué dato lo resolvería. Si ninguna posibilidad está cubierta por una regla, el pedido se rechaza antes de consultar la Fuente. | [reglas § 3.5](reglas-de-categoria.md) · [`condiciones-decisivas.json`](../database/seed/condiciones-decisivas.json) · tests de clasificación y de *"No sé"* |
| **Texto de COMPATIBLE:** "que puede realizar este trabajo" promete de más. | El texto es ahora: *"La categoría informada (2ª) es compatible con este tipo de trabajo según la regla aplicada (NAG-200, 8.3.1). La vigencia de la matrícula no pudo verificarse."* Un test verifica que ninguna explicación diga "puede realizar", "habilitado", "apto" ni "vigente". | [modelo § 6](modelo-de-dominio.md) · test *"Cómo se expresa el resultado"* |
| **Enviar la consulta a Ecogas ya.** | Agregamos el pedido concreto de uso automatizado (una descarga cada 15 minutos, desde AWS, con User-Agent identificado) y la pregunta por el número de matrícula. **Estado: se envía el 02/11 por los dos formularios (Centro y Cuyo).** | [consulta a Ecogas](consulta-a-ecogas.md) |
| **Probar temprano el adaptador, identificándose, desde el entorno de despliegue.** | Desde una conexión residencial, Ecogas respondió **HTTP 200** a un User-Agent honesto (el prototipo de septiembre se hacía pasar por un navegador). **La prueba desde AWS (CloudShell) se corre el 02/11** con el mismo script. | [`scripts/probar-ecogas.sh`](../scripts/probar-ecogas.sh) · [§ 2](#2-hallazgo-principal-ecogas-no-publica-el-número-de-matrícula) |
| **Política de consultas:** no amplificar pedidos anónimos contra un tercero. | Una lectura exitosa se reutiliza durante **15 minutos** (Ventana de reutilización), con una **Lectura minimizada** sin datos de contacto que se descarta al día siguiente. Después de una falla se espera un minuto (`SOURCE_RATE_LIMITED`). Cada respuesta informa la fecha real de la lectura. El throttling de la API protege a MatriculAR y es otra cosa. | [ADR-0006](adr/0006-lectura-minimizada-y-proteccion-de-la-fuente.md) |
| **Huella SHA-256:** no permite reconstruir el recurso. | Corregimos la definición. Cada Credencial guarda los **valores tal como vinieron de la Fuente** (`valores_fuente`), además de la versión normalizada, sin email, teléfono ni barrio. El extractor ya lo hace y un test lo verifica. | [glosario](../CONTEXT.md) · test *"nunca conserva email, teléfono ni barrio"* |
| **P1:** el código al email prueba control del canal, no identidad. | El Vínculo `VERIFIED` se define como "vínculo verificado mediante el email publicado por la Fuente". P1 queda fuera del alcance de la entrega final. | [glosario](../CONTEXT.md) |
| **Orden del trabajo:** primero un recorrido local y después la infraestructura. | Nuevo orden: dominio y adaptador con un recorrido local, después DynamoDB y Lambda en LocalStack, y por último Terraform en AWS. Cognito, SES, EventBridge y SNS pasan a la fase 2. | [arquitectura § 1.1](arquitectura.md) · [módulos § 6](modulos.md) |
| **Esquema:** `Categorias.version` sin clave, y `vigente_hasta` contra "nunca se modifica". | `Categorias` no se versiona: la regla vive en `TiposTrabajo`. Eliminamos `vigente_hasta`: el fin de una versión se deduce del `vigente_desde` de la siguiente, así que ninguna versión se modifica nunca. | [base de datos](../database/README.md) |
| **Comenzar el vertical del P0, con código y tests.** | Ver [§ 4](#4-qué-demuestran-hoy-el-código-y-los-tests). | [`backend/`](../backend/) |

---

## 4. Qué demuestran hoy el código y los tests

Recorrido pedido: *Fuente actual de Ecogas → extracción válida → gasista → trabajo → evaluación → respuesta explicable*. Hoy corre completo sobre un fixture con la estructura exacta de la página actual ([`recorrido.test.ts`](../backend/compartido/test/recorrido.test.ts)), y el extractor está probado contra la página real (`npm run test:fuente-real`, a mano y nunca en CI, porque el padrón tiene datos personales). Faltan la evidencia persistida (Consulta, Credencial y huella), el acceso HTTP con reintentos y la API.

Los casos que pidió el tutor:

| Caso | Qué responde el sistema | Prueba |
|---|---|---|
| **Cambio de estructura** | `EXTRACTION_FAILED` (V2 o V3), y en el recorrido `UNVERIFIABLE`, nunca "no encontrado" | [`extraccion-ecogas.test.ts`](../backend/compartido/test/adaptadores/extraccion-ecogas.test.ts): *"la propiedad del padrón cambió de nombre"*, *"la página ya no trae el payload"*. Además, los dos formatos reales (septiembre y noviembre) se reconocen. |
| **Cambio de URL** | Pendiente: lo resuelve la capa HTTP (descubrir el recurso desde la página), del 3 al 8/11 | — |
| **Extracción incompleta** | `EXTRACTION_FAILED` (V4): padrón vacío, registro sin clave obligatoria o identificadores repetidos. V5: caída brusca de la cantidad | *"el padrón viene vacío"*, *"a un registro le falta una clave obligatoria"*, *"V5: caída brusca"* |
| **Categoría desconocida** | La Credencial la conserva tal como vino y la Evaluación da `INDETERMINATE`: *"La Fuente informa la categoría «4», que MatriculAR no reconoce"* | [`evaluacion.test.ts`](../backend/compartido/test/dominio/evaluacion.test.ts) y el recorrido con homónimos |
| **Incertidumbre de zona** | Limitación en toda Evaluación, con un texto dentro del Área de concesión y otro fuera | *"S4: matrícula de Ecogas y trabajo en San Luis"*, *"fuera del Área de concesión"* |
| **No sé en una condición** | 2ª: `COMPATIBLE`, porque el dato no cambia nada. 3ª: `INDETERMINATE`, porque depende de «¿El terreno tiene una única vivienda?» | *"Evaluación con Condiciones decisivas en No sé"* |
| **Regla sin cita** | El sistema no arranca: las reglas se validan al cargarse | [`reglas.test.ts`](../backend/compartido/test/dominio/reglas.test.ts) |

---

## 5. Decisiones nuevas (ADR)

| ADR | Decisión |
|---|---|
| [0005](adr/0005-zona-como-limitacion-en-el-p0.md) | La zona es una Limitación, no un Criterio, mientras Ecogas no responda I4. |
| [0006](adr/0006-lectura-minimizada-y-proteccion-de-la-fuente.md) | Una Lectura minimizada se reutiliza 15 minutos para proteger a la Fuente (modifica ADR-0002). |
| [0007](adr/0007-identificacion-por-nombre-y-localidad.md) | El gasista se identifica por nombre y localidad, porque Ecogas no publica la matrícula. |

---

## 6. Preguntas para el tutor

1. **Identificación por nombre (ADR-0007).** ¿Le parece adecuado mostrar todos los homónimos con su Evaluación y que el Cliente elija con el carné? ¿O preferiría que la Verificación no concluya nada cuando hay más de una Coincidencia?
2. **Trabajo no cubierto.** Si las respuestas no dejan ningún Tipo de trabajo posible (por ejemplo, gas envasado), rechazamos el pedido antes de consultar a Ecogas en lugar de devolver `INDETERMINATE`, para no descargar el padrón sin necesidad. ¿Está de acuerdo?
3. **Límite del Tipo B.** No preguntamos si algún artefacto supera 150.000 kcal/h, y lo informamos como Limitación. ¿Alcanza, o conviene una sexta Condición decisiva?

---

## 7. Próximos pasos

| Fechas | Trabajo |
|---|---|
| 02/11 | Enviar la consulta a Ecogas y correr la prueba desde AWS. |
| 03 al 08/11 | Acceso HTTP al recurso con reintentos y descubrimiento de la URL, Consulta y Credencial con su huella (repositorios en memoria) y recorrido completo por línea de comandos. |
| 09 al 13/11 | DynamoDB en LocalStack (con las claves rediseñadas por ADR-0007), Lambda y API. |
| 14 al 17/11 | Terraform en AWS y una pantalla mínima en React. |
| 18 al 21/11 | Informe final y video. |
