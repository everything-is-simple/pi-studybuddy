import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * pi-studybuddy renderer Vite 配置（03-Arch §6.2：React 19 + Vite）
 *
 * 产物输出到 dist/renderer，由 main/protocol.ts 注册的 app:// 自定义协议加载。
 * root 设为 src/renderer，保证 index.html/main.tsx 为打包入口根；
 * renderer 通过相对路径引用 src/contract、src/shared（位于 root 之外，需 fs.allow）。
 */
export default defineConfig({
  plugins: [react()],
  root: "src/renderer",
  base: "./",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  server: {
    fs: {
      // 允许 renderer 访问 root 之外的 src/contract、src/shared
      allow: ["../.."],
    },
  },
});