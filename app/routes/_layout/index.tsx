import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useContentReady } from "@/hooks/useContentReady";

export const Route = createFileRoute("/_layout/")({
  component: Home,
  ssr: false,
});

function Home() {
  const { onReady } = useContentReady();

  // Signal ready immediately for static page
  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-4xl font-bold tracking-tight mb-4">
        Welcome to fintellectus (Tanstack DB)
      </h1>
      <p className="text-lg text-muted-foreground max-w-md">
        Your gateway to superinvestor insights and asset analysis.
      </p>
    </div>
  );
}
