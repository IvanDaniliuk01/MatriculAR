# Mapa · Entrega final del TFI (14/11/2026)

Etiqueta: `wayfinder:map`

## Destination

El viernes 14/11/2026 la entrega final del TFI está subida y cumple el checklist de la cátedra
(`catedra/checklist.pdf` y el checklist del campus): núcleo de verificación (P0) estable y desplegado
en línea con el enlace en el README, Informe Final en PDF, video enlazado, repositorio completo con
pruebas, limitaciones documentadas y lo implementado separado de lo proyectado.

## Notes

- **Este mapa también ejecuta** (excepción a "planificar, no hacer"): las tareas que el agente puede hacer
  solo las resuelve él; las que solo puede hacer Iván (cuenta de AWS, mensajes, grabar el video) se le
  entregan como lista de pasos.
- Iván trabaja solo (Nicolás no responde). Todo en **español**: informe, README y video.
- Criterio de Oscar: no agregar funcionalidades; versión estable, coherente, probada, documentada y defendible.
- **Honestidad como restricción dura:** nada simulado o no implementado se documenta como hecho; no se
  inventa evidencia; no se evaden los bloqueos de Ecogas (User-Agent identificado, sin intermediarios).
- Sin secretos ni datos reales del padrón en el repositorio.
- Skills: `grilling` + `domain-modeling` para decisiones; `research` para evidencia externa.
- Decisiones tomadas al trazar el mapa (10/11):
  - Despliegue en **AWS** (página en S3 + API). Plan B si el 12/11 al mediodía no está: página en Netlify y API en Render.
  - Si Ecogas bloquea a AWS: en línea la verificación da "no se pudo verificar" (comportamiento diseñado);
    se permite una **precarga manual** desde la PC del operador, documentada como tal, con fecha.
  - Video armado por Iván solo; Nicolás sigue figurando como integrante formal; se avisa a Oscar.
  - Grupo **209**.
  - Validación del problema: evidencia pública real con citas + mini encuesta real; lo que no se valide, se declara.

## Decisions so far

<!-- una línea por ticket cerrado: [título](issues/NN-slug.md): resumen -->

- [Evidencia pública real del problema](issues/06-evidencia-publica-del-problema.md): riesgo de CO en alza con fuente oficial, casos judiciales sin matrícula, sin registro nacional y buscadores sin categorías ni vigencia; no hay datos de estafas ni de categoría insuficiente.

- [Crear la cuenta de AWS y dar acceso desde WSL](issues/02-cuenta-aws-y-acceso.md): cuenta en plan gratuito con Projects; WSL conectado con `aws login` como rol de la cuenta del proyecto, sin usuario raíz ni claves.

## Not yet specified

- Qué cambia si Oscar responde que el grupo de un integrante afecta la condición de la entrega.
- Qué hacer con la respuesta de Ecogas a la consulta de Gonzalo, si llega antes del 14.
- Capturas y diagramas exactos del informe: dependen de cómo quede el despliegue.

## Out of scope

- Alta de gasistas subiendo la matrícula revisada por IA: funcionalidad nueva (P1); va al informe como evolución futura, con la advertencia de que un PDF no prueba validez.
- Precarga diaria automatizada desde la PC del operador: saltearía el bloqueo deliberado de Ecogas; evolución futura sujeta a autorización de Ecogas.
- Otras profesiones, P1–P3, HTTPS con CloudFront y la ejecución sobre LocalStack: trabajo futuro.
- Preparación de la defensa en mesa de examen: instancia posterior a este destino.
