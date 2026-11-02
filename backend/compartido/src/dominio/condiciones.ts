/** Respuesta del Cliente a una Condición decisiva. Un No sé nunca se toma como Sí. */
export type Respuesta = "SI" | "NO" | "NO_SE";

export type RespuestaConocida = Exclude<Respuesta, "NO_SE">;

export type CondicionId = string;

/** Respuestas del Cliente, una por cada Condición decisiva del catálogo. */
export type Respuestas = Readonly<Record<CondicionId, Respuesta>>;

/** Respuestas sin ningún No sé: un escenario concreto de cómo podría ser el trabajo. */
export type RespuestasConocidas = Readonly<Record<CondicionId, RespuestaConocida>>;
