import { GlobalNav } from "./global-nav";
import { useContentReadyState } from "@/hooks/useContentReady";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const isReady = useContentReadyState();

  return (
    <>
      <GlobalNav />
      <div style={{ visibility: isReady ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </>
  );
}
