// app/routes/__root.tsx
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { RouterContext } from "../router";
import { ContentReadyProvider } from "@/hooks/useContentReady";
import "@/index.css";

const serverURL = import.meta.env?.VITE_PUBLIC_SERVER ?? "http://localhost:4848";

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "fintellectus (TanStack DB)" },
    ],
    links: [
      { rel: "preconnect", href: serverURL },
    ],
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
