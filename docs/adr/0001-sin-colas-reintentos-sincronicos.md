---
estado: aceptada
fecha: 2026-09-26
reemplaza: D3 de la primera entrega (pipeline SQS + DLQ con dos disparadores)
---

# Sin colas: reintentos sincrónicos dentro de la misma invocación

La primera entrega planteaba un pipeline asíncrono: evento de S3 → SQS → Lambda verificadora → DLQ después de tres fallos, más un scheduler que reencolaba. El tutor observó que todavía no hay una necesidad concreta que justifique colas y DLQ, y pidió **primero el mecanismo más simple que permita registrar el intento → detectar el error → reintentar → conservar el estado del fallo → informar**. Decidimos que cada Verificación lea la Fuente **de forma sincrónica** dentro de la Lambda que atiende el pedido: hasta 3 Intentos, esperando 1 s antes del segundo y 2 s antes del tercero, con un límite total de 24 s (por debajo de los 29 s de API Gateway), **reintentando solo las fallas transitorias**. Cada Intento se registra en la Consulta, que se crea en estado `IN_PROGRESS` antes del primer pedido.

## Opciones consideradas

- **SQS + Lambda consumidora + DLQ** (plan original): desacopla y absorbe picos, pero agrega un cliente que tiene que consultar el resultado cada tanto (o websockets), mensajes duplicados que hay que manejar con idempotencia, la operación de la DLQ y más infraestructura para probar en LocalStack. Todo eso para un volumen que hoy es de unas pocas consultas.
- **Invocación asíncrona de Lambda con destino ante fallas**: menos piezas que SQS, pero igual obliga al cliente a esperar el resultado de otra forma.
- **Reintentos sincrónicos** (elegida): el cliente recibe la respuesta completa en un solo pedido y el fallo queda registrado en la base.

## Consecuencias

- La respuesta tarda lo que tarda leer la Fuente (unos 2 s en el caso normal y hasta 24 s en el peor). Es aceptable para una consulta puntual.
- Una `EXTRACTION_FAILED` **no se reintenta**: es un cambio estructural de la Fuente y fallaría igual.
- La revalidación programada (P3) usa **los mismos componentes del núcleo** (lectura de la Fuente, registro de la Consulta y de los Resultados) a través del caso de uso *Revalidar*, disparado por EventBridge Scheduler y sin cola: se conserva la idea de la D3 (un solo camino, dos disparadores) pero sin el pipeline asíncrono.
- **Criterios que justificarían incorporar colas** (se revisan en cada entrega):
  - una revalidación que no entra en los 15 minutos de una invocación de Lambda;
  - más de una Fuente automatizable, con límites de uso distintos que haya que espaciar;
  - notificaciones a terceros que no deben bloquear la respuesta (P3);
  - una tasa de fallas transitorias que haga que valga la pena reintentar en diferido.
