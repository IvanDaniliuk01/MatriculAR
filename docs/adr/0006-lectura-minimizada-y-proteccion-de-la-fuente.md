---
estado: aceptada
fecha: 2026-11-01
modifica: ADR-0002 (consulta bajo demanda sin copia del padrón)
---

# Una Lectura minimizada se reutiliza 15 minutos para proteger a la Fuente

El ADR-0002 hacía que cada Verificación descargara el padrón completo de Ecogas (unos 1,1 MB), con un límite de la API de 2 pedidos por segundo. El tutor señaló que eso convierte a MatriculAR en un amplificador de pedidos anónimos contra un tercero. Decidimos que una Consulta exitosa responda todas las Verificaciones de los 15 minutos siguientes. Para eso conservamos una **Lectura minimizada**: identificador interno de la Fuente, nombre, categoría, provincia y localidad, crudos y normalizados, sin email, teléfono ni barrio. Se descarta al día siguiente. Después de una falla se espera un minuto antes de volver a leer la Fuente. Mientras tanto, la Consulta queda `NOT_ATTEMPTED` con motivo `SOURCE_RATE_LIMITED` y el resultado es `UNVERIFIABLE`.

## Qué se mantiene del ADR-0002

No se guardan datos de contacto ni una copia permanente del padrón. Toda respuesta informa la fecha real de la Consulta en la que se apoya, nunca la del pedido.

## Alternativas descartadas

- **Guardar la lectura solo en la memoria del proceso.** En Lambda depende de que el contenedor siga vivo, así que la ventana sería impredecible.
- **Sin ventana, solo un límite global.** Casi todas las Verificaciones terminarían `UNVERIFIABLE` aunque la Fuente funcione.

## Consecuencias

- Una Consulta deja de hacerse "para una o más Matrículas": lee la Fuente, y varias Verificaciones se apoyan en ella.
- El límite de la API propia (throttling) deja de ser la protección de la Fuente.
- Los valores (15 minutos, 1 minuto) son configuración de la Fuente y se ajustan cuando Ecogas responda la consulta.
