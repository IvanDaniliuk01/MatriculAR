import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Rutas relativas: el sitio se sirve desde la raíz de un bucket de S3.
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.tsx"],
  },
});
