CREATE TYPE "public"."connection_type" AS ENUM('LLDP_BACKBONE', 'CDP_BACKBONE', 'FDB_ACCESS', 'VOIP_CASCADED', 'WIFI_CLIENT', 'CLOUD_MANAGED', 'MANUAL_OVERRIDE');--> statement-breakpoint
CREATE TYPE "public"."discovered_device_type" AS ENUM('SWITCH', 'ROUTER', 'ACCESS_POINT', 'WORKSTATION', 'PHONE_VOIP', 'PRINTER', 'SERVER', 'UNMANAGED_SWITCH', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."discovery_job_status" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."drift_status" AS ENUM('SYNCED', 'NEW_DEVICE', 'PORT_MIGRATED', 'NEW_CONNECTION', 'DEVICE_OFFLINE', 'IP_CONFLICT');--> statement-breakpoint
CREATE TABLE "discovered_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"source_device_id" uuid NOT NULL,
	"source_port_name" varchar(50) NOT NULL,
	"target_device_id" uuid NOT NULL,
	"target_port_name" varchar(50),
	"connection_type" "connection_type" NOT NULL,
	"vlan_id" integer,
	"confidence_score" integer DEFAULT 100 NOT NULL,
	"drift_status" "drift_status" DEFAULT 'SYNCED' NOT NULL,
	"drift_details" varchar(300),
	"matched_cable_id" uuid,
	"is_locked" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
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
	"matched_node_id" uuid,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "discovery_jobs" (
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
);
--> statement-breakpoint
CREATE TABLE "discovery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"level" varchar(10) DEFAULT 'INFO' NOT NULL,
	"pass" integer,
	"message" varchar(500) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "racks" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "discovered_connections" ADD CONSTRAINT "discovered_connections_job_id_discovery_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_connections" ADD CONSTRAINT "discovered_connections_source_device_id_discovered_devices_id_fk" FOREIGN KEY ("source_device_id") REFERENCES "public"."discovered_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_connections" ADD CONSTRAINT "discovered_connections_target_device_id_discovered_devices_id_fk" FOREIGN KEY ("target_device_id") REFERENCES "public"."discovered_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_connections" ADD CONSTRAINT "discovered_connections_matched_cable_id_cables_id_fk" FOREIGN KEY ("matched_cable_id") REFERENCES "public"."cables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_devices" ADD CONSTRAINT "discovered_devices_job_id_discovery_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_devices" ADD CONSTRAINT "discovered_devices_matched_node_id_nodes_id_fk" FOREIGN KEY ("matched_node_id") REFERENCES "public"."nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_logs" ADD CONSTRAINT "discovery_logs_job_id_discovery_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discovered_devices_job_mac_idx" ON "discovered_devices" USING btree ("job_id","mac_address");