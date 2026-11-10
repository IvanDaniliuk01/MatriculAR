# Consulta a Ecogas sobre el listado de gasistas matriculados

> Registro de la consulta sugerida por el tutor en la devolución v2: *"Si pueden consultar directamente a Ecogas sobre el criterio de inclusión y la frecuencia con que actualizan el padrón, sería muy útil."* La devolución v3 pidió enviarla **inmediatamente**, con la pregunta sobre condiciones de uso automatizado. El 02/11 se agregó la pregunta 6, después de comprobar que el listado no publica el número de matrícula. Última revisión: 02/11/2026.

## Estado

| Campo | Valor |
|---|---|
| Estado | **Pendiente de envío** (al 10/11/2026) |
| Fecha de envío | _(completar al enviar)_ |
| Canal | Formulario de **Consultas Administrativas** del área de matriculados de Ecogas ([ecogas.com.ar/matriculados/consultas](https://ecogas.com.ar/matriculados/consultas)). Se envía el mismo texto por **los dos formularios**: [zona Centro](https://ecogas.com.ar/formulario-de-contacto?section=tramites-centro) y [zona Cuyo](https://ecogas.com.ar/formulario-de-contacto?section=tramites-cuyo). No requiere ser cliente. |
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
> 5. ¿Existen condiciones para consultar el listado de forma automatizada con fines académicos? Nuestro sistema lo descargaría como máximo una vez cada 15 minutos, desde servidores en la nube (AWS), identificado con un User-Agent con nuestro contacto.
> 6. El listado no muestra el número de matrícula. ¿Podrían publicarlo, o existe otra forma pública de verificar una matrícula por número?
>
> Muchas gracias. Iván Daniliuk y Nicolás Gabriel Demiryi.

## Qué cambia en el diseño según la respuesta

| Pregunta | Supuesto actual del diseño | Si la respuesta es… | …entonces |
|---|---|---|---|
| 1. Criterio de inclusión | Figurar en el listado **no prueba vigencia** (incertidumbre I1). La Vigencia es una Limitación. | "Solo figuran matrículas renovadas" | La Vigencia puede pasar a ser un Criterio para Ecogas: nueva versión de la regla y un ADR que modifica el [ADR-0003](adr/0003-credencial-separada-de-evaluacion-sin-afirmar-vigencia.md). |
| 2. Frecuencia de actualización | Cada Credencial lleva la fecha de la Consulta, no la del padrón (I2). | Una frecuencia concreta, por ejemplo mensual | Se agrega una Limitación que la explicite: "el padrón se actualiza cada N". |
| 3. Campo "provincia" | Es el domicilio y no se usa para evaluar (I3). | "Es la zona habilitada" | Se revisa la [zona](reglas-de-categoria.md#4-zona-por-qué-es-una-limitación). La regla actual no cambia hasta tener una respuesta formal. |
| 4. Centro y Cuyana | Mientras no haya respuesta, **la zona es una Limitación y no un Criterio** (I4, [ADR-0005](adr/0005-zona-como-limitacion-en-el-p0.md)): ninguna Evaluación afirma que la matrícula habilita a trabajar en una provincia. | "Una matrícula de cualquiera de las dos habilita en toda el área de Ecogas" | La zona vuelve a ser un Criterio: `MET` dentro del Área de concesión. Nueva versión de la regla y un ADR que modifica el ADR-0005. |
| | | "Hace falta registrarse en cada una" | La zona sigue siendo una Limitación: el padrón no informa en qué licenciataria está registrado cada gasista. |
| 5. Condiciones de uso | La fuente resultó técnicamente accesible en las condiciones ensayadas, pero es una fuente web no contractual. El adaptador se identifica con un `User-Agent` propio y lee la Fuente como máximo una vez cada 15 minutos ([P-1](fuentes-y-adaptadores.md#9-puntos-pendientes), [ADR-0006](adr/0006-lectura-minimizada-y-proteccion-de-la-fuente.md)). | Condiciones explícitas | Se ajustan la identificación del adaptador y los valores de la Ventana de reutilización y de la Protección de la Fuente. Si prohibieran el uso automatizado, Ecogas pasa a `NOT_AUTOMATABLE`, igual que MetroGAS. |
| 6. Número de matrícula | El listado **no publica la matrícula**: su campo `id` es un identificador interno (1, 2, 3…). MatriculAR identifica al gasista por nombre y localidad, y lo informa como Limitación ([ADR-0007](adr/0007-identificacion-por-nombre-y-localidad.md)). | "Lo vamos a publicar" o "existe otra consulta pública por número" | La búsqueda por matrícula vuelve como una **nueva versión del adaptador**, y la Limitación de identificación deja de aplicarse a esa Fuente. |
| | | "No se publica" | Se mantiene la identificación por nombre y localidad. |

Cuando llegue la respuesta, se registra en este archivo (texto y fecha) y se actualizan los documentos afectados en un PR.
