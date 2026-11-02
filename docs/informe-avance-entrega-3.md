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

- **Empezó la implementación, y el recorrido del P0 ya corre completo contra la Ecogas real** desde la línea de comandos: lectura con reintentos, evidencia, Evaluación y respuesta explicable. Todo en TypeScript, con **91 pruebas** en Vitest y CI en GitHub Actions (lint, tipos y pruebas en cada push). Instrucciones en [`backend/README.md`](../backend/README.md).
- **Aplicamos la regla de la devolución a todas las reglas:** si la evidencia no permite afirmar algo, el software tampoco lo afirma. La zona pasó a ser una Limitación, un "No sé" nunca se toma como "Sí" y `COMPATIBLE` ya no promete habilitación.
- **Al probar el adaptador contra la Ecogas real apareció un hallazgo que cambia el núcleo:** el padrón **no publica el número de matrícula**. El campo `id`, que tomamos como matrícula en la primera entrega, es una numeración interna. Ahora el gasista se identifica por nombre y localidad ([§ 2](#2-hallazgo-principal-ecogas-no-publica-el-número-de-matrícula)).
- **La prueba que pidió desde el entorno de nube dio un resultado decisivo:** con el mismo User-Agent identificado, Ecogas responde desde una IP residencial y **rechaza (403) desde una IP de datacenter**. Planteamos cómo seguir en la [pregunta 1](#6-preguntas-para-el-tutor).
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

**3. Desde una IP de nube, Ecogas rechaza el pedido.** Con el mismo User-Agent identificado, la página respondió **HTTP 200 desde una IP residencial** y **HTTP 403 desde un runner de GitHub Actions** (Azure): 118 bytes en 0,4 s, la firma típica de un firewall que filtra IPs de datacenter ([workflow](../.github/workflows/probar-ecogas.yml)). Todavía no lo probamos desde AWS, pero lo más probable es que también esté bloqueado. Es el escenario que anticipó la devolución: el sistema sigue siendo coherente, porque responde `UNVERIFIABLE` y nunca "no encontrado", pero desplegado en la nube no podría leer la única Fuente automatizable del P0. **No vamos a eludir el bloqueo** (User-Agent de navegador, proxies residenciales): planteamos las alternativas en la [pregunta 1](#6-preguntas-para-el-tutor).

Otros datos de esa lectura: el padrón bajó de 5.031 a 4.836 registros (−3,9 %, dentro del umbral de la validación V5) y la descarga tardó 13,6 s. El timeout de 6 s que habíamos diseñado la habría hecho fallar siempre, así que lo ajustamos ([fuentes y adaptadores](fuentes-y-adaptadores.md)).

---

## 3. Respuesta a la devolución, punto por punto

| Observación del tutor | Qué hicimos | Dónde |
|---|---|---|
| **Zona:** con I4 abierta, S4 no puede concluir `MET`. | La zona dejó de ser un Criterio y pasó a ser una **Limitación**. Además, el padrón no informa en qué licenciataria (Centro o Cuyana) está registrado cada gasista, así que ninguna provincia puede afirmarse sin inventar una regla. S4 da `COMPATIBLE` por categoría, con la Limitación de zona. | [ADR-0005](adr/0005-zona-como-limitacion-en-el-p0.md) · [reglas § 4](reglas-de-categoria.md) · test *"Zona: es una Limitación"* |
| **Clasificación del trabajo:** elegir A1 supone condiciones que el Cliente puede no conocer. | El Cliente ya no elige un Tipo de trabajo: responde cinco **Condiciones decisivas** (Sí, No o No sé), cada una con su cita, y el sistema deduce los Tipos posibles. Un No sé abre las dos posibilidades. Si todas dan el mismo resultado, se informa ese resultado. Si no, `INDETERMINATE`, diciendo qué dato lo resolvería. Si ninguna posibilidad está cubierta por una regla, el pedido se rechaza antes de consultar la Fuente. | [reglas § 3.5](reglas-de-categoria.md) · [`condiciones-decisivas.json`](../database/seed/condiciones-decisivas.json) · tests de clasificación y de *"No sé"* |
| **Texto de COMPATIBLE:** "que puede realizar este trabajo" promete de más. | El texto es ahora: *"La categoría informada (2ª) es compatible con este tipo de trabajo según la regla aplicada (NAG-200, 8.3.1). La vigencia de la matrícula no pudo verificarse."* Un test verifica que ninguna explicación diga "puede realizar", "habilitado", "apto" ni "vigente". | [modelo § 6](modelo-de-dominio.md) · test *"Cómo se expresa el resultado"* |
| **Enviar la consulta a Ecogas ya.** | Agregamos el pedido concreto de uso automatizado (una descarga cada 15 minutos, desde AWS, con User-Agent identificado) y la pregunta por el número de matrícula. **Estado: texto listo, pendiente de envío por los dos formularios (Centro y Cuyo).** Después del bloqueo desde la nube, la pregunta 5 pasó a ser un pedido de autorización. | [consulta a Ecogas](consulta-a-ecogas.md) |
| **Probar temprano el adaptador, identificándose, desde el entorno de despliegue.** | Con un User-Agent honesto (el prototipo de septiembre se hacía pasar por un navegador), Ecogas respondió **HTTP 200 desde una IP residencial** y **HTTP 403 desde una IP de nube** (GitHub Actions, Azure). La prueba se repite desde AWS al desplegar. | [`scripts/probar-ecogas.sh`](../scripts/probar-ecogas.sh) · [§ 2](#2-hallazgo-principal-ecogas-no-publica-el-número-de-matrícula) |
| **Política de consultas:** no amplificar pedidos anónimos contra un tercero. | Una lectura exitosa se reutiliza durante **15 minutos** (Ventana de reutilización), con una **Lectura minimizada** sin datos de contacto que se descarta al día siguiente. Después de una falla se espera un minuto (`SOURCE_RATE_LIMITED`). Cada respuesta informa la fecha real de la lectura. El throttling de la API protege a MatriculAR y es otra cosa. | [ADR-0006](adr/0006-lectura-minimizada-y-proteccion-de-la-fuente.md) |
| **Huella SHA-256:** no permite reconstruir el recurso. | Corregimos la definición. Cada Credencial guarda los **valores tal como vinieron de la Fuente** (`valores_fuente`), además de la versión normalizada, sin email, teléfono ni barrio. El extractor ya lo hace y un test lo verifica. | [glosario](../CONTEXT.md) · test *"nunca conserva email, teléfono ni barrio"* |
| **P1:** el código al email prueba control del canal, no identidad. | El Vínculo `VERIFIED` se define como "vínculo verificado mediante el email publicado por la Fuente". P1 queda fuera del alcance de la entrega final. | [glosario](../CONTEXT.md) |
| **Orden del trabajo:** primero un recorrido local y después la infraestructura. | Nuevo orden: dominio y adaptador con un recorrido local, después DynamoDB y Lambda en LocalStack, y por último Terraform en AWS. Cognito, SES, EventBridge y SNS pasan a la fase 2. | [arquitectura § 1.1](arquitectura.md) · [módulos § 6](modulos.md) |
| **Esquema:** `Categorias.version` sin clave, y `vigente_hasta` contra "nunca se modifica". | `Categorias` no se versiona: la regla vive en `TiposTrabajo`. Eliminamos `vigente_hasta`: el fin de una versión se deduce del `vigente_desde` de la siguiente, así que ninguna versión se modifica nunca. | [base de datos](../database/README.md) |
| **Comenzar el vertical del P0, con código y tests.** | Ver [§ 4](#4-qué-demuestran-hoy-el-código-y-los-tests). | [`backend/`](../backend/) |

---

## 4. Qué demuestran hoy el código y los tests

Recorrido pedido: *Fuente actual de Ecogas → extracción válida → gasista → evidencia → trabajo → evaluación → respuesta explicable*. **Hoy corre completo contra la Ecogas real** desde la línea de comandos:

```bash
cd backend && npm run verificar -- --nombre "Juan Gonzalez" --provincia "San Luis" \
  --condicion comercio_o_industria=NO --condicion unica_vivienda=NO_SE \
  --condicion consumo_total_hasta_5m3h=NO_SE --condicion artefacto_mas_de_50000=NO \
  --condicion gas_natural_red_baja_presion=SI
```

- **Lectura:** descarga y valida el padrón (4.836 registros, formato v2, con su huella SHA-256), con reintentos y la clasificación de fallas.
- **Evidencia:** guarda la Consulta, la Lectura minimizada y una Credencial por Coincidencia, con los valores tal como vinieron.
- **Evaluación:** responde con su explicación y sus Limitaciones.
- **Protección de la Fuente:** una segunda búsqueda dentro de los 15 minutos **reutiliza la lectura** (0,5 s en lugar de 5 s) e informa la fecha real.

La persistencia es un archivo local que no se versiona. DynamoDB y la API vienen después, sobre los mismos puertos. El caso de uso está cubierto por pruebas con un lector falso ([`verificar.test.ts`](../backend/compartido/test/aplicacion/verificar.test.ts)), y el lector HTTP con un cliente HTTP falso ([`lector-ecogas.test.ts`](../backend/compartido/test/adaptadores/lector-ecogas.test.ts)). En total son **91 pruebas**.

Los casos que pidió el tutor:

| Caso | Qué responde el sistema | Prueba |
|---|---|---|
| **Cambio de estructura** | `EXTRACTION_FAILED` (V2 o V3), y en el recorrido `UNVERIFIABLE`, nunca "no encontrado" | [`extraccion-ecogas.test.ts`](../backend/compartido/test/adaptadores/extraccion-ecogas.test.ts): *"la propiedad del padrón cambió de nombre"*, *"la página ya no trae el payload"*. Además, los dos formatos reales (septiembre y noviembre) se reconocen. |
| **Cambio de URL** | El recurso se descubre desde la página en cada lectura: si el archivo con los datos cambia de nombre, se encuentra igual. Si la página del listado desaparece (404), `EXTRACTION_FAILED` sin reintentar | [`lector-ecogas.test.ts`](../backend/compartido/test/adaptadores/lector-ecogas.test.ts): cambio de URL del recurso, prefijo ausente, página 404 |
| **La Fuente bloquea o falla** | 403 → `SOURCE_UNAVAILABLE` sin reintentar (el caso real desde la nube). 5xx o timeout → reintenta dentro del presupuesto. En la respuesta: `UNVERIFIABLE`, con la evidencia anterior como contexto y sin concluir | `lector-ecogas.test.ts` y [`verificar.test.ts`](../backend/compartido/test/aplicacion/verificar.test.ts) |
| **Protección de la Fuente** | Reutiliza la lectura 15 minutos. Después de una falla espera 1 minuto (`SOURCE_RATE_LIMITED`) | `verificar.test.ts`: *"Protección de la Fuente"* |
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

1. **Ecogas bloquea las IPs de nube ([§ 2](#2-hallazgo-principal-ecogas-no-publica-el-número-de-matrícula), punto 3).** Hasta que Ecogas responda el pedido de autorización, ¿cómo prefiere que se demuestre el P0 desplegado?
   - (a) **Desplegar igual en AWS.** Si el bloqueo se confirma, el servicio responde `UNVERIFIABLE` con el motivo, y el recorrido completo con lectura real se demuestra localmente (LocalStack, desde una IP residencial) y con las pruebas.
   - (b) **Separar la lectura del despliegue.** La lectura de la Fuente corre en un equipo con IP residencial, identificada y a la frecuencia permitida, y publica la Lectura minimizada en la nube, donde se evalúa. Es más complejo, y además conviene que Ecogas lo autorice.
   - Descartamos eludir el bloqueo (simular un navegador o usar proxies): contradice la identificación honesta que pidió y la decisión de la propia Fuente.
2. **Identificación por nombre (ADR-0007).** ¿Le parece adecuado mostrar todos los homónimos con su Evaluación y que el Cliente elija con el carné? ¿O preferiría que la Verificación no concluya nada cuando hay más de una Coincidencia?
3. **Trabajo no cubierto.** Si las respuestas no dejan ningún Tipo de trabajo posible (por ejemplo, gas envasado), rechazamos el pedido antes de consultar a Ecogas en lugar de devolver `INDETERMINATE`, para no descargar el padrón sin necesidad. ¿Está de acuerdo?
4. **Límite del Tipo B.** No preguntamos si algún artefacto supera 150.000 kcal/h, y lo informamos como Limitación. ¿Alcanza, o conviene una sexta Condición decisiva?

---

## 7. Próximos pasos

| Fechas | Trabajo |
|---|---|
| 02/11 | Enviar la consulta a Ecogas, que ahora incluye el pedido de autorización para leer desde la nube. |
| ~~03 al 08/11~~ | ~~Acceso HTTP con reintentos, Consulta y Credencial con su huella, y recorrido completo por línea de comandos.~~ **Hecho el 02/11.** |
| 09 al 13/11 | DynamoDB en LocalStack (con las claves rediseñadas por ADR-0007), Lambda y API. |
| 14 al 17/11 | Terraform en AWS (con la prueba de acceso a Ecogas desde AWS) y una pantalla mínima en React. |
| 18 al 21/11 | Informe final y video. |
