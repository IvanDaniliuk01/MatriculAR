---
estado: aceptada
fecha: 2026-09-26
complementa: D5 de la primera entrega (DynamoDB como almacenamiento)
---

# Una tabla de DynamoDB por entidad, no single-table design

La práctica recomendada por AWS para DynamoDB es el *single-table design*: todas las entidades en una sola tabla, con claves compuestas sobrecargadas (`PK = FUENTE#ecogas`, `SK = CONSULTA#…`) para resolver varios patrones de acceso con una sola lectura. Decidimos, en cambio, **una tabla por entidad** (15 tablas: 8 del núcleo y 7 de P1 y P2), con índices secundarios globales para los patrones de acceso que lo necesitan.

## Por qué

- La consigna de la entrega pide mostrar "tablas, campos, tipos, claves primarias y foráneas, relaciones e índices". Con una tabla por entidad, el esquema se lee directamente. Con una tabla única, el revisor tendría que descifrar claves sobrecargadas.
- El volumen es de proyecto académico: la lectura extra que a veces implica tener tablas separadas es irrelevante en costo y en latencia.
- Mantiene la legibilidad para quien tome el proyecto después, incluidos los agentes de IA que asisten en la implementación.

## Consecuencias

- Las relaciones son **referencias lógicas** que valida la aplicación: DynamoDB no tiene claves foráneas.
- La escritura del final de una Verificación, que abarca 5 tablas, se hace con `TransactWriteItems`, para que no queden estados intermedios.
- Si el volumen creciera a un punto en que las lecturas múltiples importen, se puede migrar a una tabla única. Sería una migración de datos cara, por eso se registra esta decisión.
