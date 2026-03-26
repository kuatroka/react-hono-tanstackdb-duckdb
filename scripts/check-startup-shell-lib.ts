export type StartupShellProbe = {
  result: {
    url: string;
    root: {
      visibility: string;
      display: string;
      opacity: string;
      width: number;
      height: number;
    } | null;
    assets: {
      visibility: string;
      display: string;
      opacity: string;
      width: number;
      height: number;
    } | null;
    navVisible: boolean;
    textSnippet: string;
    hasMeaningfulText: boolean;
  };
  consoleErrors: string[];
  pageErrors: string[];
};

const BLOCKING_ERROR_PATTERNS = [
  /relation\s+"zero_0\/cvr\.instances"\s+does not exist/i,
  /Internal:\s+relation\s+"zero_0\/cvr\.instances"\s+does not exist/i,
];

const ASSETS_NOT_READY_PATTERNS = [
  /No results found/i,
  /Showing 1-10 of 32000 row\(s\)/i,
];

export function assessStartupShell(probe: StartupShellProbe) {
  const shellVisible = Boolean(
    probe.result.root &&
      probe.result.root.visibility !== "hidden" &&
      probe.result.navVisible &&
      probe.result.hasMeaningfulText,
  );

  const blockingErrors = [...probe.consoleErrors, ...probe.pageErrors].filter((error) =>
    BLOCKING_ERROR_PATTERNS.some((pattern) => pattern.test(error)),
  );

  if (probe.result.url.includes("/assets")) {
    const assetsNotReady = ASSETS_NOT_READY_PATTERNS.every((pattern) =>
      pattern.test(probe.result.textSnippet),
    );
    if (assetsNotReady) {
      blockingErrors.push("UI rendered before synced asset rows arrived");
    }
  }

  return {
    pass: shellVisible && blockingErrors.length === 0,
    blockingErrors,
  };
}
