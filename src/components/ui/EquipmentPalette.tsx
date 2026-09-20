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
  Boxes,
  Building2,
  Shield,
  HardDrive,
  Search,
  Zap,
} from "lucide-react";
import { OutletRole, NodeSubType, PoeMode, RackDisplay } from "@/components/canvas/EquipmentLayer";
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
}

export interface ScannedDeviceItem {
  id: string;
  name: string;
  ip: string;
  mac: string;
  model: string;
  manufacturer: string;
  deviceType: "SWITCH" | "ROUTER" | "SERVER" | "PATCH_PANEL" | "FIREWALL" | "PDU";
  portsCount: number;
  uSize?: number | undefined;
  status: "ONLINE" | "OFFLINE" | "SYNCED";
  poeBudgetW?: number | undefined;
}

export const DEFAULT_SCANNED_DEVICES: ScannedDeviceItem[] = [
  {
    id: "scanned-sw-aruba-2930f",
    name: "SW-CORE-ARUBA-2930F-24G",
    ip: "10.42.0.1",
    mac: "38:21:C7:A1:B0:10",
    model: "Aruba 2930F 24G 4SFP+ PoE+ (JL255A)",
    manufacturer: "Aruba Networks / HPE",
    deviceType: "SWITCH",
    portsCount: 24,
    uSize: 1,
    status: "ONLINE",
    poeBudgetW: 370,
  },
  {
    id: "scanned-sw-cisco-9300",
    name: "SW-DISTRIB-CISCO-9300-48P",
    ip: "10.42.0.2",
    mac: "00:81:C4:F2:30:01",
    model: "Cisco Catalyst 9300-48P UPOE",
    manufacturer: "Cisco Systems",
    deviceType: "SWITCH",
    portsCount: 48,
    uSize: 1,
    status: "ONLINE",
    poeBudgetW: 740,
  },
  {
    id: "scanned-sw-zyxel-gs1920",
    name: "SW-ACCESS-ZYXEL-GS1920-24HP",
    ip: "10.42.0.3",
    mac: "BC:CF:4F:22:91:E4",
    model: "Zyxel GS1920-24HP Smart Managed Switch",
    manufacturer: "Zyxel Communications",
    deviceType: "SWITCH",
    portsCount: 24,
    uSize: 1,
    status: "ONLINE",
    poeBudgetW: 375,
  },
  {
    id: "scanned-sw-ubiquiti-pro",
    name: "SW-ACCESS-UNIFI-PRO-24-POE",
    ip: "10.42.0.4",
    mac: "74:83:C2:55:19:D2",
    model: "Ubiquiti UniFi Switch Pro 24 PoE",
    manufacturer: "Ubiquiti Networks",
    deviceType: "SWITCH",
    portsCount: 24,
    uSize: 1,
    status: "ONLINE",
    poeBudgetW: 400,
  },
  {
    id: "scanned-fw-fortigate-60f",
    name: "FW-PERIMETRE-FORTIGATE-60F",
    ip: "10.42.0.254",
    mac: "70:4C:A5:18:FE:09",
    model: "Fortinet FortiGate 60F UTM Appliance",
    manufacturer: "Fortinet Inc.",
    deviceType: "FIREWALL",
    portsCount: 10,
    uSize: 1,
    status: "ONLINE",
  },
  {
    id: "scanned-srv-dell-r740",
    name: "SRV-HYPERVISEUR-DELL-R740",
    ip: "10.42.0.20",
    mac: "D4:AE:52:88:C1:22",
    model: "Dell PowerEdge R740 2U (Proxmox/ESXi)",
    manufacturer: "Dell Technologies",
    deviceType: "SERVER",
    portsCount: 8,
    uSize: 2,
    status: "ONLINE",
  },
  {
    id: "scanned-pp-cat6a-24p",
    name: "PP-CAT6A-24P-BRASSAGE",
    ip: "Passif",
    mac: "Non applicable",
    model: "Panneau de Brassage Cat6A 24 Ports RJ45",
    manufacturer: "Legrand LCS3 / Schneider",
    deviceType: "PATCH_PANEL",
    portsCount: 24,
    uSize: 1,
    status: "ONLINE",
  },
  {
    id: "scanned-pdu-apc-monitored",
    name: "PDU-APC-16A-METRED",
    ip: "10.42.0.250",
    mac: "00:C0:B7:44:89:12",
    model: "APC Rack PDU 16A 230V 8x C13 Monitored",
    manufacturer: "APC by Schneider Electric",
    deviceType: "PDU",
    portsCount: 8,
    uSize: 1,
    status: "ONLINE",
  },
];

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

  // 3. Objets Connectés & Terminaux IOT (Sécurité, Impression, Wi-Fi)
  {
    id: "iot-wifi-ap",
    category: "IOT",
    name: "Borne Wi-Fi 6 (Ceiling AP)",
    subType: "WIFI_AP",
    targetType: "WALL_OUTLET",
    outletRole: "WIFI",
    widthMm: 350,
    heightMm: 350,
    description: "Point d'accès plafonnier PoE+ (VLAN 50 Wi-Fi)",
    personaTag: "DSI",
    iconName: "Wifi",
    portCount: 1,
    poeMode: "POE_PLUS",
    vlanId: 50,
    customEmote: "📶",
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
    description: "Station d'impression d'étage sécurisée Badge/IP (VLAN 40)",
    personaTag: "DSI",
    iconName: "Printer",
    portCount: 1,
    poeMode: "NONE",
    vlanId: 40,
    customEmote: "🖨️",
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
    description: "Caméra de surveillance dôme HD PoE (VLAN 50 Sécurité / Wi-Fi)",
    personaTag: "DSI",
    iconName: "Camera",
    portCount: 1,
    poeMode: "POE",
    vlanId: 50,
    customEmote: "🎥",
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
  selectedRackId?: string | null | undefined;
  onInsertScannedDevice?:
    ((rackId: string, device: ScannedDeviceItem, slotU?: number) => void) | undefined;
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
  selectedRackId,
  onInsertScannedDevice,
}) => {
  const isDrawerOpen = isOpen || isTopologyOpen || isInventoryOpen || isSitesOpen;
  // 4 sous-menus d'équipements : Mobilier, Prises, IOT, Infra/Baies
  const [selectedCategory, setSelectedCategory] = useState<PaletteCategory>("FURNITURE");

  // Configuration de la Baie Custom (en haut de l'onglet Infra/Baies)
  const [customRackName, setCustomRackName] = useState(`BAIE-DSI-0${(racks?.length ?? 0) + 1}`);
  const [customRackU, setCustomRackU] = useState<number>(42);
  const [customRackFormat, setCustomRackFormat] = useState<"STD" | "COMPACT">("STD");

  // Équipements scannés & découverts (en dessous de Baie Custom)
  const [scannedDevices, setScannedDevices] =
    useState<ScannedDeviceItem[]>(DEFAULT_SCANNED_DEVICES);
  const [scannedFilterType, setScannedFilterType] = useState<string>("ALL");
  const [scannedSearchQuery, setScannedSearchQuery] = useState("");

  // Mise à jour automatique du nom suggéré de baie si le nombre de baies change
  useEffect(() => {
    setCustomRackName(`BAIE-DSI-0${(racks?.length ?? 0) + 1}`);
  }, [racks?.length]);

  // Récupération dynamique des équipements découverts par l'API de découverte
  useEffect(() => {
    fetch("/api/discovery/status?allDevices=true")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.devices) && data.devices.length > 0) {
          const apiDevices: ScannedDeviceItem[] = data.devices.map((d: any) => ({
            id: `disc-${d.id}`,
            name: d.hostname || d.model || `Équipement ${d.ipAddress}`,
            ip: d.ipAddress,
            mac: d.macAddress,
            model: d.model || d.sysDescr?.slice(0, 45) || "Switch Découvert",
            manufacturer: d.manufacturer || "Constructeur Découvert",
            deviceType: (d.deviceType as any) || "SWITCH",
            portsCount: 24,
            uSize: 1,
            status: "ONLINE",
          }));
          const existingIps = new Set(apiDevices.map((d) => d.ip));
          const complementary = DEFAULT_SCANNED_DEVICES.filter((d) => !existingIps.has(d.ip));
          setScannedDevices([...apiDevices, ...complementary]);
        }
      })
      .catch(() => {});
  }, []);

  const filteredItems = PALETTE_CATALOG.filter((item) => item.category === selectedCategory);

  const selectedRack = useMemo(() => {
    if (!selectedRackId || !racks) return null;
    return racks.find((r) => r.id === selectedRackId) || null;
  }, [racks, selectedRackId]);

  const filteredScannedDevices = useMemo(() => {
    return scannedDevices.filter((dev) => {
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
                        <span className="text-[9px] font-mono bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20">
                          {filteredScannedDevices.length} dispos
                        </span>
                      </div>

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
                        {filteredScannedDevices.map((dev: ScannedDeviceItem) => {
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
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${brandColor}`}
                                >
                                  {dev.uSize ?? 1}U • {dev.portsCount}P
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-850">
                                <div>IP : {dev.ip}</div>
                                <div className="truncate">MAC : {dev.mac}</div>
                              </div>

                              {/* Actions rapides : Insérer dans la baie active si sélectionnée, ou glisser */}
                              {selectedRack ? (
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
                        })}
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
