export type DiscoveredDeviceType =
  | "SWITCH"
  | "ROUTER"
  | "ACCESS_POINT"
  | "WORKSTATION"
  | "PHONE_VOIP"
  | "PRINTER"
  | "SERVER"
  | "UNMANAGED_SWITCH"
  | "UNKNOWN";

export type ConnectionType =
  | "LLDP_BACKBONE"
  | "CDP_BACKBONE"
  | "FDB_ACCESS"
  | "VOIP_CASCADED"
  | "WIFI_CLIENT"
  | "CLOUD_MANAGED"
  | "MANUAL_OVERRIDE";

export type DriftStatus =
  "SYNCED" | "NEW_DEVICE" | "PORT_MIGRATED" | "NEW_CONNECTION" | "DEVICE_OFFLINE" | "IP_CONFLICT";

export interface ScanOptions {
  subnetCidr: string; // e.g. "192.168.1.0/24"
  snmpVersion?: "v1" | "v2c" | "v3" | undefined;
  snmpCommunity?: string | undefined;
  snmpPort?: number | undefined;
  v3User?: string | undefined;
  v3AuthPass?: string | undefined;
  v3PrivPass?: string | undefined;
  pingTimeoutMs?: number | undefined;
  concurrency?: number | undefined;
  includeCloud?: boolean | undefined;
}

export interface RawHostProbe {
  ip: string;
  mac?: string | undefined;
  hostname?: string | undefined;
  isAlive: boolean;
  responseTimeMs: number;
  openPorts: number[];
  vendor?: string | undefined;
  source: "ARP_LOCAL" | "ARP_GATEWAY" | "TCP_PROBE" | "ICMP";
}

export interface LldpNeighbor {
  localPortIndex: number;
  localPortName: string;
  remoteChassisId: string;
  remotePortId: string;
  remoteSysName: string;
  remoteSysDescr?: string | undefined;
  remoteMgmtIp?: string | undefined;
}

export interface CdpNeighbor {
  localPortName: string;
  remoteDeviceId: string;
  remoteDevicePort: string;
  remotePlatform?: string | undefined;
  remoteMgmtIp?: string | undefined;
}

export interface FdbEntry {
  macAddress: string;
  bridgePort: number;
  ifIndex: number;
  portName: string;
  vlanId?: number | undefined;
  status: "learned" | "mgmt" | "other";
}

export interface SwitchPortInfo {
  ifIndex: number;
  portName: string; // e.g. "Gi1/0/1"
  portDescription?: string | undefined;
  speedMbps: number;
  isUp: boolean;
  isUplink: boolean;
  vlanId?: number | undefined;
  fdbMacs: string[];
}

export interface DiscoveredSwitch {
  id: string;
  ip: string;
  mac: string;
  sysName: string;
  sysDescr: string;
  sysOid: string;
  vendor: string;
  model: string;
  ports: SwitchPortInfo[];
  lldpNeighbors: LldpNeighbor[];
  cdpNeighbors: CdpNeighbor[];
  fdbEntries: FdbEntry[];
}

export interface TopologyLink {
  id: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  sourcePortName: string;
  targetDeviceId: string;
  targetDeviceName: string;
  targetPortName?: string | undefined;
  connectionType: ConnectionType;
  vlanId?: number | undefined;
  confidenceScore: number; // 0 to 100
  details?: string | undefined;
}

export interface TopologyDiffItem {
  id: string;
  type: DriftStatus;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description: string;
  deviceIp: string;
  deviceMac: string;
  proposedAction:
    "CREATE_NODE" | "MOVE_CABLE" | "CREATE_CABLE" | "MARK_OFFLINE" | "RESOLVE_CONFLICT";
  payload: {
    deviceId?: string | undefined;
    nodeId?: string | undefined;
    switchId?: string | undefined;
    switchPort?: string | undefined;
    oldSwitchPort?: string | undefined;
    cableId?: string | undefined;
    vlanId?: number | undefined;
    deviceType?: DiscoveredDeviceType | undefined;
  };
}

export interface DiscoveryJobProgress {
  jobId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  currentPass: number;
  totalPasses: number;
  passName: string;
  devicesDiscoveredCount: number;
  connectionsDiscoveredCount: number;
  diffsCount: number;
  startedAt: string;
  completedAt?: string | undefined;
  error?: string | undefined;
  logs: Array<{
    level: "INFO" | "WARN" | "ERROR";
    pass?: number | undefined;
    message: string;
    timestamp: string;
  }>;
}
