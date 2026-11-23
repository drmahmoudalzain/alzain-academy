import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/alzain-academy/",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "login.html"),
      },
    },
  },
  server: { port: 5173, open: true },
});