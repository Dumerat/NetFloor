import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema/index";
import dotenv from "dotenv";
import net from "net";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgrespassword@localhost:5432/netfloor";

export type Database = PostgresJsDatabase<typeof schema> | PgliteDatabase<typeof schema>;

function checkTcpPort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

let activeDb: Database | null = null;
let initPromise: Promise<Database> | null = null;
let activePostgresClient: ReturnType<typeof postgres> | null = null;

export const queryClient = {
  end: async () => {
    if (activePostgresClient) {
      await activePostgresClient.end();
    }
  },
};

export async function getDb(): Promise<Database> {
  if (activeDb) return activeDb;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let host = "localhost";
    let port = 5432;

    try {
      const parsed = new URL(connectionString);
      host = parsed.hostname || "localhost";
      port = Number(parsed.port) || 5432;
    } catch {
      // Format alternatif ou fallback
    }

    const isPostgresReachable = await checkTcpPort(host, port);
    if (isPostgresReachable) {
      try {
        const client = postgres(connectionString, { max: 10, timeout: 2 });
        activePostgresClient = client;
        await client`ALTER TABLE floors ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`.catch(
          () => {}
        );
        await client`ALTER TABLE racks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`.catch(
          () => {}
        );
        await client`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`.catch(
          () => {}
        );
        const pgDb = drizzlePostgres(client, { schema });
        activeDb = pgDb;
        return activeDb;
      } catch (err) {
        console.warn("Connexion PostgreSQL échouée, activation du moteur PGlite :", err);
      }
    }

    // Bascule automatique sur le moteur PostgreSQL 16 WASM PGlite avec stockage local persistant
    const dataDir = path.resolve(process.cwd(), ".pgdata");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const pgliteClient = new PGlite(dataDir);
    const migrationPath = path.resolve(process.cwd(), "drizzle", "0000_conscious_naoko.sql");
    if (fs.existsSync(migrationPath)) {
      const migrationRaw = fs.readFileSync(migrationPath, "utf-8");
      const statements = migrationRaw
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        await pgliteClient.exec(stmt).catch(() => {});
      }
      // Migration défensive pour garantir la présence des colonnes metadata
      await pgliteClient
        .exec("ALTER TABLE floors ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;")
        .catch(() => {});
      await pgliteClient
        .exec("ALTER TABLE racks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;")
        .catch(() => {});
      await pgliteClient
        .exec("ALTER TABLE nodes ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;")
        .catch(() => {});
    }

    activeDb = drizzlePglite(pgliteClient, { schema });
    return activeDb;
  })();

  return initPromise;
}

// Initialisation asynchrone non-bloquante au chargement du module
getDb().catch((err) => {
  console.error("Erreur initialisation base de données :", err);
});

// Proxy Drizzle pour compatibilité descendante immédiate
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    if (!activeDb) {
      // Si la requête survient dans les premières millisecondes avant la fin du ping TCP
      return (...args: unknown[]) => {
        return getDb().then((instance) => {
          const fn = (instance as unknown as Record<string, (...a: unknown[]) => unknown>)[
            prop as string
          ];
          if (typeof fn === "function") {
            return fn.apply(instance, args);
          }
          return (instance as unknown as Record<string, unknown>)[prop as string];
        });
      };
    }
    const val = (activeDb as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === "function") {
      return (val as (...args: unknown[]) => unknown).bind(activeDb);
    }
    return val;
  },
});
