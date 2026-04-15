// app/router.tsx
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export interface RouterContext {
  // Removed Zero dependency - using TanStack DB collections instead
}

export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "viewport",
    // TanStack Query handles caching, so we can use standard preload behavior
    defaultPreloadStaleTime: 0,
    defaultPreloadGcTime: 0,
    context: {} satisfies RouterContext,
  });

  return router;
}

// Required by TanStack Start
export function getRouter() {
  return createRouter();
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
