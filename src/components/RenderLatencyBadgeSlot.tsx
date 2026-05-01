import { memo } from "react";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import {
  type NumberMetricStore,
  useNumberMetricSnapshot,
} from "@/lib/perf/metric-store";

export const RenderLatencyBadgeSlot = memo(function RenderLatencyBadgeSlot({
  dataLoadMs,
  renderMsStore,
  source,
}: {
  dataLoadMs?: number;
  renderMsStore: NumberMetricStore;
  source: DataFlow;
}) {
  const renderMs = useNumberMetricSnapshot(renderMsStore);

  return (
    <LatencyBadge
      dataLoadMs={dataLoadMs}
      renderMs={renderMs ?? undefined}
      source={source}
      variant="inline"
    />
  );
});
