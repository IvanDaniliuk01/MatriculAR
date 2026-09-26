# Investigación de fuentes reales

Esta carpeta contiene la **exploración aislada** que hicimos entre el 04/09 y el 09/09/2026 para responder a la primera devolución del tutor: si era técnicamente posible obtener y procesar padrones reales de gasistas matriculados.

> **Esto no es código del sistema.** Son scripts exploratorios en Python que el tutor pidió como *prueba técnica mínima*. No forman parte de la arquitectura de MatriculAR ni se van a reutilizar tal cual: la implementación (en TypeScript, ver [`docs/arquitectura.md`](../docs/arquitectura.md)) empieza recién después de que se apruebe la entrega de diseño. Lo que sí se reutiliza es **lo aprendido**, que quedó documentado en [`docs/fuentes-y-adaptadores.md`](../docs/fuentes-y-adaptadores.md).

## Contenido

| Archivo | Qué es | Estado al 26/09/2026 |
|---|---|---|
| [`MatriculAR_investigacion_fuentes_gas.md`](MatriculAR_investigacion_fuentes_gas.md) | Informe de la investigación: MetroGAS y Ecogas, matriz comparativa, casos modelados y decisiones. | **Registro histórico con fe de erratas.** Varias conclusiones se corrigieron a partir de la devolución v2; ver la tabla al principio del documento. |
| [`prueba_ecogas.py`](prueba_ecogas.py) | Descarga el recurso de Ecogas, extrae los registros y aplica una regla de evaluación. | **Ya no funciona**: la URL fija devuelve 404 y el patrón de extracción encuentra 0 registros. Además, su regla de evaluación era incorrecta (errata E1 y E2). Se conserva como evidencia del hallazgo. |
| [`prueba_metrogas.py`](prueba_metrogas.py) | Confirma en código que MetroGAS rechaza pedidos sin un captcha válido, **sin intentar sortearlo**. | Válido como evidencia del límite técnico. |
| [`diagnostico_ecogas.py`](diagnostico_ecogas.py) | Muestra el contexto alrededor de un apellido dentro del recurso descargado, para ajustar el patrón de extracción. | El apellido de búsqueda se anonimizó; hay que reemplazarlo localmente para ejecutarlo. |

## Qué se aprendió

1. **Obtener correctamente un dato no implica interpretarlo correctamente.** El script de Ecogas funcionó según la regla que escribimos, pero la regla era incorrecta en dos puntos:
   - **Provincia:** tratamos la provincia del padrón como la zona donde el gasista puede trabajar, cuando en realidad es su domicilio.
   - **Categoría:** comparamos las categorías como números, cuando son alcances técnicos y la 1ª es la más amplia.
2. **Una fuente web no contractual se rompe sin avisar.** Entre el 04/09 y el 26/09/2026 cambió el nombre del archivo y el orden de los campos. Un sistema que no valida la extracción habría informado "0 matriculados" en vez de "no pudimos consultar la fuente".
3. **"No encontrado" y "no verificable" son resultados distintos.** Ecogas se puede consultar y dar un negativo; MetroGAS no se puede consultar automáticamente, y eso es incertidumbre, no un negativo.
4. **Ninguna fuente informa vigencia.** Figurar en el padrón no prueba que la matrícula esté renovada.

## Uso responsable

- Los scripts **procesan el recurso completo** necesario para la prueba, pero solo persisten una muestra reducida. Esa muestra (`muestra_ecogas.json`) está ignorada por git y **no se sube al repositorio**.
- Los nombres, correos, teléfonos y barrios reales que figuraban en el informe y en los scripts **se anonimizaron** el 26/09/2026. Solo se conservan matrícula, categoría, provincia y localidad, que son los datos estrictamente necesarios para explicar los casos técnicos.
- La prueba contra MetroGAS **no intenta resolver ni evitar el reCAPTCHA**: solo documenta que existe.
- Las condiciones de uso de Ecogas para una consulta periódica se preguntaron a la distribuidora; ver [`docs/consulta-a-ecogas.md`](../docs/consulta-a-ecogas.md).
