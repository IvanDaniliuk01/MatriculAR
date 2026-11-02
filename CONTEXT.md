# MatriculAR

Plataforma que responde, con evidencia fechada y citable, si la matrícula de un gasista es compatible con un trabajo concreto: qué sabemos, de qué fuente, cuándo lo consultamos y qué no podemos afirmar.

## Fuentes y consultas

**Distribuidora**:
Empresa licenciataria de gas que otorga y registra matrículas de gasistas en su zona (Ecogas, MetroGAS, Naturgy BAN, Camuzzi, Litoral Gas). ENARGAS regula; las distribuidoras matriculan y publican.
_Avoid_: Organismo, ente

**Área de concesión**:
Conjunto de provincias donde opera una Distribuidora (Ecogas: Córdoba, Catamarca, La Rioja, Mendoza, San Juan, San Luis). Si la Distribuidora opera solo en parte de una provincia, esa provincia es de concesión parcial.
_Avoid_: Jurisdicción

**Fuente**:
Padrón público de matriculados de una Distribuidora, tal como la Distribuidora lo expone. Una Fuente puede ser consultable automáticamente (Ecogas) o no (MetroGAS, protegida por captcha).
_Avoid_: Organismo, API, padrón (como sinónimo suelto)

**Consulta**:
Lectura de una Fuente en un momento dado. Termina `SUCCEEDED`, `FAILED` (motivo `SOURCE_UNAVAILABLE`, `EXTRACTION_FAILED` o `INTERRUPTED`) o `NOT_ATTEMPTED` (motivo `SOURCE_NOT_AUTOMATABLE` o `SOURCE_RATE_LIMITED`). `INTERRUPTED` es una falla del propio MatriculAR, no de la Fuente.
_Avoid_: Scraping, sincronización

**Lectura minimizada**:
Lo que se conserva de una Consulta exitosa para responder otras Verificaciones durante la Ventana de reutilización: por cada registro, los campos que forman una Credencial, sin datos de contacto. Se descarta al día siguiente.
_Avoid_: Caché del padrón, copia del padrón

**Ventana de reutilización**:
Lapso durante el cual una Consulta exitosa responde nuevas Verificaciones sin volver a leer la Fuente. Toda respuesta informa la fecha real de esa Consulta, no la del pedido.

**Protección de la Fuente**:
Límite que MatriculAR se impone para no amplificar pedidos contra una Fuente: una lectura exitosa por Ventana de reutilización y una espera mínima después de una falla. Mientras rige, la Consulta queda `NOT_ATTEMPTED` con motivo `SOURCE_RATE_LIMITED`.
_Avoid_: Throttling (es el límite de la API propia, otra cosa)

**Intento**:
Cada ejecución completa de la lectura de una Fuente dentro de una Consulta, con su hora, las respuestas obtenidas y el error. Solo las fallas transitorias (red, tiempo agotado, error 5xx o 429) generan un nuevo Intento; una `EXTRACTION_FAILED` no se reintenta.
_Avoid_: Retry, request

**Huella del recurso**:
Identificador (SHA-256) del contenido exacto que leyó una Consulta exitosa. Permite reconocer si dos Consultas leyeron lo mismo o si el recurso cambió; no permite reconstruir el recurso.
_Avoid_: Hash, checksum

**Gasista buscado**:
Cómo identifica el Cliente al gasista en una Verificación: nombre y apellido, y opcionalmente la localidad. Una Coincidencia es un registro de la Fuente cuyo nombre contiene todas las palabras buscadas, sin importar el orden, las mayúsculas ni las tildes.
_Avoid_: Matrícula buscada

**Resultado de verificación**:
Lo que una Consulta permite afirmar sobre el Gasista buscado en una Fuente: `FOUND` (una o más Coincidencias, cada una con su Credencial), `NOT_FOUND` (la Consulta fue exitosa y nadie coincide), `TOO_MANY_MATCHES` (coinciden demasiados para mostrarlos; hay que precisar la búsqueda) o `UNVERIFIABLE` (la Consulta falló o no se realizó).
_Avoid_: "no aparece en ningún padrón", válida/inválida

**Identificador interno de la Fuente**:
Número con el que la Fuente ordena sus registros (en Ecogas, el campo `id`: 1, 2, 3…). Se guarda tal como vino, pero nunca identifica a un gasista: puede cambiar entre una publicación y otra.
_Avoid_: Matrícula, número de matrícula

## Evidencia

**Matrícula**:
Número que una Distribuidora asigna a un instalador de gas al inscribirlo en su registro. La Fuente de Ecogas no lo publica, así que MatriculAR no puede verificarlo: identifica al gasista por nombre y localidad.

**Categoría**:
Alcance técnico de una Matrícula según la NAG-200 (1ª, 2ª o 3ª). Es un alcance, no un nivel: la 1ª es la más amplia, y no se comparan numéricamente.
_Avoid_: Nivel, rango

