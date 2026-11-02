import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { repositoriosEnArchivo } from "../../src/adaptadores/archivo/repositorios";
import { probarContratoRepositorios } from "./repositorios.contrato";

const directorios: string[] = [];
afterAll(() => {
  for (const directorio of directorios) rmSync(directorio, { recursive: true, force: true });
});

probarContratoRepositorios("en archivo local", async () => {
  const directorio = mkdtempSync(join(tmpdir(), "matricular-repos-"));
  directorios.push(directorio);
  return repositoriosEnArchivo(directorio);
});
