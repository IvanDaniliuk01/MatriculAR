# λ contrataciones · P2

Módulos **M11 Usuarios y autenticación**, **M12 Contratación** y **M13 Reseñas y reputación** ([`docs/modulos.md`](../../docs/modulos.md)).

- Cada Contratación se crea con una **Verificación nueva**: `INCOMPATIBLE` la bloquea, y `INDETERMINATE`, `NOT_FOUND` o `UNVERIFIABLE` requieren que el Cliente confirme la advertencia.
- Máquina de estados: solicitada → aceptada → realizada → calificada, o cancelada ([modelo § 7.4](../../docs/modelo-de-dominio.md#74-contratación-p2)). Las transiciones se escriben de forma condicional.
- Una Reseña por Contratación realizada.

Tablas: `Usuarios`, `Contrataciones` y `Resenas` ([`database/README.md`](../../database/README.md#8-tablas-del-p2)).
