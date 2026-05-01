type FeatureFlagName =
  | 'analyticsTelemetry'
  | 'sentryErrorTracking'
  | 'agentSafeRollouts'

const DEFAULT_FLAGS: Record<FeatureFlagName, boolean> = {
  analyticsTelemetry: true,
  sentryErrorTracking: true,
  agentSafeRollouts: false,
}

function readEnvFlag(name: FeatureFlagName): boolean | null {
  const envName = `VITE_FLAG_${name.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase()}`
  const value = import.meta.env?.[envName]
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  const envValue = readEnvFlag(name)
  if (envValue != null) return envValue

  try {
    const override = globalThis.localStorage?.getItem(`feature:${name}`)
    if (override === 'true') return true
    if (override === 'false') return false
  } catch {
    // localStorage may be unavailable in SSR/tests.
  }

  return DEFAULT_FLAGS[name]
}

export function setLocalFeatureOverride(name: FeatureFlagName, enabled: boolean): void {
  globalThis.localStorage?.setItem(`feature:${name}`, String(enabled))
}
