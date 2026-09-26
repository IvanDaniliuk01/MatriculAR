# Scripts

> **Todavía no hay código.** Scripts previstos para la etapa de implementación.

| Script | Para qué |
|---|---|
| `levantar` | LocalStack arriba → `lstk terraform apply` → carga de datos semilla. |
| `seed` | Carga `database/seed/*.json` (configuración real). **Nunca** carga `database/seed/ejemplos-ficticios/`. |
| `destruir` | Destruye y recrea el entorno local (D6). |
| `desplegar` | Empaqueta las funciones con esbuild y las publica (local o AWS). |
| `humo-ecogas` | Prueba de humo **manual** del adaptador contra la Fuente real. No guarda datos personales. |