**Credencial**:
Evidencia de que un gasista figura en una Fuente, con el nombre, la Categoría, la provincia y la localidad que la Fuente informa, según una Consulta de fecha determinada. Conserva los valores tal como la Fuente los publicó, además de su versión normalizada. No tiene estado de aptitud.
_Avoid_: Matrícula verificada, habilitación

**Provincia informada**:
Provincia que la Fuente publica junto al gasista; corresponde al domicilio del matriculado, no a dónde puede trabajar.
_Avoid_: Jurisdicción, provincia habilitada

**Vigencia**:
Condición de una Matrícula renovada para el período en curso (renovación anual, vence el 31/03). Ninguna Fuente conocida la informa, así que MatriculAR nunca la afirma.
_Avoid_: Vigente, vencida, verificado (como estados del sistema)

## Evaluación

**Verificación**:
Pedido de saber si un Gasista buscado en una Fuente es compatible con un trabajo en una provincia. El Cliente describe el trabajo respondiendo Condiciones decisivas, nunca eligiendo un Tipo de trabajo. Agrupa la Consulta, su Resultado de verificación y, solo si hubo Credencial, la Evaluación.
_Avoid_: Chequeo, validación

**Tipo de trabajo**:
Trabajo concreto y documentado que un cliente necesita, con las condiciones que determinan qué Categorías pueden realizarlo (por ejemplo, "conexión de artefacto en vivienda unifamiliar").
_Avoid_: Trabajo requerido, categoría requerida

**Condición decisiva**:
Pregunta sobre el trabajo, respondida Sí, No o No sé, que distingue un Tipo de trabajo de otro (por ejemplo, "¿el terreno tiene una única vivienda?"). Un No sé nunca se toma como Sí.
_Avoid_: Requisito, supuesto

**Categorías admitidas**:
Lista explícita de Categorías que pueden realizar un Tipo de trabajo, respaldada por una cita normativa.
_Avoid_: Categoría mínima

**Evaluación**:
Resultado de aplicar las reglas de un Tipo de trabajo a una Credencial: `COMPATIBLE`, `INCOMPATIBLE` o `INDETERMINATE`, siempre con el resultado de cada Criterio y su fundamento. Solo existe si hay Credencial. Una misma Credencial puede ser compatible con un Tipo de trabajo y no con otro.
_Avoid_: Apta, habilitado, verificado

**Criterio**:
Cada aspecto que una Evaluación juzga por separado. Hoy hay uno solo: la categoría (cumple, no cumple o indeterminado). Ni la Vigencia ni la zona son Criterios: se informan como Limitaciones y no participan del resultado.

**Limitación**:
Declaración explícita, incluida en cada Evaluación, de lo que la evidencia no permite afirmar (por ejemplo, que la Fuente no informa Vigencia, que no permite saber si la Matrícula habilita a trabajar en la provincia del trabajo, o que no publica el número de matrícula).

**Compatible**:
Lo único que afirma una Evaluación `COMPATIBLE`: la Categoría informada es compatible con el Tipo de trabajo según la regla aplicada. No afirma que el gasista esté habilitado hoy.
_Avoid_: Puede realizar este trabajo, habilitado

## Profesionales y contratación

**Profesional**:
Gasista con cuenta en MatriculAR que declara una o más Matrículas para ofrecer sus servicios.
_Avoid_: Matriculado (como sinónimo de usuario), prestador

**Vínculo**:
Relación entre un Profesional y un registro de una Fuente. Es `VERIFIED` cuando el Profesional confirmó un código enviado al email que la propia Fuente publica en ese registro: prueba control de ese email, no la identidad legal del titular. Si no, es `UNVERIFIED` y se muestra así.
_Avoid_: Matrícula del profesional, reclamo, titularidad verificada

**Cliente**:
Persona que busca un Profesional y solicita una Contratación.
_Avoid_: Usuario (como sinónimo), hogar

**Contratación**:
Solicitud de un Cliente a un Profesional para un Tipo de trabajo. Recorre solicitada → aceptada → realizada → calificada, o cancelada desde solicitada o aceptada. Se asocia a la Verificación hecha al crearla.
_Avoid_: Pedido, orden, trabajo

**Reseña**:
Puntaje y comentario que un Cliente deja sobre una Contratación realizada.
_Avoid_: Calificación (como entidad), review

## Relaciones

