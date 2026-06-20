import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    port: 8080,
    host: "0.0.0.0",
  },
});
