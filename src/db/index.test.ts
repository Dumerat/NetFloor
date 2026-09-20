import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

const databaseModule = await import("./index");
const { db, getDb, queryClient } = databaseModule;

describe("client de base de données", () => {
  it("bascule vers PGlite si PostgreSQL n'est pas joignable", async () => {
    const executeBeforeReady = db.execute;
    const instance = await getDb();

    expect(instance).toBeDefined();
    expect(await getDb()).toBe(instance);
    await expect(executeBeforeReady(sql`SELECT 1 AS connected`)).resolves.toBeDefined();
    await expect(db.execute(sql`SELECT 1 AS connected`)).resolves.toBeDefined();
  }, 15000);
});

afterAll(async () => {
  await queryClient.end();
});
