# MatriculAR - Trabajo final — Tecnicatura Universitaria en Programación (UTN)

**Plataforma de contratación de oficios regulados con verificación continua de credenciales profesionales.**

---

## Tabla de contenidos

- [El problema](#el-problema)
- [Qué es MatriculAR](#qué-es-matricular)
- [Principios rectores](#principios-rectores)
- [Arquitectura](#arquitectura)
- [Stack](#stack)
- [Alcance del MVP](#alcance-del-mvp)
- [Máquinas de estado](#máquinas-de-estado)
- [Puesta en marcha](#puesta-en-marcha)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Decisiones de diseño](#decisiones-de-diseño)
- [Equipo](#equipo)

---

## El problema

En Argentina ya existen varias apps que conectan hogares con profesionales de oficios (Timbrit, Clickie, Muovi, Tegu, Tutti, Yamba, Homesolution). La búsqueda y el matching están razonablemente resueltos.

Lo que ninguna resuelve es **la credencial como dato vivo**:

- La habilitación legal está fragmentada por organismo y jurisdicción — COPIME (CABA/nacional), ERSeP (Córdoba, con categorías I, II y III), APSE (PBA) para electricistas; ENARGAS más las distribuidoras regionales (MetroGAS, Naturgy BAN, Camuzzi, Ecogas, Litoral Gas) para gasistas.
- Las matrículas **vencen**. Un trabajo firmado con matrícula vencida no tiene validez y puede dejar al cliente sin cobertura del seguro ante un siniestro.
- Las plataformas actuales verifican una única vez, al alta, y delegan el control en el usuario final: *"pedile el número y consultalo en el organismo"*.

> **Enunciado del problema**
> No existe una plataforma que garantice de forma continua y automática que la habilitación legal de un profesional de oficio esté vigente, en la jurisdicción correcta y para la categoría de trabajo correcta, al momento de contratarlo.

## Qué es MatriculAR

Un marketplace de oficios regulados cuyo núcleo **no es el listado de profesionales sino un motor de verificación de matrículas**: multi-organismo, multi-jurisdicción y continuo en el tiempo.

Sobre ese motor se monta el ciclo completo de contratación: solicitud, aceptación, realización y calificación.

## Principios rectores

| Principio | Qué significa en la práctica |
|---|---|
| **La confianza se verifica, no se declara** | Ningún profesional figura como matriculado sin validación contra el padrón del organismo. |
| **La matrícula es un dato vivo** | El sistema la revalida periódicamente y degrada el estado del profesional de forma automática. |
| **Arquitectura orientada a eventos** | Todo lo que no necesita respuesta inmediata ocurre asíncrono, desacoplado y con reintentos. |
| **Recorte despiadado de alcance** | Pocas cosas completas en lugar de muchas a medias; lo excluido queda documentado como fase 2. |
| **Diseñado para migrar** | Corre 100% local sobre AWS emulado, pero cada decisión se toma como si mañana fuera AWS real. |

## Arquitectura

La solución separa un **camino síncrono** (petición-respuesta) de un **pipeline asíncrono** orientado a eventos. El frontend habla únicamente con API Gateway; los documentos suben directo a S3 mediante URLs prefirmadas; y la verificación, notificación y revalidación ocurren por detrás.

```
                          ┌──────────────┐
                          │   Frontend   │  React (fuera de LocalStack)
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │ API Gateway  │
                          └──┬────────┬──┘
              ┌──────────────┘        └──────────────┐
      ┌───────▼────────┐                    ┌────────▼────────┐
      │ λ profesionales│                    │ λ contrataciones│
      │ registro·perfil│                    │ solicitudes     │
      │ búsqueda       │                    │ estados·reseñas │
      └───────┬────────┘                    └────────┬────────┘
              └──────────────┐        ┌──────────────┘
                          ┌──▼────────▼──┐
                          │   DynamoDB   │
                          └──────▲───────┘
                                 │
  ┌───────────────┐   ┌──────────┴─────┐   ┌──────────────────┐
  │ S3 documentos │──▶│ SQS + DLQ      │──▶│  λ verificador   │
  │ (URL prefirm.)│   │ verificación   │   │ mock de padrones │
  └───────────────┘   └────────▲───────┘   └────────┬─────────┘
                               │                    │
                      ┌────────┴───────┐   ┌────────▼─────────┐
                      │   Scheduler    │   │ SNS + λ notific. │
                      │ EventBridge    │   └──────────────────┘
                      │ (diario)       │
                      └────────────────┘
```

**Flujo síncrono** — API Gateway enruta por prefijo hacia la Lambda de profesionales (registro, perfil, credenciales, búsqueda) o la de contrataciones (solicitudes, transiciones, reseñas). Ambas leen y escriben DynamoDB de forma directa.

**Flujo asíncrono** — La subida de una credencial a S3 emite un evento que se encola en SQS. La Lambda verificadora consume el mensaje, consulta el mock de padrones y, según el veredicto, actualiza el estado del profesional en DynamoDB y publica el resultado en SNS, que dispara la Lambda notificadora. Tras **tres intentos fallidos** el mensaje pasa a la **DLQ**. El scheduler diario re-encola a los profesionales con matrícula próxima a vencer o vencida, **reutilizando el mismo pipeline**.

## Stack

| Necesidad | Servicio AWS (emulado en LocalStack) |
|---|---|
| API del sistema | API Gateway + Lambda |
| Documentos de credenciales | S3 con URLs prefirmadas |
| Verificación asíncrona | SQS + Lambda consumidora + DLQ |
| Notificaciones | SNS (fan-out) + Lambda notificadora |
| Perfiles, credenciales y contrataciones | DynamoDB |
| Revalidación de vencimientos | EventBridge Scheduler + Lambda |
| Infraestructura reproducible | Terraform (IaC del 100% de los recursos) |

Frontend de demostración: **React** (corre fuera de LocalStack).

## Alcance del MVP

### ✅ Corte vertical A — El sello de confianza

- Registro de profesional con carga de credencial (subida directa a S3).
- Pipeline de verificación asíncrono contra padrones simulados (mock configurable de COPIME / ERSeP / APSE / distribuidoras de gas).
- Estados del profesional; se publica en la búsqueda solo cuando está verificado y vigente.
- Revalidación diaria de vencimientos y notificaciones asociadas.

### ✅ Corte vertical B — El ciclo de contratación

- Búsqueda de profesionales por rubro y zona, filtrando por estado *verificado*.
- Ciclo de vida de la solicitud: solicitada → aceptada → realizada → calificada (con cancelación).
- Calificación simple (puntaje + comentario) que alimenta la reputación.
- Notificaciones de hitos vía el pipeline de eventos.

### ❌ Fuera de alcance (fase 2, documentada)

- Pagos y facturación dentro de la plataforma.
- Chat en tiempo real entre cliente y profesional.
- Geolocalización fina y cálculo de distancias (la zona se modela como listado de partidos/localidades).
- Panel de administración y back-office.
- Apps móviles nativas (el frontend del MVP es web).
- Integración con los padrones reales (la interfaz queda preparada — ver decisión D4).

## Máquinas de estado

**Profesional**

```
pendiente_verificación ──▶ verificado
                       └─▶ rechazado

verificado ──▶ vencido ──(revalidación)──▶ verificado
```

**Contratación**

```
solicitada ──▶ aceptada ──▶ realizada ──▶ calificada
     │             │
     └─────────────┴──▶ cancelada
```

## Puesta en marcha

> ⚠️ Sección en construcción — se completa durante el Mes 1 (Fundaciones). Los comandos de abajo son la interfaz que apuntamos a tener.

### Requisitos

- Docker y Docker Compose
- Terraform ≥ 1.x
- Node.js (runtime de las Lambdas y frontend)
- `awslocal` / `tflocal` (wrappers de LocalStack)

### Levantar el entorno

```bash
# 1. Levantar LocalStack
docker compose up -d

# 2. Provisionar toda la infraestructura
cd infra && tflocal init && tflocal apply

# 3. Empaquetar y desplegar las Lambdas
./scripts/deploy.sh

# 4. Cargar datos semilla
./scripts/seed.sh

# 5. Frontend de demostración
cd frontend && npm install && npm run dev
```

### Destruir y recrear

Todo el entorno se destruye y se recrea con un comando — es requisito de diseño (D6) y habilita la demo en vivo.

```bash
cd infra && tflocal destroy -auto-approve
```

## Estructura del repositorio

> Propuesta inicial, sujeta a ajuste durante el Mes 1.

```
matriculAR/
├── infra/              # Terraform: 100% de los recursos
├── services/
│   ├── profesionales/  # λ registro · perfil · credenciales · búsqueda
│   ├── contrataciones/ # λ solicitudes · estados · reseñas
│   ├── verificador/    # λ consumidora de SQS + puerto de padrones
│   └── notificador/    # λ suscripta a SNS
├── mocks/padrones/     # Mock configurable de organismos
├── frontend/           # React (demo)
├── scripts/            # deploy · hot-reload · seed · smoke tests
├── tests/              # Integración e idempotencia contra LocalStack
└── docs/               # Manifiesto, diseño técnico, ADRs
```

### Riesgos vigentes

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Cobertura parcial de servicios en LocalStack gratuito | Media | Diseño restringido a servicios core bien soportados; prueba de humo por recurso en el Mes 1. |
| Scope creep por abarcar dos cortes verticales | **Alta** | Backlog congelado: toda idea nueva va a fase 2; revisión quincenal contra el manifiesto. |
| Fricción del ciclo de desarrollo serverless local | Media | Scripts de empaquetado y hot-reload desde el inicio; tests de integración automatizados. |
| Pérdida del estado local del contenedor | Baja | Volumen persistente y scripts de datos semilla reproducibles. |
| Consigna de la cátedra aún no publicada | Media | Diseño portable (LocalStack ↔ AWS real) y documento versionado. |

## Decisiones de diseño

| # | Decisión | Fundamento |
|---|---|---|
| **D1** | Entorno de ejecución local con LocalStack | Aprender arquitectura cloud sin cuenta de AWS, sin tarjeta y sin riesgo de facturación. La migración a AWS real es opción, no requisito. |
| **D2** | Serverless puro con Lambdas por contexto | Funciones agrupadas por contexto de negocio (profesionales, contrataciones, verificador, notificador) en lugar de una por endpoint. Menos piezas, misma pureza arquitectónica. |
| **D3** | Un único pipeline de verificación con dos disparadores | La verificación inicial (evento S3) y la revalidación (scheduler diario) recorren el mismo camino. Un solo código que probar y mantener. |
| **D4** | Padrones simulados detrás de una interfaz | El verificador consulta un *puerto* de padrones; el MVP implementa un mock configurable (respuestas válidas, vencidas, rechazadas, con demora). Integrar un padrón real es escribir un adaptador, no tocar el pipeline. |
| **D5** | DynamoDB como almacenamiento | Patrones de acceso acotados y conocidos; base clave-valor administrada, alineada con el modelo serverless. |
| **D6** | Infraestructura 100% como código (Terraform) | Ningún recurso se crea a mano; el entorno se levanta y destruye con un comando. |

### Garantías operativas comprometidas

- **Idempotencia** en los consumidores de eventos: procesar dos veces el mismo mensaje no debe corromper datos.
- **Reintentos + DLQ**: tres intentos antes de derivar a la cola de mensajes muertos.
- **Máquinas de estado explícitas** con transiciones auditables.
- **Documentos que nunca pasan por la capa de cómputo**: subida directa vía URL prefirmada.

## Equipo

| Integrante | |
|---|---|
| **Iván Daniliuk** | Desarrollo e infraestructura |
| **Nicolás Gabriel Demiryi** | Desarrollo e infraestructura |
