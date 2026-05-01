import type { MiddlewareHandler } from 'hono'

const REQUEST_ID_HEADER = 'x-request-id'
const TRACEPARENT_HEADER = 'traceparent'

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export const requestTracingMiddleware: MiddlewareHandler = async (c, next) => {
  const incomingRequestId = c.req.header(REQUEST_ID_HEADER)
  const incomingTraceparent = c.req.header(TRACEPARENT_HEADER)
  const requestId = incomingRequestId?.trim() || createRequestId()

  await next()

  c.header(REQUEST_ID_HEADER, requestId)
  if (incomingTraceparent) {
    c.header(TRACEPARENT_HEADER, incomingTraceparent)
  }
}
