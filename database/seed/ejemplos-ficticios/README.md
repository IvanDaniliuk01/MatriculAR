# Ejemplos ficticios

> Última revisión: 02/11/2026, según la devolución v3 y el [ADR-0007](../../../docs/adr/0007-identificacion-por-nombre-y-localidad.md) (identificación por nombre y localidad).
>
> **Estos datos son inventados.** Los nombres ("PERSONA FICTICIA UNO"…), los identificadores internos de la Fuente (`1203`, `2311`, `3020`), las huellas SHA-256 y los identificadores no corresponden a ninguna persona ni a ninguna consulta real. Las localidades son reales. Los conteos por categoría y provincia de las Consultas del 26/09 son agregados reales de ese día; los de la Consulta del 20/09 (S0) son ilustrativos. Ninguno contiene datos personales.

Muestran **cómo se ve cada ítem** de las tablas del núcleo en los escenarios del [modelo de dominio](../../../docs/modelo-de-dominio.md#9-escenarios). Sirven como:

- documentación del esquema ([`database/README.md`](../../README.md));
- base para los *fixtures* de los tests en la etapa de implementación.

**Nunca se cargan en la base de datos de ningún entorno** (invariante INV-12: el sistema distingue lo que puede conocer de lo que solo puede simular).

**Claves candidatas.** Los ítems usan la clave candidata `fuente_gasista` (`<fuente_id>#<nombre>#<localidad>`), que se confirma al implementar DynamoDB el 9/11 ([ADR-0007](../../../docs/adr/0007-identificacion-por-nombre-y-localidad.md)). Las Consultas de los ejemplos son anteriores al 02/11, así que su `formato_recurso` es `v1`.

## Escenarios incluidos

| Escenario | Hora (UTC) | Qué muestra | Ítems |
|---|---|---|---|
| S0 (contexto) | 20/09/2026 13:05 | Evidencia previa: PERSONA FICTICIA UNO (Río Cuarto) figuraba con categoría 2ª. | Consulta `SUCCEEDED`, Resultado `FOUND` con 1 Coincidencia, Credencial, Verificación, Evaluación `COMPATIBLE` |
| S7 | 26/09/2026 18:30 | **Camino de error:** el recurso cambió y ningún archivo tiene la lista de registros (falla la validación V2). | Consulta `FAILED` (`EXTRACTION_FAILED`), Resultado `UNVERIFIABLE`, Verificación **sin Evaluación** que adjunta la Credencial del 20/09 como contexto (`credenciales_previas_ref`) |
| S1 | 26/09/2026 18:40 | Categoría 2ª, Condiciones decisivas de A1, en Córdoba. | Consulta `SUCCEEDED` con Lectura minimizada, Credencial nueva con `valores_fuente` (incluido el identificador interno), Evaluación **`COMPATIBLE`** con las Limitaciones de identificación y de zona |
| S2 | 26/09/2026 18:42 | El mismo gasista, pero con Condiciones decisivas de B. | **Reutiliza la Consulta de S1** (Ventana de reutilización): sin descarga nueva y con la misma Credencial. Resultado propio y Evaluación **`INCOMPATIBLE`** (categoría `NOT_MET`) |
| S6 | 26/09/2026 18:45 | Nadie se llama PERSONA FICTICIA CUATRO en Córdoba. | **Reutiliza la Consulta de S1**: Resultado **`NOT_FOUND`** con la fecha real de esa Consulta (18:40), Verificación sin Coincidencias |
| S9 | 26/09/2026 18:48 | MetroGAS, que no es automatizable. | Consulta **`NOT_ATTEMPTED`** sin Intentos, Resultado `UNVERIFIABLE`, Verificación con link al buscador oficial |
| S16 | 26/09/2026 18:50 | **Dos homónimos:** se buscó PERSONA FICTICIA SIETE sin localidad, y hay uno de 2ª en Villa María y otro de 3ª en Río Tercero. | **Reutiliza la Consulta de S1**. Resultado `FOUND` con **2 Coincidencias**: dos Credenciales y dos Evaluaciones `COMPATIBLE`. MatriculAR no elige: el Cliente lo hace con el carné |

Observaciones para leer los archivos:

- **Hay un Resultado por Verificación** (clave candidata `consulta_id` + `verificacion_id`), aunque varias Verificaciones se apoyen en la misma Consulta.
- En S7 la Credencial del 20/09 **no se modifica**: la Verificación solo la referencia como contexto.
- S1 y S2 se apoyan en **la misma Consulta y la misma Credencial**: S2 llegó dos minutos después, dentro de la Ventana de reutilización de 15 minutos ([ADR-0006](../../../docs/adr/0006-lectura-minimizada-y-proteccion-de-la-fuente.md)). La Evaluación es la que cambia, porque depende del trabajo. Las dos Verificaciones informan la fecha real de la Consulta (18:40), no la del pedido.
- El `id` de `valores_fuente` es el **Identificador interno de la Fuente**: nunca se muestra como matrícula (INV-16).
- La Lectura minimizada (`lectura_minimizada_ref`) no se incluye en los ejemplos: se descarta al día siguiente y no es evidencia.
- Ninguna Evaluación tiene Criterio de zona: la zona va como Limitación ([ADR-0005](../../../docs/adr/0005-zona-como-limitacion-en-el-p0.md)).
- Ningún ítem contiene email, teléfono ni barrio.

## Archivos

| Archivo | Tabla |
|---|---|
| [`consultas.json`](consultas.json) | `Consultas` |
| [`resultados-verificacion.json`](resultados-verificacion.json) | `ResultadosVerificacion` |
| [`credenciales.json`](credenciales.json) | `Credenciales` |
| [`verificaciones.json`](verificaciones.json) | `Verificaciones` |
| [`evaluaciones.json`](evaluaciones.json) | `Evaluaciones` |
