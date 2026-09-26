# λ verificacion · P0

Función que atiende los endpoints del núcleo ([`docs/api.md`](../../docs/api.md)):

| Endpoint | Caso de uso |
|---|---|
| `POST /verificaciones` | *Verificar*: el recorrido completo |
| `GET /verificaciones/{id}` | Consultar |
| `GET /credenciales/{fuente_id}/{matricula}` | *ConsultarHistorial* |
| `GET /fuentes`, `GET /fuentes/{id}/consultas` | Listar e informar la salud de la Fuente |
| `GET /tipos-trabajo`, `GET /categorias`, `GET /provincias` | Catálogos |

| Carpeta | Contenido |
|---|---|
| `src/handlers/` | Adaptador de entrada de API Gateway: valida con Zod, arma el caso de uso con sus adaptadores (raíz de composición) y traduce el resultado a HTTP. **Una Fuente que falla responde 201 `NO_VERIFICABLE`, nunca 5xx.** |
| `test/integracion/` | Recorridos S1, S5, S6, S7 y S9 por HTTP contra LocalStack. |

Configuración de la función (se define en [`infra/`](../../infra/)): runtime `nodejs24.x`, timeout de 28 s (la Consulta tiene 24 s de presupuesto y el resto se usa para escribir), 512 MB de memoria y permisos IAM de mínimo privilegio, sin `DeleteItem` sobre la evidencia y sin `UpdateItem` sobre `ResultadosVerificacion`, `Credenciales`, `Evaluaciones` y `Verificaciones`.
