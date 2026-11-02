# Paso "informar" del mecanismo acordado con el tutor: si las Consultas a la Fuente empiezan a
# fallar (cambio de estructura, bloqueo), se dispara una alarma. La función loguea en JSON
# {"evento":"consulta_finalizada","estado":"FAILED",...}.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

variable "prefijo" {
  type = string
}

variable "grupo_logs" {
  description = "Grupo de logs de la función de verificación."
  type        = string
}

variable "umbral_fallas" {
  type    = number
  default = 3
}

variable "periodo_s" {
  type    = number
  default = 900
}

variable "destino_alarma_arn" {
  description = "Tópico SNS para avisar (opcional; en P0 la alarma solo queda en la consola)."
  type        = string
  default     = null
}

locals {
  espacio = "MatriculAR/${var.prefijo}"
}

resource "aws_cloudwatch_log_metric_filter" "consultas_fallidas" {
  name           = "${var.prefijo}-consultas-fallidas"
  log_group_name = var.grupo_logs
  pattern        = "{ ($.evento = \"consulta_finalizada\") && ($.estado = \"FAILED\") }"

  metric_transformation {
    name          = "ConsultasFallidas"
    namespace     = local.espacio
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "consultas_fallidas" {
  alarm_name          = "${var.prefijo}-consultas-fallidas"
  alarm_description   = "La Fuente falló ${var.umbral_fallas} veces o más en ${var.periodo_s / 60} minutos: revisar formato, bloqueo o disponibilidad."
  namespace           = local.espacio
  metric_name         = aws_cloudwatch_log_metric_filter.consultas_fallidas.metric_transformation[0].name
  statistic           = "Sum"
  period              = var.periodo_s
  evaluation_periods  = 1
  threshold           = var.umbral_fallas
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.destino_alarma_arn == null ? [] : [var.destino_alarma_arn]
}

output "alarma" {
  value = aws_cloudwatch_metric_alarm.consultas_fallidas.alarm_name
}
