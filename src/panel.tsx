import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QuickPanelApp } from "./panel/QuickPanelApp";
import "./App.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QuickPanelApp />
  </StrictMode>,
);
