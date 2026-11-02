#!/usr/bin/env bash
# Destruye el entorno local: los recursos de Terraform y el contenedor de LocalStack.
# Uso: scripts/bajar-local.sh
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz"

if curl -fsS http://localhost:4566/_localstack/health >/dev/null 2>&1; then
  echo "==> Terraform destroy (infra/entornos/local)"
  terraform -chdir=infra/entornos/local destroy -auto-approve -input=false
else
  echo "LocalStack no está corriendo: no hay recursos que destruir."
fi

echo "==> LocalStack"
docker compose down
