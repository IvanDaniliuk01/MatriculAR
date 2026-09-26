# λ profesionales · P1

Módulos **M08 Profesionales**, **M09 Vínculos** y **M10 Búsqueda** ([`docs/modulos.md`](../../docs/modulos.md)).

- Perfil del Profesional autenticado con Cognito.
- Vínculo con una matrícula: el código se envía al email que publica la Fuente (se usa en memoria y no se guarda) y se guarda solo como hash.
- Búsqueda por tipo de trabajo y provincia, con **una Consulta por Fuente** para todos los candidatos.

Tablas: `Profesionales`, `Vinculos` y `ZonasTrabajo` ([`database/README.md`](../../database/README.md#7-tablas-del-p1)). Endpoints: [`docs/api.md` § 7](../../docs/api.md#7-endpoints-de-p1-y-p2-resumen).

La estructura interna se define al empezar P1, con el mismo esquema que [`verificacion/`](../verificacion/).
