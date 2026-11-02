# Módulos

> Documento de diseño · Segunda entrega, corregido según la devolución v3 · Última revisión: 01/11/2026
> Cumple el ítem "Listado de Módulos" de la consigna: todos los módulos funcionales que se van a desarrollar, con una descripción breve de cada uno y su prioridad. Incorpora de la devolución v3 el recorte del alcance de la entrega final al P0 y el nuevo orden de trabajo ([§ 6](#6-plan)).
> Relacionados: [arquitectura](arquitectura.md) · [API](api.md) · [base de datos](../database/README.md) · [glosario](../CONTEXT.md)

## Índice

1. [Prioridades](#1-prioridades)
2. [Listado de módulos](#2-listado-de-módulos)
3. [Dependencias entre módulos](#3-dependencias-entre-módulos)
4. [Detalle de cada módulo](#4-detalle-de-cada-módulo)
5. [Fuera de alcance](#5-fuera-de-alcance)
6. [Plan](#6-plan)

---

## 1. Prioridades

| Prioridad | Significado | Compromiso |
|---|---|---|
| **P0** | **Núcleo de verificación.** Es el recorrido vertical que pidió el tutor, y el diferencial de MatriculAR. | **Se entrega completo.** Es el **único alcance de la entrega final** (21/11/2026). |
| **P1** | Profesionales y búsqueda: el marketplace se apoya sobre el núcleo. | **Fuera del alcance de la entrega final.** Queda diseñado para la fase 2. |
| **P2** | Cuentas, contratación y reseñas: el ciclo completo de contratación. | **Fuera del alcance de la entrega final.** Queda diseñado para la fase 2. |
| **P3** | Revalidación programada y notificaciones. | **Fuera del alcance de la entrega final.** Queda diseñado para la fase 2. |

Regla de recorte: si el plan se atrasa, **se recorta de abajo hacia arriba**, nunca el P0. Esto sigue el principio de la primera entrega: *pocas cosas completas en lugar de muchas a medias*. Con el código empezando el 02/11 y la entrega final el 21/11, el recorte se aplica desde ahora: **P1, P2 y P3 quedan declarados fuera del alcance de la entrega final**, como pidió la devolución v3 ("no implementaría todavía marketplace, contrataciones, Cognito, SES, revalidación ni notificaciones").

---

## 2. Listado de módulos

| ID | Módulo | Prioridad | Descripción breve | Función / carpeta |
|---|---|---|---|---|
| **M01** | Fuentes y adaptadores | **P0** | Lee el padrón de cada Distribuidora mediante un adaptador: Ecogas (automatizable) y MetroGAS (no automatizable). Descubre el recurso, aplica las cinco validaciones, clasifica las fallas y descarta los datos de contacto. | `λ verificacion` · [`backend/verificacion/`](../backend/verificacion/) |
| **M02** | Consultas y evidencia | **P0** | Registra cada Consulta con sus Intentos, sus Resultados de verificación y la huella del recurso. Guarda la Lectura minimizada, aplica la Ventana de reutilización y la Protección de la Fuente. Crea Credenciales inmutables con historial y con los valores tal como los publicó la Fuente. | `λ verificacion` |
| **M03** | Reglas y evaluación | **P0** | Mantiene el catálogo de Categorías y los Tipos de trabajo versionados. Deduce los Tipos de trabajo posibles a partir de las Condiciones decisivas y calcula la Evaluación (Criterio de categoría, resultado global y Limitaciones, incluida la de zona). | `λ verificacion` · [`backend/compartido/`](../backend/compartido/) |
| **M04** | Verificación y API | **P0** | Caso de uso *Verificar* de punta a punta, primero desde un CLI y después con los endpoints públicos del P0 (verificación, historial, salud de la Fuente y catálogos). | `λ verificacion` |
| **M05** | Interfaz de verificación | **P0** | Pantalla web mínima: formulario con las Condiciones decisivas y resultado con evidencia, Criterio, Limitaciones e historial. | [`frontend/`](../frontend/) |
| **M06** | Infraestructura y entorno | **P0** | Terraform para los recursos del P0, entorno LocalStack reproducible, carga de datos semilla y scripts de desarrollo. **Ya no va primero**: se hace después del recorrido local. | [`infra/`](../infra/) · [`database/`](../database/) |
| **M07** | Despliegue en la nube y observabilidad | **P0** (requisito de la etapa 4) | El mismo Terraform aplicado en AWS real, el frontend servido desde S3, alerta de presupuesto, logs y alarmas. | [`infra/`](../infra/) |
| **M08** | Profesionales | **P1** · fase 2 | Perfil del gasista: nombre visible, presentación y tipos de trabajo ofrecidos. | `λ profesionales` · [`backend/profesionales/`](../backend/profesionales/) |
| **M09** | Vínculos | **P1** · fase 2 | Relación Profesional–Matrícula, verificada con un código que se envía al email que publica la propia Fuente: prueba control de ese email, no la identidad legal del titular. | `λ profesionales` |
| **M10** | Búsqueda | **P1** · fase 2 | Zonas de trabajo y búsqueda de Profesionales por tipo de trabajo y provincia, con una Verificación del momento. | `λ profesionales` |
| **M11** | Usuarios y autenticación | **P2** · fase 2 | Cuentas de Cliente y Profesional con Cognito. Autorización en API Gateway. | Cognito · `λ contrataciones` |
| **M12** | Contratación | **P2** · fase 2 | Solicitud → aceptada → realizada → calificada, o cancelada. Cada Contratación queda asociada a una Verificación hecha al crearla. | `λ contrataciones` · [`backend/contrataciones/`](../backend/contrataciones/) |
| **M13** | Reseñas y reputación | **P2** · fase 2 | Puntaje y comentario sobre Contrataciones realizadas, más el promedio del Profesional. | `λ contrataciones` |
| **M14** | Revalidación programada | **P3** · fase 2 | Todos los días, una Consulta por Fuente para todas las matrículas vinculadas. Caso de uso *Revalidar*, armado con los mismos componentes del núcleo que *Verificar*. | `λ revalidacion` · [`backend/revalidacion/`](../backend/revalidacion/) |
| **M15** | Notificaciones | **P3** · fase 2 | Avisos cuando una revalidación cambia el Resultado de verificación de un Profesional (por ejemplo, de `FOUND` a `NOT_FOUND`). | `λ notificaciones` · [`backend/notificaciones/`](../backend/notificaciones/) |

---

## 3. Dependencias entre módulos

```mermaid
flowchart LR
    subgraph P0 [P0 · núcleo]
        M06[M06 Infraestructura]
        M01[M01 Fuentes y adaptadores]
        M02[M02 Consultas y evidencia]
        M03[M03 Reglas y evaluación]
        M04[M04 Verificación y API]
        M05[M05 Interfaz]
        M07[M07 Despliegue en la nube]
    end
    subgraph P1 [P1 · marketplace]
        M08[M08 Profesionales]
        M09[M09 Vínculos]
        M10[M10 Búsqueda]
    end
    subgraph P2 [P2 · contratación]
        M11[M11 Usuarios]
        M12[M12 Contratación]
        M13[M13 Reseñas]
    end
    subgraph P3 [P3 · continuidad]
        M14[M14 Revalidación]
        M15[M15 Notificaciones]
    end

    M01 --> M02
    M02 --> M04
    M03 --> M04
    M04 --> M06
    M06 --> M07
    M04 --> M05
    M05 --> M07
    M04 --> M08
    M11 --> M08
    M08 --> M09
    M01 --> M09
    M09 --> M10
    M04 --> M10
    M11 --> M12
    M04 --> M12
    M10 --> M12
    M12 --> M13
    M09 --> M14
    M04 --> M14
    M14 --> M15
```

> **Cambio de la devolución v3:** M06 (Infraestructura) ya no es la base de M02. El recorrido M01 → M02 → M03 → M04 corre primero en local, con repositorios en memoria y un CLI, y recién después se agregan DynamoDB, LocalStack y Terraform (M06) y la nube (M07).
>
> **M11 (Usuarios)** tiene prioridad P2 como módulo completo, pero la **autenticación básica con Cognito** se adelantaría en P1, porque el Profesional necesita una cuenta para gestionar su perfil. Los dos quedan para la fase 2.

---

## 4. Detalle de cada módulo

Para cada módulo: qué hace, con qué datos trabaja, qué expone y cómo se demuestra que está terminado.

### M01 · Fuentes y adaptadores · P0

| | |
|---|---|
| **Responsabilidades** | Implementar el puerto de Fuentes. **Adaptador de Ecogas:** descubrir el recurso desde el HTML, descargarlo, decodificarlo, aplicar las validaciones V1 a V5, normalizar y descartar el contacto. **Adaptador no automatizable** (MetroGAS): responder "no realizada" sin hacer pedidos. Clasificar las fallas y aplicar la política de Intentos. |
| **Datos** | Lee `Fuentes` (configuración versionada) y la última Consulta exitosa (para V5). No escribe. |
| **Expone** | `PuertoFuente.leer` (P0) y `PuertoFuente.obtenerContactoParaVinculo` (P1). |
| **Diseño** | [`fuentes-y-adaptadores.md`](fuentes-y-adaptadores.md) |
| **Prueba temprana** | **1–2/11/2026:** el mismo pedido del adaptador, identificado con un `User-Agent` propio y un contacto, desde una IP de AWS (CloudShell), antes de escribir infraestructura. El resultado se registra en [fuentes § 9, P-2](fuentes-y-adaptadores.md#9-puntos-pendientes). |
| **Responsable** | Nicolás (adaptador y fixtures), hasta el 08/11. |
| **Terminado cuando** | Pasan las 14 fixtures (F1 a F14), sintéticas y sin datos reales. Ninguna salida contiene email, teléfono ni barrio. Una prueba de humo manual (`npm run test:fuente-real`) lee el padrón real de Ecogas. |

### M02 · Consultas y evidencia · P0

| | |
|---|---|
| **Responsabilidades** | Registrar la Consulta `IN_PROGRESS` antes del primer pedido. Finalizarla con estado, motivo, detalle, Intentos, huella y resumen. Guardar la Lectura minimizada de una Consulta exitosa y descartarla al día siguiente. Reutilizar una Consulta exitosa durante la Ventana de reutilización (15 minutos) y aplicar la Protección de la Fuente (1 minuto después de una falla, `SOURCE_RATE_LIMITED`). Crear un Resultado de verificación por Verificación y una Credencial inmutable por Coincidencia si es `FOUND`, con sus `valores_fuente` (incluido el Identificador interno de la Fuente, que nunca se presenta como matrícula). Interpretar como interrumpida una Consulta que sigue `IN_PROGRESS` después de su plazo. |
| **Datos** | `Consultas` (con la Lectura minimizada), `ResultadosVerificacion` y `Credenciales`. |
| **Invariantes** | INV-1, INV-3, INV-4, INV-9, INV-10 e INV-15 ([modelo § 8](modelo-de-dominio.md#8-invariantes)). |
| **Terminado cuando** | Primero con repositorios en memoria: la Ventana de reutilización y la Protección de la Fuente funcionan con un reloj falso, y una falla no toca la evidencia anterior. Después, contra DynamoDB en LocalStack: las escrituras condicionales impiden modificar una Credencial y el historial de un gasista (nombre y localidad) se lee en orden. La clave definitiva de `Credenciales` se decide acá ([ADR-0007](adr/0007-identificacion-por-nombre-y-localidad.md)). |

### M03 · Reglas y evaluación · P0

| | |
|---|---|
| **Responsabilidades** | Cargar y validar con Zod las versiones vigentes de Categorías y Tipos de trabajo desde `database/seed/`, que es la única fuente de verdad: si una regla no tiene cita, el sistema no arranca. Deducir los Tipos de trabajo posibles a partir de las Condiciones decisivas (un No sé nunca se toma como Sí) y rechazar un trabajo no cubierto. Calcular el Criterio de categoría (por lista explícita, sin orden) para cada Tipo posible, el resultado global y las Limitaciones, incluida la de zona ([ADR-0005](adr/0005-zona-como-limitacion-en-el-p0.md)). Guardar la Evaluación con una copia de la regla aplicada. |
| **Datos** | `Categorias`, `TiposTrabajo` y `Evaluaciones`. |
| **Diseño** | [`reglas-de-categoria.md`](reglas-de-categoria.md) · [modelo § 6](modelo-de-dominio.md#6-cómo-se-calcula-una-evaluación) |
| **Responsable** | Iván (dominio). Primeras pruebas en verde el 02/11. |
| **Terminado cuando** | Los escenarios S1 a S15 pasan como pruebas unitarias del dominio (sin AWS), incluidos categoría desconocida, No sé en sus tres desenlaces, Limitación de zona dentro y fuera del área, trabajo no cubierto y el texto de `COMPATIBLE`. Cada Tipo de trabajo tiene su cita normativa. |

### M04 · Verificación y API · P0

| | |
|---|---|
| **Responsabilidades** | Caso de uso *Verificar*: validar el pedido, orquestar M01, M02 y M03 y persistir todo en una transacción. Armar el mensaje: qué sabemos, de dónde, cuándo, qué concluimos y qué no. Endpoints de consulta: Verificación, historial, salud de la Fuente y catálogos. |
| **Datos** | `Verificaciones`, más todas las tablas del núcleo. |
| **Expone** | [`api.md`](api.md) § 2 a 5. |
| **Terminado cuando** | **Hasta el 08/11:** los escenarios S1, S5, S6, S7, S9, S11, S13, S14 y S15 se recorren de punta a punta **desde el CLI**, con repositorios en memoria. **Hasta el 13/11:** los mismos escenarios por HTTP contra LocalStack, con las respuestas del contrato. Una Fuente que falla responde `201 UNVERIFIABLE`, nunca un `5xx`. |

### M05 · Interfaz de verificación · P0

| | |
|---|---|
| **Responsabilidades** | Página mínima. Formulario (Fuente, nombre y apellido del gasista, localidad opcional, las cinco Condiciones decisivas con Sí, No y No sé, provincia). Vista del resultado: resultado global con el texto de `COMPATIBLE` que no promete habilitación, evidencia con fecha y Fuente, Criterio con su fundamento, Condiciones decisivas que resolverían un `INDETERMINATE`, Limitaciones, detalle técnico plegable (Consulta, Intentos, huella) e historial del gasista. Si hay varias Coincidencias, las muestra todas, cada una con su Evaluación, y el Cliente elige con el carné. |
| **Diseño** | [`frontend/README.md`](../frontend/README.md) |
| **Terminado cuando** | Los cuatro resultados posibles (`COMPATIBLE`, `INCOMPATIBLE`, `INDETERMINATE`, sin Evaluación) y los dos tipos de `UNVERIFIABLE` se ven distintos y se entienden sin leer la documentación. |

### M06 · Infraestructura y entorno · P0

| | |
|---|---|
| **Cuándo** | **Después** del recorrido local (devolución v3): DynamoDB en LocalStack del 09/11 al 13/11, Terraform completo después. |
| **Responsabilidades** | Terraform para las 8 tablas del núcleo, la función, API Gateway con límites de uso, IAM de mínimo privilegio (sin `DeleteItem` sobre la evidencia y sin `UpdateItem` salvo para finalizar la Consulta) y logs. Script de carga de datos semilla. Levantar y destruir el entorno con un comando. |
| **Diseño** | [`infra/README.md`](../infra/README.md) · [`database/`](../database/) |
| **Terminado cuando** | `lstk terraform apply` más el seed dejan el sistema funcionando desde cero, y `destroy` lo elimina sin residuos. |

### M07 · Despliegue en la nube y observabilidad · P0 (etapa 4)

| | |
|---|---|
| **Responsabilidades** | Aplicar el mismo Terraform en AWS real (Free plan). Servir el frontend desde S3. Alerta de presupuesto de USD 5. Logs estructurados y alarma por proporción de Consultas fallidas. La prueba de pedidos a Ecogas desde IPs de AWS se adelantó al 1–2/11 (ver M01). |
| **Terminado cuando** | El servicio responde en una URL pública y el recorrido completo funciona en la nube. |

### M08 · Profesionales · P1

| | |
|---|---|
| **Responsabilidades** | Crear y editar el perfil del Profesional autenticado: nombre visible, presentación, tipos de trabajo ofrecidos y estado (activo o pausado). |
| **Datos** | `Profesionales`. |
| **Terminado cuando** | Un gasista con cuenta crea su perfil y lo ve publicado. |

### M09 · Vínculos · P1

| | |
|---|---|
| **Responsabilidades** | Declarar una matrícula (queda `UNVERIFIED`). Enviar un código al email que publica la Fuente (se usa en memoria y no se guarda). Confirmar el código (pasa a `VERIFIED`). Garantizar un solo Vínculo verificado por matrícula, con una escritura condicional en `TitularesMatricula` dentro de la misma transacción. Mostrar como "no verificado" al que no tiene email en la Fuente. |
| **Datos** | `Vinculos` (el código solo como hash) y `TitularesMatricula`. |
| **Riesgo** | SES en modo *sandbox* ([arquitectura § 12](arquitectura.md#12-riesgos)). |
| **Terminología** | Un Vínculo `VERIFIED` es un **vínculo verificado mediante el email publicado por la Fuente**: prueba control de ese email, no la identidad legal del titular. Hasta validarlo con la distribuidora, no se lo presenta como "titularidad". |
| **Terminado cuando** | Un Profesional confirma el código enviado al email de la Fuente. Un segundo usuario no puede verificar la misma matrícula. |

### M10 · Búsqueda · P1

| | |
|---|---|
| **Responsabilidades** | Declarar zonas de trabajo. Buscar Profesionales por tipo de trabajo y provincia: una Consulta **por Fuente** para todos los candidatos (Consulta 1 → N), Evaluación de cada uno y listado con su resultado y la fecha de la evidencia. Por defecto solo se muestran Vínculos verificados. |
| **Datos** | `ZonasTrabajo`, más el núcleo. |
| **Terminado cuando** | La búsqueda muestra evidencia de ese momento y distingue claramente los resultados `COMPATIBLE`, `INDETERMINATE` y `UNVERIFIABLE`. |

### M11 · Usuarios y autenticación · P2

| | |
|---|---|
| **Responsabilidades** | Registro e inicio de sesión con Cognito. Roles de Cliente y Profesional. Autorizador de API Gateway. Perfil mínimo de la cuenta. |
| **Datos** | `Usuarios` (sin contraseñas). |
| **Terminado cuando** | Las rutas de P1 y P2 rechazan pedidos sin un token válido. |

### M12 · Contratación · P2

| | |
|---|---|
| **Responsabilidades** | Crear la Contratación con una Verificación nueva. `INCOMPATIBLE` la bloquea. `INDETERMINATE`, `NOT_FOUND` y `UNVERIFIABLE` exigen que el Cliente confirme la advertencia. Transiciones condicionales según la máquina de estados. Historial de transiciones. |
| **Datos** | `Contrataciones`. |
| **Diseño** | [modelo § 7.4](modelo-de-dominio.md#74-contratación-p2) |
| **Terminado cuando** | El ciclo completo funciona y una transición inválida se rechaza. |

### M13 · Reseñas y reputación · P2

| | |
|---|---|
| **Responsabilidades** | Una Reseña por Contratación realizada (puntaje de 1 a 5 y comentario). Actualizar el promedio del Profesional. Listar las Reseñas públicas. |
| **Datos** | `Resenas` y `Profesionales` (promedio). |
| **Terminado cuando** | Calificar pasa la Contratación a `RATED` y actualiza la reputación. |

### M14 · Revalidación programada · P3

| | |
|---|---|
| **Responsabilidades** | Todos los días, EventBridge Scheduler invoca una Consulta por Fuente con todas las matrículas vinculadas y registra los Resultados. El caso de uso *Revalidar* usa los mismos componentes del núcleo que *Verificar* (lectura de la Fuente, registro de la Consulta y de los Resultados), con otro disparador (el espíritu de la D3). |
| **Terminado cuando** | Una revalidación con 100 matrículas hace **una** descarga por Fuente. |

### M15 · Notificaciones · P3

| | |
|---|---|
| **Responsabilidades** | Detectar cambios de Resultado de verificación entre revalidaciones y avisar al Profesional y a los Clientes con Contrataciones activas, vía SNS. |
| **Terminado cuando** | Un cambio simulado en los tests genera el aviso. |

---

## 5. Fuera de alcance

Documentado para la **fase 2**, fuera del proyecto final:

| Excluido | Por qué |
|---|---|
| **Módulos P1, P2 y P3** (M08 a M15): marketplace, Vínculos, búsqueda, cuentas con Cognito, contratación, reseñas, revalidación y notificaciones | Devolución v3: primero el recorrido del P0. Con el tiempo que queda hasta el 21/11, se declaran fuera de la entrega final. Su diseño queda en este documento, en el [modelo](modelo-de-dominio.md) y en la [API](api.md#7-endpoints-de-p1-y-p2-resumen). |
| **Electricistas** (COPIME, ERSeP, APSE) | Toda la evidencia investigada es de gas. Otro oficio implica otra investigación de Fuentes y de reglas. |
| **Otras distribuidoras de gas** (Naturgy BAN, Camuzzi, Litoral Gas, …) | Cada una requiere investigación y, si es automatizable, un adaptador. La arquitectura ya lo permite (M01). |
| Pagos y facturación | No hacen al problema central. |
| Chat en tiempo real | Idem. |
| Geolocalización fina (la zona se modela por provincia) | La precisión de la zona está limitada por las Fuentes, que informan provincia y localidad. |
| Panel de administración (back-office) | Las reglas y Fuentes se administran con archivos versionados y revisión por PR. |
| Apps móviles nativas | El frontend web es responsive. |
| Resolución de disputas por un mismo Vínculo | Requiere un proceso manual. |
| Consultar MetroGAS automáticamente | Protegido con captcha. No corresponde evitarlo. |

---

<a id="6-plan-tentativo"></a>

## 6. Plan

El diseño fue aprobado con correcciones (devolución v3). Este plan reemplaza al de la segunda entrega: la infraestructura ya no va primero, y el alcance de la entrega final es solo el P0. La etapa 4 de la hoja de ruta termina el 21/11/2026.

```mermaid
gantt
    title Plan hasta la entrega final
    dateFormat YYYY-MM-DD
    axisFormat %d/%m

    section Arranque
    Correcciones, dominio con tests y CI             :a1, 2026-11-02, 1d
    Prueba desde AWS y consulta a Ecogas             :a2, 2026-11-01, 2d

    section Recorrido local
    M01 Adaptador Ecogas con fixtures (Nicolás)      :m01, 2026-11-02, 7d
    M03 Reglas y evaluación (Iván)                   :m03, 2026-11-02, 4d
    M02 Consultas y evidencia en memoria             :m02, after m03, 3d
    M04 Recorrido completo por CLI                   :m04, 2026-11-06, 3d

    section Persistencia
    M02 y M04 con DynamoDB en LocalStack y Lambda    :m06, 2026-11-09, 5d

    section Nube e interfaz
    M06 y M07 Terraform en AWS                       :m07, 2026-11-14, 4d
    M05 Página React mínima                          :m05, 2026-11-14, 4d

    section Cierre
    Informe final y video                            :cierre, 2026-11-18, 4d
```

| Hito | Fecha | Qué se demuestra |
|---|---|---|
| Arranque | **02/11** | Documentación corregida según la devolución v3. Proyecto TypeScript con las primeras pruebas del dominio en verde (categoría desconocida, No sé, Limitación de zona, trabajo no cubierto, texto de `COMPATIBLE`). CI en GitHub Actions. Consulta enviada a Ecogas y resultado de la prueba desde AWS. |
| **Recorrido local** | **08/11** | *Fuente actual de Ecogas → extracción válida → gasista (por nombre y localidad, porque la Fuente no publica la matrícula) → evidencia → trabajo → evaluación → respuesta explicable*, desde un CLI y con repositorios en memoria. Incluye cambio de URL o estructura, extracción incompleta, categoría desconocida e incertidumbre de zona. |
| Persistencia | 13/11 | El mismo recorrido con DynamoDB en LocalStack y un handler de Lambda. |
| **P0 en la nube** | 17/11 | El mismo recorrido en AWS real, con una URL pública y una página React mínima. |
| Entrega final | 21/11 | Repositorio, servicio en la nube, informe y video. |

**Cómo se trabaja.** Nicolás toma el adaptador de Ecogas y sus fixtures, e Iván el dominio y la evaluación; se encuentran en el puerto de Fuentes. Se desarrolla con TDD. Cada cambio entra por un PR chico (menos de un día de trabajo) que revisa el otro integrante; si la revisión no llega en 12 horas, se integra igual. GitHub Actions corre el lint, el chequeo de tipos y las pruebas en cada push.
