export interface SsoSettings {
  provider: "ENTRA_ID" | "OKTA" | "GOOGLE_WORKSPACE" | "SAML_GENERIC";
  tenantId: string;
  clientId: string;
  clientSecret: string;
  corporateDomain: string;
  syncEnabled: boolean;
  lastSyncIso: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  tokenExpiryIso: string;
}

export interface SnmpSettings {
  version: "v2c" | "v3";
  targetSubnet: string;
  community: string;
  v3User: string;
  v3AuthProtocol: "SHA" | "MD5";
  v3PrivProtocol: "AES" | "DES";
  v3AuthPass: string;
  v3PrivPass: string;
  pollIntervalSeconds: number;
  lastScanIso: string;
}

export interface DeviceTelemetry {
  id: string;
  name: string;
  ip: string;
  mac: string;
  deviceType: "SWITCH" | "ROUTER" | "SERVER_RACK" | "WIFI_AP" | "PRINTER" | "ENDPOINT";
  model: string;
  uptimeDays: number;
  cpuLoadPercent: number;
  memoryUsagePercent: number;
  temperatureC: number;
  status: "ONLINE" | "WARNING" | "OFFLINE";
  activePorts: number;
  totalPorts: number;
  vlans: number[];
}

export interface SubnetDefinition {
  vlanId: number;
  vlanName: string;
  cidr: string;
  gateway: string;
  dhcpRange: string;
  usedIps: number;
  totalIps: number;
}

export interface IntegrationsSettings {
  netbox: {
    enabled: boolean;
    url: string;
    apiToken: string;
    lastSyncIso: string;
    autoSyncOnSave: boolean;
  };
  glpi: {
    enabled: boolean;
    url: string;
    appToken: string;
    userToken: string;
    ticketOnCableFault: boolean;
  };
  intune: {
    enabled: boolean;
    complianceCheck: boolean;
    mapMacToUser: boolean;
  };
  webhooks: {
    enabled: boolean;
    webhookUrl: string;
    notifyOnPortDown: boolean;
    notifyOnHighTemp: boolean;
  };
}

export interface SystemSettings {
  sso: SsoSettings;
  snmp: SnmpSettings;
  subnets: SubnetDefinition[];
  integrations: IntegrationsSettings;
}

export const INITIAL_SETTINGS: SystemSettings = {
  sso: {
    provider: "ENTRA_ID",
    tenantId: "8f7a91bc-4e2a-4389-9a71-d0b8f0418c99",
    clientId: "netfloor-enterprise-sso-app",
    clientSecret: "••••••••••••••••••••••••••••••••",
    corporateDomain: "company.com",
    syncEnabled: true,
    lastSyncIso: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: "CONNECTED",
    tokenExpiryIso: new Date(Date.now() + 3600000 * 24 * 60).toISOString(),
  },
  snmp: {
    version: "v2c",
    targetSubnet: "10.42.0.0/24",
    community: "public_ro",
    v3User: "snmp_admin",
    v3AuthProtocol: "SHA",
    v3PrivProtocol: "AES",
    v3AuthPass: "••••••••••••",
    v3PrivPass: "••••••••••••",
    pollIntervalSeconds: 60,
    lastScanIso: new Date(Date.now() - 3600000).toISOString(),
  },
  subnets: [
    {
      vlanId: 1,
      vlanName: "VLAN_ADMIN_INFRA",
      cidr: "10.42.0.0/24",
      gateway: "10.42.0.254",
      dhcpRange: "10.42.0.50 - 10.42.0.99",
      usedIps: 14,
      totalIps: 254,
    },
    {
      vlanId: 20,
      vlanName: "VLAN_CORP_DATA",
      cidr: "10.42.20.0/24",
      gateway: "10.42.20.254",
      dhcpRange: "10.42.20.10 - 10.42.20.200",
      usedIps: 38,
      totalIps: 254,
    },
    {
      vlanId: 30,
      vlanName: "VLAN_VOIP",
      cidr: "10.42.30.0/24",
      gateway: "10.42.30.254",
      dhcpRange: "10.42.30.10 - 10.42.30.150",
      usedIps: 24,
      totalIps: 254,
    },
    {
      vlanId: 40,
      vlanName: "VLAN_PRINT",
      cidr: "10.42.40.0/24",
      gateway: "10.42.40.254",
      dhcpRange: "10.42.40.10 - 10.42.40.50",
      usedIps: 6,
      totalIps: 254,
    },
    {
      vlanId: 50,
      vlanName: "VLAN_WIFI_INFRA",
      cidr: "10.42.50.0/24",
      gateway: "10.42.50.254",
      dhcpRange: "10.42.50.10 - 10.42.50.220",
      usedIps: 52,
      totalIps: 254,
    },
  ],
  integrations: {
    netbox: {
      enabled: true,
      url: "https://netbox.corp.internal/api/",
      apiToken: "••••••••••••••••••••••••••••••••••••••••",
      lastSyncIso: new Date(Date.now() - 3600000 * 4).toISOString(),
      autoSyncOnSave: true,
    },
    glpi: {
      enabled: true,
      url: "https://glpi.support.internal/apirest.php/",
      appToken: "••••••••••••••••••••",
      userToken: "••••••••••••••••••••",
      ticketOnCableFault: true,
    },
    intune: {
      enabled: true,
      complianceCheck: true,
      mapMacToUser: true,
    },
    webhooks: {
      enabled: true,
      webhookUrl: "https://outlook.office.com/webhook/d8f7a91bc-alerts-dsi",
      notifyOnPortDown: true,
      notifyOnHighTemp: true,
    },
  },
};

