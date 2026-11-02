# Una función Lambda con su rol de mínimo privilegio. La evidencia es inmutable: el rol no tiene
# UpdateItem ni DeleteItem sobre las tablas, ni DeleteObject sobre las Lecturas minimizadas.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

variable "nombre" {
  description = "Nombre de la función, por ejemplo matricular-local-verificacion."
  type        = string
}

variable "zip" {
  description = "Ruta al paquete generado por `npm run empaquetar` (backend/dist/verificacion.zip)."
  type        = string
}

variable "arquitectura" {
  description = "arm64 en AWS (más barata); x86_64 en LocalStack, para no emular en una PC x86."
  type        = string
  default     = "arm64"
}

variable "memoria_mb" {
  type    = number
  default = 512
}

variable "timeout_s" {
  description = "La Consulta tiene 45 s de presupuesto; el resto es para escribir la evidencia."
  type        = number
  default     = 60
}

variable "retencion_logs_dias" {
  type    = number
  default = 14
}

variable "tablas_arn" {
  description = "ARN de las tablas que la función lee y escribe."
  type        = map(string)
}

variable "bucket_lecturas_arn" {
  type = string
}

variable "variables_entorno" {
  description = "Variables de entorno de la función."
  type        = map(string)
}

data "aws_iam_policy_document" "asumir" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "funcion" {
  name               = var.nombre
  assume_role_policy = data.aws_iam_policy_document.asumir.json
}

resource "aws_cloudwatch_log_group" "funcion" {
  name              = "/aws/lambda/${var.nombre}"
  retention_in_days = var.retencion_logs_dias
}

data "aws_iam_policy_document" "permisos" {
  statement {
    sid = "EvidenciaSoloAgregarYLeer"
    # TransactWriteItems no es una acción de IAM: se autoriza con las acciones que la componen.
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:BatchGetItem",
      "dynamodb:ConditionCheckItem",
    ]
    resources = flatten([for arn in values(var.tablas_arn) : [arn, "${arn}/index/*"]])
  }

  statement {
    sid       = "LecturasMinimizadas"
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${var.bucket_lecturas_arn}/lecturas/*"]
  }

  statement {
    # Sin ListBucket, S3 responde 403 en lugar de 404 cuando una Lectura ya venció.
    sid       = "SaberSiUnaLecturaExiste"
    actions   = ["s3:ListBucket"]
    resources = [var.bucket_lecturas_arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["lecturas/*"]
    }
  }

  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.funcion.arn}:*"]
  }
}

resource "aws_iam_role_policy" "funcion" {
  name   = "minimo-privilegio"
  role   = aws_iam_role.funcion.id
  policy = data.aws_iam_policy_document.permisos.json
}

resource "aws_lambda_function" "funcion" {
  function_name    = var.nombre
  role             = aws_iam_role.funcion.arn
  filename         = var.zip
  source_code_hash = filebase64sha256(var.zip)
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [var.arquitectura]
  memory_size      = var.memoria_mb
  timeout          = var.timeout_s

  environment {
    variables = merge(var.variables_entorno, { NODE_OPTIONS = "--enable-source-maps" })
  }

  depends_on = [aws_cloudwatch_log_group.funcion, aws_iam_role_policy.funcion]
}

output "nombre" {
  value = aws_lambda_function.funcion.function_name
}

output "arn" {
  value = aws_lambda_function.funcion.arn
}

output "invoke_arn" {
  value = aws_lambda_function.funcion.invoke_arn
}

output "grupo_logs" {
  value = aws_cloudwatch_log_group.funcion.name
}
