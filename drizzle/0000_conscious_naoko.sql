CREATE TYPE "public"."node_type" AS ENUM('WALL_OUTLET', 'PATCH_PANEL', 'SWITCH', 'DESK', 'ACCESS_POINT', 'SERVER');--> statement-breakpoint
CREATE TYPE "public"."connector_type" AS ENUM('RJ45', 'SFP_PLUS', 'FIBER_LC', 'PUNCHDOWN_110');--> statement-breakpoint
CREATE TYPE "public"."port_direction" AS ENUM('FRONT', 'REAR', 'BI');--> statement-breakpoint
CREATE TYPE "public"."port_mode" AS ENUM('ACCESS', 'TRUNK', 'ROUTED', 'PASSIVE', 'DISABLED');--> statement-breakpoint
CREATE TYPE "public"."cable_category" AS ENUM('CAT5E', 'CAT6', 'CAT6A', 'CAT7', 'SM_FIBER_OS2', 'MM_FIBER_OM4', 'DAC');--> statement-breakpoint
CREATE TYPE "public"."cable_status" AS ENUM('ACTIVE', 'DEFECTIVE', 'RESERVED', 'DISCONNECTED');--> statement-breakpoint
CREATE TYPE "public"."cable_type" AS ENUM('HORIZONTAL_RUN', 'PATCH_CORD', 'BACKBONE_TRUNK');--> statement-breakpoint
CREATE TABLE "floors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"building" varchar(100) NOT NULL,
	"floor_number" integer DEFAULT 0 NOT NULL,
	"width_mm" integer NOT NULL,
	"height_mm" integer NOT NULL,
	"scale_ratio" double precision DEFAULT 1 NOT NULL,
	"background_plan_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "racks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"u_height" integer DEFAULT 42 NOT NULL,
	"x_mm" integer DEFAULT 0 NOT NULL,
	"y_mm" integer DEFAULT 0 NOT NULL,
	"width_mm" integer DEFAULT 600 NOT NULL,
	"depth_mm" integer DEFAULT 800 NOT NULL,
	"rotation_deg" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_id" uuid NOT NULL,
	"rack_id" uuid,
	"rack_u_position" integer,
	"type" "node_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"model" varchar(100),
	"x_mm" integer DEFAULT 0 NOT NULL,
	"y_mm" integer DEFAULT 0 NOT NULL,
	"rotation_deg" double precision DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "port_vlans" (
	"port_id" uuid NOT NULL,
	"vlan_id" uuid NOT NULL,
	"tagged" boolean DEFAULT true NOT NULL,
	CONSTRAINT "port_vlans_port_id_vlan_id_pk" PRIMARY KEY("port_id","vlan_id")
);
--> statement-breakpoint
CREATE TABLE "ports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"label" varchar(50) NOT NULL,
	"connector_type" "connector_type" DEFAULT 'RJ45' NOT NULL,
	"direction" "port_direction" DEFAULT 'FRONT' NOT NULL,
	"mode" "port_mode" DEFAULT 'PASSIVE' NOT NULL,
	"native_vlan_id" uuid,
	"internal_peer_port_id" uuid,
	"speed_mbps" integer DEFAULT 1000,
	"poe_enabled" boolean DEFAULT false NOT NULL,
	"poe_standard" varchar(20),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cable_type" "cable_type" NOT NULL,
	"category" "cable_category" DEFAULT 'CAT6A' NOT NULL,
	"source_port_id" uuid NOT NULL,
	"target_port_id" uuid NOT NULL,
	"length_mm" integer DEFAULT 0 NOT NULL,
	"color_code" varchar(20) DEFAULT 'BLUE',
	"status" "cable_status" DEFAULT 'ACTIVE' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cables_no_self_loop" CHECK ("cables"."source_port_id" != "cables"."target_port_id")
);
--> statement-breakpoint
CREATE TABLE "vlans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vid" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"subnet_cidr" varchar(45),
	"gateway_ip" varchar(45),
	"color_hex" varchar(7) DEFAULT '#3b82f6' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vlans_vid_unique" UNIQUE("vid")
);
--> statement-breakpoint
ALTER TABLE "racks" ADD CONSTRAINT "racks_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_rack_id_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."racks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_vlans" ADD CONSTRAINT "port_vlans_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_vlans" ADD CONSTRAINT "port_vlans_vlan_id_vlans_id_fk" FOREIGN KEY ("vlan_id") REFERENCES "public"."vlans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ports" ADD CONSTRAINT "ports_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ports" ADD CONSTRAINT "ports_native_vlan_id_vlans_id_fk" FOREIGN KEY ("native_vlan_id") REFERENCES "public"."vlans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ports" ADD CONSTRAINT "ports_internal_peer_port_id_ports_id_fk" FOREIGN KEY ("internal_peer_port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cables" ADD CONSTRAINT "cables_source_port_id_ports_id_fk" FOREIGN KEY ("source_port_id") REFERENCES "public"."ports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cables" ADD CONSTRAINT "cables_target_port_id_ports_id_fk" FOREIGN KEY ("target_port_id") REFERENCES "public"."ports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ports_node_label_direction_idx" ON "ports" USING btree ("node_id","label","direction");--> statement-breakpoint
CREATE UNIQUE INDEX "cables_source_port_idx" ON "cables" USING btree ("source_port_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cables_target_port_idx" ON "cables" USING btree ("target_port_id");