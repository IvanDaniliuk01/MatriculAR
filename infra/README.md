# Infraestructura

**Terraform** para el 100 % de los recursos (decisión D6). El mismo código sirve para los dos entornos ([`docs/arquitectura.md` § 7](../docs/arquitectura.md#7-entornos-y-costos)).

> **Estado (10/11/2026):** `entornos/aws` está **aplicado** en la región **`us-east-2`**: <https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1/>. `entornos/local` (LocalStack) valida con `terraform validate` pero **no se ejecutó**.

## Estructura

```
infra/
├── modulos/
│   ├── tablas/          DynamoDB del P0: consultas, credenciales, verificaciones, evaluaciones
│   ├── lecturas/        S3 para las Lecturas minimizadas, que vencen al día siguiente (ADR-0006)
│   ├── funcion/         la Lambda (nodejs24.x) con su rol IAM de mínimo privilegio y sus logs
│   ├── api/             API Gateway REST: rutas de docs/api.md, CORS, límites de uso y las rutas del frontend
│   └── observabilidad/  métrica y alarma de Consultas fallidas
└── entornos/
    ├── local/           LocalStack: `terraform` común con los endpoints del provider apuntando a localhost:4566
    └── aws/             AWS real (us-east-2): lo mismo, más PITR, protección contra borrado y presupuesto de USD 5
```

Se aplica con los scripts de [`scripts/`](../scripts/): `levantar-local.sh`, `bajar-local.sh` y `desplegar-aws.sh`.

## Recursos del P0

| Módulo | Recursos | Notas |
|---|---|---|
| `tablas` | 4 tablas `PAY_PER_REQUEST`: `consultas` (índices `por-fuente` y `por-fuente-estado`), `credenciales` (índice `por-fuente`), `verificaciones` y `evaluaciones` | Cifradas. En AWS: recuperación a un punto en el tiempo y protección contra borrado. |
| `lecturas` | Bucket privado con cifrado SSE-S3, acceso público bloqueado y regla de ciclo de vida que borra `lecturas/` a 1 día | El nombre lleva un sufijo aleatorio, porque los nombres de bucket son globales. |
| `funcion` | Lambda `verificacion` (512 MB, 60 s; arm64 en AWS, x86_64 en LocalStack), rol IAM y grupo de logs con 14 días de retención | Recibe por variables de entorno los nombres de tablas y bucket, el contacto del User-Agent y el origen CORS. El paquete incluye el build del frontend en `sitio/`. |
| `api` | API REST regional con **recursos explícitos** para cada ruta de [`docs/api.md`](../docs/api.md) (más `OPTIONS` para CORS), etapa `v1` y throttling. Además, `GET /` y `GET /{archivo+}` para el frontend, que la función sirve con HTTPS; los recursos explícitos tienen prioridad sobre el comodín | `POST /verificaciones`: 5 pedidos por segundo, ráfaga de 10. El resto: 20 y 40. Timeout de integración: 29 s (ver P-4). |
| `observabilidad` | Filtro de logs `{"evento":"consulta_finalizada","estado":"FAILED"}` → métrica `ConsultasFallidas` → alarma si hay 3 o más en 15 minutos | En P0 la alarma no notifica; el destino SNS es una variable opcional. |
| `entornos/aws` | Presupuesto mensual de USD 5 con avisos al 80 % (real) y al 100 % (proyectado). Región `us-east-2`: la cuenta del plan gratuito con *Projects* solo permite crear recursos en la región del proyecto | El email se pasa al aplicar (`TF_VAR_email_alertas`) y nunca se guarda en el repositorio. |

Las reglas (Fuentes, Tipos de trabajo, Condiciones decisivas, provincias) **no tienen tablas**: viajan dentro del paquete de la función, desde `database/seed/`, y se validan al arrancar.

## Reglas

- **Ningún recurso se crea a mano.** El entorno se levanta y se destruye con un comando.
- **La evidencia es inmutable.** El rol de la función no tiene `UpdateItem` ni `DeleteItem` sobre ninguna tabla, ni `DeleteObject` sobre las Lecturas minimizadas: solo agrega y lee (INV-1). La garantía la dan las escrituras condicionales; IAM la refuerza.
- **Estado de Terraform local** (`terraform.tfstate`, ignorado por git). En P0 despliega una sola persona desde una sola máquina; si eso cambia, el estado pasa a un backend S3 con bloqueo.
- Los secretos (token de LocalStack, credenciales de AWS, email de alertas) nunca se guardan en el repositorio.
- Los `.terraform.lock.hcl` sí se versionan: fijan las versiones exactas de los providers.
