# Apoyo para el video final · MatriculAR

Ideas fuerza, no un guion: leelas antes, ensayá en voz alta con cronómetro y grabá hablando con tus palabras.
Duración orientativa: 10 a 12 minutos. Pantalla compartida con el sistema en línea y, como apoyo, 4 o 5 diapositivas
con títulos de una línea.

## 1. Presentación (≈30 s)
- Quién sos, grupo 209, Tecnicatura Universitaria en Programación (UTN), tutor Oscar.
- Equipo formal: Iván y Nicolás. Decilo tal cual: en la etapa final seguiste solo.
- MatriculAR en una frase: "te dice si la categoría de un gasista sirve para tu trabajo, con evidencia fechada del padrón oficial".

## 2. El problema (≈1,5 min)
- Contratar a un gasista sin matrícula, o con una categoría que no alcanza, es riesgo de monóxido y de explosión.
- Dato fuerte con fuente: los boletines del Ministerio de Salud de 2026 muestran casos de CO por encima de lo esperado, con Cuyo alto.
- No hay registro nacional de matriculados; cada distribuidora publica su listado.
- El buscador de Ecogas te dice que la persona figura, pero no qué trabajos puede hacer su categoría, ni si la matrícula está vigente, y ni siquiera muestra el número.
- Usuarios: quien contrata (particular, consorcio, comercio).
- Validación: evidencia pública. No hicimos entrevistas ni encuestas: decilo como limitación.

## 3. Objetivo y alcance (≈1 min)
- Objetivo: responder "¿esta categoría sirve para este trabajo?" con evidencia citable.
- Alcance entregado: el núcleo de verificación (P0) con Ecogas, de punta a punta y en línea.
- Lo que quedó afuera y por qué: marketplace de profesionales, contratación y reseñas, revalidación automática, otras profesiones. Se recortó para entregar algo estable, como pidió la cátedra.

## 4. Reglas del dominio (≈1,5 min)
- La categoría se cruza con el tipo de trabajo según la NAG-200: 1ª, 2ª y 3ª habilitan cosas distintas.
- Condiciones decisivas: cinco preguntas simples (¿comercio?, ¿única vivienda?, ¿consumo?, ¿artefacto grande?, ¿gas natural?). Con "No sé", el sistema no adivina: explora los escenarios y, si cambian el resultado, dice "no podemos determinarlo" y qué lo resolvería.
- Tres resultados: compatible, incompatible, indeterminado. Más "no se pudo verificar" si la Fuente falla.
- Limitaciones explícitas en cada respuesta: vigencia, número de matrícula, zona.
- Homónimos: búsqueda por nombre y localidad; si hay varios, se muestran todos.

## 5. Arquitectura y decisiones (≈2 min)
- Hexagonal: el dominio no conoce AWS ni Ecogas; cada Fuente es un adaptador. Por eso se prueba sin internet.
- AWS serverless: API Gateway, Lambda (Node 24, TypeScript), DynamoDB para la evidencia, S3 para las lecturas minimizadas (se borran al día siguiente). Todo con Terraform.
- Por qué serverless: uso intermitente y costo cero en el plan gratuito.
- La misma API sirve la página: un único enlace con HTTPS.
- Respeto a la Fuente: User-Agent que se identifica, una lectura cada 15 minutos como máximo, reutilización de la lectura y protección si falla.
- Seguridad: permisos mínimos (la función no puede borrar ni modificar evidencia), sin secretos en el repo, datos personales minimizados.

## 6. Demo (≈3 min) — narrá mientras hacés
1. Abrí https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1/ y mostrá que es HTTPS.
2. Caso con homónimos: un nombre común sin localidad → "encontramos N gasistas, elegí el de su carné". Explicá por qué no elegimos nosotros.
3. Caso compatible: nombre + localidad, vivienda unifamiliar → "Compatible según la regla aplicada". Recorré evidencia, criterio con la norma y limitaciones.
4. Mismo gasista con "No sé" en el consumo → "no podemos determinarlo" y qué lo resolvería.
5. Abrí "Detalle técnico": fecha real de la consulta, huella SHA-256 del recurso, cantidad de registros. Esa es la evidencia citable.

No muestres nombres de gasistas en primer plano más de lo necesario; si podés, usá un caso que ya conozcas.

## 7. Pruebas (≈1 min)
- Mostrá en la terminal `npm run check` del backend y del frontend pasando (cifras del README).
- Qué cubren: reglas de categoría, escenarios de "No sé", homónimos, reutilización de la lectura, Fuente caída, contrato de la API, contratos de los repositorios.
- Validación real: el sistema en línea leyó el padrón completo de Ecogas (4.836 registros) desde AWS.

## 8. Dificultades y cómo se resolvieron (≈1,5 min) — elegí 2 o 3
- Ecogas cambió el formato del padrón: el adaptador reconoce los dos formatos y falla con un mensaje claro si aparece otro.
- Ecogas no publica la matrícula: cambiamos la identificación a nombre y localidad (ADR-0007).
- Desde GitHub (Azure) Ecogas respondía 403; desde AWS responde. Lo probamos antes de desplegar.
- El plan gratuito de AWS solo deja crear en la región del proyecto; y el sitio de S3 no tenía HTTPS → la API sirve la página.

## 9. Resultados, limitaciones y evolución (≈1 min)
- Resultado: una respuesta en segundos que hoy requiere leer la norma y buscar a mano.
- Limitaciones: depende de que Ecogas publique igual; no informa vigencia ni zona; una sola Fuente; sin validación con usuarios.
- Evolución: más distribuidoras (MetroGAS, Naturgy), revalidación periódica, perfil de profesionales, validación con usuarios reales, autorización formal de Ecogas.

## 10. Cierre (≈30 s)
- Tu conclusión propia: qué aprendiste (modelar la incertidumbre en lugar de esconderla, respetar la Fuente, recortar alcance a tiempo).
- Qué harías distinto.

## Preguntas que el video tiene que responder (checklist 5.5)
- ¿Qué problema resolvieron? → §2
- ¿Por qué esas decisiones? → §5
- ¿Cómo sabemos que funciona? → §6 y §7
- ¿Mayor desafío? → §4 (incertidumbre) o §8 (la Fuente)
- ¿Qué harían diferente o continuarían? → §9 y §10

## Plan B si algo falla al grabar
- Si Ecogas no responde: el sistema muestra "no se pudo verificar"; mostralo como caso diseñado y seguí con las capturas de docs/img/.
- Entorno local: `npm run servir` en backend y `npm run dev` en frontend.
- Capturas: docs/img/.

## Al grabar
- Español, mirando a cámara en la presentación y el cierre.
- Subilo a YouTube como "No listado" (o Drive con acceso por enlace) y pasame el enlace.
