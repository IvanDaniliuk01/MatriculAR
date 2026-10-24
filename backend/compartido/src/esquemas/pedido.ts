import { z } from "zod";

/** Pedido de POST /verificaciones (docs/api.md § 3.1). */
export const PedidoVerificacionSchema = z
  .object({
    fuente_id: z.string().min(1).max(40),
    matricula: z.string().min(1).max(40),
    tipo_trabajo_id: z.string().min(1).max(80),
    provincia_trabajo: z.string().min(1).max(60),
  })
  .strict();

export type PedidoVerificacionEntrada = z.infer<typeof PedidoVerificacionSchema>;
