# Desplegar en AWS y probar Ecogas desde AWS

Type: task
Status: resolved
Blocked by: 01, 02

## Question

(AFK, Iván confirma el apply) Correr scripts/desplegar-aws.sh, probar en línea los catálogos y POST /verificaciones, correr npm run test:aws contra las tablas reales y registrar qué responde Ecogas a la Lambda. Respuesta esperada: URL de la página, URL de la API, resultado de la prueba de Ecogas y de las pruebas de AWS.

## Answer

Desplegado el 10/11 en la cuenta del proyecto "Stack of Dreams", región **us-east-2** (commits 49fa514 y 19fafc0).

- **Sistema en línea (un único enlace, HTTPS):** https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1/ — la misma API sirve la página; `/v1` redirige a `/v1/`.
- **API:** https://b2u5pup2gd.execute-api.us-east-2.amazonaws.com/v1
- **Ecogas responde desde AWS:** lectura completa (4.836 registros, formato v2) en ~1,5 s desde la Lambda. El 403 anterior era solo desde Azure (GitHub Actions).
- Probado en el navegador: verificación real con resultado "Compatible según la regla aplicada", evidencia, criterio y limitaciones; catálogos, `config.json`, CORS y `GET /fuentes/ecogas/consultas` responden.
- Hallazgos: (1) el plan gratuito con Projects solo permite crear recursos en la región del proyecto (us-east-2); en us-east-1 la SCP de la organización deniega DynamoDB, S3, API Gateway y alarmas. (2) El sitio web de S3 solo sirve HTTP y Chrome lo bloquea: se reemplazó por la API sirviendo el frontend. (3) `terraform apply` lo ejecuta Iván (el modo automático del agente no aplica infraestructura).
- `npm run test:aws` **no** se corrió contra las tablas reales: dejaría registros de prueba en producción. La persistencia en DynamoDB y S3 queda probada por el recorrido real (Consulta, Credenciales y Verificación guardadas y recuperadas por la API).
