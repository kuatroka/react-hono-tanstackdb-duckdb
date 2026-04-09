import { Badge } from "@/components/ui/badge";
import {
  createLegacyPerfTelemetry,
  formatPerfSourceLabel,
  getPerfSourceCategory,
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
  className 
}: { 
  latencyMs: number; 
  source?: DataFlow; 
  label?: string;
  className?: string;
}) {
  const tone = getLatencyTone(latencyMs);
  const category = getPerfSourceCategory(source);

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
        className
      )}
    >
      <span>{formatLatency(latencyMs)}</span>
      {label && <span className="opacity-90">({label})</span>}
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
  const hasDataLoadMs = resolvedDataLoadMs != null && !Number.isNaN(resolvedDataLoadMs);
  const hasRenderMs = renderMs != null && !Number.isNaN(renderMs);

  if (telemetry) {
    const { ms: resolvedMs, primaryLine, secondaryLine } = telemetry;

    return (
      <Badge
        variant="secondary"
        className={cn(
          "font-mono font-medium text-[11px] leading-none px-2 py-1 shrink-0 whitespace-nowrap",
          secondaryLine ? "flex flex-col items-start gap-0.5 py-1.5 leading-tight whitespace-nowrap" : undefined,
          className,
        )}
        title={resolvedMs == null ? primaryLine : `${primaryLine} (${resolvedMs.toFixed(2)}ms)`}
      >
        <span>{primaryLine}</span>
        {secondaryLine ? <span>{secondaryLine}</span> : null}
      </Badge>
    );
  }

  if (!hasDataLoadMs && !hasRenderMs) {
    return null;
  }

  if (variant === "inline" && hasRenderMs) {
    const totalMs = (resolvedDataLoadMs ?? 0) + (renderMs ?? 0);
    const tone = getLatencyTone(totalMs);
    const category = getPerfSourceCategory(source as DataFlow);

    const toneClasses =
      tone === "good"
        ? "ring-emerald-500/30 border-emerald-200/50"
        : tone === "warn"
          ? "ring-amber-500/30 border-amber-200/50"
          : "ring-rose-500/30 border-rose-200/50";

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
          className
        )}
      >
        <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
          <span className="opacity-90">data:</span>
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
        <span className="opacity-40 text-muted-foreground">|</span>
        <span className={cn("opacity-90", sourceClasses)}>{formatPerfSourceLabel(source as DataFlow)}</span>
      </Badge>
    );
  }

  if (variant === "split") {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        {hasDataLoadMs ? (
          <SingleLatencyBadge
            latencyMs={resolvedDataLoadMs}
            source={source as DataFlow}
            label={label ?? "data"}
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

  return (
    <LatencyBadge
      telemetry={createLegacyPerfTelemetry({
        label,
        ms: resolvedDataLoadMs,
        renderMs,
        source,
      })}
      className={className}
    />
  );
}
