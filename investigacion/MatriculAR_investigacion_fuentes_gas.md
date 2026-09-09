# MatriculAR — Investigación de fuentes reales (gasistas)
### Entregable 1 y 3 según devolución de Oscar: matriz de fuente real + prueba técnica mínima

**Fecha:** septiembre 2026
**Equipo:** Iván Daniliuk + Nicolás Gabriel Demiryi
**Alcance de esta investigación:** oficio *gasista*, dos organismos/distribuidoras distintas, para poder comparar.

---

## 1. Resumen ejecutivo

Investigamos dos distribuidoras de gas que publican listados de gasistas matriculados: **MetroGAS** (CABA) y **Ecogas** (Córdoba, Catamarca, La Rioja, Mendoza, San Juan, San Luis). Ambas exponen datos reales de matrícula, categoría y contacto — pero **ninguna de las dos informa vigencia de la matrícula**, y tienen niveles de protección técnica completamente distintos entre sí.

Esto confirma con evidencia concreta la premisa central del manifiesto de MatriculAR: la habilitación legal está fragmentada (por organismo y por nivel de exposición técnica) y ninguna fuente resuelve hoy, de forma simple, la pregunta de si una matrícula sigue vigente.

---

## 2. Metodología

Para cada distribuidora, se repitió el mismo procedimiento:

1. Se ubicó el buscador público de gasistas matriculados en el sitio web.
2. Se inspeccionaron las peticiones de red del navegador (Chrome DevTools → pestaña Network) mientras se realizaba una búsqueda real.
3. Se identificó si existe una API/endpoint de datos, qué protecciones tiene (autenticación, captcha, límites), y qué campos devuelve.
4. Se intentó reproducir la consulta por fuera del navegador (prueba técnica mínima), con Python.

---

## 3. Hallazgo 1 — MetroGAS (CABA)

**URL del buscador:** `https://www.metrogas.com.ar/colaboradores/listado-de-gasistas-con-matricula/`
(el buscador en sí es una aplicación embebida de un proveedor externo, SAP HANA Cloud)

| Campo | Detalle |
|---|---|
| Endpoint real | `POST https://avmbuscador-lc8a95d0a8.dispatcher.br1.hana.ondemand.com/OvServiceHub/api/avm/v1/rankingnoauth/all` |
| Autenticación | Ninguna (el propio path dice `rankingnoauth`) |
| Protección anti-bot | **reCAPTCHA** — el payload de cada petición incluye un token de captcha; sin token válido, la petición no se puede reproducir de forma legítima |
| Formato de respuesta | JSON: `{"LISTADO": [ {...}, ... ]}` |
| Volumen | Al menos ~900 registros (padrón completo de CABA) |
| Filtrado | Ocurre 100% del lado del cliente: el servidor siempre devuelve el padrón completo; buscar por apellido o matrícula no cambia la petición al servidor |

**Campos que devuelve cada registro:**

| Clave | Significado |
|---|---|
| `M` | Matrícula |
| `N` / `A` | Nombre / Apellido |
| `T` / `P` | Teléfono / Teléfono 2 |
| `C` | Código postal |
| `D` / `U` | Dirección / Número |
| `L` | Localidad (texto completo) |
| `G` | Código de categoría (ej. `"05"` ↔ "Categoría 2" en pantalla — mapeo exacto sin confirmar) |
| `E` | Email |
| `R` | Rating / puntaje (ej. `4.963`) — sugiere que MetroGAS ya tiene un sistema de calificación de sus gasistas |
| `Z` | Sin identificar |

**Campos que NO devuelve:** vigencia/estado de la matrícula, fecha de alta o vencimiento, jurisdicción regulatoria explícita (solo localidad/CP, que no es lo mismo).

**Conclusión sobre MetroGAS:** existe una fuente real con datos reales, pero **no es legítimamente automatizable**: la única protección es un reCAPTCHA cuyo propósito explícito es impedir consultas automáticas a escala. Sortearlo implicaría violar los Términos de Servicio del proveedor.

