import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["compartido/test/**/*.test.ts", "verificacion/test/**/*.test.ts"],
    // Las pruebas contra Fuentes reales solo corren a mano: `npm run test:fuente-real`.
    exclude: [...configDefaults.exclude, "**/*.real.test.ts"],
  },
});
