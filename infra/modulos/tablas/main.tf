# Tablas de DynamoDB del P0 (una por entidad, ADR-0004). La evidencia nunca se modifica ni se
# borra: el rol de la función no tiene UpdateItem ni DeleteItem sobre ninguna (ver modulos/funcion).

terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

variable "prefijo" {
  description = "Prefijo de los nombres, por ejemplo matricular-local."
  type        = string
}

variable "pitr" {
  description = "Recuperación a un punto en el tiempo (solo en AWS real)."
  type        = bool
  default     = false
}

variable "proteccion_borrado" {
  description = "Impide borrar las tablas con terraform destroy (solo en AWS real)."
  type        = bool
  default     = false
}

locals {
  # Clave primaria e índices de cada tabla. Los índices proyectan todo (ALL).
  tablas = {
    consultas = {
      clave = "consulta_id"
      indices = {
        "por-fuente"        = { particion = "fuente_id", orden = "iniciada_en" }
        "por-fuente-estado" = { particion = "fuente_estado", orden = "finalizada_en" }
      }
    }
    credenciales = {
      clave   = "credencial_id"
      indices = { "por-fuente" = { particion = "fuente_id", orden = "obtenida_en" } }
    }
    verificaciones = { clave = "verificacion_id", indices = {} }
    evaluaciones   = { clave = "evaluacion_id", indices = {} }
  }
}

resource "aws_dynamodb_table" "tabla" {
  for_each = local.tablas

  name                        = "${var.prefijo}-${each.key}"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = each.value.clave
  deletion_protection_enabled = var.proteccion_borrado

  attribute {
    name = each.value.clave
    type = "S"
  }

  dynamic "attribute" {
    for_each = toset(flatten([for indice in values(each.value.indices) : [indice.particion, indice.orden]]))
    content {
      name = attribute.value
      type = "S"
    }
  }

  dynamic "global_secondary_index" {
    for_each = each.value.indices
    content {
      name            = global_secondary_index.key
      hash_key        = global_secondary_index.value.particion
      range_key       = global_secondary_index.value.orden
      projection_type = "ALL"
    }
  }

  point_in_time_recovery {
    enabled = var.pitr
  }

  server_side_encryption {
    enabled = true
  }
}

output "nombres" {
  description = "Nombre de cada tabla, por clave (consultas, credenciales, verificaciones, evaluaciones)."
  value       = { for clave, tabla in aws_dynamodb_table.tabla : clave => tabla.name }
}

output "arns" {
  description = "ARN de cada tabla, por clave."
  value       = { for clave, tabla in aws_dynamodb_table.tabla : clave => tabla.arn }
}
