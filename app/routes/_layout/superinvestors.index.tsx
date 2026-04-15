import { createFileRoute } from "@tanstack/react-router";
import { SuperinvestorsTablePage } from "@/pages/SuperinvestorsTable";

export const Route = createFileRoute("/_layout/superinvestors/")({
  component: SuperinvestorsTablePage,
  validateSearch: (search: Record<string, unknown>) => ({
    page: typeof search.page === "string" ? search.page : undefined,
    search: typeof search.search === "string" ? search.search : undefined,
  }),
  ssr: false,
  // Removed Zero preloading - TanStack Query handles data fetching now
});
