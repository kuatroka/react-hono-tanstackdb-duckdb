type ReactScanRuntimeOptions = {
  hostname?: string;
  importMetaEnvDev?: boolean;
  reactScanDisabled?: boolean;
};

const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function shouldEnableReactScan(options: ReactScanRuntimeOptions = {}) {
  if (options.reactScanDisabled) {
    return false;
  }

  if (options.importMetaEnvDev === true) {
    return true;
  }

  return options.hostname != null && LOCAL_DEV_HOSTS.has(options.hostname);
}
