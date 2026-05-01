import { isFeatureEnabled } from './feature-flags'

type SentryClient = {
  init: (options: Record<string, unknown>) => void
  captureException: (error: unknown, context?: Record<string, unknown>) => void
  addBreadcrumb: (breadcrumb: Record<string, unknown>) => void
}

declare global {
  interface Window {
    Sentry?: SentryClient
  }
}

function loadScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return
  const script = document.createElement('script')
  script.crossOrigin = 'anonymous'
  script.src = src
  document.head.appendChild(script)
}

function notifyClientRuntimeError(source: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const release = import.meta.env?.VITE_APP_VERSION ?? undefined
  void fetch('/api/client-errors', {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source,
      message,
      location: globalThis.location?.href,
      release,
    }),
  }).catch(() => undefined)
}

export function initializeErrorTracking() {
  const dsn = import.meta.env?.VITE_SENTRY_DSN
  if (!isFeatureEnabled('sentryErrorTracking')) return

  window.addEventListener('error', (event) => {
    window.Sentry?.captureException(event.error, { tags: { source: 'window.error' } })
    notifyClientRuntimeError('window.error', event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    window.Sentry?.captureException(event.reason, { tags: { source: 'unhandledrejection' } })
    notifyClientRuntimeError('unhandledrejection', event.reason)
  })

  if (!dsn) return

  loadScript('https://browser.sentry-cdn.com/8.55.0/bundle.tracing.min.js')

  const init = () => {
    if (!window.Sentry) return
    window.Sentry.init({
      dsn,
      release: import.meta.env?.VITE_APP_VERSION ?? undefined,
      tracesSampleRate: 0.05,
      sendDefaultPii: false,
    })
    window.Sentry.addBreadcrumb({ category: 'app', message: 'error tracking initialized' })
  }
  setTimeout(init, 0)
}
