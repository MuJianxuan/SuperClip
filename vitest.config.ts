import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    // cankao/ 是本地参考克隆（含 ava 测试文件），不属于本仓库测试面
    exclude: [...configDefaults.exclude, "cankao/**"],
  },
});
