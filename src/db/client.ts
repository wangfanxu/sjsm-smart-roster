import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a database connection");
  }

  const client = postgres(connectionString, { max: 10, prepare: false });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}
