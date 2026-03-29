import { escapeLike, syncedQuery } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../schema";

export const queries = {
  listUsers: syncedQuery("users.list", z.tuple([]), () =>
    builder.user.orderBy("name", "asc")
  ),
  listMediums: syncedQuery("mediums.list", z.tuple([]), () =>
    builder.medium.orderBy("name", "asc")
  ),
  messagesFeed: syncedQuery(
    "messages.feed",
    z.tuple([z.string().nullable(), z.string().max(500)]),
    (senderId, rawSearch) => {
      const search = rawSearch.trim();
      let query = builder.message
        .related("medium")
        .related("sender")
        .orderBy("timestamp", "desc");

      if (senderId) {
        query = query.where("senderID", "=", senderId);
      }

      if (search) {
        query = query.where("body", "LIKE", `%${escapeLike(search)}%`);
      }

      return query;
    }
  ),
  entitiesByCategory: syncedQuery(
    "entities.byCategory",
    z.tuple([
      z.enum(["all", "investor", "asset"]),
      z.number().int().positive().max(1000),
    ]),
    (category, limit) => {
      const base = builder.entities.orderBy("name", "asc");
      if (category === "all") {
        return base.limit(limit);
      }
      return base.where("category", "=", category).limit(limit);
    }
  ),
  entityById: syncedQuery(
    "entities.byId",
    z.tuple([z.string().min(1)]),
    (entityId) => builder.entities.where("id", "=", entityId).limit(1)
  ),
  searchEntities: syncedQuery(
    "entities.search",
    z.tuple([z.string(), z.number().int().min(0).max(50)]),
    (rawSearch, limit) => {
      const search = rawSearch.trim();
      const base = builder.entities.orderBy("created_at", "desc");
      if (!search) {
        return base.limit(limit);
      }
      return base
        .where("name", "ILIKE", `%${escapeLike(search)}%`)
        .limit(limit);
    }
  ),
  recentEntities: syncedQuery(
    "entities.recent",
    z.tuple([z.number().int().positive().max(500)]),
    (limit) => builder.entities.orderBy("created_at", "desc").limit(limit)
  ),
  counterCurrent: syncedQuery(
    "counter.current",
    z.tuple([z.string()]),
    (id) => builder.counters.where("id", "=", id).limit(1)
  ),
  quartersSeries: syncedQuery(
    "quarters.series",
    z.tuple([]),
    () => builder.value_quarters.orderBy("quarter", "asc")
  ),
  userCounter: syncedQuery(
    "user_counter.current",
    z.tuple([z.string()]),
    (userId) => builder.user_counters.where("userId", "=", userId).limit(1)
  ),
  searchesByName: syncedQuery(
    "searches.byName",
    z.tuple([z.string(), z.number().int().min(0).max(100)]),
    (rawSearch, limit) => {
      const search = rawSearch.trim();
      const base = builder.searches.orderBy("name", "asc");
      if (!search) {
        return base.limit(limit);
      }
      const pattern = `%${escapeLike(search)}%`;
      return base
        .where("name", "ILIKE", pattern)
        .limit(limit);
    }
  ),

  // Separate query for code matches - prioritized in search
  searchesByCode: syncedQuery(
    "searches.byCodePattern",
    z.tuple([z.string(), z.number().int().min(0).max(100)]),
    (rawSearch, limit) => {
      const search = rawSearch.trim();
      const base = builder.searches.orderBy("code", "asc");
      if (!search) {
        return base.limit(limit);
      }
      const pattern = `%${escapeLike(search)}%`;
      return base
        .where("code", "ILIKE", pattern)
        .limit(limit);
    }
  ),
  searchesByCategory: syncedQuery(
    "searches.byCategory",
    z.tuple([z.string(), z.string(), z.number().int().min(0).max(50000)]),
    (category, rawSearch, limit) => {
      const search = rawSearch.trim();
      const base = builder.searches
        .where("category", "=", category)
        .orderBy("name", "asc");

      if (!search) {
        return base.limit(limit);
      }
      const pattern = `%${escapeLike(search)}%`;
      return base
        .where(({ or, cmp }) =>
          or(
            cmp("name", "ILIKE", pattern),
            cmp("code", "ILIKE", pattern)
          )
        )
        .limit(limit);
    }
  ),
  searchById: syncedQuery(
    "searches.byId",
    z.tuple([z.number().int()]),
    (id) => builder.searches.where("id", "=", id).limit(1)
  ),
  searchByCode: syncedQuery(
    "searches.byCode",
    z.tuple([z.string().min(1)]),
    (code) => builder.searches.where("code", "=", code).limit(1)
  ),

  assetsPage: syncedQuery(
    "assets.page",
    z.tuple([z.number().int().min(1).max(50000), z.number().int().min(0)]),
    (limit, _offset) => {
      void _offset;
      return builder.assets
        .orderBy("assetName", "asc")
        .limit(limit);
    }
  ),
  assetBySymbol: syncedQuery(
    "assets.bySymbol",
    z.tuple([z.string().min(1)]),
    (symbol) =>
      builder.assets.where("asset", "=", symbol).limit(1)
  ),

  superinvestorsPage: syncedQuery(
    "superinvestors.page",
    z.tuple([z.number().int().min(1).max(50000), z.number().int().min(0)]),
    (limit, _offset) => {
      void _offset;
      return builder.superinvestors
        .orderBy("cikName", "asc")
        .limit(limit);
    }
  ),

  superinvestorByCik: syncedQuery(
    "superinvestors.byCik",
    z.tuple([z.string().min(1)]),
    (cik) => builder.superinvestors.where("cik", "=", cik).limit(1)
  ),

  assetByCusip: syncedQuery(
    "assets.byCusip",
    z.tuple([z.string().min(1)]),
    (cusip) =>
      builder.assets.where("cusip", "=", cusip).limit(1)
  ),

  assetBySymbolAndCusip: syncedQuery(
    "assets.bySymbolAndCusip",
    z.tuple([z.string().min(1), z.string().min(1)]),
    (symbol, cusip) =>
      builder.assets
        .where("asset", "=", symbol)
        .where("cusip", "=", cusip)
        .limit(1)
  ),
} as const;

type QueryMap = typeof queries;
export type SyncedQueryName = QueryMap[keyof QueryMap]["queryName"];
