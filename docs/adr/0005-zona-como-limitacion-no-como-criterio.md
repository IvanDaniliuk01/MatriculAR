---
estado: propuesta (pendiente de revisión del equipo y del tutor)
fecha: 2026-10-24
reemplaza: Criterio de zona de la segunda entrega (`MET` / `INDETERMINATE` según el Área de concesión)
---

# La zona es una Limitación, no un Criterio

La segunda entrega evaluaba la zona con un Criterio propio: `MET` si la provincia del trabajo estaba dentro del Área de concesión de la Fuente e `INDETERMINATE` si estaba fuera. La segunda devolución pidió eliminar la comparación provincia = jurisdicción y fijó un invariante: **si no hay evidencia suficiente, el sistema expresa incertidumbre y no infiere.**

Al revisar el Criterio con ese invariante, concluimos que el `MET` sigue infiriendo. Ninguna Fuente informa en qué zonas está habilitado el matriculado: Ecogas publica un domicilio. Que la provincia del trabajo esté dentro del Área de concesión no prueba que pueda trabajar ahí, y la NAG-200 y varias distribuidoras indican que para trabajar en otra zona hay que registrarse en la distribuidora local. Además, con ese Criterio un resultado `COMPATIBLE` era inalcanzable para cualquier trabajo fuera del área.

Decidimos:

- **Quitar la zona de los Criterios.** La Evaluación tiene un solo Criterio, el de categoría. El resultado global sale de ese Criterio.
- **Informar siempre una Limitación fija:** *"La Fuente no informa en qué zonas está habilitado el matriculado: la provincia que publica corresponde a su domicilio. MatriculAR no verifica el alcance territorial de la habilitación."*
- **Agregar una segunda Limitación** cuando la provincia del trabajo esté fuera del Área de concesión de la Fuente o en una provincia donde la Distribuidora opera solo en parte.
- Las Limitaciones **no modifican el resultado global**; indican qué no se verificó.
- Mantener el Área de concesión como dato versionado de la Fuente, pero solo para decidir la segunda Limitación.

## Qué ganamos y qué perdemos

- El sistema no afirma nada sobre el alcance territorial: coherente con el tratamiento de la Vigencia ([ADR-0003](0003-credencial-separada-de-evaluacion-sin-afirmar-vigencia.md)).
- La interfaz es más simple: un criterio, y debajo "qué no podemos afirmar".
- Se pierde una señal que, aunque débil, orientaba al Cliente. La Limitación de "fuera del área" la sustituye en forma de advertencia.

## Consecuencias

- Se eliminan el Criterio de zona, el invariante "la zona nunca es `NOT_MET`" y los escenarios que dependían de él (ver [`modelo-de-dominio.md`](../modelo-de-dominio.md)).
- Si Ecogas confirmara que el campo "provincia" es la zona habilitada (pregunta 3 de [`consulta-a-ecogas.md`](../consulta-a-ecogas.md)), la zona podría volver a ser un Criterio. Sería una nueva versión de la regla y un ADR nuevo.
- Esta decisión se toma por razonamiento del equipo y **está pendiente de validación con el tutor** (pregunta 3 del [informe de avance](../informe-avance-entrega-2.md)).
