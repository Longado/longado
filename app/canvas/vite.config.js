import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4310",
        changeOrigin: true,
      },
      "/generated": {
        target: "http://127.0.0.1:4310",
        changeOrigin: true,
      },
      "/assets/dragon": {
        target: "http://127.0.0.1:4310",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:4310",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
  },
});
