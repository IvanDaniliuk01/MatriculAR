#!/usr/bin/env bash
# Genera docs/informe-final.pdf a partir de docs/informe-final.md.
#
# Markdown → HTML con `marked` (instalado en un directorio temporal, sin tocar las dependencias del
# repositorio), diagramas Mermaid renderizados en el navegador y PDF con Chrome sin interfaz.
# Corre en WSL usando el Chrome de Windows, o en Linux con google-chrome / chromium.
#
# Uso: scripts/generar-informe.sh
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
origen="$raiz/docs/informe-final.md"
destino="$raiz/docs/informe-final.pdf"

# Chrome: el de Windows desde WSL, o uno de Linux.
chrome_win="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
if [ -x "$chrome_win" ]; then
  modo=windows
  temp_win="$(cmd.exe /c 'echo %TEMP%' 2>/dev/null | tr -d '\r')"
  trabajo="$(wslpath "$temp_win")/matricular-informe"
elif command -v google-chrome >/dev/null || command -v chromium >/dev/null; then
  modo=linux
  trabajo="$(mktemp -d)/matricular-informe"
else
  echo "No encontré Chrome (ni el de Windows ni google-chrome/chromium)." >&2
  exit 1
fi

rm -rf "$trabajo" && mkdir -p "$trabajo"
herramientas="$(mktemp -d)"
trap 'rm -rf "$herramientas"' EXIT

echo "==> Markdown a HTML"
(cd "$herramientas" && npm init -y >/dev/null && npm install --silent marked@16 marked-gfm-heading-id@4 >/dev/null)
cp -r "$raiz/docs/img" "$trabajo/img" 2>/dev/null || mkdir -p "$trabajo/img"

cat > "$herramientas/convertir.mjs" <<'EOF'
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";

const [origen, trabajo, css] = process.argv.slice(2);
const marked = new Marked({ gfm: true });
marked.use(gfmHeadingId());

let cuerpo = marked.parse(readFileSync(origen, "utf8"));
// Los bloques ```mermaid se dibujan en el navegador.
cuerpo = cuerpo.replace(
  /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
  '<pre class="mermaid">$1</pre>',
);
// Una captura que todavía no existe se muestra como un recuadro, no como imagen rota.
cuerpo = cuerpo.replace(/<img src="([^"]+)" alt="([^"]*)">/g, (img, src, alt) =>
  existsSync(join(trabajo, src)) ? img : `<div class="captura-pendiente">Captura pendiente: ${src}</div>`,
);

writeFileSync(
  join(trabajo, "informe-final.html"),
  `<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8"><title>MatriculAR · Informe Final</title>
<style>${readFileSync(css, "utf8")}</style></head>
<body>${cuerpo}
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: false, theme: "neutral", fontFamily: "Segoe UI, Arial, sans-serif" });
  await mermaid.run({ querySelector: ".mermaid" });
  document.body.dataset.listo = "si";
</script>
</body></html>`,
);
EOF
node "$herramientas/convertir.mjs" "$origen" "$trabajo" "$raiz/scripts/informe.css"

echo "==> HTML a PDF con Chrome ($modo)"
flags=(--headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=20000 --run-all-compositor-stages-before-draw)
if [ "$modo" = windows ]; then
  html_win="$(wslpath -w "$trabajo/informe-final.html")"
  pdf_win="$(wslpath -w "$trabajo")\\informe-final.pdf"
  "$chrome_win" "${flags[@]}" "--print-to-pdf=$pdf_win" "file:///${html_win//\\//}" 2>/dev/null
else
  "$(command -v google-chrome || command -v chromium)" "${flags[@]}" \
    "--print-to-pdf=$trabajo/informe-final.pdf" "file://$trabajo/informe-final.html" 2>/dev/null
fi

cp "$trabajo/informe-final.pdf" "$destino"
echo "PDF: $destino ($(du -k "$destino" | cut -f1) KB)"
