import { createFileRoute } from "@tanstack/react-router";
import { AssetDetailPage } from "@/pages/AssetDetail";

export const Route = createFileRoute("/_layout/assets/$code/$cusip")({
  component: AssetDetailPage,
  ssr: false,
  // Removed Zero preloading - TanStack Query handles data fetching now
});
