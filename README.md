# MatriculAR

**Trabajo final · Tecnicatura Universitaria en Programación (UTN)**

Plataforma que responde, **con evidencia fechada y citable**, si la categoría de un gasista que figura en el padrón de una distribuidora es compatible con un trabajo concreto: qué sabemos, de qué fuente, cuándo lo consultamos y qué no podemos afirmar. Sobre ese núcleo se monta la búsqueda y la contratación de profesionales.

> **Estado del proyecto:** etapa 4 de la hoja de ruta, **implementación** (diseño aprobado con correcciones). Ya están el dominio de la Evaluación, la búsqueda del gasista y el extractor de Ecogas, con pruebas automáticas y CI. Ver [`backend/`](backend/).
>
> 👉 **Para revisar el avance, empezar por el [informe de avance del 02/11](docs/informe-avance-entrega-3.md)**, que responde punto por punto a la devolución de la segunda entrega e incluye el hallazgo principal: **Ecogas no publica el número de matrícula**.

---

## Tabla de contenidos

- [Documentación](#documentación)
- [El problema](#el-problema)
- [Qué es MatriculAR](#qué-es-matricular)
- [Principios rectores](#principios-rectores)
- [Cómo funciona](#cómo-funciona)
- [Alcance](#alcance)
- [Arquitectura y tecnologías](#arquitectura-y-tecnologías)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Puesta en marcha](#puesta-en-marcha)
- [Equipo](#equipo)

---

## Documentación

| Documento | Qué contiene |
|---|---|
| [**Informe de avance, 02/11**](docs/informe-avance-entrega-3.md) | Respuesta a la devolución de la segunda entrega, hallazgo sobre la identidad en Ecogas, qué demuestran los tests y plan hasta el 21/11. |
| [Informe de avance, entrega 2](docs/informe-avance-entrega-2.md) | Histórico: checklist de la segunda entrega y respuesta a la devolución v2. |
| [Glosario (`CONTEXT.md`)](CONTEXT.md) | Vocabulario del dominio: Fuente, Consulta, Credencial, Evaluación, Verificación… |
| [Modelo de dominio](docs/modelo-de-dominio.md) | Credencial frente a Evaluación, recorrido de una Verificación, estados, invariantes y escenarios. |
| [Reglas de categoría y de zona](docs/reglas-de-categoria.md) | Qué habilita cada categoría según la NAG-200, Tipos de trabajo, criterio de zona y vigencia, con citas. |
| [Fuentes y adaptadores](docs/fuentes-y-adaptadores.md) | Cómo se lee el padrón de Ecogas, las cinco validaciones, fallas, reintentos y MetroGAS. |
| [**Esquema de base de datos**](database/README.md) | 15 tablas de DynamoDB: campos, tipos, claves, relaciones, índices y patrones de acceso. |
| [**Módulos**](docs/modulos.md) | 15 módulos con prioridad, dependencias y plan tentativo. |
| [**Arquitectura**](docs/arquitectura.md) | Estilo, capas, tecnologías definitivas y justificación, entornos, seguridad y riesgos. |
| [API](docs/api.md) | Contrato de endpoints, ejemplos por resultado y diagramas de secuencia. |
| [Decisiones (ADR)](docs/adr/) | 0001 sin colas · 0002 consulta bajo demanda · 0003 Credencial separada de Evaluación · 0004 una tabla por entidad · 0005 zona como Limitación · 0006 Lectura minimizada y Protección de la Fuente · 0007 identificación por nombre y localidad. |
| [Consulta a Ecogas](docs/consulta-a-ecogas.md) | Preguntas enviadas a la distribuidora y cómo cambia el diseño según la respuesta. |
| [Investigación de fuentes](investigacion/) | Prueba técnica de la etapa anterior (MetroGAS y Ecogas), con fe de erratas. |

Todos los diagramas están en **Mermaid** dentro de los `.md`, así que se ven directamente en GitHub.

---

## El problema

En Argentina ya existen varias apps que conectan hogares con profesionales de oficios (Timbrit, Clickie, Muovi, Tegu, Tutti, Yamba, Homesolution). La búsqueda y el matching están razonablemente resueltos. Lo que sigue sin resolverse es **saber si el gasista que vas a contratar puede hacer legalmente *ese* trabajo**:

- **La habilitación está fragmentada.** Las matrículas de gasista las otorga cada **distribuidora** (MetroGAS, Naturgy BAN, Camuzzi, Ecogas, Litoral Gas…) bajo las normas de ENARGAS, y cada una publica su padrón de una manera distinta: un archivo web (Ecogas), un buscador protegido con captcha (MetroGAS), un listado por partido (Naturgy BAN).
- **La categoría importa, y no es un nivel.** La NAG-200 define tres categorías con alcances distintos. Por ejemplo, la 3ª solo puede trabajar en viviendas unifamiliares, y un artefacto comercial de más de 50.000 kcal/h requiere la 1ª. "Tiene matrícula" no alcanza: la pregunta es si tiene la categoría **para este trabajo**.
- **Ningún padrón informa la vigencia.** La matrícula se renueva todos los años (vence el 31/03), pero quien no renueva recién sale del registro a los tres años. Figurar en un padrón **no prueba** que la matrícula esté al día.
- **Las verificaciones existentes son puntuales.** Hay un verificador que consulta varias distribuidoras a la vez (servidos.ar), y las plataformas de oficios verifican una vez, al alta, o delegan el control en el usuario: *"pedile el número y consultalo"*. Ninguna dice **para qué trabajo** alcanza la matrícula, **de qué fuente y de qué fecha** es la evidencia, ni **qué no se puede afirmar**.

> **Enunciado del problema**
> No existe una plataforma que informe, con evidencia fechada y trazable, si la matrícula de un gasista es compatible con un trabajo concreto, distinguiendo lo que se sabe de lo que no se puede verificar.

---

## Qué es MatriculAR

Un marketplace de gasistas cuyo núcleo **no es el listado de profesionales, sino la verificación de matrículas contra las fuentes reales**, que responde con precisión:

| Pregunta | Cómo la responde MatriculAR |
|---|---|
| ¿Qué sabemos? | La **Credencial**: nombre, categoría, provincia y localidad que informa el padrón, tal como los publicó. Ecogas no publica el número de matrícula: el gasista se identifica por nombre. |
| ¿De dónde lo sabemos? | La **Fuente**: el padrón de una distribuidora concreta. |
| ¿Cuándo lo verificamos? | La **Consulta**: fecha, intentos y huella del recurso leído. |
| ¿Qué podemos concluir? | La **Evaluación** para un tipo de trabajo: `COMPATIBLE`, `INCOMPATIBLE` o `INDETERMINATE`, con su fundamento normativo. |
| ¿Qué no podemos afirmar? | Las **Limitaciones** (la vigencia, la zona, el número de matrícula) y los resultados `UNVERIFIABLE`. |

Sobre ese núcleo se montan el perfil de los profesionales, la búsqueda por tipo de trabajo y zona, y el ciclo de contratación con reseñas.

---

## Principios rectores

| Principio | Qué significa en la práctica |
|---|---|
| **La confianza se verifica, no se declara** | Ningún gasista figura como compatible con un trabajo sin evidencia de una Fuente real. Lo que la Fuente no publica (la matrícula, la vigencia, la zona) se informa como Limitación. |
| **La ausencia de evidencia no se convierte en certeza** | Si una Fuente no se pudo consultar, el resultado es `UNVERIFIABLE`, no "no encontrado". Nunca se dice "no aparece en ningún padrón" si alguna Fuente no se consultó. |
| **Validar la regla antes de automatizarla** | Ninguna regla entra al sistema sin una cita normativa que la respalde. Lo que no tiene respaldo se informa como `INDETERMINATE`. |
| **La evidencia es inmutable y fechada** | Cada Credencial queda asociada a una Consulta con fecha. Nunca se modifica ni se borra, y una falla nunca pisa la evidencia anterior. |
| **Complejidad solo cuando la necesidad la justifica** | Sin colas ni DLQ hasta que haya un motivo concreto. Los criterios que las justificarían están escritos. |
| **Recorte despiadado de alcance** | Pocas cosas completas en lugar de muchas a medias. El núcleo (P0) se entrega completo y el resto se recorta de abajo hacia arriba. |
| **Diseñado para migrar** | Se desarrolla sobre AWS emulado (LocalStack) y se despliega en AWS real con el mismo código de infraestructura. |

---

## Cómo funciona

```mermaid
flowchart LR
    P([Cliente: ¿Persona Ficticia Uno, de Ecogas,<br/>puede conectar un calefón en una casa de Córdoba?<br/>responde las Condiciones decisivas]) --> C[Consulta a Ecogas<br/>descarga, extrae y valida,<br/>o reutiliza una lectura de hace menos de 15 min]
    C -->|la lectura falla| NV([UNVERIFIABLE<br/>muestra la última evidencia<br/>con su fecha, sin concluir])
    C -->|nadie coincide| NE([NOT_FOUND<br/>en Ecogas, en esta fecha])
    C -->|una o más Coincidencias| CR[Credencial por Coincidencia<br/>categoría 2ª · Villa María · 02/11 15:40]
    CR --> EV[Evaluación<br/>categoría: 2ª admitida · NAG-200 8.3.1]
    EV --> R([COMPATIBLE según la regla aplicada<br/>más las Limitaciones: vigencia,<br/>zona y número de matrícula no verificables])
```

Detalle: [modelo de dominio](docs/modelo-de-dominio.md#4-el-recorrido-de-una-verificación) · [API](docs/api.md#6-secuencias).

---

## Alcance

| Prioridad | Módulos | Compromiso |
|---|---|---|
| **P0 · núcleo** | Fuentes y adaptadores · Consultas y evidencia · Reglas y evaluación · Verificación y API · Interfaz de verificación · Infraestructura · Despliegue en la nube | **Se entrega completo.** |
| **P1 · marketplace** | Profesionales · Vínculos (verificados mediante el email publicado por la Fuente) · Búsqueda | Fuera del alcance de la entrega final. |
| **P2 · contratación** | Usuarios y autenticación · Contratación · Reseñas | Fuera del alcance de la entrega final. |
| **P3 · continuidad** | Revalidación programada · Notificaciones | Fuera del alcance de la entrega final. |

**Fuentes del P0:** Ecogas (Córdoba, Catamarca, La Rioja, Mendoza, San Juan y San Luis; se consulta automáticamente) y MetroGAS (CABA; protegida con captcha, así que **no se consulta automáticamente** y el sistema lo informa como `UNVERIFIABLE`).

**Fuera de alcance (fase 2):** electricistas, otras distribuidoras, pagos, chat, geolocalización fina, back-office y apps nativas. Detalle en [módulos § 5](docs/modulos.md#5-fuera-de-alcance).

---

## Arquitectura y tecnologías

**Serverless en AWS**, organizado como monolito modular por contexto (una función Lambda por contexto), con **arquitectura hexagonal** dentro de cada función, comunicación **sincrónica** y **sin colas**. Detalle y justificación: [arquitectura](docs/arquitectura.md).

| Capa | Tecnología |
|---|---|
| Lenguaje | **TypeScript 7** (compilador nativo), en frontend y backend |
| Backend | **AWS Lambda** con **Node.js 24** (`nodejs24.x`) · esbuild · Zod |
| API | **Amazon API Gateway** (REST) |
| Base de datos | **Amazon DynamoDB**, una tabla por entidad |
| Frontend | **React + Vite** |
| Fase 2 (fuera de la entrega final) | Amazon Cognito · EventBridge Scheduler · SNS |
| Infraestructura como código | **Terraform** (`lstk terraform` en local) |
| Entorno local | **LocalStack** + Docker |
| Nube (etapa 4) | **AWS** (Free plan) |
| Calidad | Vitest · Biome · `tsc --noEmit` |

Decisiones de la primera entrega (D1–D6) y su estado actual: [arquitectura § 6](docs/arquitectura.md#6-decisiones-de-la-primera-entrega-qué-sigue-y-qué-cambió).

---

## Estructura del repositorio

```
MatriculAR/
├── README.md                  este archivo
├── CONTEXT.md                 glosario del dominio
├── docs/                      diseño: informe de avance, modelo, reglas, fuentes, arquitectura, módulos, API
│   └── adr/                   decisiones de arquitectura
├── database/                  esquema de colecciones (DynamoDB)
│   ├── tablas/                definición de cada tabla (equivalente al DDL)
│   └── seed/                  datos iniciales (equivalente al DML) y ejemplos ficticios
├── .github/workflows/         CI: lint, tipos y pruebas del backend en cada push
├── backend/                   TypeScript · Vitest · Biome
│   ├── compartido/            núcleo: dominio (Evaluación, búsqueda), adaptadores (Ecogas, reglas del seed)
│   ├── verificacion/          λ P0 (próximamente)
│   └── …                      λ de P1 a P3, fuera de la entrega final
├── frontend/                  estructura del frontend (React), sin código todavía
├── infra/                     estructura de Terraform, sin código todavía
├── scripts/                   probar-ecogas.sh (prueba de acceso identificado); después, levantar, seed y desplegar
└── investigacion/             prueba técnica de la etapa anterior (exploración aislada)
```

---

## Puesta en marcha

**Hoy:** el backend se prueba con Node.js 24.

```bash
cd backend && npm install
npm run check                 # lint + tipos + pruebas (igual que la CI)
npm run test:fuente-real      # a mano: lee la Ecogas real (MATRICULAR_CONTACTO=<mail>)
```

**Flujo previsto** con la infraestructura ([arquitectura § 7](docs/arquitectura.md#7-entornos-y-costos)).

**Requisitos:** Docker, una cuenta gratuita de LocalStack (plan Student u Hobby) con `LOCALSTACK_AUTH_TOKEN`, Terraform 1.x con `lstk`, y Node.js 24.

```bash
# 1. Levantar LocalStack (el token va en .env, que está ignorado por git)
docker compose up -d

# 2. Crear toda la infraestructura (tablas, funciones, API)
cd infra/entornos/local && lstk terraform init && lstk terraform apply

# 3. Cargar la configuración real (Fuentes, Categorías, Tipos de trabajo)
./scripts/seed

# 4. Frontend
cd frontend && npm install && npm run dev
```

Todo el entorno se destruye y se recrea con un comando (decisión D6).

---

## Equipo

| Integrante | Rol |
|---|---|
| **Iván Daniliuk** | Desarrollo e infraestructura |
| **Nicolás Gabriel Demiryi** | Desarrollo e infraestructura |
