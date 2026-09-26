# Infraestructura

> **Todavía no hay código.** Esta carpeta tiene la estructura acordada en el diseño (segunda entrega).

**Terraform** para el 100 % de los recursos (decisión D6). El mismo código se aplica en los dos entornos ([`docs/arquitectura.md` § 7](../docs/arquitectura.md#7-entornos-y-costos)).

## Estructura

```
infra/
├── modulos/
│   ├── tablas/          las 14 tablas de DynamoDB (a partir de database/tablas/*.json)
│   ├── funcion/         una función Lambda (nodejs24.x) con su rol IAM de mínimo privilegio
│   ├── api/             API Gateway REST, rutas, límites de uso, CORS y autorizador de Cognito (P2)
│   └── observabilidad/  grupos de logs, alarma de Consultas fallidas y alerta de presupuesto
└── entornos/
    ├── local/           LocalStack: se aplica con `lstk terraform` (reemplaza a tflocal, que está deprecado)
    └── aws/             AWS real (etapa 4): se aplica con `terraform`
```

## Recursos por módulo

| Recurso | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| Tablas de DynamoDB | 8 del núcleo | +3 | +3 | — |
| Funciones Lambda | `verificacion` | `profesionales` | `contrataciones` | `revalidacion`, `notificaciones` |
| API Gateway REST | ✔ | rutas | rutas y autorizador | — |
| Cognito | — | ✔ (básico) | ✔ (roles) | — |
| SES | — | ✔ | — | — |
| EventBridge Scheduler y SNS | — | — | — | ✔ |
| S3 (frontend) | etapa 4 | | | |

## Reglas

- **Ningún recurso se crea a mano.** El entorno se levanta y se destruye con un comando.
- Los roles de IAM **no otorgan** `UpdateItem` ni `DeleteItem` sobre `Credenciales`, `Evaluaciones` y `Verificaciones` (inmutabilidad de la evidencia, INV-1).
- Los secretos (token de LocalStack, credenciales de AWS) nunca se guardan en el repositorio.
