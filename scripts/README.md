# Scripts

| Script | Para qué |
|---|---|
| [`levantar-local.sh`](levantar-local.sh) | Levanta LocalStack (`docker compose`), empaqueta la función y aplica Terraform en `infra/entornos/local`. Al final imprime la URL de la API local. |
| [`bajar-local.sh`](bajar-local.sh) | Destruye los recursos locales y baja LocalStack. Con `levantar-local.sh`, el entorno se recrea de cero con dos comandos (decisión D6). |
| [`desplegar-aws.sh`](desplegar-aws.sh) | Empaqueta, muestra el plan de Terraform en `infra/entornos/aws` y **pide confirmación** antes de aplicar. Pide el email de la alerta de presupuesto, que nunca se guarda en el repositorio. |
| [`probar-ecogas.sh`](probar-ecogas.sh) | Prueba de acceso a Ecogas con un User-Agent identificado. No guarda datos personales. Corre a mano o en GitHub Actions ([workflow](../.github/workflows/probar-ecogas.yml)). |

El empaquetado de la función es `npm run empaquetar` en `backend/` ([`backend/scripts/empaquetar.mjs`](../backend/scripts/empaquetar.mjs)): genera `backend/dist/verificacion.zip`.

No hace falta cargar datos semilla en la base: las reglas (`database/seed/`) viajan dentro del paquete de la función y se validan al arrancar. `database/seed/ejemplos-ficticios/` nunca se carga.

## Requisitos

| Herramienta | Para qué | Cómo |
|---|---|---|
| Node.js 24 | Empaquetar y probar | `nvm use` en `backend/` |
| Terraform ≥ 1.9 | Infraestructura | Binario oficial de [releases.hashicorp.com](https://releases.hashicorp.com/terraform/) en `~/.local/bin`, verificado contra `SHA256SUMS` |
| Docker | LocalStack | Docker Desktop con la integración de WSL activada (*Settings › Resources › WSL Integration*) |
| Cuenta de LocalStack | `LOCALSTACK_AUTH_TOKEN` en `.env` | Copiar [`.env.example`](../.env.example) |
| Credenciales de AWS | Solo para `desplegar-aws.sh` | `aws configure` o variables `AWS_*` |
