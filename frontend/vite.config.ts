import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared"),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
