import { scan } from "react-scan";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createRouter } from "../app/router";
import { initializeProductAnalytics } from "./lib/analytics";
import { initializeErrorTracking } from "./lib/error-tracking";
import { shouldEnableReactScan } from "./lib/runtime-env";
import "uplot/dist/uPlot.min.css";

function isReactScanDisabled() {
  try {
    return globalThis.localStorage?.getItem("react-scan") === "0";
  } catch {
    return false;
  }
}

if (
  shouldEnableReactScan({
    hostname: globalThis.location?.hostname,
    importMetaEnvDev: import.meta.env?.DEV,
    reactScanDisabled: isReactScanDisabled(),
  })
) {
  scan({ enabled: true });
}

initializeProductAnalytics();
initializeErrorTracking();

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
