import { z } from "zod";

/** Esquemas de la API (docs/api.md), compartidos con el frontend. Los campos van en snake_case. */

export const respuestaCondicion = z.enum(["SI", "NO", "NO_SE"]);

export const pedidoVerificacion = z.object({
  fuente_id: z.string().min(1),
  gasista: z.object({
    nombre_apellido: z.string().trim().min(2).max(120),
    localidad: z.string().trim().max(120).optional(),
  }),
  condiciones: z.record(z.string(), respuestaCondicion),
  provincia_trabajo: z.string().min(1),
});

export type PedidoVerificacionApi = z.infer<typeof pedidoVerificacion>;

export const consultaHistorial = z.object({
  nombre_apellido: z.string().trim().min(2).max(120),
  localidad: z.string().trim().min(1).max(120),
});
