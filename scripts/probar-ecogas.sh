#!/usr/bin/env bash
# Prueba temprana pedida por el tutor (devolución de la entrega 2): ¿Ecogas responde a un cliente
# que se identifica honestamente, desde el entorno donde vamos a desplegar (AWS)?
#
# Uso:  bash probar-ecogas.sh <contacto>   (un mail o la URL del repositorio)
# Corre en GitHub Actions (.github/workflows/probar-ecogas.yml) y se repite en AWS al desplegar.
#
# No imprime datos personales: solo códigos HTTP, tamaños, la huella del recurso y un conteo.
# Hace una sola lectura de la página y de sus chunks; no lo corras en bucle.
set -u

CONTACTO="${1:?Pasá un contacto (mail o URL) como primer argumento}"
UA="MatriculAR/0.1 (proyecto final UTN; contacto: ${CONTACTO})"
BASE="https://www.ecogas.com.ar"
PAGINA="${BASE}/hogares-comercios/tramites-y-servicios/listado-de-gasistas-matriculados"

echo "Fecha (UTC):  $(date -u +%FT%TZ)"
echo "IP pública:   $(curl -s https://checkip.amazonaws.com)"
echo "User-Agent:   ${UA}"

html="$(mktemp)"
curl -sS -A "$UA" -o "$html" \
  -w "Página:       HTTP %{http_code}, %{size_download} bytes, %{time_total} s\n" "$PAGINA"

encontrado=0

# Formato 2 (desde el 02/11/2026): el padrón viaja dentro de la página, en el payload de React.
if grep -q 'gasistasMatriculados' "$html"; then
  registros="$(grep -o '\\"nombre_apellido\\"' "$html" | wc -l)"
  echo "Formato 2: padrón dentro de la página, huella $(sha256sum "$html" | cut -c1-16)…, ~${registros} registros"
  encontrado=1
fi

# Formato 1 (hasta septiembre de 2026): el padrón está en un chunk con JSON.parse('[{"id":"…
mapfile -t chunks < <(grep -oE '/_next/static/chunks/[^"]+\.js' "$html" | sort -u)
echo "Chunks en la página: ${#chunks[@]}"

for chunk in "${chunks[@]}"; do
  archivo="$(mktemp)"
  respuesta="$(curl -sS -A "$UA" -o "$archivo" -w "%{http_code} %{size_download}" "${BASE}${chunk}")"
  if grep -q "JSON.parse('\[{\"id\":\"" "$archivo" && grep -q '"nombre_apellido"' "$archivo"; then
    registros="$(grep -o '"nombre_apellido"' "$archivo" | wc -l)"
    huella="$(sha256sum "$archivo" | cut -c1-16)"
    echo "Formato 1: padrón en el chunk ${chunk}"
    echo "  HTTP ${respuesta% *}, ${respuesta#* } bytes, huella ${huella}…, ~${registros} registros"
    encontrado=1
  fi
  rm -f "$archivo"
done
rm -f "$html"

if [ "$encontrado" -eq 0 ]; then
  echo "RESULTADO: no se encontró el recurso con datos (¿bloqueo, captcha o cambio de estructura?)."
  exit 1
fi
echo "RESULTADO: Ecogas respondió con el padrón a un cliente identificado."
