import { Badge } from "@/components/ui/badge";
import {
  formatPerfSourceLabel,
  getPerfSourceCategory,
  toPerfSource,
  type PerfSource,
  type PerfTelemetry,
} from "@/lib/perf/telemetry";
import { cn } from "@/lib/utils";

export type DataFlow = PerfSource;

export type LatencySource = DataFlow;

export interface LatencyBadgeProps {
  /** @deprecated Use ms or dataLoadMs instead */
  latencyMs?: number | null;
  /** Compact shorthand for the primary latency value */
  ms?: number | null;
  /** Time to load data from source (IndexedDB, API, or memory) */
  dataLoadMs?: number | null;
  /** Time to render the component after data is ready */
  renderMs?: number | null;
  source?: DataFlow | string;
  className?: string;
  label?: string;
  telemetry?: PerfTelemetry | null;
  /** Layout variant: "inline" (single line) or "split" (two separate badges) */
  variant?: "inline" | "split";
}

function formatLatency(latencyMs: number) {
  if (latencyMs < 1) return `${latencyMs.toFixed(2)}ms`;
  if (latencyMs < 10) return `${latencyMs.toFixed(1)}ms`;
  return `${Math.round(latencyMs)}ms`;
}

function getLatencyTone(latencyMs: number): "good" | "warn" | "bad" {
  if (latencyMs <= 25) return "good";
  if (latencyMs <= 150) return "warn";
  return "bad";
}


function SingleLatencyBadge({
  latencyMs,
  source = "unknown",
  label,
  className,
}: {
  latencyMs: number;
  source?: DataFlow;
  label?: string;
  className?: string;
}) {
  const tone = getLatencyTone(latencyMs);
  const resolvedSource = toPerfSource(source as string);
  const category = getPerfSourceCategory(resolvedSource);
  const sourceLabel = label ?? formatPerfSourceLabel(resolvedSource);

  const toneClasses =
    tone === "good"
      ? "ring-emerald-500/30 border-emerald-200/50"
      : tone === "warn"
        ? "ring-amber-500/30 border-amber-200/50"
        : "ring-rose-500/30 border-rose-200/50";

  // Color by category: local (violet), cache (emerald), api (sky)
  const sourceClasses =
    category === "local"
      ? "text-violet-700 dark:text-violet-400"
      : category === "cache"
        ? "text-emerald-700 dark:text-emerald-400"
        : category === "api"
          ? "text-sky-700 dark:text-sky-400"
          : "text-muted-foreground";

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] px-1.5 py-0.5 font-medium border bg-transparent inline-flex items-center gap-1",
        "ring-1",
        toneClasses,
        sourceClasses,
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        <span className="opacity-90">{sourceLabel}:</span>
        <span>{formatLatency(latencyMs)}</span>
      </span>
    </Badge>
  );
}

export function LatencyBadge({
  latencyMs,
  ms,
  dataLoadMs,
  renderMs,
  source = "unknown",
  className,
  label,
  telemetry,
  variant = "inline",
}: LatencyBadgeProps) {
  const resolvedDataLoadMs = dataLoadMs ?? ms ?? latencyMs;
  const hasDataLoadMs =
    resolvedDataLoadMs != null && !Number.isNaN(resolvedDataLoadMs);
  const hasRenderMs = renderMs != null && !Number.isNaN(renderMs);
  const resolvedSource = toPerfSource(source as string);

  if (telemetry) {
    const { ms: resolvedMs, primaryLine, secondaryLine } = telemetry;

    return (
      <Badge
        variant="outline"
        className={cn(
          "font-mono font-medium text-[11px] leading-none px-2 py-1 min-w-0 max-w-full shrink-0 whitespace-nowrap bg-transparent inline-flex items-center gap-1 overflow-hidden",
          className,
        )}
        title={resolvedMs == null ? primaryLine : `${primaryLine} (${resolvedMs.toFixed(2)}ms)`}
      >
        <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
          <span>{primaryLine}</span>
        </span>
        {secondaryLine ? (
          <>
            <span className="opacity-40 text-muted-foreground">|</span>
            <span className="inline-flex items-center gap-1 text-[goldenrod]">
              <span>{secondaryLine}</span>
            </span>
          </>
        ) : null}
      </Badge>
    );
  }

  if (!hasDataLoadMs && !hasRenderMs) {
    return null;
  }

  if (variant === "inline" && hasRenderMs) {
    const totalMs = (resolvedDataLoadMs ?? 0) + (renderMs ?? 0);
    const tone = getLatencyTone(totalMs);

    const toneClasses =
      tone === "good"
        ? "ring-emerald-500/30 border-emerald-200/50"
        : tone === "warn"
          ? "ring-amber-500/30 border-amber-200/50"
          : "ring-rose-500/30 border-rose-200/50";

    const hydrationSourceLabel = formatPerfSourceLabel(resolvedSource);

    return (
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] px-1.5 py-0.5 font-medium border bg-transparent inline-flex min-w-0 max-w-full items-center gap-1 overflow-hidden",
          "ring-1",
          toneClasses,
          className,
        )}
      >
        <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
          <span className="opacity-90">{hydrationSourceLabel}:</span>
          <span>{resolvedDataLoadMs != null ? formatLatency(resolvedDataLoadMs) : "—"}</span>
        </span>
        <span className="opacity-40 text-muted-foreground">|</span>
        <span
          data-latency-part="render"
          className="inline-flex items-center gap-1 text-[goldenrod]"
        >
          <span className="opacity-90">render:</span>
          <span>{renderMs != null ? formatLatency(renderMs) : "—"}</span>
        </span>
      </Badge>
    );
  }

  if (variant === "split") {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        {hasDataLoadMs ? (
          <SingleLatencyBadge
            latencyMs={resolvedDataLoadMs}
            source={resolvedSource}
            label={label}
          />
        ) : null}
        {hasRenderMs ? (
          <SingleLatencyBadge
            latencyMs={renderMs}
            source="tsdb-memory"
            label="render"
          />
        ) : null}
      </div>
    );
  }

  if (hasDataLoadMs) {
    return (
      <SingleLatencyBadge
        latencyMs={resolvedDataLoadMs}
        source={resolvedSource}
        label={label}
        className={className}
      />
    );
  }

  return null;
}
