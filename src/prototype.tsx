import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrototypeShell } from "./prototype/PrototypeShell";
import "./prototype/prototype.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrototypeShell />
  </StrictMode>,
);