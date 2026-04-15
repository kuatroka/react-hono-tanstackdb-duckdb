import { zeroPostgresJS } from "@rocicorp/zero/server/adapters/postgresjs";
import postgres from "postgres";

const sql = postgres("postgres://user:password@localhost:5432/postgres");
const db = zeroPostgresJS(sql);
console.log(db);