**Evidencia independiente:** el sitio de terceros `servidos.ar/verificador-matricula-gasista` (un "verificador de matrícula de gasista" que agrega varias distribuidoras) confirma el mismo hallazgo: declara explícitamente que no puede consultar MetroGAS de forma automática por el captcha, y redirige al usuario al buscador oficial en esos casos. Esto es relevante también para el manifiesto: ese sitio ya hace, en producción, una versión simplificada de lo que MatriculAR plantea (verificación puntual multi-distribuidora), lo cual matiza la afirmación de que "ninguna plataforma resuelve esto" — el diferencial de MatriculAR no está en la verificación puntual, sino en la revalidación continua + el ciclo de contratación completo.

---

## 4. Hallazgo 2 — Ecogas (Córdoba, Catamarca, La Rioja, Mendoza, San Juan, San Luis)

**URL del buscador:** `https://www.ecogas.com.ar/hogares-comercios/tramites-y-servicios/listado-de-gasistas-matriculados`

| Campo | Detalle |
|---|---|
| Mecanismo de datos | El padrón completo está **embebido directamente en un archivo JavaScript estático** que genera Next.js al compilar el sitio (no hay llamada a una API JSON separada) |
| URL del archivo (en el deploy investigado) | `https://www.ecogas.com.ar/_next/static/chunks/3182-ad3160686a0b7005.js` |
| Autenticación | Ninguna |
| Protección anti-bot | No se detectó captcha. Sí se detectó una capa de **bot-detection a nivel de servidor/CDN** (posiblemente Cloudflare o similar): una petición automática sin headers de navegador (`User-Agent`, etc.) es bloqueada; con headers que simulan un navegador real, la petición pasa sin problema |
| Formato de datos | Texto plano dentro del `.js`, con pares `"clave":"valor"` (matrícula, nombre y apellido, categoría, provincia, localidad, correo electrónico, teléfono) |
| Estabilidad de la fuente | **Baja**: el nombre del archivo (`3182-ad3160686a0b7005.js`) incluye un hash que cambia en cada deploy del sitio. La URL exacta no es estable en el tiempo — habría que volver a ubicar el archivo correcto en cada actualización de Ecogas |

**Campos que devuelve** (confirmados mediante la prueba técnica de la Sección 5): `id` (matrícula), `nombre_apellido` (nombre completo, sin separar en nombre/apellido), `categoria`, `provincia`, `localidad`, `correo_electronico`, `telefono`, `barrio`.

**Campos que NO devuelve:** vigencia/estado de la matrícula, fecha de última actualización del padrón.

**Conclusión sobre Ecogas:** es, de las dos fuentes investigadas, la más simple de automatizar — no requiere sortear ninguna medida de seguridad explícita como un captcha, alcanza con un `GET` con headers de navegador razonables. Sin embargo, tiene una limitación distinta y más sutil: **la URL del recurso no es estable**, porque depende de un hash de build que cambia con cada actualización del sitio. Cualquier integración real necesitaría un mecanismo para descubrir la URL vigente en cada ejecución (por ejemplo, primero pedir la página HTML principal, extraer de ahí el nombre del chunk JS correspondiente, y recién después descargarlo), no se puede cachear la URL de forma permanente.

---

## 5. Prueba técnica mínima

Se armó y **ejecutó con éxito** un script en Python (`prueba_ecogas.py`, adjunto en el proyecto) que:

1. Descarga el archivo `.js` de Ecogas con headers de navegador (evita el bloqueo por bot-detection).
2. Extrae los objetos JSON completos embebidos en el archivo (usando `json.loads` sobre cada coincidencia, no reconstrucción manual campo por campo).
3. Guarda una muestra acotada (10 registros) en un JSON local — **no** el padrón completo, por consideraciones éticas.

**Estructura real confirmada** (mediante inspección directa del archivo descargado):

```json
{"id":"11143","nombre_apellido":"CARLOS PEDRO LOVAGNINI","categoria":"1",
 "provincia":"SAN LUIS","localidad":"CAPITAL SAN LUIS",
 "correo_electronico":"carloslovagnini@gmail.com",
 "telefono":"02664426978","barrio":"BAJO GRANDE"}
```

**Resultado de la ejecución real** (04/09/2026, tamaño del archivo descargado: 1048.2 KB):

