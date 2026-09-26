# Núcleo compartido

Paquete interno que contiene **todo lo que no depende de cómo se invoca una función**: el dominio, los casos de uso, los puertos y los adaptadores. Lo incluyen todas las funciones Lambda.

| Carpeta | Contenido | Módulo | Depende de |
|---|---|---|---|
| `src/dominio/` | Tipos del glosario ([`CONTEXT.md`](../../CONTEXT.md)): Consulta, Credencial, Evaluación, Criterios y resultados. Cálculo de los Criterios de categoría y zona, del resultado global y de las Limitaciones. **Funciones puras.** | M02, M03 | Nada |
| `src/aplicacion/` | Casos de uso: *Verificar* (P0), *ConsultarHistorial* (P0), *Buscar* (P1), *Revalidar* (P3). | M04, M10, M14 | `dominio/`, `puertos/` |
| `src/puertos/` | Interfaces que necesita la aplicación: `PuertoFuente`, repositorios, reloj e identificadores. | — | `dominio/` |
| `src/adaptadores/fuentes/` | `EcogasRecursoNext` y `NoAutomatizable` ([diseño](../../docs/fuentes-y-adaptadores.md)). | M01 | `puertos/` |
| `src/adaptadores/dynamodb/` | Repositorios sobre las tablas de [`database/`](../../database/README.md), con escrituras condicionales y la transacción de finalización. | M02, M06 | `puertos/` |
| `src/esquemas/` | Esquemas Zod de la API y de los ítems, **compartidos con el frontend**. | M04 | `dominio/` |
| `test/dominio/` | Escenarios S1 a S10 del [modelo](../../docs/modelo-de-dominio.md#9-escenarios) como pruebas unitarias. | M03 | — |
| `test/adaptadores/fixtures/` | Fixtures F1 a F14 del adaptador de Ecogas, con **datos ficticios**. | M01 | — |
