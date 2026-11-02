# Entorno local: los mismos módulos que en AWS, contra LocalStack (docker-compose.yml en la raíz).
# Se aplica con `terraform` común: el provider apunta a LocalStack con `endpoints`, así que no hace
# falta tflocal ni lstk. Lo levanta scripts/levantar-local.sh.

terraform {
  required_version = ">= 1.9"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.9" }
  }
}

variable "endpoint" {
  description = "URL de LocalStack."
  type        = string
  default     = "http://localhost:4566"
}

variable "contacto" {
  description = "Contacto en el User-Agent con que la función se identifica ante la Fuente."
  type        = string
  default     = "https://github.com/IvanDaniliuk01/MatriculAR"
}

variable "origen_cors" {
  description = "Origen del frontend local (Vite)."
  type        = string
  default     = "http://localhost:5173"
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    apigateway = var.endpoint
    cloudwatch = var.endpoint
    dynamodb   = var.endpoint
    iam        = var.endpoint
    lambda     = var.endpoint
    logs       = var.endpoint
    s3         = var.endpoint
    sts        = var.endpoint
  }

  default_tags {
    tags = { proyecto = "matricular", entorno = "local" }
  }
}

locals {
  entorno = "local"
  prefijo = "matricular-${local.entorno}"
}

module "tablas" {
  source  = "../../modulos/tablas"
  prefijo = local.prefijo
}

module "lecturas" {
  source         = "../../modulos/lecturas"
  prefijo        = local.prefijo
  forzar_borrado = true
}

module "funcion" {
  source              = "../../modulos/funcion"
  nombre              = "${local.prefijo}-verificacion"
  zip                 = "${path.module}/../../../backend/dist/verificacion.zip"
  arquitectura        = "x86_64"
  tablas_arn          = module.tablas.arns
  bucket_lecturas_arn = module.lecturas.arn
  # En las Lambdas de LocalStack, el SDK toma AWS_ENDPOINT_URL, que LocalStack inyecta solo.
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

output "url_api" {
  description = "URL base de la API en LocalStack."
  value       = "${var.endpoint}/restapis/${module.api.id}/${module.api.etapa}/_user_request_"
}

output "tablas" {
  value = module.tablas.nombres
}

output "bucket_lecturas" {
  value = module.lecturas.nombre
}
