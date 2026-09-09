import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";
import dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgrespassword@localhost:5432/netfloor";

export const queryClient = postgres(connectionString, { max: 10 });
export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
