type AlertEnvironment = 'dev' | 'prod'
type AlertCategory = 'runtime' | 'deploy'
type AlertSeverity = 'info' | 'warning' | 'error'

type TelegramDestination = {
  token: string
  chatId: string
}

type IncidentEnv = Partial<
  Record<
    | 'WEB_APP_APPRISE_URLS'
    | 'WEB_APP_APPRISE_DEV_URLS'
    | 'WEB_APP_APPRISE_PROD_URLS'
    | 'WEB_APP_ALERT_ENV'
    | 'WEB_APP_TELEGRAM_ALERTS_ENABLED'
    | 'WEB_APP_TELEGRAM_RUNTIME_ALERTS_ENABLED'
    | 'WEB_APP_TELEGRAM_DEPLOY_ALERTS_ENABLED'
    | 'NODE_ENV'
    | 'APP_ENV'
    | 'APP_GIT_COMMIT'
    | 'APP_PROD_TAG'
    | 'APP_VERSION',
    string
  >
>

export type WebAppIncident = {
  category: AlertCategory
  severity: AlertSeverity
  source: string
  title: string
  message: string
  environment?: AlertEnvironment
  path?: string
  method?: string
  requestId?: string
  workflowRunUrl?: string
  commit?: string
}

type NotifyOptions = {
  env?: IncidentEnv
  fetchImpl?: typeof fetch
  skipRateLimit?: boolean
}

const recentIncidents = new Map<string, number>()
const rateLimitMs = 5 * 60 * 1000
const sensitiveTextPattern =
  /(authorization|cookie|token|secret|password|jwt|api[-_]?key)=?[^\s,;]*/gi

export function splitAlertUrls(rawValue: string | undefined): string[] {
  if (!rawValue) return []
  return rawValue
    .replace(/\r/g, '\n')
    .replace(/[,;]/g, '\n')
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function resolveAlertEnvironment(env: IncidentEnv = process.env): AlertEnvironment {
  const explicit = env.WEB_APP_ALERT_ENV ?? env.APP_ENV
  if (explicit === 'prod' || explicit === 'production') return 'prod'
  if (explicit === 'dev' || explicit === 'development') return 'dev'
  return env.NODE_ENV === 'production' ? 'prod' : 'dev'
}

export function parseTelegramAppriseUrl(url: string): TelegramDestination | null {
  if (!url.startsWith('tgram://') && !url.startsWith('telegram://')) return null

  const withoutScheme = url.replace(/^(tgram|telegram):\/\//, '')
  const slashIndex = withoutScheme.indexOf('/')
  if (slashIndex <= 0) return null

  const token = decodeURIComponent(withoutScheme.slice(0, slashIndex))
  const chatId = decodeURIComponent(withoutScheme.slice(slashIndex + 1).split(/[?#]/)[0] ?? '')
  if (!token || !chatId) return null
  return { token, chatId }
}

export function resolveTelegramDestinations(
  environment: AlertEnvironment,
  env: IncidentEnv = process.env,
): TelegramDestination[] {
  const environmentSpecific =
    environment === 'prod' ? env.WEB_APP_APPRISE_PROD_URLS : env.WEB_APP_APPRISE_DEV_URLS
  return [...splitAlertUrls(environmentSpecific), ...splitAlertUrls(env.WEB_APP_APPRISE_URLS)]
    .map(parseTelegramAppriseUrl)
    .filter((destination): destination is TelegramDestination => destination !== null)
}

function isEnabled(value: string | undefined) {
  return value !== 'false' && value !== '0'
}

function isAlertEnabled(category: AlertCategory, env: IncidentEnv) {
  if (!isEnabled(env.WEB_APP_TELEGRAM_ALERTS_ENABLED)) return false
  if (category === 'runtime') return isEnabled(env.WEB_APP_TELEGRAM_RUNTIME_ALERTS_ENABLED)
  return isEnabled(env.WEB_APP_TELEGRAM_DEPLOY_ALERTS_ENABLED)
}

function scrubText(text: string) {
  return text.replace(sensitiveTextPattern, '$1=[redacted]').slice(0, 1200)
}

function incidentFingerprint(incident: WebAppIncident) {
  return [
    incident.category,
    incident.source,
    incident.title,
    incident.message.split('\n')[0],
    incident.path ?? '',
  ].join('|')
}

function shouldRateLimit(incident: WebAppIncident) {
  const fingerprint = incidentFingerprint(incident)
  const now = Date.now()
  const lastSeen = recentIncidents.get(fingerprint)
  if (lastSeen && now - lastSeen < rateLimitMs) return true
  recentIncidents.set(fingerprint, now)
  return false
}

export function buildTelegramAlertText(incident: WebAppIncident, env: IncidentEnv = process.env) {
  const environment = incident.environment ?? resolveAlertEnvironment(env)
  const lines = [
    `[${environment}] ${incident.severity.toUpperCase()}: ${incident.title}`,
    `Source: ${incident.source}`,
    `Category: ${incident.category}`,
    `Message: ${scrubText(incident.message)}`,
  ]

  if (incident.method || incident.path) {
    lines.push(`Route: ${[incident.method, incident.path].filter(Boolean).join(' ')}`)
  }
  if (incident.requestId) lines.push(`Request: ${incident.requestId}`)
  if (incident.workflowRunUrl) lines.push(`Workflow: ${incident.workflowRunUrl}`)
  lines.push(
    `Commit: ${incident.commit ?? env.APP_GIT_COMMIT ?? env.APP_PROD_TAG ?? env.APP_VERSION ?? 'unknown'}`,
  )

  return lines.join('\n').slice(0, 3900)
}

async function sendTelegramMessage(
  destination: TelegramDestination,
  text: string,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(`https://api.telegram.org/bot${destination.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: destination.chatId,
      text,
      disable_web_page_preview: true,
    }),
  })
  return response.ok
}

export async function notifyWebAppIncident(incident: WebAppIncident, options: NotifyOptions = {}) {
  const env = options.env ?? process.env
  if (!isAlertEnabled(incident.category, env)) return false
  if (!options.skipRateLimit && shouldRateLimit(incident)) return false

  const environment = incident.environment ?? resolveAlertEnvironment(env)
  const destinations = resolveTelegramDestinations(environment, env)
  if (destinations.length === 0) return false

  const text = buildTelegramAlertText({ ...incident, environment }, env)
  const fetchImpl = options.fetchImpl ?? fetch
  const results = await Promise.allSettled(
    destinations.map((destination) => sendTelegramMessage(destination, text, fetchImpl)),
  )
  return results.some((result) => result.status === 'fulfilled' && result.value)
}
