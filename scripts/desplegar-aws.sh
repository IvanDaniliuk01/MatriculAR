#!/usr/bin/env bash
# Despliega en AWS real: empaqueta la función, muestra el plan de Terraform y pide confirmación.
# Requiere credenciales de AWS configuradas (por ejemplo, `aws configure` o variables AWS_*).
# El email de la alerta de presupuesto se pide acá y nunca se guarda en el repositorio.
# Uso: scripts/desplegar-aws.sh
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz"

for comando in terraform node; do
  command -v "$comando" >/dev/null || { echo "Falta '$comando' (ver scripts/README.md)." >&2; exit 1; }
done

if [ -z "${TF_VAR_email_alertas:-}" ]; then
  read -r -p "Email para la alerta de presupuesto (USD 5): " TF_VAR_email_alertas
  export TF_VAR_email_alertas
fi

echo "==> Empaquetado de la función"
(cd backend && npm run --silent empaquetar)

echo "==> Build del frontend (la URL de la API la escribe Terraform en config.json)"
(cd frontend && npm ci --silent && npm run --silent build)

echo "==> Plan de Terraform (infra/entornos/aws)"
cd infra/entornos/aws
terraform init -input=false
terraform plan -input=false -out=plan.tfplan

read -r -p "¿Aplicar este plan en AWS? Escribí 'si' para continuar: " respuesta
if [ "$respuesta" != "si" ]; then
  rm -f plan.tfplan
  echo "No se aplicó nada."
  exit 0
fi

terraform apply -input=false plan.tfplan
rm -f plan.tfplan

echo
echo "API en AWS: $(terraform output -raw url_api)"
echo "Frontend:   $(terraform output -raw url_frontend)"
echo "Recordá repetir la prueba de acceso a Ecogas desde AWS (scripts/probar-ecogas.sh en CloudShell)."
