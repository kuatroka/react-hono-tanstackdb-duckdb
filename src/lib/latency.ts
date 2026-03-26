import { useEffect, useRef, useState } from "react";

export function useLatencyMs({
  isReady,
  resetKey,
  enabled = true,
}: {
  isReady: boolean;
  resetKey?: unknown;
  enabled?: boolean;
}) {
  const startRef = useRef<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // If the data is already ready when the key changes, this is a warm cache hit.
    // In that case, report 0ms instead of measuring local render time.
    if (isReady) {
      setMs(0);
      startRef.current = null;
      return;
    }
    startRef.current = performance.now();
    setMs(null);
  }, [resetKey, enabled, isReady]);

  useEffect(() => {
    if (!enabled) return;
    if (startRef.current == null) {
      startRef.current = performance.now();
    }
    if (isReady && ms == null) {
      setMs(performance.now() - startRef.current);
    }
  }, [enabled, isReady, ms]);

  return ms;
}
