import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Port resolution: scripts/tauri.mjs decides the dev server port first, then
// injects SUPERCLIP_DEV_PORT so Vite binds exactly that port. Standalone
// `npm run dev` (no wrapper) falls back to 1420 + optional PORT_OFFSET.
// strictPort stays true on purpose: if the port was taken between probing and
// binding, fail loudly instead of drifting to a port Tauri does not know.
// @ts-expect-error process is a nodejs global
const resolvedPort = Number.parseInt(process.env.SUPERCLIP_DEV_PORT ?? "", 10);
// @ts-expect-error process is a nodejs global
const portOffset = Number.parseInt(process.env.PORT_OFFSET ?? "0", 10) || 0;
const devPort =
  resolvedPort >= 1 && resolvedPort <= 65535 ? resolvedPort : 1420 + portOffset;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // 构建期注入应用版本（设置 → 关于页展示，避免前端硬编码版本号）
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.npm_package_version ?? "0.1.0",
    ),
  },

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
