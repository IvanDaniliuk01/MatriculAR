# MatriculAR

**Trabajo final · Tecnicatura Universitaria en Programación (UTN) · Proyecto Final · Grupo 209 · 2026**

Plataforma que responde, **con evidencia fechada y citable**, si la categoría de un gasista que figura en el padrón de una distribuidora es compatible con un trabajo concreto: qué sabemos, de qué fuente, cuándo lo consultamos y qué no podemos afirmar.

## Sistema en línea

### 👉 **<https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1/>**

- Es la pantalla **Verificar a un gasista**. Completás el nombre y apellido de un gasista del padrón de Ecogas, la provincia del trabajo y cinco preguntas sobre el trabajo (con la opción "No sé"), y MatriculAR **lee en ese momento el padrón real de Ecogas** y responde con la evidencia, el criterio de la NAG-200 y las limitaciones.
- API pública de solo consulta, en la misma dirección: `https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1` (por ejemplo, [`/fuentes`](https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1/fuentes) o [`/tipos-trabajo`](https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1/tipos-trabajo)). Contrato: [`docs/api.md`](docs/api.md).
- Desplegado en **AWS** (Lambda, API Gateway, DynamoDB y S3, región `us-east-2`) con Terraform, el 10/11/2026.

## Entrega final

| | |
|---|---|
| **Sistema desplegado** | <https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1/> |
| **Informe Final (PDF)** | [`docs/informe-final.pdf`](docs/informe-final.pdf) (fuente: [`docs/informe-final.md`](docs/informe-final.md)) |
| **Video de presentación** | *próximamente* |
| **Repositorio** | <https://github.com/IvanDaniliuk01/MatriculAR> |
| **Integrantes** | Iván Daniliuk · Nicolás Gabriel Demiryi ([equipo](#equipo)) |

---

## Tabla de contenidos

- [Documentación](#documentación)
- [El problema](#el-problema)
- [Qué es MatriculAR](#qué-es-matricular)
- [Principios rectores](#principios-rectores)
- [Cómo funciona](#cómo-funciona)
- [Alcance: implementado y proyectado](#alcance-implementado-y-proyectado)
- [Arquitectura y tecnologías](#arquitectura-y-tecnologías)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Cómo ejecutarlo en local](#cómo-ejecutarlo-en-local)
- [Cómo desplegarlo en AWS](#cómo-desplegarlo-en-aws)
- [Pruebas](#pruebas)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Equipo](#equipo)

---

## Documentación

| Documento | Qué contiene |
|---|---|
| [Glosario (`CONTEXT.md`)](CONTEXT.md) | Vocabulario del dominio: Fuente, Consulta, Credencial, Evaluación, Verificación… |
| [Modelo de dominio](docs/modelo-de-dominio.md) | Credencial frente a Evaluación, recorrido de una Verificación, estados, invariantes y escenarios. |
| [Reglas de categoría y de zona](docs/reglas-de-categoria.md) | Qué habilita cada categoría según la NAG-200, Tipos de trabajo, Condiciones decisivas, criterio de zona y vigencia, con citas. |
| [Fuentes y adaptadores](docs/fuentes-y-adaptadores.md) | Cómo se lee el padrón de Ecogas, historial del recurso, validaciones, fallas, reintentos y MetroGAS. |
| [**Esquema de base de datos**](database/README.md) | Tablas de DynamoDB: campos, claves, índices y patrones de acceso. DDL en [`database/tablas/`](database/tablas/) y DML en [`database/seed/`](database/seed/). |
| [**Arquitectura**](docs/arquitectura.md) | Estilo, capas, tecnologías y justificación, entornos, seguridad, pruebas y riesgos. |
| [**Módulos**](docs/modulos.md) | Módulos con prioridad, dependencias, plan y estado. |
| [API](docs/api.md) | Contrato de endpoints, ejemplos por resultado y diagramas de secuencia. |
| [Decisiones (ADR)](docs/adr/) | 0001 sin colas · 0002 consulta bajo demanda · 0003 Credencial separada de Evaluación · 0004 una tabla por entidad · 0005 zona como Limitación · 0006 Lectura minimizada y Protección de la Fuente · 0007 identificación por nombre y localidad. |
| [Consulta a Ecogas](docs/consulta-a-ecogas.md) | Preguntas a la distribuidora y cómo cambia el diseño según la respuesta. |
| [Backend](backend/README.md) · [Frontend](frontend/README.md) · [Infraestructura](infra/README.md) · [Scripts](scripts/README.md) | Cómo se corre, se prueba y se despliega cada parte. |
| [Investigación de fuentes](investigacion/) | Prueba técnica de la etapa anterior (MetroGAS y Ecogas), con fe de erratas. |
| [Informe de avance, 02/11](docs/informe-avance-entrega-3.md) · [entrega 2](docs/informe-avance-entrega-2.md) | Histórico: respuestas a las devoluciones del tutor. |
| [Mapa de la entrega final](.scratch/entrega-final/map.md) | Cómo se planificó el cierre hasta el 14/11: decisiones y tareas. |

Todos los diagramas están en **Mermaid** dentro de los `.md`, así que se ven directamente en GitHub.

---

## El problema

En Argentina ya existen varias apps que conectan hogares con profesionales de oficios (Timbrit, Clickie, Muovi, Tegu, Tutti, Yamba, Homesolution). La búsqueda y el matching están razonablemente resueltos. Lo que sigue sin resolverse es **saber si el gasista que vas a contratar puede hacer legalmente *ese* trabajo**:

- **La habilitación está fragmentada.** Las matrículas de gasista las otorga cada **distribuidora** (MetroGAS, Naturgy BAN, Camuzzi, Ecogas, Litoral Gas…) bajo las normas del ente regulador, y cada una publica su padrón de una manera distinta: una página web (Ecogas), un buscador protegido con captcha (MetroGAS), un listado por partido (Naturgy BAN).
- **La categoría importa, y no es un nivel.** La NAG-200 define tres categorías con alcances distintos. Por ejemplo, la 3ª solo puede trabajar en viviendas unifamiliares, y un artefacto comercial de más de 50.000 kcal/h requiere la 1ª. "Tiene matrícula" no alcanza: la pregunta es si tiene la categoría **para este trabajo**.
- **Ningún padrón informa la vigencia.** La matrícula se renueva todos los años (vence el 31/03), pero quien no renueva recién sale del registro a los tres años. Figurar en un padrón **no prueba** que la matrícula esté al día.
- **Las verificaciones existentes son puntuales.** Las plataformas de oficios verifican una vez, al alta, o delegan el control en el usuario: *"pedile el número y consultalo"*. Ninguna dice **para qué trabajo** alcanza la matrícula, **de qué fuente y de qué fecha** es la evidencia, ni **qué no se puede afirmar**.

> **Enunciado del problema**
> No existe una plataforma que informe, con evidencia fechada y trazable, si la matrícula de un gasista es compatible con un trabajo concreto, distinguiendo lo que se sabe de lo que no se puede verificar.

---

## Qué es MatriculAR

El núcleo de MatriculAR **no es un listado de profesionales, sino la verificación contra las fuentes reales**, que responde con precisión:

| Pregunta | Cómo la responde MatriculAR |
|---|---|
| ¿Qué sabemos? | La **Credencial**: nombre, categoría, provincia y localidad que informa el padrón, tal como los publicó. Ecogas no publica el número de matrícula: el gasista se identifica por nombre y localidad. |
| ¿De dónde lo sabemos? | La **Fuente**: el padrón de una distribuidora concreta. |
| ¿Cuándo lo verificamos? | La **Consulta**: fecha, intentos y huella (SHA-256) del recurso leído. |
| ¿Qué podemos concluir? | La **Evaluación** para el trabajo: `COMPATIBLE`, `INCOMPATIBLE` o `INDETERMINATE`, con su fundamento normativo. |
| ¿Qué no podemos afirmar? | Las **Limitaciones** (la vigencia, la zona, el número de matrícula) y los resultados `UNVERIFIABLE`. |

Sobre ese núcleo se diseñaron (fuera del alcance de esta entrega) el perfil de los profesionales, la búsqueda por tipo de trabajo y zona, y el ciclo de contratación con reseñas.

---

## Principios rectores

| Principio | Qué significa en la práctica |
|---|---|
| **La confianza se verifica, no se declara** | Ningún gasista figura como compatible con un trabajo sin evidencia de una Fuente real. Lo que la Fuente no publica (la matrícula, la vigencia, la zona) se informa como Limitación. |
| **La ausencia de evidencia no se convierte en certeza** | Si una Fuente no se pudo consultar, el resultado es `UNVERIFIABLE`, no "no encontrado". |
| **Validar la regla antes de automatizarla** | Ninguna regla entra al sistema sin una cita normativa que la respalde. Lo que no tiene respaldo se informa como `INDETERMINATE`. |
| **La evidencia es inmutable y fechada** | Cada Credencial queda asociada a una Consulta con fecha. Nunca se modifica ni se borra, y una falla nunca pisa la evidencia anterior. |
| **Complejidad solo cuando la necesidad la justifica** | Sin colas ni DLQ hasta que haya un motivo concreto. Los criterios que las justificarían están escritos. |
| **Recorte despiadado de alcance** | Pocas cosas completas en lugar de muchas a medias. El núcleo (P0) se entrega completo; el resto queda diseñado. |
| **Infraestructura como código** | Todo lo desplegado en AWS sale del mismo Terraform, y se recrea o destruye con un comando. |

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

## Alcance: implementado y proyectado

| Parte | Estado | Detalle |
|---|---|---|
| **Verificación de un gasista (P0)**: búsqueda por nombre y localidad, Condiciones decisivas, Evaluación por categoría, Limitaciones, evidencia previa | ✅ **Implementado, probado y desplegado** | [Backend](backend/README.md) · [modelo](docs/modelo-de-dominio.md) |
| **Fuente Ecogas** (Córdoba, Catamarca, La Rioja, Mendoza, San Juan y San Luis): lectura automática, validaciones, reintentos, Ventana de reutilización de 15 min y Protección de la Fuente | ✅ **Implementado y probado** contra la Fuente real, desde una PC y desde AWS | [Fuentes](docs/fuentes-y-adaptadores.md) |
| **Fuente MetroGAS** (CABA): protegida con captcha | ✅ **Implementado como no automatizable**: responde `UNVERIFIABLE` con el link al buscador oficial | [Fuentes § 5](docs/fuentes-y-adaptadores.md#5-adaptador-de-metrogas-no-automatizable) |
| **API REST** con verificación, consulta de una Verificación, salud de la Fuente, historial y catálogos | ✅ **Implementado, probado y desplegado** | [API](docs/api.md) |
| **Interfaz web** (una pantalla: Verificar a un gasista) | ✅ **Implementado, probado y desplegado** | [Frontend](frontend/README.md) |
| **Persistencia** en DynamoDB (4 tablas) y S3 (Lecturas minimizadas, 1 día) | ✅ **Implementado y desplegado**; comprobado con el recorrido real | [Base de datos](database/README.md) |
| **Infraestructura** con Terraform, alerta de presupuesto, logs y alarma de Consultas fallidas | ✅ **Desplegado en AWS** (`us-east-2`) | [Infraestructura](infra/README.md) |
| Entorno local con **LocalStack** | ⚠️ **Configurado, no ejecutado** (Docker no estaba disponible) | [Arquitectura § 7](docs/arquitectura.md#7-entornos-y-costos) |
| Pantallas *Verificación compartida* e *Historial* | ⏳ Proyectado (la API ya las soporta) | [Frontend](frontend/README.md) |
| **P1 · marketplace**: profesionales, Vínculos, búsqueda | ⏳ Proyectado, fuera de la entrega final | [Módulos](docs/modulos.md) |
| **P2 · contratación**: cuentas (Cognito), contratación, reseñas | ⏳ Proyectado, fuera de la entrega final | [Módulos](docs/modulos.md) |
| **P3 · continuidad**: revalidación diaria, notificaciones | ⏳ Proyectado, fuera de la entrega final | [Módulos](docs/modulos.md) |
| Otras distribuidoras y otras profesiones (electricistas, etc.) | ⏳ Proyectado | [Módulos § 5](docs/modulos.md#5-fuera-de-alcance) |

---

## Arquitectura y tecnologías

**Serverless en AWS**, organizado como monolito modular por contexto (una función Lambda por contexto; en el P0, solo `verificacion`), con **arquitectura hexagonal** dentro de la función, comunicación **sincrónica** y **sin colas**. La misma API sirve el frontend, así que el sistema tiene **un único enlace con HTTPS**. Detalle y justificación: [arquitectura](docs/arquitectura.md).

| Capa | Tecnología |
|---|---|
| Lenguaje | **TypeScript 7** (compilador nativo), en frontend y backend |
| Frontend | **React 19 + Vite 8** |
| Backend | **AWS Lambda** con **Node.js 24** (`nodejs24.x`, arm64) · esbuild · Zod · AWS SDK v3 |
| API | **Amazon API Gateway** (REST), con límites de uso |
| Base de datos | **Amazon DynamoDB** (una tabla por entidad) y **Amazon S3** (Lecturas minimizadas) |
| Observabilidad | CloudWatch Logs, métrica y alarma de Consultas fallidas, presupuesto de USD 5 |
| Infraestructura como código | **Terraform** (provider AWS 6.x) |
| Nube | **AWS**, plan gratuito, región `us-east-2` |
| Calidad | Vitest · Testing Library · Biome · `tsc --noEmit` · GitHub Actions |
| Fase 2 (proyectado) | Amazon Cognito · EventBridge Scheduler · SNS |

---

## Estructura del repositorio

```
MatriculAR/
├── README.md                  este archivo
├── CONTEXT.md                 glosario del dominio
├── docs/                      diseño: modelo, reglas, fuentes, arquitectura, módulos, API, informes
│   └── adr/                   decisiones de arquitectura
├── database/                  esquema de DynamoDB
│   ├── tablas/                definición de cada tabla (equivalente al DDL)
│   └── seed/                  reglas y catálogos (equivalente al DML) y ejemplos ficticios
├── backend/                   TypeScript · Vitest · Biome
│   ├── compartido/            núcleo: dominio, caso de uso Verificar, puertos y adaptadores (Ecogas, DynamoDB, S3)
│   └── verificacion/          λ verificacion (P0): handler de la API, servidor local y CLI
├── frontend/                  React + Vite: pantalla Verificar a un gasista
├── infra/                     Terraform: módulos y entornos (aws, local)
├── scripts/                   desplegar en AWS, levantar LocalStack, probar el acceso a Ecogas
├── .github/workflows/         CI de backend y frontend; prueba manual de Ecogas desde la nube
└── investigacion/             prueba técnica de la etapa anterior (exploración aislada)
```

---

## Cómo ejecutarlo en local

**Requisitos:** Node.js 24 (`nvm use` en `backend/` y en `frontend/` toma la versión de su `.nvmrc`). No hace falta cuenta de AWS: en local, los datos se guardan en archivos (`backend/.datos-locales/`, ignorado por git) y se lee la Ecogas real.

```bash
# 1. API local (la misma que la Lambda) en http://localhost:3000
cd backend && npm install
npm run servir

# 2. En otra terminal, la interfaz web en http://localhost:5173
cd frontend && npm install
npm run dev
```

También se puede verificar desde la terminal, sin interfaz:

```bash
cd backend
npm run verificar -- --nombre "Nombre Apellido" --provincia "Córdoba" \
  --condicion comercio_o_industria=NO --condicion unica_vivienda=SI \
  --condicion consumo_total_hasta_5m3h=SI --condicion artefacto_mas_de_50000=NO \
  --condicion gas_natural_red_baja_presion=SI
```

**Variables de entorno:** documentadas en [`.env.example`](.env.example) (backend e infraestructura) y [`frontend/.env.example`](frontend/.env.example). Ninguna es un secreto y todas tienen un valor por defecto que funciona en local. Detalle en el [README del backend](backend/README.md).

No hace falta cargar datos semilla: las reglas de [`database/seed/`](database/seed/) viajan dentro del paquete y se validan al arrancar.

---

## Cómo desplegarlo en AWS

**Requisitos:** Node.js 24, Terraform ≥ 1.9, AWS CLI v2 y una cuenta de AWS ([detalle](scripts/README.md#requisitos)).

```bash
aws login --remote --region us-east-2   # credenciales temporales; nunca van al repositorio
bash scripts/desplegar-aws.sh           # build del frontend, paquete de la función, plan de Terraform y confirmación
```

El script pide el email de la alerta de presupuesto (no se guarda en el repositorio), muestra el plan y **pide confirmación** antes de aplicar. Al final imprime la URL del sistema. La región es `us-east-2` porque la cuenta del plan gratuito con *Projects* solo permite crear recursos en la región del proyecto ([arquitectura § 7](docs/arquitectura.md#7-entornos-y-costos)).

---

## Pruebas

```bash
cd backend && npm run check    # Biome + tsc + Vitest
cd frontend && npm run check   # Biome + tsc + Vitest + Testing Library
```

| Paquete | Resultado (10/11/2026) | Qué cubren |
|---|---|---|
| Backend | **140 pasan**, 1 omitida | Dominio (categorías, Condiciones decisivas, "No sé", zona, trabajo no cubierto), extracción y lectura de Ecogas (cambios de formato, 403, 5xx, reintentos), caso de uso (homónimos, `NOT_FOUND`, Ventana de reutilización, `UNVERIFIABLE` con evidencia previa), contrato de repositorios, rutas de la API y servido del frontend. [Detalle](backend/README.md) |
| Frontend | **8 pasan** | Formulario, envío exitoso, validación, `UNVERIFIABLE`, errores de la API y resolución de la URL de la API. |

La CI de GitHub Actions corre lo mismo en cada push. La prueba omitida es la de contrato contra DynamoDB y S3, que necesita credenciales de AWS y se corre a mano: el 10/11/2026 sus **9 pruebas pasaron contra AWS real** (us-east-2, con tablas y bucket temporales que se borran al terminar). Además se comprobó el **recorrido real desplegado**: una verificación desde el navegador contra la API en AWS, con lectura en vivo del padrón de Ecogas.

---

## Limitaciones conocidas

| Limitación | Por qué | Cómo se informa |
|---|---|---|
| **Ecogas no publica el número de matrícula** | El padrón solo tiene nombre, categoría, provincia y localidad. | La identificación es por nombre y localidad; con homónimos se muestran todas las Coincidencias y el usuario elige con el carné ([ADR-0007](docs/adr/0007-identificacion-por-nombre-y-localidad.md)). |
| **Ninguna Fuente informa la vigencia** | La matrícula se renueva cada año y el padrón no lo dice. | Limitación en cada resultado: "figurar en el padrón no prueba que esté renovada". |
| **La provincia es la del domicilio**, no la zona habilitada | Ecogas publica un único listado. | Limitación de zona ([ADR-0005](docs/adr/0005-zona-como-limitacion-en-el-p0.md)). |
| **Dependencia de una fuente web externa** | Ecogas puede cambiar el formato (ya pasó dos veces) o bloquear el acceso (bloquea las IP de GitHub Actions; las de AWS no, al 10/11/2026). | Validaciones del recurso; una falla da `UNVERIFIABLE` con la última evidencia, nunca un falso "no encontrado". |
| **Sin autorización explícita de Ecogas** para el acceso automatizado | La consulta sobre condiciones de uso está pendiente ([consulta](docs/consulta-a-ecogas.md)). | El adaptador se identifica con su `User-Agent` y lee como máximo una vez cada 15 minutos. |
| **MetroGAS no se consulta automáticamente** | Su buscador tiene captcha y no se evade. | `UNVERIFIABLE` con el link al buscador oficial. |
| **Límite de 29 s de API Gateway** | Una lectura muy lenta de Ecogas recibe un `504`. | La lectura queda guardada y el pedido siguiente la reutiliza (P-4). En AWS hoy tarda ~1,5 s. |
| **Una lectura interrumpida no queda registrada** | La Consulta se escribe al terminar, no antes del primer pedido. | Simplificación del P0 ([arquitectura § 9](docs/arquitectura.md#9-garantías-operativas)). |
| **LocalStack no se ejecutó** | Docker no estaba disponible y la entrega se adelantó al 14/11. | Las pruebas de contrato de DynamoDB y S3 se corrieron contra AWS real, y el recorrido completo se comprobó en línea. |
| **La alarma de Consultas fallidas no notifica** | El destino SNS es una variable opcional. | La salud de la Fuente se ve en `GET /fuentes/ecogas/consultas`. |

---

## Equipo

**Grupo 209** · Tutor: **Oscar**

| Integrante | Rol |
|---|---|
| **Iván Daniliuk** | Desarrollo e infraestructura |
| **Nicolás Gabriel Demiryi** | Desarrollo e infraestructura |
