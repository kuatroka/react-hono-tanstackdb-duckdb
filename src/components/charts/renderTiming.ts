interface RenderStartRef {
  current: number | null;
}

interface DeferredRenderCompletionOptions {
  renderStartRef: RenderStartRef;
  onRenderComplete?: (renderMs: number) => void;
}

export function createDeferredRenderCompletion({
  renderStartRef,
  onRenderComplete,
}: DeferredRenderCompletionOptions) {
  let rafId: number | null = null;
  let completed = false;

  const schedule = () => {
    if (completed || rafId != null || renderStartRef.current == null || !onRenderComplete) {
      return;
    }

    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (completed || renderStartRef.current == null || !onRenderComplete) {
        return;
      }

      completed = true;
      const elapsed = Math.round(performance.now() - renderStartRef.current);
      onRenderComplete(elapsed);
      renderStartRef.current = null;
    });
  };

  const cancel = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return { schedule, cancel };
}
