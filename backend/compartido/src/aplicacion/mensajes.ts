import type { Credencial, Evaluacion, Fuente, MotivoFalla } from "../dominio/tipos";

/** "26/09/2026 15:40", en hora de Argentina. */
export function fechaArgentina(iso: string): string {
  const f = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")} ${g("hour")}:${g("minute")}`;
}

function causa(motivo: MotivoFalla | null): string {
  switch (motivo) {
    case "EXTRACTION_FAILED":
      return "el formato del recurso cambió o la lectura no pasó las validaciones";
    case "SOURCE_UNAVAILABLE":
      return "el servicio no respondió";
    default:
      return "la consulta no pudo completarse";
  }
}

export function mensajeFound(c: Credencial, fuente: Fuente, e: Evaluacion): string {
  const base = `La matrícula ${c.matricula} figura en el padrón de ${fuente.nombre} (consulta del ${fechaArgentina(c.consultada_en)}) con categoría ${c.categoria_informada}ª`;
  switch (e.resultado) {
    case "COMPATIBLE":
      return `${base}, que la NAG-200 admite para este tipo de trabajo.`;
    case "INCOMPATIBLE":
      return `${base}, que la NAG-200 no admite para este tipo de trabajo.`;
    default:
      return `${base}. No podemos evaluar esa categoría para este tipo de trabajo.`;
  }
}

export function mensajeNotFound(matricula: string, fuente: Fuente, finalizadaEn: string): string {
  return `La matrícula ${matricula} no figura en el padrón de ${fuente.nombre} según la consulta exitosa del ${fechaArgentina(finalizadaEn)}. Esto no dice nada sobre otras distribuidoras.`;
}

export function mensajeUnverifiable(
  fuente: Fuente,
  motivo: MotivoFalla | null,
  cuando: string,
  previa: Credencial | undefined,
): string {
  if (motivo === "SOURCE_NOT_AUTOMATABLE") {
    return `${fuente.nombre} no permite consultas automáticas: su buscador exige un captcha. Podés verificar la matrícula manualmente en el buscador oficial: ${fuente.url_buscador_oficial}.`;
  }
  let m = `No pudimos consultar el padrón de ${fuente.nombre} (${fechaArgentina(cuando)}): ${causa(motivo)}. No podemos afirmar nada con evidencia de hoy.`;
  if (previa) {
    m += ` Última evidencia disponible: figuraba con categoría ${previa.categoria_informada}ª según la consulta del ${fechaArgentina(previa.consultada_en)}.`;
  }
  return m;
}
