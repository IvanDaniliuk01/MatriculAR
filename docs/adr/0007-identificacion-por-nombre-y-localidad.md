---
estado: aceptada
fecha: 2026-11-02
modifica: el recorrido de la Verificación (modelo de dominio, API y tablas con clave por matrícula)
---

# El gasista se identifica por nombre y localidad, porque Ecogas no publica la matrícula

Todo el diseño suponía que el campo `id` del padrón de Ecogas era el número de matrícula. La investigación de septiembre lo afirmó sin verificarlo. Al probar el adaptador el 02/11 encontramos que los 4.836 registros tienen `id` 1, 2, 3… 4836, consecutivos y sin huecos, que ninguna otra clave contiene la matrícula y que el buscador oficial de Ecogas filtra por provincia, localidad, categoría y nombre, pero no por matrícula. Decidimos que el Cliente identifique al gasista por **nombre y apellido, y opcionalmente la localidad**. Toda Credencial de Ecogas lleva la Limitación "Ecogas no publica el número de matrícula: la identificación es por nombre y localidad; confirmala con el carné del gasista". El `id` se conserva tal como vino, pero nunca identifica a nadie.

## Coincidencias

- Una Coincidencia es un registro cuyo nombre contiene todas las palabras buscadas, sin importar el orden, las mayúsculas ni las tildes. Se pide al menos nombre y apellido.
- Si hay varias Coincidencias, cada una tiene su Credencial y su Evaluación, y el Cliente elige con el carné del gasista. MatriculAR nunca elige por él. En la lectura del 02/11 hay 12 nombres repetidos, y 4 que también comparten localidad.
- Si coinciden más de 10, el resultado es `TOO_MANY_MATCHES` y se pide precisar la búsqueda. No es `NOT_FOUND`: la persona puede estar entre ellas.

## Alternativas descartadas

- **Pedir matrícula y nombre, y mostrar la matrícula como "declarada".** Agrega un dato que el sistema no puede verificar ni usar.
- **Usar el `id` como identificador estable.** Es una numeración de la publicación. Si Ecogas agrega o quita a alguien, puede cambiar.

## Consecuencias

- La clave de `Credenciales` y `ResultadosVerificacion` deja de ser `fuente#matricula`. Se rediseña al implementar DynamoDB (9/11).
- La consulta a Ecogas suma una pregunta: si el listado podría publicar el número de matrícula. Si lo hace, la búsqueda por matrícula vuelve como una nueva versión del adaptador.
- El dominio de la Evaluación no cambia: evalúa la categoría de una Credencial, venga de donde venga.
