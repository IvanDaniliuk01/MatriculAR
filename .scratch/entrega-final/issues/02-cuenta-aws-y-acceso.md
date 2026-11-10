# Crear la cuenta de AWS y dar acceso desde WSL

Type: task
Status: resolved

## Question

(HITL, Iván) Lista de pasos: 1) crear la cuenta de AWS en el plan gratuito (tarjeta y teléfono); 2) autorizar al agente a instalar la AWS CLI v2 en ~/.local de WSL (awscli-exe-linux-x86_64.zip, ~60 MB, de awscli.amazonaws.com); 3) iniciar sesión con `aws login` en WSL; las credenciales no pasan por el agente ni por el repositorio. Se resuelve cuando `aws sts get-caller-identity` responde.

## Answer

Hecho el 10/11. Cuenta en el plan gratuito con "Projects" (proyecto por defecto "Stack of Dreams", USD 100 de créditos, 182 días). AWS CLI 2.39.7 en `~/.local/bin` de WSL; sesión con `aws login --remote` (credenciales temporales, fuera del repositorio). Identidad: rol `AccountFullAccessRole` de la cuenta del proyecto (no es el usuario raíz), región us-east-1.

Hallazgos que afectan a otros tickets:
- En este plan, IAM > Security credentials pide "activar funciones avanzadas": no se activó. Roles y Policies sí están disponibles.
- MFA: se busca en Profile; no bloquea el despliegue.
- Puede que el plan gratuito restrinja algún servicio (Budgets, CloudWatch alarms): se ve en el plan de Terraform del despliegue.
