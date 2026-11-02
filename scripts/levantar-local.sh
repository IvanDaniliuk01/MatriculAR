#!/usr/bin/env bash
# Levanta el entorno local completo: LocalStack, empaquetado de la función y Terraform.
# Uso: scripts/levantar-local.sh
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz"

for comando in docker terraform node curl; do
  command -v "$comando" >/dev/null || { echo "Falta '$comando' (ver scripts/README.md)." >&2; exit 1; }
done
[ -f .env ] || { echo "Falta .env: copiá .env.example y completá LOCALSTACK_AUTH_TOKEN." >&2; exit 1; }

echo "==> LocalStack"
docker compose up -d
printf "Esperando a LocalStack"
for _ in $(seq 1 60); do
  if curl -fsS http://localhost:4566/_localstack/health 2>/dev/null | grep -q '"lambda"'; then
    echo " listo."
    break
  fi
  printf "."
  sleep 2
done
curl -fsS http://localhost:4566/_localstack/health >/dev/null || { echo " LocalStack no respondió." >&2; exit 1; }

echo "==> Empaquetado de la función"
(cd backend && npm run --silent empaquetar)

echo "==> Terraform (infra/entornos/local)"
cd infra/entornos/local
terraform init -input=false
terraform apply -auto-approve -input=false

echo
echo "API local: $(terraform output -raw url_api)"
echo "Probala con:  curl \"\$(terraform -chdir=infra/entornos/local output -raw url_api)/fuentes\""
