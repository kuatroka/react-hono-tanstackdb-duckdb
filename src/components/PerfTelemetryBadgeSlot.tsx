import { memo } from "react";
import { LatencyBadge } from "@/components/LatencyBadge";
import {
  type PerfTelemetryStore,
  usePerfTelemetrySnapshot,
} from "@/lib/perf/telemetry-store";

export const PerfTelemetryBadgeSlot = memo(function PerfTelemetryBadgeSlot({
  className,
  store,
}: {
  className?: string;
  store: PerfTelemetryStore;
}) {
  const telemetry = usePerfTelemetrySnapshot(store);

  return telemetry
    ? <LatencyBadge telemetry={telemetry} className={className} />
    : null;
});
