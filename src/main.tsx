import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createRouter } from "../app/router";
import "uplot/dist/uPlot.min.css";

if (import.meta.env?.DEV) {
  const script = document.createElement("script");
  script.crossOrigin = "anonymous";
  script.src = "https://unpkg.com/react-scan/dist/auto.global.js";
  document.head.appendChild(script);
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root not found");
}

const router = createRouter();

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