- Una **Verificación** se apoya en una **Consulta**: propia en una consulta directa, compartida con las demás Verificaciones de la misma Fuente en una búsqueda. Una revalidación hace Consultas sin Verificaciones.
- Una **Consulta** lee una **Fuente**; cada **Verificación** que se apoya en ella produce un **Resultado de verificación** para su **Gasista buscado**.
- Un Resultado `FOUND` produce una **Credencial** y una **Evaluación** por cada Coincidencia. Si hay más de una, el Cliente ve todas y elige con el carné del gasista: MatriculAR nunca elige por él. `NOT_FOUND`, `TOO_MANY_MATCHES` y `UNVERIFIABLE` son respuestas distintas y ninguna produce Evaluación.
- Una **Evaluación** aplica un **Tipo de trabajo** a una **Credencial**; nunca modifica la Credencial.
- Una **Contratación** con Evaluación `INCOMPATIBLE` no puede crearse; cualquier otro resultado sin `COMPATIBLE` se muestra como advertencia al Cliente.
- La zona no se evalúa: la Fuente de Ecogas no distingue en qué licenciataria está registrado cada gasista. Toda Evaluación lleva una **Limitación** de zona, más fuerte si la provincia del trabajo está fuera del **Área de concesión**. Nunca se usa la **Provincia informada** para concluir sobre la zona.
- Si las respuestas a las **Condiciones decisivas** no dejan ningún **Tipo de trabajo** posible, el trabajo no está cubierto y la Verificación se rechaza antes de consultar la Fuente: no hay regla, así que no hay nada que evaluar.
- Si alguna **Condición decisiva** quedó en No sé, la Evaluación considera todos los **Tipos de trabajo** que siguen siendo posibles: `COMPATIBLE` si todos admiten la Categoría, `INCOMPATIBLE` si ninguno, `INDETERMINATE` si algunos sí y otros no.
- Una **Consulta** tiene uno o más **Intentos**.
- La ausencia de evidencia nunca se convierte en certeza: si una Fuente no pudo consultarse, el resultado es `UNVERIFIABLE` y no hay Evaluación, aunque exista una Credencial anterior; esa Credencial se muestra con su fecha, pero no se usa para concluir.
- Una **Evaluación** conserva la versión de las **Categorías admitidas** que aplicó; nunca se recalcula con reglas posteriores.

## Códigos de estado

Los términos del dominio se escriben en español; los **códigos de estado**, en inglés.

| Concepto | Código | Significado |
|---|---|---|
| Consulta | `IN_PROGRESS` · `SUCCEEDED` · `FAILED` · `NOT_ATTEMPTED` | En curso · exitosa · fallida · no realizada |
| Motivo de falla | `SOURCE_UNAVAILABLE` · `EXTRACTION_FAILED` · `INTERRUPTED` · `SOURCE_NOT_AUTOMATABLE` · `SOURCE_RATE_LIMITED` | Fuente no disponible · extracción fallida · interrumpida (falla propia) · Fuente no automatizable · Fuente protegida por MatriculAR |
| Resultado de verificación | `FOUND` · `NOT_FOUND` · `TOO_MANY_MATCHES` · `UNVERIFIABLE` | Encontrado · no encontrado · demasiadas coincidencias · no verificable |
| Evaluación | `COMPATIBLE` · `INCOMPATIBLE` · `INDETERMINATE` | Compatible · no compatible · indeterminada |
| Criterio | `MET` · `NOT_MET` · `INDETERMINATE` | Cumple · no cumple · indeterminado |
| Modo de acceso de la Fuente | `AUTOMATED` · `NOT_AUTOMATABLE` | Consultable automáticamente · no automatizable |
| Vínculo | `UNVERIFIED` · `VERIFIED` | No verificado · verificado |
| Contratación | `REQUESTED` · `ACCEPTED` · `COMPLETED` · `RATED` · `CANCELLED` | Solicitada · aceptada · realizada · calificada · cancelada |

## Ejemplo de diálogo

> **Dev:** "La consulta a Ecogas falló por extracción, ¿marcamos la credencial como NOT_FOUND?"
> **Experto de dominio:** "No: la Consulta fue FAILED, así que el resultado es UNVERIFIABLE y la Verificación no tiene Evaluación. La Credencial anterior sigue intacta con su fecha; lo que no podemos es afirmar nada nuevo hoy."
> **Dev:** "¿Y si la Consulta fue exitosa y nadie con ese nombre está?"
> **Experto de dominio:** "Eso es NOT_FOUND: un resultado negativo sobre Ecogas en esa fecha. Tampoco hay Evaluación, pero la respuesta al Cliente es distinta."

## Ambigüedades resueltas

- "Jurisdicción" se usaba para tres cosas distintas: la Provincia informada, el Área de concesión y el lugar del trabajo. Se reemplaza por esos tres términos.
- "Verificado" mezclaba Resultado de verificación, Evaluación y Vigencia. Se eliminó como estado.
- El campo `id` del padrón de Ecogas se tomó como número de matrícula sin verificarlo. Es un Identificador interno de la Fuente (1, 2, 3…), y la Fuente no publica la Matrícula: el gasista se identifica por nombre y localidad (ADR-0007).
- "Categoría insuficiente" era un estado de la Credencial; ahora es un Criterio de una Evaluación, porque depende del Tipo de trabajo.
