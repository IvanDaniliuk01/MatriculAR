# Seguimiento de la segunda devolución

> Estado al 24/10/2026. Cada punto de la devolución (G209) con lo que está resuelto en la documentación y lo que falta en código.
> Regla de lectura: **"Documentado"** significa que el diseño y los textos existen; **"Código pendiente"** significa que todavía no hay implementación. La rama `vertical-p0` agrega la primera vertical en código (sin AWS: persistencia en memoria); `frontend/` e `infra/` siguen siendo esqueleto.

| # | Punto pedido para la próxima revisión | Documentación | Código | Dónde |
|---|---|---|---|---|
| 1 | Modelo que separe Credencial de Evaluación | Documentado | Implementado (tipos y `evaluar`, con pruebas) | [ADR-0003](adr/0003-credencial-separada-de-evaluacion-sin-afirmar-vigencia.md) · [modelo-de-dominio § 2](modelo-de-dominio.md) |
| 2 | Eliminar la comparación provincia = jurisdicción | Documentado. Además, la zona deja de ser un Criterio | Implementado (la zona es Limitación; pruebas) | [reglas § 4](reglas-de-categoria.md#4-zona-por-qué-no-es-un-criterio) · [ADR-0005](adr/0005-zona-como-limitacion-no-como-criterio.md) |
| 3 | Reglas reales de categoría documentadas | Documentado, con citas de la NAG-200 corregidas contra el texto original | Implementado (el catálogo se carga de `database/seed/`) | [reglas § 3](reglas-de-categoria.md) · `database/seed/` |
| 4 | Adaptador de Ecogas integrado al backend | Diseño documentado | **Implementado** (`EcogasRecursoNext`, probado con fixtures; falta probarlo contra el sitio real) | [fuentes-y-adaptadores § 4](fuentes-y-adaptadores.md) |
| 5 | Persistencia de fuente, fecha y resultado de la consulta | Tablas y escenarios documentados | **Implementado en memoria** (Consulta, Resultado, Credencial, Evaluación y Verificación se guardan juntas); falta el adaptador de DynamoDB | [database/README](../database/README.md) |
| 6 | `NO_ENCONTRADO` y `NO_VERIFICABLE` explícitos | Documentado (`NOT_FOUND` / `UNVERIFIABLE`, INV-3) | Implementado (una falla nunca produce `NOT_FOUND`; pruebas) | [modelo-de-dominio § 5](modelo-de-dominio.md) |
| 7 | Manejo controlado de fallas de extracción | Documentado (INV-4, validaciones, conserva la última evidencia válida) | **Implementado** (V1–V5, reintentos solo en fallas transitorias, evidencia previa como contexto) | [fuentes-y-adaptadores § 4.3–4.7](fuentes-y-adaptadores.md) · [ADR-0001](adr/0001-sin-colas-reintentos-sincronicos.md) |
| 8 | Interfaz o endpoint mínimo que corra todo el flujo | `POST /verificaciones` documentado | **Implementado** (servidor HTTP mínimo y `npm run demo`) | [api.md](api.md) |

## Cambios de esta revisión

- La zona pasa de Criterio a Limitación ([ADR-0005](adr/0005-zona-como-limitacion-no-como-criterio.md)). **Es una decisión nuestra, a validar con el tutor.**
- Citas de la NAG-200 cotejadas con el texto original: coma en 8.2.1, excepción de 8.3.1 atribuida a los Sectores Técnicos, renovación de 8.5.1 (2 de enero al 31 de marzo) y artículo del párrafo sobre la baja a los tres años.
- La Limitación de Vigencia ya no atribuye a la NAG-200 que "vence el 31 de marzo" (eso lo dice Ecogas).
- `investigacion/prueba_ecogas.py` queda marcado como obsoleto, con la aclaración "se procesa la fuente completa, solo se persiste una muestra reducida".

## Próximo paso: primera vertical

Hecho en `vertical-p0`, sin más scripts exploratorios. Un camino completo: Adaptador de Ecogas → extracción → normalización de la credencial → persistencia de fuente, fecha y resultado → evaluación por regla de categoría → respuesta del backend. Incluye el camino de error que conserva la última evidencia válida y la prueba con la URL o estructura cambiada, que debe dar `UNVERIFIABLE` (fuente no consultable / extracción fallida) y nunca "0 matriculados".

Reintentos: se mantiene el mecanismo más simple (sincrónico, hasta 3 intentos) antes de pensar en colas o DLQ.

## Qué falta de la vertical

- Probar el adaptador contra el sitio real de Ecogas (con pedidos mínimos) y registrar el resultado. Las pruebas actuales usan fixtures ficticios con la forma del recurso.
- Adaptador de DynamoDB (`TransactWriteItems`), empaquetado Lambda y Terraform/LocalStack.
- Identificar el adaptador ante Ecogas (User-Agent definitivo, punto P-1) y probar desde una IP de AWS (P-2).
