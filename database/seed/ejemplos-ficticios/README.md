# Ejemplos ficticios

> **Estos datos son inventados.** Las matrículas (serie 99001–99005), los nombres ("PERSONA FICTICIA UNO"), las huellas SHA-256 y los identificadores no corresponden a ninguna persona ni a ninguna consulta real. Los conteos por categoría y provincia de las Consultas del 26/09 son agregados reales de ese día; los de la Consulta del 20/09 (S0) son ilustrativos. Ninguno contiene datos personales.

Muestran **cómo se ve cada ítem** de las tablas del núcleo en los escenarios del [modelo de dominio](../../../docs/modelo-de-dominio.md#9-escenarios). Sirven como:

- documentación del esquema ([`database/README.md`](../../README.md));
- base para los *fixtures* de los tests en la etapa de implementación.

**Nunca se cargan en la base de datos de ningún entorno** (invariante INV-12: el sistema distingue lo que puede conocer de lo que solo puede simular).

## Escenarios incluidos

| Escenario | Hora (UTC) | Qué muestra | Ítems |
|---|---|---|---|
| S0 (contexto) | 20/09/2026 13:05 | Evidencia previa: la matrícula 99001 figuraba con categoría 2ª. | Consulta `SUCCEEDED`, Resultado `FOUND`, Credencial, Verificación, Evaluación `COMPATIBLE` |
| S7 | 26/09/2026 18:30 | **Camino de error:** el recurso cambió y ningún archivo tiene la lista de registros (falla la validación V2). | Consulta `FAILED` (`EXTRACTION_FAILED`), Resultado `UNVERIFIABLE`, Verificación **sin Evaluación** que adjunta la Credencial del 20/09 como contexto (`credencial_previa_ref`) |
| S1 | 26/09/2026 18:40 | Categoría 2ª para A1 en Córdoba. | Consulta `SUCCEEDED`, Credencial nueva, Evaluación **`COMPATIBLE`** |
| S2 | 26/09/2026 18:42 | La misma matrícula y la misma categoría, pero para el Tipo de trabajo B. | Evaluación **`INCOMPATIBLE`** (categoría `NOT_MET`) |
| S6 | 26/09/2026 18:45 | La Consulta sale bien y la matrícula 99004 no figura. | Consulta `SUCCEEDED`, Resultado **`NOT_FOUND`**, Verificación sin Credencial ni Evaluación |
| S9 | 26/09/2026 18:48 | MetroGAS, que no es automatizable. | Consulta **`NOT_ATTEMPTED`** sin Intentos, Resultado `UNVERIFIABLE`, Verificación con link al buscador oficial |

Observaciones para leer los archivos:

- En S7 la Credencial del 20/09 **no se modifica**: la Verificación solo la referencia como contexto.
- Entre S1 y S2 hay **dos Credenciales distintas** (una por Consulta) con el mismo contenido. La Evaluación es la que cambia, porque depende del Tipo de trabajo.
- Ningún ítem contiene email, teléfono ni barrio.

## Archivos

| Archivo | Tabla |
|---|---|
| [`consultas.json`](consultas.json) | `Consultas` |
| [`resultados-verificacion.json`](resultados-verificacion.json) | `ResultadosVerificacion` |
| [`credenciales.json`](credenciales.json) | `Credenciales` |
| [`verificaciones.json`](verificaciones.json) | `Verificaciones` |
| [`evaluaciones.json`](evaluaciones.json) | `Evaluaciones` |
