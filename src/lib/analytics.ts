import { isFeatureEnabled } from './feature-flags'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function loadScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return
  const script = document.createElement('script')
  script.async = true
  script.src = src
  document.head.appendChild(script)
}

export function initializeProductAnalytics() {
  const measurementId = import.meta.env?.VITE_GA_MEASUREMENT_ID
  if (!measurementId || !isFeatureEnabled('analyticsTelemetry')) return

  window.dataLayer = window.dataLayer ?? []
  window.gtag = (...args: unknown[]) => window.dataLayer?.push(args)
  window.gtag('js', new Date())
  window.gtag('config', measurementId, { anonymize_ip: true })
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`)
}

export function trackProductEvent(name: string, params: Record<string, unknown> = {}) {
  if (!isFeatureEnabled('analyticsTelemetry')) return
  window.gtag?.('event', name, params)
}
