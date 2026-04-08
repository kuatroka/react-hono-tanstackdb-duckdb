import { useEffect, useRef, useState } from "react";

export function resolveLatencyMs(
  startMs: number,
  endMs = performance.now(),
  minimumVisibleMs = 0.1,
) {
  return Math.max(endMs - startMs, minimumVisibleMs);
}

export function useLatencyMs({
  isReady,
  resetKey,
  enabled = true,
  minimumVisibleMs = 0.1,
}: {
  isReady: boolean;
  resetKey?: unknown;
  enabled?: boolean;
  minimumVisibleMs?: number;
}) {
  const startRef = useRef<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    startRef.current = performance.now();
    setMs(null);
  }, [resetKey, enabled]);

  useEffect(() => {
    if (!enabled || !isReady || ms != null || startRef.current == null) {
      return;
    }

    setMs(resolveLatencyMs(startRef.current, performance.now(), minimumVisibleMs));
  }, [enabled, isReady, minimumVisibleMs, ms]);

  return ms;
}
