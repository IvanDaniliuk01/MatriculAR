---
estado: aceptada
fecha: 2026-09-26
reemplaza: máquina de estados del Profesional de la primera entrega (pendiente_verificación → verificado → vencido)
---

# Credencial separada de Evaluación, y la vigencia nunca se afirma

La primera entrega le daba al Profesional un estado de habilitación (`verificado`, `vencido`), y la investigación le agregaba a la credencial estados como `categoria_insuficiente` o `fuera_de_jurisdiccion`. El tutor señaló que esos estados dependen del trabajo y no de la credencial, y que ninguna Fuente informa vencimientos individuales. Decidimos:

- que la **Credencial** sea evidencia inmutable **sin estado de aptitud** (qué matrícula, en qué Fuente, con qué categoría, según qué Consulta y cuándo);
- que la **Evaluación** sea el resultado de aplicar un **Tipo de trabajo** a una Credencial (`COMPATIBLE`, `INCOMPATIBLE` o `INDETERMINATE`), con un resultado por Criterio, su fundamento y una copia de la regla aplicada;
- que **solo haya Evaluación cuando hay Credencial**: `NOT_FOUND` y `UNVERIFIABLE` son respuestas distintas del sistema;
- que la **Vigencia no sea un Criterio**: se informa siempre como Limitación y el sistema nunca la afirma.

## Por qué "compatible" y no "apta" o "habilitada"

Figurar en el padrón no prueba que la matrícula esté renovada: la NAG-200 mantiene hasta tres años en el registro a quien no renovó. "Apta" o "habilitada" prometerían más de lo que el sistema sabe. "Compatible" dice exactamente lo que se puede afirmar: la categoría informada y la zona son compatibles con el trabajo, según la evidencia de una fecha concreta.

## Consecuencias

- Desaparecen los estados `verificado` y `vencido`, y la degradación automática por vencimiento que planteaba el README original.
- No se modela ninguna fecha de vencimiento ficticia.
- Si Ecogas confirmara que su listado solo incluye matrículas renovadas, la Vigencia podría pasar a ser un Criterio. Sería una nueva versión de la regla y un ADR nuevo.
- Las reglas (categorías admitidas, áreas de concesión, Limitaciones) son **datos versionados**. El algoritmo que las combina es fijo en el código: no se construye un motor regulatorio general.
