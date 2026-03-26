import { describe, expect, test } from "bun:test";
import { assessStartupShell } from "./check-startup-shell-lib";

describe("assessStartupShell", () => {
  test("fails when Zero reports missing internal cvr tables even if UI shell is visible", () => {
    const assessment = assessStartupShell({
      result: {
        url: "http://localhost:3001/assets",
        root: {
          visibility: "visible",
          display: "block",
          opacity: "1",
          width: 1280,
          height: 500,
        },
        assets: {
          visibility: "visible",
          display: "block",
          opacity: "1",
          width: 60,
          height: 24,
        },
        navVisible: true,
        textSnippet: "Assets Browse and search all assets",
        hasMeaningfulText: true,
      },
      consoleErrors: [
        'clientID=x Internal: relation "zero_0/cvr.instances" does not exist',
      ],
      pageErrors: [],
    });

    expect(assessment.pass).toBe(false);
    expect(assessment.blockingErrors).toContain(
      'clientID=x Internal: relation "zero_0/cvr.instances" does not exist',
    );
  });

  test("fails when the assets page shell is visible but synced data has not arrived yet", () => {
    const assessment = assessStartupShell({
      result: {
        url: "http://localhost:3001/assets",
        root: {
          visibility: "visible",
          display: "block",
          opacity: "1",
          width: 1280,
          height: 500,
        },
        assets: {
          visibility: "visible",
          display: "block",
          opacity: "1",
          width: 60,
          height: 24,
        },
        navVisible: true,
        textSnippet: "Assets Browse and search all assets No results found Showing 1-10 of 32000 row(s)",
        hasMeaningfulText: true,
      },
      consoleErrors: [],
      pageErrors: [],
    });

    expect(assessment.pass).toBe(false);
    expect(assessment.blockingErrors).toContain("UI rendered before synced asset rows arrived");
  });

  test("passes when the shell is visible and there are no blocking runtime errors", () => {
    const assessment = assessStartupShell({
      result: {
        url: "http://localhost:3001/assets",
        root: {
          visibility: "visible",
          display: "block",
          opacity: "1",
          width: 1280,
          height: 500,
        },
        assets: {
          visibility: "visible",
          display: "block",
          opacity: "1",
          width: 60,
          height: 24,
        },
        navVisible: true,
        textSnippet: "Assets Browse and search all assets AAPL Apple Inc.",
        hasMeaningfulText: true,
      },
      consoleErrors: [],
      pageErrors: [],
    });

    expect(assessment.pass).toBe(true);
    expect(assessment.blockingErrors).toEqual([]);
  });
});
