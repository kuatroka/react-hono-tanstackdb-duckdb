import { createFileRoute } from "@tanstack/react-router";
import { AssetDetailPage } from "@/pages/AssetDetail";

export const Route = createFileRoute("/_layout/assets/$code/$cusip")({
  component: AssetDetailPage,
  ssr: false,
  // TanStack Query handles route data fetching now.
});
