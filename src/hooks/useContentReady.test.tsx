import { describe, expect, test } from "bun:test";

describe("useContentReady", () => {
  test("splits state and ready actions into separate contexts so writers do not rerender on visibility changes", async () => {
    const source = await Bun.file(new URL("./useContentReady.tsx", import.meta.url)).text();

    expect(source).toContain("const ContentReadyStateContext = createContext<boolean | null>(null);");
    expect(source).toContain("const ContentReadyActionContext = createContext<(() => void) | null>(null);");
    expect(source).toContain("export function useContentReadyState()");
    expect(source).toContain("export function useMarkContentReady()");
    expect(source).toContain("<ContentReadyActionContext.Provider value={onReady}>");
    expect(source).toContain("<ContentReadyStateContext.Provider value={isReady}>");
  });
});