```
Registros detectados: 4512

{'id': '91', 'nombre_apellido': 'RICARDO LUIS CIACIA', 'categoria': '2', 'provincia': 'CORDOBA', 'localidad': 'VILLA MARIA', 'correo_electronico': 'ricardociacia@hotmail.com', 'telefono': '0353154116736', 'barrio': 'COUNTRY LA NEGRITA'}
{'id': '118', 'nombre_apellido': 'ALBERTO JOSE MARIA ELSTEIN', 'categoria': '1', 'provincia': 'CORDOBA', 'localidad': 'RIO CUARTO', 'correo_electronico': 'elsteinalberto@hotmail.com', 'telefono': '3584621741', 'barrio': 'SANTA TEODORA'}
{'id': '328', 'nombre_apellido': 'ANIBAL JORGE PINO', 'categoria': '1', 'provincia': 'CORDOBA', 'localidad': 'CORDOBA', 'correo_electronico': 'ing_pino@yahoo.com.ar', 'telefono': '3516825105', 'barrio': 'PALMAR AMPLIACION'}
```

Se confirma así que el padrón completo de Ecogas tiene **4.512 registros**, obtenidos con un simple `GET` sin captcha ni autenticación.

**Paso de evaluación** (no solo obtención — según lo pedido explícitamente por Oscar, "obtener y evaluar realmente la situación de una credencial"): se tomó el primer registro real obtenido y se lo evaluó contra un caso de uso ficticio (un cliente que necesita un gasista categoría 2 en San Luis):

```
Credencial obtenida (dato real): {'id': '91', 'nombre_apellido': 'RICARDO LUIS CIACIA',
'categoria': '2', 'provincia': 'CORDOBA', ...}
Trabajo solicitado (caso ficticio): {'jurisdiccion_requerida': 'SAN LUIS',
'categoria_minima_requerida': '2'}

¿Jurisdicción coincide? False
¿Categoría alcanza? True

Veredicto: No corresponde: matriculado en otra jurisdicción
```

Este resultado es una instancia **real y ejecutada** del caso "jurisdicción incorrecta" modelado en la Sección 7: un profesional con categoría suficiente (categoría 2) pero matriculado en una provincia distinta a la del trabajo solicitado (Córdoba vs. San Luis). Confirma en código, no solo en la teoría, por qué el modelo de Credencial necesita evaluar jurisdicción y categoría de forma conjunta, y no solo "¿está en algún padrón?".

Esto confirma de forma concreta (no solo teórica) que Ecogas es automatizable con un mecanismo simple: sin captcha, sin autenticación, con datos estructurados y parseables directamente como JSON. Los campos confirmados son `id` (matrícula), `nombre_apellido` (nombre completo, sin separar), `categoria`, `provincia`, `localidad`, `correo_electronico`, `telefono` y `barrio` — ningún campo de vigencia, tal como se anticipaba en la Sección 4.

No se generó un script equivalente para MetroGAS que intente **obtener** el padrón, porque requiere resolver un reCAPTCHA para conseguir un token válido, y reproducir eso de forma automática excede lo que corresponde intentar para este TF (sería sortear una medida de seguridad activa, no solo consumir un dato público). En su lugar, se armó un script complementario (`prueba_metrogas.py`) que confirma en código —no solo observando el navegador— que esa protección es real y efectiva, sin intentar sortearla.

**Resultado de la ejecución real contra MetroGAS** (04/09/2026):

```
--- Petición SIN token de captcha ---
Status code: 401
Primeros 300 caracteres de la respuesta:
RECAPTCHA-NOT-VALID

--- Petición con token de captcha inválido ---
Status code: 401
Primeros 300 caracteres de la respuesta:
RECAPTCHA-NOT-VALID
```

El propio servidor de MetroGAS confirma, con un mensaje de error explícito, que la protección con reCAPTCHA es real y se aplica sobre cada petición — no es una suposición basada solo en la inspección del navegador (Sección 3), sino un hecho verificado en código. Esto cierra la prueba técnica mínima de forma simétrica para los dos organismos investigados: **Ecogas confirmado como automatizable** (padrón obtenido y evaluado con éxito) y **MetroGAS confirmado como no automatizable por diseño** (petición rechazada explícitamente por el servidor).

---

## 6. Comparación (matriz resumen)

