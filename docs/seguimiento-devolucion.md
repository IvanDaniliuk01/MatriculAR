# Seguimiento de la segunda devolución

> Estado al 24/10/2026. Cada punto de la devolución (G209) con lo que está resuelto en la documentación y lo que falta en código.
> Regla de lectura: **"Documentado"** significa que el diseño y los textos existen; **"Código pendiente"** significa que todavía no hay implementación. El repositorio aún no tiene código (`backend/`, `frontend/` e `infra/` solo tienen el esqueleto).

| # | Punto pedido para la próxima revisión | Documentación | Código | Dónde |
|---|---|---|---|---|
| 1 | Modelo que separe Credencial de Evaluación | Documentado | Pendiente | [ADR-0003](adr/0003-credencial-separada-de-evaluacion-sin-afirmar-vigencia.md) · [modelo-de-dominio § 2](modelo-de-dominio.md) |
| 2 | Eliminar la comparación provincia = jurisdicción | Documentado. Además, la zona deja de ser un Criterio | Pendiente | [reglas § 4](reglas-de-categoria.md#4-zona-por-qué-no-es-un-criterio) · [ADR-0005](adr/0005-zona-como-limitacion-no-como-criterio.md) |
| 3 | Reglas reales de categoría documentadas | Documentado, con citas de la NAG-200 corregidas contra el texto original | Pendiente (carga de los seeds) | [reglas § 3](reglas-de-categoria.md) · `database/seed/` |
| 4 | Adaptador de Ecogas integrado al backend | Diseño documentado | **Pendiente** | [fuentes-y-adaptadores § 4](fuentes-y-adaptadores.md) |
| 5 | Persistencia de fuente, fecha y resultado de la consulta | Tablas y escenarios documentados | **Pendiente** | [database/README](../database/README.md) |
| 6 | `NO_ENCONTRADO` y `NO_VERIFICABLE` explícitos | Documentado (`NOT_FOUND` / `UNVERIFIABLE`, INV-3) | Pendiente | [modelo-de-dominio § 5](modelo-de-dominio.md) |
| 7 | Manejo controlado de fallas de extracción | Documentado (INV-4, validaciones, conserva la última evidencia válida) | **Pendiente** | [fuentes-y-adaptadores § 4.3–4.7](fuentes-y-adaptadores.md) · [ADR-0001](adr/0001-sin-colas-reintentos-sincronicos.md) |
| 8 | Interfaz o endpoint mínimo que corra todo el flujo | `POST /verificaciones` documentado | **Pendiente** | [api.md](api.md) |

## Cambios de esta revisión

- La zona pasa de Criterio a Limitación ([ADR-0005](adr/0005-zona-como-limitacion-no-como-criterio.md)). **Es una decisión nuestra, a validar con el tutor.**
- Citas de la NAG-200 cotejadas con el texto original: coma en 8.2.1, excepción de 8.3.1 atribuida a los Sectores Técnicos, renovación de 8.5.1 (2 de enero al 31 de marzo) y artículo del párrafo sobre la baja a los tres años.
- La Limitación de Vigencia ya no atribuye a la NAG-200 que "vence el 31 de marzo" (eso lo dice Ecogas).
- `investigacion/prueba_ecogas.py` queda marcado como obsoleto, con la aclaración "se procesa la fuente completa, solo se persiste una muestra reducida".

## Próximo paso: primera vertical

Sin más scripts exploratorios. Un camino completo: Adaptador de Ecogas → extracción → normalización de la credencial → persistencia de fuente, fecha y resultado → evaluación por regla de categoría → respuesta del backend. Incluye el camino de error que conserva la última evidencia válida y la prueba con la URL o estructura cambiada, que debe dar `UNVERIFIABLE` (fuente no consultable / extracción fallida) y nunca "0 matriculados".

Reintentos: se mantiene el mecanismo más simple (sincrónico, hasta 3 intentos) antes de pensar en colas o DLQ.
