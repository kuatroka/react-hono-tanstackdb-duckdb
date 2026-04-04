export const PERSISTENCE_ARCHITECTURES = [
  "baseline",
  "sqlite-idb",
  "sqlite-opfs",
] as const;

export type PersistenceArchitecture =
  (typeof PERSISTENCE_ARCHITECTURES)[number];

export const DEFAULT_PERSISTENCE_ARCHITECTURE: PersistenceArchitecture =
  "baseline";

export const PERSISTENCE_ARCHITECTURE_QUERY_PARAM = "persistence";
export const PERSISTENCE_ARCHITECTURE_STORAGE_KEY =
  "benchmark:persistence-architecture";

const PERSISTENCE_ARCHITECTURE_LABELS: Record<
  PersistenceArchitecture,
  string
> = {
  baseline: "TanStack DB + Dexie/IndexedDB",
  "sqlite-idb": "TanStack DB + SQLite WASM (IndexedDB VFS)",
  "sqlite-opfs": "SQLite WASM + OPFS worker",
};

export function normalizePersistenceArchitecture(
  value: string | null | undefined,
): PersistenceArchitecture | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (
    PERSISTENCE_ARCHITECTURES.find(
      (candidate) => candidate === normalized,
    ) ?? null
  );
}

export function getPersistenceArchitectureLabel(
  value: PersistenceArchitecture,
): string {
  return PERSISTENCE_ARCHITECTURE_LABELS[value];
}

export function resolvePersistenceArchitecture(options?: {
  search?: string;
  storageValue?: string | null;
  fallback?: PersistenceArchitecture;
}): PersistenceArchitecture {
  const {
    search,
    storageValue,
    fallback = DEFAULT_PERSISTENCE_ARCHITECTURE,
  } = options ?? {};

  const fromSearch = normalizePersistenceArchitecture(
    search
      ? new URLSearchParams(search).get(PERSISTENCE_ARCHITECTURE_QUERY_PARAM)
      : null,
  );
  if (fromSearch) return fromSearch;

  const fromStorage = normalizePersistenceArchitecture(storageValue);
  if (fromStorage) return fromStorage;

  return fallback;
}

export function readPersistenceArchitectureFromBrowser(): PersistenceArchitecture {
  if (typeof window === "undefined") {
    return DEFAULT_PERSISTENCE_ARCHITECTURE;
  }

  return readPersistenceArchitectureFromWindow(window);
}

export function persistPersistenceArchitecture(
  value: PersistenceArchitecture,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PERSISTENCE_ARCHITECTURE_STORAGE_KEY, value);
}

export function readPersistenceArchitectureFromWindow(
  target: Pick<Window, "location" | "localStorage">,
): PersistenceArchitecture {
  return resolvePersistenceArchitecture({
    search: target.location.search,
    storageValue: target.localStorage.getItem(
      PERSISTENCE_ARCHITECTURE_STORAGE_KEY,
    ),
  });
}

export function applyPersistenceArchitectureRuntime(
  target: Window,
  options: {
    requested: PersistenceArchitecture;
    active?: PersistenceArchitecture;
  },
): void {
  const active = options.active ?? options.requested;

  target.localStorage.setItem(
    PERSISTENCE_ARCHITECTURE_STORAGE_KEY,
    options.requested,
  );
  target.__APP_REQUESTED_PERSISTENCE_ARCHITECTURE__ = options.requested;
  target.__APP_PERSISTENCE_ARCHITECTURE__ = active;
  target.document.documentElement.dataset.requestedPersistenceArchitecture =
    options.requested;
  target.document.documentElement.dataset.requestedPersistenceArchitectureLabel =
    getPersistenceArchitectureLabel(options.requested);
  target.document.documentElement.dataset.persistenceArchitecture = active;
  target.document.documentElement.dataset.persistenceArchitectureLabel =
    getPersistenceArchitectureLabel(active);
}

declare global {
  interface Window {
    __APP_PERSISTENCE_ARCHITECTURE__?: PersistenceArchitecture;
    __APP_REQUESTED_PERSISTENCE_ARCHITECTURE__?: PersistenceArchitecture;
  }
}
