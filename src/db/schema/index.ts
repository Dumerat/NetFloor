import { relations } from "drizzle-orm";
import { floors } from "./floors";
import { racks } from "./racks";
import { nodes } from "./nodes";
import { ports, portVlans } from "./ports";
import { cables } from "./cables";
import { vlans } from "./vlans";
import {
  discoveryJobs,
  discoveredDevices,
  discoveredConnections,
  discoveryLogs,
} from "./discovery";

// Export tables and enums
export * from "./floors";
export * from "./racks";
export * from "./nodes";
export * from "./ports";
export * from "./cables";
export * from "./vlans";
export * from "./discovery";

// Relations
export const floorsRelations = relations(floors, ({ many }) => ({
  nodes: many(nodes),
  racks: many(racks),
}));

export const racksRelations = relations(racks, ({ one, many }) => ({
  floor: one(floors, {
    fields: [racks.floorId],
    references: [floors.id],
  }),
  nodes: many(nodes),
}));

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  floor: one(floors, {
    fields: [nodes.floorId],
    references: [floors.id],
  }),
  rack: one(racks, {
    fields: [nodes.rackId],
    references: [racks.id],
  }),
  ports: many(ports),
}));

export const portsRelations = relations(ports, ({ one, many }) => ({
  node: one(nodes, {
    fields: [ports.nodeId],
    references: [nodes.id],
  }),
  nativeVlan: one(vlans, {
    fields: [ports.nativeVlanId],
    references: [vlans.id],
  }),
  internalPeerPort: one(ports, {
    fields: [ports.internalPeerPortId],
    references: [ports.id],
    relationName: "internal_peer",
  }),
  outgoingCable: one(cables, {
    fields: [ports.id],
    references: [cables.sourcePortId],
    relationName: "cable_source",
  }),
  incomingCable: one(cables, {
    fields: [ports.id],
    references: [cables.targetPortId],
    relationName: "cable_target",
  }),
  portVlans: many(portVlans),
}));

export const cablesRelations = relations(cables, ({ one }) => ({
  sourcePort: one(ports, {
    fields: [cables.sourcePortId],
    references: [ports.id],
    relationName: "cable_source",
  }),
  targetPort: one(ports, {
    fields: [cables.targetPortId],
    references: [ports.id],
    relationName: "cable_target",
  }),
}));

export const vlansRelations = relations(vlans, ({ many }) => ({
  nativePorts: many(ports),
  portVlans: many(portVlans),
}));

export const portVlansRelations = relations(portVlans, ({ one }) => ({
  port: one(ports, {
    fields: [portVlans.portId],
    references: [ports.id],
  }),
  vlan: one(vlans, {
    fields: [portVlans.vlanId],
    references: [vlans.id],
  }),
}));

export const discoveryJobsRelations = relations(discoveryJobs, ({ many }) => ({
  devices: many(discoveredDevices),
  connections: many(discoveredConnections),
  logs: many(discoveryLogs),
}));

export const discoveredDevicesRelations = relations(discoveredDevices, ({ one, many }) => ({
  job: one(discoveryJobs, {
    fields: [discoveredDevices.jobId],
    references: [discoveryJobs.id],
  }),
  matchedNode: one(nodes, {
    fields: [discoveredDevices.matchedNodeId],
    references: [nodes.id],
  }),
  outboundConnections: many(discoveredConnections, { relationName: "source_device" }),
  inboundConnections: many(discoveredConnections, { relationName: "target_device" }),
}));

export const discoveredConnectionsRelations = relations(discoveredConnections, ({ one }) => ({
  job: one(discoveryJobs, {
    fields: [discoveredConnections.jobId],
    references: [discoveryJobs.id],
  }),
  sourceDevice: one(discoveredDevices, {
    fields: [discoveredConnections.sourceDeviceId],
    references: [discoveredDevices.id],
    relationName: "source_device",
  }),
  targetDevice: one(discoveredDevices, {
    fields: [discoveredConnections.targetDeviceId],
    references: [discoveredDevices.id],
    relationName: "target_device",
  }),
  matchedCable: one(cables, {
    fields: [discoveredConnections.matchedCableId],
    references: [cables.id],
  }),
}));

export const discoveryLogsRelations = relations(discoveryLogs, ({ one }) => ({
  job: one(discoveryJobs, {
    fields: [discoveryLogs.jobId],
    references: [discoveryJobs.id],
  }),
}));
