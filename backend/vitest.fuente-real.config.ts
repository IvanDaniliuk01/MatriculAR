import { defineConfig } from "vitest/config";

/** Pruebas contra Fuentes reales: solo a mano (`npm run test:fuente-real`), nunca en CI. */
export default defineConfig({
  test: {
    include: ["compartido/test/fuente-real/**/*.real.test.ts"],
  },
});
