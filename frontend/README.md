# Frontend

> **Todavía no hay código.** Esta carpeta tiene la estructura acordada en el diseño (segunda entrega).

SPA en **React + Vite + TypeScript 7**. Consume la [API](../docs/api.md) y comparte con el backend los esquemas Zod de [`backend/compartido/src/esquemas/`](../backend/compartido/). En local apunta a la API de LocalStack; en la nube (etapa 4) se sirve desde S3.

## Estructura

```
frontend/
├── public/
└── src/
    ├── pantallas/     Verificar (P0), Verificación compartida (P0), Historial (P0), Perfil y Búsqueda (P1), Contrataciones (P2)
    ├── componentes/   Resultado, Coincidencia, Criterio, Evidencia, Limitaciones, CondicionesDecisivas, DetalleConsulta
    └── api/           cliente HTTP tipado con los esquemas compartidos
```

## Pantalla del P0: Verificar a un gasista (M05)

Es la "interfaz mínima" que pidió el tutor para recorrer el flujo completo. Ecogas no publica el número de matrícula, así que el gasista se busca por nombre ([ADR-0007](../docs/adr/0007-identificacion-por-nombre-y-localidad.md)). El Cliente no elige un Tipo de trabajo: responde las Condiciones decisivas, con la opción "No sé".

### Formulario

```
┌─────────────────────────────────────────────────────────────────┐
│  Verificar a un gasista                                         │
│                                                                 │
│  Distribuidora       [ Ecogas                          ▼ ]      │
│  Nombre y apellido   [ Persona Ficticia Uno              ]      │
│  Localidad (opcional)[ Villa María                       ]      │
│  Provincia del trabajo [ Córdoba                       ▼ ]      │
│                                                                 │
│  Contanos sobre el trabajo                   Sí   No   No sé    │
│  ¿Es en un comercio o una industria?         ○    ●    ○        │
│  ¿El terreno tiene una única vivienda?       ○    ○    ●        │
│  ¿El consumo total es de hasta 5 m³/h?       ○    ○    ●        │
│  ¿Algún artefacto supera 50.000 kcal/h?      ○    ●    ○        │
│  ¿Gas natural por red, menos de 2 kg/cm²?    ●    ○    ○        │
│   (cada pregunta tiene una ayuda y su cita normativa)           │
│                                                                 │
│                                  [ Verificar ]                  │
└─────────────────────────────────────────────────────────────────┘
```

### Resultado

```
┌─────────────────────────────────────────────────────────────────┐
│  Encontramos 1 gasista con ese nombre en el padrón de Ecogas    │
│  (lectura del 02/11/2026 15:40). Confirmalo con su carné.       │
│                                                                 │
│  ● COMPATIBLE según la regla aplicada                           │
│  La categoría informada (2ª) es compatible con este tipo de     │
│  trabajo, cualquiera sea la respuesta que no sabés, según la    │
│  regla aplicada (NAG-200, 8.3.1). La vigencia de la matrícula   │
│  no pudo verificarse.                                           │
│                                                                 │
│  QUÉ SABEMOS · evidencia                                        │
│   Nombre informado     PERSONA FICTICIA UNO                     │
│   Categoría informada  2ª                                       │
│   Localidad informada  Villa María (domicilio del matriculado)  │
│   Fuente · fecha       Ecogas · 02/11/2026 15:40                │
│                                                                 │
│  QUÉ CONCLUIMOS · criterio                                      │
│   ✔ Categoría  2ª admitida en todos los trabajos posibles       │
│                según tus respuestas (A1 y A2)                   │
│                                                                 │
│  QUÉ NO PODEMOS AFIRMAR · limitaciones                          │
│   ! La Fuente no informa la vigencia. Pedile el carné con la    │
│     matrícula actualizada (NAG-200, 8.6.1).                     │
│   ! Ecogas no publica el número de matrícula: la identificación │
│     es por nombre y localidad.                                  │
│   ! La Fuente no permite determinar si la matrícula habilita a  │
│     trabajar en Córdoba.                                        │
│                                                                 │
│  ▸ Detalle técnico (Consulta, intentos, huella del recurso)     │
│  [ Copiar enlace ]                                              │
└─────────────────────────────────────────────────────────────────┘
```

Si hay homónimos, se muestra una tarjeta por Coincidencia, cada una con su Evaluación, bajo el título *"Encontramos N gasistas con ese nombre: elegí el que coincide con su carné"*. MatriculAR nunca elige por el Cliente.

### Cómo se muestra cada resultado

| Resultado | Encabezado | Color / ícono | Qué se muestra además |
|---|---|---|---|
| `COMPATIBLE` | "Compatible según la regla aplicada" | Verde · ✔ | Evidencia, Criterio y Limitaciones |
| `INCOMPATIBLE` | "No compatible con este trabajo" | Rojo · ✖ | Qué Criterio no se cumple y su cita |
| `INDETERMINATE` | "No podemos determinarlo" | Ámbar · ? | Por qué, y qué Condición decisiva lo resolvería |
| `NOT_FOUND` | "Nadie con ese nombre figura en el padrón de Ecogas" | Gris · — | La fecha de la Consulta exitosa y la aclaración "no dice nada sobre otras distribuidoras" |
| `TOO_MANY_MATCHES` | "Hay demasiados gasistas con ese nombre" | Gris · ⓘ | Pedido de agregar la localidad o el nombre completo |
| `UNVERIFIABLE` (falla) | "No pudimos consultar la Fuente" | Ámbar · ⚠ | El motivo, la **última evidencia con su fecha como contexto** y el link al buscador oficial |
| `UNVERIFIABLE` (MetroGAS) | "Esta Fuente no permite consultas automáticas" | Gris · ⓘ | El link al buscador oficial |

Reglas de la interfaz:

- En los resultados de una Verificación **nunca** se usa "habilitado", "vigente" ni "verificado". "Verificado" solo aparece para el estado del Vínculo del Profesional (P1).
- Toda afirmación muestra **de qué Fuente y de qué fecha** es la evidencia.
- La evidencia previa, cuando se muestra, va separada y rotulada como *"Última evidencia disponible (no se usa para concluir)"*.
- El sitio es responsive: se tiene que poder usar desde el celular, frente al gasista.
