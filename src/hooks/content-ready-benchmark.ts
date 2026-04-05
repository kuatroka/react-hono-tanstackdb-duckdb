export const CONTENT_READY_EVENT_NAME = 'fintellectus:content-ready';

export interface ContentReadyBenchmarkState {
  count: number;
  isReady: boolean;
  lastReadyAt: number;
  path: string;
}

declare global {
  interface Window {
    __FINTELLECTUS_CONTENT_READY__?: ContentReadyBenchmarkState;
  }
}

export function publishContentReadyBenchmarkSignal(nextCount: number): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const readyAt =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  const state: ContentReadyBenchmarkState = {
    count: nextCount,
    isReady: true,
    lastReadyAt: readyAt,
    path: window.location.pathname + window.location.search,
  };

  window.__FINTELLECTUS_CONTENT_READY__ = state;

  document.documentElement.dataset.contentReady = 'true';
  document.documentElement.dataset.contentReadyCount = String(nextCount);
  document.documentElement.dataset.contentReadyPath = state.path;

  document.dispatchEvent(new CustomEvent(CONTENT_READY_EVENT_NAME, { detail: state }));
}
