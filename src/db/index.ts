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

export const DISCOVERY_STATEMENTS = [
  `DO $$ BEGIN
    CREATE TYPE "public"."discovery_job_status" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    CREATE TYPE "public"."discovered_device_type" AS ENUM('SWITCH', 'ROUTER', 'ACCESS_POINT', 'WORKSTATION', 'PHONE_VOIP', 'PRINTER', 'SERVER', 'UNMANAGED_SWITCH', 'UNKNOWN');
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    CREATE TYPE "public"."connection_type" AS ENUM('LLDP_BACKBONE', 'CDP_BACKBONE', 'FDB_ACCESS', 'VOIP_CASCADED', 'WIFI_CLIENT', 'CLOUD_MANAGED', 'MANUAL_OVERRIDE');
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
    CREATE TYPE "public"."drift_status" AS ENUM('SYNCED', 'NEW_DEVICE', 'PORT_MIGRATED', 'NEW_CONNECTION', 'DEVICE_OFFLINE', 'IP_CONFLICT');
  EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "discovery_jobs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "subnet_cidr" varchar(50) NOT NULL,
    "snmp_version" varchar(10) DEFAULT 'v2c' NOT NULL,
    "status" "discovery_job_status" DEFAULT 'PENDING' NOT NULL,
    "current_pass" integer DEFAULT 1 NOT NULL,
    "total_passes" integer DEFAULT 4 NOT NULL,
    "devices_discovered_count" integer DEFAULT 0 NOT NULL,
    "connections_discovered_count" integer DEFAULT 0 NOT NULL,
    "diffs_count" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone,
    "error" varchar(500),
    "options" jsonb DEFAULT '{}'::jsonb
  );`,
  `CREATE TABLE IF NOT EXISTS "discovered_devices" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_id" uuid NOT NULL REFERENCES "discovery_jobs"("id") ON DELETE CASCADE,
    "ip_address" varchar(45) NOT NULL,
    "mac_address" varchar(17) NOT NULL,
    "hostname" varchar(150),
    "manufacturer" varchar(100),
    "model" varchar(100),
    "device_type" "discovered_device_type" DEFAULT 'UNKNOWN' NOT NULL,
    "sys_descr" varchar(500),
    "os_version" varchar(100),
    "vlan_id" integer,
    "is_managed_switch" boolean DEFAULT false NOT NULL,
    "matched_node_id" uuid REFERENCES "nodes"("id") ON DELETE SET NULL,
    "is_manual_override" boolean DEFAULT false NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb
  );`,
  `CREATE TABLE IF NOT EXISTS "discovered_connections" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_id" uuid NOT NULL REFERENCES "discovery_jobs"("id") ON DELETE CASCADE,
    "source_device_id" uuid NOT NULL REFERENCES "discovered_devices"("id") ON DELETE CASCADE,
    "source_port_name" varchar(50) NOT NULL,
    "target_device_id" uuid NOT NULL REFERENCES "discovered_devices"("id") ON DELETE CASCADE,
    "target_port_name" varchar(50),
    "connection_type" "connection_type" NOT NULL,
    "vlan_id" integer,
    "confidence_score" integer DEFAULT 100 NOT NULL,
    "drift_status" "drift_status" DEFAULT 'SYNCED' NOT NULL,
    "drift_details" varchar(300),
    "matched_cable_id" uuid REFERENCES "cables"("id") ON DELETE SET NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "discovery_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_id" uuid NOT NULL REFERENCES "discovery_jobs"("id") ON DELETE CASCADE,
    "level" varchar(10) DEFAULT 'INFO' NOT NULL,
    "pass" integer,
    "message" varchar(500) NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "discovered_devices_job_mac_idx" ON "discovered_devices" USING btree ("job_id","mac_address");`,
];

async function applyDrizzleMigrations(
  executeSql: (sql: string) => Promise<unknown>
): Promise<void> {
  const drizzleDir = path.resolve(process.cwd(), "drizzle");
  if (!fs.existsSync(drizzleDir)) return;
  const files = fs
    .readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const filePath = path.join(drizzleDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await executeSql(stmt).catch(() => {});
    }
  }
}

let activeDb: Database | null = null;
let initPromise: Promise<Database> | null = null;
let activePostgresClient: ReturnType<typeof postgres> | null = null;
let activePgliteClient: PGlite | null = null;

export const queryClient = {
  end: async () => {
    if (activePostgresClient) {
      await activePostgresClient.end();
    }
  },
};

export async function ensureDiscoveryTables(): Promise<void> {
  await getDb();
  if (activePostgresClient) {
    for (const stmt of DISCOVERY_STATEMENTS) {
      await activePostgresClient.unsafe(stmt).catch(() => {});
    }
  } else if (activePgliteClient) {
    for (const stmt of DISCOVERY_STATEMENTS) {
      await activePgliteClient.exec(stmt).catch(() => {});
    }
  }
}

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

        // Application des migrations Drizzle sur le moteur PostgreSQL connecté
        await applyDrizzleMigrations((sql) => client.unsafe(sql));

        // Migration défensive pour garantir la présence des colonnes metadata
        await client`ALTER TABLE floors ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`.catch(
          () => {}
        );
        await client`ALTER TABLE racks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`.catch(
          () => {}
        );
        await client`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`.catch(
          () => {}
        );

        // Initialisation défensive des tables de découverte
        for (const stmt of DISCOVERY_STATEMENTS) {
          await client.unsafe(stmt).catch(() => {});
        }

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
    activePgliteClient = pgliteClient;

    // Application des migrations Drizzle sur PGlite
    await applyDrizzleMigrations((sql) => pgliteClient.exec(sql));

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

    // Initialisation défensive des tables de découverte réseau (Discovery Pipeline)
    for (const stmt of DISCOVERY_STATEMENTS) {
      await pgliteClient.exec(stmt).catch(() => {});
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
