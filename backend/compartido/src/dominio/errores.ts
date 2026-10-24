/** Errores del PEDIDO (4xx). Una Fuente que falla no es un error: es un resultado UNVERIFIABLE. */
export class ErrorDePedido extends Error {
  constructor(
    readonly codigo: "FUENTE_INEXISTENTE" | "TIPO_TRABAJO_INEXISTENTE" | "PROVINCIA_INEXISTENTE" | "MATRICULA_INVALIDA",
    mensaje: string,
    readonly status: 404 | 422,
  ) {
    super(mensaje);
  }
}
