import { scan } from "react-scan";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createRouter } from "../app/router";
import { shouldEnableReactScan } from "./lib/runtime-env";
import "uplot/dist/uPlot.min.css";

if (
  shouldEnableReactScan({
    hostname: globalThis.location?.hostname,
    importMetaEnvDev: import.meta.env?.DEV,
  })
) {
  scan({ enabled: true });
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
