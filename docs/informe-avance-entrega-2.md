# Informe de avance · Segunda entrega (Diseño y Módulos)

> **Equipo:** Iván Daniliuk · Nicolás Gabriel Demiryi
> **Fecha:** 26/09/2026 · **Entrega:** 27/09/2026 · **Etapa de la hoja de ruta:** 3. Arquitectura y Módulos
> Este informe es la **puerta de entrada** para revisar la entrega: dice qué se hizo, dónde está y cómo responde a la devolución v2.

## Índice

1. [Resumen](#1-resumen)
2. [Checklist de la consigna](#2-checklist-de-la-consigna)
3. [Respuesta a la devolución v2](#3-respuesta-a-la-devolución-v2)
4. [Sobre el código: por qué esta entrega es solo diseño](#4-sobre-el-código-por-qué-esta-entrega-es-solo-diseño)
5. [Hallazgos nuevos de esta etapa](#5-hallazgos-nuevos-de-esta-etapa)
6. [Qué cambió respecto de la primera entrega](#6-qué-cambió-respecto-de-la-primera-entrega)
7. [Preguntas para el tutor](#7-preguntas-para-el-tutor)
8. [Próximos pasos](#8-próximos-pasos)

---

## 1. Resumen

La devolución v2 nos mostró que **obtener correctamente un dato no implica interpretarlo correctamente**. La prueba técnica funcionaba, pero automatizaba dos reglas falsas (provincia como jurisdicción y categoría como número). En esta etapa:

1. **Validamos las reglas antes de diseñar**, contra fuentes primarias: la NAG-200 de ENARGAS y la documentación de las distribuidoras. Descubrimos que la comparación de categorías **estaba invertida** (la 1ª es la más amplia) y que **ninguna fuente permite afirmar vigencia**.
2. **Rediseñamos el modelo** alrededor de la pregunta que propuso el tutor: *qué sabemos, de dónde lo sabemos, cuándo lo verificamos, qué podemos concluir y qué no podemos afirmar*. La **Credencial** (evidencia) y la **Evaluación** (conclusión para un trabajo) quedaron separadas.
3. **Verificamos de nuevo la Fuente real** (26/09/2026) y encontramos que la prueba técnica **hoy informaría "0 matriculados"**: cambiaron la URL y el orden de los campos. Es exactamente el error que advirtió el tutor, y el adaptador se diseñó para detectarlo.
4. **Documentamos todo lo que pide la consigna** de la segunda entrega: esquema de base de datos, módulos, arquitectura y estructura del repositorio. Todo en Markdown, con diagramas Mermaid que se ven directamente en GitHub.
5. **Registramos las decisiones** en 4 ADRs, y el vocabulario en un glosario ([`CONTEXT.md`](../CONTEXT.md)).

---

## 2. Checklist de la consigna

| Ítem de la consigna | Estado | Dónde |
|---|---|---|
| No se subió código ni implementación | ✅ | Las carpetas `/backend`, `/frontend` e `/infra` solo tienen READMEs y la estructura. Los scripts Python de [`investigacion/`](../investigacion/) son la prueba técnica **que pidió el tutor en la etapa anterior**, identificada como exploración aislada ([ver § 4](#4-sobre-el-código-por-qué-esta-entrega-es-solo-diseño)). |
| Diseño de base de datos completo | ✅ | [`database/README.md`](../database/README.md): 15 tablas, con campos, tipos, claves, "FK", relaciones, índices, patrones de acceso y diagramas entidad-relación. |
| Scripts de base de datos en `/database` | ✅ | [`database/tablas/`](../database/tablas/): definición de cada tabla (formato `CreateTable`, equivalente al DDL). [`database/seed/`](../database/seed/): datos iniciales (equivalente al DML). |
| Listado de módulos con descripción y prioridad | ✅ | [`docs/modulos.md`](modulos.md): 15 módulos, P0 a P3, con dependencias y criterios de terminado. |
| Arquitectura documentada (tecnologías definitivas y justificación) | ✅ | [`docs/arquitectura.md`](arquitectura.md) y [`docs/adr/`](adr/). |
| Estructura de carpetas (`/frontend`, `/backend`, `/database`, `/docs`) | ✅ | Creadas, con un README por carpeta. |
| Diagramas y documentación en `/docs` | ✅ | 19 diagramas Mermaid (en `docs/`, `database/` y el README), validados con el parser de Mermaid. |
| README actualizado | ✅ | [`README.md`](../README.md) |
| Informes de avance en el repositorio | ✅ | Este documento. |
| Documentación en Markdown, recorrible desde GitHub | ✅ | Sin PDFs: el material de la cátedra se sacó del repositorio. |
| Ok del tutor | ⏳ | Pendiente de la revisión. |

---

## 3. Respuesta a la devolución v2

### 3.1 Los ocho puntos pedidos

| # | Pedido del tutor | Qué hicimos | Dónde | Qué queda para la implementación |
|---|---|---|---|---|
| 1 | Modelo corregido separando **Credencial** y **Evaluación** | La Credencial es evidencia inmutable **sin estado de aptitud**. La Evaluación es el resultado de aplicar un Tipo de trabajo (`COMPATIBLE`, `INCOMPATIBLE`, `INDETERMINATE`) con Criterios, fundamento, Limitaciones y copia de la regla aplicada. Solo hay Evaluación si hay Credencial. | [Modelo § 2](modelo-de-dominio.md#2-credencial-no-es-lo-mismo-que-evaluación) · [ADR-0003](adr/0003-credencial-separada-de-evaluacion-sin-afirmar-vigencia.md) · [`CONTEXT.md`](../CONTEXT.md) | Implementar el dominio con TDD a partir de los escenarios S1 a S10. |
| 2 | **Eliminar** la comparación provincia = jurisdicción | Eliminada. La provincia del padrón pasa a ser la *Provincia informada* (el domicilio) y **no se usa para evaluar**. La zona se evalúa contra el **Área de concesión** de la distribuidora y **nunca da `NOT_MET`**: fuera del área es `INDETERMINATE`. | [Reglas § 4](reglas-de-categoria.md#4-criterio-de-zona) · [fe de erratas E1](../investigacion/MatriculAR_investigacion_fuentes_gas.md) | — |
| 3 | **Reglas reales de categoría** documentadas | Categorías según la NAG-200 (Cap. VIII), con citas. Tres Tipos de trabajo (A1, A2, B) con **listas explícitas de categorías admitidas**, sin comparación numérica. Discrepancias e incertidumbres registradas. | [Reglas de categoría](reglas-de-categoria.md) · [`database/seed/tipos-trabajo.json`](../database/seed/tipos-trabajo.json) | Revisión de las citas contra el PDF original (I8). |
| 4 | **Adaptador de Ecogas** integrado al backend | Diseño del puerto de Fuentes y del adaptador `EcogasRecursoNext`: descubre el recurso desde el HTML, decodifica la lista completa, aplica **cinco validaciones** y descarta el contacto. MetroGAS se modela como Fuente no automatizable. | [Fuentes y adaptadores](fuentes-y-adaptadores.md) · [arquitectura § 4](arquitectura.md#4-estructura-interna-capas-y-puertos) | Implementar M01 con las fixtures F1 a F14. |
| 5 | **Persistencia** de fuente, fecha y resultado de la consulta | La tabla `Consultas` guarda Fuente y versión, fechas, estado, motivo, detalle, Intentos con sus pedidos HTTP, **huella SHA-256 del recurso** y cantidad de registros. `ResultadosVerificacion` guarda un resultado por matrícula y `Credenciales` el historial inmutable. | [Base de datos § 6](../database/README.md#6-tablas-del-p0) · [ejemplos](../database/seed/ejemplos-ficticios/) | Implementar M02 con Terraform y los repositorios. |
| 6 | Tratamiento explícito de **NO_ENCONTRADO** frente a **NO_VERIFICABLE** | Son dos respuestas distintas: una es un resultado negativo **de una Fuente concreta en una fecha**, y la otra es **incertidumbre**. Ninguna genera Evaluación. `UNVERIFIABLE` muestra la última evidencia con su fecha, sin usarla para concluir. Nunca se dice "no aparece en ningún padrón". | [Modelo § 5](modelo-de-dominio.md#5-not_found-frente-a-unverifiable) · [API § 3.3](api.md#33-ejemplos) | — |
| 7 | **Manejo controlado del fallo de extracción** | Clasificación de fallas (`SOURCE_UNAVAILABLE` o `EXTRACTION_FAILED`), reintentos solo ante fallas transitorias, Consulta registrada **antes** del primer pedido y camino de error con su diagrama de secuencia. **Una falla nunca produce "0 matriculados" ni borra evidencia anterior.** | [Fuentes § 4.3 a 4.7](fuentes-y-adaptadores.md#43-las-cinco-validaciones) · [API § 6.2](api.md#62-camino-de-error-extracción-fallida-s7) | Implementar y probar las fixtures F5 a F13. |
| 8 | **Interfaz mínima o endpoint** que recorra el flujo completo | `POST /verificaciones` recorre la cadena completa: adaptador → extracción → normalización → persistencia → evaluación → respuesta. También diseñamos la pantalla de verificación y un endpoint de salud de la Fuente. | [API](api.md) · [pantalla](../frontend/README.md) | Implementar M04 y M05. Es el primer ticket de la implementación. |

### 3.2 Observaciones del texto de la devolución

| Observación | Cómo la tomamos |
|---|---|
| *"Antes de automatizar una decisión debemos validar la regla que estamos automatizando."* | Es una regla de trabajo del proyecto: **ninguna regla entra al sistema sin una cita que la respalde** ([reglas § 1](reglas-de-categoria.md#1-para-qué-sirve-este-documento)). Aplicarla nos llevó a descubrir que la comparación de categorías estaba invertida. |
| *"Las categorías representan alcances técnicos diferentes."* | Cada Tipo de trabajo declara el **conjunto** de categorías admitidas. La tabla `Categorias` **no tiene ningún campo de orden**, a propósito. |
| *"La misma credencial puede resultar suficiente para un trabajo y no para otro."* | Escenarios S1 y S2: la misma evidencia (categoría 2ª) da `COMPATIBLE` para A1 y `INCOMPATIBLE` para B. |
| *Vigencia: distinguir dato individual de regla general.* | Encontramos la **regla general** (NAG-200 8.5.1: renovación anual, vence el 31/03; baja recién a los 3 años sin renovar). Justamente por esa regla, **figurar en el padrón no prueba vigencia**. No modelamos fechas de vencimiento ficticias: la Vigencia es una Limitación que el sistema siempre informa y nunca afirma. |
| *Consultar a Ecogas sobre el criterio de inclusión y la frecuencia de actualización.* | Redactamos la consulta con cinco preguntas y registramos qué cambia en el diseño según cada respuesta ([`consulta-a-ecogas.md`](consulta-a-ecogas.md)). |
| *Invariante: la ausencia de evidencia no debe convertirse en certeza.* | Es la **invariante rectora** del modelo y se traduce en reglas concretas: INV-3, INV-4, INV-5, INV-6 e INV-11 ([modelo § 8](modelo-de-dominio.md#8-invariantes)). |
| *Cambiar "automatizable de forma legítima" por una formulación más prudente.* | Ahora dice *"la fuente resultó técnicamente accesible en las condiciones ensayadas"*, con la aclaración de que es una fuente web no contractual ([errata E3](../investigacion/MatriculAR_investigacion_fuentes_gas.md) · [fuentes § 8](fuentes-y-adaptadores.md#8-uso-responsable-de-las-fuentes)). |
| *Precisión metodológica: se procesa la fuente completa y se persiste una muestra.* | Corregido con la frase sugerida ([errata E4](../investigacion/MatriculAR_investigacion_fuentes_gas.md)). En el diseño **no se persiste el padrón**, solo su huella ([ADR-0002](adr/0002-consulta-bajo-demanda-sin-copia-del-padron.md)). |
| *Evitar nombres, teléfonos y correos reales en GitHub.* | Anonimizamos la investigación y los scripts. Todos los ejemplos son ficticios. El diseño **nunca persiste** el email, el teléfono ni el barrio de la Fuente (INV-9). El historial de git todavía conserva la versión anterior: lo vamos a **reescribir después de la aprobación**, para no alterar antes de la revisión commits que ya vio. |
| *La URL fija y el extractor ahora son responsabilidad del adaptador.* | El adaptador descubre el recurso desde el HTML y valida en cinco pasos. Ya pasó en la realidad: el 26/09 la URL fija daba 404 y el patrón encontraba 0 registros ([fuentes § 4.1](fuentes-y-adaptadores.md#41-qué-sabemos-del-recurso)). |
| *Una extracción inesperadamente vacía es un posible error de la fuente: mantener esa regla.* | Mantenida y ampliada: vacía, parcial o con una **caída brusca** de registros cuenta como `EXTRACTION_FAILED` (validaciones V4 y V5). |
| *No dar por justificada una arquitectura compleja de colas y DLQ.* | Eliminadas. Reintentos sincrónicos dentro de la invocación, con los **criterios que justificarían colas** escritos ([ADR-0001](adr/0001-sin-colas-reintentos-sincronicos.md)). |
| *Dejar los scripts aislados y comenzar MatriculAR.* | Los scripts quedan en [`investigacion/`](../investigacion/) como exploración aislada, con su README. El sistema se diseñó desde cero sobre lo aprendido. |

---

## 4. Sobre el código: por qué esta entrega es solo diseño

La devolución v2 pedía ver el adaptador **integrado al backend** y un recorrido ejecutable. La consigna de la segunda entrega, en cambio, establece que *"en esta instancia todavía no se debe subir ningún código ni implementación […] La codificación comenzará recién después de que esta entrega sea aprobada por el tutor"*.

Seguimos la consigna, y respondimos cada punto con **diseño detallado**: contratos, secuencias, esquemas, fixtures y criterios de terminado. Así, **el primer ticket de la implementación es exactamente el recorrido vertical que pidió el tutor**: *adaptador Ecogas → Consulta → Credencial → Evaluación → `POST /verificaciones`*, incluido el camino de error. Si el tutor prefiere ver ese recorrido implementado antes de aprobar, lo hacemos como primera tarea.

Los scripts Python de [`investigacion/`](../investigacion/) son la **prueba técnica mínima que pidió el tutor en la etapa anterior**. No son implementación del sistema, que se hará en TypeScript. Se conservan como evidencia, con su fe de erratas.

---

## 5. Hallazgos nuevos de esta etapa

| Fecha | Hallazgo | Evidencia | Qué cambió |
|---|---|---|---|
| 26/09 | La URL fija del recurso de Ecogas devuelve **404** (con una página HTML), y el patrón de extracción de la prueba encuentra **0 registros**: cambió el orden de las claves. | Verificación con pedidos mínimos, sin guardar datos personales. | Validaciones V1 y V4, y descubrimiento del recurso desde el HTML. |
| 26/09 | Parsear registro por registro **pierde 342 registros** con tildes o Ñ sin que falle nada. | Idem. | Validación V3: se parsea la lista completa. |
| 26/09 | El padrón pasó de 4.512 a **5.031 registros** en tres semanas. No tiene ninguna fecha. | Idem. | Validación V5 (caída brusca) y huella del recurso. |
| 26/09 | Un registro tiene provincia "BUENOS AIRES", fuera del área de Ecogas. | Idem. | Refuerza que la provincia informada es el domicilio (errata E1). |
| 26/09 | **La 1ª categoría es la más amplia**: "cualquier tipo de instalaciones" (NAG-200 8.2.1). | NAG-200, Cap. VIII. | La comparación numérica estaba invertida (errata E2). |
| 26/09 | Las tres categorías tienen alcance **nacional**, pero para trabajar en otra zona hay que registrarse en la distribuidora local. | NAG-200, MetroGAS, Litoral Gas, Naturgy BAN. | Criterio de zona por Área de concesión. |
| 26/09 | Renovación **anual** (vence el 31/03) y baja recién a los **3 años** sin renovar. | NAG-200 8.5.1, Ecogas. | Figurar en el padrón no prueba vigencia (ADR-0003). |
| 26/09 | Desde el 23/03/2026, **LocalStack exige cuenta y token**: se terminó la Community edition. `tflocal` está deprecado. | Blog y documentación de LocalStack. | Se revisó la D1. Diseño compatible con el plan Hobby. `lstk terraform`. |
| 26/09 | **TypeScript 7.0** (compilador nativo) es estable desde el 08/07/2026, pero typescript-eslint todavía no lo soporta. | Blog de TypeScript. | TS 7 y Biome. |
| 26/09 | Las cuentas nuevas de AWS tienen un Free plan de 6 meses con créditos. API Gateway no es gratuito. | Documentación de AWS. | Costos, alerta de presupuesto y riesgo de vencimiento antes de la defensa. |

---

## 6. Qué cambió respecto de la primera entrega

| Tema | Primera entrega | Ahora | Por qué |
|---|---|---|---|
| Enunciado del problema | Garantizar que la habilitación esté "vigente, en la jurisdicción correcta y para la categoría correcta". | Informar, con evidencia fechada y trazable, si una matrícula es **compatible** con un trabajo concreto, distinguiendo lo que se sabe de lo que no se puede verificar. | Ninguna fuente informa vigencia, y "jurisdicción" mezclaba tres conceptos. |
| Diferencial | "Ninguna plataforma lo resuelve." | Existe un verificador puntual multi-distribuidora (servidos.ar). El diferencial es la **compatibilidad por tipo de trabajo, con cita normativa y evidencia fechada**, y la contratación sobre ese núcleo. | Investigación de la etapa anterior. |
| Oficios | Electricistas y gasistas. | **Solo gasistas.** Electricistas en la fase 2. | Toda la evidencia investigada es de gas. |
| Estado del Profesional | `pendiente → verificado → vencido`. | Sin estado de habilitación: Credenciales con historial y Evaluaciones por trabajo. | ADR-0003. |
| Pipeline | S3 → SQS → Lambda → DLQ, más el scheduler. | Sincrónico, con reintentos simples. El scheduler (P3) reutiliza los mismos componentes del núcleo. | ADR-0001. |
| Padrones | Mock configurable. | Adaptadores reales (Ecogas y MetroGAS). Simulaciones solo en los tests. | D4 revisada. |
| Carga de documentos a S3 | Sí. | **Eliminada.** La titularidad se prueba con un código al email que publica la Fuente. | Una foto del carné no prueba nada que el sistema pueda chequear. |
| Lenguaje | Node.js (sin especificar). | **TypeScript 7 sobre Node.js 24**, en frontend y backend. | Arquitectura § 5. |
| LocalStack | "Sin cuenta." | Con cuenta gratuita, más despliegue en AWS real en la etapa 4. | Cambio de licencia y requisito de la etapa 4. |
| Documentación | README con decisiones D1–D6. | README, glosario, 8 documentos de diseño, 4 ADRs y esquema de base de datos. | Consigna de la segunda entrega. |

---

## 7. Preguntas para el tutor

1. **¿Le parece bien que los puntos 4, 5, 7 y 8 de la devolución se respondan con diseño en esta entrega**, y que la implementación del recorrido vertical sea la primera tarea después de la aprobación? ([§ 4](#4-sobre-el-código-por-qué-esta-entrega-es-solo-diseño))
2. **¿Considera suficientes los tres Tipos de trabajo** (A1, A2 y B) para el P0? Priorizamos casos claros y respaldados antes que amplitud.
3. **Criterio de zona:** fuera del Área de concesión de la Fuente, el resultado es `INDETERMINATE` y nunca `NOT_MET`. ¿Le parece adecuado, o preferiría no evaluar la zona en el P0?
4. **Nombre informado:** guardamos el nombre que publica la Fuente para que el Cliente confirme que la matrícula pertenece a la persona que tiene enfrente, y descartamos el contacto. ¿Está de acuerdo con ese criterio de minimización?
5. **Vínculo del Profesional (P1):** proponemos verificar la titularidad de una matrícula con un código enviado al email que publica la propia Fuente, sin guardar ese email. ¿Ve algún reparo?

---

## 8. Próximos pasos

1. **Enviar la consulta a Ecogas** y registrar la respuesta ([`consulta-a-ecogas.md`](consulta-a-ecogas.md)).
2. Incorporar las **correcciones** que pida el tutor.
3. Con el diseño aprobado:
   1. crear las cuentas (plan Student de LocalStack y AWS con alerta de presupuesto);
   2. convertir el diseño en una especificación y en tickets verticales;
   3. implementar el **P0** con TDD, empezando por el dominio y siguiendo por el adaptador de Ecogas, la persistencia, la API y la pantalla;
   4. desplegar en AWS ([plan tentativo](modulos.md#6-plan-tentativo)).
