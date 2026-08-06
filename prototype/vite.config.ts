import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 原型独立构建配置 —— 不依赖主项目，可在此目录单独 `npm run dev` 预览。
// 端口 1430 避开主项目 Vite dev (1420)，可同时运行互不干扰。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 1430,
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
});
