export type RespuestaHttp =
  | { ok: true; estado: number; tipoContenido: string; cuerpo: string; ms: number }
  | { ok: false; error: "TIMEOUT" | "RED"; detalle: string; ms: number };

export interface ClienteHttp {
  obtener(url: string, opciones: { userAgent: string; timeoutMs: number }): Promise<RespuestaHttp>;
}

export interface Reloj {
  ahora(): Date;
  esperar(ms: number): Promise<void>;
}

export interface GeneradorIds {
  nuevo(): string;
}
