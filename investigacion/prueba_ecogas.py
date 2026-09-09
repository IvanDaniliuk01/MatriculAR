"""
Prueba técnica mínima - MatriculAR
Fuente: Ecogas (gasistas matriculados, provincias Córdoba/Catamarca/La Rioja/Mendoza/San Juan/San Luis)

Objetivo: confirmar si el padrón de gasistas matriculados es accesible de forma
automatizada, sin necesidad de resolver captcha ni autenticarse.

Hallazgo previo (vía DevTools del navegador): los datos del padrón están
embebidos directamente en un archivo JavaScript estático que Next.js genera
para la página del listado. No hay llamada a una API JSON separada.

IMPORTANTE (ética/legal):
- Este script es solo para PROBAR que el mecanismo funciona (prueba de concepto).
- No lo usen para descargar el padrón completo ni para uso más allá del TF.
- El nombre del archivo JS puede cambiar en cada deploy de Ecogas (los hashes
  tipo "3182-ad3160686a0b7005" cambian cuando el sitio se actualiza), así que
  este script puede dejar de funcionar en cualquier momento - lo cual es en sí
  mismo una limitación real a documentar: no es una fuente estable en el tiempo.
"""

import re
import json
import requests

URL = "https://www.ecogas.com.ar/_next/static/chunks/3182-ad3160686a0b7005.js"

# Headers que simulan un navegador real, para evitar el bloqueo por bot
# detection que devuelve el servidor ante clientes sin User-Agent reconocible.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "es-AR,es;q=0.9",
}


def descargar_chunk(url: str) -> str:
    """Descarga el archivo JS y devuelve su contenido como texto."""
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    print(f"Status: {resp.status_code} | Tamaño: {len(resp.text) / 1024:.1f} KB")
    return resp.text


def extraer_registros(texto_js: str) -> list[dict]:
    """
    Cada registro está embebido como un objeto JSON bien formado, con esta
    estructura confirmada mediante inspección manual (ver diagnostico_ecogas.py):

    {"id":"11143","nombre_apellido":"CARLOS PEDRO LOVAGNINI","categoria":"1",
     "provincia":"SAN LUIS","localidad":"CAPITAL SAN LUIS",
     "correo_electronico":"carloslovagnini@gmail.com",
     "telefono":"02664426978","barrio":"BAJO GRANDE"}

    Se captura el objeto completo (no campo por campo) y se parsea con
    json.loads, que es más robusto que reconstruirlo manualmente.
    """
    patron = re.compile(r'\{"id":"[^{}]*?"barrio":"[^"]*"\}')
    registros = []
    for match in patron.finditer(texto_js):
        try:
            registros.append(json.loads(match.group()))
        except json.JSONDecodeError:
            continue  # se descartan matches mal formados, si los hubiera
    return registros


if __name__ == "__main__":
    contenido = descargar_chunk(URL)
    registros = extraer_registros(contenido)

    print(f"\nRegistros detectados: {len(registros)}")
    print("\nMuestra de los primeros 5 (para no bajar el padrón completo):")
    for r in registros[:5]:
        print(r)

    # Guardar solo una muestra chica, no el padrón completo, por las
    # consideraciones éticas mencionadas arriba.
    with open("muestra_ecogas.json", "w", encoding="utf-8") as f:
        json.dump(registros[:10], f, ensure_ascii=False, indent=2)
    print("\nMuestra guardada en muestra_ecogas.json")

    # --- Paso de EVALUACIÓN (no solo obtención) ---
    # Oscar pidió explícitamente "obtener Y EVALUAR" la situación de una
    # credencial. Acá se toma un registro real ya obtenido y se evalúa
    # contra un caso de uso ficticio de contratación.
    print("\n" + "=" * 60)
    print("EVALUACIÓN DE UNA CREDENCIAL CONTRA UN CASO DE USO")
    print("=" * 60)

    if registros:
        credencial = registros[0]  # se toma el primer registro real obtenido
        trabajo_solicitado = {
            "jurisdiccion_requerida": "SAN LUIS",
            "categoria_minima_requerida": "2",
        }

        print(f"\nCredencial obtenida (dato real): {credencial}")
        print(f"Trabajo solicitado (caso ficticio): {trabajo_solicitado}")

        jurisdiccion_ok = (
            credencial.get("provincia", "").upper()
            == trabajo_solicitado["jurisdiccion_requerida"]
        )
        # Comparación simple de categoría como número; los datos reales
        # traen la categoría como texto ("1", "2", etc.)
        try:
            categoria_ok = int(credencial.get("categoria", 0)) >= int(
                trabajo_solicitado["categoria_minima_requerida"]
            )
        except ValueError:
            categoria_ok = False

        print(f"\n¿Jurisdicción coincide? {jurisdiccion_ok}")
        print(f"¿Categoría alcanza? {categoria_ok}")

        if jurisdiccion_ok and categoria_ok:
            veredicto = "Aparece en el padrón y cumple jurisdicción/categoría (NO implica vigencia confirmada)"
        elif not jurisdiccion_ok:
            veredicto = "No corresponde: matriculado en otra jurisdicción"
        else:
            veredicto = "Aparece en el padrón pero la categoría es insuficiente para el trabajo"

        print(f"\nVeredicto: {veredicto}")
        print(
            "\nNOTA: este veredicto nunca puede ser 'vigente confirmado', porque "
            "la fuente no expone ese dato. Es, como máximo, 'presente en el "
            "padrón, con jurisdicción y categoría evaluadas'."
        )
