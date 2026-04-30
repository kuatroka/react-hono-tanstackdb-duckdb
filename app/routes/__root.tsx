// app/routes/__root.tsx
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { RouterContext } from "../router";
import { ContentReadyProvider } from "@/hooks/useContentReady";
import "@/index.css";

const serverURL = import.meta.env?.VITE_PUBLIC_SERVER;

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "fintellectus (Tanstack DB)" },
    ],
    links: serverURL ? [
      { rel: "preconnect", href: serverURL },
    ] : [],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <ContentReadyProvider>
      <Outlet />
    </ContentReadyProvider>
  );
}
