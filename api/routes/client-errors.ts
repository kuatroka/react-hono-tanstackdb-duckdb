import { Hono } from 'hono'
import { notifyWebAppIncident } from '../telegram-alerts'

const clientErrorRoutes = new Hono()

function asString(value: unknown, fallback = 'unknown'): string
function asString(value: unknown, fallback: undefined): string | undefined
function asString(value: unknown, fallback: string | undefined = 'unknown') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safePath(value: unknown) {
  const raw = asString(value, '')
  if (!raw) return undefined
  try {
    return new URL(raw, 'http://localhost').pathname.slice(0, 240)
  } catch {
    return raw.split('?')[0]?.slice(0, 240)
  }
}

clientErrorRoutes.post('/', async (c) => {
  const payload = await c.req.json().catch(() => ({}))
  const message = asString(payload.message, 'Browser error reported without a message')
  const source = asString(payload.source, 'browser')
  const path = safePath(payload.location)

  await notifyWebAppIncident({
    category: 'runtime',
    severity: 'error',
    source,
    title: 'Browser runtime error',
    message,
    path,
    commit: asString(payload.release, undefined),
  }).catch((error) => {
    console.warn('[Alerts] failed to send browser runtime alert', error)
  })

  return c.json({ ok: true })
})

export default clientErrorRoutes
