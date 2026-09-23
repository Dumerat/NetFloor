"use client";

import { useState, useEffect, useMemo, memo, type FC } from "react";
import {
  Monitor,
  Users,
  Briefcase,
  Layers,
  Phone,
  Laptop,
  Server,
  Wifi,
  Printer,
  ChevronLeft,
  ChevronRight,
  Plus,
  PlusCircle,
  Sparkles,
  Sliders,
  Plug,
  GripVertical,
  Network,
  Camera,
  Radio,
  Boxes,
  Building2,
  Shield,
  HardDrive,
  Search,
  Zap,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  OutletRole,
  NodeSubType,
  PoeMode,
  RackDisplay,
  NodeDisplay,
  IotCustomProperties,
} from "@/components/canvas/EquipmentLayer";
import type { VlanStyle } from "@/data/vlanStyles";

export type PaletteCategory = "FURNITURE" | "CONNECTIVITY" | "IOT" | "INFRASTRUCTURE";

export interface PaletteItem {
  id: string;
  category: PaletteCategory;
  name: string;
  subType: NodeSubType;
  targetType: "DESK" | "WALL_OUTLET" | "PATCH_PANEL" | "SWITCH";
  outletRole?: OutletRole | undefined;
  widthMm: number;
  heightMm: number;
  description: string;
  personaTag: "RH" | "MAINTENANCE" | "DSI";
  iconName: string;
  customEmote?: string | undefined;
  isCustomProfile?: boolean | undefined;
  portCount?: number | undefined;
  vlanId?: number | undefined;
  poeMode?: PoeMode | undefined;
  customPortCount?: number | undefined;
  customPoeMode?: PoeMode | undefined;
  customVlanId?: number | undefined;
  customUHeight?: number | undefined;
  iotProperties?: IotCustomProperties | undefined;
}

export type ScannedDeviceType =
  | "SWITCH"
  | "ROUTER"
  | "SERVER"
  | "PATCH_PANEL"
  | "FIREWALL"
  | "PDU"
  | "ACCESS_POINT"
  | "PRINTER"
  | "WORKSTATION"
  | "CAMERA"
  | "PHONE_VOIP";

export interface ScannedDeviceItem {
  id: string;
  name: string;
  ip: string;
  mac: string;
  model: string;
  manufacturer: string;
  deviceType: ScannedDeviceType;
  portsCount: number;
  uSize?: number | undefined;
  status: "ONLINE" | "OFFLINE" | "SYNCED";
  poeBudgetW?: number | undefined;
}

export function inferScannedDeviceProfile(d: {
  hostname?: string | null;
  name?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  sysDescr?: string | null;
  deviceType?: string | null;
  metadata?: any;
}): {
  deviceType: ScannedDeviceType;
  portsCount: number;
  uSize: number;
  isRackable: boolean;
} {
  const combined =
    `${d.hostname || ""} ${d.name || ""} ${d.model || ""} ${d.sysDescr || ""} ${d.manufacturer || ""}`.toLowerCase();
  const rawType = (d.deviceType || "").toUpperCase();

  // 1. Point d'accès Wi-Fi (AP)
  if (
    rawType === "ACCESS_POINT" ||
    combined.includes("access point") ||
    combined.includes("ap-") ||
    combined.includes("arubaap") ||
    combined.includes("uap") ||
    combined.includes("aironet") ||
    combined.includes("meraki mr") ||
    combined.includes("wireless") ||
    (d.hostname || "").toLowerCase().startsWith("ap-") ||
    (d.hostname || "").toLowerCase().startsWith("ap_")
  ) {
    return {
      deviceType: "ACCESS_POINT",
      portsCount: d.metadata?.portsCount || 1,
      uSize: 0,
      isRackable: false,
    };
  }

  // 2. Caméra IP de vidéosurveillance
  if (
    rawType === "CAMERA" ||
    combined.includes("camera") ||
    combined.includes("caméra") ||
    combined.includes("cam-") ||
    combined.includes("hikvision") ||
    combined.includes("dahua") ||
    combined.includes("axis") ||
    combined.includes("surveillance") ||
    combined.includes("nvr") ||
    (d.hostname || "").toLowerCase().startsWith("cam-") ||
    (d.hostname || "").toLowerCase().startsWith("cam_")
  ) {
    return {
      deviceType: "CAMERA",
      portsCount: d.metadata?.portsCount || 1,
      uSize: 0,
      isRackable: false,
    };
  }

  // 3. Postes de travail / PC client / Workstations
  if (
    rawType === "WORKSTATION" ||
    combined.includes("workstation") ||
    combined.includes("optiplex") ||
    combined.includes("thinkcentre") ||
    combined.includes("latitude") ||
    combined.includes("elitebook") ||
    combined.includes("macbook") ||
    combined.includes("desktop") ||
    combined.includes("laptop") ||
    (d.hostname || "").toLowerCase().startsWith("pc-") ||
    (d.hostname || "").toLowerCase().startsWith("pc_") ||
    (d.hostname || "").toLowerCase().startsWith("pc ") ||
    (d.name || "").toLowerCase().startsWith("pc-") ||
    (d.name || "").toLowerCase().startsWith("pc_") ||
    (d.name || "").toLowerCase().startsWith("pc ") ||
    combined.includes("pc dir") ||
    combined.includes("direction") ||
    combined.includes("poste ")
  ) {
    return {
      deviceType: "WORKSTATION",
      portsCount: d.metadata?.portsCount || 1,
      uSize: 0,
      isRackable: false,
    };
  }

  // 4. Téléphonie VoIP
  if (
    rawType === "PHONE_VOIP" ||
    combined.includes("phone") ||
    combined.includes("voip") ||
    combined.includes("sip") ||
    combined.includes("yealink")
  ) {
    return {
      deviceType: "PHONE_VOIP",
      portsCount: d.metadata?.portsCount || 1,
      uSize: 0,
      isRackable: false,
    };
  }

  // 5. Imprimante / Copieur
  if (
    rawType === "PRINTER" ||
    combined.includes("printer") ||
    combined.includes("copieur") ||
    combined.includes("laserjet")
  ) {
    return {
      deviceType: "PRINTER",
      portsCount: d.metadata?.portsCount || 1,
      uSize: 0,
      isRackable: false,
    };
  }

  // 6. Serveur
  if (
    rawType === "SERVER" ||
    combined.includes("poweredge") ||
    combined.includes("proliant") ||
    combined.includes("esxi") ||
    combined.includes("hyperviseur") ||
    combined.includes("linux") ||
    combined.includes("windows server")
  ) {
    const u = d.metadata?.uSize || (combined.includes("1u") || combined.includes("r6") ? 1 : 2);
    return {
      deviceType: "SERVER",
      portsCount: d.metadata?.portsCount || 4,
      uSize: u,
      isRackable: true,
    };
  }

  // 7. Firewall / Routeur
  if (
    rawType === "FIREWALL" ||
    rawType === "ROUTER" ||
    combined.includes("fortigate") ||
    combined.includes("firewall") ||
    combined.includes("firepower") ||
    combined.includes("asa") ||
    combined.includes("pfsense") ||
    combined.includes("palo alto")
  ) {
    return {
      deviceType: "FIREWALL",
      portsCount: d.metadata?.portsCount || 10,
      uSize: d.metadata?.uSize || 1,
      isRackable: true,
    };
  }

  // 8. Panneau de Brassage
  if (rawType === "PATCH_PANEL" || combined.includes("panneau") || combined.includes("brassage")) {
    return {
      deviceType: "PATCH_PANEL",
      portsCount: d.metadata?.portsCount || 24,
      uSize: 1,
      isRackable: true,
    };
  }

  // 9. Onduleur (UPS) & PDU
  const isUpsDevice =
    combined.includes("ups") ||
    combined.includes("onduleur") ||
    combined.includes("smart-ups") ||
    combined.includes("eaton") ||
    combined.includes("apc") ||
    combined.includes("riello") ||
    combined.includes("socomec") ||
    combined.includes("vertiv") ||
    combined.includes("liebert");

  if (rawType === "PDU" || rawType === "UPS" || combined.includes("pdu") || isUpsDevice) {
    const isOnduleur = isUpsDevice && !combined.includes("rack pdu");
    return {
      deviceType: "PDU",
      portsCount: isOnduleur ? 1 : d.metadata?.portsCount || 8,
      uSize: d.metadata?.uSize && d.metadata.uSize > 0 ? d.metadata.uSize : isOnduleur ? 2 : 1,
      isRackable: true,
    };
  }

  // 7. Switchs (détection ports et U)
  let ports = d.metadata?.portsCount;
  if (!ports) {
    if (
      combined.includes("48p") ||
      combined.includes("48g") ||
      combined.includes("-48-") ||
      combined.includes(" 48") ||
      combined.includes("48hp")
    ) {
      ports = 48;
    } else if (
      combined.includes("8p") ||
      combined.includes("8g") ||
      combined.includes("-8-") ||
      combined.includes(" 8")
    ) {
      ports = 8;
    } else if (
      combined.includes("16p") ||
      combined.includes("16g") ||
      combined.includes("-16-") ||
      combined.includes(" 16")
    ) {
      ports = 16;
    } else if (combined.includes("52p") || combined.includes("52g") || combined.includes("-52-")) {
      ports = 52;
    } else {
      ports = 24;
    }
  }

  const u =
    d.metadata?.uSize ||
    (combined.includes("9400") || combined.includes("5406") || combined.includes("6500") ? 4 : 1);

  return {
    deviceType: "SWITCH",
    portsCount: ports,
    uSize: u,
    isRackable: true,
  };
}