| | MetroGAS (CABA) | Ecogas (Centro/Cuyo) |
|---|---|---|
| Oficio | Gasista | Gasista |
| Jurisdicción | CABA (nacional) | Córdoba, Catamarca, La Rioja, Mendoza, San Juan, San Luis |
| Mecanismo de acceso | API JSON (POST) | Archivo JS estático embebido |
| Autenticación | No | No |
| Protección anti-bot | **reCAPTCHA** (bloqueante) | Bot-detection básica por headers (sorteable con un `User-Agent` normal) |
| Automatizable de forma legítima | **No** | **Sí, con matices** (URL inestable entre deploys) |
| Expone vigencia | No | No |
| Expone jurisdicción/categoría precisa | Parcial (localidad/CP, categoría por código sin confirmar) | Sí (provincia explícita) + categoría |
| Expone datos de contacto sin protección | Sí (nombre, teléfono, email, dirección) | Sí (nombre, teléfono, email) |

**Patrón general que emerge:** la fragmentación de MatriculAR no es solo por *organismo* (como decía el manifiesto original), sino también por **nivel de exposición técnica** — cada distribuidora protege sus datos de forma distinta y con criterios propios, sin ningún estándar común. Eso es, en sí mismo, evidencia a favor del problema que MatriculAR busca resolver.

---

## 7. Modelado de casos de credencial (pedido #2 de Oscar)

A partir de los campos reales confirmados, se construyen los siguientes casos. Como **ninguna fuente investigada expone vigencia**, los casos que dependen de esa información (válida, vencida) no se pueden ilustrar con datos reales — se construyen con **datos ficticios**, tal como habilita explícitamente el pedido de Oscar ("datos públicos o ficticios según corresponda"). Los casos que sí dependen de campos que las fuentes reales exponen (jurisdicción, categoría, disponibilidad de la fuente) se ilustran con datos reales obtenidos en la Sección 5.

| Caso | Origen del dato | Organismo | Matrícula / Nombre | Categoría | Jurisdicción solicitada | Resultado esperado |
|---|---|---|---|---|---|---|
| **Válida** (hipotético) | Ficticio | Ecogas (simulado) | Matrícula `99001`, "Juan Pérez" | Categoría 2, con fecha de verificación de organismo `01/09/2026` (ficticia) | Coincide (San Luis) | ✅ Válida — *solo es posible si el organismo expusiera vigencia explícita, cosa que hoy ninguna fuente investigada hace* |
| **Vencida** (hipotético) | Ficticio | Ecogas (simulado) | Matrícula `99002`, "Ana Gómez" | Categoría 1, con fecha de vencimiento ficticia `15/03/2025` (anterior a hoy) | Coincide (Córdoba) | ❌ Vencida — el sistema debería degradar el estado automáticamente al detectar que la fecha de vencimiento simulada ya pasó (ver máquina de estados del manifiesto: verificado → vencido) |
| **Jurisdicción incorrecta** | **Real — ejecutado** | Ecogas | ID `91`, "RICARDO LUIS CIACIA", categoría `2`, provincia `CORDOBA` (dato real, ver Sección 5) | Categoría 2 (alcanza) | Trabajo requerido en San Luis | ❌ No corresponde: matriculado en Córdoba, no en la jurisdicción del trabajo. **Este caso se ejecutó realmente en la prueba técnica (Sección 5) con este resultado exacto.** |
| **Categoría insuficiente** | **Real** | Ecogas | ID `328`, "ANIBAL JORGE PINO", categoría `1` (dato real obtenido en la Sección 5) | Categoría 1 | Trabajo que requiere categoría 2+ | ⚠️ Aparece en el padrón pero no está habilitado para ese tipo de trabajo específico |
| **Fuente temporalmente no consultable** | **Real** | MetroGAS | — | — | CABA | ⚠️ "No se pudo verificar" (bloqueado por reCAPTCHA) — **no equivale a inválido**, es un estado de incertidumbre distinto |
| **No aparece en ningún padrón consultado** | **Real** (ausencia confirmada) | Ecogas / MetroGAS | Nombre buscado y no encontrado en ninguna de las dos muestras | — | — | ❌ Sin evidencia de matrícula — no se puede confirmar habilitación |

