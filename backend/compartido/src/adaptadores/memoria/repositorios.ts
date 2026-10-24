import type {
  Consulta,
  Credencial,
  CredencialRef,
  Evaluacion,
  ResultadoDeVerificacion,
  Verificacion,
} from "../../dominio/tipos";
import type { Ids, PaqueteVerificacion, RepositorioEvidencia } from "../../puertos/repositorios";

/** Repositorio en memoria: para pruebas y para correr el flujo sin AWS. */
export class RepositorioEnMemoria implements RepositorioEvidencia {
  private consultas = new Map<string, Consulta>();
  private credenciales = new Map<string, Credencial>(); // evidencia_id completo con fuente_matricula
  private resultados: ResultadoDeVerificacion[] = [];
  private evaluaciones = new Map<string, Evaluacion>();
  private verificaciones = new Map<string, Verificacion>();
  /** Para simular una caída de la base en las pruebas. */
  falloAlGuardar: Error | null = null;

  private clave(ref: CredencialRef): string {
    return `${ref.fuente_matricula}|${ref.evidencia_id}`;
  }

  async iniciarConsulta(consulta: Consulta): Promise<void> {
    this.consultas.set(consulta.consulta_id, structuredClone(consulta));
  }

  async guardarPaquete(p: PaqueteVerificacion): Promise<void> {
    if (this.falloAlGuardar) throw this.falloAlGuardar; // atómico: no se guarda nada
    this.consultas.set(p.consulta.consulta_id, structuredClone(p.consulta));
    this.resultados.push(structuredClone(p.resultado));
    if (p.credencial) {
      this.credenciales.set(
        this.clave({ fuente_matricula: p.credencial.fuente_matricula, evidencia_id: p.credencial.evidencia_id }),
        structuredClone(p.credencial),
      );
    }
    if (p.evaluacion) this.evaluaciones.set(p.evaluacion.evaluacion_id, structuredClone(p.evaluacion));
    this.verificaciones.set(p.verificacion.verificacion_id, structuredClone(p.verificacion));
  }

  async ultimaConsultaExitosa(fuenteId: string) {
    return [...this.consultas.values()]
      .filter((c) => c.fuente_id === fuenteId && c.estado === "SUCCEEDED")
      .sort((a, b) => (a.finalizada_en ?? "").localeCompare(b.finalizada_en ?? ""))
      .at(-1);
  }

  async ultimaCredencial(fuenteMatricula: string) {
    return [...this.credenciales.values()]
      .filter((c) => c.fuente_matricula === fuenteMatricula)
      .sort((a, b) => a.evidencia_id.localeCompare(b.evidencia_id))
      .at(-1);
  }

  async verificacion(id: string) {
    return this.verificaciones.get(id);
  }
  async consulta(id: string) {
    return this.consultas.get(id);
  }
  async credencial(ref: CredencialRef) {
    return this.credenciales.get(this.clave(ref));
  }
  async evaluacion(id: string) {
    return this.evaluaciones.get(id);
  }

  async historial(fuenteMatricula: string) {
    return {
      credenciales: [...this.credenciales.values()]
        .filter((c) => c.fuente_matricula === fuenteMatricula)
        .sort((a, b) => b.evidencia_id.localeCompare(a.evidencia_id)),
      resultados: this.resultados
        .filter((r) => r.fuente_matricula === fuenteMatricula)
        .sort((a, b) => b.determinado_en.localeCompare(a.determinado_en)),
    };
  }

  async consultasDeFuente(fuenteId: string, limite: number) {
    return [...this.consultas.values()]
      .filter((c) => c.fuente_id === fuenteId)
      .sort((a, b) => b.iniciada_en.localeCompare(a.iniciada_en))
      .slice(0, limite);
  }
}

const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Identificadores ordenables por tiempo (estilo ULID), con tiempo y azar inyectables. */
export class GeneradorIds implements Ids {
  constructor(
    private readonly ahora: () => number = Date.now,
    private readonly azar: () => number = Math.random,
  ) {}
  nuevo(): string {
    let t = this.ahora();
    let tiempo = "";
    for (let i = 0; i < 10; i++) {
      tiempo = BASE32[t % 32] + tiempo;
      t = Math.floor(t / 32);
    }
    let rnd = "";
    for (let i = 0; i < 16; i++) rnd += BASE32[Math.floor(this.azar() * 32)];
    return tiempo + rnd;
  }
}
