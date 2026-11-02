# Entorno de AWS real (etapa 4). Mismos módulos que en local, más recuperación a un punto en el
# tiempo, protección contra borrado de las tablas y la alerta de presupuesto de USD 5.
# El estado de Terraform es local (terraform.tfstate, ignorado por git): en P0 despliega una sola
# persona desde una sola máquina. Si eso cambia, el estado pasa a un backend S3.

terraform {
  required_version = ">= 1.9"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.9" }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "email_alertas" {
  description = "Email que recibe la alerta de presupuesto. Se pasa al aplicar; nunca se guarda en el repositorio."
  type        = string
  sensitive   = true
}

variable "presupuesto_usd" {
  type    = number
  default = 5
}

variable "contacto" {
  description = "Contacto en el User-Agent con que la función se identifica ante la Fuente."
  type        = string
  default     = "https://github.com/IvanDaniliuk01/MatriculAR"
}

variable "origen_cors" {
  description = "Origen del frontend. Hasta publicarlo, cualquiera: la API del P0 es pública y de solo consulta."
  type        = string
  default     = "*"
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { proyecto = "matricular", entorno = "aws" }
  }
}

locals {
  entorno = "aws"
  prefijo = "matricular-${local.entorno}"
}

module "tablas" {
  source             = "../../modulos/tablas"
  prefijo            = local.prefijo
  pitr               = true
  proteccion_borrado = true
}

module "lecturas" {
  source  = "../../modulos/lecturas"
  prefijo = local.prefijo
}

module "funcion" {
  source              = "../../modulos/funcion"
  nombre              = "${local.prefijo}-verificacion"
  zip                 = "${path.module}/../../../backend/dist/verificacion.zip"
  arquitectura        = "arm64"
  tablas_arn          = module.tablas.arns
  bucket_lecturas_arn = module.lecturas.arn
  variables_entorno = {
    MATRICULAR_ENTORNO              = local.entorno
    MATRICULAR_TABLA_CONSULTAS      = module.tablas.nombres.consultas
    MATRICULAR_TABLA_CREDENCIALES   = module.tablas.nombres.credenciales
    MATRICULAR_TABLA_VERIFICACIONES = module.tablas.nombres.verificaciones
    MATRICULAR_TABLA_EVALUACIONES   = module.tablas.nombres.evaluaciones
    MATRICULAR_BUCKET_LECTURAS      = module.lecturas.nombre
    MATRICULAR_CONTACTO             = var.contacto
    MATRICULAR_ORIGEN_CORS          = var.origen_cors
  }
}

module "api" {
  source             = "../../modulos/api"
  nombre             = local.prefijo
  funcion_nombre     = module.funcion.nombre
  funcion_invoke_arn = module.funcion.invoke_arn
}

module "observabilidad" {
  source     = "../../modulos/observabilidad"
  prefijo    = local.prefijo
  grupo_logs = module.funcion.grupo_logs
}

resource "aws_budgets_budget" "mensual" {
  name         = "${local.prefijo}-presupuesto"
  budget_type  = "COST"
  limit_amount = tostring(var.presupuesto_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.email_alertas]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.email_alertas]
  }
}

output "url_api" {
  description = "URL base de la API en AWS (incluye la etapa v1)."
  value       = module.api.url
}

output "tablas" {
  value = module.tablas.nombres
}

output "bucket_lecturas" {
  value = module.lecturas.nombre
}
