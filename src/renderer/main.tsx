/**
 * pi-studybuddy renderer 入口（03-Arch §6.2：React 19 + Vite）
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}