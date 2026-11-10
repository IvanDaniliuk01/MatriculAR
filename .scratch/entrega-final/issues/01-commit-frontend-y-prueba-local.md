# Subir el frontend y probar el recorrido completo en local

Type: task
Status: resolved

## Question

(AFK) ¿Funciona el recorrido completo en local, con la página (vite preview) y la API (npm run servir) contra la Ecogas real? Hay que enviar una verificación desde el navegador, guardar una captura del resultado para el informe y subir el frontend junto con docs/api.md, con el CI de Backend y Frontend en verde.

## Answer

Hecho el 10/11 (commit 6235117). Recorrido completo en local con `vite preview` + `npm run servir` contra la Ecogas real: lectura nueva, una Coincidencia, resultado "no podemos determinarlo" con criterio, condición que lo resolvería y las cinco limitaciones. Frontend: 8 pruebas, build de 231 KB. La captura para el informe se toma del sitio desplegado (el navegador no respondió al capturar).
