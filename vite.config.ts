/// <reference types="vitest" />
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { fifacmData } from "./plugins/fifacmData";

export default defineConfig({
  plugins: [react(), tailwindcss(), fifacmData()],
  server: { port: 2222, strictPort: true },
  // đường dẫn tương đối để chạy được cả khi mở file tĩnh / đóng gói Capacitor
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          radix: ["radix-ui"],
          motion: ["framer-motion"],
        },
      },
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
