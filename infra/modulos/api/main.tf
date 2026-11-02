# API Gateway REST con recursos explícitos (no {proxy+}): así se ve el contrato de docs/api.md en
# el código y se puede limitar POST /verificaciones por separado. Todas las rutas, incluido el
# OPTIONS de CORS, van a la misma función, que resuelve la ruta.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

variable "nombre" {
  type = string
}

variable "etapa" {
  type    = string
  default = "v1"
}

variable "funcion_nombre" {
  type = string
}

variable "funcion_invoke_arn" {
  type = string
}

variable "limite_verificaciones" {
  description = "Throttling de POST /verificaciones: protege a MatriculAR, no a la Fuente (ADR-0006)."
  type        = object({ por_segundo = number, rafaga = number })
  default     = { por_segundo = 5, rafaga = 10 }
}

variable "limite_general" {
  description = "Throttling del resto de las rutas."
  type        = object({ por_segundo = number, rafaga = number })
  default     = { por_segundo = 20, rafaga = 40 }
}

variable "timeout_integracion_ms" {
  # Límite por defecto de una API REST. La Consulta puede tardar más (45 s): ver P-4 en
  # docs/fuentes-y-adaptadores.md. Subirlo requiere pedir el aumento de la cuota en la cuenta.
  type    = number
  default = 29000
}

resource "aws_api_gateway_rest_api" "api" {
  name = var.nombre
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

locals {
  raiz = aws_api_gateway_rest_api.api.root_resource_id
}

# Árbol de recursos de docs/api.md § 2.
resource "aws_api_gateway_resource" "verificaciones" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = local.raiz
  path_part   = "verificaciones"
}

resource "aws_api_gateway_resource" "verificacion" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.verificaciones.id
  path_part   = "{verificacion_id}"
}

resource "aws_api_gateway_resource" "fuentes" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = local.raiz
  path_part   = "fuentes"
}

resource "aws_api_gateway_resource" "fuente" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.fuentes.id
  path_part   = "{fuente_id}"
}

resource "aws_api_gateway_resource" "consultas_de_fuente" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.fuente.id
  path_part   = "consultas"
}

resource "aws_api_gateway_resource" "credenciales" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = local.raiz
  path_part   = "credenciales"
}

resource "aws_api_gateway_resource" "credenciales_de_fuente" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.credenciales.id
  path_part   = "{fuente_id}"
}

resource "aws_api_gateway_resource" "tipos_trabajo" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = local.raiz
  path_part   = "tipos-trabajo"
}

resource "aws_api_gateway_resource" "categorias" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = local.raiz
  path_part   = "categorias"
}

resource "aws_api_gateway_resource" "provincias" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = local.raiz
  path_part   = "provincias"
}

locals {
  # Recurso → método del endpoint. Cada recurso tiene además OPTIONS para CORS.
  rutas = {
    verificaciones         = { recurso = aws_api_gateway_resource.verificaciones.id, metodo = "POST" }
    verificacion           = { recurso = aws_api_gateway_resource.verificacion.id, metodo = "GET" }
    fuentes                = { recurso = aws_api_gateway_resource.fuentes.id, metodo = "GET" }
    consultas_de_fuente    = { recurso = aws_api_gateway_resource.consultas_de_fuente.id, metodo = "GET" }
    credenciales_de_fuente = { recurso = aws_api_gateway_resource.credenciales_de_fuente.id, metodo = "GET" }
    tipos_trabajo          = { recurso = aws_api_gateway_resource.tipos_trabajo.id, metodo = "GET" }
    categorias             = { recurso = aws_api_gateway_resource.categorias.id, metodo = "GET" }
    provincias             = { recurso = aws_api_gateway_resource.provincias.id, metodo = "GET" }
  }
  metodos = merge([
    for clave, ruta in local.rutas : {
      "${clave}-${ruta.metodo}" = ruta
      "${clave}-OPTIONS"        = { recurso = ruta.recurso, metodo = "OPTIONS" }
    }
  ]...)
}

resource "aws_api_gateway_method" "metodo" {
  for_each = local.metodos

  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = each.value.recurso
  http_method   = each.value.metodo
  authorization = "NONE" # P0: la consulta de un padrón público es pública (docs/api.md § 1).
}

resource "aws_api_gateway_integration" "funcion" {
  for_each = local.metodos

  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = each.value.recurso
  http_method             = aws_api_gateway_method.metodo[each.key].http_method
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = var.funcion_invoke_arn
  timeout_milliseconds    = var.timeout_integracion_ms
}

resource "aws_lambda_permission" "api" {
  statement_id  = "InvocarDesdeApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.funcion_nombre
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "api" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redespliegue = sha1(jsonencode([local.metodos, aws_api_gateway_integration.funcion]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "etapa" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  deployment_id = aws_api_gateway_deployment.api.id
  stage_name    = var.etapa
}

resource "aws_api_gateway_method_settings" "general" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = aws_api_gateway_stage.etapa.stage_name
  method_path = "*/*"
  settings {
    throttling_rate_limit  = var.limite_general.por_segundo
    throttling_burst_limit = var.limite_general.rafaga
  }
}

resource "aws_api_gateway_method_settings" "verificaciones" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = aws_api_gateway_stage.etapa.stage_name
  method_path = "verificaciones/POST"
  settings {
    throttling_rate_limit  = var.limite_verificaciones.por_segundo
    throttling_burst_limit = var.limite_verificaciones.rafaga
  }
}

output "id" {
  value = aws_api_gateway_rest_api.api.id
}

output "url" {
  description = "URL base de la API en AWS (incluye la etapa)."
  value       = aws_api_gateway_stage.etapa.invoke_url
}

output "etapa" {
  value = aws_api_gateway_stage.etapa.stage_name
}
