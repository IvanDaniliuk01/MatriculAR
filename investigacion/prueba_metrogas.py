"""
Prueba técnica mínima - MatriculAR
Fuente: MetroGAS (gasistas matriculados, CABA)

Objetivo de este script (distinto al de Ecogas):
No intenta obtener el padrón completo, porque el endpoint está protegido con
reCAPTCHA y resolverlo automáticamente excedería el alcance ético/legal
razonable para este TF.

En cambio, este script confirma EN CÓDIGO (no solo observando el navegador
con DevTools) que la protección existe y es efectiva: se envía la misma
petición que usa el sitio, pero SIN token de captcha, y se documenta cómo
responde el servidor ante esa petición inválida.

Esto es una prueba técnica legítima: confirma un límite, no lo cruza.
"""

import requests

URL = "https://avmbuscador-lc8a95d0a8.dispatcher.br1.hana.ondemand.com/OvServiceHub/api/avm/v1/rankingnoauth/all"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Content-Type": "application/json",
}

# Intencionalmente SIN token de captcha, para confirmar que el servidor lo exige.
payload_sin_captcha = {}

# También se prueba con un token evidentemente inválido, para ver si el
# servidor devuelve un mensaje de error específico (útil para documentar
# qué tan estricta es la validación).
payload_captcha_invalido = {"captcha": "token_invalido_de_prueba"}


def probar_peticion(payload: dict, descripcion: str) -> None:
    print(f"\n--- {descripcion} ---")
    try:
        resp = requests.post(URL, json=payload, headers=HEADERS, timeout=15)
        print(f"Status code: {resp.status_code}")
        print(f"Primeros 300 caracteres de la respuesta:\n{resp.text[:300]}")
    except requests.RequestException as e:
        print(f"Error de conexión: {e}")


if __name__ == "__main__":
    print("Prueba técnica mínima - MetroGAS")
    print("Objetivo: confirmar que la protección con reCAPTCHA es real y activa.")
    print("Este script NO intenta resolver el captcha ni obtener el padrón.")

    probar_peticion(payload_sin_captcha, "Petición SIN token de captcha")
    probar_peticion(payload_captcha_invalido, "Petición con token de captcha inválido")

    print(
        "\nConclusión esperada: en ambos casos el servidor debería rechazar "
        "la petición o devolver un padrón vacío/incompleto, confirmando que "
        "sin un token de captcha válido (obtenido resolviendo el desafío real "
        "en el navegador) no es posible obtener el padrón de forma automática."
    )
