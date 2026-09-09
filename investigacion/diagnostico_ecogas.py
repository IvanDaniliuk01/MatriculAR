"""
Diagnóstico: muestra el contexto real (500 caracteres) alrededor de un apellido
conocido dentro del archivo JS, para poder ajustar el patrón de extracción.
"""

import requests

URL = "https://www.ecogas.com.ar/_next/static/chunks/3182-ad3160686a0b7005.js"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
}

resp = requests.get(URL, headers=HEADERS, timeout=15)
texto = resp.text

apellido_buscado = "LOVAGNINI"
idx = texto.upper().find(apellido_buscado)

if idx == -1:
    print(f"No se encontró '{apellido_buscado}' en el archivo descargado.")
    print("Puede que el hash del archivo haya cambiado. Tamaño descargado:", len(texto))
else:
    inicio = max(0, idx - 250)
    fin = min(len(texto), idx + 250)
    print("Contexto encontrado alrededor de LOVAGNINI:\n")
    print(texto[inicio:fin])
