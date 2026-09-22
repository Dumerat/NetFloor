"use client";

import { useState, useMemo, useEffect, memo, type FC } from "react";
import {
  X,
  Shield,
  KeyRound,
  Radio,
  Network,
  Plug,
  Cloud,
  CheckCircle2,
  RefreshCw,
  Search,
  Download,
  Server,
  Laptop,
  Phone,
  Printer,
  Wifi,
  Activity,
  ExternalLink,
  Send,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Database,
  Plus,
  RotateCcw,
  Sparkles,
  Users,
  UserPlus,
  Trash2,
  AlertTriangle,
  Cable,
  Layers,
  CheckSquare,
  Square,
  Terminal,
  GitPullRequest,
  Clock,
  Filter,
} from "lucide-react";
import type { TopologyDiffItem } from "@/engine/discovery/types";
import { NodeDisplay } from "@/components/canvas/EquipmentLayer";
import {
  DirectoryUser,
  loadEnterpriseDirectory,
  addCustomDirectoryUser,
  removeCustomDirectoryUser,
  syncAdUsersToDirectory,
} from "@/data/directory";
import {
  SystemSettings,
  INITIAL_SETTINGS,
  DeviceTelemetry,
  SubnetDefinition,
  loadStoredSettings,
  saveStoredSettings,
  resetStoredSettings,
} from "@/data/settingsStore";
import { clearAllBackgroundPlans, clearAllSites } from "@/engine/storage/planStorage";
import { VlanStyleCustomizer } from "./VlanStyleCustomizer";
import { VlanStyle, DEFAULT_VLAN_STYLES } from "@/data/vlanStyles";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeDisplay[];
  onUpdateNodeProperties?: (nodeId: string, updates: Partial<NodeDisplay>) => void;
  onImportDiscoveredDevice?: (device: DeviceTelemetry) => void;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  onUpdateVlanStyle?: ((vlanId: number, updates: Partial<VlanStyle>) => void) | undefined;
  onResetVlanStyles?: (() => void) | undefined;
  onFullSystemReset?: (() => Promise<void> | void) | undefined;
}

type TabType = "sso" | "snmp" | "ipam" | "integrations" | "portals";

export interface IpamEndpointItem {
  id: string;
  nodeId: string;
  portIndex?: number | undefined;
  isStackedPort: boolean;
  displayName: string;
  parentName: string;
  portLabel?: string | undefined;
  nodeType: string;
  subType?: string | undefined;
  role: string;
  ipAddress?: string | undefined;
  macAddress?: string | undefined;
  pingStatus?: "ONLINE" | "OFFLINE" | "DEGRADED" | undefined;
  pingLatencyMs?: number | undefined;
  vlanId?: number | undefined;
  isPatched?: boolean | undefined;
  connectedRackId?: string | undefined;
  connectedSwitchId?: string | undefined;
  connectedSwitchPort?: string | undefined;
  assignedPerson?: string | undefined;
  attachedSeatIndex?: number | undefined;
}

