import { describe, expect, test } from "bun:test";
import {
  applyPersistenceArchitectureRuntime,
  DEFAULT_PERSISTENCE_ARCHITECTURE,
  getPersistenceArchitectureLabel,
  normalizePersistenceArchitecture,
  readPersistenceArchitectureFromWindow,
  resolvePersistenceArchitecture,
} from "./architecture";

describe("persistence architecture selection", () => {
  test("normalizes known architecture ids", () => {
    expect(normalizePersistenceArchitecture("baseline")).toBe("baseline");
    expect(normalizePersistenceArchitecture("SQLITE-IDB")).toBe("sqlite-idb");
    expect(normalizePersistenceArchitecture(" sqlite-opfs ")).toBe(
      "sqlite-opfs",
    );
  });

  test("rejects unknown architecture ids", () => {
    expect(normalizePersistenceArchitecture("dexie")).toBeNull();
    expect(normalizePersistenceArchitecture("")).toBeNull();
    expect(normalizePersistenceArchitecture(null)).toBeNull();
  });

  test("prefers URL search params over storage values", () => {
    expect(
      resolvePersistenceArchitecture({
        search: "?persistence=sqlite-opfs",
        storageValue: "sqlite-idb",
      }),
    ).toBe("sqlite-opfs");
  });

  test("uses storage when no URL override exists", () => {
    expect(
      resolvePersistenceArchitecture({
        search: "",
        storageValue: "sqlite-idb",
      }),
    ).toBe("sqlite-idb");
  });

  test("falls back to the baseline architecture", () => {
    expect(
      resolvePersistenceArchitecture({
        search: "?persistence=unknown",
        storageValue: "also-unknown",
      }),
    ).toBe(DEFAULT_PERSISTENCE_ARCHITECTURE);
  });

  test("returns human-readable labels", () => {
    expect(getPersistenceArchitectureLabel("baseline")).toContain("Dexie");
    expect(getPersistenceArchitectureLabel("sqlite-idb")).toContain("SQLite");
    expect(getPersistenceArchitectureLabel("sqlite-opfs")).toContain("OPFS");
  });

  test("reads from a window-like object", () => {
    expect(
      readPersistenceArchitectureFromWindow({
        location: { search: "?persistence=sqlite-idb" } as Location,
        localStorage: {
          getItem: () => "sqlite-opfs",
        } as unknown as Storage,
      }),
    ).toBe("sqlite-idb");
  });

  test("applies runtime markers to window and document", () => {
    const element = { dataset: {} as DOMStringMap };
    const storage = new Map<string, string>();
    const mockWindow = {
      document: {
        documentElement: element,
      },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    } as unknown as Window;

    applyPersistenceArchitectureRuntime(mockWindow, {
      requested: "sqlite-opfs",
      active: "baseline",
    });

    expect(mockWindow.__APP_REQUESTED_PERSISTENCE_ARCHITECTURE__).toBe(
      "sqlite-opfs",
    );
    expect(mockWindow.__APP_PERSISTENCE_ARCHITECTURE__).toBe("baseline");
    expect(storage.get("benchmark:persistence-architecture")).toBe(
      "sqlite-opfs",
    );
    expect(element.dataset.requestedPersistenceArchitecture).toBe(
      "sqlite-opfs",
    );
    expect(element.dataset.persistenceArchitecture).toBe("baseline");
    expect(element.dataset.persistenceArchitectureLabel).toContain("Dexie");
  });
});
