import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["compartido/test/**/*.test.ts", "verificacion/test/**/*.test.ts"],
    environment: "node",
  },
});
