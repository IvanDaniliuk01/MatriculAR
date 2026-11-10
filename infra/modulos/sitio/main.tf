# Hosting del frontend: bucket S3 con sitio web estático. Sube el build de Vite (frontend/dist) y
# un config.json con la URL de la API, que el frontend lee al arrancar: así el build no depende de
# la URL y todo se despliega en un solo `terraform apply`.
# El sitio web de S3 solo sirve HTTP; HTTPS con CloudFront queda proyectado (arquitectura, A-4).
# El bucket es público de solo lectura: contiene únicamente el build, sin datos.

terraform {
  required_providers {
    aws    = { source = "hashicorp/aws" }
    random = { source = "hashicorp/random" }
  }
}

variable "prefijo" {
  description = "Prefijo de los nombres, por ejemplo matricular-aws."
  type        = string
}

variable "directorio_build" {
  description = "Carpeta con el build del frontend (index.html y assets/)."
  type        = string
}

variable "url_api" {
  description = "URL base de la API que se escribe en config.json."
  type        = string
}

locals {
  # config.json lo escribe este módulo; si el build trae uno (el de desarrollo), se ignora.
  archivos = setsubtract(fileset(var.directorio_build, "**"), ["config.json"])
  tipos = {
    html  = "text/html; charset=utf-8"
    js    = "text/javascript; charset=utf-8"
    css   = "text/css; charset=utf-8"
    json  = "application/json"
    svg   = "image/svg+xml"
    png   = "image/png"
    ico   = "image/x-icon"
    txt   = "text/plain; charset=utf-8"
    woff2 = "font/woff2"
  }
}

resource "random_id" "sufijo" {
  byte_length = 4
}

resource "aws_s3_bucket" "sitio" {
  bucket        = "${var.prefijo}-sitio-${random_id.sufijo.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "sitio" {
  bucket = aws_s3_bucket.sitio.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "sitio" {
  bucket                  = aws_s3_bucket.sitio.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "lectura_publica" {
  bucket     = aws_s3_bucket.sitio.id
  depends_on = [aws_s3_bucket_public_access_block.sitio]
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "LecturaPublicaDelSitio"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.sitio.arn}/*"
    }]
  })
}

resource "aws_s3_object" "archivos" {
  for_each     = local.archivos
  bucket       = aws_s3_bucket.sitio.id
  key          = each.value
  source       = "${var.directorio_build}/${each.value}"
  etag         = filemd5("${var.directorio_build}/${each.value}")
  content_type = lookup(local.tipos, reverse(split(".", each.value))[0], "application/octet-stream")
}

resource "aws_s3_object" "config" {
  bucket        = aws_s3_bucket.sitio.id
  key           = "config.json"
  content       = jsonencode({ api_url = var.url_api })
  content_type  = "application/json"
  cache_control = "no-cache"
}

output "url" {
  description = "URL del frontend (HTTP)."
  value       = "http://${aws_s3_bucket_website_configuration.sitio.website_endpoint}"
}

output "bucket" {
  value = aws_s3_bucket.sitio.id
}
