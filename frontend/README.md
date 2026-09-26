# Frontend

> **Todavía no hay código.** Esta carpeta tiene la estructura acordada en el diseño (segunda entrega).

SPA en **React + Vite + TypeScript 7**. Consume la [API](../docs/api.md) y comparte con el backend los esquemas Zod de [`backend/compartido/src/esquemas/`](../backend/compartido/). En local apunta a la API de LocalStack; en la nube (etapa 4) se sirve desde S3.

## Estructura

```
frontend/
├── public/
└── src/
    ├── pantallas/     Verificar (P0), Verificación compartida (P0), Historial (P0), Perfil y Búsqueda (P1), Contrataciones (P2)
    ├── componentes/   Resultado, Criterio, Evidencia, Limitaciones, DetalleConsulta, SelectorTipoTrabajo
    └── api/           cliente HTTP tipado con los esquemas compartidos
```

## Pantalla del P0: Verificar una matrícula (M05)

Es la "interfaz mínima" que pidió el tutor para recorrer el flujo completo.

### Formulario

```
┌─────────────────────────────────────────────────────────────────┐
│  Verificar la matrícula de un gasista                           │
│                                                                 │
│  Distribuidora   [ Ecogas                            ▼ ]        │
│  Matrícula       [ 99001                               ]        │
│  Trabajo         [ A1 · Artefacto en vivienda unifamiliar ▼ ]   │
│                  Este tipo de trabajo supone:                   │
│                  · Vivienda unifamiliar (no edificio, PH…)      │
│                  · Consumo total de hasta 5 m³/h                │
│                  ¿No estás seguro? Elegí A2.                    │
│  Provincia       [ Córdoba                           ▼ ]        │
│                                                                 │
│                                  [ Verificar ]                  │
└─────────────────────────────────────────────────────────────────┘
```

### Resultado

```
┌─────────────────────────────────────────────────────────────────┐
│  ● COMPATIBLE con este trabajo                                  │
│  La matrícula 99001 figura en el padrón de Ecogas (consulta del │
│  26/09/2026 15:40) con categoría 2ª, que puede realizar este    │
│  trabajo.                                                       │
│                                                                 │
│  QUÉ SABEMOS · evidencia                                        │
│   Nombre informado     PERSONA FICTICIA UNO                     │
│   Categoría informada  2ª                                       │
│   Provincia informada  Córdoba (domicilio del matriculado)      │
│   Fuente · fecha       Ecogas · 26/09/2026 15:40                │
│                                                                 │
│  QUÉ CONCLUIMOS · criterios                                     │
│   ✔ Categoría  2ª admitida para este trabajo (NAG-200, 8.3.1)   │
│   ✔ Zona       Córdoba está en el área de Ecogas                │
│                                                                 │
│  QUÉ NO PODEMOS AFIRMAR · limitaciones                          │
│   ! La Fuente no informa la vigencia. Pedile el carné con la    │
│     matrícula actualizada (NAG-200, 8.6.1).                     │
│   ! Se supone que el trabajo cumple las condiciones del tipo A1.│
│                                                                 │
│  ▸ Detalle técnico (Consulta, intentos, huella del recurso)     │
│  ▸ Historial de esta matrícula                                  │
│  [ Copiar enlace ]                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Cómo se muestra cada resultado

| Resultado | Encabezado | Color / ícono | Qué se muestra además |
|---|---|---|---|
| `COMPATIBLE` | "Compatible con este trabajo" | Verde · ✔ | Evidencia, Criterios y Limitaciones |
| `NO_COMPATIBLE` | "No compatible con este trabajo" | Rojo · ✖ | Qué Criterio no se cumple y su cita |
| `INDETERMINADA` | "No podemos determinarlo" | Ámbar · ? | Qué Criterio quedó indeterminado y por qué |
| `NO_ENCONTRADA` | "No figura en el padrón de Ecogas" | Gris · — | La fecha de la Consulta exitosa y la aclaración "no dice nada sobre otras distribuidoras" |
| `NO_VERIFICABLE` (falla) | "No pudimos consultar la Fuente" | Ámbar · ⚠ | El motivo, la **última evidencia con su fecha como contexto** y el link al buscador oficial |
| `NO_VERIFICABLE` (MetroGAS) | "Esta Fuente no permite consultas automáticas" | Gris · ⓘ | El link al buscador oficial |

Reglas de la interfaz:

- **Nunca** se usa "habilitado", "vigente" ni "verificado".
- Toda afirmación muestra **de qué Fuente y de qué fecha** es la evidencia.
- La evidencia previa, cuando se muestra, va separada y rotulada como *"Última evidencia disponible (no se usa para concluir)"*.
- El sitio es responsive: se tiene que poder usar desde el celular, frente al gasista.