**Nota metodológica:** los dos primeros casos (válida, vencida) son deliberadamente hipotéticos y quedan marcados como tales — no se presentan como si vinieran de una fuente real, para no confundir un dato genuino con uno inventado. Sirven para completar el modelo del dominio (qué campos necesitaría una Credencial para poder representar estos estados: `fecha_ultima_verificacion`, `fecha_vencimiento_declarada`, `estado`), aun cuando hoy ninguna fuente real permita poblarlos con certeza.

---

## 9. Conclusión y decisiones del equipo

A partir de esta investigación, tomamos las siguientes decisiones concretas para el diseño de MatriculAR:

### 9.1 Ajuste a la decisión D4 (padrones simulados detrás de una interfaz)

La decisión original hablaba de "un mock configurable" de forma genérica. Con esta investigación, el puerto de padrones necesita contemplar **dos patrones de adaptador distintos**, no uno solo:

- **Adaptador tipo "API protegida"** (caso MetroGAS): existe un endpoint real, pero detrás de un reCAPTCHA que no corresponde sortear. Se documenta como organismo conocido pero **no integrable** con los medios actuales, sin descartarlo del diseño a futuro (si MetroGAS alguna vez ofreciera una API para partners, el adaptador ya está pensado para ese caso).
- **Adaptador tipo "documento estático a descubrir"** (caso Ecogas): no hay API, sino un archivo público cuya URL cambia en cada deploy del sitio. Este adaptador necesita un paso adicional que el diseño original no contemplaba: **descubrir la URL vigente** antes de poder descargar los datos (por ejemplo, pidiendo primero la página HTML y extrayendo de ahí la referencia al archivo actual).

### 9.2 Campos que necesita el modelo de Credencial

Cada caso modelado en la Sección 7 exige un campo concreto que el modelo de datos debe soportar:

| Campo | Por qué hace falta | Caso de la Sección 7 que lo justifica |
|---|---|---|
| `estado` (enum: `verificado`, `no_verificable`, `fuera_de_jurisdiccion`, `categoria_insuficiente`, `no_encontrado`) | Reemplaza un booleano `vigente` que ninguna fuente real puede sustentar | Todos los casos de la matriz |
| `fecha_ultima_verificacion` | Permite comunicar "presente en el padrón, consultado el [fecha]" en vez de afirmar vigencia | Válida, Vencida (hipotéticos) |
| `fecha_vencimiento_declarada` (opcional, nullable) | Solo se completa si en algún momento se consigue una fuente que sí la exponga; hoy queda vacío para MetroGAS y Ecogas | Vencida (hipotético) |
| `jurisdiccion` y `categoria` (ya contempladas en el manifiesto) | Confirmadas como campos reales disponibles en ambas fuentes investigadas | Jurisdicción incorrecta, Categoría insuficiente (reales) |

No se agrega un campo `vigente: boolean`, porque afirmarlo sin respaldo de ninguna fuente real sería mostrarle al cliente una certeza que el sistema no tiene.

### 9.3 Alcance del MVP: con qué organismo arrancar

Decidimos que el **corte vertical A del MVP integre primero y únicamente Ecogas**, por ser el organismo cuya viabilidad técnica quedó demostrada con una prueba real y ejecutada (Sección 5). MetroGAS queda documentado como **organismo conocido pero fuera de alcance del MVP**, no como un objetivo pendiente de "resolver" en esta etapa — evitar el reCAPTCHA no es un problema de ingeniería a superar, es un límite que corresponde respetar. Esto reduce el alcance de forma justificada, en línea con el pedido de Oscar de aplicar un criterio restrictivo a cada decisión de infraestructura.

### 9.4 Qué implica para el pipeline de verificación

Como la fuente de Ecogas puede cambiar de estructura o de URL en cualquier deploy del sitio (ya lo comprobamos: el nombre del archivo `.js` no es estable), el pipeline de verificación necesita **detectar activamente cuando la extracción falla** — por ejemplo, si un ciclo de verificación obtiene 0 registros o campos con nombres distintos a los esperados, no debe asumir silenciosamente que "no hay matriculados", sino marcar el ciclo como fallido y reintentarlo. Esto le da un propósito concreto a la cola de reintentos y la DLQ que ya estaban planeadas en la arquitectura original (D3): no son solo una buena práctica genérica de sistemas distribuidos, sino una necesidad real derivada de que la fuente externa es, por naturaleza, inestable en el tiempo.
