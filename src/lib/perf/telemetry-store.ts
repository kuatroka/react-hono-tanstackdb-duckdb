import { useSyncExternalStore } from "react";
import type { PerfTelemetry } from "@/lib/perf/telemetry";

export interface PerfTelemetryStore {
  getSnapshot: () => PerfTelemetry | null;
  getServerSnapshot: () => PerfTelemetry | null;
  set: (next: PerfTelemetry | null) => void;
  subscribe: (listener: () => void) => () => void;
}

function areTelemetrySnapshotsEqual(
  left: PerfTelemetry | null,
  right: PerfTelemetry | null,
) {
  if (left === right) return true;
  if (!left || !right) return false;

  return left.source === right.source
    && left.label === right.label
    && left.ms === right.ms
    && left.primaryLine === right.primaryLine
    && left.secondaryLine === right.secondaryLine;
}

export function createPerfTelemetryStore(): PerfTelemetryStore {
  let current: PerfTelemetry | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => current,
    getServerSnapshot: () => null,
    set: (next) => {
      if (areTelemetrySnapshotsEqual(current, next)) {
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

export function usePerfTelemetrySnapshot(store: PerfTelemetryStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
