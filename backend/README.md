# Backend

> **Estado (02/11/2026):** ya están implementados:
> - el **dominio de la Evaluación**: clasificación del trabajo por Condiciones decisivas, Criterio de categoría, Limitaciones y explicación, con las reglas cargadas desde [`database/seed/`](../database/seed/);
> - la **búsqueda del gasista** por nombre y localidad ([ADR-0007](../docs/adr/0007-identificacion-por-nombre-y-localidad.md));
> - el **extractor de Ecogas**, que reconoce los dos formatos conocidos del recurso y aplica las validaciones V2 a V5.
>
> Lo próximo es el acceso HTTP con reintentos, la Consulta y la Credencial persistidas, y el recorrido completo por CLI ([plan](../docs/modulos.md#6-plan-tentativo)).

## Cómo correrlo

Requiere Node.js 24 (`nvm use` toma la versión de `.nvmrc`).

```bash
cd backend
npm install
npm test            # pruebas (Vitest)
npm run check       # lint (Biome) + tipos (tsc) + pruebas: lo mismo que corre la CI
```

| Pruebas | Qué demuestran |
|---|---|
| [`compartido/test/dominio/`](compartido/test/dominio/) | Categoría desconocida, "No sé" en una Condición decisiva, Limitación de zona, trabajo no cubierto, el texto de `COMPATIBLE`, la búsqueda con homónimos y la coherencia de las reglas del seed. |
| [`compartido/test/adaptadores/`](compartido/test/adaptadores/) | Los dos formatos de Ecogas, cambio de estructura, extracción incompleta y caída brusca. Siempre `EXTRACTION_FAILED`, nunca "0 matriculados". Los fixtures son sintéticos, con la estructura exacta del recurso real. |
| [`compartido/test/recorrido.test.ts`](compartido/test/recorrido.test.ts) | El recorrido página → extracción → gasista → trabajo → Evaluación → explicación. |
| [`compartido/test/fuente-real/`](compartido/test/fuente-real/) | Lectura de la Ecogas real. Solo corre a mano (`npm run test:fuente-real`) y nunca en CI: el padrón tiene datos personales y no hay que cargar a la Fuente. |

Backend **serverless** en **TypeScript 7** sobre **Node.js 24** (`nodejs24.x` en AWS Lambda), con arquitectura **hexagonal**: el dominio en el centro, sin dependencias de AWS ni de las Fuentes. Ver [`docs/arquitectura.md`](../docs/arquitectura.md).

## Estructura

```
backend/
├── compartido/        núcleo compartido por todas las funciones (dominio, casos de uso, puertos, adaptadores)
├── verificacion/      λ verificacion · P0 · handlers HTTP del núcleo de verificación
├── profesionales/     λ profesionales · P1 · fuera del alcance de la entrega final
├── contrataciones/    λ contrataciones · P2 · fuera del alcance de la entrega final
├── revalidacion/      λ revalidacion · P3 · fuera del alcance de la entrega final
└── notificaciones/    λ notificaciones · P3 · fuera del alcance de la entrega final
```

**¿Por qué un núcleo compartido?** Las reglas de verificación se usan desde cuatro funciones: verificación, búsqueda, contratación y revalidación. En lugar de que se llamen entre sí por HTTP, cada función incluye el núcleo al empaquetarse (con esbuild). Así hay **una sola implementación de las reglas** y ninguna llamada de red interna.

**Regla de dependencias:** `handlers → aplicacion → dominio`. Los adaptadores implementan los puertos. El dominio no importa nada de `adaptadores/` ni del SDK de AWS.

## Herramientas

| Herramienta | Uso |
|---|---|
| TypeScript 7.0 (`tsc --noEmit`) | Chequeo de tipos |
| esbuild | Un paquete por función, con el AWS SDK v3 incluido (se configura con la Lambda) |
| Zod | Validación de pedidos, registros de las Fuentes e ítems |
| Vitest | Pruebas unitarias y de integración (contra LocalStack) |
| Biome | Lint y formato |
