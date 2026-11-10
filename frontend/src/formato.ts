const FECHA = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Cordoba",
});

/** Fecha y hora de Argentina, por ejemplo "02/11/26, 15:40". */
export function fechaHora(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : FECHA.format(fecha);
}

/** "2" → "2ª". */
export function categoria(numero: string): string {
  return /^\d+$/.test(numero) ? `${numero}ª` : numero;
}
