import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Port offset support: set PORT_OFFSET (e.g. `PORT_OFFSET=100 npm run tauri dev`)
// to avoid port collisions with other local apps that also default to 1420.
// The same offset is applied to Vite's dev server here and to Tauri's build.devUrl
// by the wrapper script (scripts/tauri.mjs).
// @ts-expect-error process is a nodejs global
const portOffset = Number.parseInt(process.env.PORT_OFFSET ?? "0", 10) || 0;
const devPort = 1420 + portOffset;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        popup: resolve(__dirname, "popup.html"),
        preview: resolve(__dirname, "preview.html"),
        panel: resolve(__dirname, "panel.html"),
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: devPort,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: devPort + 1,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
