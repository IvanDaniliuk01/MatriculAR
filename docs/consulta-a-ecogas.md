# Consulta a Ecogas sobre el listado de gasistas matriculados

> Registro de la consulta sugerida por el tutor en la devolución v2: *"Si pueden consultar directamente a Ecogas sobre el criterio de inclusión y la frecuencia con que actualizan el padrón, sería muy útil."*

## Estado

| Campo | Valor |
|---|---|
| Estado | **Pendiente de envío** |
| Fecha de envío | _(completar al enviar)_ |
| Canal previsto | Formulario de **Consultas Administrativas** del área de matriculados de Ecogas ([ecogas.com.ar/matriculados/consultas](https://ecogas.com.ar/matriculados/consultas)): [zona Centro](https://ecogas.com.ar/formulario-de-contacto?section=tramites-centro) y [zona Cuyo](https://ecogas.com.ar/formulario-de-contacto?section=tramites-cuyo). No requiere ser cliente. |
| Enviada por | _(completar)_ |
| Respuesta | Pendiente |

## Texto enviado

> **Asunto:** Consulta académica sobre el listado público de gasistas matriculados
>
> Hola, somos estudiantes de la Tecnicatura Universitaria en Programación (UTN) y estamos desarrollando un proyecto final sobre verificación de matrículas de gasistas. Consultamos el listado público de gasistas matriculados publicado en ecogas.com.ar y quisiéramos interpretarlo correctamente:
>
> 1. ¿Qué criterio usan para incluir a un matriculado en el listado? ¿Figuran solo quienes renovaron la matrícula del período en curso?
> 2. ¿Cada cuánto se actualiza el listado?
> 3. El campo "provincia", ¿es el domicilio del matriculado o la zona donde está habilitado?
> 4. ¿Un matriculado de Ecogas Centro puede trabajar en la zona de Ecogas Cuyana sin registrarse aparte?
> 5. ¿Existen condiciones de uso para consultar el listado de forma automatizada con fines académicos?
>
> Muchas gracias. Iván Daniliuk y Nicolás Gabriel Demiryi.

## Qué cambia en el diseño según la respuesta

| Pregunta | Supuesto actual del diseño | Si la respuesta es… | …entonces |
|---|---|---|---|
| 1. Criterio de inclusión | Figurar en el listado **no prueba vigencia** (incertidumbre I1). La Vigencia es una Limitación. | "Solo figuran matrículas renovadas" | La Vigencia puede pasar a ser un Criterio para Ecogas: nueva versión de la regla y un ADR que modifica el [ADR-0003](adr/0003-credencial-separada-de-evaluacion-sin-afirmar-vigencia.md). |
| 2. Frecuencia de actualización | Cada Credencial lleva la fecha de la Consulta, no la del padrón (I2). | Una frecuencia concreta, por ejemplo mensual | Se agrega una Limitación que la explicite: "el padrón se actualiza cada N". |
| 3. Campo "provincia" | Es el domicilio y no se usa para evaluar (I3). | "Es la zona habilitada" | Se revisa el [Criterio de zona](reglas-de-categoria.md#4-criterio-de-zona). La regla actual no cambia hasta tener una respuesta formal. |
| 4. Centro y Cuyana | El Área de concesión de Ecogas se trata como una sola (I4). | "Hace falta registrarse en cada una" | El Área se divide en dos y el Criterio de zona pasa a `INDETERMINATE` entre licenciatarias. |
| 5. Condiciones de uso | La fuente resultó técnicamente accesible en las condiciones ensayadas, pero es una fuente web no contractual. La identificación del adaptador está pendiente ([P-1](fuentes-y-adaptadores.md#9-puntos-pendientes)). | Condiciones explícitas | Se ajustan el adaptador (identificación, frecuencia) y el límite de uso. Si prohibieran el uso automatizado, Ecogas pasa a `NOT_AUTOMATABLE`, igual que MetroGAS. |

Cuando llegue la respuesta, se registra en este archivo (texto y fecha) y se actualizan los documentos afectados en un PR.
