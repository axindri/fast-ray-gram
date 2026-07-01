import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  target: "http://localhost:8000",
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": apiProxy,
      "/user": apiProxy,
      "/admin": apiProxy,
      "/tw": apiProxy,
      "/xui": apiProxy,
    },
  },
  build: {
    outDir: "../src/static/dist",
    emptyOutDir: true,
  },
});
