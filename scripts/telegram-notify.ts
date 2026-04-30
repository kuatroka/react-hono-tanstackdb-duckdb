import { notifyWebAppIncident, resolveAlertEnvironment } from '../api/telegram-alerts'

const environment = resolveAlertEnvironment(process.env)
const workflowName = process.env.WEB_APP_ALERT_WORKFLOW ?? process.env.GITHUB_WORKFLOW ?? 'workflow'
const conclusion = process.env.WEB_APP_ALERT_CONCLUSION ?? 'failure'
const runUrl = process.env.WEB_APP_ALERT_RUN_URL ?? ''
const commit = process.env.WEB_APP_ALERT_COMMIT ?? process.env.GITHUB_SHA ?? undefined

const sent = await notifyWebAppIncident(
  {
    category: 'deploy',
    severity: conclusion === 'success' ? 'info' : 'error',
    source: `github-actions:${workflowName}`,
    title: `${workflowName} ${conclusion}`,
    message:
      process.env.WEB_APP_ALERT_MESSAGE ??
      `GitHub Actions workflow ${workflowName} completed with ${conclusion}.`,
    environment,
    workflowRunUrl: runUrl || undefined,
    commit,
  },
  { skipRateLimit: true },
)

console.log(sent ? 'Telegram alert sent.' : 'Telegram alert skipped: no destination configured.')
