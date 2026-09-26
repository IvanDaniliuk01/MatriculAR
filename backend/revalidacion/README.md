# λ revalidacion · P3

Módulo **M14 Revalidación programada** ([`docs/modulos.md`](../../docs/modulos.md)).

Todos los días, EventBridge Scheduler invoca esta función. Por cada Fuente automatizable hace **una sola Consulta** con todas las matrículas que tienen un Vínculo (Consulta 1 → N Resultados de verificación) y registra los Resultados. El caso de uso *Revalidar* usa los mismos componentes del núcleo que una Verificación (lectura de la Fuente, registro de la Consulta y de los Resultados), con otro disparador (el espíritu de la decisión D3, sin colas; ver [ADR-0001](../../docs/adr/0001-sin-colas-reintentos-sincronicos.md)).