export const MOCK_DISCOVERED_DEVICES: DeviceTelemetry[] = [
  {
    id: "dev-sw-01",
    name: "SW-ACCESS-4A-U22",
    ip: "10.42.0.1",
    mac: "00:81:C4:F2:30:01",
    deviceType: "SWITCH",
    model: "Cisco Catalyst 9300-24P",
    uptimeDays: 142,
    cpuLoadPercent: 12,
    memoryUsagePercent: 44,
    temperatureC: 36.5,
    status: "ONLINE",
    activePorts: 18,
    totalPorts: 24,
    vlans: [1, 20, 30, 40, 50],
  },
  {
    id: "dev-rack-01",
    name: "BAIE-PRINCIPALE-RDC",
    ip: "10.42.0.10",
    mac: "70:DF:2F:11:80:A4",
    deviceType: "SERVER_RACK",
    model: "APC NetShelter SX 42U + PDU Monitored",
    uptimeDays: 310,
    cpuLoadPercent: 5,
    memoryUsagePercent: 22,
    temperatureC: 21.2,
    status: "ONLINE",
    activePorts: 24,
    totalPorts: 48,
    vlans: [1, 20, 30, 40, 50],
  },
  {
    id: "dev-ap-04",
    name: "AP-WIFI-OPENSPACE-04",
    ip: "10.42.50.4",
    mac: "A4:B2:39:68:DF:44",
    deviceType: "WIFI_AP",
    model: "Cisco Catalyst 9120AX Series (Wi-Fi 6)",
    uptimeDays: 58,
    cpuLoadPercent: 18,
    memoryUsagePercent: 37,
    temperatureC: 41.0,
    status: "ONLINE",
    activePorts: 2,
    totalPorts: 2,
    vlans: [50],
  },
  {
    id: "dev-print-01",
    name: "COPIEUR-RH-ETAGE-4",
    ip: "10.42.40.2",
    mac: "00:26:73:9A:C8:12",
    deviceType: "PRINTER",
    model: "Canon imageRUNNER ADVANCE DX C5850i",
    uptimeDays: 24,
    cpuLoadPercent: 8,
    memoryUsagePercent: 58,
    temperatureC: 29.0,
    status: "ONLINE",
    activePorts: 1,
    totalPorts: 1,
    vlans: [40],
  },
  {
    id: "dev-pc-408",
    name: "PC-ALEXANDRE-MARTIN",
    ip: "10.42.20.108",
    mac: "F4:D4:88:9A:12:44",
    deviceType: "ENDPOINT",
    model: "Dell Precision 5570 (Poste 408)",
    uptimeDays: 3,
    cpuLoadPercent: 22,
    memoryUsagePercent: 64,
    temperatureC: 45.0,
    status: "ONLINE",
    activePorts: 1,
    totalPorts: 1,
    vlans: [20],
  },
  {
    id: "dev-voip-408",
    name: "VOIP-ALEXANDRE-MARTIN",
    ip: "10.42.30.108",
    mac: "64:16:8D:4B:90:72",
    deviceType: "ENDPOINT",
    model: "Cisco IP Phone 8845",
    uptimeDays: 140,
    cpuLoadPercent: 4,
    memoryUsagePercent: 30,
    temperatureC: 31.0,
    status: "ONLINE",
    activePorts: 1,
    totalPorts: 1,
    vlans: [30],
  },
];
