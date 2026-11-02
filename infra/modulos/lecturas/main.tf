# Bucket de las Lecturas minimizadas (ADR-0006). Pesan alrededor de 1 MB, más que el límite de un
# ítem de DynamoDB, y se descartan al día siguiente: la regla de ciclo de vida las borra sola.

terraform {
  required_providers {
    aws    = { source = "hashicorp/aws" }
    random = { source = "hashicorp/random" }
  }
}

variable "prefijo" {
  description = "Prefijo de los nombres, por ejemplo matricular-local."
  type        = string
}

variable "forzar_borrado" {
  description = "Permite destruir el bucket aunque tenga objetos (solo en local)."
  type        = bool
  default     = false
}

resource "random_id" "sufijo" {
  byte_length = 4
}

resource "aws_s3_bucket" "lecturas" {
  # Los nombres de bucket son globales: el sufijo evita choques entre cuentas.
  bucket        = "${var.prefijo}-lecturas-${random_id.sufijo.hex}"
  force_destroy = var.forzar_borrado
}

resource "aws_s3_bucket_public_access_block" "lecturas" {
  bucket                  = aws_s3_bucket.lecturas.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "lecturas" {
  bucket = aws_s3_bucket.lecturas.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lecturas" {
  bucket = aws_s3_bucket.lecturas.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "lecturas" {
  bucket = aws_s3_bucket.lecturas.id

  rule {
    id     = "descartar-lecturas-al-dia-siguiente"
    status = "Enabled"
    filter {
      prefix = "lecturas/"
    }
    expiration {
      days = 1
    }
  }
}

output "nombre" {
  value = aws_s3_bucket.lecturas.id
}

output "arn" {
  value = aws_s3_bucket.lecturas.arn
}
