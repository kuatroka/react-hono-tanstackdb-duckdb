import { describe, expect, test } from 'bun:test'
import {
  buildTelegramAlertText,
  notifyWebAppIncident,
  parseTelegramAppriseUrl,
  resolveAlertEnvironment,
  resolveTelegramDestinations,
  splitAlertUrls,
} from './telegram-alerts'

describe('telegram alert helpers', () => {
  test('splits Apprise-style URLs like sec_app', () => {
    expect(splitAlertUrls('tgram://one/chat\ntgram://two/chat,tgram://three/chat;')).toEqual([
      'tgram://one/chat',
      'tgram://two/chat',
      'tgram://three/chat',
    ])
  })

  test('parses Telegram Apprise URLs with bot token and chat id', () => {
    expect(parseTelegramAppriseUrl('tgram://123456:ABCDEF/-100123456')).toEqual({
      token: '123456:ABCDEF',
      chatId: '-100123456',
    })
  })

  test('resolves dev and prod destinations separately', () => {
    const env = {
      WEB_APP_APPRISE_DEV_URLS: 'tgram://dev-token/dev-chat',
      WEB_APP_APPRISE_PROD_URLS: 'tgram://prod-token/prod-chat',
    }

    expect(resolveAlertEnvironment({ WEB_APP_ALERT_ENV: 'production' })).toBe('prod')
    expect(resolveTelegramDestinations('dev', env)).toEqual([
      { token: 'dev-token', chatId: 'dev-chat' },
    ])
    expect(resolveTelegramDestinations('prod', env)).toEqual([
      { token: 'prod-token', chatId: 'prod-chat' },
    ])
  })

  test('scrubs sensitive text before building Telegram messages', () => {
    const text = buildTelegramAlertText(
      {
        category: 'runtime',
        severity: 'error',
        source: 'hono',
        title: 'failure',
        message: 'token=abc123 failed',
        environment: 'prod',
      },
      {},
    )

    expect(text).toContain('token=[redacted]')
    expect(text).not.toContain('abc123')
  })

  test('sends Telegram notification without exposing destination in message body', async () => {
    const requests: Array<{ url: string; body: unknown }> = []
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch

    const sent = await notifyWebAppIncident(
      {
        category: 'deploy',
        severity: 'error',
        source: 'github-actions:Deploy to Production',
        title: 'Deploy to Production failure',
        message: 'Deployment failed',
        environment: 'prod',
      },
      {
        fetchImpl,
        skipRateLimit: true,
        env: {
          WEB_APP_APPRISE_PROD_URLS: 'tgram://bot-token/prod-chat',
        },
      },
    )

    expect(sent).toBe(true)
    expect(requests[0]?.url).toBe('https://api.telegram.org/botbot-token/sendMessage')
    expect(requests[0]?.body).toMatchObject({ chat_id: 'prod-chat' })
    expect(JSON.stringify(requests[0]?.body)).not.toContain('bot-token')
  })

  test('classifies CI alerts separately from deploy alerts', async () => {
    const requests: Array<{ body: unknown }> = []
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push({
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch

    const sent = await notifyWebAppIncident(
      {
        category: 'ci',
        severity: 'error',
        source: 'github-actions:CI',
        title: 'CI failure',
        message: 'CI failed on dependabot/bun/eslint/js-10.0.1',
        environment: 'dev',
      },
      {
        fetchImpl,
        skipRateLimit: true,
        env: {
          WEB_APP_APPRISE_DEV_URLS: 'tgram://bot-token/dev-chat',
          WEB_APP_TELEGRAM_DEPLOY_ALERTS_ENABLED: 'false',
        },
      },
    )

    expect(sent).toBe(true)
    expect(requests[0]?.body).toMatchObject({
      text: expect.stringContaining('Category: ci'),
    })
  })
})