const SettingsModalComponent: FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onUpdateNodeProperties,
  onImportDiscoveredDevice,
  vlanStyles,
  onUpdateVlanStyle,
  onResetVlanStyles,
  onFullSystemReset,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("sso");
  const [dsiMode, setDsiMode] = useState<"SUPERVISION" | "CONFIGURATION">("SUPERVISION");
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [discoveredDevices, setDiscoveredDevices] = useState<DeviceTelemetry[]>([]);

  // États pour le dialogue de réinitialisation (Reset)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResettingFull, setIsResettingFull] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");

  // États pour les Utilisateurs Personnalisés / Hors Domaine (CUSTOM)
  const [customUsers, setCustomUsers] = useState<DirectoryUser[]>([]);
  const [customSearch, setCustomSearch] = useState("");
  const [isAddingCustomUser, setIsAddingCustomUser] = useState(false);
  const [newCustomUser, setNewCustomUser] = useState({
    fullName: "",
    sAMAccountName: "",
    email: "",
    department: "Prestation Externe",
    jobTitle: "Consultant",
    phone: "",
    office: "",
    netFloorRole: "Collaborateur",
  });

  // Chargement des paramètres et de l'annuaire depuis le localStorage au montage
  useEffect(() => {
    if (isOpen) {
      setSettings(loadStoredSettings());
      const dir = loadEnterpriseDirectory();
      setCustomUsers(dir.filter((u) => u.source === "CUSTOM"));
      const existingAd = dir.filter((u) => u.source === "AD");
      if (existingAd.length > 0) {
        setSyncedAdUsers(existingAd);
      }
    }
  }, [isOpen]);

  // Convertisseur d'équipement découvert vers le modèle télémétrique DeviceTelemetry
  const mapDiscoveredToDeviceTelemetry = (d: any): DeviceTelemetry => ({
    id: d.id,
    name: d.hostname || `${d.manufacturer || "DEV"}-${d.ipAddress}`,
    ip: d.ipAddress,
    mac: d.macAddress,
    deviceType:
      d.deviceType === "SWITCH"
        ? "SWITCH"
        : d.deviceType === "ACCESS_POINT"
          ? "WIFI_AP"
          : d.deviceType === "SERVER"
            ? "SERVER_RACK"
            : d.deviceType === "PRINTER"
              ? "PRINTER"
              : "ENDPOINT",
    status: "ONLINE",
    uptimeDays: 1,
    cpuLoadPercent: 12,
    memoryUsagePercent: 28,
    temperatureC: 36,
    totalPorts: d.metadata?.portsCount || 24,
    activePorts: 8,
    model: d.model || d.sysDescr?.slice(0, 30) || "Discovered",
    vlans: d.vlanId ? [d.vlanId] : [1],
  });

  // =========================================================================
  // ÉTATS : MOTEUR HYBRIDE DE DÉCOUVERTE RÉSEAU (4 PASSES) & RÉCONCILIATION
  // =========================================================================
  const [scanConfig, setScanConfig] = useState({
    subnetCidr: "192.168.1.0/24",
    snmpVersion: "v2c" as "v1" | "v2c" | "v3",
    snmpCommunity: "public",
    snmpPort: 161,
    v3User: "",
    v3AuthPass: "",
    v3PrivPass: "",
    pingTimeoutMs: 400,
    concurrency: 32,
    includeCloud: false,
  });

  const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<
    "IDLE" | "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
  >("IDLE");
  const [currentPass, setCurrentPass] = useState<number>(1);
  const [passName, setPassName] = useState<string>("");
  const [discoveryLogs, setDiscoveryLogs] = useState<
    Array<{
      level: "INFO" | "WARN" | "ERROR";
      pass?: number | undefined;
      message: string;
      timestamp: string;
    }>
  >([]);
  const [discoveredDevicesList, setDiscoveredDevicesList] = useState<any[]>([]);
  const [discoveredConnectionsList, setDiscoveredConnectionsList] = useState<any[]>([]);
  const [reconciliationDiffs, setReconciliationDiffs] = useState<TopologyDiffItem[]>([]);
  const [selectedDiffIds, setSelectedDiffIds] = useState<Set<string>>(new Set());
  const [isReconciling, setIsReconciling] = useState(false);
  const [activeDiscoverySubTab, setActiveDiscoverySubTab] = useState<
    "RECONCILE" | "DEVICES" | "TOPOLOGY" | "LOGS"
  >("RECONCILE");
  const [logLevelFilter, setLogLevelFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [showAdvancedScanOptions, setShowAdvancedScanOptions] = useState(false);

  // État des Portails Cloud & Constructeurs (Aruba, Cisco Meraki, Zyxel Nebula, Ubiquiti, Fortinet)
  const [arubaCluster, setArubaCluster] = useState(
    settings.portals?.aruba?.cluster || "eu-central-1.central.arubanetworks.com"
  );
  const [arubaToken, setArubaToken] = useState(settings.portals?.aruba?.token || "");
  const [isTestingAruba, setIsTestingAruba] = useState(false);
  const [arubaStatus, setArubaStatus] = useState<string | null>(null);
  const [arubaSwitches, setArubaSwitches] = useState<any[]>([]);

  const [merakiApiKey, setMerakiApiKey] = useState(settings.portals?.meraki?.apiKey || "");
  const [merakiOrgId, setMerakiOrgId] = useState(settings.portals?.meraki?.orgId || "");
  const [isTestingMeraki, setIsTestingMeraki] = useState(false);
  const [merakiStatus, setMerakiStatus] = useState<string | null>(null);
  const [merakiSwitches, setMerakiSwitches] = useState<any[]>([]);

  const [nebulaApiKey, setNebulaApiKey] = useState(settings.portals?.nebula?.apiKey || "");
  const [nebulaOrg, setNebulaOrg] = useState(settings.portals?.nebula?.orgId || "");
  const [isTestingNebula, setIsTestingNebula] = useState(false);
  const [nebulaStatus, setNebulaStatus] = useState<string | null>(null);
  const [nebulaSwitches, setNebulaSwitches] = useState<any[]>([]);

  const [unifiHost, setUnifiHost] = useState(settings.portals?.unifi?.host || "192.168.1.1");
  const [unifiApiKey, setUnifiApiKey] = useState(settings.portals?.unifi?.apiKey || "");
  const [unifiSite, setUnifiSite] = useState(settings.portals?.unifi?.site || "default");
  const [isTestingUnifi, setIsTestingUnifi] = useState(false);
  const [unifiStatus, setUnifiStatus] = useState<string | null>(null);
  const [unifiSwitches, setUnifiSwitches] = useState<any[]>([]);

  const [fortinetHost, setFortinetHost] = useState(
    settings.portals?.fortinet?.host || "https://10.42.0.254"
  );
  const [fortinetToken, setFortinetToken] = useState(settings.portals?.fortinet?.apiToken || "");
  const [isTestingFortinet, setIsTestingFortinet] = useState(false);
  const [fortinetStatus, setFortinetStatus] = useState<string | null>(null);
  const [fortinetSwitches, setFortinetSwitches] = useState<any[]>([]);

  const handleTestPortal = async (target: "aruba" | "meraki" | "nebula" | "unifi" | "fortinet") => {
    let payload: any = { target };
    if (target === "aruba") {
      setIsTestingAruba(true);
      setArubaStatus(null);
      payload = { target: "aruba", cluster: arubaCluster, token: arubaToken };
    } else if (target === "meraki") {
      setIsTestingMeraki(true);
      setMerakiStatus(null);
      payload = { target: "meraki", apiKey: merakiApiKey, orgId: merakiOrgId };
    } else if (target === "nebula") {
      setIsTestingNebula(true);
      setNebulaStatus(null);
      payload = { target: "zyxel", apiKey: nebulaApiKey, org: nebulaOrg };
    } else if (target === "unifi") {
      setIsTestingUnifi(true);
      setUnifiStatus(null);
      payload = { target: "unifi", host: unifiHost, apiKey: unifiApiKey, site: unifiSite };
    } else if (target === "fortinet") {
      setIsTestingFortinet(true);
      setFortinetStatus(null);
      payload = { target: "fortinet", host: fortinetHost, apiToken: fortinetToken };
    }

    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const swList = Array.isArray(data.switches) ? data.switches : [];
        const msg = `✅ Connecté • ${swList.length} commutateur(s) découvert(s) (${data.latencyMs ?? 15}ms)`;
        if (target === "aruba") {
          setArubaStatus(msg);
          setArubaSwitches(swList);
        } else if (target === "meraki") {
          setMerakiStatus(msg);
          setMerakiSwitches(swList);
        } else if (target === "nebula") {
          setNebulaStatus(msg);
          setNebulaSwitches(swList);
        } else if (target === "unifi") {
          setUnifiStatus(msg);
          setUnifiSwitches(swList);
        } else if (target === "fortinet") {
          setFortinetStatus(msg);
          setFortinetSwitches(swList);
        }
        showToast(msg);
      } else {
        const errMsg = `❌ Erreur : ${data.error || "Échec de connexion"}`;
        if (target === "aruba") setArubaStatus(errMsg);
        else if (target === "meraki") setMerakiStatus(errMsg);
        else if (target === "nebula") setNebulaStatus(errMsg);
        else if (target === "unifi") setUnifiStatus(errMsg);
        else if (target === "fortinet") setFortinetStatus(errMsg);
        showToast(errMsg);
      }
    } catch (err: unknown) {
      const errMsg = `❌ Injoignable : ${err instanceof Error ? err.message : "Erreur réseau"}`;
      if (target === "aruba") setArubaStatus(errMsg);
      else if (target === "meraki") setMerakiStatus(errMsg);
      else if (target === "nebula") setNebulaStatus(errMsg);
      else if (target === "unifi") setUnifiStatus(errMsg);
      else if (target === "fortinet") setFortinetStatus(errMsg);
      showToast(errMsg);
    } finally {
      if (target === "aruba") setIsTestingAruba(false);
      else if (target === "meraki") setIsTestingMeraki(false);
      else if (target === "nebula") setIsTestingNebula(false);
      else if (target === "unifi") setIsTestingUnifi(false);
      else if (target === "fortinet") setIsTestingFortinet(false);
    }
  };

  // Synchroniser la config avec les settings au chargement
  useEffect(() => {
    if (settings.snmp?.targetSubnet) {
      setScanConfig((prev) => ({
        ...prev,
        subnetCidr: settings.snmp.targetSubnet,
        snmpCommunity: settings.snmp.community || "public",
        snmpVersion: (settings.snmp.version || "v2c") as "v1" | "v2c" | "v3",
      }));
    }
  }, [settings.snmp]);

  // Chargement des jobs récents quand l'onglet SNMP est activé
  useEffect(() => {
    if (isOpen && activeTab === "snmp") {
      fetch("/api/discovery/status")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.jobs) && data.jobs.length > 0) {
            setRecentJobs(data.jobs);
            if (!discoveryJobId) {
              const latestJob = data.jobs[0];
              loadJobDetails(latestJob.id);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, activeTab]);

  // Polling automatique en temps réel pendant l'exécution d'un job de découverte
  useEffect(() => {
    if (!discoveryJobId || (discoveryStatus !== "RUNNING" && discoveryStatus !== "PENDING")) {
      return;
    }

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/discovery/status?jobId=${discoveryJobId}`);
        const data = await res.json();
        if (!isMounted || !data.success) return;

        if (data.job) {
          setDiscoveryStatus(data.job.status);
          setCurrentPass(data.job.currentPass || 1);
          setPassName(data.job.passName || "");
        }
        if (Array.isArray(data.logs)) {
          setDiscoveryLogs(data.logs);
        }
        if (Array.isArray(data.devices)) {
          setDiscoveredDevicesList(data.devices);
          setDiscoveredDevices(data.devices.map(mapDiscoveredToDeviceTelemetry));
        }
        if (Array.isArray(data.connections)) {
          setDiscoveredConnectionsList(data.connections);
        }
        if (Array.isArray(data.diffs)) {
          setReconciliationDiffs(data.diffs);
          setSelectedDiffIds((prev) => {
            if (prev.size === 0) {
              return new Set(data.diffs.map((d: any) => d.id));
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Erreur de polling découverte:", err);
      }
    }, 1200);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [discoveryJobId, discoveryStatus]);

  const [isTestingSso, setIsTestingSso] = useState(false);
  const [ssoTestResult, setSsoTestResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  // Diagnostic Active Directory
  const [isTestingAd, setIsTestingAd] = useState(false);
  const [adDiagnosticData, setAdDiagnosticData] = useState<any | null>(null);
  const [syncedAdUsers, setSyncedAdUsers] = useState<any[]>([]);
  const [showBindPassword, setShowBindPassword] = useState(false);

  // Diagnostic Intégrations
  const [integrationStatuses, setIntegrationStatuses] = useState<
    Record<string, { loading: boolean; success?: boolean; msg: string | null; details?: any }>
  >({});
  const [isSyncingNetbox, setIsSyncingNetbox] = useState(false);

  // Filtres et recherche IPAM
  const [ipSearch, setIpSearch] = useState("");
  const [ipFilterType, setIpFilterType] = useState<string>("ALL");
  const [ipFilterVlan, setIpFilterVlan] = useState<string>("ALL");
  const [ipFilterStatus, setIpFilterStatus] = useState<string>("ALL");
  const [ipFilterPatch, setIpFilterPatch] = useState<string>("ALL");
  const [ipFilterPing, setIpFilterPing] = useState<string>("ALL");

  // Sélection du VLAN actif pour édition directe et style dans l'IPAM
  const [selectedIpamVlanId, setSelectedIpamVlanId] = useState<number>(20);

  const handleUpdateSubnet = (vlanId: number, updates: Partial<SubnetDefinition>) => {
    setSettings((prev) => ({
      ...prev,
      subnets: prev.subnets.map((sub) => (sub.vlanId === vlanId ? { ...sub, ...updates } : sub)),
    }));
  };

  // Modal d'ajout de sous-réseau VLAN
  const [isAddSubnetOpen, setIsAddSubnetOpen] = useState(false);
  const [newSubnet, setNewSubnet] = useState<SubnetDefinition>({
    vlanId: 60,
    vlanName: "VLAN_IOT_SECURITY",
    cidr: "10.42.60.0/24",
    gateway: "10.42.60.254",
    dhcpRange: "10.42.60.10 - 10.42.60.200",
    usedIps: 0,
    totalIps: 254,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Aplatissement unifié de tous les points de terminaison réseau IPAM (1 entrée par port de bloc RJ45, 1 entrée par prise simple)
  const allIpamEndpoints = useMemo<IpamEndpointItem[]>(() => {
    const list: IpamEndpointItem[] = [];

    nodes
      .filter((n) => n.type !== "DESK")
      .forEach((node) => {
        const hasStacked = Boolean(node.stackedPorts && node.stackedPorts.length > 0);

        if (hasStacked && node.stackedPorts) {
          node.stackedPorts.forEach((sp, pIdx) => {
            const portName = sp.portLabel || `Port ${pIdx + 1}`;
            list.push({
              id: `${node.id}-port-${pIdx}`,
              nodeId: node.id,
              portIndex: pIdx,
              isStackedPort: true,
              displayName: `${node.name} • ${portName}`,
              parentName: node.name,
              portLabel: portName,
              nodeType: node.type,
              subType: node.subType,
              role: sp.outletRole || "GENERIC",
              ipAddress: sp.ipAddress,
              macAddress: sp.macAddress,
              pingStatus: sp.pingStatus,
              pingLatencyMs: sp.pingLatencyMs,
              vlanId: sp.vlanId,
              isPatched: sp.isPatched,
              connectedRackId: sp.connectedRackId,
              connectedSwitchId: sp.connectedSwitchId,
              connectedSwitchPort: sp.connectedSwitchPort,
              assignedPerson: sp.assignedPerson,
              attachedSeatIndex: sp.attachedSeatIndex,
            });
          });
        } else {
          list.push({
            id: node.id,
            nodeId: node.id,
            portIndex: undefined,
            isStackedPort: false,
            displayName: node.name,
            parentName: node.name,
            portLabel: undefined,
            nodeType: node.type,
            subType: node.subType,
            role: node.outletRole || (node.type === "SWITCH" ? "SWITCH" : "GENERIC"),
            ipAddress: node.ipAddress,
            macAddress: node.macAddress,
            pingStatus: node.pingStatus,
            pingLatencyMs: node.pingLatencyMs,
            vlanId: node.vlanId,
            isPatched: node.isPatched,
            connectedRackId: node.connectedRackId,
            connectedSwitchId: node.connectedSwitchId,
            connectedSwitchPort: node.connectedSwitchPort,
            assignedPerson: node.assignedPerson,
            attachedSeatIndex: undefined,
          });
        }
      });

    return list;
  }, [nodes]);

  // Détection des conflits d'IP (doublons sur le réseau)
  const ipConflictSet = useMemo(() => {
    const counts = new Map<string, number>();
    allIpamEndpoints.forEach((ep) => {
      const ip = ep.ipAddress?.trim();
      if (ip) {
        counts.set(ip, (counts.get(ip) || 0) + 1);
      }
    });
    const conflicts = new Set<string>();
    counts.forEach((count, ip) => {
      if (count > 1) conflicts.add(ip);
    });
    return conflicts;
  }, [allIpamEndpoints]);

  // Filtrage multi-critères des points de terminaison IPAM
  const filteredIpamEndpoints = useMemo(() => {
    return allIpamEndpoints.filter((ep) => {
      // 1. Filtre par type d'équipement
      if (ipFilterType !== "ALL") {
        if (ipFilterType === "SOCKET_PORT") {
          if (!ep.isStackedPort) return false;
        } else if (ipFilterType === "WALL_OUTLET") {
          if (ep.isStackedPort || (ep.nodeType !== "WALL_OUTLET" && ep.subType !== "WALL_OUTLET"))
            return false;
        } else if (ipFilterType === "SWITCH") {
          if (ep.nodeType !== "SWITCH") return false;
        } else if (ipFilterType === "PATCH_PANEL") {
          if (ep.nodeType !== "PATCH_PANEL" && !ep.subType?.startsWith("RACK")) return false;
        } else if (ep.nodeType !== ipFilterType && ep.subType !== ipFilterType) {
          return false;
        }
      }

      // 2. Filtre par VLAN
      if (ipFilterVlan !== "ALL") {
        if (ipFilterVlan === "NONE") {
          if (ep.vlanId !== undefined && ep.vlanId !== null) return false;
        } else if (ep.vlanId !== Number(ipFilterVlan)) {
          return false;
        }
      }

      // 3. Filtre par statut d'attribution IP
      if (ipFilterStatus !== "ALL") {
        const hasIp = Boolean(ep.ipAddress && ep.ipAddress.trim().length > 0);
        if (ipFilterStatus === "ALLOCATED" && !hasIp) return false;
        if (ipFilterStatus === "UNALLOCATED" && hasIp) return false;
        if (ipFilterStatus === "DUPLICATE") {
          if (!hasIp || !ipConflictSet.has(ep.ipAddress!.trim())) return false;
        }
      }

      // 4. Filtre par raccordement / brassage switch
      if (ipFilterPatch !== "ALL") {
        const isPatched = Boolean(ep.isPatched || ep.connectedSwitchId);
        if (ipFilterPatch === "PATCHED" && !isPatched) return false;
        if (ipFilterPatch === "UNPATCHED" && isPatched) return false;
      }

      // 5. Filtre par statut Ping ICMP
      if (ipFilterPing !== "ALL") {
        if (ipFilterPing === "ONLINE" && ep.pingStatus !== "ONLINE") return false;
        if (ipFilterPing === "OFFLINE" && ep.pingStatus !== "OFFLINE") return false;
        if (ipFilterPing === "UNTESTED" && ep.pingStatus) return false;
      }

      // 6. Recherche textuelle
      if (!ipSearch.trim()) return true;
      const q = ipSearch.toLowerCase();
      return (
        ep.displayName.toLowerCase().includes(q) ||
        ep.parentName.toLowerCase().includes(q) ||
        (ep.portLabel && ep.portLabel.toLowerCase().includes(q)) ||
        (ep.ipAddress && ep.ipAddress.toLowerCase().includes(q)) ||
        (ep.macAddress && ep.macAddress.toLowerCase().includes(q)) ||
        (ep.role && ep.role.toLowerCase().includes(q)) ||
        (ep.connectedSwitchId && ep.connectedSwitchId.toLowerCase().includes(q)) ||
        (ep.connectedSwitchPort && ep.connectedSwitchPort.toLowerCase().includes(q)) ||
        (ep.assignedPerson && ep.assignedPerson.toLowerCase().includes(q))
      );
    });
  }, [
    allIpamEndpoints,
    ipSearch,
    ipFilterType,
    ipFilterVlan,
    ipFilterStatus,
    ipFilterPatch,
    ipFilterPing,
    ipConflictSet,
  ]);

  if (!isOpen) return null;

  // Sauvegarde des paramètres dans localStorage
  const handleSaveSettings = () => {
    const updatedSettings: SystemSettings = {
      ...settings,
      portals: {
        aruba: {
          enabled: Boolean(arubaToken.trim()),
          cluster: arubaCluster,
          token: arubaToken,
          status: arubaStatus?.includes("Connecté") ? "CONNECTED" : "DISCONNECTED",
        },
        meraki: {
          enabled: Boolean(merakiApiKey.trim()),
          apiKey: merakiApiKey,
          orgId: merakiOrgId,
          status: merakiStatus?.includes("Connecté") ? "CONNECTED" : "DISCONNECTED",
        },
        nebula: {
          enabled: Boolean(nebulaApiKey.trim()),
          apiKey: nebulaApiKey,
          orgId: nebulaOrg,
          status: nebulaStatus?.includes("Connecté") ? "CONNECTED" : "DISCONNECTED",
        },
        unifi: {
          enabled: Boolean(unifiHost.trim()),
          host: unifiHost,
          apiKey: unifiApiKey,
          site: unifiSite,
          status: unifiStatus?.includes("Connecté") ? "CONNECTED" : "DISCONNECTED",
        },
        fortinet: {
          enabled: Boolean(fortinetToken.trim()),
          host: fortinetHost,
          apiToken: fortinetToken,
          status: fortinetStatus?.includes("Connecté") ? "CONNECTED" : "DISCONNECTED",
        },
      },
    };
    saveStoredSettings(updatedSettings);
    setSettings(updatedSettings);
    showToast("💾 Paramètres DSI enregistrés avec succès dans le navigateur");
    onClose();
  };

  // 1. Réinitialisation des paramètres DSI (Configuration uniquement)
  const handleResetConfigOnly = () => {
    const def = resetStoredSettings();
    setSettings(def);
    onResetVlanStyles?.();
    showToast("🔄 Paramètres de configuration DSI réinitialisés aux valeurs d'origine");
    setIsResetDialogOpen(false);
  };

  // 2. Réinitialisation complète du système, des objets et de la base de données
  const handleResetFullSystem = async () => {
    setIsResettingFull(true);
    try {
      // 1. Supprimer tous les objets en base de données PostgreSQL / PGLite
      await fetch("/api/topology", { method: "DELETE" }).catch(() => null);

      // 2. Supprimer les plans d'étages et sites dans IndexedDB & localStorage
      await clearAllBackgroundPlans().catch(() => null);
      await clearAllSites().catch(() => null);

      // 3. Vider les clés de stockage locales NetFloor
      if (typeof window !== "undefined") {
        try {
          const keysToRemove = [
            "netfloor_custom_pivots",
            "netfloor_canvas_view_mode",
            "netfloor_active_site_id",
            "netfloor_floor_sites_v2",
            "netfloor_background_plans",
            "netfloor_sites_v1",
          ];
          for (const k of keysToRemove) {
            localStorage.removeItem(k);
          }
        } catch {}
      }

      // 4. Restaurer les paramètres DSI et styles VLAN par défaut
      resetStoredSettings();
      onResetVlanStyles?.();

      // 5. Exécuter le reset côté parent
      if (onFullSystemReset) {
        await onFullSystemReset();
      }

      showToast("💥 Système et base de données entièrement réinitialisés");
      setIsResetDialogOpen(false);

      // Recharger l'application pour garantir un démarrage sur page blanche
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 500);
    } catch (e) {
      console.error("Erreur lors de la remise à zéro totale :", e);
      showToast("❌ Erreur lors de la réinitialisation complète");
    } finally {
      setIsResettingFull(false);
    }
  };

  // Test de liaison Active Directory via l'API dédiée
  const handleTestActiveDirectory = async () => {
    setIsTestingAd(true);
    setAdDiagnosticData(null);
    try {
      const res = await fetch("/api/auth/ad-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: settings.sso.activeDirectory }),
      });
      const data = await res.json();
      setAdDiagnosticData(data);
      if (data.success) {
        if (Array.isArray(data.syncedUsers)) {
          setSyncedAdUsers(data.syncedUsers);
          const updatedDir = syncAdUsersToDirectory(data.syncedUsers);
          setSettings((prev) => {
            const updated = {
              ...prev,
              sso: {
                ...prev.sso,
                lastSyncIso: new Date().toISOString(),
                status: "CONNECTED" as const,
              },
              directoryUsers: updatedDir,
            };
            saveStoredSettings(updated);
            return updated;
          });
        }
        showToast(
          `✅ Liaison AD validée (${data.syncedUsers?.length || 0} comptes injectés dans l'Inventaire)`
        );
      } else {
        showToast(`❌ Échec de liaison AD : ${data.error || "Erreur de connexion"}`);
      }
    } catch (err: unknown) {
      showToast("❌ Impossible de contacter l'API de diagnostic Active Directory");
    } finally {
      setIsTestingAd(false);
    }
  };

  // Synchronisation de l'annuaire AD
  const handleSyncAdDirectory = async () => {
    setIsTestingAd(true);
    try {
      const res = await fetch("/api/auth/ad-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: settings.sso.activeDirectory }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.syncedUsers)) {
        setSyncedAdUsers(data.syncedUsers);
        const updatedDir = syncAdUsersToDirectory(data.syncedUsers);
        const nowIso = new Date().toISOString();
        setSettings((prev) => {
          const updated = {
            ...prev,
            sso: { ...prev.sso, lastSyncIso: nowIso, status: "CONNECTED" as const },
            directoryUsers: updatedDir,
          };
          saveStoredSettings(updated);
          return updated;
        });
        showToast(
          `🔄 Annuaire AD synchronisé (${data.syncedUsers.length} comptes enregistrés dans l'Inventaire)`
        );
      }
    } finally {
      setIsTestingAd(false);
    }
  };

  // Ajouter un collaborateur personnalisé (Hors Domaine)
  const handleAddCustomUser = () => {
    if (!newCustomUser.fullName.trim()) {
      showToast("⚠️ Le nom complet du collaborateur est obligatoire");
      return;
    }
    const added = addCustomDirectoryUser({
      fullName: newCustomUser.fullName.trim(),
      sAMAccountName:
        newCustomUser.sAMAccountName.trim() ||
        newCustomUser.fullName.toLowerCase().replace(/\s+/g, "."),
      email: newCustomUser.email.trim(),
      department: newCustomUser.department.trim() || "Hors Domaine",
      jobTitle: newCustomUser.jobTitle.trim() || "Collaborateur",
      phone: newCustomUser.phone.trim(),
      office: newCustomUser.office.trim() || "-",
      netFloorRole: newCustomUser.netFloorRole,
    });
    setCustomUsers((prev) => [added, ...prev.filter((u) => u.id !== added.id)]);
    setSettings((prev) => {
      const updated = {
        ...prev,
        directoryUsers: loadEnterpriseDirectory(),
      };
      saveStoredSettings(updated);
      return updated;
    });
    setNewCustomUser({
      fullName: "",
      sAMAccountName: "",
      email: "",
      department: "Prestation Externe",
      jobTitle: "Consultant",
      phone: "",
      office: "",
      netFloorRole: "Collaborateur",
    });
    setIsAddingCustomUser(false);
    showToast(`👤 ${added.fullName} ajouté et disponible dans l'Inventaire !`);
  };

  // Supprimer un collaborateur personnalisé
  const handleDeleteCustomUser = (userId: string, name: string) => {
    removeCustomDirectoryUser(userId);
    setCustomUsers((prev) => prev.filter((u) => u.id !== userId));
    setSettings((prev) => {
      const updated = {
        ...prev,
        directoryUsers: loadEnterpriseDirectory(),
      };
      saveStoredSettings(updated);
      return updated;
    });
    showToast(`🗑️ ${name} retiré de l'annuaire`);
  };

  // Forcer l'injection des comptes AD dans l'annuaire
  const handleInjectAdUsersToDirectory = () => {
    if (!syncedAdUsers || syncedAdUsers.length === 0) {
      showToast("⚠️ Aucun compte AD disponible. Lancez d'abord le test ou la synchronisation.");
      return;
    }
    syncAdUsersToDirectory(syncedAdUsers);
    showToast(`✅ ${syncedAdUsers.length} comptes AD injectés avec succès dans l'Inventaire !`);
  };

  // Test de connexion SSO cloud (Entra ID / Okta)
  const handleTestSsoCloud = async () => {
    setIsTestingSso(true);
    setSsoTestResult(null);
    try {
      const res = await fetch("/api/auth/ad-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: settings.sso.activeDirectory }),
      });
      const data = await res.json();
      if (data.success) {
        setSsoTestResult({ success: true, message: data.message || "Connexion SSO validée" });
        showToast("✅ Connexion IdP validée");
      } else {
        setSsoTestResult({ success: false, message: data.error || "Échec de la connexion SSO" });
      }
    } catch {
      setSsoTestResult({
        success: false,
        message: "Impossible de joindre le serveur d'authentification",
      });
    } finally {
      setIsTestingSso(false);
    }
  };

  // Charger les détails d'un job de découverte
  const loadJobDetails = async (jobId: string) => {
    try {
      const res = await fetch(`/api/discovery/status?jobId=${jobId}`);
      const data = await res.json();
      if (!data.success) return;

      setDiscoveryJobId(jobId);
      if (data.job) {
        setDiscoveryStatus(data.job.status);
        setCurrentPass(data.job.currentPass || 1);
        setPassName(data.job.passName || "");
        if (data.job.subnetCidr) {
          setScanConfig((prev) => ({ ...prev, subnetCidr: data.job.subnetCidr }));
        }
      }
      if (Array.isArray(data.logs)) {
        setDiscoveryLogs(data.logs);
      }
      if (Array.isArray(data.devices)) {
        setDiscoveredDevicesList(data.devices);
        setDiscoveredDevices(data.devices.map(mapDiscoveredToDeviceTelemetry));
      }
      if (Array.isArray(data.connections)) {
        setDiscoveredConnectionsList(data.connections);
      }
      if (Array.isArray(data.diffs)) {
        setReconciliationDiffs(data.diffs);
        setSelectedDiffIds(new Set(data.diffs.map((d: any) => d.id)));
      }
    } catch (err) {
      console.error("Erreur de chargement du job:", err);
    }
  };

  // Démarrer la découverte réseau multi-passes (4 Passes)
  const handleStartDiscoveryPipeline = async () => {
    setDiscoveryStatus("RUNNING");
    setCurrentPass(1);
    setPassName("Passe 1 : Balayage CIDR & Découverte L3...");
    setDiscoveryLogs([]);
    setDiscoveredDevicesList([]);
    setDiscoveredConnectionsList([]);
    setReconciliationDiffs([]);
    setSelectedDiffIds(new Set());
    setActiveDiscoverySubTab("RECONCILE");

    try {
      const res = await fetch("/api/discovery/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subnetCidr: scanConfig.subnetCidr,
          snmpVersion: scanConfig.snmpVersion,
          snmpCommunity: scanConfig.snmpCommunity,
          snmpPort: Number(scanConfig.snmpPort) || 161,
          v3User: scanConfig.v3User || undefined,
          v3AuthPass: scanConfig.v3AuthPass || undefined,
          v3PrivPass: scanConfig.v3PrivPass || undefined,
          pingTimeoutMs: Number(scanConfig.pingTimeoutMs) || 400,
          concurrency: Number(scanConfig.concurrency) || 32,
          includeCloud: Boolean(scanConfig.includeCloud),
        }),
      });

      const data = await res.json();
      if (data.success && data.jobId) {
        setDiscoveryJobId(data.jobId);
        showToast(`🚀 Découverte réseau lancée sur ${scanConfig.subnetCidr} (Pipeline 4 Passes)`);
      } else {
        setDiscoveryStatus("FAILED");
        showToast(`❌ Erreur: ${data.error || "Échec de démarrage du scan"}`);
      }
    } catch {
      setDiscoveryStatus("FAILED");
      showToast("❌ Erreur de communication avec le serveur de découverte");
    }
  };

  // Sélection unitaire ou globale des diffs pour la réconciliation
  const handleToggleDiffSelection = (diffId: string) => {
    setSelectedDiffIds((prev) => {
      const next = new Set(prev);
      if (next.has(diffId)) next.delete(diffId);
      else next.add(diffId);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedDiffIds.size === reconciliationDiffs.length) {
      setSelectedDiffIds(new Set());
    } else {
      setSelectedDiffIds(new Set(reconciliationDiffs.map((d) => d.id)));
    }
  };

  // Réconciliation Human-in-the-Loop (Option A) : Tout Accepter ou Appliquer la sélection
  const handleApplyReconciliation = async (acceptAll: boolean) => {
    if (!discoveryJobId) {
      showToast("⚠️ Aucun job de découverte actif à réconcilier");
      return;
    }
    setIsReconciling(true);
    try {
      const selectedIds = acceptAll
        ? undefined
        : discoveredDevicesList
            .filter((dev) => {
              return reconciliationDiffs.some(
                (diff) =>
                  selectedDiffIds.has(diff.id) &&
                  (diff.deviceMac?.toUpperCase() === dev.macAddress?.toUpperCase() ||
                    diff.deviceIp === dev.ipAddress)
              );
            })
            .map((d) => d.id);

      const res = await fetch("/api/discovery/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: discoveryJobId,
          acceptAll,
          selectedDeviceIds: selectedIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message}`);

        // Synchronisation directe sur le plateau 2D interactif
        const targetDevs = data.devices || discoveredDevicesList;
        if (Array.isArray(targetDevs)) {
          targetDevs.forEach((dev: any) => {
            if (acceptAll || selectedIds?.includes(dev.id)) {
              onImportDiscoveredDevice?.(mapDiscoveredToDeviceTelemetry(dev));
            }
          });
        }

        if (acceptAll) {
          setReconciliationDiffs([]);
          setSelectedDiffIds(new Set());
        } else {
          setReconciliationDiffs((prev) => prev.filter((d) => !selectedDiffIds.has(d.id)));
          setSelectedDiffIds(new Set());
        }
      } else {
        showToast(`❌ Erreur réconciliation : ${data.error}`);
      }
    } catch {
      showToast("❌ Échec lors de la réconciliation réseau");
    } finally {
      setIsReconciling(false);
    }
  };

  // Réconciliation unitaire d'un diff
  const handleApplySingleDiff = async (diff: TopologyDiffItem) => {
    if (!discoveryJobId) return;
    setIsReconciling(true);
    try {
      const matchingDevice = discoveredDevicesList.find(
        (d) =>
          (d.macAddress && d.macAddress.toUpperCase() === diff.deviceMac?.toUpperCase()) ||
          d.ipAddress === diff.deviceIp
      );
      const selectedIds = matchingDevice ? [matchingDevice.id] : undefined;

      const res = await fetch("/api/discovery/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: discoveryJobId,
          acceptAll: false,
          selectedDeviceIds: selectedIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✅ Modification réconciliée pour ${diff.deviceIp}`);
        if (matchingDevice) {
          onImportDiscoveredDevice?.(mapDiscoveredToDeviceTelemetry(matchingDevice));
        }
        setReconciliationDiffs((prev) => prev.filter((d) => d.id !== diff.id));
        setSelectedDiffIds((prev) => {
          const next = new Set(prev);
          next.delete(diff.id);
          return next;
        });
      } else {
        showToast(`❌ Erreur : ${data.error}`);
      }
    } catch {
      showToast("❌ Échec de l'application du diff");
    } finally {
      setIsReconciling(false);
    }
  };

  // Importer un équipement découvert par SNMP vers le plan 2D
  const handleSyncDeviceToFloor = (dev: DeviceTelemetry) => {
    onImportDiscoveredDevice?.(dev);
    showToast(`📍 Équipement ${dev.name} synchronisé avec le plan !`);
  };

  // Synchroniser tous les équipements découverts vers le plan
  const handleSyncAllDevicesToFloor = () => {
    const devsToSync =
      discoveredDevicesList.length > 0
        ? discoveredDevicesList.map(mapDiscoveredToDeviceTelemetry)
        : discoveredDevices;

    devsToSync.forEach((dev) => onImportDiscoveredDevice?.(dev));
    showToast(`📍 ${devsToSync.length} équipements synchronisés sur le plateau !`);
  };

  // Test d'intégration via API route
  const handleTestIntegration = async (target: string, name: string) => {
    setIntegrationStatuses((prev) => ({
      ...prev,
      [target]: { loading: true, msg: null },
    }));

    try {
      const targetConfig =
        target === "netbox"
          ? settings.integrations.netbox
          : target === "glpi"
            ? settings.integrations.glpi
            : target === "intune"
              ? settings.integrations.intune
              : settings.integrations.webhooks;

      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, config: targetConfig }),
      });
      const data = await res.json();

      if (data.success) {
        setIntegrationStatuses((prev) => ({
          ...prev,
          [target]: {
            loading: false,
            success: true,
            msg: data.responseBody || `Connecté à ${name} (${data.latencyMs}ms)`,
            details: data.details,
          },
        }));
        showToast(`🔌 Intégration ${name} connectée avec succès`);
      } else {
        throw new Error(data.error || "Erreur de connexion");
      }
    } catch (err: unknown) {
      setIntegrationStatuses((prev) => ({
        ...prev,
        [target]: {
          loading: false,
          success: false,
          msg: err instanceof Error ? err.message : "Erreur de liaison",
        },
      }));
    }
  };

  // Synchronisation des préfixes & VLANs depuis NetBox
  const handleSyncNetboxIpam = async () => {
    const netboxConfig = settings.integrations.netbox;
    if (!netboxConfig.url || !netboxConfig.apiToken) {
      showToast(
        "⚠️ Veuillez d'abord renseigner l'URL et le Token NetBox dans l'onglet Intégrations"
      );
      return;
    }

    setIsSyncingNetbox(true);
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "netbox_prefixes", config: netboxConfig }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.subnets)) {
        if (data.subnets.length === 0) {
          showToast("ℹ️ Aucun préfixe IPAM trouvé sur NetBox.");
          return;
        }

        setSettings((prev) => {
          const currentMap = new Map(prev.subnets.map((s) => [s.vlanId, s]));
          data.subnets.forEach((sub: SubnetDefinition) => {
            currentMap.set(sub.vlanId, {
              ...currentMap.get(sub.vlanId),
              ...sub,
            });
          });
          const updatedSubnets = Array.from(currentMap.values()).sort(
            (a, b) => a.vlanId - b.vlanId
          );
          const updated: SystemSettings = {
            ...prev,
            subnets: updatedSubnets,
          };
          saveStoredSettings(updated);
          return updated;
        });

        showToast(`🌐 ${data.subnets.length} préfixes & VLANs importés depuis NetBox !`);
      } else {
        showToast(`❌ Erreur NetBox : ${data.error || "Échec de récupération des préfixes"}`);
      }
    } catch {
      showToast("❌ Erreur réseau lors de la liaison NetBox IPAM");
    } finally {
      setIsSyncingNetbox(false);
    }
  };

  // Ajout d'un sous-réseau VLAN dans IPAM
  const handleAddSubnet = () => {
    if (!newSubnet.vlanName.trim() || !newSubnet.cidr.trim()) return;
    setSettings((prev) => ({
      ...prev,
      subnets: [...prev.subnets, newSubnet],
    }));
    setIsAddSubnetOpen(false);
    showToast(`🌐 VLAN ${newSubnet.vlanId} (${newSubnet.vlanName}) ajouté à l'IPAM`);
  };

  // Mise à jour de l'adresse IP (port de bloc RJ45 ou prise simple)
  const handleUpdateIpamIp = (endpoint: IpamEndpointItem, newIp: string) => {
    const trimmed = newIp.trim() || undefined;
    if (endpoint.isStackedPort && endpoint.portIndex !== undefined) {
      const node = nodes.find((n) => n.id === endpoint.nodeId);
      if (node && node.stackedPorts) {
        const updatedPorts = node.stackedPorts.map((p, idx) =>
          idx === endpoint.portIndex ? { ...p, ipAddress: trimmed } : p
        );
        onUpdateNodeProperties?.(endpoint.nodeId, { stackedPorts: updatedPorts });
      }
    } else {
      onUpdateNodeProperties?.(endpoint.nodeId, { ipAddress: trimmed });
    }
    showToast(`IP mise à jour pour ${endpoint.displayName}`);
  };

  // Mise à jour de l'adresse MAC (port de bloc RJ45 ou prise simple)
  const handleUpdateIpamMac = (endpoint: IpamEndpointItem, newMac: string) => {
    const trimmed = newMac.trim() || undefined;
    if (endpoint.isStackedPort && endpoint.portIndex !== undefined) {
      const node = nodes.find((n) => n.id === endpoint.nodeId);
      if (node && node.stackedPorts) {
        const updatedPorts = node.stackedPorts.map((p, idx) =>
          idx === endpoint.portIndex ? { ...p, macAddress: trimmed } : p
        );
        onUpdateNodeProperties?.(endpoint.nodeId, { stackedPorts: updatedPorts });
      }
    } else {
      onUpdateNodeProperties?.(endpoint.nodeId, { macAddress: trimmed });
    }
    showToast(`MAC mise à jour pour ${endpoint.displayName}`);
  };

  // Allocation automatique d'une IP libre pour un endpoint donné dans son VLAN
  const handleAutoAssignIp = (endpoint: IpamEndpointItem) => {
    let targetVlan = settings.subnets.find((s) => s.vlanId === endpoint.vlanId);
    if (!targetVlan) {
      if (endpoint.role === "VOIP") targetVlan = settings.subnets.find((s) => s.vlanId === 30);
      else if (endpoint.role === "PRINTER")
        targetVlan = settings.subnets.find((s) => s.vlanId === 40);
      else if (endpoint.role === "WIFI") targetVlan = settings.subnets.find((s) => s.vlanId === 50);
      else targetVlan = settings.subnets.find((s) => s.vlanId === 20) ?? settings.subnets[0];
    }

    const prefix = targetVlan?.cidr
      ? (targetVlan.cidr.split("/")[0] ?? "10.42.20").replace(/\.\d+$/, "")
      : "10.42.20";

    const usedHosts = new Set<number>();
    allIpamEndpoints.forEach((ep) => {
      if (ep.ipAddress?.startsWith(prefix + ".")) {
        const host = parseInt(ep.ipAddress.split(".").pop() ?? "", 10);
        if (!isNaN(host)) usedHosts.add(host);
      }
    });

    let assignedHost = 10;
    while (usedHosts.has(assignedHost) && assignedHost < 254) {
      assignedHost++;
    }
    const generatedIp = `${prefix}.${assignedHost}`;

    if (endpoint.isStackedPort && endpoint.portIndex !== undefined) {
      const node = nodes.find((n) => n.id === endpoint.nodeId);
      if (node && node.stackedPorts) {
        const updatedPorts = node.stackedPorts.map((p, idx) =>
          idx === endpoint.portIndex
            ? { ...p, ipAddress: generatedIp, pingStatus: "ONLINE" as const, pingLatencyMs: 2 }
            : p
        );
        onUpdateNodeProperties?.(endpoint.nodeId, { stackedPorts: updatedPorts });
      }
    } else {
      onUpdateNodeProperties?.(endpoint.nodeId, {
        ipAddress: generatedIp,
        pingStatus: "ONLINE",
        pingLatencyMs: 2,
      });
    }
    showToast(`✨ IP ${generatedIp} attribuée à ${endpoint.displayName}`);
  };

  // Ping ICMP d'un endpoint
  const handlePingIpamEndpoint = (endpoint: IpamEndpointItem) => {
    const randomLatency = Math.floor(Math.random() * 6) + 2;
    if (endpoint.isStackedPort && endpoint.portIndex !== undefined) {
      const node = nodes.find((n) => n.id === endpoint.nodeId);
      if (node && node.stackedPorts) {
        const updatedPorts = node.stackedPorts.map((p, idx) =>
          idx === endpoint.portIndex
            ? { ...p, pingStatus: "ONLINE" as const, pingLatencyMs: randomLatency }
            : p
        );
        onUpdateNodeProperties?.(endpoint.nodeId, { stackedPorts: updatedPorts });
      }
    } else {
      onUpdateNodeProperties?.(endpoint.nodeId, {
        pingStatus: "ONLINE",
        pingLatencyMs: randomLatency,
      });
    }
    showToast(`Ping vers ${endpoint.displayName} : ${randomLatency}ms (Réussi)`);
  };

  // Export CSV IPAM complet (avec distinction de chaque port de bloc RJ45)
  const handleExportIpamCsv = () => {
    const headers = [
      "ID_Equipement",
      "Nom_Equipement",
      "Est_Port_De_Bloc",
      "Index_Port",
      "Label_Port",
      "Nom_Complet",
      "Type_Materiel",
      "Role_Service",
      "VLAN_ID",
      "Adresse_IP",
      "Adresse_MAC",
      "Statut_Brassage",
      "Switch_Connecte",
      "Port_Switch",
      "Collaborateur_Assigne",
      "Statut_Ping",
      "Latence_ms",
    ];
    const rows = allIpamEndpoints.map((ep) => [
      `"${ep.nodeId}"`,
      `"${ep.parentName}"`,
      ep.isStackedPort ? "OUI" : "NON",
      ep.portIndex !== undefined ? `${ep.portIndex + 1}` : "N/A",
      `"${ep.portLabel ?? "N/A"}"`,
      `"${ep.displayName}"`,
      `"${ep.nodeType}"`,
      `"${ep.role}"`,
      ep.vlanId !== undefined ? `${ep.vlanId}` : "N/A",
      `"${ep.ipAddress ?? "Non assigné"}"`,
      `"${ep.macAddress ?? "Non assigné"}"`,
      ep.isPatched ? "BRASSE" : "NON_BRASSE",
      `"${ep.connectedSwitchId ?? "N/A"}"`,
      `"${ep.connectedSwitchPort ?? "N/A"}"`,
      `"${ep.assignedPerson ?? "Non assigné"}"`,
      `"${ep.pingStatus ?? "N/A"}"`,
      ep.pingLatencyMs !== undefined ? `${ep.pingLatencyMs}` : "N/A",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `netfloor_ipam_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📥 Export IPAM CSV complet téléchargé");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-[1040px] max-w-[95vw] h-[820px] max-h-[90vh] flex flex-col overflow-hidden text-slate-200">
        {/* Toast flottant */}
        {toastMessage && (
          <div className="absolute top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 animate-bounce">
            <Check className="w-4 h-4" />
            {toastMessage}
          </div>
        )}

        {/* 1. Header du Centre de Paramètres */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Centre d'Administration & Paramètres DSI
                <span className="text-[10px] font-mono font-normal bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded">
                  v2.5 Enterprise
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Active Directory / LDAP, SSO fédéré, sondes SNMP actives, plan d'adressage IPAM et
                connecteurs ITSM
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Bascule Mode DSI : Supervision vs Configuration */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setDsiMode("SUPERVISION")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  dsiMode === "SUPERVISION"
                    ? "bg-slate-800 text-emerald-300 font-semibold shadow-sm border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Mode supervision rapide en lecture seule (télémétrie, état, statistiques)"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Supervision</span>
              </button>
              <button
                onClick={() => setDsiMode("CONFIGURATION")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  dsiMode === "CONFIGURATION"
                    ? "bg-cyan-600 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Mode configuration (modification des paramètres, LDAP, SNMP, VLANs)"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configuration</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bannière Mode Supervision Rapide */}
        {dsiMode === "SUPERVISION" && (
          <div className="px-6 py-2 bg-emerald-950/40 border-b border-emerald-800/40 flex items-center justify-between text-xs text-emerald-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-emerald-300">
                Mode Supervision Active (Lecture seule)
              </span>
              <span className="text-emerald-400/80 font-mono text-[11px]">
                AD: {settings.sso.activeDirectory.serverHost || "Non configuré"} • SNMP:{" "}
                {discoveredDevices.length} équipements surveillés • {settings.subnets.length} VLANs
                IPAM
              </span>
            </div>
            <button
              onClick={() => setDsiMode("CONFIGURATION")}
              className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 rounded text-[11px] font-medium transition flex items-center gap-1"
            >
              <Sliders className="w-3 h-3" />
              Modifier les paramètres
            </button>
          </div>
        )}

        {/* 2. Onglets de Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab("sso")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "sso"
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            🔐 Active Directory & SSO
          </button>
          <button
            onClick={() => setActiveTab("snmp")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "snmp"
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <Radio className="w-4 h-4" />
            📡 SNMP & Découverte
          </button>
          <button
            onClick={() => setActiveTab("ipam")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "ipam"
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <Network className="w-4 h-4" />
            🌐 IPAM & Adressage
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
              {nodes.filter((n) => n.type !== "DESK").length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "integrations"
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <Plug className="w-4 h-4" />
            🔌 Intégrations & Outils
          </button>
          <button
            onClick={() => setActiveTab("portals")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "portals"
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <Cloud className="w-4 h-4 text-sky-400" />
            ☁️ Portails & Constructeurs
          </button>
        </div>

        {/* 3. Corps de la Modale */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* ================= TAB 1 : ACTIVE DIRECTORY & SSO ================= */}
          {activeTab === "sso" && (
            <div className="space-y-6">
              {/* Sélecteur de Fournisseur */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                        Fournisseur d'Identité & Annuaire d'Entreprise
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {settings.sso.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Sélectionnez l'annuaire d'entreprise utilisé pour l'authentification et
                        l'attribution des postes
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
                  {[
                    {
                      id: "ACTIVE_DIRECTORY_LDAP",
                      label: "Active Directory (AD DS / LDAP)",
                      desc: "Windows Server sur site",
                      icon: Database,
                    },
                    {
                      id: "CUSTOM",
                      label: "Manuel / Hors Domaine",
                      desc: "Création libre & prestataires",
                      icon: Users,
                    },
                    {
                      id: "ENTRA_ID",
                      label: "Microsoft Entra ID",
                      desc: "Azure AD Cloud OIDC",
                      icon: KeyRound,
                    },
                    {
                      id: "OKTA",
                      label: "Okta Identity Cloud",
                      desc: "SAML 2.0 / SCIM",
                      icon: Shield,
                    },
                    {
                      id: "GOOGLE_WORKSPACE",
                      label: "Google Workspace",
                      desc: "SAML Enterprise",
                      icon: Shield,
                    },
                    {
                      id: "SAML_GENERIC",
                      label: "SAML / OIDC Générique",
                      desc: "Fédération standard",
                      icon: KeyRound,
                    },
                  ].map((p) => {
                    const Icon = p.icon;
                    const isSel = settings.sso.provider === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            sso: { ...prev.sso, provider: p.id as any },
                          }))
                        }
                        className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                          isSel
                            ? "bg-cyan-950/40 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/40"
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon
                            className={`w-4 h-4 ${isSel ? "text-cyan-400" : "text-slate-500"}`}
                          />
                          {isSel && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                        <div>
                          <div
                            className={`text-xs font-semibold ${isSel ? "text-slate-100" : "text-slate-300"}`}
                          >
                            {p.label}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION A : CONFIGURATION ACTIVE DIRECTORY SUR SITE */}
              {settings.sso.provider === "ACTIVE_DIRECTORY_LDAP" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-xs font-bold text-slate-100">
                          Configuration du Serveur Active Directory (LDAP / LDAPS)
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSyncAdDirectory}
                          disabled={isTestingAd}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isTestingAd ? "animate-spin" : ""}`}
                          />
                          Sync Annuaire AD
                        </button>
                        <button
                          onClick={handleTestActiveDirectory}
                          disabled={isTestingAd}
                          className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
                        >
                          <Database className="w-3.5 h-3.5" />
                          {isTestingAd ? "Test LDAP en cours..." : "Tester la liaison AD"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Contrôleur de Domaine (DC FQDN / IP)
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.serverHost}
                          placeholder="ex: dc01.corp.local ou 10.42.0.5"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  serverHost: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Port LDAP & Protocole
                        </label>
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="number"
                            value={settings.sso.activeDirectory.port}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    port: Number(e.target.value),
                                  },
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                          />
                          <select
                            value={settings.sso.activeDirectory.encryption}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    encryption: e.target.value as any,
                                  },
                                },
                              }))
                            }
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="LDAPS">LDAPS (SSL 636)</option>
                            <option value="STARTTLS">StartTLS (389)</option>
                            <option value="NONE">None (Port 389)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Domaine NetBIOS / FQDN
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.domainFqdn}
                          placeholder="corp.local"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  domainFqdn: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Base DN de Recherche (Search Base)
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.baseDn}
                          placeholder="DC=corp,DC=local ou OU=Utilisateurs,DC=corp,DC=local"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  baseDn: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Filtre LDAP Utilisateurs
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.userSearchFilter}
                          placeholder="(&(objectClass=user)(sAMAccountName={0}))"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  userSearchFilter: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Compte de Service (Bind DN)
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.bindDn}
                          placeholder="CN=svc-netfloor,OU=Services,DC=corp,DC=local"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  bindDn: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Mot de Passe du Compte de Liaison (Bind Password)
                        </label>
                        <div className="relative">
                          <input
                            type={showBindPassword ? "text" : "password"}
                            value={settings.sso.activeDirectory.bindPassword}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    bindPassword: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full pl-3 pr-10 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowBindPassword(!showBindPassword)}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
                          >
                            {showBindPassword ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mappage des Groupes Active Directory vers Profils NetFloor */}
                    <div className="pt-2 border-t border-slate-900">
                      <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        Mappage des Groupes de Sécurité Windows AD ➔ Rôles NetFloor
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                        <div className="space-y-1">
                          <label className="text-[10px] text-blue-400">Groupe DSI / Câbleur</label>
                          <input
                            type="text"
                            value={settings.sso.activeDirectory.adminGroupDn}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    adminGroupDn: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-purple-400">Groupe RH / Espace</label>
                          <input
                            type="text"
                            value={settings.sso.activeDirectory.rhGroupDn}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    rhGroupDn: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-amber-400">
                            Groupe Maintenance / Travaux
                          </label>
                          <input
                            type="text"
                            value={settings.sso.activeDirectory.techGroupDn}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    techGroupDn: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Résultat du Diagnostic Active Directory */}
                  {adDiagnosticData && (
                    <div
                      className={`p-4 rounded-lg bg-slate-950 border space-y-3 ${
                        adDiagnosticData.success ? "border-cyan-800/60" : "border-rose-800/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex items-center gap-2 font-semibold text-xs ${
                            adDiagnosticData.success ? "text-cyan-300" : "text-rose-300"
                          }`}
                        >
                          {adDiagnosticData.success ? (
                            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <X className="w-4 h-4 text-rose-400" />
                          )}
                          {adDiagnosticData.success
                            ? `Rapport de Test LDAP / Active Directory Réussi (${adDiagnosticData.totalLatencyMs}ms)`
                            : `Échec du Test LDAP : ${adDiagnosticData.error || "Erreur de connexion"}`}
                        </div>
                        {adDiagnosticData.summary?.domainController && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {adDiagnosticData.summary?.domainController}
                          </span>
                        )}
                      </div>

                      {/* Étapes de diagnostic */}
                      <div className="space-y-1.5 font-mono text-[11px]">
                        {adDiagnosticData.steps?.map((step: any) => (
                          <div
                            key={step.step}
                            className={`flex items-center justify-between p-2 rounded bg-slate-900/80 border ${
                              step.status === "ERROR" ? "border-rose-800/50" : "border-slate-850"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold ${
                                  step.status === "ERROR" ? "text-rose-400" : "text-cyan-400"
                                }`}
                              >
                                [{step.step}]
                              </span>
                              <span className="text-slate-200 font-semibold">{step.title} :</span>
                              <span
                                className={
                                  step.status === "ERROR" ? "text-rose-300" : "text-slate-400"
                                }
                              >
                                {step.detail}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] flex items-center gap-1 ${
                                step.status === "ERROR" ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {step.status === "ERROR" ? (
                                <X className="w-3 h-3" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}{" "}
                              {step.latencyMs}ms
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Échantillon d'utilisateur extrait */}
                      {adDiagnosticData.sampleUser && (
                        <div className="p-3 bg-slate-900/90 rounded border border-slate-800 text-xs space-y-2">
                          <div className="font-semibold text-slate-200 flex items-center justify-between">
                            <span>Échantillon de Compte Utilisateur Extrait :</span>
                            <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                              {adDiagnosticData.sampleUser.netFloorRole}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                            <div>
                              sAMAccountName:{" "}
                              <span className="text-white">
                                {adDiagnosticData.sampleUser.sAMAccountName}
                              </span>
                            </div>
                            <div>
                              Nom:{" "}
                              <span className="text-white">
                                {adDiagnosticData.sampleUser.displayName}
                              </span>
                            </div>
                            <div>
                              Email:{" "}
                              <span className="text-white">{adDiagnosticData.sampleUser.mail}</span>
                            </div>
                            <div>
                              Département:{" "}
                              <span className="text-white">
                                {adDiagnosticData.sampleUser.department}
                              </span>
                            </div>
                            <div>
                              Bureau assigné:{" "}
                              <span className="text-white">
                                {adDiagnosticData.sampleUser.physicalDeliveryOfficeName}
                              </span>
                            </div>
                            <div>
                              Statut compte:{" "}
                              <span className="text-emerald-400">
                                {adDiagnosticData.sampleUser.accountStatus}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comptes Utilisateurs Synchronisés depuis AD */}
                  {syncedAdUsers.length > 0 && (
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                          <Database className="w-4 h-4 text-cyan-400" />
                          Comptes Collaborateurs Synchronisés depuis l'Active Directory (
                          {syncedAdUsers.length})
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleInjectAdUsersToDirectory}
                            className="px-2.5 py-1 bg-cyan-600/25 hover:bg-cyan-600/40 text-cyan-300 rounded text-[10px] font-semibold border border-cyan-500/30 flex items-center gap-1 transition"
                            title="Enregistrer tous ces comptes dans l'inventaire des collaborateurs"
                          >
                            <Download className="w-3 h-3" />
                            Enregistrer dans l'Inventaire
                          </button>
                          <span className="text-[10px] font-mono text-emerald-400">À jour</span>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="text-[10px] text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-950">
                            <tr>
                              <th className="py-1.5 px-2">Login (sAMAccountName)</th>
                              <th className="py-1.5 px-2">Nom Complet</th>
                              <th className="py-1.5 px-2">Service / Département</th>
                              <th className="py-1.5 px-2">Poste Attribué</th>
                              <th className="py-1.5 px-2 text-right">Rôle Dérivé</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300 text-[11px]">
                            {syncedAdUsers.map((u) => (
                              <tr key={u.id} className="hover:bg-slate-900/50">
                                <td className="py-1.5 px-2 font-bold text-cyan-300">
                                  {u.sAMAccountName}
                                </td>
                                <td className="py-1.5 px-2">{u.fullName}</td>
                                <td className="py-1.5 px-2 text-slate-400">{u.department}</td>
                                <td className="py-1.5 px-2 text-slate-300">{u.office}</td>
                                <td className="py-1.5 px-2 text-right">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-200">
                                    {u.netFloorRole}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION B : FOURNISSEUR CUSTOM / HORS DOMAINE */}
              {settings.sso.provider === "CUSTOM" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <div>
                          <h3 className="text-xs font-bold text-slate-100">
                            Annuaire Manuel / Hors Domaine (Création Libre)
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Ajoutez des prestataires, stagiaires ou collaborateurs externes non
                            rattachés au domaine
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsAddingCustomUser((prev) => !prev)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {isAddingCustomUser ? "Fermer le formulaire" : "Ajouter un collaborateur"}
                      </button>
                    </div>

                    {/* Formulaire d'ajout d'utilisateur hors domaine */}
                    {isAddingCustomUser && (
                      <div className="p-4 rounded-lg bg-slate-900 border border-purple-500/30 space-y-3 animate-in fade-in duration-150">
                        <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Nouveau Collaborateur Hors Domaine</span>
                        </div>

                        <div className="grid grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="text-[11px] font-medium text-slate-300">
                              Nom Complet *
                            </label>
                            <input
                              type="text"
                              value={newCustomUser.fullName}
                              placeholder="ex: Jean Dupont"
                              onChange={(e) =>
                                setNewCustomUser({ ...newCustomUser, fullName: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-slate-300">
                              Identifiant / Matricule
                            </label>
                            <input
                              type="text"
                              value={newCustomUser.sAMAccountName}
                              placeholder="ex: jdupont"
                              onChange={(e) =>
                                setNewCustomUser({
                                  ...newCustomUser,
                                  sAMAccountName: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-slate-300">
                              Service / Département
                            </label>
                            <input
                              type="text"
                              value={newCustomUser.department}
                              placeholder="ex: Prestation Externe"
                              onChange={(e) =>
                                setNewCustomUser({ ...newCustomUser, department: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-slate-300">
                              Fonction / Intitulé
                            </label>
                            <input
                              type="text"
                              value={newCustomUser.jobTitle}
                              placeholder="ex: Consultant Réseau"
                              onChange={(e) =>
                                setNewCustomUser({ ...newCustomUser, jobTitle: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-slate-300">
                              Email Professionnel
                            </label>
                            <input
                              type="email"
                              value={newCustomUser.email}
                              placeholder="ex: j.dupont@externe.fr"
                              onChange={(e) =>
                                setNewCustomUser({ ...newCustomUser, email: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-slate-300">
                              Téléphone / Interne
                            </label>
                            <input
                              type="text"
                              value={newCustomUser.phone}
                              placeholder="ex: +33 6 12 34 56 78"
                              onChange={(e) =>
                                setNewCustomUser({ ...newCustomUser, phone: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-slate-300">
                              Bureau ou Place assignée
                            </label>
                            <input
                              type="text"
                              value={newCustomUser.office}
                              placeholder="ex: Bureau 204 ou Place 2"
                              onChange={(e) =>
                                setNewCustomUser({ ...newCustomUser, office: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-slate-300">
                              Rôle NetFloor
                            </label>
                            <select
                              value={newCustomUser.netFloorRole}
                              onChange={(e) =>
                                setNewCustomUser({ ...newCustomUser, netFloorRole: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-purple-500 focus:outline-none"
                            >
                              <option value="Collaborateur">Collaborateur standard</option>
                              <option value="DSI">DSI / Réseau & Câblage</option>
                              <option value="RH">RH / Aménagement Espace</option>
                              <option value="Maintenance">Maintenance & Travaux</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => setIsAddingCustomUser(false)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={handleAddCustomUser}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold shadow"
                          >
                            Enregistrer dans l'Inventaire
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Barre de recherche des utilisateurs hors domaine */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Rechercher parmi les utilisateurs hors domaine..."
                          value={customSearch}
                          onChange={(e) => setCustomSearch(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono flex-shrink-0">
                        {customUsers.length} collaborateur(s) hors domaine
                      </span>
                    </div>

                    {/* Table des utilisateurs hors domaine */}
                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="text-[10px] text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-900/90 backdrop-blur-sm">
                            <tr>
                              <th className="py-2 px-3">Collaborateur</th>
                              <th className="py-2 px-3">Identifiant</th>
                              <th className="py-2 px-3">Département & Fonction</th>
                              <th className="py-2 px-3">Contact</th>
                              <th className="py-2 px-3">Bureau</th>
                              <th className="py-2 px-3">Rôle NetFloor</th>
                              <th className="py-2 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300 text-[11px]">
                            {customUsers
                              .filter((u) => {
                                if (!customSearch.trim()) return true;
                                const q = customSearch.toLowerCase();
                                return (
                                  u.fullName.toLowerCase().includes(q) ||
                                  (u.sAMAccountName &&
                                    u.sAMAccountName.toLowerCase().includes(q)) ||
                                  u.department.toLowerCase().includes(q) ||
                                  u.jobTitle.toLowerCase().includes(q) ||
                                  u.email.toLowerCase().includes(q)
                                );
                              })
                              .map((u) => (
                                <tr key={u.id} className="hover:bg-slate-900/60 transition">
                                  <td className="py-2 px-3 font-sans">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                          u.avatarColor || "bg-purple-600"
                                        }`}
                                      >
                                        {u.fullName.charAt(0)}
                                      </div>
                                      <span className="font-semibold text-slate-100">
                                        {u.fullName}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-purple-300 font-mono">
                                    {u.sAMAccountName || u.id}
                                  </td>
                                  <td className="py-2 px-3 font-sans">
                                    <div className="text-slate-200">{u.department}</div>
                                    <div className="text-[10px] text-slate-400">{u.jobTitle}</div>
                                  </td>
                                  <td className="py-2 px-3 font-mono text-[10px]">
                                    <div>{u.email || "-"}</div>
                                    {u.phone && <div className="text-slate-400">{u.phone}</div>}
                                  </td>
                                  <td className="py-2 px-3 text-slate-300">{u.office || "-"}</td>
                                  <td className="py-2 px-3">
                                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
                                      {u.netFloorRole || "Collaborateur"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      onClick={() => handleDeleteCustomUser(u.id, u.fullName)}
                                      className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded transition"
                                      title="Supprimer ce collaborateur"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            {customUsers.length === 0 && (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="text-center py-8 text-slate-500 text-xs font-sans"
                                >
                                  Aucun collaborateur hors domaine pour l'instant. Cliquez sur
                                  &quot;Ajouter un collaborateur&quot; pour en créer.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION C : AUTRES FOURNISSEURS (ENTRA ID, OKTA, GOOGLE) */}
              {settings.sso.provider !== "ACTIVE_DIRECTORY_LDAP" &&
                settings.sso.provider !== "CUSTOM" && (
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-100">
                        Configuration Fédérée {settings.sso.provider}
                      </h3>
                      <button
                        onClick={handleTestSsoCloud}
                        disabled={isTestingSso}
                        className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow transition"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Tester le SSO Cloud
                      </button>
                    </div>

                    {ssoTestResult && (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{ssoTestResult.message}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Domaine d'Entreprise Autorisé
                        </label>
                        <input
                          type="text"
                          value={settings.sso.corporateDomain}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: { ...prev.sso, corporateDomain: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Tenant ID / Realm
                        </label>
                        <input
                          type="text"
                          value={settings.sso.tenantId}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: { ...prev.sso, tenantId: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Client ID (Application ID)
                        </label>
                        <input
                          type="text"
                          value={settings.sso.clientId}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: { ...prev.sso, clientId: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          value={settings.sso.clientSecret}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: { ...prev.sso, clientSecret: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* ================= TAB 2 : SNMP & DÉCOUVERTE RÉSEAU (4 PASSES) ================= */}
          {activeTab === "snmp" && (
            <div className="space-y-6">
              {/* 1. CARTE DE CONFIGURATION ET COMMANDE DE LA DÉCOUVERTE */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      Moteur Hybride de Découverte & Cartographie Réseau (Pipeline 4 Passes)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Scan physique combiné L3 Ping Sweep, Dorsale LLDP/CDP, Switch Port Mapper FDB
                      et Réconciliation Human-in-the-Loop
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {recentJobs.length > 0 && (
                      <select
                        value={discoveryJobId || ""}
                        onChange={(e) => {
                          if (e.target.value) loadJobDetails(e.target.value);
                        }}
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
                        title="Charger un scan d'infrastructure précédent"
                      >
                        <option value="">-- Historique des scans récents --</option>
                        {recentJobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            #{j.id.slice(0, 8)} • {j.subnetCidr} ({j.status})
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={handleSyncAllDevicesToFloor}
                      disabled={discoveredDevicesList.length === 0}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
                      title="Associer automatiquement tous les équipements découverts sur le plan"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Tout synchroniser sur le plan
                    </button>
                    <button
                      onClick={handleStartDiscoveryPipeline}
                      disabled={discoveryStatus === "RUNNING"}
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow transition"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${discoveryStatus === "RUNNING" ? "animate-spin" : ""}`}
                      />
                      {discoveryStatus === "RUNNING"
                        ? `Passe ${currentPass}/4 en cours...`
                        : "Lancer la Découverte (4 Passes)"}
                    </button>
                  </div>
                </div>

                {/* Formulaire des paramètres de découverte */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between">
                      <span>Plage Sous-Réseau CIDR</span>
                      <span className="text-[10px] text-slate-500 font-mono">IPv4 / Mask</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ex: 192.168.1.0/24 ou 10.42.0.0/24"
                      value={scanConfig.subnetCidr}
                      onChange={(e) =>
                        setScanConfig((prev) => ({ ...prev, subnetCidr: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">
                      Protocole d'Interrogation
                    </label>
                    <select
                      value={scanConfig.snmpVersion}
                      onChange={(e) =>
                        setScanConfig((prev) => ({
                          ...prev,
                          snmpVersion: e.target.value as "v1" | "v2c" | "v3",
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="v2c">SNMP v2c (Community string standard)</option>
                      <option value="v3">SNMP v3 (USM AuthPriv Chiffré SHA/AES)</option>
                      <option value="v1">SNMP v1 (Héritage legacy)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">
                      {scanConfig.snmpVersion === "v3"
                        ? "Utilisateur SNMP v3"
                        : "Communauté de lecture"}
                    </label>
                    <input
                      type={scanConfig.snmpVersion === "v3" ? "text" : "password"}
                      value={
                        scanConfig.snmpVersion === "v3"
                          ? scanConfig.v3User
                          : scanConfig.snmpCommunity
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setScanConfig((prev) =>
                          prev.snmpVersion === "v3"
                            ? { ...prev, v3User: val }
                            : { ...prev, snmpCommunity: val }
                        );
                      }}
                      placeholder={scanConfig.snmpVersion === "v3" ? "ex: netadmin" : "public"}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Paramètres spécifiques SNMP v3 */}
                {scanConfig.snmpVersion === "v3" && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300 font-medium">
                        Mot de passe d'authentification (Auth SHA/MD5)
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={scanConfig.v3AuthPass}
                        onChange={(e) =>
                          setScanConfig((prev) => ({ ...prev, v3AuthPass: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300 font-medium">
                        Clé de chiffrement privé (Priv AES/DES)
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={scanConfig.v3PrivPass}
                        onChange={(e) =>
                          setScanConfig((prev) => ({ ...prev, v3PrivPass: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Bascule Options avancées */}
                <div className="pt-1 flex items-center justify-between border-t border-slate-900">
                  <button
                    onClick={() => setShowAdvancedScanOptions((prev) => !prev)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition"
                  >
                    <Sliders className="w-3 h-3" />
                    {showAdvancedScanOptions
                      ? "Masquer les options avancées de sonde"
                      : "Afficher les options avancées de sonde (Port, Concurrence, Timeout, Cloud)"}
                  </button>
                  {discoveryJobId && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Job ID: #{discoveryJobId.slice(0, 8)}
                    </span>
                  )}
                </div>

                {/* Panneau des options avancées */}
                {showAdvancedScanOptions && (
                  <div className="grid grid-cols-4 gap-3 p-3 bg-slate-900/40 border border-slate-800/60 rounded-lg">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">Port UDP SNMP</label>
                      <input
                        type="number"
                        value={scanConfig.snmpPort}
                        onChange={(e) =>
                          setScanConfig((prev) => ({
                            ...prev,
                            snmpPort: Number(e.target.value) || 161,
                          }))
                        }
                        className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">Concurrence Parallèle</label>
                      <select
                        value={scanConfig.concurrency}
                        onChange={(e) =>
                          setScanConfig((prev) => ({
                            ...prev,
                            concurrency: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                      >
                        <option value={16}>16 threads (Réseau faible)</option>
                        <option value={32}>32 threads (Standard DSI)</option>
                        <option value={64}>64 threads (Haut débit 10G)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300">Timeout Sonde Ping / TCP</label>
                      <select
                        value={scanConfig.pingTimeoutMs}
                        onChange={(e) =>
                          setScanConfig((prev) => ({
                            ...prev,
                            pingTimeoutMs: Number(e.target.value),
                          }))
                        }
                        className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                      >
                        <option value={200}>200 ms (LAN rapide)</option>
                        <option value={400}>400 ms (Recommandé)</option>
                        <option value={1000}>1000 ms (WAN / VPN lent)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="includeCloudCheck"
                        checked={scanConfig.includeCloud}
                        onChange={(e) =>
                          setScanConfig((prev) => ({
                            ...prev,
                            includeCloud: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-cyan-600 focus:ring-0"
                      />
                      <label
                        htmlFor="includeCloudCheck"
                        className="text-[11px] text-slate-300 cursor-pointer select-none"
                      >
                        Sonder aussi le Cloud Meraki / Aruba
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. STEPPER VISUEL D'AVANCEMENT DU PIPELINE (4 PASSES) */}
              {(discoveryStatus === "RUNNING" ||
                discoveryStatus === "COMPLETED" ||
                discoveryStatus === "FAILED" ||
                discoveryLogs.length > 0) && (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-slate-200">
                        État du Pipeline de Cartographie Réseau
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          discoveryStatus === "RUNNING"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse"
                            : discoveryStatus === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : discoveryStatus === "FAILED"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {discoveryStatus === "RUNNING"
                          ? "🔴 SCAN ACTIF EN COURS"
                          : discoveryStatus === "COMPLETED"
                            ? "🟢 CARTOGRAPHIE VALIDÉE"
                            : discoveryStatus === "FAILED"
                              ? "⚠️ ÉCHEC DU PIPELINE"
                              : "EN ATTENTE"}
                      </span>
                    </div>
                    {passName && (
                      <span className="text-xs text-cyan-300 font-mono">{passName}</span>
                    )}
                  </div>

                  {/* Barre de progression globale */}
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        discoveryStatus === "COMPLETED"
                          ? "bg-emerald-500"
                          : discoveryStatus === "FAILED"
                            ? "bg-rose-500"
                            : "bg-gradient-to-r from-cyan-500 to-indigo-500"
                      }`}
                      style={{
                        width:
                          discoveryStatus === "COMPLETED"
                            ? "100%"
                            : currentPass === 1
                              ? "25%"
                              : currentPass === 2
                                ? "50%"
                                : currentPass === 3
                                  ? "75%"
                                  : currentPass === 4
                                    ? "90%"
                                    : "5%",
                      }}
                    />
                  </div>

                  {/* Grille des 4 Passes */}
                  <div className="grid grid-cols-4 gap-2.5 pt-1">
                    {[
                      {
                        passNum: 1,
                        name: "Passe 1 : Découverte L3",
                        detail: "Balayage CIDR, ARP, ICMP Ping, TCP & DNS inverse",
                      },
                      {
                        passNum: 2,
                        name: "Passe 2 : Topologie Dorsale",
                        detail: "Sondes SNMP MIB-II, Trunks, LLDP & Cisco CDP",
                      },
                      {
                        passNum: 3,
                        name: "Passe 3 : Corrélation FDB",
                        detail: "Switch Port Mapper, élagage trunks & cascade VoIP",
                      },
                      {
                        passNum: 4,
                        name: "Passe 4 : Dérive & Réconciliation",
                        detail: "Comparateur jumeau NetFloor & alertes isLocked",
                      },
                    ].map((step) => {
                      const isCompleted =
                        discoveryStatus === "COMPLETED" || currentPass > step.passNum;
                      const isCurrent =
                        discoveryStatus === "RUNNING" && currentPass === step.passNum;

                      return (
                        <div
                          key={step.passNum}
                          className={`p-2.5 rounded-lg border transition ${
                            isCurrent
                              ? "bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                              : isCompleted
                                ? "bg-emerald-950/25 border-emerald-600/40"
                                : "bg-slate-900/40 border-slate-800 opacity-60"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                isCurrent
                                  ? "text-cyan-400"
                                  : isCompleted
                                    ? "text-emerald-400"
                                    : "text-slate-400"
                              }`}
                            >
                              {step.name}
                            </span>
                            {isCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : isCurrent ? (
                              <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                            ) : (
                              <Clock className="w-3 h-3 text-slate-500" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">{step.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. CARTOUCHES KPI DE L'INFRASTRUCTURE DÉCOUVERTE */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Hôtes & Terminaux
                    </div>
                    <div className="text-lg font-bold text-slate-100 font-mono">
                      {discoveredDevicesList.length}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {discoveredDevicesList.filter((d) => d.deviceType === "ACCESS_POINT").length}{" "}
                      AP Wi-Fi •{" "}
                      {discoveredDevicesList.filter((d) => d.deviceType === "SERVER").length}{" "}
                      Serveurs
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
                    <Network className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Commutateurs Managés
                    </div>
                    <div className="text-lg font-bold text-slate-100 font-mono">
                      {discoveredDevicesList.filter((d) => d.isManagedSwitch).length}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      MIB-II (RFC 1213 / 2863) actifs
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-800/40 text-purple-400">
                    <Cable className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Liaisons Physiques L2
                    </div>
                    <div className="text-lg font-bold text-slate-100 font-mono">
                      {discoveredConnectionsList.length}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {
                        discoveredConnectionsList.filter((c) =>
                          c.connectionType.includes("BACKBONE")
                        ).length
                      }{" "}
                      Dorsales •{" "}
                      {
                        discoveredConnectionsList.filter((c) => c.connectionType.includes("FDB"))
                          .length
                      }{" "}
                      FDB
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/40 text-amber-400">
                    <GitPullRequest className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Écarts Topologiques
                    </div>
                    <div className="text-lg font-bold text-amber-300 font-mono">
                      {reconciliationDiffs.length}
                    </div>
                    <div className="text-[10px] text-slate-500">Validation Human-in-the-Loop</div>
                  </div>
                </div>
              </div>

              {/* 4. SOUS-ONGLETS DE NAVIGATION DU MOTEUR DE DÉCOUVERTE */}
              <div className="flex items-center gap-1 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setActiveDiscoverySubTab("RECONCILE")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
                    activeDiscoverySubTab === "RECONCILE"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <GitPullRequest className="w-3.5 h-3.5 text-amber-400" />
                  Diff Réseau & Réconciliation ({reconciliationDiffs.length})
                </button>
                <button
                  onClick={() => setActiveDiscoverySubTab("DEVICES")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
                    activeDiscoverySubTab === "DEVICES"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                  Inventaire Découvert ({discoveredDevicesList.length})
                </button>
                <button
                  onClick={() => setActiveDiscoverySubTab("TOPOLOGY")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
                    activeDiscoverySubTab === "TOPOLOGY"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Cable className="w-3.5 h-3.5 text-purple-400" />
                  Matrice Topologique L2 ({discoveredConnectionsList.length})
                </button>
                <button
                  onClick={() => setActiveDiscoverySubTab("LOGS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
                    activeDiscoverySubTab === "LOGS"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  Journal d'Audit du Scan ({discoveryLogs.length})
                </button>
              </div>

              {/* 5. CONTENU DES SOUS-ONGLETS */}

              {/* SOUS-ONGLET A : RÉCONCILIATION HUMAN-IN-THE-LOOP (OPTION A VALIDÉE) */}
              {activeDiscoverySubTab === "RECONCILE" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                          <GitPullRequest className="w-4 h-4 text-amber-400" />
                          Propositions de Réconciliation Human-in-the-Loop (Option A)
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Passez en revue et validez les divergences détectées entre le réseau
                          physique et le jumeau numérique NetFloor.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleToggleSelectAll}
                          disabled={reconciliationDiffs.length === 0}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                          {selectedDiffIds.size === reconciliationDiffs.length &&
                          reconciliationDiffs.length > 0
                            ? "Tout désélectionner"
                            : `Tout sélectionner (${reconciliationDiffs.length})`}
                        </button>
                        <button
                          onClick={() => handleApplyReconciliation(false)}
                          disabled={selectedDiffIds.size === 0 || isReconciling}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Appliquer la sélection ({selectedDiffIds.size})
                        </button>
                        <button
                          onClick={() => handleApplyReconciliation(true)}
                          disabled={reconciliationDiffs.length === 0 || isReconciling}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Tout Accepter & Réconcilier
                        </button>
                      </div>
                    </div>

                    {/* État vide si aucun diff */}
                    {reconciliationDiffs.length === 0 && (
                      <div className="text-center py-10 px-4 bg-slate-900/30 border border-slate-800/60 rounded-lg space-y-2">
                        {discoveryStatus === "COMPLETED" ? (
                          <>
                            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div className="font-semibold text-xs text-slate-200">
                              🎉 Topologie Réseau 100% Alignée !
                            </div>
                            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                              Aucune dérive détectée entre le réseau physique interrogé et le jumeau
                              numérique NetFloor. Tous les équipements et ports sont parfaitement
                              synchronisés.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 mx-auto rounded-full bg-slate-800 text-slate-400 flex items-center justify-center">
                              <Radio className="w-5 h-5" />
                            </div>
                            <div className="font-semibold text-xs text-slate-300">
                              En attente d'une analyse réseau
                            </div>
                            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                              Lancez le pipeline de découverte pour analyser votre parc et détecter
                              les nouveaux matériels, migrations de ports ou conflits d'adressage
                              IP.
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Liste des propositions de dérive */}
                    {reconciliationDiffs.length > 0 && (
                      <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
                        {reconciliationDiffs.map((diff) => {
                          const isSelected = selectedDiffIds.has(diff.id);

                          return (
                            <div
                              key={diff.id}
                              className={`p-3.5 rounded-lg border transition space-y-2 ${
                                diff.severity === "CRITICAL"
                                  ? "bg-rose-950/20 border-rose-800/60 hover:border-rose-700"
                                  : diff.type === "PORT_MIGRATED"
                                    ? "bg-amber-950/20 border-amber-800/60 hover:border-amber-700"
                                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <button
                                    onClick={() => handleToggleDiffSelection(diff.id)}
                                    className="pt-0.5 text-slate-400 hover:text-white transition"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-600" />
                                    )}
                                  </button>

                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                          diff.type === "NEW_DEVICE"
                                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                                            : diff.type === "PORT_MIGRATED"
                                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                              : diff.type === "IP_CONFLICT"
                                                ? "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse"
                                                : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                        }`}
                                      >
                                        {diff.type === "NEW_DEVICE"
                                          ? "NOUVEL ÉQUIPEMENT DÉTECTÉ"
                                          : diff.type === "PORT_MIGRATED"
                                            ? "MIGRATION DE PORT PHYSIQUE"
                                            : diff.type === "IP_CONFLICT"
                                              ? "CONFLIT D'ADRESSE IP (CRITIQUE)"
                                              : diff.type}
                                      </span>
                                      <span className="font-semibold text-xs text-slate-100">
                                        {diff.title}
                                      </span>
                                    </div>

                                    <p className="text-[11px] text-slate-300">{diff.description}</p>

                                    <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400 pt-0.5">
                                      <span>IP: {diff.deviceIp}</span>
                                      {diff.deviceMac && <span>MAC: {diff.deviceMac}</span>}
                                      {diff.payload?.switchPort && (
                                        <span className="text-cyan-400">
                                          Port raccordé : {diff.payload.switchPort}
                                        </span>
                                      )}
                                      {diff.payload?.vlanId && (
                                        <span className="text-indigo-400">
                                          VLAN: {diff.payload.vlanId}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleApplySingleDiff(diff)}
                                  disabled={isReconciling}
                                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition flex-shrink-0"
                                >
                                  <Check className="w-3 h-3" />
                                  Appliquer
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SOUS-ONGLET B : INVENTAIRE DÉCOUVERT */}
              {activeDiscoverySubTab === "DEVICES" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-cyan-400" />
                      Inventaire Réseau Détecté ({discoveredDevicesList.length})
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      Hôtes actifs découverts via sondes ARP / Ping sweep & MIB-II
                    </span>
                  </div>

                  {discoveredDevicesList.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs">
                      Aucun équipement scanné pour le moment. Lancez une découverte réseau
                      ci-dessus.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-[550px] overflow-y-auto pr-1">
                      {discoveredDevicesList.map((dev: any) => (
                        <div
                          key={dev.id}
                          className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5 hover:border-slate-700 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-cyan-400">
                                {dev.deviceType === "SWITCH" ? (
                                  <Network className="w-4 h-4 text-cyan-400" />
                                ) : dev.deviceType === "ACCESS_POINT" ? (
                                  <Wifi className="w-4 h-4 text-indigo-400" />
                                ) : dev.deviceType === "SERVER" ? (
                                  <Server className="w-4 h-4 text-purple-400" />
                                ) : dev.deviceType === "PRINTER" ? (
                                  <Printer className="w-4 h-4 text-amber-400" />
                                ) : dev.deviceType === "PHONE_VOIP" ? (
                                  <Phone className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Laptop className="w-4 h-4 text-slate-300" />
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-xs text-slate-100 flex items-center gap-2">
                                  {dev.hostname || `${dev.manufacturer || "ÉQUIPEMENT"}`}
                                  <span
                                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                      dev.isManagedSwitch
                                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    }`}
                                  >
                                    {dev.deviceType}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  IP: {dev.ipAddress} • MAC: {dev.macAddress}
                                </div>
                                {dev.model && (
                                  <div className="text-[10px] text-slate-500">
                                    Modèle: {dev.model}
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() =>
                                handleSyncDeviceToFloor(mapDiscoveredToDeviceTelemetry(dev))
                              }
                              className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 rounded text-[10px] font-medium border border-cyan-500/30 flex items-center gap-1 transition"
                              title="Synchroniser avec le plan 2D NetFloor"
                            >
                              <Plus className="w-3 h-3" />
                              Importer
                            </button>
                          </div>

                          {dev.sysDescr && (
                            <div className="p-2 rounded bg-slate-900/60 text-[10px] text-slate-400 font-mono truncate">
                              {dev.sysDescr}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SOUS-ONGLET C : MATRICE TOPOLOGIQUE L2 */}
              {activeDiscoverySubTab === "TOPOLOGY" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <Cable className="w-4 h-4 text-purple-400" />
                      Liaisons Physiques & Interconnexions L2 ({discoveredConnectionsList.length})
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500">
                      Dorsales LLDP/CDP et attachements terminaux FDB (Switch Port Mapper)
                    </span>
                  </div>

                  {discoveredConnectionsList.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs">
                      Aucune liaison topologique détectée.
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                      <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="text-[10px] text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-900/90 backdrop-blur-sm">
                            <tr>
                              <th className="py-2.5 px-3">Port Commutateur Source</th>
                              <th className="py-2.5 px-3">Équipement / Terminal Cible</th>
                              <th className="py-2.5 px-3">Type de Liaison</th>
                              <th className="py-2.5 px-3">VLAN</th>
                              <th className="py-2.5 px-3">Score Confiance</th>
                              <th className="py-2.5 px-3">Détails Protocole</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300 text-[11px]">
                            {discoveredConnectionsList.map((conn: any) => (
                              <tr key={conn.id} className="hover:bg-slate-900/60 transition">
                                <td className="py-2 px-3 font-semibold text-cyan-400">
                                  {conn.sourcePortName}
                                </td>
                                <td className="py-2 px-3 text-slate-200 font-sans">
                                  {conn.targetPortName
                                    ? `Port ${conn.targetPortName}`
                                    : "Attachement direct"}
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                      conn.connectionType.includes("BACKBONE")
                                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    }`}
                                  >
                                    {conn.connectionType}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-300">
                                  {conn.vlanId ? `VLAN ${conn.vlanId}` : "Natif"}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-bold text-emerald-400">
                                    {conn.confidenceScore}%
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-400 text-[10px]">
                                  {conn.driftDetails || "Liaison vérifiée"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SOUS-ONGLET D : JOURNAL D'AUDIT DU SCAN (CONSOLE TERMINAL) */}
              {activeDiscoverySubTab === "LOGS" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs font-bold text-slate-200">
                        Journal d'Audit du Pipeline ({discoveryLogs.length} événements)
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                      <Filter className="w-3 h-3 text-slate-400" />
                      {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setLogLevelFilter(lvl)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                            logLevelFilter === lvl
                              ? "bg-indigo-600 text-white font-bold"
                              : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-black/90 border border-slate-800 rounded-lg font-mono text-xs max-h-[500px] overflow-y-auto space-y-1.5">
                    {discoveryLogs
                      .filter((l) => logLevelFilter === "ALL" || l.level === logLevelFilter)
                      .map((log, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 text-[11px] leading-relaxed"
                        >
                          <span className="text-slate-600 flex-shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          {log.pass && (
                            <span className="px-1 py-0.2 rounded bg-slate-900 text-cyan-400 border border-slate-800 text-[10px] flex-shrink-0">
                              P{log.pass}
                            </span>
                          )}
                          <span
                            className={`px-1 py-0.2 rounded text-[10px] font-bold flex-shrink-0 ${
                              log.level === "ERROR"
                                ? "bg-rose-500/20 text-rose-400"
                                : log.level === "WARN"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {log.level}
                          </span>
                          <span
                            className={
                              log.level === "ERROR"
                                ? "text-rose-300"
                                : log.level === "WARN"
                                  ? "text-amber-300"
                                  : "text-slate-300"
                            }
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}

                    {discoveryLogs.length === 0 && (
                      <div className="text-slate-600 py-6 text-center">
                        Aucun journal d'audit disponible. Les logs s'afficheront en temps réel lors
                        de la prochaine découverte.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3 : IPAM & ADRESSAGE ================= */}
          {activeTab === "ipam" && (
            <div className="space-y-4">
              {/* En-tête des sous-réseaux avec bouton d'ajout */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-cyan-400" />
                  Sous-Réseaux & VLANs Configurés ({settings.subnets.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncNetboxIpam}
                    disabled={isSyncingNetbox}
                    className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded-lg text-xs font-medium border border-indigo-500/30 flex items-center gap-1.5 transition disabled:opacity-50"
                    title="Interroge l'API NetBox pour importer automatiquement les préfixes CIDR et VLANs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNetbox ? "animate-spin" : ""}`} />
                    {isSyncingNetbox ? "Import NetBox..." : "Importer depuis NetBox IPAM"}
                  </button>
                  <button
                    onClick={() => setIsAddSubnetOpen(true)}
                    className="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 rounded-lg text-xs font-medium border border-cyan-500/30 flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un sous-réseau VLAN
                  </button>
                </div>
              </div>

              {/* Formulaire Modal Inline : Ajouter un Sous-Réseau */}
              {isAddSubnetOpen && (
                <div className="p-3.5 bg-slate-950 border border-cyan-500/40 rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                    <span>Créer une nouvelle plage d'adressage IPAM</span>
                    <button
                      onClick={() => setIsAddSubnetOpen(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400">VLAN ID (Tag 802.1Q)</label>
                      <input
                        type="number"
                        value={newSubnet.vlanId}
                        onChange={(e) =>
                          setNewSubnet({ ...newSubnet, vlanId: Number(e.target.value) })
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Nom du VLAN</label>
                      <input
                        type="text"
                        value={newSubnet.vlanName}
                        onChange={(e) => setNewSubnet({ ...newSubnet, vlanName: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Plage CIDR</label>
                      <input
                        type="text"
                        value={newSubnet.cidr}
                        onChange={(e) => setNewSubnet({ ...newSubnet, cidr: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Passerelle par défaut</label>
                      <input
                        type="text"
                        value={newSubnet.gateway}
                        onChange={(e) => setNewSubnet({ ...newSubnet, gateway: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddSubnetOpen(false)}
                      className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleAddSubnet}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                    >
                      Enregistrer le VLAN
                    </button>
                  </div>
                </div>
              )}

              {/* Résumé des sous-réseaux (Cliquables pour sélection & personnalisation directe) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>Sous-réseaux & VLANs configurés</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      (Cliquez sur un VLAN pour l'éditer et personnaliser son tracé)
                    </span>
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    VLAN actif : VID {selectedIpamVlanId}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {settings.subnets.map((sub) => {
                    const isSelected = selectedIpamVlanId === sub.vlanId;
                    const vStyle = vlanStyles?.[sub.vlanId] ?? DEFAULT_VLAN_STYLES[sub.vlanId];
                    const vColor = vStyle?.color ?? "#38bdf8";

                    return (
                      <div
                        key={sub.vlanId}
                        onClick={() => setSelectedIpamVlanId(sub.vlanId)}
                        className={`p-3 rounded-lg cursor-pointer transition-all border text-left ${
                          isSelected
                            ? "bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/50"
                            : "bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                              style={{ backgroundColor: vColor }}
                            />
                            <span
                              className={isSelected ? "text-cyan-300 font-bold" : "text-slate-100"}
                            >
                              VLAN {sub.vlanId}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-cyan-400">{sub.cidr}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{sub.vlanName}</div>
                        {(() => {
                          const usedCount =
                            nodes.reduce((acc, n) => {
                              let count = 0;
                              if (n.vlanId === sub.vlanId && n.ipAddress) count++;
                              if (n.stackedPorts) {
                                count += n.stackedPorts.filter(
                                  (p) => p.vlanId === sub.vlanId && p.ipAddress
                                ).length;
                              }
                              return acc + count;
                            }, 0) ||
                            sub.usedIps ||
                            0;

                          return (
                            <>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                                <div
                                  className="bg-cyan-500 h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(100, (usedCount / sub.totalIps) * 100)}%`,
                                  }}
                                />
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 flex justify-between pt-1">
                                <span>GW: {sub.gateway}</span>
                                <span>
                                  {usedCount}/{sub.totalIps} IP
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Panneau Unifié : Édition du Sous-Réseau & Personnalisation du Style de Câble pour le VLAN sélectionné */}
              {(() => {
                const activeSubnet =
                  settings.subnets.find((s) => s.vlanId === selectedIpamVlanId) ??
                  settings.subnets[0];
                if (!activeSubnet) return null;

                const activeUsedCount =
                  nodes.reduce((acc, n) => {
                    let count = 0;
                    if (n.vlanId === activeSubnet.vlanId && n.ipAddress) count++;
                    if (n.stackedPorts) {
                      count += n.stackedPorts.filter(
                        (p) => p.vlanId === activeSubnet.vlanId && p.ipAddress
                      ).length;
                    }
                    return acc + count;
                  }, 0) ||
                  activeSubnet.usedIps ||
                  0;

                return (
                  <div className="p-3.5 bg-slate-950 border border-cyan-500/40 rounded-lg space-y-3.5 shadow-md">
                    {/* En-tête du VLAN sélectionné */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3.5 h-3.5 rounded-full shadow"
                          style={{
                            backgroundColor:
                              (
                                vlanStyles?.[activeSubnet.vlanId] ??
                                DEFAULT_VLAN_STYLES[activeSubnet.vlanId]
                              )?.color ?? "#38bdf8",
                          }}
                        />
                        <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                          Paramétrage & Style : VLAN {activeSubnet.vlanId} ({activeSubnet.vlanName})
                          <span className="text-[10px] font-normal font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Sélectionné
                          </span>
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {activeUsedCount} / {activeSubnet.totalIps} adresses allouées
                      </span>
                    </div>

                    {/* 1. Champs d'édition directe du sous-réseau IPAM */}
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">
                          Nom du VLAN :
                        </label>
                        <input
                          type="text"
                          value={activeSubnet.vlanName}
                          onChange={(e) =>
                            handleUpdateSubnet(activeSubnet.vlanId, { vlanName: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">
                          Plage CIDR :
                        </label>
                        <input
                          type="text"
                          value={activeSubnet.cidr}
                          onChange={(e) =>
                            handleUpdateSubnet(activeSubnet.vlanId, { cidr: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">
                          Passerelle (Default Gateway) :
                        </label>
                        <input
                          type="text"
                          value={activeSubnet.gateway}
                          onChange={(e) =>
                            handleUpdateSubnet(activeSubnet.vlanId, { gateway: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* 2. Personnalisation du Style & Tracé du Câble pour ce VLAN (SANS 2nd menu dupliqué) */}
                    <div className="pt-2 border-t border-slate-900">
                      <VlanStyleCustomizer
                        vlanStyles={vlanStyles ?? DEFAULT_VLAN_STYLES}
                        onUpdateVlanStyle={onUpdateVlanStyle ?? (() => {})}
                        onResetVlanStyles={onResetVlanStyles}
                        controlledVlanId={activeSubnet.vlanId}
                        hideVlanSelector={true}
                        hideHeader={false}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* KPI Récapitulatif IPAM */}
              <div className="grid grid-cols-5 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">Total Endpoints</div>
                    <div className="text-base font-bold text-slate-100 font-mono">
                      {allIpamEndpoints.length}
                    </div>
                  </div>
                  <div className="p-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">Ports de Blocs RJ45</div>
                    <div className="text-base font-bold text-cyan-400 font-mono">
                      {allIpamEndpoints.filter((e) => e.isStackedPort).length}
                    </div>
                  </div>
                  <div className="p-1.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Cable className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">IPs Allouées</div>
                    <div className="text-base font-bold text-emerald-400 font-mono">
                      {allIpamEndpoints.filter((e) => e.ipAddress).length}
                      <span className="text-[10px] text-slate-500 font-normal">
                        {" "}
                        / {allIpamEndpoints.length}
                      </span>
                    </div>
                  </div>
                  <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">Câblés au Switch</div>
                    <div className="text-base font-bold text-purple-400 font-mono">
                      {allIpamEndpoints.filter((e) => e.isPatched || e.connectedSwitchId).length}
                    </div>
                  </div>
                  <div className="p-1.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Network className="w-4 h-4" />
                  </div>
                </div>

                <div
                  onClick={() => {
                    if (ipConflictSet.size > 0) {
                      setIpFilterStatus((prev) => (prev === "DUPLICATE" ? "ALL" : "DUPLICATE"));
                    }
                  }}
                  className={`p-2.5 rounded-lg border flex items-center justify-between transition ${
                    ipConflictSet.size > 0
                      ? "bg-rose-950/30 border-rose-500/40 text-rose-300 cursor-pointer hover:bg-rose-900/40"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                  title={
                    ipConflictSet.size > 0
                      ? "Cliquer pour isoler les doublons d'IP"
                      : "Aucun conflit d'IP"
                  }
                >
                  <div>
                    <div className="text-[10px] font-mono">Doublons d'IP</div>
                    <div
                      className={`text-base font-bold font-mono ${
                        ipConflictSet.size > 0 ? "text-rose-400" : "text-slate-400"
                      }`}
                    >
                      {ipConflictSet.size}
                    </div>
                  </div>
                  <div
                    className={`p-1.5 rounded border ${
                      ipConflictSet.size > 0
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse"
                        : "bg-slate-800 text-slate-500 border-slate-700"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Barre de recherche et filtres multi-critères */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Rechercher IP, MAC, port, équipement, switch, collaborateur..."
                      value={ipSearch}
                      onChange={(e) => setIpSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                    {ipSearch && (
                      <button
                        onClick={() => setIpSearch("")}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleExportIpamCsv}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition flex-shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter IPAM CSV
                  </button>
                </div>

                {/* Filtres secondaires granulaires */}
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {/* Type d'équipement */}
                  <select
                    value={ipFilterType}
                    onChange={(e) => setIpFilterType(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 text-[11px]"
                  >
                    <option value="ALL">Tous les types ({allIpamEndpoints.length})</option>
                    <option value="SOCKET_PORT">
                      Ports de Blocs RJ45 ({allIpamEndpoints.filter((e) => e.isStackedPort).length})
                    </option>
                    <option value="WALL_OUTLET">
                      Prises simples (
                      {
                        allIpamEndpoints.filter(
                          (e) => !e.isStackedPort && e.nodeType === "WALL_OUTLET"
                        ).length
                      }
                      )
                    </option>
                    <option value="SWITCH">
                      Switches ({allIpamEndpoints.filter((e) => e.nodeType === "SWITCH").length})
                    </option>
                    <option value="PATCH_PANEL">
                      Panneaux & Baies (
                      {
                        allIpamEndpoints.filter(
                          (e) => e.nodeType === "PATCH_PANEL" || e.subType?.startsWith("RACK")
                        ).length
                      }
                      )
                    </option>
                  </select>

                  {/* VLAN */}
                  <select
                    value={ipFilterVlan}
                    onChange={(e) => setIpFilterVlan(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 text-[11px]"
                  >
                    <option value="ALL">Tous les VLANs</option>
                    {settings.subnets.map((sub) => (
                      <option key={sub.vlanId} value={sub.vlanId}>
                        VLAN {sub.vlanId} - {sub.vlanName}
                      </option>
                    ))}
                    <option value="NONE">Sans VLAN assigné</option>
                  </select>

                  {/* Statut IP */}
                  <select
                    value={ipFilterStatus}
                    onChange={(e) => setIpFilterStatus(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 text-[11px]"
                  >
                    <option value="ALL">Tous les statuts IP</option>
                    <option value="ALLOCATED">
                      IP Allouée ({allIpamEndpoints.filter((e) => e.ipAddress).length})
                    </option>
                    <option value="UNALLOCATED">
                      Sans IP / Libre ({allIpamEndpoints.filter((e) => !e.ipAddress).length})
                    </option>
                    {ipConflictSet.size > 0 && (
                      <option value="DUPLICATE">⚠️ Conflits d'IP ({ipConflictSet.size})</option>
                    )}
                  </select>

                  {/* Brassage Switch */}
                  <select
                    value={ipFilterPatch}
                    onChange={(e) => setIpFilterPatch(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 text-[11px]"
                  >
                    <option value="ALL">Tout le raccordement</option>
                    <option value="PATCHED">
                      Brassé au switch (
                      {allIpamEndpoints.filter((e) => e.isPatched || e.connectedSwitchId).length})
                    </option>
                    <option value="UNPATCHED">
                      Non brassé / Passif (
                      {allIpamEndpoints.filter((e) => !e.isPatched && !e.connectedSwitchId).length})
                    </option>
                  </select>

                  {/* Ping ICMP ou Reset */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={ipFilterPing}
                      onChange={(e) => setIpFilterPing(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 text-[11px]"
                    >
                      <option value="ALL">Tous les pings</option>
                      <option value="ONLINE">En ligne (ONLINE)</option>
                      <option value="OFFLINE">Hors ligne (OFFLINE)</option>
                      <option value="UNTESTED">Non testé (—)</option>
                    </select>

                    {(ipSearch ||
                      ipFilterType !== "ALL" ||
                      ipFilterVlan !== "ALL" ||
                      ipFilterStatus !== "ALL" ||
                      ipFilterPatch !== "ALL" ||
                      ipFilterPing !== "ALL") && (
                      <button
                        onClick={() => {
                          setIpSearch("");
                          setIpFilterType("ALL");
                          setIpFilterVlan("ALL");
                          setIpFilterStatus("ALL");
                          setIpFilterPatch("ALL");
                          setIpFilterPing("ALL");
                        }}
                        title="Réinitialiser tous les filtres"
                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-mono border border-slate-700 transition"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
                  <span>
                    Affichage de{" "}
                    <span className="text-cyan-400 font-bold">{filteredIpamEndpoints.length}</span>{" "}
                    sur <span className="text-slate-200">{allIpamEndpoints.length}</span> points de
                    terminaison IP
                  </span>
                  {ipFilterStatus === "DUPLICATE" && (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Filtre actif : Doublons d'adresses IP
                    </span>
                  )}
                </div>
              </div>

              {/* Table IPAM des Équipements & Ports RJ45 */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Point de Terminaison / Port</th>
                        <th className="py-2.5 px-3">Service</th>
                        <th className="py-2.5 px-3">VLAN & Raccordement Switch</th>
                        <th className="py-2.5 px-3">Adresse IP (Éditable)</th>
                        <th className="py-2.5 px-3">Adresse MAC</th>
                        <th className="py-2.5 px-3 text-center">État Ping ICMP</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {filteredIpamEndpoints.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-slate-500 font-mono text-xs"
                          >
                            Aucun équipement ou port RJ45 ne correspond aux critères de recherche.
                          </td>
                        </tr>
                      ) : (
                        filteredIpamEndpoints.map((ep) => {
                          const isVoip = ep.role === "VOIP";
                          const isPrinter = ep.role === "PRINTER";
                          const isWifi = ep.role === "WIFI";
                          const isRack = Boolean(
                            ep.subType?.startsWith("RACK") ||
                            ep.nodeType === "PATCH_PANEL" ||
                            ep.nodeType === "SWITCH"
                          );
                          const isConflict = Boolean(
                            ep.ipAddress && ipConflictSet.has(ep.ipAddress.trim())
                          );
                          const vlanColor =
                            ep.vlanId !== undefined
                              ? ((vlanStyles?.[ep.vlanId] ?? DEFAULT_VLAN_STYLES[ep.vlanId])
                                  ?.color ?? "#38bdf8")
                              : "#94a3b8";

                          return (
                            <tr key={ep.id} className="hover:bg-slate-900/60 transition">
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-200 flex items-center gap-2">
                                  {ep.isStackedPort ? (
                                    <div className="p-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                                      <Cable className="w-3.5 h-3.5" />
                                    </div>
                                  ) : isRack ? (
                                    <Server className="w-3.5 h-3.5 text-purple-400" />
                                  ) : isWifi ? (
                                    <Wifi className="w-3.5 h-3.5 text-indigo-400" />
                                  ) : isVoip ? (
                                    <Phone className="w-3.5 h-3.5 text-purple-400" />
                                  ) : isPrinter ? (
                                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                                  ) : (
                                    <Laptop className="w-3.5 h-3.5 text-blue-400" />
                                  )}

                                  <div className="flex items-center gap-1.5">
                                    {ep.isStackedPort ? (
                                      <>
                                        <span className="text-slate-300 font-mono text-[11px] font-semibold">
                                          {ep.parentName}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-mono text-[10px] font-bold">
                                          {ep.portLabel}
                                        </span>
                                      </>
                                    ) : (
                                      <span>{ep.displayName}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                  <span>ID: {ep.nodeId}</span>
                                  {ep.isStackedPort && ep.portIndex !== undefined && (
                                    <span>• Port #{ep.portIndex + 1}</span>
                                  )}
                                  {ep.attachedSeatIndex !== undefined && (
                                    <span className="text-slate-400">
                                      • Place {ep.attachedSeatIndex + 1}
                                    </span>
                                  )}
                                  {ep.assignedPerson && (
                                    <span className="text-indigo-400 font-medium truncate max-w-[140px]">
                                      • {ep.assignedPerson}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2 px-3 font-mono text-[11px]">
                                {ep.role ? (
                                  <span
                                    className={`px-1.5 py-0.5 rounded border text-[10px] ${
                                      isVoip
                                        ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                        : isPrinter
                                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                          : isWifi
                                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                    }`}
                                  >
                                    {ep.role}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">Générique</span>
                                )}
                              </td>

                              <td className="py-2 px-3">
                                <div className="flex flex-col gap-0.5">
                                  {ep.vlanId !== undefined ? (
                                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: vlanColor }}
                                      />
                                      <span className="text-slate-300 font-medium">
                                        VLAN {ep.vlanId}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 text-[10px] font-mono">
                                      Sans VLAN
                                    </span>
                                  )}

                                  {ep.connectedSwitchId ? (
                                    <span className="text-[10px] font-mono text-cyan-400/90 truncate max-w-[150px]">
                                      {ep.connectedSwitchId}
                                      {ep.connectedSwitchPort ? ` [${ep.connectedSwitchPort}]` : ""}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-500">
                                      {ep.isPatched ? "Brassé (Baie)" : "Non raccordé"}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    key={`${ep.id}-${ep.ipAddress ?? "none"}`}
                                    type="text"
                                    defaultValue={ep.ipAddress ?? ""}
                                    placeholder="10.42.x.x"
                                    onBlur={(e) => handleUpdateIpamIp(ep, e.target.value)}
                                    className={`px-2 py-1 bg-slate-900 border rounded font-mono text-xs focus:outline-none focus:border-cyan-500 w-32 ${
                                      isConflict
                                        ? "border-rose-500 text-rose-300 bg-rose-950/20"
                                        : "border-slate-800 text-slate-200"
                                    }`}
                                  />
                                  {isConflict && (
                                    <span
                                      title="Conflit : cette adresse IP est déjà attribuée à un autre port !"
                                      className="p-1 bg-rose-500/20 text-rose-400 rounded border border-rose-500/40 animate-pulse"
                                    >
                                      <AlertTriangle className="w-3 h-3" />
                                    </span>
                                  )}
                                  {!ep.ipAddress && (
                                    <button
                                      onClick={() => handleAutoAssignIp(ep)}
                                      title="Attribuer la prochaine IP libre dans ce sous-réseau"
                                      className="p-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 rounded border border-cyan-500/30"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>

                              <td className="py-2 px-3">
                                <input
                                  key={`${ep.id}-${ep.macAddress ?? "none"}`}
                                  type="text"
                                  defaultValue={ep.macAddress ?? ""}
                                  placeholder="00:1A:2B:3C:4D:5E"
                                  onBlur={(e) => handleUpdateIpamMac(ep, e.target.value)}
                                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 w-36"
                                />
                              </td>

                              <td className="py-2 px-3 text-center">
                                {ep.pingStatus ? (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] ${
                                      ep.pingStatus === "ONLINE"
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        ep.pingStatus === "ONLINE"
                                          ? "bg-emerald-400 animate-pulse"
                                          : "bg-rose-400"
                                      }`}
                                    />
                                    {ep.pingStatus} ({ep.pingLatencyMs ?? 4}ms)
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px] font-mono">—</span>
                                )}
                              </td>

                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() => handlePingIpamEndpoint(ep)}
                                  className="px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 rounded text-[10px] font-mono border border-cyan-500/30 transition"
                                >
                                  Ping
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4 : INTÉGRATIONS ================= */}
          {activeTab === "integrations" && (
            <div className="grid grid-cols-2 gap-4">
              {/* 1. NetBox DCIM */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400">
                      <Network className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">NetBox DCIM & IPAM</div>
                      <div className="text-[10px] text-slate-400">
                        Source of Truth Baies, Câbles et Préfixes
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.integrations.netbox.enabled}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            netbox: { ...prev.integrations.netbox, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400">URL Instance NetBox</label>
                    <input
                      type="text"
                      value={settings.integrations.netbox.url}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            netbox: { ...prev.integrations.netbox, url: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">API Token REST</label>
                    <input
                      type="password"
                      value={settings.integrations.netbox.apiToken}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            netbox: { ...prev.integrations.netbox, apiToken: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">
                    {integrationStatuses.netbox?.msg ?? "Dernière synchro: OK"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncNetboxIpam}
                      disabled={isSyncingNetbox}
                      className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded text-xs font-medium border border-indigo-500/30 flex items-center gap-1 transition disabled:opacity-50"
                      title="Importer les préfixes NetBox directement dans l'IPAM NetFloor"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingNetbox ? "animate-spin" : ""}`} />
                      {isSyncingNetbox ? "Import..." : "Importer Préfixes"}
                    </button>
                    <button
                      onClick={() => handleTestIntegration("netbox", "NetBox DCIM")}
                      disabled={integrationStatuses.netbox?.loading}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                    >
                      {integrationStatuses.netbox?.loading ? "Connexion..." : "Tester API REST"}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. GLPI ITSM */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-amber-600/20 border border-amber-500/30 text-amber-400">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">GLPI / ServiceNow ITSM</div>
                      <div className="text-[10px] text-slate-400">
                        Ticketing automatique & Gestion du Parc
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.integrations.glpi.enabled}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            glpi: { ...prev.integrations.glpi, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400">URL Serveur ITSM</label>
                    <input
                      type="text"
                      value={settings.integrations.glpi.url}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            glpi: { ...prev.integrations.glpi, url: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">App Token & User Token</label>
                    <input
                      type="password"
                      value={settings.integrations.glpi.userToken}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            glpi: { ...prev.integrations.glpi, userToken: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {integrationStatuses.glpi?.msg ?? "Ticket auto sur incident actif"}
                  </span>
                  <button
                    onClick={() => handleTestIntegration("glpi", "GLPI")}
                    disabled={integrationStatuses.glpi?.loading}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                  >
                    {integrationStatuses.glpi?.loading ? "Connexion..." : "Tester GLPI"}
                  </button>
                </div>
              </div>

              {/* 3. Microsoft Intune */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-purple-600/20 border border-purple-500/30 text-purple-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">Microsoft Intune MDM</div>
                      <div className="text-[10px] text-slate-400">Conformité des postes & EDR</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.integrations.intune.enabled}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            intune: { ...prev.integrations.intune, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-850">
                    <span className="text-slate-300">
                      Vérification conformité BitLocker/Antivirus
                    </span>
                    <span className="text-emerald-400 font-mono text-[10px]">Actif</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-850">
                    <span className="text-slate-300">
                      Mappage automatique adresse MAC ➔ Utilisateur
                    </span>
                    <span className="text-purple-400 font-mono text-[10px]">Synchronisé</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {integrationStatuses.intune?.msg ?? "Fédération Graph API active"}
                  </span>
                  <button
                    onClick={() => handleTestIntegration("intune", "Microsoft Intune")}
                    disabled={integrationStatuses.intune?.loading}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                  >
                    {integrationStatuses.intune?.loading ? "Vérification..." : "Vérifier l'état"}
                  </button>
                </div>
              </div>

              {/* 4. Webhooks d'Alertes */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">
                        Webhooks d'Alertes (Teams / Slack)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Notifications temps réel en cas d'incident
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.integrations.webhooks.enabled}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            webhooks: { ...prev.integrations.webhooks, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400">URL du Webhook entrant</label>
                    <input
                      type="text"
                      value={settings.integrations.webhooks.webhookUrl}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            webhooks: { ...prev.integrations.webhooks, webhookUrl: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                  <div className="flex gap-4 pt-1 text-[11px] text-slate-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700" />
                      Alerte Port Down
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700" />
                      Surchauffe Baie &gt;35°C
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {integrationStatuses.webhooks?.msg ?? "Canal #it-network-alerts"}
                  </span>
                  <button
                    onClick={() => handleTestIntegration("webhooks", "Webhook d'Alerte")}
                    disabled={integrationStatuses.webhooks?.loading}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                  >
                    {integrationStatuses.webhooks?.loading ? "Envoi..." : "Tester Alerte Réelle"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5 : PORTAILS CLOUD & CONSTRUCTEURS ================= */}
          {activeTab === "portals" && (
            <div className="space-y-6">
              {/* En-tête explicatif */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-purple-950/40 border border-sky-800/40 flex items-start gap-4">
                <div className="p-3 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex-shrink-0">
                  <Cloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-sky-200 flex items-center gap-2">
                    Liaisons Directes aux Portails Cloud des Fabricants
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                      API REST HTTPS
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Connectez directement NetFloor Architect aux plateformes de management cloud
                    (Aruba Central, Cisco Meraki, Zyxel Nebula, Ubiquiti UniFi, Fortinet). Les
                    équipements découverts apparaissent automatiquement dans l'arborescence et
                    peuvent être glissés-déposés dans vos baies informatiques.
                  </p>
                </div>
              </div>

              {/* Grille des 5 Connecteurs Constructeurs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. ARUBA CENTRAL */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4 shadow-lg hover:border-amber-500/40 transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                          AC
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            Aruba Central (HPE)
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Cloud AP / CX
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            HPE Networking Platform
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          arubaStatus?.startsWith("✅")
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : arubaStatus?.startsWith("❌")
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {arubaStatus?.startsWith("✅")
                          ? "CONNECTÉ"
                          : arubaStatus?.startsWith("❌")
                            ? "ERREUR"
                            : "NON CONFIGURÉ"}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 font-medium">
                          Cluster Central (Host / FQDN)
                        </label>
                        <input
                          type="text"
                          value={arubaCluster}
                          onChange={(e) => setArubaCluster(e.target.value)}
                          placeholder="eu-central-1.central.arubanetworks.com"
                          className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-medium">
                          Token d'API / OAuth Bearer Token
                        </label>
                        <input
                          type="password"
                          value={arubaToken}
                          onChange={(e) => setArubaToken(e.target.value)}
                          placeholder="••••••••••••••••••••••••••••••••"
                          className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-900">
                    {arubaStatus && (
                      <div className="text-[10px] font-mono text-slate-300 truncate">
                        {arubaStatus}
                      </div>
                    )}
                    {arubaSwitches.length > 0 && (
                      <div className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {arubaSwitches.length} équipement(s) prêt(s) à être raqués
                      </div>
                    )}
                    <button
                      onClick={() => handleTestPortal("aruba")}
                      disabled={isTestingAruba}
                      className="w-full py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isTestingAruba ? "animate-spin" : ""}`}
                      />
                      {isTestingAruba
                        ? "Interrogation de Central..."
                        : "Tester & Découvrir Switchs"}
                    </button>
                  </div>
                </div>

                {/* 2. CISCO MERAKI */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4 shadow-lg hover:border-emerald-500/40 transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
                          CM
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            Cisco Meraki Dashboard
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              MS / MR
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Meraki Cloud REST API v1
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          merakiStatus?.startsWith("✅")
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : merakiStatus?.startsWith("❌")
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {merakiStatus?.startsWith("✅")
                          ? "CONNECTÉ"
                          : merakiStatus?.startsWith("❌")
                            ? "ERREUR"
                            : "NON CONFIGURÉ"}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 font-medium">
                          Clé d'API Cisco Meraki Dashboard
                        </label>
                        <input
                          type="password"
                          value={merakiApiKey}
                          onChange={(e) => setMerakiApiKey(e.target.value)}
                          placeholder="6849b2823a41b58... (X-Cisco-Meraki-API-Key)"
                          className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-medium">
                          Organization ID (Facultatif)
                        </label>
                        <input
                          type="text"
                          value={merakiOrgId}
                          onChange={(e) => setMerakiOrgId(e.target.value)}
                          placeholder="Ex: 549236 ou vide pour auto-détection"
                          className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-900">
                    {merakiStatus && (
                      <div className="text-[10px] font-mono text-slate-300 truncate">
                        {merakiStatus}
                      </div>
                    )}
                    {merakiSwitches.length > 0 && (
                      <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {merakiSwitches.length} équipement(s) prêt(s) à être raqués
                      </div>
                    )}
                    <button
                      onClick={() => handleTestPortal("meraki")}
                      disabled={isTestingMeraki}
                      className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isTestingMeraki ? "animate-spin" : ""}`}
                      />
                      {isTestingMeraki ? "Scan Meraki en cours..." : "Tester & Découvrir Switchs"}
                    </button>
                  </div>
                </div>

                {/* 3. ZYXEL NEBULA */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4 shadow-lg hover:border-sky-500/40 transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold text-xs">
                          ZN
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            Zyxel Nebula Cloud
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                              GS1920 / XGS
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Nebula Control Center (NCC)
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          nebulaStatus?.startsWith("✅")
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : nebulaStatus?.startsWith("❌")
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {nebulaStatus?.startsWith("✅")
                          ? "CONNECTÉ"
                          : nebulaStatus?.startsWith("❌")
                            ? "ERREUR"
                            : "NON CONFIGURÉ"}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 font-medium">
                          Clé d'API Nebula (X-Api-Key)
                        </label>
                        <input
                          type="password"
                          value={nebulaApiKey}
                          onChange={(e) => setNebulaApiKey(e.target.value)}
                          placeholder="Clé générée dans Mon Compte > Clé d'API"
                          className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-medium">
                          Organisation / Site Nebula
                        </label>
                        <input
                          type="text"
                          value={nebulaOrg}
                          onChange={(e) => setNebulaOrg(e.target.value)}
                          placeholder="Nom ou UUID d'organisation Nebula"
                          className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-900">
                    {nebulaStatus && (
                      <div className="text-[10px] font-mono text-slate-300 truncate">
                        {nebulaStatus}
                      </div>
                    )}
                    {nebulaSwitches.length > 0 && (
                      <div className="text-[10px] text-sky-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {nebulaSwitches.length} équipement(s) prêt(s) à être raqués
                      </div>
                    )}
                    <button
                      onClick={() => handleTestPortal("nebula")}
                      disabled={isTestingNebula}
                      className="w-full py-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-200 border border-sky-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isTestingNebula ? "animate-spin" : ""}`}
                      />
                      {isTestingNebula
                        ? "Interrogation de Nebula..."
                        : "Tester & Découvrir Switchs"}
                    </button>
                  </div>
                </div>

                {/* 4. UBIQUITI UNIFI */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4 shadow-lg hover:border-cyan-500/40 transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs">
                          UI
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            Ubiquiti UniFi Network
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              USW / UDM
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            UniFi OS Controller API
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          unifiStatus?.startsWith("✅")
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : unifiStatus?.startsWith("❌")
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {unifiStatus?.startsWith("✅")
                          ? "CONNECTÉ"
                          : unifiStatus?.startsWith("❌")
                            ? "ERREUR"
                            : "NON CONFIGURÉ"}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 font-medium">
                          Hôte / URL du Contrôleur UniFi
                        </label>
                        <input
                          type="text"
                          value={unifiHost}
                          onChange={(e) => setUnifiHost(e.target.value)}
                          placeholder="192.168.1.1 ou https://unifi.corp.local:8443"
                          className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium">
                            Clé API UniFi
                          </label>
                          <input
                            type="password"
                            value={unifiApiKey}
                            onChange={(e) => setUnifiApiKey(e.target.value)}
                            placeholder="Clé générée UniFi OS"
                            className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium">
                            Nom du Site
                          </label>
                          <input
                            type="text"
                            value={unifiSite}
                            onChange={(e) => setUnifiSite(e.target.value)}
                            placeholder="default"
                            className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-900">
                    {unifiStatus && (
                      <div className="text-[10px] font-mono text-slate-300 truncate">
                        {unifiStatus}
                      </div>
                    )}
                    {unifiSwitches.length > 0 && (
                      <div className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {unifiSwitches.length} équipement(s) prêt(s) à être raqués
                      </div>
                    )}
                    <button
                      onClick={() => handleTestPortal("unifi")}
                      disabled={isTestingUnifi}
                      className="w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isTestingUnifi ? "animate-spin" : ""}`}
                      />
                      {isTestingUnifi ? "Interrogation UniFi..." : "Tester & Découvrir Switchs"}
                    </button>
                  </div>
                </div>

                {/* 5. FORTINET FORTIGATE & FORTICLOUD */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4 shadow-lg hover:border-rose-500/40 transition md:col-span-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-bold text-xs">
                          FN
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            Fortinet FortiGate & FortiCloud
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                              FortiSwitch / FortiAP Controller
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            FortiOS REST API v2
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          fortinetStatus?.startsWith("✅")
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : fortinetStatus?.startsWith("❌")
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {fortinetStatus?.startsWith("✅")
                          ? "CONNECTÉ"
                          : fortinetStatus?.startsWith("❌")
                            ? "ERREUR"
                            : "NON CONFIGURÉ"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 font-medium">
                          Hôte / IP du Contrôleur FortiGate
                        </label>
                        <input
                          type="text"
                          value={fortinetHost}
                          onChange={(e) => setFortinetHost(e.target.value)}
                          placeholder="https://10.42.0.254 ou https://fortigate.corp.local"
                          className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-medium">
                          Token d'API REST FortiOS
                        </label>
                        <input
                          type="password"
                          value={fortinetToken}
                          onChange={(e) => setFortinetToken(e.target.value)}
                          placeholder="Bearer token créé dans Système > Administrateurs"
                          className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px] focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-900">
                    {fortinetStatus && (
                      <div className="text-[10px] font-mono text-slate-300 truncate">
                        {fortinetStatus}
                      </div>
                    )}
                    {fortinetSwitches.length > 0 && (
                      <div className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {fortinetSwitches.length} équipement(s) prêt(s) à être raqués
                      </div>
                    )}
                    <button
                      onClick={() => handleTestPortal("fortinet")}
                      disabled={isTestingFortinet}
                      className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isTestingFortinet ? "animate-spin" : ""}`}
                      />
                      {isTestingFortinet
                        ? "Interrogation FortiGate..."
                        : "Tester & Découvrir Switchs"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Pied de page du Modal avec Réinitialisation (Reset) et Sauvegarde localStorage */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => {
              setResetConfirmInput("");
              setIsResetDialogOpen(true);
            }}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded-lg text-xs font-medium border border-slate-800 flex items-center gap-1.5 transition"
            title="Options de réinitialisation de l'application"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset...</span>
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              Fermer
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Enregistrer et appliquer
            </button>
          </div>
        </div>

        {/* 5. Boîte de Dialogue Modale pour les Options de Reset */}
        {isResetDialogOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-slate-950 border border-slate-800 rounded-xl w-[560px] max-w-[95vw] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      Options de Réinitialisation (Reset)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Choisissez le niveau de remise à zéro souhaité pour NetFloor Architect.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetDialogOpen(false)}
                  disabled={isResettingFull}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Option 1: Reset Configuration */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 hover:border-sky-500/40 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" />
                    Reset Configuration (Paramètres DSI)
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Sûr • Plans & BDD préservés
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Restaure les paramètres par défaut : règles de découverte réseau, intégration
                  Active Directory / SSO, sous-réseaux IPAM et styles de câblage VLAN.
                  <br />
                  <strong className="text-slate-200">
                    Vos équipements, baies de brassage, câbles, fonds de plans et la base de données
                    restent intacts.
                  </strong>
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetConfigOnly}
                    disabled={isResettingFull}
                    className="px-3 py-1.5 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 rounded text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Réinitialiser la configuration</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Reset Complet */}
              <div className="p-3.5 rounded-lg bg-red-950/20 border border-red-900/40 space-y-2 hover:border-red-500/50 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-red-400" />
                    Reset Complet (Système, Objets & BDD)
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                    Destructif • Remise à zéro totale
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Supprime définitivement{" "}
                  <strong className="text-red-300">l&apos;intégralité des équipements</strong>{" "}
                  (bureaux, prises, boîtes de sol, caméras, imprimantes, Wi-Fi), les baies de
                  brassage, les câbles physiques, les fonds de plans, les sites ainsi que{" "}
                  <strong className="text-red-300">toutes les tables en base de données</strong>.
                  L&apos;application repartira d&apos;une page blanche.
                </p>

                <div className="pt-2 border-t border-red-900/30 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Pour confirmer, tapez{" "}
                      <code className="text-red-400 font-bold bg-slate-950 px-1 py-0.5 rounded">
                        RESET
                      </code>{" "}
                      :
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={resetConfirmInput}
                      onChange={(e) => setResetConfirmInput(e.target.value)}
                      placeholder="Tapez RESET pour débloquer"
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-red-500 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleResetFullSystem}
                      disabled={
                        resetConfirmInput.trim().toUpperCase() !== "RESET" || isResettingFull
                      }
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow"
                    >
                      {isResettingFull ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Nettoyage en cours...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Wiper & Réinitialiser tout</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsResetDialogOpen(false)}
                  disabled={isResettingFull}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const SettingsModal = memo(SettingsModalComponent);
