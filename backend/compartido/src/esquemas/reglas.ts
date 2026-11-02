import { z } from "zod";
import { CATEGORIAS } from "../dominio/reglas";

/** Esquemas de los archivos de `database/seed/`: así se ven las reglas antes de entrar al dominio. */

const fundamento = z.object({
  norma: z.string().min(1),
  articulo: z.string().min(1),
  cita: z.string().min(1),
  url: z.string().min(1),
  nota: z.string().optional(),
});

export const condicionDecisivaSeed = z.object({
  condicion_id: z.string().min(1),
  orden: z.number().int(),
  pregunta: z.string().min(1),
  ayuda: z.string(),
  fundamento,
});

export const tipoTrabajoSeed = z.object({
  tipo_trabajo_id: z.string().min(1),
  version: z.number().int().positive(),
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  aplica_si: z.array(z.record(z.string(), z.enum(["SI", "NO"]))).min(1),
  categorias_admitidas: z.array(z.enum(CATEGORIAS)),
  fundamento: z.array(fundamento.extend({ categoria: z.enum(CATEGORIAS), admitida: z.boolean() })),
  limitaciones: z.array(z.string()),
  activo: z.boolean(),
});

export const fuenteSeed = z.object({
  fuente_id: z.string().min(1),
  version: z.number().int().positive(),
  nombre: z.string().min(1),
  area_concesion: z.array(z.string()),
  area_concesion_parcial: z.array(z.string()),
  limitaciones: z.array(z.string()),
  activa: z.boolean(),
});

export const provinciaSeed = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
});
