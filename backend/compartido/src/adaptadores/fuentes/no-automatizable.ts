import type { Lectura, PedidoLectura, PuertoFuente } from "../../puertos/fuentes";

/** MetroGAS: su buscador exige un captcha. No se hace ningún pedido ni se intenta evadirlo. */
export class NoAutomatizable implements PuertoFuente {
  async leer(_pedido: PedidoLectura): Promise<Lectura> {
    return { tipo: "NO_REALIZADA", motivo: "SOURCE_NOT_AUTOMATABLE", intentos: [] };
  }
}
