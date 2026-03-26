import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import {
  counters,
  entities,
  medium,
  user,
  userCounters,
  valueQuarters,
} from "../src/db/schema";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rand: () => number, min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randFloat(rand: () => number, min: number, max: number) {
  return rand() * (max - min) + min;
}

async function main() {
  const connectionString = process.env.ZERO_UPSTREAM_DB;
  if (!connectionString) {
    throw new Error("ZERO_UPSTREAM_DB environment variable is not set");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  const users = [
    { id: "ycD76wW4R2", name: "Aaron", partner: true },
    { id: "IoQSaxeVO5", name: "Matt", partner: true },
    { id: "WndZWmGkO4", name: "Cesar", partner: true },
    { id: "ENzoNm7g4E", name: "Erik", partner: true },
    { id: "dLKecN3ntd", name: "Greg", partner: true },
    { id: "enVvyDlBul", name: "Darick", partner: true },
    { id: "9ogaDuDNFx", name: "Alex", partner: true },
    { id: "6z7dkeVLNm", name: "Dax", partner: false },
    { id: "7VoEoJWEwn", name: "Nate", partner: false },
  ];

  const mediums = [
    { id: "G14bSFuNDq", name: "Discord" },
    { id: "b7rqt_8w_H", name: "Twitter DM" },
    { id: "0HzSMcee_H", name: "Tweet reply to unrelated thread" },
    { id: "ttx7NCmyac", name: "SMS" },
  ];

  await db
    .insert(user)
    .values(users)
    .onConflictDoNothing({ target: user.id });

  await db
    .insert(medium)
    .values(mediums)
    .onConflictDoNothing({ target: medium.id });

  await db
    .insert(counters)
    .values({ id: "main", value: 0 })
    .onConflictDoNothing({ target: counters.id });

  await db
    .insert(userCounters)
    .values(users.map((u) => ({ userId: u.id, value: 0 })))
    .onConflictDoNothing({ target: userCounters.userId });

  const randQuarters = mulberry32(420);
  const quarters: { quarter: string; value: number }[] = [];
  for (let year = 1999; year <= 2025; year++) {
    for (let q = 1; q <= 4; q++) {
      const quarter = `${year}Q${q}`;
      const value = randFloat(randQuarters, 1.0, 500000000000.0);
      quarters.push({ quarter, value });
    }
  }

  await db
    .insert(valueQuarters)
    .values(quarters)
    .onConflictDoNothing({ target: valueQuarters.quarter });

  const [{ count: entityCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(entities);

  if (Number(entityCount) === 0) {
    const randEntities = mulberry32(420);
    const sectors = [
      "Technology",
      "Healthcare",
      "Finance",
      "Real Estate",
      "Energy",
      "Consumer Goods",
      "Manufacturing",
      "Retail",
      "Transportation",
      "Telecommunications",
    ];
    const types = [
      "Commercial",
      "Residential",
      "Industrial",
      "Digital",
      "Infrastructure",
      "Agricultural",
      "Mixed-Use",
      "Retail",
      "Office",
      "Hospitality",
    ];

    const entityRows: {
      name: string;
      category: "investor" | "asset";
      description: string;
      value: string;
    }[] = [];

    for (let i = 1; i <= 500; i++) {
      const sector = sectors[randInt(randEntities, 0, sectors.length - 1)];
      const companies = randInt(randEntities, 5, 50);
      const value = (1000000 + randEntities() * 499000000).toFixed(2);
      entityRows.push({
        name: `Investor ${i}`,
        category: "investor",
        description: `Investment firm focused on ${sector}. Portfolio includes ${companies} companies with strong growth potential and market leadership.`,
        value,
      });
    }

    for (let i = 1; i <= 500; i++) {
      const type = types[randInt(randEntities, 0, types.length - 1)];
      const sector = sectors[randInt(randEntities, 0, sectors.length - 1)];
      const year = randInt(randEntities, 1990, 2024);
      const value = (100000 + randEntities() * 99900000).toFixed(2);
      entityRows.push({
        name: `Asset ${i}`,
        category: "asset",
        description: `${type} asset in ${sector} sector. Established in ${year} with consistent performance and strong fundamentals.`,
        value,
      });
    }

    const chunkSize = 200;
    for (let i = 0; i < entityRows.length; i += chunkSize) {
      await db.insert(entities).values(entityRows.slice(i, i + chunkSize));
    }
  }

  await client.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
