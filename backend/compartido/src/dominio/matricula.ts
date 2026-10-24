/** Matrícula como texto, sin espacios ni ceros a la izquierda (docs/fuentes-y-adaptadores.md § 4.4). */
export function normalizarMatricula(valor: string): string {
  const limpia = valor.replace(/\s+/g, "").toUpperCase();
  const sinCeros = limpia.replace(/^0+/, "");
  return sinCeros === "" && limpia !== "" ? "0" : sinCeros;
}

export function esMatriculaValida(valor: string): boolean {
  return /^[A-Za-z0-9]{1,20}$/.test(valor.replace(/\s+/g, ""));
}

export function claveFuenteMatricula(fuenteId: string, matricula: string): string {
  return `${fuenteId}#${matricula}`;
}
