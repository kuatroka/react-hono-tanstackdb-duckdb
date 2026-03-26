import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  decimal,
  doublePrecision,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    partner: boolean("partner").notNull(),
  },
  (table) => [index("idx_user_name").on(table.name, table.id)]
);

export const medium = pgTable(
  "medium",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
  },
  (table) => [index("idx_medium_name").on(table.name, table.id)]
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    senderId: text("sender_id").references(() => user.id),
    mediumId: text("medium_id").references(() => medium.id),
    body: text("body").notNull(),
    labels: text("labels").array().notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (table) => [index("idx_message_timestamp").on(table.timestamp, table.id)]
);

export const counters = pgTable(
  "counters",
  {
    id: text("id").primaryKey(),
    value: doublePrecision("value").notNull(),
  },
  (table) => [index("idx_counters_id").on(table.id)]
);

export const valueQuarters = pgTable(
  "value_quarters",
  {
    quarter: text("quarter").primaryKey(),
    value: doublePrecision("value").notNull(),
  },
  (table) => [index("idx_value_quarters_quarter").on(table.quarter)]
);

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    description: text("description"),
    value: decimal("value", { precision: 15, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    check("category_check", sql`${table.category} IN ('investor', 'asset')`),
    index("idx_entities_category").on(table.category),
    index("idx_entities_name").on(table.name),
  ]
);

export const userCounters = pgTable(
  "user_counters",
  {
    userId: text("user_id").primaryKey(),
    value: doublePrecision("value").notNull().default(0),
  },
  (table) => [index("idx_user_counters_user_id").on(table.userId)]
);

export const searches = pgTable(
  "searches",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    code: text("code").notNull(),
    name: text("name"),
    category: text("category").notNull(),
    cusip: text("cusip"),
  },
  (table) => [
    check(
      "searches_category_check",
      sql`${table.category} IN ('superinvestors', 'assets', 'periods')`
    ),
    index("idx_searches_category").on(table.category),
    index("idx_searches_code").on(table.code),
    index("idx_searches_name").on(table.name),
  ]
);

export const superinvestors = pgTable(
  "superinvestors",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    cik: text("cik").notNull(),
    cikName: text("cik_name"),
    cikTicker: text("cik_ticker"),
    activePeriods: text("active_periods"),
  },
  (table) => [index("idx_superinvestors_cik_name").on(table.cikName, table.id)]
);

export const assets = pgTable(
  "assets",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    asset: text("asset").notNull(),
    assetName: text("asset_name"),
    cusip: text("cusip"),
  },
  (table) => [
    index("idx_assets_asset").on(table.asset),
    index("idx_assets_asset_name").on(table.assetName, table.id),
    index("idx_assets_cusip").on(table.cusip),
  ]
);

export const periods = pgTable("periods", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  period: text("period").notNull().unique(),
});

export const cusipQuarterInvestorActivity = pgTable(
  "cusip_quarter_investor_activity",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    cusip: varchar("cusip"),
    ticker: varchar("ticker"),
    quarter: varchar("quarter"),
    numOpen: bigint("num_open", { mode: "number" }),
    numAdd: bigint("num_add", { mode: "number" }),
    numReduce: bigint("num_reduce", { mode: "number" }),
    numClose: bigint("num_close", { mode: "number" }),
    numHold: bigint("num_hold", { mode: "number" }),
  },
  (table) => [
    index("idx_cusip_quarter_activity_cusip_quarter").on(table.cusip, table.quarter),
    index("idx_cusip_quarter_activity_ticker_quarter").on(table.ticker, table.quarter),
  ]
);

export const cusipQuarterInvestorActivityDetail = pgTable(
  "cusip_quarter_investor_activity_detail",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    cusip: varchar("cusip"),
    ticker: varchar("ticker"),
    quarter: varchar("quarter"),
    cik: bigint("cik", { mode: "number" }),
    didOpen: boolean("did_open"),
    didAdd: boolean("did_add"),
    didReduce: boolean("did_reduce"),
    didClose: boolean("did_close"),
    didHold: boolean("did_hold"),
  }
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    sharedUserIds: text("shared_user_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_projects_created").on(table.createdAt),
    index("idx_projects_owner").on(table.ownerId),
  ]
);

export const todos = pgTable(
  "todos",
  {
    id: text("id").primaryKey(),
    text: text("text").notNull(),
    completed: boolean("completed").notNull().default(false),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    userIds: text("user_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_todos_completed").on(table.completed),
    index("idx_todos_project").on(table.projectId),
    index("idx_todos_user").on(table.userId),
  ]
);

export const activitySummary = pgTable(
  "activity_summary",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cusip: text("cusip"),
    ticker: text("ticker"),
    quarter: text("quarter").notNull(),
    opened: integer("opened").default(0),
    closed: integer("closed").default(0),
    added: integer("added").default(0),
    reduced: integer("reduced").default(0),
    held: integer("held").default(0),
  },
  (table) => [
    index("idx_activity_summary_cusip").on(table.cusip),
    index("idx_activity_summary_quarter").on(table.quarter),
    index("idx_activity_summary_ticker").on(table.ticker),
  ]
);

export const cikQuarterly = pgTable(
  "cik_quarterly",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cik: text("cik").notNull(),
    quarter: text("quarter").notNull(),
    quarterEndDate: date("quarter_end_date"),
    totalValue: numeric("total_value", { precision: 20, scale: 2 }),
    totalValuePrcChg: numeric("total_value_prc_chg", { precision: 10, scale: 4 }),
    numAssets: integer("num_assets"),
  },
  (table) => [
    index("idx_cik_quarterly_cik").on(table.cik),
    index("idx_cik_quarterly_quarter").on(table.quarter),
  ]
);

export const drilldownActivity = pgTable(
  "drilldown_activity",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cusip: text("cusip").notNull(),
    ticker: text("ticker").notNull(),
    quarter: text("quarter").notNull(),
    cik: text("cik").notNull(),
    cikName: text("cik_name"),
    action: text("action"),
    shares: numeric("shares", { precision: 20, scale: 0 }),
    value: numeric("value", { precision: 20, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("action_check", sql`${table.action} IN ('open', 'add', 'reduce', 'close', 'hold')`),
    index("idx_drilldown_cik").on(table.cik),
    index("idx_drilldown_cusip").on(table.cusip),
    index("idx_drilldown_cusip_quarter").on(table.cusip, table.quarter),
    index("idx_drilldown_quarter").on(table.quarter),
  ]
);

export const investorFlow = pgTable(
  "investor_flow",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ticker: text("ticker").notNull(),
    quarter: text("quarter").notNull(),
    inflow: numeric("inflow", { precision: 20, scale: 2 }),
    outflow: numeric("outflow", { precision: 20, scale: 2 }),
  },
  (table) => [
    index("idx_investor_flow_quarter").on(table.quarter),
    index("idx_investor_flow_ticker").on(table.ticker),
  ]
);
