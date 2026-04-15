import { zeroPostgresJS } from "@rocicorp/zero/server/adapters/postgresjs";
import postgres from "postgres";
import { schema } from "../src/schema.ts";

const sql = postgres("postgres://user:password@localhost:5432/postgres");
const db = zeroPostgresJS(sql, schema);
console.log(Object.getPrototypeOf(db));
console.log(db);
