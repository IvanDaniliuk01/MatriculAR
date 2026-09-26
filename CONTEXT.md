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
Lectura de una Fuente en un momento dado, para una o más Matrículas. Termina `EXITOSA`, `FALLIDA` (motivo `FUENTE_NO_DISPONIBLE`, `EXTRACCION_FALLIDA` o `INTERRUMPIDA`) o `NO_REALIZADA` (motivo `FUENTE_NO_AUTOMATIZABLE`). `INTERRUMPIDA` es una falla del propio MatriculAR, no de la Fuente.
_Avoid_: Scraping, sincronización

**Intento**:
Cada ejecución completa de la lectura de una Fuente dentro de una Consulta, con su hora, las respuestas obtenidas y el error. Solo las fallas transitorias (red, tiempo agotado, error 5xx o 429) generan un nuevo Intento; una `EXTRACCION_FALLIDA` no se reintenta.
_Avoid_: Retry, request

**Huella del recurso**:
Identificador (SHA-256) del contenido exacto que leyó una Consulta exitosa. Permite saber qué versión del padrón se leyó sin guardar el padrón.
_Avoid_: Hash, checksum

**Resultado de verificación**:
Lo que una Consulta permite afirmar sobre cada matrícula buscada en una Fuente: `ENCONTRADA`, `NO_ENCONTRADA` (la Consulta fue exitosa y la matrícula no figura) o `NO_VERIFICABLE` (la Consulta falló o no se realizó).
_Avoid_: "no aparece en ningún padrón", válida/inválida

## Evidencia

**Matrícula**:
Número que una Distribuidora asigna a un instalador de gas al inscribirlo en su registro.

**Categoría**:
Alcance técnico de una Matrícula según la NAG-200 (1ª, 2ª o 3ª). Es un alcance, no un nivel: la 1ª es la más amplia, y no se comparan numéricamente.
_Avoid_: Nivel, rango

**Credencial**:
Evidencia de que una Matrícula figura en una Fuente, con la Categoría y la provincia que la Fuente informa, según una Consulta de fecha determinada. No tiene estado de aptitud.
_Avoid_: Matrícula verificada, habilitación

**Provincia informada**:
Provincia que la Fuente publica junto a la Matrícula; corresponde al domicilio del matriculado, no a dónde puede trabajar.
_Avoid_: Jurisdicción, provincia habilitada

**Vigencia**:
Condición de una Matrícula renovada para el período en curso (renovación anual, vence el 31/03). Ninguna Fuente conocida la informa, así que MatriculAR nunca la afirma.
_Avoid_: Vigente, vencida, verificado (como estados del sistema)

## Evaluación

**Verificación**:
Pedido de saber si una Matrícula de una Fuente es compatible con un Tipo de trabajo en una provincia. Agrupa la Consulta, su Resultado de verificación y, solo si hubo Credencial, la Evaluación.
_Avoid_: Chequeo, validación

**Tipo de trabajo**:
Trabajo concreto y documentado que un cliente necesita, con las condiciones que determinan qué Categorías pueden realizarlo (por ejemplo, "conexión de artefacto en vivienda unifamiliar").
_Avoid_: Trabajo requerido, categoría requerida

**Categorías admitidas**:
Lista explícita de Categorías que pueden realizar un Tipo de trabajo, respaldada por una cita normativa.
_Avoid_: Categoría mínima

**Evaluación**:
Resultado de aplicar las reglas de un Tipo de trabajo a una Credencial: `COMPATIBLE`, `NO_COMPATIBLE` o `INDETERMINADA`, siempre con el resultado de cada Criterio y su fundamento. Solo existe si hay Credencial. Una misma Credencial puede ser compatible con un Tipo de trabajo y no con otro.
_Avoid_: Apta, habilitado, verificado

**Criterio**:
Cada aspecto que una Evaluación juzga por separado: categoría (cumple, no cumple o indeterminado) y zona (cumple o indeterminado). La Vigencia no es un Criterio: se informa siempre como Limitación y no participa del resultado.

**Limitación**:
Declaración explícita, incluida en cada Evaluación, de lo que la evidencia no permite afirmar (por ejemplo, que la Fuente no informa Vigencia).

## Profesionales y contratación

**Profesional**:
Gasista con cuenta en MatriculAR que declara una o más Matrículas para ofrecer sus servicios.
_Avoid_: Matriculado (como sinónimo de usuario), prestador

**Vínculo**:
Relación entre un Profesional y una Matrícula de una Fuente. Es `VERIFICADO` cuando el Profesional confirmó un código enviado al email que la propia Fuente publica para esa Matrícula; si no, es `NO_VERIFICADO` y se muestra así.
_Avoid_: Matrícula del profesional, reclamo

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
- Una **Consulta** lee una **Fuente** y produce un **Resultado de verificación** por cada Matrícula buscada.
- Un Resultado `ENCONTRADA` produce una **Credencial**, y solo entonces se hace una **Evaluación**. `NO_ENCONTRADA` y `NO_VERIFICABLE` son respuestas distintas y ninguna produce Evaluación.
- Una **Evaluación** aplica un **Tipo de trabajo** a una **Credencial**; nunca modifica la Credencial.
- Una **Contratación** con Evaluación `NO_COMPATIBLE` no puede crearse; cualquier otro resultado sin `COMPATIBLE` se muestra como advertencia al Cliente.
- La zona se evalúa contra el **Área de concesión** de la Distribuidora de la Fuente, nunca contra la **Provincia informada**. Fuera del Área de concesión, el Criterio de zona es indeterminado, no incumplido.
- Una **Consulta** tiene uno o más **Intentos**.
- La ausencia de evidencia nunca se convierte en certeza: si una Fuente no pudo consultarse, el resultado es `NO_VERIFICABLE` y no hay Evaluación, aunque exista una Credencial anterior; esa Credencial se muestra con su fecha, pero no se usa para concluir.
- Una **Evaluación** conserva la versión de las **Categorías admitidas** que aplicó; nunca se recalcula con reglas posteriores.

## Ejemplo de diálogo

> **Dev:** "La consulta a Ecogas falló por extracción, ¿marcamos la credencial como NO_ENCONTRADA?"
> **Experto de dominio:** "No: la Consulta fue FALLIDA, así que el resultado es NO_VERIFICABLE y la Verificación no tiene Evaluación. La Credencial anterior sigue intacta con su fecha; lo que no podemos es afirmar nada nuevo hoy."
> **Dev:** "¿Y si la Consulta fue exitosa y la matrícula no está?"
> **Experto de dominio:** "Eso es NO_ENCONTRADA: un resultado negativo sobre Ecogas en esa fecha. Tampoco hay Evaluación, pero la respuesta al Cliente es distinta."

## Ambigüedades resueltas

- "Jurisdicción" se usaba para tres cosas distintas: la Provincia informada, el Área de concesión y el lugar del trabajo. Se reemplaza por esos tres términos.
- "Verificado" mezclaba Resultado de verificación, Evaluación y Vigencia. Se eliminó como estado.
- "Categoría insuficiente" era un estado de la Credencial; ahora es un Criterio de una Evaluación, porque depende del Tipo de trabajo.
