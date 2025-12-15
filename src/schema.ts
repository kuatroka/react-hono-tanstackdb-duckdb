// These data structures define your client-side schema.
// They must be equal to or a subset of the server-side schema.
// Note the "relationships" field, which defines first-class
// relationships between tables.
// See https://github.com/rocicorp/mono/blob/main/apps/zbugs/shared/schema.ts
// for more complex examples, including many-to-many.

import {
  createBuilder,
  createSchema,
  definePermissions,
  ExpressionBuilder,
  Row,
  ANYONE_CAN,
  table,
  string,
  boolean,
  number,
  relationships,
  PermissionsConfig,
  json,
} from "@rocicorp/zero";

const message = table("message")
  .columns({
    id: string(),
    senderID: string().from("sender_id"),
    mediumID: string().from("medium_id"),
    body: string(),
    labels: json<string[]>(),
    timestamp: number(),
  })
  .primaryKey("id");

const user = table("user")
  .columns({
    id: string(),
    name: string(),
    partner: boolean(),
  })
  .primaryKey("id");

const medium = table("medium")
  .columns({
    id: string(),
    name: string(),
  })
  .primaryKey("id");

const counter = table("counters")
  .columns({
    id: string(),
    value: number(),
  })
  .primaryKey("id");

const valueQuarter = table("value_quarters")
  .columns({
    quarter: string(),
    value: number(),
  })
  .primaryKey("quarter");


const entity = table("entities")
  .columns({
    id: string(),
    name: string(),
    category: string(),
    description: string(),
    value: number(),
    created_at: number().from("created_at"),
  })
  .primaryKey("id");

const userCounter = table("user_counters")
  .columns({
    userId: string().from("user_id"),
    value: number(),
  })
  .primaryKey("userId");

const searches = table("searches")
  .columns({
    id: number(),
    code: string(),
    name: string(),
    category: string(),
    cusip: string(),
  })
  .primaryKey("id");

const asset = table("assets")
  .columns({
    id: number(),
    asset: string(),
    assetName: string().from("asset_name"),
    cusip: string(),
  })
  .primaryKey("id");

const superinvestor = table("superinvestors")
  .columns({
    id: number(),
    cik: string(),
    cikName: string().from("cik_name"),
    cikTicker: string().from("cik_ticker"),
    activePeriods: string().from("active_periods"),
  })
  .primaryKey("id");

const cusipQuarterInvestorActivity = table("cusip_quarter_investor_activity")
  .columns({
    id: number(),
    cusip: string(),
    ticker: string(),
    quarter: string(),
    numOpen: number().from("num_open"),
    numAdd: number().from("num_add"),
    numReduce: number().from("num_reduce"),
    numClose: number().from("num_close"),
    numHold: number().from("num_hold"),
  })
  .primaryKey("id");

const cusipQuarterInvestorActivityDetail = table("cusip_quarter_investor_activity_detail")
  .columns({
    id: number(),
    cusip: string(),
    ticker: string(),
    quarter: string(),
    cik: number(),
    didOpen: boolean().from("did_open"),
    didAdd: boolean().from("did_add"),
    didReduce: boolean().from("did_reduce"),
    didClose: boolean().from("did_close"),
    didHold: boolean().from("did_hold"),
  })
  .primaryKey("id");

const messageRelationships = relationships(message, ({ one }) => ({
  sender: one({
    sourceField: ["senderID"],
    destField: ["id"],
    destSchema: user,
  }),
  medium: one({
    sourceField: ["mediumID"],
    destField: ["id"],
    destSchema: medium,
  }),
}));

export const schema = createSchema({
  tables: [user, medium, message, counter, valueQuarter, entity, userCounter, searches, asset, superinvestor, cusipQuarterInvestorActivity, cusipQuarterInvestorActivityDetail],
  relationships: [messageRelationships],
});

export const builder = createBuilder(schema);

export type Schema = typeof schema;
export type Message = Row<typeof schema.tables.message>;
export type Medium = Row<typeof schema.tables.medium>;
export type User = Row<typeof schema.tables.user>;
export type Counter = Row<typeof schema.tables.counters>;
export type ValueQuarter = Row<typeof schema.tables.value_quarters>;
export type Entity = Row<typeof schema.tables.entities>;
export type UserCounter = Row<typeof schema.tables.user_counters>;
export type Search = Row<typeof schema.tables.searches>;
export type Asset = Row<typeof schema.tables.assets>;
export type Superinvestor = Row<typeof schema.tables.superinvestors>;
export type CusipQuarterInvestorActivity = Row<typeof schema.tables.cusip_quarter_investor_activity>;
export type CusipQuarterInvestorActivityDetail = Row<typeof schema.tables.cusip_quarter_investor_activity_detail>;

// The contents of your decoded JWT.
type AuthData = {
  sub: string | null;
};

export const permissions = definePermissions<AuthData, Schema>(schema, () => {
  const allowIfLoggedIn = (
    authData: AuthData,
    { cmpLit }: ExpressionBuilder<Schema, keyof Schema["tables"]>
  ) => cmpLit(authData.sub, "IS NOT", null);

  const allowIfMessageSender = (
    authData: AuthData,
    { cmp }: ExpressionBuilder<Schema, "message">
  ) => cmp("senderID", "=", authData.sub ?? "");

  const allowIfUserCounterOwner = (
    authData: AuthData,
    { cmp }: ExpressionBuilder<Schema, "user_counters">
  ) => cmp("userId", "=", authData.sub ?? "");

  return {
    medium: {
      row: {
        select: ANYONE_CAN,
      },
    },
    user: {
      row: {
        select: ANYONE_CAN,
      },
    },
    message: {
      row: {
        insert: ANYONE_CAN,
        update: {
          preMutation: [allowIfMessageSender],
          postMutation: [allowIfMessageSender],
        },
        delete: [allowIfLoggedIn],
        select: ANYONE_CAN,
      },
    },
    counters: {
      row: {
        select: ANYONE_CAN,
        update: {
          preMutation: ANYONE_CAN,
          postMutation: ANYONE_CAN,
        },
      },
    },
    value_quarters: {
      row: {
        select: ANYONE_CAN,
      },
    },
    entities: {
      row: {
        select: ANYONE_CAN,
      },
    },
    user_counters: {
      row: {
        select: [allowIfUserCounterOwner],
        insert: [allowIfUserCounterOwner],
        update: {
          preMutation: [allowIfUserCounterOwner],
          postMutation: [allowIfUserCounterOwner],
        },
      },
    },
    searches: {
      row: {
        select: ANYONE_CAN,
      },
    },
    assets: {
      row: {
        select: ANYONE_CAN,
      },
    },
    superinvestors: {
      row: {
        select: ANYONE_CAN,
      },
    },
    cusip_quarter_investor_activity: {
      row: {
        select: ANYONE_CAN,
      },
    },
    cusip_quarter_investor_activity_detail: {
      row: {
        select: ANYONE_CAN,
      },
    },
  } satisfies PermissionsConfig<AuthData, Schema>;
});
