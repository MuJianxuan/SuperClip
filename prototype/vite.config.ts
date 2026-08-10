import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 原型独立构建配置 —— 不依赖主项目，可在此目录单独 `npm run dev` 预览。
// 端口 1430 避开主项目 Vite dev (1420)，可同时运行互不干扰。
// 2026-08：反向补回正式实现后，启用 Tailwind 4 以对齐 Main/Settings 的 utility class。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 1430,
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
});
