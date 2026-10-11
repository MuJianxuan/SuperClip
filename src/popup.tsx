import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PopupApp } from "./popup/PopupApp";
import "./App.css";

// 抑制 WKWebView 原生右键菜单（Reload / Inspect Element）：
// popup 行内右键要弹自定义菜单，原生菜单会盖在它上面
window.addEventListener("contextmenu", (event) => event.preventDefault());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
);
