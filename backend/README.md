# Backend

> **Todavía no hay código.** Esta carpeta tiene la estructura acordada en el diseño (segunda entrega). La implementación empieza cuando el tutor apruebe el diseño.

Backend **serverless** en **TypeScript 7** sobre **Node.js 24** (`nodejs24.x` en AWS Lambda), con arquitectura **hexagonal**: el dominio en el centro, sin dependencias de AWS ni de las Fuentes. Ver [`docs/arquitectura.md`](../docs/arquitectura.md).

## Estructura

```
backend/
├── compartido/        núcleo compartido por todas las funciones (dominio, casos de uso, puertos, adaptadores)
├── verificacion/      λ verificacion · P0 · handlers HTTP del núcleo de verificación
├── profesionales/     λ profesionales · P1 · perfil, Vínculos y búsqueda
├── contrataciones/    λ contrataciones · P2 · contratación y Reseñas
├── revalidacion/      λ revalidacion · P3 · revalidación diaria (EventBridge Scheduler)
└── notificaciones/    λ notificaciones · P3 · avisos vía SNS
```

**¿Por qué un núcleo compartido?** Las reglas de verificación se usan desde cuatro funciones: verificación, búsqueda, contratación y revalidación. En lugar de que se llamen entre sí por HTTP, cada función incluye el núcleo al empaquetarse (con esbuild). Así hay **una sola implementación de las reglas** y ninguna llamada de red interna.

**Regla de dependencias:** `handlers → aplicacion → dominio`. Los adaptadores implementan los puertos. El dominio no importa nada de `adaptadores/` ni del SDK de AWS.

## Herramientas (se configuran al iniciar la implementación)

| Herramienta | Uso |
|---|---|
| TypeScript 7.0 (`tsc --noEmit`, `--build`) | Chequeo de tipos |
| esbuild | Un paquete por función, con el AWS SDK v3 incluido |
| Zod | Validación de pedidos, registros de las Fuentes e ítems |
| Vitest | Pruebas unitarias y de integración (contra LocalStack) |
| Biome | Lint y formato |
