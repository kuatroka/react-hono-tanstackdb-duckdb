// Shared constants for the application
export const API_LIMITS = {
  MAX_ASSETS_LIMIT: 50000,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
};

export const ROUTE_PATHS = {
  ASSETS: "/assets",
  DRILLDOWN: "/drilldown",
  DUCKDB_SEARCH: "/duckdb-search",
  DUCKDB_INVESTOR_DRILLDOWN: "/duckdb-investor-drilldown",
  ALL_ASSETS_ACTIVITY: "/all-assets-activity",
  SUPERINVESTORS: "/superinvestors",
  INVESTOR_FLOW: "/investor-flow",
  CIK_QUARTERLY: "/cik-quarterly",
  DATA_FRESHNESS: "/data-freshness",
};

export const ERROR_MESSAGES = {
  ASSETS_QUERY_FAILED: "Assets query failed",
  ASSET_QUERY_FAILED: "Asset query failed",
  DRILLDOWN_QUERY_FAILED: "Drilldown query failed",
  SEARCH_QUERY_FAILED: "Search query failed",
  GENERIC_ERROR: "An unexpected error occurred",
};

export const HTTP_STATUS_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};