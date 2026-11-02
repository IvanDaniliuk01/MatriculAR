import type { Reloj } from "../../puertos/infraestructura";

export const relojSistema: Reloj = {
  ahora: () => new Date(),
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
};