export function isDeviceMatch(
  item: {
    id?: string | undefined;
    name?: string | undefined;
    ip?: string | undefined;
    ipAddress?: string | undefined;
    mac?: string | undefined;
    macAddress?: string | undefined;
  },
  scanned: {
    id: string;
    name?: string | undefined;
    ip?: string | undefined;
    mac?: string | undefined;
  }
): boolean {
  const itemId = item.id || "";
  if (
    itemId === scanned.id ||
    itemId === `dev-${scanned.id}` ||
    itemId.startsWith(`dev-${scanned.id}-`) ||
    itemId === `disc-${scanned.id}` ||
    (itemId.startsWith("disc-") && scanned.id.startsWith("disc-") && itemId === scanned.id)
  ) {
    return true;
  }
  const itemMac = (item.mac || item.macAddress || "").trim().toLowerCase();
  const scannedMac = (scanned.mac || "").trim().toLowerCase();
  if (
    itemMac &&
    scannedMac &&
    itemMac !== "non applicable" &&
    scannedMac !== "non applicable" &&
    itemMac === scannedMac
  ) {
    return true;
  }
  const itemIp = (item.ip || item.ipAddress || "").trim();
  const scannedIp = (scanned.ip || "").trim();
  if (
    itemIp &&
    scannedIp &&
    itemIp !== "passif" &&
    scannedIp !== "passif" &&
    itemIp === scannedIp
  ) {
    return true;
  }
  if (
    item.name &&
    scanned.name &&
    item.name.trim().toLowerCase() === scanned.name.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export const DEFAULT_SCANNED_DEVICES: ScannedDeviceItem[] = [];

export const PALETTE_CATALOG: PaletteItem[] = [
  // 1. Mobilier (RH & Espace)
  {
    id: "furniture-desk-solo",
    category: "FURNITURE",
    name: "Bureau Solo Standard",
    subType: "DESK_SOLO",
    targetType: "DESK",
    widthMm: 1600,
    heightMm: 800,
    description: "Échelle standard NF Environnement (1.60 × 0.80 m)",
    personaTag: "RH",
    iconName: "Monitor",
  },
  {
    id: "furniture-bench-double",
    category: "FURNITURE",
    name: "Bench Double Face-à-Face",
    subType: "BENCH_DOUBLE",
    targetType: "DESK",
    widthMm: 1600,
    heightMm: 1600,
    description: "2 postes avec cloisonnette centrale (1.60 × 1.60 m)",
    personaTag: "RH",
    iconName: "Users",
  },
  {
    id: "furniture-bench-quad",
    category: "FURNITURE",
    name: "Îlot Bench 4 Postes",
    subType: "BENCH_QUAD",
    targetType: "DESK",
    widthMm: 3200,
    heightMm: 1600,
    description: "Îlot collaboratif pour 4 personnes (3.20 × 1.60 m)",
    personaTag: "RH",
    iconName: "Users",
  },
  {
    id: "furniture-meeting",
    category: "FURNITURE",
    name: "Table de Réunion (6p)",
    subType: "MEETING_TABLE",
    targetType: "DESK",
    widthMm: 2400,
    heightMm: 1200,
    description: "Table de réunion ovale (2.40 × 1.20 m)",
    personaTag: "RH",
    iconName: "Users",
  },

  // 2. Connectique & Prises (Maintenance & Câblage) - Prise RJ45 & Bloc de prises RJ45
  {
    id: "conn-rj45-single",
    category: "CONNECTIVITY",
    name: "Prise RJ45",
    subType: "WALL_OUTLET",
    targetType: "WALL_OUTLET",
    outletRole: "GENERIC",
    widthMm: 250,
    heightMm: 250,
    description: "Prise RJ45 Cat6A unitaire passive (propriétés dynamiques selon switch)",
    personaTag: "MAINTENANCE",
    iconName: "Plug",
    portCount: 1,
    poeMode: "NONE",
  },
  {
    id: "conn-socket-block",
    category: "CONNECTIVITY",
    name: "Bloc de prises RJ45",
    subType: "SOCKET_BLOCK",
    targetType: "WALL_OUTLET",
    outletRole: "GENERIC",
    widthMm: 340,
    heightMm: 255,
    description: "Regroupement visuel de 4 ports RJ45 (supporte 2 à 8 ports, glisser-déposer)",
    personaTag: "MAINTENANCE",
    iconName: "Layers",
    portCount: 4,
    poeMode: "NONE",
  },

  // 3. Objets Connectés & Terminaux IOT (Sécurité, Impression, Wi-Fi, Capteurs)
  {
    id: "iot-wifi-ap",
    category: "IOT",
    name: "Borne Wi-Fi 6 (Ceiling AP)",
    subType: "WIFI_AP",
    targetType: "WALL_OUTLET",
    outletRole: "WIFI",
    widthMm: 350,
    heightMm: 350,
    description: "Point d'accès plafonnier PoE+ (VLAN 50 Wi-Fi, Halo radio)",
    personaTag: "DSI",
    iconName: "Wifi",
    portCount: 1,
    poeMode: "POE_PLUS",
    vlanId: 50,
    customEmote: "📶",
    iotProperties: {
      deviceCategory: "WIFI_AP",
      ssid: "NetFloor-Corp-WiFi",
      secondarySsid: "NetFloor-Guests",
      wifiStandard: "Wi-Fi 6 (802.11ax)",
      frequencyBand: "DUAL_BAND",
      channel: 36,
      txPowerDbm: 20,
      coverageRadiusM: 15,
      activeClientsCount: 8,
      maxClients: 64,
    },
  },
  {
    id: "iot-printer-station",
    category: "IOT",
    name: "Copieur / Imprimante Réseau",
    subType: "PRINTER_STATION",
    targetType: "WALL_OUTLET",
    outletRole: "PRINTER",
    widthMm: 800,
    heightMm: 700,
    description: "Station d'impression d'étage sécurisée Badge/IP (VLAN 40, Toners CMJN)",
    personaTag: "DSI",
    iconName: "Printer",
    portCount: 1,
    poeMode: "NONE",
    vlanId: 40,
    customEmote: "🖨️",
    iotProperties: {
      deviceCategory: "PRINTER",
      printerModel: "Multifonction Réseau A3/A4",
      protocol: "IPP_IPPS",
      tonerCyan: 75,
      tonerMagenta: 80,
      tonerYellow: 65,
      tonerBlack: 90,
      paperTrayStatus: "OK",
      totalPagesPrinted: 14250,
      colorPrintingAllowed: true,
    },
  },
  {
    id: "iot-camera-ip",
    category: "IOT",
    name: "Caméra IP Dôme Sécurité",
    subType: "CAMERA_IP",
    targetType: "WALL_OUTLET",
    outletRole: "CAMERA",
    widthMm: 300,
    heightMm: 300,
    description: "Caméra de surveillance dôme 4K PoE (Cône FOV directionnel, IR)",
    personaTag: "DSI",
    iconName: "Camera",
    portCount: 1,
    poeMode: "POE",
    vlanId: 50,
    customEmote: "🎥",
    iotProperties: {
      deviceCategory: "CAMERA",
      cameraModel: "Dôme IP Sécurité 4K",
      resolution: "4K Ultra HD",
      fps: 30,
      codec: "H.265",
      fovDegrees: 110,
      orientationDeg: 90,
      nightVisionEnabled: true,
      recordingMode: "CONTINUOUS",
    },
  },
  {
    id: "iot-sensor-env",
    category: "IOT",
    name: "Capteur IOT Climat & Présence",
    subType: "GENERIC_PORT",
    targetType: "WALL_OUTLET",
    outletRole: "GENERIC",
    widthMm: 200,
    heightMm: 200,
    description: "Capteur environnemental IoT autonome (Température, PIR, CO2, MQTT)",
    personaTag: "DSI",
    iconName: "Radio",
    portCount: 1,
    poeMode: "NONE",
    vlanId: 20,
    customEmote: "⚡",
    iotProperties: {
      deviceCategory: "IOT_SENSOR",
      sensorType: "PRESENCE",
      batteryLevelPercent: 95,
      protocolType: "MQTT",
      lastTelemetryValue: "21.5°C / 48% HR",
    },
  },
];

interface EquipmentPaletteProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddItem: (item: PaletteItem) => void;
  onOpenSettings?: (() => void) | undefined;
  onOpenSites?: (() => void) | undefined;
  isSitesOpen?: boolean | undefined;
  sitesContent?: React.ReactNode | undefined;
  onOpenTopology?: (() => void) | undefined;
  isTopologyOpen?: boolean | undefined;
  onOpenInventory?: (() => void) | undefined;
  isInventoryOpen?: boolean | undefined;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  width?: number | undefined;
  onResizeStart?: ((e: React.MouseEvent) => void) | undefined;
  topologyContent?: React.ReactNode | undefined;
  inventoryContent?: React.ReactNode | undefined;
  onOpenBatchSpawner?: (() => void) | undefined;
  racks?: RackDisplay[] | undefined;
  nodes?: NodeDisplay[] | undefined;
  selectedRackId?: string | null | undefined;
  onInsertScannedDevice?:
    ((rackId: string, device: ScannedDeviceItem, slotU?: number) => void) | undefined;
  onAutoDeployDiscoveredTopology?: (() => Promise<void> | void) | undefined;
}

const EquipmentPaletteComponent: FC<EquipmentPaletteProps> = ({
  isOpen,
  onToggle,
  onAddItem,
  onOpenSettings,
  onOpenSites,
  isSitesOpen = false,
  sitesContent,
  onOpenTopology,
  isTopologyOpen = false,
  onOpenInventory,
  isInventoryOpen = false,
  width = 340,
  onResizeStart,
  topologyContent,
  inventoryContent,
  onOpenBatchSpawner,
  racks = [],
  nodes = [],
  selectedRackId,
  onInsertScannedDevice,
  onAutoDeployDiscoveredTopology,
}) => {
  const isDrawerOpen = isOpen || isTopologyOpen || isInventoryOpen || isSitesOpen;
  // 4 sous-menus d'équipements : Mobilier, Prises, IOT, Infra/Baies
  const [selectedCategory, setSelectedCategory] = useState<PaletteCategory>("FURNITURE");

  // Configuration de la Baie Custom (en haut de l'onglet Infra/Baies)
  const [customRackName, setCustomRackName] = useState(`BAIE-DSI-0${(racks?.length ?? 0) + 1}`);
  const [customRackU, setCustomRackU] = useState<number>(42);
  const [customRackFormat, setCustomRackFormat] = useState<"STD" | "COMPACT">("STD");

  // Équipements scannés & découverts (en dessous de Baie Custom)
  const [scannedDevices, setScannedDevices] = useState<ScannedDeviceItem[]>([]);
  const [isRefreshingDiscovery, setIsRefreshingDiscovery] = useState(false);
  const [isPurgingDiscovery, setIsPurgingDiscovery] = useState(false);
  const [scannedFilterType, setScannedFilterType] = useState<string>("ALL");
  const [scannedSearchQuery, setScannedSearchQuery] = useState("");

  // Mise à jour automatique du nom suggéré de baie si le nombre de baies change
  useEffect(() => {
    setCustomRackName(`BAIE-DSI-0${(racks?.length ?? 0) + 1}`);
  }, [racks?.length]);

  // Récupération dynamique des équipements découverts par l'API de découverte avec inférence de profil
  const refreshDiscoveredDevices = async () => {
    setIsRefreshingDiscovery(true);
    try {
      const res = await fetch("/api/discovery/status?allDevices=true");
      if (!res.ok) {
        setScannedDevices([]);
        return;
      }
      const data = await res.json();
      if (data?.success && Array.isArray(data.devices)) {
        const seenKeys = new Set<string>();
        const dedupedApiDevices: ScannedDeviceItem[] = [];

        for (const d of data.devices) {
          const normMac = d.macAddress ? d.macAddress.trim().toLowerCase() : "";
          const normIp = d.ipAddress ? d.ipAddress.trim() : "";
          const normName = (d.hostname || d.name || "").trim().toLowerCase();
          const key = normMac || (normIp ? `ip:${normIp}` : `name:${normName || d.id}`);
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const profile = inferScannedDeviceProfile(d);
          dedupedApiDevices.push({
            id: `disc-${d.id}`,
            name: d.hostname || d.model || `Équipement ${d.ipAddress}`,
            ip: d.ipAddress,
            mac: d.macAddress,
            model: d.model || d.sysDescr?.slice(0, 45) || `${profile.deviceType} Découvert`,
            manufacturer: d.manufacturer || "Constructeur Découvert",
            deviceType: profile.deviceType,
            portsCount: profile.portsCount,
            uSize: profile.uSize,
            status: "ONLINE",
          });
        }
        setScannedDevices(dedupedApiDevices);
      } else {
        setScannedDevices([]);
      }
    } catch {
      setScannedDevices([]);
    } finally {
      setIsRefreshingDiscovery(false);
    }
  };

  useEffect(() => {
    refreshDiscoveredDevices();

    const handleDiscoveryUpdated = () => {
      refreshDiscoveredDevices();
    };
    const handleResetAll = () => {
      setScannedDevices([]);
    };

    window.addEventListener("netfloor_discovery_updated", handleDiscoveryUpdated);
    window.addEventListener("netfloor_full_reset", handleResetAll);

    return () => {
      window.removeEventListener("netfloor_discovery_updated", handleDiscoveryUpdated);
      window.removeEventListener("netfloor_full_reset", handleResetAll);
    };
  }, []);

  const handlePurgeScannedDevices = async () => {
    if (!window.confirm("Voulez-vous vraiment purger tous les équipements découverts ?")) {
      return;
    }
    setIsPurgingDiscovery(true);
    try {
      await fetch("/api/discovery/status", { method: "DELETE" });
      setScannedDevices([]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("netfloor_discovery_updated"));
      }
    } catch (err) {
      console.error("Erreur lors de la purge :", err);
    } finally {
      setIsPurgingDiscovery(false);
    }
  };

  const filteredItems = PALETTE_CATALOG.filter((item) => item.category === selectedCategory);

  const selectedRack = useMemo(() => {
    if (!selectedRackId || !racks) return null;
    return racks.find((r) => r.id === selectedRackId) || null;
  }, [racks, selectedRackId]);

  // Détection si un équipement est déjà placé (dans une baie ou sur le plan)
  const getDevicePlacement = (
    dev: ScannedDeviceItem
  ): { isPlaced: boolean; locationLabel: string; rackId?: string; slotU?: number } | null => {
    if (racks && racks.length > 0) {
      for (const r of racks) {
        const found = (r.devices || []).find((d) => isDeviceMatch(d, dev));
        if (found) {
          return {
            isPlaced: true,
            locationLabel: `📍 Placé : ${r.name} (U${found.slotU})`,
            rackId: r.id,
            slotU: found.slotU,
          };
        }
      }
    }
    if (nodes && nodes.length > 0) {
      for (const n of nodes) {
        if (isDeviceMatch(n, dev)) {
          return {
            isPlaced: true,
            locationLabel: `📍 Placé sur plan`,
          };
        }
      }
    }
    return null;
  };

  const filteredScannedDevices = useMemo(() => {
    return scannedDevices.filter((dev) => {
      // Filtrer les équipements non rackables (bornes Wi-Fi, imprimantes, postes, caméras, voip)
      if (
        dev.uSize === 0 ||
        dev.deviceType === "ACCESS_POINT" ||
        dev.deviceType === "PRINTER" ||
        dev.deviceType === "WORKSTATION" ||
        dev.deviceType === "CAMERA" ||
        dev.deviceType === "PHONE_VOIP"
      ) {
        return false;
      }
      if (scannedFilterType === "SWITCHS" && dev.deviceType !== "SWITCH") return false;
      if (scannedFilterType === "FIREWALLS" && dev.deviceType !== "FIREWALL") return false;
      if (scannedFilterType === "SERVEURS" && dev.deviceType !== "SERVER") return false;
      if (
        scannedFilterType === "BRASSAGE" &&
        dev.deviceType !== "PATCH_PANEL" &&
        dev.deviceType !== "PDU"
      )
        return false;
      if (scannedSearchQuery.trim()) {
        const q = scannedSearchQuery.toLowerCase();
        const match =
          dev.name.toLowerCase().includes(q) ||
          dev.model.toLowerCase().includes(q) ||
          dev.ip.toLowerCase().includes(q) ||
          dev.mac.toLowerCase().includes(q) ||
          dev.manufacturer.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [scannedDevices, scannedFilterType, scannedSearchQuery]);

  const iotScannedDevices = useMemo(() => {
    return scannedDevices.filter(
      (dev) =>
        dev.deviceType === "ACCESS_POINT" ||
        dev.deviceType === "PRINTER" ||
        dev.deviceType === "CAMERA" ||
        dev.deviceType === "WORKSTATION" ||
        dev.deviceType === "PHONE_VOIP" ||
        dev.uSize === 0
    );
  }, [scannedDevices]);

  const renderIcon = (iconName: string, className: string = "w-4 h-4") => {
    switch (iconName) {
      case "Monitor":
        return <Monitor className={className} />;
      case "Briefcase":
        return <Briefcase className={className} />;
      case "Users":
        return <Users className={className} />;
      case "Laptop":
        return <Laptop className={className} />;
      case "Phone":
        return <Phone className={className} />;
      case "Plug":
        return <Plug className={className} />;
      case "Server":
        return <Server className={className} />;
      case "Wifi":
        return <Wifi className={className} />;
      case "Printer":
        return <Printer className={className} />;
      case "Camera":
        return <Camera className={className} />;
      case "Radio":
        return <Radio className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  // Génération d'une image de drag & drop représentant visuellement l'objet lui-même
  const setupDragPreview = (e: React.DragEvent, item: PaletteItem) => {
    const isDesk = item.category === "FURNITURE";
    const isRack = item.subType === "RACK_42U" || item.subType === "RACK_18U";

    const ghost = document.createElement("div");
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    ghost.style.left = "-1000px";
    ghost.style.zIndex = "99999";
    ghost.style.pointerEvents = "none";
    ghost.style.display = "flex";
    ghost.style.alignItems = "center";
    ghost.style.justifyContent = "center";
    ghost.style.boxShadow = "0 12px 28px rgba(0,0,0,0.6)";

    let widthPx = 64;
    let heightPx = 64;

    if (isDesk) {
      widthPx = item.subType === "BENCH_QUAD" ? 110 : item.subType === "BENCH_DOUBLE" ? 75 : 65;
      heightPx = item.subType === "BENCH_QUAD" ? 55 : item.subType === "BENCH_DOUBLE" ? 75 : 45;
      ghost.style.width = `${widthPx}px`;
      ghost.style.height = `${heightPx}px`;
      ghost.style.backgroundColor = "#1e293b";
      ghost.style.border = "2px solid #38bdf8";
      ghost.style.borderRadius = "8px";
      ghost.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <span style="font-size:16px;">🪑</span>
          <span style="font-size:9px;font-weight:bold;color:#f8fafc;font-family:sans-serif;white-space:nowrap;">${item.name.slice(0, 14)}</span>
        </div>
      `;
    } else if (isRack) {
      widthPx = 60;
      heightPx = 75;
      ghost.style.width = `${widthPx}px`;
      ghost.style.height = `${heightPx}px`;
      ghost.style.backgroundColor = "#0f172a";
      ghost.style.border = "2px solid #a855f7";
      ghost.style.borderRadius = "6px";
      ghost.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <span style="font-size:18px;">🖥️</span>
          <span style="font-size:9px;font-weight:bold;color:#c084fc;font-family:sans-serif;">${item.customUHeight || (item.subType === "RACK_18U" ? 18 : 42)}U</span>
        </div>
      `;
    } else if (item.subType === "SOCKET_BLOCK") {
      widthPx = 80;
      heightPx = 54;
      ghost.style.width = `${widthPx}px`;
      ghost.style.height = `${heightPx}px`;
      ghost.style.backgroundColor = "#1e293b";
      ghost.style.border = "2px solid #38bdf8";
      ghost.style.borderRadius = "8px";
      ghost.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <span style="font-size:14px;">🔲</span>
          <span style="font-size:9px;font-weight:bold;color:#38bdf8;font-family:sans-serif;">Bloc 4x RJ45</span>
        </div>
      `;
    } else {
      widthPx = 54;
      heightPx = 54;
      ghost.style.width = `${widthPx}px`;
      ghost.style.height = `${heightPx}px`;
      ghost.style.backgroundColor = "#0f172a";
      ghost.style.border = "2px solid #38bdf8";
      ghost.style.borderRadius = "10px";
      const emote =
        item.customEmote ||
        (item.outletRole === "VOIP"
          ? "📞"
          : item.outletRole === "WIFI"
            ? "📶"
            : item.outletRole === "PRINTER"
              ? "🖨️"
              : item.outletRole === "CAMERA"
                ? "📷"
                : "🔌");
      ghost.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <span style="font-size:22px;">${emote}</span>
        </div>
      `;
    }

    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, widthPx / 2, heightPx / 2);
    setTimeout(() => {
      if (document.body.contains(ghost)) {
        document.body.removeChild(ghost);
      }
    }, 0);
  };

  const setupScannedDeviceDragPreview = (e: React.DragEvent, dev: ScannedDeviceItem) => {
    const ghost = document.createElement("div");
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    ghost.style.left = "-1000px";
    ghost.style.zIndex = "99999";
    ghost.style.pointerEvents = "none";
    ghost.style.display = "flex";
    ghost.style.alignItems = "center";
    ghost.style.gap = "8px";
    ghost.style.padding = "6px 12px";
    ghost.style.backgroundColor = "#090d16";
    ghost.style.border = "2px solid #38bdf8";
    ghost.style.borderRadius = "6px";
    ghost.style.boxShadow = "0 10px 25px rgba(0,0,0,0.8), 0 0 15px rgba(56, 189, 248, 0.4)";
    ghost.innerHTML = `
      <span style="font-size:16px;">⚡</span>
      <div style="display:flex;flex-direction:column;">
        <span style="font-size:10px;font-weight:bold;color:#f8fafc;font-family:monospace;white-space:nowrap;">${dev.name}</span>
        <span style="font-size:8px;color:#38bdf8;font-family:monospace;">${dev.portsCount} Ports • ${dev.uSize ?? 1}U • ${dev.manufacturer || dev.model}</span>
      </div>
    `;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 40, 20);
    setTimeout(() => {
      if (document.body.contains(ghost)) {
        document.body.removeChild(ghost);
      }
    }, 0);
  };

  const setupCustomRackDragPreview = (e: React.DragEvent, name: string, uHeight: number) => {
    const ghost = document.createElement("div");
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    ghost.style.left = "-1000px";
    ghost.style.zIndex = "99999";
    ghost.style.pointerEvents = "none";
    ghost.style.display = "flex";
    ghost.style.alignItems = "center";
    ghost.style.justifyContent = "center";
    ghost.style.width = "70px";
    ghost.style.height = "90px";
    ghost.style.backgroundColor = "#0f172a";
    ghost.style.border = "2px solid #a855f7";
    ghost.style.borderRadius = "8px";
    ghost.style.boxShadow = "0 12px 28px rgba(0,0,0,0.6)";
    ghost.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
        <span style="font-size:20px;">🖥️</span>
        <span style="font-size:10px;font-weight:bold;color:#c084fc;font-family:sans-serif;">${uHeight}U</span>
        <span style="font-size:8px;color:#e2e8f0;font-family:monospace;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span>
      </div>
    `;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 35, 45);
    setTimeout(() => {
      if (document.body.contains(ghost)) {
        document.body.removeChild(ghost);
      }
    }, 0);
  };

  const handleAddCustomRack = () => {
    const widthMm = customRackFormat === "COMPACT" ? 600 : 800;
    const heightMm = customRackFormat === "COMPACT" ? 800 : 1000;
    const item: PaletteItem = {
      id: `rack-custom-${Date.now()}`,
      category: "INFRASTRUCTURE",
      name: customRackName || `BAIE-DSI-0${(racks?.length ?? 0) + 1}`,
      subType: customRackU <= 18 ? "RACK_18U" : "RACK_42U",
      targetType: "PATCH_PANEL",
      widthMm,
      heightMm,
      description: `Armoire serveur & brassage standard ${customRackU}U (${widthMm / 1000}×${heightMm / 1000} m)`,
      personaTag: "DSI",
      iconName: "Server",
      customUHeight: customRackU,
    };
    onAddItem(item);
  };

  const handleCustomRackDragStart = (e: React.DragEvent) => {
    const widthMm = customRackFormat === "COMPACT" ? 600 : 800;
    const heightMm = customRackFormat === "COMPACT" ? 800 : 1000;
    const item: PaletteItem = {
      id: `rack-custom-${Date.now()}`,
      category: "INFRASTRUCTURE",
      name: customRackName || `BAIE-DSI-0${(racks?.length ?? 0) + 1}`,
      subType: customRackU <= 18 ? "RACK_18U" : "RACK_42U",
      targetType: "PATCH_PANEL",
      widthMm,
      heightMm,
      description: `Armoire serveur & brassage standard ${customRackU}U (${widthMm / 1000}×${heightMm / 1000} m)`,
      personaTag: "DSI",
      iconName: "Server",
      customUHeight: customRackU,
    };
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
    setupCustomRackDragPreview(e, item.name, customRackU);
  };

  const handleScannedDeviceDragStart = (e: React.DragEvent, dev: ScannedDeviceItem) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: "SCANNED_RACK_DEVICE",
        device: dev,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
    setupScannedDeviceDragPreview(e, dev);
  };

  const handleScannedIotDeviceDragStart = (e: React.DragEvent, dev: ScannedDeviceItem) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: "SCANNED_IOT_DEVICE",
        device: dev,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    ghost.style.left = "-1000px";
    ghost.style.zIndex = "99999";
    ghost.style.pointerEvents = "none";
    ghost.style.display = "flex";
    ghost.style.alignItems = "center";
    ghost.style.gap = "8px";
    ghost.style.padding = "6px 12px";
    ghost.style.backgroundColor = "#090d16";
    ghost.style.border = "2px solid #f59e0b";
    ghost.style.borderRadius = "6px";
    ghost.style.boxShadow = "0 10px 25px rgba(0,0,0,0.8), 0 0 15px rgba(245, 158, 11, 0.4)";
    const emote =
      dev.deviceType === "ACCESS_POINT"
        ? "📶"
        : dev.deviceType === "CAMERA"
          ? "🎥"
          : dev.deviceType === "WORKSTATION"
            ? "💻"
            : dev.deviceType === "PHONE_VOIP"
              ? "📞"
              : "🖨️";

    ghost.innerHTML = `
      <span style="font-size:16px;">${emote}</span>
      <div style="display:flex;flex-direction:column;">
        <span style="font-size:10px;font-weight:bold;color:#f8fafc;font-family:monospace;white-space:nowrap;">${dev.name}</span>
        <span style="font-size:8px;color:#fbbf24;font-family:monospace;">${dev.ip} • ${dev.manufacturer || dev.model}</span>
      </div>
    `;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 40, 20);
    setTimeout(() => {
      if (document.body.contains(ghost)) {
        document.body.removeChild(ghost);
      }
    }, 0);
  };

  return (
    <aside
      style={{ width: isDrawerOpen ? `${width}px` : "56px" }}
      className="fixed top-14 left-0 bottom-0 z-30 flex bg-slate-950/95 backdrop-blur-md border-r border-slate-800 shadow-2xl text-slate-100 font-sans"
    >
      {/* 1. Barre latérale étroite (BOUTON SITES EN PREMIER + AJOUT + PARAMÈTRES DSI) */}
      <div className="w-14 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 justify-between flex-shrink-0">
        <div className="flex flex-col items-center gap-3">
          {/* 1. PREMIER BOUTON ABSOLU : SITES & CAMPUS */}
          {onOpenSites && (
            <button
              type="button"
              onClick={onOpenSites}
              title="Gestion des Sites & Campus (Multi-sites)"
              className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 cursor-pointer ${
                isSitesOpen
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-600/40"
                  : "text-slate-400 hover:text-amber-400 hover:bg-slate-800"
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Sites</span>
            </button>
          )}

          {/* 2. Menu unique "Ajout" dans la barre latérale */}
          <button
            type="button"
            onClick={() => {
              if (!isOpen) onToggle();
            }}
            title="Catalogue & Ajout d'équipements"
            className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 cursor-pointer ${
              isOpen && !isTopologyOpen && !isInventoryOpen && !isSitesOpen
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/40"
                : "text-slate-400 hover:text-blue-400 hover:bg-slate-800"
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-wider">Ajout</span>
          </button>

          {/* Bouton "Topologie" pour ouvrir le panneau arborescent réseau */}
          {onOpenTopology && (
            <button
              type="button"
              onClick={onOpenTopology}
              title="Topologie Réseau & Arborescence DSI"
              className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 cursor-pointer ${
                isTopologyOpen
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/40"
                  : "text-slate-400 hover:text-purple-400 hover:bg-slate-800"
              }`}
            >
              <Network className="w-5 h-5" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Topo</span>
            </button>
          )}

          {/* Bouton "Inventaire" pour ouvrir l'inventaire complet */}
          {onOpenInventory && (
            <button
              type="button"
              onClick={onOpenInventory}
              title="Inventaire Global (Utilisateurs, Bureaux, Ports, Équipements, Infra)"
              className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 cursor-pointer ${
                isInventoryOpen
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/40"
                  : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
              }`}
            >
              <Boxes className="w-5 h-5" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Inven</span>
            </button>
          )}
        </div>

        {/* Paramètres DSI compact (Bas de barre) & Bouton replier */}
        <div className="flex flex-col items-center gap-2">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="Paramètres DSI (Active Directory, SSO, SNMP, IPAM)"
              className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <Sliders className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggle}
            title={isOpen ? "Replier la palette" : "Déplier la palette"}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            {isDrawerOpen ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Seconde fenêtre latérale déployable (Sites, Catalogue, Topologie ou Inventaire) */}
      {isDrawerOpen && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {isSitesOpen && sitesContent ? (
            sitesContent
          ) : isInventoryOpen && inventoryContent ? (
            inventoryContent
          ) : isTopologyOpen && topologyContent ? (
            topologyContent
          ) : (
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
              {/* Header Palette */}
              <div className="border-b border-slate-800 pb-2 mb-2 flex-shrink-0 flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Catalogue d'Ajout
                </span>
                <span className="text-[9px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                  Échelle réelle
                </span>
              </div>

              {/* LES 4 SOUS-MENUS D'ÉQUIPEMENTS DANS LA 2NDE FENÊTRE */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg mb-2.5 flex-shrink-0">
                <button
                  onClick={() => setSelectedCategory("FURNITURE")}
                  className={`py-1.5 px-0.5 rounded-md text-[10px] font-semibold flex flex-col items-center gap-1 transition ${
                    selectedCategory === "FURNITURE"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-emerald-400 hover:bg-slate-850"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="truncate">Mobilier</span>
                </button>
                <button
                  onClick={() => setSelectedCategory("CONNECTIVITY")}
                  className={`py-1.5 px-0.5 rounded-md text-[10px] font-semibold flex flex-col items-center gap-1 transition ${
                    selectedCategory === "CONNECTIVITY"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-blue-400 hover:bg-slate-850"
                  }`}
                >
                  <Plug className="w-3.5 h-3.5" />
                  <span className="truncate">Prises</span>
                </button>
                <button
                  onClick={() => setSelectedCategory("IOT")}
                  className={`py-1.5 px-0.5 rounded-md text-[10px] font-semibold flex flex-col items-center gap-1 transition ${
                    selectedCategory === "IOT"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-amber-400 hover:bg-slate-850"
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="truncate">IOT</span>
                </button>
                <button
                  onClick={() => setSelectedCategory("INFRASTRUCTURE")}
                  className={`py-1.5 px-0.5 rounded-md text-[10px] font-semibold flex flex-col items-center gap-1 transition ${
                    selectedCategory === "INFRASTRUCTURE"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-purple-400 hover:bg-slate-850"
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span className="truncate">Baies</span>
                </button>
              </div>

              {/* Contenu avec défilement fluide */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {/* ================= VUE INFRASTRUCTURE / BAIES ================= */}
                {selectedCategory === "INFRASTRUCTURE" ? (
                  <div className="space-y-3">
                    {/* 1. Carte en haut : AJOUTER BAIE CUSTOM */}
                    <div
                      draggable={true}
                      onDragStart={handleCustomRackDragStart}
                      className="p-3 bg-gradient-to-b from-purple-950/40 to-slate-900 border border-purple-500/40 rounded-xl space-y-2.5 shadow-lg group cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                          <Server className="w-4 h-4 text-purple-400" />
                          <span>Ajouter Baie Custom</span>
                        </div>
                        <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
                          {customRackU}U • {customRackFormat === "COMPACT" ? "600×800" : "800×1000"}{" "}
                          mm
                        </span>
                      </div>

                      {/* Nom de la baie */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">
                          Nom de la baie :
                        </label>
                        <input
                          type="text"
                          value={customRackName}
                          onChange={(e) => setCustomRackName(e.target.value)}
                          placeholder="BAIE-DSI-01"
                          className="w-full px-2 py-1 bg-slate-950 border border-purple-500/30 rounded text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      {/* Sélecteur de hauteur en U */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">
                          Hauteur du châssis :
                        </label>
                        <div className="grid grid-cols-5 gap-1">
                          {[12, 18, 24, 42, 48].map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setCustomRackU(u)}
                              className={`py-1 rounded text-[10px] font-mono font-bold transition ${
                                customRackU === u
                                  ? "bg-purple-600 text-white shadow"
                                  : "bg-slate-800 text-slate-400 hover:text-purple-300 hover:bg-slate-750"
                              }`}
                            >
                              {u}U
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Format et Dimensions */}
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setCustomRackFormat("STD")}
                          className={`py-1 px-1.5 rounded border transition text-center font-mono ${
                            customRackFormat === "STD"
                              ? "bg-purple-900/60 border-purple-400 text-purple-200"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          Standard (800×1000)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomRackFormat("COMPACT")}
                          className={`py-1 px-1.5 rounded border transition text-center font-mono ${
                            customRackFormat === "COMPACT"
                              ? "bg-purple-900/60 border-purple-400 text-purple-200"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          Compacte (600×800)
                        </button>
                      </div>

                      {/* Bouton d'action et poignée de glisser-déposer */}
                      <div className="flex items-center gap-2 pt-1 border-t border-purple-500/20">
                        <button
                          type="button"
                          onClick={handleAddCustomRack}
                          className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ajouter la baie au plan</span>
                        </button>
                        <div
                          title="Glisser-déposer cette baie directement sur le plan"
                          className="p-1.5 bg-purple-950/70 border border-purple-500/30 rounded text-purple-300 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-purple-900/50"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* 2. Section en dessous : SWITCHS & ÉQUIPEMENTS SCANNÉS */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                          <Network className="w-3.5 h-3.5 text-sky-400" />
                          <span>Équipements Scannés & Découverts</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={refreshDiscoveredDevices}
                            disabled={isRefreshingDiscovery}
                            title="Actualiser la liste des équipements découverts"
                            className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-850 transition"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${isRefreshingDiscovery ? "animate-spin text-sky-400" : ""}`}
                            />
                          </button>
                          {scannedDevices.length > 0 && (
                            <button
                              type="button"
                              onClick={handlePurgeScannedDevices}
                              disabled={isPurgingDiscovery}
                              title="Purger tous les équipements scannés"
                              className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-850 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          <span className="text-[9px] font-mono bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20">
                            {filteredScannedDevices.length} dispos
                          </span>
                        </div>
                      </div>

                      {/* Bouton d'auto-déploiement topologique intelligent multi-baies */}
                      {onAutoDeployDiscoveredTopology && scannedDevices.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onAutoDeployDiscoveredTopology()}
                          className="w-full py-2 px-3 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-900/30 border border-cyan-400/40 active:scale-[0.99] cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-cyan-200 animate-pulse" />
                          <span>🚀 Auto-déployer tout sur le plan</span>
                        </button>
                      )}

                      {/* Barre de recherche d'équipement scanné */}
                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={scannedSearchQuery}
                          onChange={(e) => setScannedSearchQuery(e.target.value)}
                          placeholder="Filtrer switchs, IP, modèle, marque..."
                          className="w-full pl-7 pr-3 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[11px] focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>

                      {/* Filtres par famille */}
                      <div className="flex flex-wrap gap-1">
                        {[
                          { id: "ALL", label: "Tous" },
                          { id: "SWITCHS", label: "Switchs" },
                          { id: "FIREWALLS", label: "Sécurité" },
                          { id: "SERVEURS", label: "Serveurs" },
                          { id: "BRASSAGE", label: "Brassage" },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setScannedFilterType(tab.id)}
                            className={`px-2 py-0.5 rounded text-[9px] font-medium transition ${
                              scannedFilterType === tab.id
                                ? "bg-sky-600 text-white font-semibold shadow"
                                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Notice d'aide glisser-déposer dans une baie */}
                      <div className="p-2 bg-slate-950/70 border border-slate-800 rounded text-[10px] text-slate-400 leading-snug">
                        💡 <strong>Glissez-déposez</strong> un équipement sur une baie du plan pour
                        l&apos;installer automatiquement dans le châssis.
                      </div>

                      {/* Liste des cartes d'équipements scannés */}
                      <div className="space-y-1.5">
                        {filteredScannedDevices.length === 0 ? (
                          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-center space-y-1.5">
                            <div className="w-7 h-7 rounded-full bg-slate-900 border border-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                              <Network className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <div className="text-xs font-semibold text-slate-300">
                              Aucun équipement scanné ou découvert
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                              Lancez une détection réseau SNMP ou connectez vos portails Cloud
                              (Meraki, Aruba, UniFi) dans les Paramètres DSI pour intégrer vos
                              commutateurs et serveurs réels.
                            </p>
                            {onOpenSettings && (
                              <button
                                type="button"
                                onClick={onOpenSettings}
                                className="mt-1 px-2.5 py-1 bg-sky-600/25 hover:bg-sky-600/40 text-sky-200 border border-sky-500/30 rounded text-[10px] font-semibold inline-flex items-center gap-1.5 transition"
                              >
                                <Sliders className="w-3 h-3" />
                                <span>Ouvrir les Paramètres DSI</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          filteredScannedDevices.map((dev: ScannedDeviceItem) => {
                            const placement = getDevicePlacement(dev);
                            const isSwitch = dev.deviceType === "SWITCH";
                            const isFw = dev.deviceType === "FIREWALL";
                            const isSrv = dev.deviceType === "SERVER";
                            const isPp = dev.deviceType === "PATCH_PANEL";

                            const brandColor = dev.manufacturer.toLowerCase().includes("aruba")
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : dev.manufacturer.toLowerCase().includes("cisco")
                                ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                                : dev.manufacturer.toLowerCase().includes("zyxel")
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : dev.manufacturer.toLowerCase().includes("fortinet")
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                    : dev.manufacturer.toLowerCase().includes("dell")
                                      ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                      : "bg-blue-500/20 text-blue-300 border-blue-500/30";

                            return (
                              <div
                                key={dev.id}
                                draggable={true}
                                onDragStart={(e) => handleScannedDeviceDragStart(e, dev)}
                                className="p-2.5 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-lg transition flex flex-col gap-1.5 group cursor-grab active:cursor-grabbing hover:shadow-md"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition flex-shrink-0" />
                                    <div className="w-7 h-7 rounded-md bg-slate-850 flex items-center justify-center text-slate-300 group-hover:text-sky-400 transition">
                                      {isSwitch ? (
                                        <Network className="w-4 h-4 text-sky-400" />
                                      ) : isFw ? (
                                        <Shield className="w-4 h-4 text-rose-400" />
                                      ) : isSrv ? (
                                        <HardDrive className="w-4 h-4 text-purple-400" />
                                      ) : isPp ? (
                                        <Layers className="w-4 h-4 text-blue-400" />
                                      ) : (
                                        <Zap className="w-4 h-4 text-amber-400" />
                                      )}
                                    </div>
                                    <div>
                                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white flex items-center gap-1.5">
                                        <span>{dev.name}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-sans">
                                        {dev.model}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span
                                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${brandColor}`}
                                    >
                                      {dev.uSize ?? 1}U • {dev.portsCount}P
                                    </span>
                                    {placement && (
                                      <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        Placé
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-850">
                                  <div>IP : {dev.ip}</div>
                                  <div className="truncate">MAC : {dev.mac}</div>
                                </div>

                                {/* Statut de placement & Actions */}
                                {placement ? (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between text-[10px] bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-2 py-1 rounded">
                                      <span className="font-semibold">
                                        {placement.locationLabel}
                                      </span>
                                      <span className="text-[9px] text-emerald-400/80">
                                        Glisser pour replacer
                                      </span>
                                    </div>
                                    {selectedRack && selectedRack.id !== placement.rackId && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onInsertScannedDevice?.(selectedRack.id, dev)
                                        }
                                        className="w-full py-1 px-2 bg-purple-600/40 hover:bg-purple-600 text-purple-200 hover:text-white rounded text-[10px] font-medium flex items-center justify-center gap-1.5 transition border border-purple-500/40"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>Déplacer vers {selectedRack.name}</span>
                                      </button>
                                    )}
                                  </div>
                                ) : selectedRack ? (
                                  <button
                                    type="button"
                                    onClick={() => onInsertScannedDevice?.(selectedRack.id, dev)}
                                    className="w-full py-1 px-2 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white rounded text-[10px] font-medium flex items-center justify-center gap-1.5 transition border border-purple-500/40"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Insérer dans {selectedRack.name}</span>
                                  </button>
                                ) : (
                                  <div className="text-[9px] text-slate-500 flex items-center justify-between font-mono pt-0.5">
                                    <span>🟢 En ligne (Scanné SNMP)</span>
                                    <span className="text-sky-400 font-semibold group-hover:translate-x-0.5 transition">
                                      Glisser dans une baie →
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ================= AUTRES CATÉGORIES (MOBILIER, PRISES, IOT) ================= */
                  <>
                    {/* Dans le sous-menu Mobilier : Bouton Générateur d'Îlots en Masse */}
                    {selectedCategory === "FURNITURE" && onOpenBatchSpawner && (
                      <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-lg space-y-2 mb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                            <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Générateur d&apos;Îlots en Masse</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Générez automatiquement un open-space entier avec mobilier et prises RJ45
                          pré-câblées.
                        </p>
                        <button
                          type="button"
                          onClick={onOpenBatchSpawner}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                        >
                          <Boxes className="w-3 h-3" />
                          <span>Configurer la Matrice</span>
                        </button>
                      </div>
                    )}

                    {/* Bannière d'introduction sous-menu IOT */}
                    {selectedCategory === "IOT" && (
                      <>
                        <div className="p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-lg space-y-1 mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                            <Wifi className="w-3.5 h-3.5 text-amber-400" />
                            <span>Objets Connectés & Terminaux d&apos;Étage</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            Points d&apos;accès Wi-Fi 6 plafonniers, stations d&apos;impression et
                            caméras de surveillance PoE.
                          </p>
                        </div>

                        {/* Section Équipements IOT Découverts par scan */}
                        {iotScannedDevices.length > 0 && (
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                                <Wifi className="w-3.5 h-3.5 text-amber-400" />
                                <span>Bornes Wi-Fi & IOT Découverts</span>
                              </div>
                              <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                                {iotScannedDevices.length} dispos
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {iotScannedDevices.map((dev) => {
                                const placement = getDevicePlacement(dev);
                                const isAp = dev.deviceType === "ACCESS_POINT";
                                const isCam = dev.deviceType === "CAMERA";
                                const isPc = dev.deviceType === "WORKSTATION";
                                const isPhone = dev.deviceType === "PHONE_VOIP";

                                const emote = isAp
                                  ? "📶"
                                  : isCam
                                    ? "🎥"
                                    : isPc
                                      ? "💻"
                                      : isPhone
                                        ? "📞"
                                        : "🖨️";
                                const badgeLabel = isAp
                                  ? "Wi-Fi AP"
                                  : isCam
                                    ? "Caméra IP"
                                    : isPc
                                      ? "Poste Client"
                                      : isPhone
                                        ? "VoIP"
                                        : "Imprimante";

                                return (
                                  <div
                                    key={dev.id}
                                    draggable={true}
                                    onDragStart={(e) => handleScannedIotDeviceDragStart(e, dev)}
                                    className="p-2.5 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-lg transition flex flex-col gap-1.5 group cursor-grab active:cursor-grabbing hover:shadow-md"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center gap-2">
                                        <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition flex-shrink-0" />
                                        <div className="w-7 h-7 rounded-md bg-slate-850 flex items-center justify-center text-slate-300 group-hover:text-amber-400 transition">
                                          <span className="text-sm">{emote}</span>
                                        </div>
                                        <div>
                                          <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                                            {dev.name}
                                          </div>
                                          <div className="text-[10px] text-slate-400 font-sans">
                                            {dev.model}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/30">
                                          {badgeLabel}
                                        </span>
                                        {placement && (
                                          <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            Placé
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-850">
                                      <div>IP : {dev.ip}</div>
                                      <div className="truncate">MAC : {dev.mac}</div>
                                    </div>

                                    {placement ? (
                                      <div className="flex items-center justify-between text-[10px] bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-2 py-1 rounded">
                                        <span className="font-semibold">
                                          {placement.locationLabel}
                                        </span>
                                        <span className="text-[9px] text-emerald-400/80">
                                          Glisser pour replacer
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="text-[9px] text-slate-500 flex items-center justify-between font-mono pt-0.5">
                                        <span>🟢 Découvert</span>
                                        <span className="text-amber-400 font-semibold group-hover:translate-x-0.5 transition">
                                          Glisser sur le plan →
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Liste des équipements du catalogue */}
                    <div className="space-y-2">
                      {filteredItems.map((item) => {
                        const dimMeters = `${(item.widthMm / 1000).toFixed(2)} × ${(
                          item.heightMm / 1000
                        ).toFixed(2)} m`;
                        const tagColor =
                          item.personaTag === "RH"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : item.personaTag === "MAINTENANCE"
                              ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                              : item.category === "IOT"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-purple-500/20 text-purple-400 border-purple-500/30";

                        return (
                          <div
                            key={item.id}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/json", JSON.stringify(item));
                              e.dataTransfer.effectAllowed = "copy";
                              setupDragPreview(e, item);
                            }}
                            className="p-2.5 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition flex flex-col gap-1.5 group cursor-grab active:cursor-grabbing hover:shadow-md"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition flex-shrink-0" />
                                <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-blue-400 transition">
                                  {item.customEmote ? (
                                    <span className="text-sm">{item.customEmote}</span>
                                  ) : (
                                    renderIcon(item.iconName)
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {dimMeters} ({item.widthMm} × {item.heightMm} mm)
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${tagColor}`}
                              >
                                {item.category === "IOT" ? "IOT" : item.personaTag}
                              </span>
                            </div>

                            <p className="text-[10px] text-slate-400 leading-tight">
                              {item.description}
                            </p>

                            <button
                              onClick={() => onAddItem(item)}
                              className="w-full py-1 px-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition border border-slate-700 hover:border-blue-500"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Ajouter au plan
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Guide d'aide bas de palette */}
              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex-shrink-0 leading-relaxed">
                💡 <strong>Astuce :</strong> Glissez-déposez directement un équipement sur le plan
                ou cliquez sur Ajouter.
              </div>

              {/* Bouton Paramtres DSI en bas */}
              {onOpenSettings && (
                <div className="pt-2 border-t border-slate-800 flex-shrink-0">
                  <button
                    onClick={onOpenSettings}
                    className="w-full p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between text-left transition group shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Sliders className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                          Paramtres DSI
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">AD, SNMP, IPAM</div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Poigne de redimensionnement interactif sur la bordure droite */}
      {isDrawerOpen && onResizeStart && (
        <div
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-50 group flex items-center justify-center select-none"
          title="Glisser pour redimensionner le panneau latral"
        >
          <div className="w-0.5 h-8 bg-slate-700 group-hover:bg-blue-400 group-active:bg-white rounded-full transition" />
        </div>
      )}
    </aside>
  );
};

export const EquipmentPalette = memo(EquipmentPaletteComponent);
