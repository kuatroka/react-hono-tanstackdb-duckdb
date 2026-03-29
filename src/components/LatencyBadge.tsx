import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Data flow types showing the full path: [Framework] → [Storage/Source]
 * 
 * TanStack DB flows:
 * - "tsdb-indexeddb": TanStack DB collection loaded from IndexedDB (persisted)
 * - "tsdb-memory": TanStack DB collection in-memory only (not persisted)
 * - "tsdb-api": TanStack DB collection fetched from API (DuckDB)
 * 
 * React Query flows:
 * - "rq-memory": React Query cache hit (in-memory)
 * - "rq-api": React Query fetched from API (DuckDB)
 * 
 * Legacy (for backwards compatibility):
 * - "memory", "indexeddb", "api", "unknown"
 */
export type DataFlow = 
  | "tsdb-indexeddb"  // TanStack DB ↔ IndexedDB
  | "tsdb-memory"     // TanStack DB ↔ in-memory
  | "tsdb-api"        // TanStack DB ↔ DuckDB API
  | "rq-memory"       // React Query ↔ in-memory cache
  | "rq-api"          // React Query ↔ DuckDB API
  | "memory"          // Legacy: generic memory
  | "indexeddb"       // Legacy: generic IndexedDB
  | "api"             // Legacy: generic API
  | "unknown";

// Keep old type for backwards compatibility
export type LatencySource = DataFlow;

export interface LatencyBadgeProps {
  /** @deprecated Use dataLoadMs instead */
  latencyMs?: number | null;
  /** Time to load data from source (IndexedDB, API, or memory) */
  dataLoadMs?: number | null;
  /** Time to render the component after data is ready */
  renderMs?: number | null;
  source?: DataFlow;
  className?: string;
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

function labelForSource(source: DataFlow): string {
  switch (source) {
    case "tsdb-indexeddb":
      return "TanStack DB → IndexedDB";
    case "tsdb-memory":
      return "TanStack DB → memory";
    case "tsdb-api":
      return "TanStack DB → API";
    case "rq-memory":
      return "React Query → cache";
    case "rq-api":
      return "React Query → API";
    case "memory":
      return "memory";
    case "indexeddb":
      return "IndexedDB";
    case "api":
      return "API";
    default:
      return "unknown";
  }
}

function getSourceCategory(source: DataFlow): "local" | "cache" | "api" | "unknown" {
  switch (source) {
    case "tsdb-indexeddb":
    case "indexeddb":
      return "local";
    case "tsdb-memory":
    case "rq-memory":
    case "memory":
      return "cache";
    case "tsdb-api":
    case "rq-api":
    case "api":
      return "api";
    default:
      return "unknown";
  }
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
  const category = getSourceCategory(source);

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
  dataLoadMs, 
  renderMs, 
  source = "unknown", 
  className,
  variant = "inline",
}: LatencyBadgeProps) {
  // Backward compatibility: if latencyMs is provided but dataLoadMs is not, use latencyMs as dataLoadMs
  const resolvedDataLoadMs = dataLoadMs ?? latencyMs;
  
  // If no timing data at all, return null
  if ((resolvedDataLoadMs == null || Number.isNaN(resolvedDataLoadMs)) && 
      (renderMs == null || Number.isNaN(renderMs))) {
    return null;
  }

  // If only data load time is provided (legacy mode), render single badge
  if ((renderMs == null || Number.isNaN(renderMs)) && resolvedDataLoadMs != null) {
    return (
      <SingleLatencyBadge 
        latencyMs={resolvedDataLoadMs} 
        source={source} 
        label={labelForSource(source)}
        className={className} 
      />
    );
  }

  // Split variant: two separate badges
  if (variant === "split") {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        {resolvedDataLoadMs != null && !Number.isNaN(resolvedDataLoadMs) && (
          <SingleLatencyBadge 
            latencyMs={resolvedDataLoadMs} 
            source={source} 
            label="data"
          />
        )}
        {renderMs != null && !Number.isNaN(renderMs) && (
          <SingleLatencyBadge 
            latencyMs={renderMs} 
            source="tsdb-memory"
            label="render"
          />
        )}
      </div>
    );
  }

  // Inline variant (default): single badge with both timings
  const totalMs = (resolvedDataLoadMs ?? 0) + (renderMs ?? 0);
  const tone = getLatencyTone(totalMs);
  const category = getSourceCategory(source);

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
      <span className={cn("opacity-90", sourceClasses)}>{labelForSource(source)}</span>
    </Badge>
  );
}
