---
estado: aceptada
fecha: 2026-09-26
---

# Consultar la Fuente bajo demanda, sin guardar una copia del padrón

Ecogas publica **todo** su padrón (5.031 registros con nombre, email, teléfono y barrio) en un solo archivo. Decidimos que cada Consulta **descargue el recurso en ese momento**, lo procese en memoria y persista únicamente: la Credencial de las matrículas buscadas (sin datos de contacto), los metadatos de la Consulta y una **huella SHA-256** del recurso, que identifica qué versión se leyó sin guardarla. No mantenemos una copia sincronizada del padrón.

## Opciones consideradas

- **Copia periódica del padrón** (sincronizar y consultar contra la copia): respuestas más rápidas y menos pedidos a la Fuente, pero implica guardar datos personales de miles de personas que nunca usaron MatriculAR, y obliga a definir cuándo la copia está "vieja", que es justamente la pregunta de vigencia que ninguna Fuente responde.
- **Bajo demanda** (elegida): cada evidencia queda atada a **una** Consulta con fecha concreta, que es exactamente "qué sabemos, de dónde y cuándo".

## Consecuencias

- Cada Verificación implica una descarga de aproximadamente 1,1 MB. Hay que proteger a la Fuente con un límite de uso en API Gateway y con una sola descarga por Consulta, sin paralelismo.
- La revalidación de P3 descarga el recurso **una vez por Fuente** y resuelve todas las matrículas en la misma Consulta (relación Consulta 1 → N Resultados de verificación).
- Si la carga llegara a justificarlo, se podría reutilizar el recurso en memoria durante unos segundos. Eso requeriría un ADR nuevo, porque afecta a la definición de "cuándo lo verificamos".
