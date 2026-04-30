import { useSyncExternalStore } from "react";

export interface NumberMetricStore {
  getSnapshot: () => number | null;
  getServerSnapshot: () => number | null;
  set: (next: number | null) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createNumberMetricStore(): NumberMetricStore {
  let current: number | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => current,
    getServerSnapshot: () => null,
    set: (next) => {
      if (Object.is(current, next)) {
        return;
      }

      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useNumberMetricSnapshot(store: NumberMetricStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
