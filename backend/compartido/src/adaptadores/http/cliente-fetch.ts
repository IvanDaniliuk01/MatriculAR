import type { ClienteHttp, RespuestaHttp } from "../../puertos/infraestructura";

/** Cliente HTTP sobre `fetch` nativo. El tiempo límite cubre también la lectura del cuerpo. */
export class ClienteFetch implements ClienteHttp {
  async obtener(
    url: string,
    { userAgent, timeoutMs }: { userAgent: string; timeoutMs: number },
  ): Promise<RespuestaHttp> {
    const inicio = performance.now();
    const ms = () => Math.round(performance.now() - inicio);
    try {
      const respuesta = await fetch(url, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const cuerpo = await respuesta.text();
      return {
        ok: true,
        estado: respuesta.status,
        tipoContenido: respuesta.headers.get("content-type") ?? "",
        cuerpo,
        ms: ms(),
      };
    } catch (error) {
      if (error instanceof DOMException && ["TimeoutError", "AbortError"].includes(error.name)) {
        return {
          ok: false,
          error: "TIMEOUT",
          detalle: `Sin respuesta en ${timeoutMs} ms.`,
          ms: ms(),
        };
      }
      const detalle =
        error instanceof Error ? (error.cause?.toString() ?? error.message) : String(error);
      return { ok: false, error: "RED", detalle, ms: ms() };
    }
  }
}
