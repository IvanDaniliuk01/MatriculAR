# Reglas de categoría y de zona

> Documento de diseño · Segunda entrega · Última revisión: 26/09/2026
> Responde al punto 3 de la devolución v2 ("reglas reales de categoría documentadas") y al punto 2 ("eliminación de la comparación directa provincia = jurisdicción").
> Vocabulario: [`CONTEXT.md`](../CONTEXT.md).

## Índice

1. [Para qué sirve este documento](#1-para-qué-sirve-este-documento)
2. [Marco normativo](#2-marco-normativo)
3. [Criterio de categoría](#3-criterio-de-categoría)
4. [Criterio de zona](#4-criterio-de-zona)
5. [Vigencia: por qué no es un Criterio](#5-vigencia-por-qué-no-es-un-criterio)
6. [Discrepancias entre fuentes](#6-discrepancias-entre-fuentes)
7. [Incertidumbres abiertas y cómo se tratan](#7-incertidumbres-abiertas-y-cómo-se-tratan)
8. [Versionado y actualización de las reglas](#8-versionado-y-actualización-de-las-reglas)
9. [Fuentes consultadas](#9-fuentes-consultadas)

---

## 1. Para qué sirve este documento

La prueba técnica de septiembre automatizó dos reglas que resultaron **incorrectas** (ver la [fe de erratas](../investigacion/MatriculAR_investigacion_fuentes_gas.md) E1 y E2):

- `provincia del padrón != provincia del trabajo → no habilitado`
- `categoria_obtenida >= categoria_requerida`

El programa funcionó según esas reglas, pero produjo conclusiones falsas porque **las reglas no estaban validadas**. Este documento registra, para cada regla que MatriculAR va a automatizar:

- **qué dice la norma**, con cita textual y fuente;
- **qué decidimos automatizar**, y con qué alcance;
- **qué no podemos afirmar**, y cómo lo informa el sistema.

Regla de trabajo del proyecto: **ninguna regla entra al sistema sin una cita que la respalde.** Lo que no tiene respaldo se modela como incertidumbre (`INDETERMINATE`), no como un "no".

---

## 2. Marco normativo

| Elemento | Qué es | Estado a sept-2026 |
|---|---|---|
| **NAG-200** (1982), *Disposiciones y normas mínimas para la ejecución de instalaciones domiciliarias de gas* | Norma técnica de ENARGAS. Su **Capítulo VIII** regula a los instaladores matriculados: categorías, renovación, obligaciones y sanciones. | **Vigente.** Figura como vigente en el listado de normas técnicas de ENARGAS. La Res. ENARGAS 753/2025 se refiere a la "versión actual, vigente desde 1982". |
| **NAG-225** (2025) | Nueva norma que tratará específicamente las matrículas. | **En trámite.** La Res. 753/2025 indica que "oportunamente será puesta en Consulta Pública". |
| **prNAG-225** (2019) | Proyecto anterior de norma de matrículas: examen de actualización cada 5 años, credencial con fecha de vencimiento, listado de matriculados vigentes. | **Proyecto, no vigente.** Solo se usa como contexto; **ninguna regla del sistema se apoya en él.** |
| **Res. ENARGAS 239/2019** | Instruye a las licenciatarias a habilitar las matrículas de 1ª, 2ª y 3ª categoría. | Vigente. |
| **FAQ de ENARGAS** | "Las empresas distribuidoras de gas de cada zona son las que otorgan las matrículas." | Vigente (página institucional). |

**Consecuencia para el diseño:** las reglas se apoyan en la **NAG-200**. Como tanto la NAG-200 como la NAG-225 están en revisión, las reglas se guardan **versionadas** (ver [§8](#8-versionado-y-actualización-de-las-reglas)) y cada Evaluación conserva la versión que aplicó.

> **Nota sobre las citas.** El PDF oficial de la NAG-200 es un documento escaneado. Las citas del Capítulo VIII (págs. 173–179) se transcribieron leyendo las imágenes el 26/09/2026. Antes de la implementación, ambos integrantes del equipo revisan cada cita contra el original.

---

## 3. Criterio de categoría

### 3.1 Qué habilita cada categoría

| Categoría | Qué habilita (cita textual, NAG-200 Cap. VIII) | Quiénes la obtienen |
|---|---|---|
| **1ª** | **8.2.1:** "cualquier tipo de instalaciones domiciliarias domésticas, comerciales o industriales en todo el territorio del país, ya sea para gas distribuido por redes o envasado". | Ingenieros, arquitectos, maestros mayores de obra y técnicos con especialidad en fluidos. |
| **2ª** | **8.3.1:** "instalaciones domiciliarias domésticas, comerciales, industriales o varias en toda la República […] siempre que las tomas correspondan a artefactos cuyos consumos individuales no excedan a 50.000 kcal/h […] y la presión interna […] no supere los 200 mm de columna de agua". Además: "No podrán ejecutar instalaciones […] cuando la presión de distribución sea superior a 2 kg/cm² y en gas licuado cuando fueran alimentadas por tanques a granel". | — |
| **3ª** | **8.4.1:** "en toda la República, instalaciones domiciliarias domésticas, en viviendas unifamiliares, cuyo consumo total no exceda de 5 m³/h de gas natural, suministrado por redes a presión menor de 2 kg/cm²". Para gas envasado queda limitada a "un solo equipo de dos cilindros". | — |

Precisión de MetroGAS sobre la 3ª categoría ([FAQ para matriculados](https://www.metrogas.com.ar/colaboradores/preguntas-frecuentes-para-matriculados/)): "un predio con una única vivienda (quedando excluidos los suministros que pertenecen a edificios, PH, dúplex y similares)".

Regla transversal (NAG-200 Cap. VIII): "toda modificación […], agregado de artefactos o reemplazo de los mismos por otros de distinto tipo o consumo, deberán ser ejecutados por instaladores de Primera, Segunda o Tercera Categoría". Es decir, **conectar o reemplazar un artefacto es trabajo de matriculado**, no de cualquier persona.

### 3.2 Por qué no es una comparación numérica

La prueba técnica usaba `categoria_obtenida >= categoria_requerida`. Eso es incorrecto por dos razones:

1. **Estaba invertida.** La **1ª es la categoría más amplia**: habilita "cualquier tipo de instalaciones". Con la comparación numérica, un gasista de 1ª (el que más puede hacer) quedaba excluido de un trabajo "de 2ª o más". Así se resolvió mal el caso "categoría insuficiente" de la investigación.
2. **Las categorías son alcances, no niveles.** Cada una se define por *tipos de instalación y límites técnicos* (vivienda unifamiliar, consumo por artefacto, consumo total, presión, gas a granel). No existe un eje numérico en el que "más" signifique "puede más cosas". Aunque hoy los alcances parecen anidados (1ª ⊇ 2ª ⊇ 3ª), la inclusión 2ª ⊇ 3ª **es una inferencia nuestra**, no un texto normativo. Una nueva norma podría romperla.

**Decisión:** cada Tipo de trabajo declara una **lista explícita de Categorías admitidas**, y cada categoría admitida o excluida lleva su cita. El Criterio de categoría es:

| Categoría informada por la Fuente | Resultado del Criterio |
|---|---|
| Está en la lista de admitidas del Tipo de trabajo | `MET` |
| Es una categoría conocida (1, 2 o 3) que no está en la lista | `NOT_MET` |
| Vacía, desconocida o fuera del catálogo | `INDETERMINATE` |

Así el sistema **no depende de ningún orden** entre categorías. Como ventaja adicional, si la inferencia del anidamiento fuera falsa, las reglas siguen siendo correctas.

### 3.3 Tipos de trabajo documentados

Siguiendo la indicación del tutor ("seleccionen uno o dos casos de trabajo suficientemente claros"), el P0 documenta **tres** Tipos de trabajo. Los dos primeros cubren el caso más común de un hogar, y el tercero muestra un trabajo que solo puede hacer una categoría.

#### A1 · Conexión o reemplazo de un artefacto en una vivienda unifamiliar

| Campo | Valor |
|---|---|
| Identificador | `artefacto-vivienda-unifamiliar` |
| Descripción para el Cliente | Conectar, reemplazar o agregar un artefacto doméstico (calefón, cocina, calefactor, termotanque) en una casa que es la única vivienda del terreno. |
| Condiciones que asume | 1. Vivienda unifamiliar: un predio con una única vivienda (no edificio, PH, dúplex ni similares). 2. Gas natural por red, con presión de suministro menor de 2 kg/cm². 3. Consumo total de la vivienda de hasta 5 m³/h. 4. Ningún artefacto supera 50.000 kcal/h y la presión interna no supera 200 mm de columna de agua. |
| **Categorías admitidas** | **1ª, 2ª y 3ª** |

| Categoría | ¿Admitida? | Fundamento |
|---|---|---|
| 1ª | Sí | NAG-200 8.2.1: "cualquier tipo de instalaciones domiciliarias domésticas…". |
| 2ª | Sí | NAG-200 8.3.1: domésticas, artefactos de hasta 50.000 kcal/h y presión interna de hasta 200 mm c.a. (condición 4). |
| 3ª | Sí | NAG-200 8.4.1: "viviendas unifamiliares, cuyo consumo total no exceda de 5 m³/h de gas natural, suministrado por redes a presión menor de 2 kg/cm²" (condiciones 1, 2 y 3). |

#### A2 · Conexión o reemplazo de un artefacto en otras viviendas

| Campo | Valor |
|---|---|
| Identificador | `artefacto-vivienda-general` |
| Descripción para el Cliente | Lo mismo que A1, pero en un departamento, PH, dúplex, o en una casa cuyo consumo total supera 5 m³/h. **También es el tipo recomendado si el Cliente no sabe si su vivienda cumple las condiciones de A1.** |
| Condiciones que asume | 1. Gas natural por red, con presión de suministro de hasta 2 kg/cm²; no se alimenta con tanque a granel. 2. Ningún artefacto supera 50.000 kcal/h y la presión interna no supera 200 mm de columna de agua. |
| **Categorías admitidas** | **1ª y 2ª** |

| Categoría | ¿Admitida? | Fundamento |
|---|---|---|
| 1ª | Sí | NAG-200 8.2.1. |
| 2ª | Sí | NAG-200 8.3.1 (condiciones 1 y 2). |
| 3ª | **No** | NAG-200 8.4.1 limita la 3ª a "viviendas unifamiliares" con consumo total de hasta 5 m³/h; la FAQ de MetroGAS excluye "edificios, PH, dúplex y similares". |

#### B · Comercio con un artefacto de alto consumo

| Campo | Valor |
|---|---|
| Identificador | `comercio-artefacto-alto-consumo` |
| Descripción para el Cliente | Instalar, conectar o reemplazar un artefacto en un comercio (restaurante, panadería, local gastronómico) cuando **al menos un artefacto consume más de 50.000 kcal/h**, por ejemplo un horno o anafe industrial. |
| Condiciones que asume | 1. Uso comercial. 2. Gas natural por red. 3. Al menos un artefacto de más de 50.000 kcal/h. 4. **Ningún artefacto supera 150.000 kcal/h** (ver la incertidumbre I5 en [§7](#7-incertidumbres-abiertas-y-cómo-se-tratan)). |
| **Categorías admitidas** | **Solo 1ª** |

| Categoría | ¿Admitida? | Fundamento |
|---|---|---|
| 1ª | Sí | NAG-200 8.2.1: "…domésticas, comerciales o industriales…". |
| 2ª | **No** | NAG-200 8.3.1 limita los artefactos a 50.000 kcal/h cada uno (condición 3). |
| 3ª | **No** | NAG-200 8.4.1 limita la 3ª a instalaciones domésticas en viviendas unifamiliares. |

Limitación propia de B, que se muestra siempre: *"Por excepción (NAG-200, 8.3.1), un instalador de 2ª puede hacer este trabajo con autorización expresa de la distribuidora cuando no hay matriculados de 1ª en la zona. MatriculAR no puede verificar esa autorización."*

> **Por qué B es `NOT_MET` y no `INDETERMINATE` para la 2ª categoría.** La regla general es formal y está citada: la 2ª no puede. La excepción requiere un acto administrativo puntual (la autorización expresa) que ninguna Fuente publica. El sistema aplica la regla general, **informa la excepción como Limitación** y no finge saber si se otorgó.

### 3.4 Tabla de decisión

| Tipo de trabajo | 1ª | 2ª | 3ª |
|---|---|---|---|
| A1 · Artefacto en vivienda unifamiliar | ✅ | ✅ | ✅ |
| A2 · Artefacto en otras viviendas | ✅ | ✅ | ❌ |
| B · Comercio con artefacto de alto consumo | ✅ | ❌ | ❌ |

Cómo elige el Cliente el Tipo de trabajo: la interfaz muestra las **condiciones que asume** cada tipo. Si el Cliente no está seguro de cumplir las condiciones de A1, se le recomienda A2, que es más restrictivo y por lo tanto seguro.

---

## 4. Criterio de zona

### 4.1 Qué se eliminó

Se retira del modelo la regla `provincia del padrón != provincia del trabajo → no habilitado` (punto 2 de la devolución). Tres hechos la invalidan:

1. **La provincia del padrón no es la zona habilitada.** Ecogas no documenta el campo, pero todo indica que es el **domicilio** del matriculado:
   - viene junto con `localidad` y `barrio`;
   - hay un registro con provincia "BUENOS AIRES" y localidad "CIUDAD DE BUENOS AIRES", fuera del área de Ecogas (verificación del 26/09/2026);
   - la prNAG-225 prevé que el listado incluya "Dirección… Localidad, Provincia y Código Postal" del matriculado.

   En el glosario se llama **Provincia informada**, y **nunca se usa para evaluar la zona**.
2. **La NAG-200 da alcance nacional a las tres categorías:** "en todo el territorio del país" (1ª) y "en toda la República" (2ª y 3ª).
3. **Para trabajar en otra zona hay que registrarse en la distribuidora local.** Lo documentan varias distribuidoras:
   - MetroGAS acepta el "registro como matriculado de otra Distribuidora" y aclara que la inscripción es "solamente en una de las empresas distribuidoras […] y tendrá alcance nacional".
   - Litoral Gas pide al matriculado de otra distribuidora "constancia de matrícula habilitada y certificado de libre deuda".
   - El listado de Naturgy BAN tiene una columna "Org Emisor de Matricula".

### 4.2 Regla adoptada

La zona se evalúa comparando la **provincia del trabajo** con el **Área de concesión** de la Distribuidora que publica la Fuente:

| Provincia del trabajo | Qué sabemos | Criterio de zona |
|---|---|---|
| Dentro del Área de concesión de la Fuente | La matrícula figura en el padrón de la distribuidora de esa zona. | `MET` |
| En una provincia donde la Distribuidora opera solo en parte (`area_concesion_parcial`) | El P0 modela la zona por provincia, así que no sabemos si la localidad del trabajo está dentro de la concesión. | `INDETERMINATE` |
| Fuera del Área de concesión de la Fuente | El gasista podría estar registrado en la distribuidora de esa zona, pero no la consultamos. | `INDETERMINATE` |

**El Criterio de zona nunca da `NOT_MET`.** Ninguna evidencia disponible permite afirmar que un gasista *no* puede trabajar en una zona: a lo sumo, no sabemos si puede.

Área de concesión de las Fuentes del P0:

| Fuente | Distribuidora / licenciatarias | Área de concesión |
|---|---|---|
| `ecogas` | Distribuidora de Gas del Centro (Córdoba, Catamarca, La Rioja) y Distribuidora de Gas Cuyana (Mendoza, San Juan, San Luis) | Córdoba, Catamarca, La Rioja, Mendoza, San Juan, San Luis |
| `metrogas` | MetroGAS | Ciudad Autónoma de Buenos Aires y parte del conurbano bonaerense. No interviene en la Evaluación: la Fuente no es consultable automáticamente y nunca produce Credenciales. |

### 4.3 Ejemplos

| Credencial (ficticia) | Provincia del trabajo | Criterio de zona | Por qué |
|---|---|---|---|
| Ecogas, provincia informada Córdoba | San Luis | `MET` | San Luis está en el Área de concesión de Ecogas. **Este es el caso que la prueba técnica resolvió mal** (errata E1). |
| Ecogas, provincia informada Córdoba | Córdoba | `MET` | Córdoba está en el Área de concesión. |
| Ecogas, provincia informada Mendoza | Buenos Aires | `INDETERMINATE` | Buenos Aires está fuera del área de Ecogas. El gasista podría estar registrado en la distribuidora local, pero no la consultamos. |

---

## 5. Vigencia: por qué no es un Criterio

**Regla general (confirmada):**

- NAG-200, 8.5.1: "La matrícula será renovada anualmente, desde el 2 de enero hasta el 31 de marzo". Fuera de plazo hay recargos del 20 % y del 40 %.
- NAG-200: "Transcurridos TRES (3) años sin que el instalador procediera a la renovación […] quedará automáticamente eliminado del registro".
- NAG-200: "Vencido el plazo de renovación […] no se aceptará la presentación de ningún nuevo pedido de gas hasta tanto se abone la misma".
- Ecogas ([Información sobre tu matrícula](https://ecogas.com.ar/matriculados/Informacion-sobre-tu-matricula/categorias)): "La vigencia de la matrícula es anual y vence el 31 de marzo del año siguiente".

**Dato individual (no disponible):** ningún registro del padrón de Ecogas tiene fecha de vigencia, de vencimiento ni de actualización. La página tampoco informa cuándo se actualizó el listado (verificación del 26/09/2026). MetroGAS tampoco informa vigencia.

**Consecuencia:** como la norma mantiene en el registro hasta tres años a quien no renovó, y los listados no muestran suspensiones, **figurar en el padrón no prueba que la matrícula esté vigente.** Por eso:

- la Vigencia **no es un Criterio** y **no participa del resultado** de la Evaluación (si participara, todo resultado sería `INDETERMINATE`);
- se informa **siempre** como Limitación, con este texto: *"La Fuente no informa la vigencia de la matrícula. Según la NAG-200 la matrícula se renueva todos los años y vence el 31 de marzo; figurar en el padrón no prueba que esté renovada. Para confirmarlo, pedile al gasista su carné con la matrícula actualizada (NAG-200, 8.6.1)."*;
- **no se modela ninguna fecha de vencimiento ficticia** (devolución v2: "evitaría incorporar al modelo operativo una fecha_vencimiento ficticia").

El criterio de inclusión en el padrón se preguntó a Ecogas ([`consulta-a-ecogas.md`](consulta-a-ecogas.md)). Si la respuesta confirmara que el listado solo incluye matrículas renovadas, la Vigencia podría pasar a ser un Criterio. Ese cambio se registraría como una nueva versión de la regla y un nuevo ADR.

---

## 6. Discrepancias entre fuentes

| Tema | Fuente A | Fuente B | Qué usamos |
|---|---|---|---|
| Presión máxima de la 3ª categoría | NAG-200 8.4.1: "presión menor de 2 kg/cm²" | FAQ de Ecogas: "presión menor de 4 Kg/cm²" | **NAG-200**, que es la norma primaria. La discrepancia queda registrada. |
| Gas a granel en la 2ª categoría | NAG-200 8.3.1: "No podrán […] cuando fueran alimentadas por tanques a granel" | La FAQ de Ecogas omite esa restricción | **NAG-200.** |
| Alcance territorial de la 3ª categoría | NAG-200 8.4.1: "en toda la República" | La FAQ de Ecogas escribe "en todo el territorio del país" para la 1ª y la 2ª, pero lo omite en la 3ª | **NAG-200.** Además, no afecta al Criterio de zona, que no depende de la categoría. |
| Alcance de la 3ª categoría | NAG-200 8.4.1 (instalaciones domiciliarias en viviendas unifamiliares) | heyoficio.com: "solo reparación y mantenimiento básico" | **NAG-200.** La fuente secundaria se descarta porque contradice la norma. |
| Matrícula en combustión (> 150.000 kcal/h) | MetroGAS sigue exigiéndola | Res. ENARGAS 468/2026, art. 4: deroga la Res. I/902/2009 (régimen de combustión) | **Sin resolver:** por eso el Tipo de trabajo B se acota a artefactos de hasta 150.000 kcal/h (I5). |

---

## 7. Incertidumbres abiertas y cómo se tratan

| # | Incertidumbre | Cómo la trata el sistema | Cómo se podría resolver |
|---|---|---|---|
| I1 | ¿El listado de Ecogas incluye solo matrículas renovadas? | La Vigencia se informa como Limitación y nunca se afirma. | Respuesta de Ecogas (pregunta 1). |
| I2 | ¿Cada cuánto se actualiza el listado? | Cada Credencial lleva la fecha de la Consulta que la produjo, nunca una fecha de "actualización del padrón". | Respuesta de Ecogas (pregunta 2). |
| I3 | ¿La provincia informada es el domicilio? | No se usa para evaluar nada. Se muestra como "provincia informada por la Fuente". | Respuesta de Ecogas (pregunta 3). |
| I4 | ¿Un matriculado de Ecogas Centro puede trabajar en la zona de Ecogas Cuyana sin registrarse aparte? | Hoy el Área de concesión de Ecogas se trata como una sola. Si se confirmara que hacen falta registros separados, se dividiría en dos y el Criterio de zona pasaría a `INDETERMINATE` entre licenciatarias. | Respuesta de Ecogas (pregunta 4). |
| I5 | ¿Rige todavía la matrícula en combustión para artefactos de más de 150.000 kcal/h? | El Tipo de trabajo B se limita a artefactos de hasta 150.000 kcal/h. Los trabajos por encima de ese valor quedan fuera del catálogo. | Leer el texto completo de la Res. 468/2026 y consultar a la distribuidora. |
| I6 | Anidamiento 2ª ⊇ 3ª | **No afecta:** las reglas usan listas explícitas y no dependen del orden entre categorías. | — |
| I7 | La NAG-200 y la NAG-225 se están actualizando | Las reglas están versionadas y las Evaluaciones conservan la versión que aplicaron. | Seguimiento de las publicaciones de ENARGAS. |
| I8 | Las citas provienen de un PDF escaneado | Revisión de ambos integrantes contra el original antes de implementar. | — |

---

## 8. Versionado y actualización de las reglas

Las reglas son **datos, no código** ([ADR-0003](adr/0003-credencial-separada-de-evaluacion-sin-afirmar-vigencia.md) y [modelo de datos](../database/README.md)):

- Cada Tipo de trabajo es un ítem de la tabla `TiposTrabajo`, con clave (`tipo_trabajo_id`, `version`). Guarda las condiciones, las categorías admitidas, el fundamento por categoría (norma, artículo, cita y URL), las Limitaciones propias, `vigente_desde`, `vigente_hasta` y `activo`.
- El catálogo de **Categorías** (`Categorias`) guarda el texto del alcance y su cita. **No tiene ningún campo de orden o nivel**, a propósito.
- Las reglas se cargan desde archivos JSON versionados en [`database/seed/`](../database/seed/). **Cambiar una regla es agregar una versión nueva, nunca editar la anterior.**
- Cada Evaluación guarda una **copia de la regla aplicada** (categorías admitidas, fundamento y versión). Una Evaluación vieja nunca se recalcula con reglas posteriores.

Proceso para cambiar una regla:

1. Se detecta el cambio normativo o el hallazgo, por ejemplo una respuesta de Ecogas o la publicación de la NAG-225.
2. Se documenta en este archivo, con la cita nueva.
3. Se crea el JSON de la nueva versión con `vigente_desde`, y la versión anterior recibe `vigente_hasta`.
4. Revisa el otro integrante del equipo, en un PR.
5. Se aplica con el script de carga de datos.

---

## 9. Fuentes consultadas

Todas consultadas el 26/09/2026.

**Normativa (fuentes primarias)**

- ENARGAS, NAG-200, Cap. VIII (PDF escaneado): <https://www.enargas.gob.ar/secciones/normativa/pdf/normas-tecnicas/NAG-200.pdf>
- ENARGAS, listado de normas técnicas vigentes: <https://www.enargas.gob.ar/secciones/normativa/normas-tecnicas-items.php?grupo=2>
- ENARGAS, Res. 239/2019: <https://wss.enargas.gov.ar:9092/service.asmx/ObtenerArchivo?Tipo=8&Numero=239&Ano=2019>
- ENARGAS, Res. 468/2026: <https://wss.enargas.gov.ar:9092/service.asmx/ObtenerArchivo?Tipo=9&Numero=468&Ano=2026>
- ENARGAS, preguntas frecuentes: <https://www.enargas.gob.ar/secciones/seguridad-en-el-hogar/preguntas-frecuentes.php>

**Distribuidoras (fuentes primarias sobre su propia operatoria)**

- Ecogas, ayuda para matriculados: <https://ecogas.com.ar/matriculados/ayuda>
- Ecogas, categorías y vigencia: <https://ecogas.com.ar/matriculados/Informacion-sobre-tu-matricula/categorias>
- MetroGAS, preguntas frecuentes para matriculados: <https://www.metrogas.com.ar/colaboradores/preguntas-frecuentes-para-matriculados/>
- MetroGAS, requisitos: <https://www.metrogas.com.ar/colaboradores/requisitos/>
- Litoral Gas, gestión de matrículas: <https://www.litoralgas.com.ar/site/gasistas-y-contratistas/gasistas-matriculados/portal-de-tramites-online/gestion-de-matriculas/>
- Naturgy BAN, listado de matriculados: <https://apps.naturgy.com.ar/Matriculados/Jsp/ListMatri.jsp>
- Naturgy BAN, requisitos para matricularse: <https://apps.naturgy.com.ar/Matriculados/docs/Requisitos%20para%20matricularse.pdf>

**Fuentes secundarias (no usadas como respaldo)**

- heyoficio.com: descartada, porque contradice la NAG-200.
- servidos.ar: citada solo como antecedente de mercado (ver el [README](../README.md)).
