import type { MiddlewareHandler } from "hono";
import type { DuckDbGenerationManager } from "./generation-manager";
import { duckDbGenerationManager } from "./generation-manager";
import { DUCKDB_LEASE_CONTEXT_KEY } from "./hono-types";

const DB_STATUS_PATH = "/api/db-status";
const LOGIN_PATH = "/api/login";

export function createDuckDbLeaseMiddleware(manager: Pick<DuckDbGenerationManager, "acquireLease">): MiddlewareHandler {
  return async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    if (!pathname.startsWith("/api/") || pathname === DB_STATUS_PATH || pathname === LOGIN_PATH) {
      await next();
      return;
    }

    const lease = await manager.acquireLease();
    c.set(DUCKDB_LEASE_CONTEXT_KEY, lease);

    try {
      await next();
    } finally {
      await lease.close();
    }
  };
}

export const duckDbLeaseMiddleware: MiddlewareHandler = createDuckDbLeaseMiddleware(duckDbGenerationManager);
