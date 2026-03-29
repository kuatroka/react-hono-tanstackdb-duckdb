import { useEffect, useRef, useState } from "react";

/**
 * Hook to measure component render timing.
 * 
 * Call startRenderTimer() when data is first received.
 * The hook will measure the time until the component finishes rendering
 * and return the render time in milliseconds.
 * 
 * @returns { renderMs, startRenderTimer, isRenderComplete }
 */
export function useRenderTiming() {
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [isRenderComplete, setIsRenderComplete] = useState(false);
  const renderStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const startRenderTimer = () => {
    renderStartRef.current = performance.now();
    setRenderMs(null);
    setIsRenderComplete(false);
  };

  useEffect(() => {
    // If we started timing, measure after the render commits
    if (renderStartRef.current != null && !isRenderComplete) {
      // Use requestAnimationFrame to measure after paint
      rafRef.current = requestAnimationFrame(() => {
        if (renderStartRef.current != null) {
          const elapsed = Math.round(performance.now() - renderStartRef.current);
          setRenderMs(elapsed);
          setIsRenderComplete(true);
          renderStartRef.current = null;
        }
      });
    }

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isRenderComplete]);

  return { renderMs, startRenderTimer, isRenderComplete };
}
