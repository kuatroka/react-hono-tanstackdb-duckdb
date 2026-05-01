export const DATA_VERSION_STORAGE_KEY = 'app-data-version'

export interface StoredDataVersionState {
  dataVersion: string | null
  lastDataLoadDate: string | null
  checkedAt: number
}

export interface ServerDataVersionPayload {
  lastDataLoadDate?: string | null
  servingManifestVersion?: number | null
  servingManifestActive?: string | null
  servingFileMtimeMs?: number | null
  dataVersion?: string | null
}

export function buildServerDataVersion(payload: ServerDataVersionPayload): string | null {
  if (payload.dataVersion) {
    return payload.dataVersion
  }

  const parts = [
    payload.servingManifestVersion ?? 'nomv',
    payload.servingManifestActive ?? 'noactive',
    payload.servingFileMtimeMs ?? 'nomtime',
    payload.lastDataLoadDate ?? 'noload',
  ]

  return parts.join(':')
}

export function readStoredDataVersionState(): StoredDataVersionState | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(DATA_VERSION_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as StoredDataVersionState
  } catch {
    return null
  }
}

export function getStoredDataVersion(): string | null {
  return readStoredDataVersionState()?.dataVersion ?? null
}

export function setStoredDataVersionState(state: StoredDataVersionState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DATA_VERSION_STORAGE_KEY, JSON.stringify(state))
}

export function setStoredDataVersion(dataVersion: string, lastDataLoadDate: string | null): void {
  setStoredDataVersionState({
    dataVersion,
    lastDataLoadDate,
    checkedAt: Date.now(),
  })
}

export function hasMismatchedStoredDataVersion(
  storedDataVersion: string | null | undefined,
  currentDataVersion: string | null | undefined,
): boolean {
  return Boolean(currentDataVersion) && storedDataVersion !== currentDataVersion
}
