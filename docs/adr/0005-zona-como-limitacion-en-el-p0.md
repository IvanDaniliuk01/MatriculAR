---
estado: aceptada
fecha: 2026-11-01
modifica: ADR-0003 (deja la zona fuera de los Criterios)
---

# La zona es una Limitación, no un Criterio, mientras Ecogas no responda I4

El diseño de la segunda entrega trataba Centro y Cuyana como una sola Área de concesión, y el escenario S4 concluía `MET` para una matrícula de Ecogas con domicilio en Córdoba y un trabajo en San Luis. El tutor señaló que esa afirmación depende de la incertidumbre I4, todavía sin respuesta. Además, el padrón de Ecogas no informa en qué licenciataria está registrado cada gasista: solo la provincia de domicilio, que nunca se usa para concluir sobre la zona. Por eso ninguna provincia puede afirmarse como `MET` sin inventar una regla. Decidimos sacar la zona de los Criterios en el P0. Toda Evaluación juzga solo la categoría y lleva una Limitación de zona, más fuerte cuando la provincia del trabajo está fuera del Área de concesión de la Fuente.

## Alternativas descartadas

- **`MET` si la provincia del trabajo es de la misma licenciataria que la Provincia informada.** Supone que el gasista está registrado donde vive, y esa regla no tiene respaldo.
- **Zona `INDETERMINATE` siempre.** Es correcto, pero toda Evaluación con Ecogas terminaría `INDETERMINATE`, y la Limitación expresa lo mismo sin borrar lo que sí se sabe de la categoría.

## Consecuencias

- El escenario S4 pasa a ser `COMPATIBLE` por categoría, con la Limitación de zona.
- Si Ecogas confirma que una matrícula de cualquiera de sus licenciatarias habilita en toda su área, la zona vuelve a ser un Criterio, como una nueva versión de la regla.
