"use client";

import { useState, useMemo, useCallback, memo, type FC } from "react";
import { CircuitTraceResult } from "@/db/queries/trace-link";
import {
  NodeDisplay,
  RackDisplay,
  OutletRole,
  PoeMode,
  DeskSeatOccupant,
  StackedPortItem,
  getDeskSeatCount,
  getDefaultSeatLabels,
  RackDeviceItem,
  RackDeviceBrand,
  RackDeviceType,
} from "@/components/canvas/EquipmentLayer";
import { CloudSwitchDiscoveryModal } from "./CloudSwitchDiscoveryModal";
import { SwitchPortVisualizer } from "./SwitchPortVisualizer";
import { ENTERPRISE_DIRECTORY } from "@/data/directory";
import {
  Zap,
  ShieldCheck,
  Activity,
  Link2,
  Unlink,
  MapPin,
  Target,
  Monitor,
  Phone,
  Laptop,
  Printer,
  Plug,
  Plus,
  ArrowRight,
  Ruler,
  RotateCw,
  Armchair,
  Box,
  Wifi,
  Search,
  Check,
  UserMinus,
  FileText,
  Mail,
  Building,
  UserCheck,
  Users,
  Server,
  Network,
  Globe,
  Layers,
  Trash2,
  Tag,
  ArrowLeftRight,
  X,
  Edit3,
  Cloud,
  PlusCircle,
} from "lucide-react";
import { VlanStyleCustomizer } from "./VlanStyleCustomizer";
import { VlanStyle, DEFAULT_VLAN_STYLES } from "@/data/vlanStyles";
import { FloorZone } from "@/types/zones";

export const DEFAULT_RACK_DEVICES: RackDeviceItem[] = [
  {
    id: "dev-sw-aruba-01",
    name: "SW-ARUBA-2930F-24G",
    slotU: 24,
    uSize: 1,
    deviceType: "SWITCH",
    brand: "ARUBA",
    model: "Aruba 2930F 24G PoE+ 4SFP+ 370W",
    ipAddress: "10.42.0.21",
    macAddress: "B4:0C:25:88:1A:01",
    status: "ONLINE",
    portsCount: 24,
    cloudManagedBy: "ARUBA_CENTRAL",
  },
  {
    id: "dev-sw-zyxel-01",
    name: "SW-ZYXEL-GS1920-24HP",
    slotU: 22,
    uSize: 1,
    deviceType: "SWITCH",
    brand: "ZYXEL_NEBULA",
    model: "Zyxel GS1920-24HP NebulaFlex 24-Port GbE PoE+ 375W",
    ipAddress: "10.42.0.22",
    macAddress: "BC:CF:4F:91:02:44",
    status: "ONLINE",
    portsCount: 24,
    cloudManagedBy: "NEBULA_CLOUD",
  },
  {
    id: "dev-pp-01",
    name: "PP-24P-CAT6A (U20)",
    slotU: 20,
    uSize: 1,
    deviceType: "PATCH_PANEL",
    brand: "GENERIC",
    model: "Panneau de Brassage 24 Ports RJ45 STP Blindé",
    status: "SYNCED",
    portsCount: 24,
  },
  {
    id: "dev-fw-01",
    name: "FW-FORTIGATE-100F (U15)",
    slotU: 15,
    uSize: 1,
    deviceType: "FIREWALL",
    brand: "FORTINET",
    model: "Fortinet FortiGate 100F Next-Gen Firewall",
    ipAddress: "10.42.0.1",
    macAddress: "70:4C:A5:11:22:33",
    status: "ONLINE",
    cloudManagedBy: "FORTICLOUD",
  },
  {
    id: "dev-srv-01",
    name: "SRV-ESXI-POWEREDGE (U10)",
    slotU: 10,
    uSize: 2,
    deviceType: "SERVER",
    brand: "GENERIC",
    model: "Dell PowerEdge R650 VMware ESXi 8.0",
    ipAddress: "10.42.0.50",
    macAddress: "F8:F2:1E:44:55:66",
    status: "ONLINE",
  },
  {
    id: "dev-pdu-01",
    name: "PDU-APC-16A (U01)",
    slotU: 1,
    uSize: 1,
    deviceType: "PDU",
    brand: "GENERIC",
    model: "Bandeau PDU Ondulé 16A Secouru",
    status: "ONLINE",
  },
];

export interface InternalRackPatch {
  id: string;
  sourceDevice: string;
  sourcePort: string;
  targetDevice: string;
  targetPort: string;
  vlanId: number;
  serviceName: string;
  cableType: "CAT6A_RJ45" | "DAC_10G" | "FIBER_LC";
  lengthM: number;
  status: "UP" | "DOWN" | "TESTING";
  speedGbps: number;
}

const DEFAULT_RACK_PATCHES: InternalRackPatch[] = [
  {
    id: "patch-01",
    sourceDevice: "PP-24P-CAT6A (U24)",
    sourcePort: "Port 01",
    targetDevice: "SW-ACCESS-4A (U22)",
    targetPort: "Gi1/0/1",
    vlanId: 20,
    serviceName: "Poste Bureau 408-A (Data PC)",
    cableType: "CAT6A_RJ45",
    lengthM: 1.0,
    status: "UP",
    speedGbps: 1,
  },
  {
    id: "patch-02",
    sourceDevice: "PP-24P-CAT6A (U24)",
    sourcePort: "Port 02",
    targetDevice: "SW-ACCESS-4A (U22)",
    targetPort: "Gi1/0/2",
    vlanId: 30,
    serviceName: "IP Phone Bureau 408-B (VoIP)",
    cableType: "CAT6A_RJ45",
    lengthM: 1.0,
    status: "UP",
    speedGbps: 1,
  },
  {
    id: "patch-03",
    sourceDevice: "PP-24P-CAT6A (U24)",
    sourcePort: "Port 03",
    targetDevice: "SW-ACCESS-4A (U22)",
    targetPort: "Gi1/0/3",
    vlanId: 20,
    serviceName: "Colonnette 402 - RJ45-1 (Data)",
    cableType: "CAT6A_RJ45",
    lengthM: 1.0,
    status: "UP",
    speedGbps: 1,
  },
  {
    id: "patch-04",
    sourceDevice: "PP-24P-CAT6A (U24)",
    sourcePort: "Port 04",
    targetDevice: "SW-ACCESS-4A (U22)",
    targetPort: "Gi1/0/4",
    vlanId: 30,
    serviceName: "Colonnette 402 - RJ45-2 (VoIP)",
    cableType: "CAT6A_RJ45",
    lengthM: 1.0,
    status: "UP",
    speedGbps: 1,
  },
  {
    id: "patch-05",
    sourceDevice: "PP-24P-CAT6A (U24)",
    sourcePort: "Port 05",
    targetDevice: "SW-ACCESS-4A (U22)",
    targetPort: "Gi1/0/5",
    vlanId: 20,
    serviceName: "Boîte Sol 1 (Data)",
    cableType: "CAT6A_RJ45",
    lengthM: 1.5,
    status: "UP",
    speedGbps: 1,
  },
  {
    id: "patch-06",
    sourceDevice: "PP-24P-CAT6A (U24)",
    sourcePort: "Port 06",
    targetDevice: "SW-ACCESS-4A (U22)",
    targetPort: "Gi1/0/6",
    vlanId: 50,
    serviceName: "Borne Wi-Fi 04 Plafond (PoE+)",
    cableType: "CAT6A_RJ45",
    lengthM: 1.5,
    status: "UP",
    speedGbps: 2.5,
  },
  {
    id: "patch-07",
    sourceDevice: "PP-24P-CAT6A (U24)",
    sourcePort: "Port 07",
    targetDevice: "SW-ACCESS-4A (U22)",
    targetPort: "Gi1/0/7",
    vlanId: 40,
    serviceName: "Copieur RH (Impression)",
    cableType: "CAT6A_RJ45",
    lengthM: 1.0,
    status: "UP",
    speedGbps: 1,
  },
  {
    id: "patch-08",
    sourceDevice: "SW-ACCESS-4A (U22)",
    sourcePort: "Te1/0/1",
    targetDevice: "SW-DISTRIB-4B (U20)",
    targetPort: "Te1/0/1",
    vlanId: 99,
    serviceName: "Trunk Inter-Switch 802.1Q (LACP)",
    cableType: "DAC_10G",
    lengthM: 0.5,
    status: "UP",
    speedGbps: 10,
  },
  {
    id: "patch-09",
    sourceDevice: "SW-ACCESS-4A (U22)",
    sourcePort: "Te1/0/2",
    targetDevice: "FW-FORTIGATE (U15)",
    targetPort: "port1",
    vlanId: 99,
    serviceName: "Uplink Cœur Sécurité Pare-feu",
    cableType: "DAC_10G",
    lengthM: 1.0,
    status: "UP",
    speedGbps: 10,
  },
  {
    id: "patch-10",
    sourceDevice: "SW-DISTRIB-4B (U20)",
    sourcePort: "Te1/0/2",
    targetDevice: "SRV-ESXI (U10)",
    targetPort: "vmnic0",
    vlanId: 10,
    serviceName: "Cluster Hyperviseur & Stockage NAS",
    cableType: "DAC_10G",
    lengthM: 1.0,
    status: "UP",
    speedGbps: 10,
  },
  {
    id: "patch-11",
    sourceDevice: "FW-FORTIGATE (U15)",
    sourcePort: "WAN1",
    targetDevice: "Tiroir Optique Orange (U05)",
    targetPort: "Port 1",
    vlanId: 100,
    serviceName: "Accès Internet Entreprise FTTO",
    cableType: "FIBER_LC",
    lengthM: 2.0,
    status: "UP",
    speedGbps: 1,
  },
];

export interface CircuitInspectorProps {
  traceResult: CircuitTraceResult | null;
  isLoading: boolean;
  selectedNode: NodeDisplay | null;
  selectedZone?: FloorZone | null | undefined;
  allNodes: NodeDisplay[];
  desks: NodeDisplay[];
  racks?: RackDisplay[] | undefined;
  onToggleAttachment: (outletId: string, deskId?: string | undefined) => void;
  onAlignWithDesk?: ((outletId: string, deskId: string) => void) | undefined;
  onTriggerTrace?: ((outletNode: NodeDisplay) => void) | undefined;
  onSelectNode?: ((node: NodeDisplay) => void) | undefined;
  onChangeRole?: ((outletId: string, role: OutletRole) => void) | undefined;
  onAddOutletToDesk?: ((deskId: string, role: OutletRole) => void) | undefined;
  onAddColonnetteToDesk?: ((deskId: string, portsCount?: number | undefined) => void) | undefined;
  onUpdateNodeProperties?: ((nodeId: string, updates: Partial<NodeDisplay>) => void) | undefined;
  onDeleteNode?: ((nodeId: string) => void) | undefined;
  onUpdateZone?: ((zoneId: string, updates: Partial<FloorZone>) => void) | undefined;
  onDeleteZone?: ((zoneId: string) => void) | undefined;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  onUpdateVlanStyle?: ((vlanId: number, updates: Partial<VlanStyle>) => void) | undefined;
  onResetVlanStyles?: (() => void) | undefined;
}

const CircuitInspectorComponent: FC<CircuitInspectorProps> = ({
  traceResult,
  isLoading,
  selectedNode,
  selectedZone,
  allNodes,
  desks,
  racks,
  onToggleAttachment,
  onAlignWithDesk,
  onTriggerTrace,
  onSelectNode,
  onChangeRole: _onChangeRole,
  onAddOutletToDesk,
  onAddColonnetteToDesk,
  onUpdateNodeProperties,
  onDeleteNode,
  onUpdateZone,
  onDeleteZone,
  vlanStyles,
  onUpdateVlanStyle,
  onResetVlanStyles,
}) => {
  // Mode de travail : Consultation (Rapide / Lecture seule) vs Modification (Formulaires d'édition)
  const [inspectorMode, setInspectorMode] = useState<"VIEW" | "EDIT">("VIEW");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);
  const [pickingSeatIndex, setPickingSeatIndex] = useState<number | null>(null);
  const [activeStackedPortIdx, setActiveStackedPortIdx] = useState(0);

  // État interactif du Menu Baie & Branchements Internes
  const [rackTab, setRackTab] = useState<"PATCHING" | "EQUIPMENT" | "SWITCHES" | "VLANS">("EQUIPMENT");
  const [rackVlanFilter, setRackVlanFilter] = useState<string>("ALL");

  const availableRacks: RackDisplay[] = useMemo(() => {
    if (racks && racks.length > 0) return racks;
    const fromNodes: RackDisplay[] = allNodes
      .filter((n) => n.type === "PATCH_PANEL" || n.subType === "RACK_42U" || n.subType === "RACK_18U")
      .map((n) => ({
        id: n.id,
        name: n.name,
        xMm: n.xMm,
        yMm: n.yMm,
        widthMm: n.widthMm ?? 800,
        depthMm: n.heightMm ?? 1000,
        uHeight: n.uHeight ?? (n.subType === "RACK_18U" ? 18 : 42),
        devices: n.devices,
      }));
    return fromNodes.length > 0
      ? fromNodes
      : [{ id: "rack-01", name: "BAIE-PRINCIPALE-RDC", xMm: 12000, yMm: 14000, widthMm: 800, depthMm: 1000, uHeight: 42, devices: [] }];
  }, [racks, allNodes]);

  const getSwitchesForRack = (rackId: string | undefined): RackDeviceItem[] => {
    const targetRack = availableRacks.find((r) => r.id === rackId) ?? availableRacks[0];
    const devs: RackDeviceItem[] = targetRack?.devices ?? [];
    return devs.filter((d: RackDeviceItem) => d.deviceType === "SWITCH");
  };

  // Recensement en temps réel des ports occupés par switch : key -> label de l'équipement occupant
  // Key format: `${rackId || 'rack-01'}::${switchId || 'sw-default'}::${port}`
  const occupiedPortsMap = useMemo(() => {
    const map = new Map<string, string>();
    allNodes.forEach((node) => {
      if (node.type !== "WALL_OUTLET") return;

      const isStackedNode =
        node.subType === "FLOOR_BOX" || (node.stackedPorts && node.stackedPorts.length > 0);

      if (isStackedNode && node.stackedPorts) {
        node.stackedPorts.forEach((sp, pIdx) => {
          if (sp.isPatched && sp.connectedSwitchPort) {
            const rId = sp.connectedRackId || node.connectedRackId || "rack-01";
            const swId = sp.connectedSwitchId || "sw-default";
            const key = `${rId}::${swId}::${sp.connectedSwitchPort}`;
            map.set(key, `${node.name} (P${pIdx + 1})`);
          }
        });
      } else if (node.isPatched && node.connectedSwitchPort) {
        const rId = node.connectedRackId || "rack-01";
        const swId = node.connectedSwitchId || "sw-default";
        const key = `${rId}::${swId}::${node.connectedSwitchPort}`;
        map.set(key, node.name);
      }
    });
    return map;
  }, [allNodes]);

  // Fonction utilitaire pour trouver le premier port libre sur un commutateur
  const findFirstAvailablePort = useCallback(
    (
      rackId: string | undefined,
      switchId: string | undefined,
      totalPorts: number,
      excludeKey?: string
    ): string => {
      const rId = rackId || "rack-01";
      const swId = switchId || "sw-default";
      for (let i = 1; i <= totalPorts; i++) {
        const portName = `Gi1/0/${i}`;
        const key = `${rId}::${swId}::${portName}`;
        if (key === excludeKey || !occupiedPortsMap.has(key)) {
          return portName;
        }
      }
      return "Gi1/0/1"; // repli si tout est saturé
    },
    [occupiedPortsMap]
  );
  const [rackPatches, setRackPatches] = useState<InternalRackPatch[]>(DEFAULT_RACK_PATCHES);
  const [isAddingPatch, setIsAddingPatch] = useState(false);
  const [newPatchSourcePort, setNewPatchSourcePort] = useState("Port 08");
  const [newPatchTargetPort, setNewPatchTargetPort] = useState("Gi1/0/8");
  const [newPatchVlan, setNewPatchVlan] = useState(20);
  const [newPatchRole, setNewPatchRole] = useState("Poste Travail Flex (Data)");

  // État pour l'édition en ligne d'un cordon de brassage existant
  const [editingPatchId, setEditingPatchId] = useState<string | null>(null);
  const [editPatchSourcePort, setEditPatchSourcePort] = useState("");
  const [editPatchTargetPort, setEditPatchTargetPort] = useState("");
  const [editPatchVlan, setEditPatchVlan] = useState(20);
  const [editPatchServiceName, setEditPatchServiceName] = useState("");
  const [editPatchStatus, setEditPatchStatus] = useState<"UP" | "DOWN" | "TESTING">("UP");
  const [editPatchCableType, setEditPatchCableType] = useState<"CAT6A_RJ45" | "DAC_10G" | "FIBER_LC">("CAT6A_RJ45");
  const [editPatchSpeed, setEditPatchSpeed] = useState<number>(1);

  // État pour la sélection du commutateur actif dans l'onglet SWITCHES
  const [selectedSwitchId, setSelectedSwitchId] = useState<string | null>(null);

  // État pour la découverte Cloud / SNMP et gestion dynamique des équipements raqués
  const [isCloudDiscoveryOpen, setIsCloudDiscoveryOpen] = useState(false);
  const [isAddingRackDevice, setIsAddingRackDevice] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceSlotU, setNewDeviceSlotU] = useState(24);
  const [newDeviceUSize, setNewDeviceUSize] = useState(1);
  const [newDeviceType, setNewDeviceType] = useState<RackDeviceType>("SWITCH");
  const [newDeviceBrand, setNewDeviceBrand] = useState<RackDeviceBrand>("ARUBA");
  const [newDeviceModel, setNewDeviceModel] = useState("");
  const [newDeviceIp, setNewDeviceIp] = useState("10.42.0.25");
  const [newDevicePorts, setNewDevicePorts] = useState(24);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState("");
  const [editingDeviceSlotU, setEditingDeviceSlotU] = useState(24);
  const [editingDeviceUSize, setEditingDeviceUSize] = useState(1);
  const [addDeviceError, setAddDeviceError] = useState<string | null>(null);
  const [editDeviceError, setEditDeviceError] = useState<string | null>(null);

  // État pour le renommage et dimensions de la baie
  const [isEditingRackName, setIsEditingRackName] = useState(false);
  const [tempRackName, setTempRackName] = useState("");

  // Sécuriser l'index du port actif pour le slot multi-ports
  const safeStackedPortIdx = useMemo(() => {
    if (!selectedNode?.stackedPorts || selectedNode.stackedPorts.length === 0) return 0;
    return Math.min(activeStackedPortIdx, selectedNode.stackedPorts.length - 1);
  }, [activeStackedPortIdx, selectedNode?.stackedPorts]);

  // Ajouter un port au slot (jusqu'à 8 ports)
  const handleAddStackedPort = () => {
    if (!selectedNode) return;
    const currentPorts = selectedNode.stackedPorts ?? [];
    if (currentPorts.length >= 8) return;
    const nextIdx = currentPorts.length;
    const isEven = nextIdx % 2 === 0;
    const newPort: StackedPortItem = {
      portIndex: nextIdx,
      portLabel: `RJ45-${nextIdx + 1}`,
      outletRole: isEven ? "DATA" : "VOIP",
      vlanId: isEven ? 20 : 30,
      ipAddress: `10.42.${isEven ? 20 : 30}.${100 + nextIdx}`,
      macAddress: `00:1A:2B:3C:4D:${String(nextIdx + 10).padStart(2, "0")}`,
      pingStatus: "ONLINE",
      pingLatencyMs: 3,
    };
    onUpdateNodeProperties?.(selectedNode.id, {
      stackedPorts: [...currentPorts, newPort],
    });
    setActiveStackedPortIdx(nextIdx);
  };

  // Retirer un port du slot
  const handleRemoveStackedPort = (portIdx: number) => {
    if (!selectedNode || !selectedNode.stackedPorts) return;
    if (selectedNode.stackedPorts.length <= 1) return;
    const updated = selectedNode.stackedPorts
      .filter((_, idx) => idx !== portIdx)
      .map((p, idx) => ({ ...p, portIndex: idx, portLabel: `RJ45-${idx + 1}` }));
    onUpdateNodeProperties?.(selectedNode.id, {
      stackedPorts: updated,
    });
    setActiveStackedPortIdx(Math.max(0, portIdx - 1));
  };

  // Mettre à jour les propriétés d'un port spécifique du slot
  const handleUpdateStackedPort = (portIdx: number, updates: Partial<StackedPortItem>) => {
    if (!selectedNode || !selectedNode.stackedPorts) return;
    const updated = selectedNode.stackedPorts.map((p, idx) =>
      idx === portIdx ? { ...p, ...updates } : p
    );
    onUpdateNodeProperties?.(selectedNode.id, {
      stackedPorts: updated,
    });
  };

  // Convertir une prise simple en colonnette multi-ports (slot 2 à 8 ports)
  const handleConvertSingleToColonnette = () => {
    if (!selectedNode) return;
    const defaultPorts: StackedPortItem[] = [
      {
        portIndex: 0,
        portLabel: "RJ45-1",
        outletRole: selectedNode.outletRole || "DATA",
        assignedPerson: selectedNode.assignedPerson,
        assignedUserId: selectedNode.assignedUserId,
        attachedSeatIndex: selectedNode.attachedSeatIndex,
        ipAddress: selectedNode.ipAddress || "10.42.20.101",
        macAddress: selectedNode.macAddress || "00:1A:2B:3C:4D:01",
        pingStatus: selectedNode.pingStatus || "ONLINE",
        pingLatencyMs: selectedNode.pingLatencyMs || 3,
        vlanId: selectedNode.outletRole === "VOIP" ? 30 : 20,
      },
      {
        portIndex: 1,
        portLabel: "RJ45-2",
        outletRole: "VOIP",
        ipAddress: "10.42.30.101",
        macAddress: "00:08:5D:8A:22:9C",
        pingStatus: "ONLINE",
        pingLatencyMs: 2,
        vlanId: 30,
      },
    ];
    onUpdateNodeProperties?.(selectedNode.id, {
      name: selectedNode.name.replace(/Prise/i, "Colonnette"),
      stackedPorts: defaultPorts,
    });
    setActiveStackedPortIdx(0);
  };

  // Dégrouper la colonnette en prise simple
  const handleUngroupColonnette = () => {
    if (!selectedNode) return;
    onUpdateNodeProperties?.(selectedNode.id, {
      name: selectedNode.name.replace(/Colonnette/i, "Prise"),
      stackedPorts: undefined,
    });
  };

  // Accoster / Magnétiser une prise contre la prise voisine la plus proche
  const handleDockWithNearestOutlet = () => {
    if (!selectedNode || selectedNode.type !== "WALL_OUTLET") return;
    const otherOutlets = allNodes.filter(
      (n) => n.type === "WALL_OUTLET" && n.id !== selectedNode.id
    );
    if (otherOutlets.length === 0 || !otherOutlets[0]) return;
    let closest = otherOutlets[0];
    let minDist = Math.hypot(selectedNode.xMm - closest.xMm, selectedNode.yMm - closest.yMm);
    for (const o of otherOutlets) {
      const dist = Math.hypot(selectedNode.xMm - o.xMm, selectedNode.yMm - o.yMm);
      if (dist < minDist) {
        minDist = dist;
        closest = o;
      }
    }
    if (!closest) return;
    // Coller à 280mm horizontalement
    onUpdateNodeProperties?.(selectedNode.id, {
      xMm: closest.xMm + 280,
      yMm: closest.yMm,
    });
  };

  // Détection du nombre de places du bureau (1, 2 ou 4)
  const deskSeatCount = useMemo(() => {
    if (!selectedNode || selectedNode.type !== "DESK") return 1;
    return getDeskSeatCount(selectedNode.subType);
  }, [selectedNode]);

  // Liste normalisée des places du bureau
  const currentSeats: DeskSeatOccupant[] = useMemo(() => {
    if (!selectedNode || selectedNode.type !== "DESK") return [];
    const count = getDeskSeatCount(selectedNode.subType);
    const labels = getDefaultSeatLabels(selectedNode.subType);
    const list: DeskSeatOccupant[] = [];
    for (let i = 0; i < count; i++) {
      const existing = selectedNode.seats?.find((s) => s.seatIndex === i);
      if (existing) {
        list.push({ ...existing, seatLabel: existing.seatLabel ?? labels[i] });
      } else if (i === 0 && selectedNode.assignedPerson && count === 1) {
        list.push({
          seatIndex: 0,
          seatLabel: labels[0],
          fullName: selectedNode.assignedPerson,
          userId: selectedNode.assignedUserId,
          department: selectedNode.department,
        });
      } else {
        list.push({
          seatIndex: i,
          seatLabel: labels[i] ?? `Place ${i + 1}`,
        });
      }
    }
    return list;
  }, [selectedNode]);

  const occupiedSeatsCount = useMemo(
    () => currentSeats.filter((s) => s.fullName).length,
    [currentSeats]
  );

  // Assignation d'un collaborateur à une place spécifique
  const handleAssignUserToSeat = (seatIdx: number, user: (typeof ENTERPRISE_DIRECTORY)[0]) => {
    if (!selectedNode) return;
    const labels = getDefaultSeatLabels(selectedNode.subType);
    const updatedSeats: DeskSeatOccupant[] = [...currentSeats];
    updatedSeats[seatIdx] = {
      seatIndex: seatIdx,
      seatLabel: labels[seatIdx] ?? `Place ${seatIdx + 1}`,
      userId: user.id,
      fullName: user.fullName,
      department: user.department,
    };
    const summary = updatedSeats
      .filter((s) => s.fullName)
      .map((s) => s.fullName)
      .join(", ");
    onUpdateNodeProperties?.(selectedNode.id, {
      seats: updatedSeats,
      assignedPerson: summary || undefined,
      assignedUserId: updatedSeats[0]?.userId,
      department: updatedSeats[0]?.department,
    });
    // Propager le nom du collaborateur sur les prises affectées à cette place
    const seatOutlets = allNodes.filter(
      (n) => n.type === "WALL_OUTLET" && n.attachedToDeskId === selectedNode.id && n.attachedSeatIndex === seatIdx
    );
    seatOutlets.forEach((o) => {
      onUpdateNodeProperties?.(o.id, { assignedPerson: user.fullName });
    });
    setPickingSeatIndex(null);
  };

  // Libération d'une place spécifique
  const handleUnassignSeat = (seatIdx: number) => {
    if (!selectedNode) return;
    const labels = getDefaultSeatLabels(selectedNode.subType);
    const updatedSeats: DeskSeatOccupant[] = [...currentSeats];
    updatedSeats[seatIdx] = {
      seatIndex: seatIdx,
      seatLabel: labels[seatIdx] ?? `Place ${seatIdx + 1}`,
      userId: undefined,
      fullName: undefined,
      department: undefined,
    };
    const summary = updatedSeats
      .filter((s) => s.fullName)
      .map((s) => s.fullName)
      .join(", ");
    onUpdateNodeProperties?.(selectedNode.id, {
      seats: updatedSeats,
      assignedPerson: summary || undefined,
      assignedUserId: updatedSeats.find((s) => s.userId)?.userId,
      department: updatedSeats.find((s) => s.department)?.department,
    });
    // Libérer l'assignation sur les prises de cette place
    const seatOutlets = allNodes.filter(
      (n) => n.type === "WALL_OUTLET" && n.attachedToDeskId === selectedNode.id && n.attachedSeatIndex === seatIdx
    );
    seatOutlets.forEach((o) => {
      onUpdateNodeProperties?.(o.id, { assignedPerson: undefined });
    });
  };

  // Recherche de l'utilisateur actuellement assigné
  const currentAssignedUser = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.assignedUserId) {
      return ENTERPRISE_DIRECTORY.find((u) => u.id === selectedNode.assignedUserId) ?? null;
    }
    if (selectedNode.assignedPerson) {
      const match = selectedNode.assignedPerson.replace(/\s*\(.*\)/, "").trim().toLowerCase();
      return ENTERPRISE_DIRECTORY.find((u) => u.fullName.toLowerCase().includes(match)) ?? null;
    }
    return null;
  }, [selectedNode]);

  // Filtrage de l'annuaire selon la recherche
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return ENTERPRISE_DIRECTORY;
    const q = userSearchQuery.toLowerCase();
    return ENTERPRISE_DIRECTORY.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.jobTitle.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [userSearchQuery]);

  // Sélecteur de mode : Consultation (Lecture seule / Télémétrie rapide) vs Modification (Édition complète)
  const renderModeBanner = () => (
    <div className="p-2 mb-2.5 bg-slate-900/90 border border-slate-800 rounded-lg flex-shrink-0 space-y-1.5 overflow-hidden">
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              inspectorMode === "VIEW" ? "bg-emerald-400" : "bg-sky-400"
            } animate-pulse`}
          />
          <span className="text-[11px] font-semibold text-slate-200 truncate">
            {inspectorMode === "VIEW" ? "Mode Consultation" : "Mode Modification"}
          </span>
          <span className="text-[10px] text-slate-400 truncate hidden xs:inline">
            {inspectorMode === "VIEW" ? "(Lecture seule)" : "(Édition)"}
          </span>
        </div>
        {onDeleteNode && selectedNode && (
          <button
            onClick={() => onDeleteNode(selectedNode.id)}
            title="Supprimer cet équipement du plan"
            className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/50 hover:border-red-600 rounded text-[10px] font-medium transition flex items-center gap-1 flex-shrink-0"
          >
            <Trash2 className="w-3 h-3" />
            <span>Supprimer</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded-md border border-slate-800">
        <button
          onClick={() => setInspectorMode("VIEW")}
          className={`py-1 text-[10px] font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
            inspectorMode === "VIEW"
              ? "bg-slate-800 text-emerald-300 font-bold shadow-sm border border-emerald-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
          title="Mode consultation rapide (lecture seule et télémétrie)"
        >
          👁️ Consultation
        </button>
        <button
          onClick={() => setInspectorMode("EDIT")}
          className={`py-1 text-[10px] font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
            inspectorMode === "EDIT"
              ? "bg-sky-600 text-white font-bold shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
          title="Mode modification (édition des paramètres, câblage, VLAN, ports)"
        >
          ✏️ Modification
        </button>
      </div>
    </div>
  );

  // Cas Spécial : Zone du Plan Sélectionnée (Service, Pôle RH, Tech Lab, Salle, etc.)
  if (!selectedNode && selectedZone) {
    const widthM = (selectedZone.widthMm / 1000).toFixed(1);
    const heightM = (selectedZone.heightMm / 1000).toFixed(1);
    const areaM2 = Math.round((selectedZone.widthMm * selectedZone.heightMm) / 1000000);

    // Équipements géométriquement contenus dans cette zone
    const containedDesks = allNodes.filter(
      (n) =>
        n.type === "DESK" &&
        n.xMm >= selectedZone.xMm &&
        n.xMm <= selectedZone.xMm + selectedZone.widthMm &&
        n.yMm >= selectedZone.yMm &&
        n.yMm <= selectedZone.yMm + selectedZone.heightMm
    );

    const containedOutlets = allNodes.filter(
      (n) =>
        n.type === "WALL_OUTLET" &&
        n.xMm >= selectedZone.xMm &&
        n.xMm <= selectedZone.xMm + selectedZone.widthMm &&
        n.yMm >= selectedZone.yMm &&
        n.yMm <= selectedZone.yMm + selectedZone.heightMm
    );

    const ZONE_COLOR_PALETTE = [
      { name: "Bleu Ciel (Tech)", hex: "#0284c7" },
      { name: "Émeraude (RH / RSE)", hex: "#059669" },
      { name: "Violet (DSI / Infra)", hex: "#7c3aed" },
      { name: "Ambre (Support)", hex: "#d97706" },
      { name: "Indigo (Direction)", hex: "#4f46e5" },
      { name: "Rose (Marketing)", hex: "#e11d48" },
      { name: "Cyan (Réseaux)", hex: "#0891b2" },
    ];

    return (
      <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
        {/* Header Zone */}
        <div className="p-3 mb-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-4 h-4 rounded-md border flex-shrink-0"
              style={{ backgroundColor: selectedZone.color, borderColor: `${selectedZone.color}80` }}
            />
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-100 truncate">{selectedZone.name}</h3>
              <span className="text-[10px] text-slate-400 font-mono">
                Délimitation de Service / Pôle
              </span>
            </div>
          </div>
          {onDeleteZone && (
            <button
              onClick={() => onDeleteZone(selectedZone.id)}
              title="Supprimer cette zone"
              className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/50 rounded text-[10px] font-medium transition flex items-center gap-1 flex-shrink-0"
            >
              <Trash2 className="w-3 h-3" />
              <span>Supprimer</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* Fiche Métrique & Superficie */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-blue-400" />
                Dimensions & Superficie
              </span>
              <span
                className="px-2 py-0.5 rounded font-mono font-bold text-[10px] border"
                style={{
                  color: selectedZone.color,
                  borderColor: `${selectedZone.color}40`,
                  backgroundColor: `${selectedZone.color}15`,
                }}
              >
                {areaM2} m²
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800">
              <div className="bg-slate-950 p-2 rounded border border-slate-850">
                <div className="text-slate-400 text-[10px]">Largeur X (m)&nbsp;:</div>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  value={Number(widthM)}
                  onChange={(e) =>
                    onUpdateZone?.(selectedZone.id, {
                      widthMm: Math.max(2000, Math.round(Number(e.target.value) * 1000)),
                    })
                  }
                  className="w-full mt-1 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="bg-slate-950 p-2 rounded border border-slate-850">
                <div className="text-slate-400 text-[10px]">Longueur Y (m)&nbsp;:</div>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  value={Number(heightM)}
                  onChange={(e) =>
                    onUpdateZone?.(selectedZone.id, {
                      heightMm: Math.max(2000, Math.round(Number(e.target.value) * 1000)),
                    })
                  }
                  className="w-full mt-1 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Édition du Nom & Code de Service */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Nom de la Zone / Pôle&nbsp;:</label>
              <input
                type="text"
                value={selectedZone.name}
                onChange={(e) => onUpdateZone?.(selectedZone.id, { name: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Code Service&nbsp;:</label>
                <input
                  type="text"
                  value={selectedZone.serviceCode ?? ""}
                  placeholder="Ex: TECH, RH..."
                  onChange={(e) => onUpdateZone?.(selectedZone.id, { serviceCode: e.target.value.toUpperCase() })}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Opacité Fond&nbsp;:</label>
                <select
                  value={selectedZone.opacity ?? 0.12}
                  onChange={(e) => onUpdateZone?.(selectedZone.id, { opacity: Number(e.target.value) })}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="0.08">8% (Très léger)</option>
                  <option value="0.12">12% (Standard)</option>
                  <option value="0.18">18% (Accent)</option>
                  <option value="0.25">25% (Soutenu)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Nuancier de couleur du service */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-400 block">Thème de couleur du service&nbsp;:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {ZONE_COLOR_PALETTE.map((theme) => {
                const isSelected = selectedZone.color.toLowerCase() === theme.hex.toLowerCase();
                return (
                  <button
                    key={theme.hex}
                    onClick={() => onUpdateZone?.(selectedZone.id, { color: theme.hex })}
                    style={{ backgroundColor: theme.hex }}
                    className={`w-7 h-7 rounded-lg transition-transform flex items-center justify-center shadow-md ${
                      isSelected ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900" : "hover:scale-105 opacity-80"
                    }`}
                    title={theme.name}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recensement des Équipements dans la zone */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-emerald-400" />
                Équipements Détectés dans la Zone
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {containedDesks.length} meuble(s) • {containedOutlets.length} prise(s)
              </span>
            </span>

            <div className="space-y-1 max-h-48 overflow-y-auto pr-1 text-[10px]">
              {containedDesks.length === 0 && containedOutlets.length === 0 ? (
                <div className="text-slate-500 italic py-2 text-center">
                  Aucun équipement actuellement dans cette emprise.
                </div>
              ) : (
                <>
                  {containedDesks.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => onSelectNode?.(d)}
                      className="p-1.5 rounded bg-slate-950 hover:bg-slate-850 border border-slate-800 flex items-center justify-between cursor-pointer transition"
                    >
                      <span className="text-emerald-400 font-medium truncate flex items-center gap-1">
                        <Monitor className="w-3 h-3 text-slate-500" />
                        {d.name}
                      </span>
                      <span className="text-slate-400 truncate max-w-[120px]">
                        {d.assignedPerson || "Libre"}
                      </span>
                    </div>
                  ))}
                  {containedOutlets.map((o) => (
                    <div
                      key={o.id}
                      onClick={() => onSelectNode?.(o)}
                      className="p-1.5 rounded bg-slate-950 hover:bg-slate-850 border border-slate-800 flex items-center justify-between cursor-pointer transition"
                    >
                      <span className="text-sky-400 font-medium truncate flex items-center gap-1">
                        <Plug className="w-3 h-3 text-slate-500" />
                        {o.name}
                      </span>
                      <span className="font-mono text-slate-500 text-[9px]">
                        {o.outletRole || "DATA"}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Aucun équipement sélectionné
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
          <Zap className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-xs font-semibold text-slate-300">Aucun élément sélectionné</p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
          Cliquez sur une zone de service, un bureau (RH & Espace), une prise murale ou une baie pour configurer ses propriétés réelles.
        </p>
      </div>
    );
  }

  // Cas 1 : Prise Murale / Boîte de Sol / Wi-Fi
  if (selectedNode.type === "WALL_OUTLET") {
    const linkedDesk = selectedNode.attachedToDeskId
      ? desks.find((d) => d.id === selectedNode.attachedToDeskId)
      : undefined;
    const isLinked = Boolean(linkedDesk);
    const isStacked = Boolean(selectedNode.stackedPorts && selectedNode.stackedPorts.length > 0);

    const isVoip = selectedNode.outletRole === "VOIP";
    const isPrinter = selectedNode.outletRole === "PRINTER";
    const isWifi = selectedNode.outletRole === "WIFI";
    const isFloorBox = selectedNode.subType === "FLOOR_BOX";

    const deltaX = linkedDesk ? Math.round(selectedNode.xMm - linkedDesk.xMm) : 0;
    const deltaY = linkedDesk ? Math.round(selectedNode.yMm - linkedDesk.yMm) : 0;
    const directDistanceM = linkedDesk
      ? (Math.hypot(deltaX, deltaY) / 1000).toFixed(2)
      : null;

    const siblingOutlets = linkedDesk
      ? allNodes.filter(
          (n) => n.type === "WALL_OUTLET" && n.attachedToDeskId === linkedDesk.id && n.id !== selectedNode.id
        )
      : [];

    if (isStacked && selectedNode.stackedPorts && selectedNode.stackedPorts.length > 0) {
      const ports = selectedNode.stackedPorts;
      const curPort = ports[safeStackedPortIdx] ?? ports[0];
      if (!curPort) return null;
      const curPortRole = curPort.outletRole;

      // Résolution dynamique de la baie, du switch et du port pour ce port de colonnette
      const curPortRackId = curPort.connectedRackId || availableRacks[0]?.id || "rack-01";
      const curPortRack = availableRacks.find((r) => r.id === curPortRackId) ?? availableRacks[0];
      const curPortRackSwitches = getSwitchesForRack(curPortRack?.id);
      const curPortSwitchId = curPort.connectedSwitchId || curPortRackSwitches[0]?.id;
      const curPortSwitch = curPortRackSwitches.find((s) => s.id === curPortSwitchId) ?? curPortRackSwitches[0];
      const curPortSwitchPortsCount = curPortSwitch?.portsCount ?? 24;

      return (
        <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
          {renderModeBanner()}

          {inspectorMode === "VIEW" ? (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {/* Carte d'identité et statut rapide */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 truncate">
                    <span className="text-base">{selectedNode.customEmote || "🔲"}</span>
                    <span className="truncate">{selectedNode.name}</span>
                  </span>
                  <button
                    onClick={() => setInspectorMode("EDIT")}
                    className="px-2.5 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded text-[10px] font-semibold transition flex items-center gap-1 flex-shrink-0"
                  >
                    ✏️ Modifier
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800">
                  <div className="bg-slate-950 p-2 rounded border border-slate-850">
                    <div className="text-slate-400 text-[10px]">Châssis :</div>
                    <div className="text-emerald-400 font-bold mt-0.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {ports.length} ports Cat6A
                    </div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-850">
                    <div className="text-slate-400 text-[10px]">Emplacement :</div>
                    <div className="text-sky-300 font-bold mt-0.5 truncate">
                      {isLinked && linkedDesk ? `Bureau ${linkedDesk.name}` : "Prise Fixe"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Consultation des ports RJ45 du slot */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-sky-400" />
                    Ports RJ45 de la colonnette ({ports.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Sélection rapide
                  </span>
                </div>

                <div className="space-y-1.5">
                  {ports.map((p, idx) => {
                    const isPSelected = safeStackedPortIdx === idx;
                    const pVlan = p.vlanId ?? 20;
                    const vColor = vlanStyles?.[pVlan]?.color ?? DEFAULT_VLAN_STYLES[pVlan]?.color ?? "#38bdf8";
                    const isOnline = p.pingStatus === "ONLINE";
                    const pRack = availableRacks.find((r) => r.id === p.connectedRackId);
                    const pSwitches = getSwitchesForRack(pRack?.id);
                    const pSwitch = pSwitches.find((s) => s.id === p.connectedSwitchId) ?? pSwitches[0];

                    return (
                      <div
                        key={`view-port-${idx}`}
                        onClick={() => setActiveStackedPortIdx(idx)}
                        className={`p-2 rounded border cursor-pointer transition ${
                          isPSelected
                            ? "bg-slate-800/90 border-sky-500 ring-1 ring-sky-500/50 shadow-sm"
                            : "bg-slate-950/70 border-slate-800 hover:bg-slate-850"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: isOnline ? "#22c55e" : "#ef4444" }}
                            />
                            <span className="font-mono font-bold text-slate-100 text-[11px]">{p.portLabel}</span>
                            <span
                              className="text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold"
                              style={{
                                borderColor: `${vColor}60`,
                                backgroundColor: `${vColor}20`,
                                color: vColor,
                              }}
                            >
                              VLAN {pVlan}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.outletRole}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span className="truncate max-w-[140px] text-slate-300">
                            {p.isPatched && pRack
                              ? `🔌 ${pRack.name} > ${pSwitch ? pSwitch.name : "Switch"} [${p.connectedSwitchPort || "P1"}]`
                              : "⚪ Non branché"}
                          </span>
                          <span>{p.assignedPerson ? `👤 ${p.assignedPerson}` : isOnline ? "🟢 3ms" : "🔴 Déconnecté"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Télémétrie du port actif */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    Télémétrie : {curPort.portLabel}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {curPort.pingStatus === "ONLINE" ? "En ligne (3ms)" : "Déconnecté"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-850">
                    <span className="text-slate-400">IP : </span>
                    <span className="text-slate-200">{curPort.ipAddress || "Non assignée"}</span>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-850">
                    <span className="text-slate-400">MAC : </span>
                    <span className="text-slate-200">{curPort.macAddress || "Non assignée"}</span>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-850">
                    <span className="text-slate-400">VLAN : </span>
                    <span className="text-sky-300 font-bold">VLAN {curPort.vlanId ?? 20}</span>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded border border-slate-850">
                    <span className="text-slate-400">Rôle : </span>
                    <span className="text-slate-200">{curPort.outletRole}</span>
                  </div>
                </div>
                {curPort.assignedPerson && (
                  <div className="p-2 bg-slate-950 rounded border border-slate-850 text-[10px] flex items-center justify-between">
                    <span className="text-slate-400">Affecté à :</span>
                    <span className="text-emerald-300 font-semibold font-mono">👤 {curPort.assignedPerson}</span>
                  </div>
                )}
              </div>

              {/* Raccordement physique au switch / Câblage pour le port sélectionné */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-sky-400" />
                    Câblage : {curPort.portLabel}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold flex items-center gap-1 ${
                      curPort.isPatched
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        curPort.isPatched ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                      }`}
                    />
                    {curPort.isPatched ? "Raccordé au Switch" : "Non branché"}
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 leading-tight">
                  {curPort.isPatched && curPortRack
                    ? `Câblé vers ${curPortRack.name} > ${curPortSwitch ? curPortSwitch.name : "Switch"} (${curPort.connectedSwitchPort || "P1"}). Câble Cat6A tracé à 90°.`
                    : "Ce port RJ45 n'est pas raccordé au switch. Aucun câble n'encombre le plan pour ce port."}
                </p>

                <div className="pt-0.5">
                  {curPort.isPatched ? (
                    <button
                      onClick={() => {
                        handleUpdateStackedPort(safeStackedPortIdx, {
                          isPatched: false,
                          connectedRackId: undefined,
                          connectedSwitchId: undefined,
                          connectedSwitchPort: undefined,
                        });
                      }}
                      className="w-full py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-800/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Unlink className="w-3.5 h-3.5 text-red-400" />
                      <span>Débrancher ce port (Masquer le câble)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const targetRId = curPort.connectedRackId || availableRacks[0]?.id || "rack-01";
                        const rSwitches = getSwitchesForRack(targetRId);
                        const targetSwId = curPort.connectedSwitchId || rSwitches[0]?.id;
                        const sw = rSwitches.find((s) => s.id === targetSwId) ?? rSwitches[0];
                        const autoPort = findFirstAvailablePort(targetRId, targetSwId, sw?.portsCount ?? 24);
                        handleUpdateStackedPort(safeStackedPortIdx, {
                          isPatched: true,
                          connectedRackId: targetRId,
                          connectedSwitchId: targetSwId,
                          connectedSwitchPort: autoPort,
                        });
                      }}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>⚡ Câbler ce port vers le Switch</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bouton d'action pour passer en mode édition */}
              <div className="pt-1">
                <button
                  onClick={() => setInspectorMode("EDIT")}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
                >
                  ✏️ Modifier les paramètres et ports
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {/* SECTION 1 : INFORMATIONS GLOBALES MOBILIER & CHÂSSIS */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
                      <Layers className="w-4 h-4 text-sky-400 flex-shrink-0" />
                      {selectedNode.name}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-sky-500/20 text-sky-400 border-sky-500/30">
                        COLONNETTE {ports.length}P
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          isLinked
                            ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {isLinked ? "SOLIDAIRE" : "FIXE"}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
                    <span>Slot multiposte ({ports.length}x RJ45 Cat6A)</span>
                    <span className="text-slate-500">
                      {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
                    </span>
                  </div>

                  {/* Rattachement au bureau support */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-blue-400" />
                        Liaison au Mobilier
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Rattachement</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
                      <button
                        onClick={() => onToggleAttachment(selectedNode.id, desks[0]?.id)}
                        className={`py-1 px-2 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                          isLinked
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                        }`}
                      >
                        <Link2 className="w-3 h-3" />
                        Solidaire
                      </button>
                      <button
                        onClick={() => onToggleAttachment(selectedNode.id, undefined)}
                        className={`py-1 px-2 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                          !isLinked
                            ? "bg-slate-700 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                        }`}
                      >
                        <MapPin className="w-3 h-3" />
                        Fixe
                      </button>
                    </div>

                    {isLinked && linkedDesk && (
                      <div className="text-[11px] text-slate-300 bg-blue-950/40 border border-blue-900/50 p-2 rounded space-y-1">
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-400">Bureau :</span>
                          <span className="font-semibold text-slate-100">{linkedDesk.name}</span>
                        </div>
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-400">Écart relatif :</span>
                          <span className="text-sky-300 font-semibold">
                            ΔX: {deltaX > 0 ? `+${deltaX}` : deltaX}mm, ΔY: {deltaY > 0 ? `+${deltaY}` : deltaY}mm
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-400">Distance :</span>
                          <span className="text-slate-200">{directDistanceM} m</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Position du libellé de la colonnette */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-[10px] text-slate-400 mb-1 font-medium flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-cyan-400" />
                        Position du libellé :
                      </span>
                      <span className="text-cyan-400 font-mono text-[10px]">
                        {(selectedNode.labelPosition || "RIGHT") === "TOP"
                          ? "Haut"
                          : (selectedNode.labelPosition || "RIGHT") === "BOTTOM"
                          ? "Bas"
                          : (selectedNode.labelPosition || "RIGHT") === "LEFT"
                          ? "Gauche"
                          : "Droite"}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                      {[
                        { id: "TOP" as const, label: "↑ Haut" },
                        { id: "BOTTOM" as const, label: "↓ Bas" },
                        { id: "LEFT" as const, label: "← Gauche" },
                        { id: "RIGHT" as const, label: "→ Droite" },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() =>
                            onUpdateNodeProperties?.(selectedNode.id, { labelPosition: pos.id })
                          }
                          className={`py-1 rounded border transition text-center ${
                            (selectedNode.labelPosition || "RIGHT") === pos.id
                              ? "bg-cyan-600/30 text-cyan-300 border-cyan-500 font-bold shadow-sm"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SECTION 2 : SÉLECTEUR D'ONGLETS DES PORTS RJ45 */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Ports RJ45 du slot ({ports.length}/8 max) :
                    </span>
                    <div className="flex items-center gap-1">
                      {ports.length < 8 && (
                        <button
                          onClick={handleAddStackedPort}
                          className="px-1.5 py-0.5 bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 rounded text-[9px] font-mono flex items-center gap-1 transition"
                          title="Ajouter un port RJ45 au slot (jusqu'à 8)"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          + Port
                        </button>
                      )}
                      {ports.length > 1 && (
                        <button
                          onClick={() => handleRemoveStackedPort(safeStackedPortIdx)}
                          className="px-1.5 py-0.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 rounded text-[9px] font-mono flex items-center gap-1 transition"
                          title="Retirer ce port du slot"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <button
                        onClick={handleUngroupColonnette}
                        className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded text-[9px] font-mono transition"
                        title="Dégrouper la colonnette en prise simple"
                      >
                        Dégrouper
                      </button>
                    </div>
                  </div>

                  {/* Grille des onglets de ports (jusqu'à 8 ports) */}
                  <div className="grid grid-cols-4 gap-1">
                    {ports.map((p, pIdx) => {
                      const isActive = pIdx === safeStackedPortIdx;
                      const pRoleColor =
                        p.outletRole === "VOIP"
                          ? "border-purple-500/40 text-purple-300"
                          : p.outletRole === "PRINTER"
                          ? "border-amber-500/40 text-amber-300"
                          : "border-blue-500/40 text-blue-300";

                      return (
                        <button
                          key={`port-tab-${pIdx}`}
                          onClick={() => setActiveStackedPortIdx(pIdx)}
                          className={`p-1 rounded text-[10px] font-mono border text-center transition flex flex-col items-center justify-center ${
                            isActive
                              ? "bg-blue-600 text-white border-blue-400 font-bold shadow-sm"
                              : `bg-slate-950 hover:bg-slate-900 ${pRoleColor}`
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.isPatched ? "bg-emerald-400" : "bg-slate-600"
                              }`}
                            />
                            <span>P{pIdx + 1}</span>
                          </div>
                          <span className="text-[8px] opacity-80 uppercase tracking-tighter">
                            {p.outletRole || "DATA"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 3 : RACCORDEMENT RÉSEAU HIÉRARCHIQUE DU PORT SÉLECTIONNÉ (Baie -> Switch -> Port) */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-sky-400" />
                      Raccordement Réseau : P{safeStackedPortIdx + 1} ({curPort.portLabel})
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold flex items-center gap-1 ${
                        curPort.isPatched
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          curPort.isPatched ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                        }`}
                      />
                      {curPort.isPatched ? "Raccordé" : "Non branché"}
                    </span>
                  </div>

                  {curPort.isPatched ? (
                    <div className="space-y-2.5 pt-1 border-t border-slate-800 text-[10px] font-mono">
                      {/* Étape 1 : Baie Cible */}
                      <div className="space-y-1">
                        <label className="text-slate-400 block flex items-center justify-between">
                          <span>1. Baie informatique cible :</span>
                          <span className="text-purple-400 font-bold">{curPortRack?.name ?? curPortRackId}</span>
                        </label>
                        {availableRacks.length > 1 ? (
                          <select
                            value={curPortRackId}
                            onChange={(e) => {
                              const newRackId = e.target.value;
                              const newSwitches = getSwitchesForRack(newRackId);
                              const targetSwId = newSwitches[0]?.id;
                              const autoPort = findFirstAvailablePort(newRackId, targetSwId, newSwitches[0]?.portsCount ?? 24);
                              handleUpdateStackedPort(safeStackedPortIdx, {
                                connectedRackId: newRackId,
                                connectedSwitchId: targetSwId,
                                connectedSwitchPort: autoPort,
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-purple-300 font-bold text-[10px] focus:outline-none focus:border-purple-500"
                          >
                            {availableRacks.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.uHeight}U - {r.devices?.length ?? 0} équipements)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-purple-300 font-bold">
                            {curPortRack?.name ?? "BAIE-PRINCIPALE-RDC"}
                          </div>
                        )}
                      </div>

                      {/* Étape 2 : Commutateur (Switch) dans la baie */}
                      <div className="space-y-1">
                        <label className="text-slate-400 block flex items-center justify-between">
                          <span>2. Commutateur (Switch) dans la baie :</span>
                          <span className="text-sky-400 font-bold">{curPortSwitch?.name ?? "Switch"}</span>
                        </label>
                        {curPortRackSwitches.length > 0 ? (
                          <select
                            value={curPortSwitch?.id ?? curPortSwitchId}
                            onChange={(e) => {
                              const swId = e.target.value;
                              const swObj = curPortRackSwitches.find((s) => s.id === swId);
                              const autoPort = findFirstAvailablePort(curPortRackId, swId, swObj?.portsCount ?? 24);
                              handleUpdateStackedPort(safeStackedPortIdx, {
                                connectedSwitchId: swId,
                                connectedSwitchPort: autoPort,
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sky-300 font-bold text-[10px] focus:outline-none focus:border-sky-500"
                          >
                            {curPortRackSwitches.map((sw) => (
                              <option key={sw.id} value={sw.id}>
                                {sw.name} (Position U{sw.slotU}, {sw.portsCount ?? 24} ports)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="px-2 py-1 bg-slate-950 border border-amber-900/50 rounded text-amber-400 text-[10px]">
                            ⚠️ Aucun switch détecté dans cette baie (génération automatique Gi1/0/x)
                          </div>
                        )}
                      </div>

                      {/* Étape 3 : Port RJ45 physique du Switch */}
                      <div className="space-y-1">
                        <label className="text-slate-400 block flex items-center justify-between">
                          <span>3. Port sur le commutateur :</span>
                          <span className="text-emerald-400 font-bold">{curPort.connectedSwitchPort || "Gi1/0/1"}</span>
                        </label>
                        <select
                          value={curPort.connectedSwitchPort || "Gi1/0/1"}
                          onChange={(e) =>
                            handleUpdateStackedPort(safeStackedPortIdx, {
                              connectedSwitchPort: e.target.value,
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[10px] focus:outline-none focus:border-blue-500 font-mono"
                        >
                          {Array.from({ length: curPortSwitchPortsCount }).map((_, i) => {
                            const pName = `Gi1/0/${i + 1}`;
                            const swId = curPortSwitch?.id || curPortSwitchId || "sw-default";
                            const pKey = `${curPortRackId}::${swId}::${pName}`;
                            const myKey = `${curPortRackId}::${swId}::${curPort.connectedSwitchPort}`;
                            const occupant = occupiedPortsMap.get(pKey);
                            const isOccupiedByOther = occupant !== undefined && pKey !== myKey;

                            return (
                              <option
                                key={`curport-sw-port-${i}`}
                                value={pName}
                                disabled={isOccupiedByOther}
                                className={isOccupiedByOther ? "text-slate-600 bg-slate-900" : "text-slate-200"}
                              >
                                Port {pName} {isOccupiedByOther ? `(Occupé - ${occupant})` : pKey === myKey ? "(Actuel)" : "(Disponible)"}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <button
                        onClick={() => {
                          handleUpdateStackedPort(safeStackedPortIdx, {
                            isPatched: false,
                            connectedRackId: undefined,
                            connectedSwitchId: undefined,
                            connectedSwitchPort: undefined,
                          });
                        }}
                        className="w-full py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-800/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition mt-1"
                      >
                        <Unlink className="w-3.5 h-3.5 text-red-400" />
                        <span>Débrancher ce port (Masquer le câble)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1 border-t border-slate-800">
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Ce port RJ45 n'a pas de câble tiré sur le plateau. Branchez-le pour générer le cheminement orthogonal Cat6A individuel vers le switch sélectionné.
                      </p>
                      <button
                        onClick={() => {
                          const targetRId = curPort.connectedRackId || availableRacks[0]?.id || "rack-01";
                          const rSwitches = getSwitchesForRack(targetRId);
                          const targetSwId = curPort.connectedSwitchId || rSwitches[0]?.id;
                          const sw = rSwitches.find((s) => s.id === targetSwId) ?? rSwitches[0];
                          const autoPort = findFirstAvailablePort(targetRId, targetSwId, sw?.portsCount ?? 24);
                          handleUpdateStackedPort(safeStackedPortIdx, {
                            isPatched: true,
                            connectedRackId: targetRId,
                            connectedSwitchId: targetSwId,
                            connectedSwitchPort: autoPort,
                          });
                        }}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>⚡ Câbler ce port vers le Switch (Afficher le tracé)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* SECTION 4 : CONFIGURATION LOGIQUE DU PORT ACTIF (VLAN, Rôle, Place Bureau, IPAM) */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-sky-400" />
                      Configuration Logique : P{safeStackedPortIdx + 1} ({curPort.portLabel})
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {curPort.vlanId ? `VLAN ${curPort.vlanId}` : "VLAN 20"}
                    </span>
                  </div>

                  {/* Libellé du port */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Désignation du port :</label>
                    <input
                      type="text"
                      value={curPort.portLabel}
                      onChange={(e) =>
                        handleUpdateStackedPort(safeStackedPortIdx, { portLabel: e.target.value })
                      }
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-slate-200 text-[11px] focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Attribution du VLAN pour ce port individuel */}
                  <div>
                    <div className="text-[10px] text-slate-400 mb-1 font-medium flex items-center justify-between">
                      <span>Attribution du VLAN :</span>
                      <span className="text-cyan-400 font-mono font-bold">
                        VLAN {curPort.vlanId ?? (curPortRole === "VOIP" ? 30 : 20)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                      {Object.values(vlanStyles ?? DEFAULT_VLAN_STYLES)
                        .sort((a, b) => a.vlanId - b.vlanId)
                        .map((v) => {
                          const isVlanSelected =
                            curPort.vlanId !== undefined
                              ? curPort.vlanId === v.vlanId
                              : curPortRole === "VOIP"
                              ? v.vlanId === 30
                              : v.vlanId === 20;

                          return (
                            <button
                              key={v.vlanId}
                              onClick={() =>
                                handleUpdateStackedPort(safeStackedPortIdx, {
                                  vlanId: v.vlanId,
                                  outletRole:
                                    v.vlanId === 30
                                      ? "VOIP"
                                      : v.vlanId === 40
                                      ? "PRINTER"
                                      : v.vlanId === 50
                                      ? "WIFI"
                                      : "DATA",
                                })
                              }
                              className={`py-1 px-1.5 rounded border text-[10px] flex items-center justify-between transition ${
                                isVlanSelected
                                  ? "bg-slate-800 text-white font-bold shadow-sm"
                                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                              }`}
                              style={{
                                borderColor: isVlanSelected ? v.color : undefined,
                              }}
                            >
                              <span className="truncate">{v.vlanName}</span>
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: v.color }}
                              />
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Rôle métier / Usage du port */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Rôle métier du port :</label>
                    <select
                      value={curPort.outletRole || "DATA"}
                      onChange={(e) => {
                        const newRole = e.target.value as "DATA" | "VOIP" | "PRINTER" | "WIFI";
                        const autoVlan =
                          newRole === "VOIP" ? 30 : newRole === "PRINTER" ? 40 : newRole === "WIFI" ? 50 : 20;
                        handleUpdateStackedPort(safeStackedPortIdx, {
                          outletRole: newRole,
                          vlanId: autoVlan,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[10px] focus:outline-none focus:border-blue-500 font-mono"
                    >
                      <option value="DATA">DATA - Poste informatique standard (VLAN 20)</option>
                      <option value="VOIP">VOIP - Téléphonie IP / Visioconférence (VLAN 30)</option>
                      <option value="PRINTER">PRINTER - Imprimante / Copieur réseau (VLAN 40)</option>
                      <option value="WIFI">WIFI - Borne Wi-Fi plafond / murale (VLAN 50)</option>
                    </select>
                  </div>

                  {/* Place assise associée au port (si rattaché à un bureau) */}
                  {isLinked && linkedDesk && (
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        Affectation à une place du bureau ({linkedDesk.name}) :
                      </label>
                      <select
                        value={
                          curPort.assignedPerson
                            ? linkedDesk.seats?.findIndex((s) => s.fullName === curPort.assignedPerson) ?? ""
                            : ""
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            handleUpdateStackedPort(safeStackedPortIdx, { assignedPerson: undefined });
                          } else {
                            const seatIdx = parseInt(val, 10);
                            const seatOccupant = linkedDesk.seats?.find((s) => s.seatIndex === seatIdx);
                            handleUpdateStackedPort(safeStackedPortIdx, {
                              assignedPerson: seatOccupant?.fullName ?? `Place ${seatIdx + 1}`,
                            });
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                      >
                        <option value="">🌐 Port commun (non affecté)</option>
                        {Array.from({ length: getDeskSeatCount(linkedDesk.subType) }).map((_, i) => {
                          const seatOccupant = linkedDesk.seats?.find((s) => s.seatIndex === i);
                          const labels = getDefaultSeatLabels(linkedDesk.subType);
                          const label = seatOccupant?.seatLabel ?? labels[i] ?? `Place ${i + 1}`;
                          const occupantDesc = seatOccupant?.fullName ? ` (${seatOccupant.fullName})` : " (Libre)";
                          return (
                            <option key={`opt-port-seat-${i}`} value={i}>
                              Place {i + 1} : {label}{occupantDesc}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* IPAM & Ping pour ce port individuel */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-mono flex items-center gap-1">
                        <Globe className="w-3 3 text-slate-500" />
                        IP Fixe / DHCP :
                      </span>
                      <input
                        type="text"
                        value={curPort.ipAddress ?? ""}
                        placeholder={`Ex: 10.42.${curPort.vlanId || 20}.${100 + safeStackedPortIdx}`}
                        onChange={(e) =>
                          handleUpdateStackedPort(safeStackedPortIdx, {
                            ipAddress: e.target.value.trim() ? e.target.value.trim() : undefined,
                          })
                        }
                        className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[10px] font-mono focus:outline-none focus:border-cyan-500 w-36 text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-mono flex items-center gap-1">
                        <Activity className="w-3 3 text-slate-500" />
                        Adresse MAC :
                      </span>
                      <input
                        type="text"
                        value={curPort.macAddress ?? ""}
                        placeholder="Ex: 00:1A:2B:3C:4D:5E"
                        onChange={(e) =>
                          handleUpdateStackedPort(safeStackedPortIdx, {
                            macAddress: e.target.value.trim() ? e.target.value.trim() : undefined,
                          })
                        }
                        className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[10px] font-mono focus:outline-none focus:border-cyan-500 w-36 text-right"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Bouton Traçage CTE */}
                {onTriggerTrace && (
                  <button
                    onClick={() => onTriggerTrace(selectedNode)}
                    className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-medium rounded-lg shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition"
                  >
                    <Zap className="w-4 h-4" />
                    Tracer le circuit CTE récursif
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
        {renderModeBanner()}

        {inspectorMode === "VIEW" ? (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Carte d'identité et statut */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 truncate">
                  <span className="text-base">{selectedNode.customEmote || "🔌"}</span>
                  <span className="truncate">{selectedNode.name}</span>
                </span>
                <button
                  onClick={() => setInspectorMode("EDIT")}
                  className="px-2.5 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded text-[10px] font-semibold transition flex items-center gap-1 flex-shrink-0"
                >
                  ✏️ Modifier
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800">
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <div className="text-slate-400 text-[10px]">Statut liaison :</div>
                  <div className="text-emerald-400 font-bold mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Connecté ({selectedNode.pingLatencyMs ?? 2}ms)
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <div className="text-slate-400 text-[10px]">Emplacement :</div>
                  <div className="text-sky-300 font-bold mt-0.5 truncate">
                    {isLinked && linkedDesk ? `Bureau ${linkedDesk.name}` : "Prise Fixe"}
                  </div>
                </div>
              </div>
            </div>

            {/* Spécifications réseau & VLAN */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-sky-400" />
                  Spécifications Réseau
                </span>
                {selectedNode.vlanId && (
                  <span
                    className="text-[9px] font-mono px-2 py-0.5 rounded border font-bold"
                    style={{
                      borderColor: `${vlanStyles?.[selectedNode.vlanId]?.color ?? "#38bdf8"}60`,
                      backgroundColor: `${vlanStyles?.[selectedNode.vlanId]?.color ?? "#38bdf8"}20`,
                      color: vlanStyles?.[selectedNode.vlanId]?.color ?? "#38bdf8",
                    }}
                  >
                    VLAN {selectedNode.vlanId}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="bg-slate-950 p-1.5 rounded border border-slate-850">
                  <span className="text-slate-400">IP : </span>
                  <span className="text-slate-200">{selectedNode.ipAddress || "Non assignée"}</span>
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-850">
                  <span className="text-slate-400">MAC : </span>
                  <span className="text-slate-200">{selectedNode.macAddress || "Non assignée"}</span>
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-850">
                  <span className="text-slate-400">Rôle : </span>
                  <span className="text-slate-200">{selectedNode.outletRole || "DATA"}</span>
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-850">
                  <span className="text-slate-400">PoE : </span>
                  <span className="text-amber-400 font-bold">{selectedNode.poeMode || "NONE"}</span>
                </div>
              </div>

              {selectedNode.assignedPerson && (
                <div className="p-2 bg-slate-950 rounded border border-slate-850 text-[10px] flex items-center justify-between">
                  <span className="text-slate-400">Affecté à :</span>
                  <span className="text-emerald-300 font-semibold font-mono">👤 {selectedNode.assignedPerson}</span>
                </div>
              )}
            </div>

            {/* Traçage CTE vers Switch & Rack */}
            {traceResult && (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 font-mono text-[10px]">
                <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Liaison CTE vers le Réseau
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Longueur estimée :</span>
                  <span className="text-sky-300 font-bold">{traceResult.totalCableLengthMeters} m</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Équipement d'accès :</span>
                  <span className="text-slate-100">{traceResult.terminalNode?.name ?? "Switch 19\""}</span>
                </div>
              </div>
            )}

            {/* Raccordement physique au switch / Câblage manuel */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-sky-400" />
                  Câblage & Raccordement Switch
                </span>
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold flex items-center gap-1 ${
                    selectedNode.isPatched
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-slate-950 text-slate-400 border-slate-800"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedNode.isPatched ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    }`}
                  />
                  {selectedNode.isPatched ? "Raccordé au Switch" : "Non branché"}
                </span>
              </div>

              <p className="text-[10px] text-slate-400 leading-tight">
                {selectedNode.isPatched
                  ? `Câblé vers la baie principale (${selectedNode.connectedSwitchPort || "Gi1/0/1"}). Câble Cat6A tracé à 90°.`
                  : "Non relié. Aucun câble n'encombre le plan tant que vous ne décidez pas de le brancher."}
              </p>

              <div className="pt-0.5">
                {selectedNode.isPatched ? (
                  <button
                    onClick={() => {
                      onUpdateNodeProperties?.(selectedNode.id, {
                        isPatched: false,
                        connectedRackId: undefined,
                        connectedSwitchPort: undefined,
                      });
                    }}
                    className="w-full py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-800/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Unlink className="w-3.5 h-3.5 text-red-400" />
                    <span>Débrancher du switch (Masquer le câble)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const defRackId = selectedNode.connectedRackId || availableRacks[0]?.id || "rack-01";
                      const defSwitches = getSwitchesForRack(defRackId);
                      const defSwId = selectedNode.connectedSwitchId || defSwitches[0]?.id;
                      const sw = defSwitches.find((s) => s.id === defSwId) ?? defSwitches[0];
                      const autoPort = findFirstAvailablePort(defRackId, defSwId, sw?.portsCount ?? 24);
                      onUpdateNodeProperties?.(selectedNode.id, {
                        isPatched: true,
                        connectedRackId: defRackId,
                        connectedSwitchId: defSwId,
                        connectedSwitchPort: autoPort,
                      });
                    }}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>⚡ Câbler vers la Baie (Afficher le tracé)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bouton d'action pour passer en mode édition */}
            <div className="pt-1">
              <button
                onClick={() => setInspectorMode("EDIT")}
                className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
              >
                ✏️ Modifier les propriétés de la prise
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* 1. En-tête de la prise / boîte de sol */}
        <div className="border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
              {isFloorBox ? (
                <Box className="w-4 h-4 text-sky-400 flex-shrink-0" />
              ) : isWifi ? (
                <Wifi className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              ) : isVoip ? (
                <Phone className="w-4 h-4 text-purple-400 flex-shrink-0" />
              ) : isPrinter ? (
                <Printer className="w-4 h-4 text-amber-400 flex-shrink-0" />
              ) : (
                <Laptop className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
              {selectedNode.name}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isFloorBox
                    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                    : isVoip
                    ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                    : isPrinter
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                }`}
              >
                {isFloorBox ? "BOÎTE DE SOL" : isVoip ? "VOIP / PHONE" : isPrinter ? "IMPRIMANTE" : "DATA / PC"}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isLinked
                    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {isLinked ? "SOLIDAIRE" : "FIXE"}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>{isFloorBox ? "Trappe encastrée inox 4x RJ45" : "Plastron RJ45 Cat6A"}</span>
            <span className="text-slate-500">
              {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
            </span>
          </div>

          {/* Attribution directe du VLAN au lieu du service abstrait */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2">
            <div>
              <div className="text-[10px] text-slate-400 mb-1 font-medium flex items-center justify-between">
                <span>Attribution du VLAN :</span>
                <span className="text-cyan-400 font-mono font-bold">
                  VLAN {selectedNode.vlanId ?? (selectedNode.outletRole === "VOIP" ? 30 : 20)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                {Object.values(vlanStyles ?? DEFAULT_VLAN_STYLES)
                  .sort((a, b) => a.vlanId - b.vlanId)
                  .map((v) => {
                    const isVlanSelected =
                      selectedNode.vlanId !== undefined
                        ? selectedNode.vlanId === v.vlanId
                        : selectedNode.outletRole === "VOIP"
                        ? v.vlanId === 30
                        : v.vlanId === 20;

                    return (
                      <button
                        key={v.vlanId}
                        onClick={() => {
                          onUpdateNodeProperties?.(selectedNode.id, {
                            vlanId: v.vlanId,
                            outletRole:
                              v.vlanId === 30
                                ? "VOIP"
                                : v.vlanId === 40
                                ? "PRINTER"
                                : v.vlanId === 50
                                ? "WIFI"
                                : "DATA",
                          });
                        }}
                        className={`py-1 px-1.5 rounded border transition flex items-center justify-center gap-1.5 ${
                          isVlanSelected
                            ? "bg-slate-800 text-white border-cyan-500 font-bold ring-1 ring-cyan-500/50 shadow-sm"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-850"
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: v.color }}
                        />
                        <span>V{v.vlanId}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Émote personnalisée */}
            <div>
              <div className="text-[10px] text-slate-400 mb-1 font-medium flex items-center justify-between">
                <span>Émote de la prise :</span>
                <span className="text-base">{selectedNode.customEmote || "🔌"}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {["🔌", "💻", "📞", "🖨️", "📶", "🖥️", "🎥", "⚡", "🌐", "🔒", "🚪"].map((em) => (
                  <button
                    key={em}
                    onClick={() =>
                      onUpdateNodeProperties?.(selectedNode.id, { customEmote: em })
                    }
                    className={`w-6 h-6 rounded flex items-center justify-center text-xs transition ${
                      selectedNode.customEmote === em
                        ? "bg-cyan-600 scale-110 shadow ring-1 ring-white/30"
                        : "bg-slate-900 hover:bg-slate-800"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Alimentation PoE */}
            <div>
              <div className="text-[10px] text-slate-400 mb-1 font-medium">Alimentation PoE :</div>
              <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
                {[
                  { id: "NONE" as PoeMode, label: "Non-PoE" },
                  { id: "POE" as PoeMode, label: "PoE" },
                  { id: "POE_PLUS" as PoeMode, label: "PoE+" },
                  { id: "POE_PLUS_PLUS" as PoeMode, label: "PoE++" },
                ].map((poe) => (
                  <button
                    key={poe.id}
                    onClick={() =>
                      onUpdateNodeProperties?.(selectedNode.id, { poeMode: poe.id })
                    }
                    className={`py-1 rounded border transition text-center ${
                      (selectedNode.poeMode ?? "NONE") === poe.id
                        ? "bg-amber-600/30 text-amber-300 border-amber-500 font-bold shadow-sm"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {poe.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Position du libellé de la prise */}
            <div className="pt-2 border-t border-slate-800">
              <div className="text-[10px] text-slate-400 mb-1 font-medium flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-cyan-400" />
                  Position du libellé :
                </span>
                <span className="text-cyan-400 font-mono text-[10px]">
                  {(selectedNode.labelPosition || "RIGHT") === "TOP"
                    ? "Haut"
                    : (selectedNode.labelPosition || "RIGHT") === "BOTTOM"
                    ? "Bas"
                    : (selectedNode.labelPosition || "RIGHT") === "LEFT"
                    ? "Gauche"
                    : "Droite"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                {[
                  { id: "TOP" as const, label: "↑ Haut" },
                  { id: "BOTTOM" as const, label: "↓ Bas" },
                  { id: "LEFT" as const, label: "← Gauche" },
                  { id: "RIGHT" as const, label: "→ Droite" },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    onClick={() =>
                      onUpdateNodeProperties?.(selectedNode.id, { labelPosition: pos.id })
                    }
                    className={`py-1 rounded border transition text-center ${
                      (selectedNode.labelPosition || "RIGHT") === pos.id
                        ? "bg-cyan-600/30 text-cyan-300 border-cyan-500 font-bold shadow-sm"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 1b. Carte : Adressage Réseau & Télémétrie IPAM */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 mb-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              Adressage Réseau (IPAM)
            </span>
            {selectedNode.pingStatus ? (
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                  selectedNode.pingStatus === "ONLINE"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : selectedNode.pingStatus === "DEGRADED"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    selectedNode.pingStatus === "ONLINE" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  }`}
                />
                {selectedNode.pingStatus}
                {selectedNode.pingLatencyMs !== undefined ? ` (${selectedNode.pingLatencyMs}ms)` : ""}
              </span>
            ) : (
              <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                Non supervisé
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <Globe className="w-3 h-3 text-slate-500" />
                IP Fixe / DHCP :
              </span>
              <input
                type="text"
                value={selectedNode.ipAddress ?? ""}
                placeholder="Ex: 10.42.20.108"
                onChange={(e) =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    ipAddress: e.target.value.trim() ? e.target.value.trim() : undefined,
                  })
                }
                className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[10px] font-mono focus:outline-none focus:border-cyan-500 w-36 text-right"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <Activity className="w-3 h-3 text-slate-500" />
                Adresse MAC :
              </span>
              <input
                type="text"
                value={selectedNode.macAddress ?? ""}
                placeholder="Ex: 00:1A:2B:3C:4D:5E"
                onChange={(e) =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    macAddress: e.target.value.trim() ? e.target.value.trim() : undefined,
                  })
                }
                className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[10px] font-mono focus:outline-none focus:border-cyan-500 w-36 text-right"
              />
            </div>
          </div>
        </div>

        {/* 1c. Carte : Groupement Multi-Ports RJ45 & Magnétisme */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 mb-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Stack Multi-Ports & Magnétisme
            </span>
          </div>

          <div className="space-y-1.5">
            <button
              onClick={handleConvertSingleToColonnette}
              className="w-full py-1.5 px-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1.5 transition"
              title="Convertir cette prise en slot colonnette groupé (2 à 8 ports RJ45)"
            >
              <Plus className="w-3.5 h-3.5" />
              Convertir en colonnette (slot 2 à 8 RJ45)
            </button>
            <button
              onClick={handleDockWithNearestOutlet}
              className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-medium flex items-center justify-center gap-1.5 transition border border-slate-700"
              title="Coller magnétiquement contre la prise voisine la plus proche"
            >
              <Target className="w-3.5 h-3.5 text-blue-400" />
              Coller à la prise voisine
            </button>
          </div>
        </div>

        {/* 1b. Carte : Pivot Orthogonal Unique */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 mb-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-blue-400" />
              Pivot Orthogonal (90°)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">2D Drag</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Le câble est contrôlé par un pivot unique. Attrapez l&apos;angle sur le plan pour l&apos;orienter librement en 2D à 90°.
          </p>
        </div>

        {/* 2. Carte : Liaison Mobilier & Postes */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 mb-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              Liaison au Mobilier
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Solidarité</span>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
            <button
              onClick={() => onToggleAttachment(selectedNode.id, desks[0]?.id)}
              className={`py-1 px-2 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                isLinked
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Link2 className="w-3 h-3" />
              Solidaire
            </button>
            <button
              onClick={() => onToggleAttachment(selectedNode.id, undefined)}
              className={`py-1 px-2 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                !isLinked
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <MapPin className="w-3 h-3" />
              Prise Fixe
            </button>
          </div>

          {isLinked && linkedDesk ? (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] text-slate-300 bg-blue-950/40 border border-blue-900/50 p-2 rounded space-y-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Bureau :</span>
                  <span className="font-semibold text-slate-100">{linkedDesk.name}</span>
                </div>
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Écart relatif :</span>
                  <span className="text-sky-300 font-semibold">
                    ΔX: {deltaX > 0 ? `+${deltaX}` : deltaX}mm, ΔY: {deltaY > 0 ? `+${deltaY}` : deltaY}mm
                  </span>
                </div>
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Distance :</span>
                  <span className="text-slate-200">{directDistanceM} m</span>
                </div>
              </div>

              {/* Affectation de la prise à une place spécifique du bureau */}
              {getDeskSeatCount(linkedDesk.subType) > 1 && (
                <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-300 font-medium flex items-center gap-1">
                      <Users className="w-3 h-3 text-blue-400" />
                      Attribution à la place :
                    </span>
                    {selectedNode.attachedSeatIndex !== undefined ? (
                      <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                        Place {selectedNode.attachedSeatIndex + 1}
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-500">Commune</span>
                    )}
                  </div>
                  <select
                    value={selectedNode.attachedSeatIndex !== undefined ? selectedNode.attachedSeatIndex : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        onUpdateNodeProperties?.(selectedNode.id, {
                          attachedSeatIndex: undefined,
                          assignedPerson: undefined,
                        });
                      } else {
                        const seatIdx = Number(val);
                        const occupant = linkedDesk.seats?.find((s) => s.seatIndex === seatIdx);
                        onUpdateNodeProperties?.(selectedNode.id, {
                          attachedSeatIndex: seatIdx,
                          assignedPerson: occupant?.fullName || undefined,
                        });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                  >
                    <option value="">🌐 Prise commune (non attribuée)</option>
                    {Array.from({ length: getDeskSeatCount(linkedDesk.subType) }).map((_, i) => {
                      const seatOccupant = linkedDesk.seats?.find((s) => s.seatIndex === i);
                      const labels = getDefaultSeatLabels(linkedDesk.subType);
                      const label = seatOccupant?.seatLabel ?? labels[i] ?? `Place ${i + 1}`;
                      const occupantDesc = seatOccupant?.fullName ? ` (${seatOccupant.fullName})` : " (Libre)";
                      return (
                        <option key={`opt-seat-${i}`} value={i}>
                          Place {i + 1} : {label}{occupantDesc}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {siblingOutlets.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] text-slate-400 font-medium mb-1">
                    Autre(s) prise(s) sur ce poste :
                  </div>
                  <div className="space-y-1">
                    {siblingOutlets.map((sibling) => (
                      <button
                        key={sibling.id}
                        onClick={() => onSelectNode?.(sibling)}
                        className="w-full p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-left flex items-center justify-between transition group"
                      >
                        <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-300 group-hover:text-white">
                          {sibling.outletRole === "VOIP" ? (
                            <Phone className="w-3 h-3 text-purple-400" />
                          ) : (
                            <Laptop className="w-3 h-3 text-blue-400" />
                          )}
                          {sibling.name}
                        </span>
                        <span className="text-[9px] text-slate-500 group-hover:text-blue-400 flex items-center gap-0.5">
                          Voir <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {onAlignWithDesk && (
                <button
                  onClick={() => onAlignWithDesk(selectedNode.id, linkedDesk.id)}
                  className="w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-mono flex items-center justify-center gap-1.5 transition border border-slate-700"
                >
                  <Target className="w-3 h-3 text-blue-400" />
                  Repositionner au bord du bureau
                </button>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800 leading-relaxed">
              📍 <strong>Prise ou boîte de sol fixe :</strong> Immobile lors des réaménagements de bureau.
            </p>
          )}
        </div>

                {/* 2b. Carte : Raccordement physique au switch / Câblage manuel */}
        {(() => {
          const singleRackId = selectedNode.connectedRackId || availableRacks[0]?.id || "rack-01";
          const singleRack = availableRacks.find((r) => r.id === singleRackId) ?? availableRacks[0];
          const singleSwitches = getSwitchesForRack(singleRack?.id);
          const singleSwitchId = selectedNode.connectedSwitchId || singleSwitches[0]?.id;
          const singleSwitch = singleSwitches.find((s) => s.id === singleSwitchId) ?? singleSwitches[0];
          const singlePortsCount = singleSwitch?.portsCount ?? 24;

          return (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 mb-3 flex-shrink-0 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-sky-400" />
                  Raccordement Réseau (Baie → Switch → Port)
                </span>
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold flex items-center gap-1 ${
                    selectedNode.isPatched
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-slate-950 text-slate-400 border-slate-800"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedNode.isPatched ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    }`}
                  />
                  {selectedNode.isPatched ? "Raccordé" : "Non branché"}
                </span>
              </div>

              {selectedNode.isPatched ? (
                <div className="space-y-2 pt-1 border-t border-slate-800 text-[10px] font-mono">
                  {/* 1. Baie */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">1. Baie cible :</span>
                    {availableRacks.length > 1 ? (
                      <select
                        value={singleRackId}
                        onChange={(e) => {
                          const newRackId = e.target.value;
                          const newSwitches = getSwitchesForRack(newRackId);
                          const targetSwId = newSwitches[0]?.id;
                          const autoPort = findFirstAvailablePort(newRackId, targetSwId, newSwitches[0]?.portsCount ?? 24);
                          onUpdateNodeProperties?.(selectedNode.id, {
                            connectedRackId: newRackId,
                            connectedSwitchId: targetSwId,
                            connectedSwitchPort: autoPort,
                          });
                        }}
                        className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-purple-300 font-bold text-[10px]"
                      >
                        {availableRacks.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-purple-300 font-bold">
                        {singleRack?.name ?? "BAIE-PRINCIPALE-RDC"}
                      </span>
                    )}
                  </div>

                  {/* 2. Switch dans la baie */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">2. Switch dans la baie :</span>
                    {singleSwitches.length > 0 ? (
                      <select
                        value={singleSwitchId}
                        onChange={(e) => {
                          const newSwId = e.target.value;
                          const swObj = singleSwitches.find((s) => s.id === newSwId);
                          const autoPort = findFirstAvailablePort(singleRackId, newSwId, swObj?.portsCount ?? 24);
                          onUpdateNodeProperties?.(selectedNode.id, {
                            connectedSwitchId: newSwId,
                            connectedSwitchPort: autoPort,
                          });
                        }}
                        className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-sky-300 font-bold text-[10px] max-w-[190px] truncate"
                      >
                        {singleSwitches.map((sw) => (
                          <option key={sw.id} value={sw.id}>
                            {sw.name} (U{sw.slotU})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-500 italic">Aucun switch raqué</span>
                    )}
                  </div>

                  {/* 3. Port */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">3. Port commutateur :</span>
                    <select
                      value={selectedNode.connectedSwitchPort || "Gi1/0/1"}
                      onChange={(e) =>
                        onUpdateNodeProperties?.(selectedNode.id, {
                          connectedSwitchPort: e.target.value,
                        })
                      }
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-slate-200 text-[10px] font-mono font-bold max-w-[190px]"
                    >
                      {Array.from({ length: singlePortsCount }).map((_, i) => {
                        const pName = `Gi1/0/${i + 1}`;
                        const swId = singleSwitch?.id || singleSwitchId || "sw-default";
                        const pKey = `${singleRackId}::${swId}::${pName}`;
                        const myKey = `${singleRackId}::${swId}::${selectedNode.connectedSwitchPort}`;
                        const occupant = occupiedPortsMap.get(pKey);
                        const isOccupiedByOther = occupant !== undefined && pKey !== myKey;

                        return (
                          <option
                            key={`sw-port-${i}`}
                            value={pName}
                            disabled={isOccupiedByOther}
                            className={isOccupiedByOther ? "text-slate-600 bg-slate-900" : "text-slate-200"}
                          >
                            {pName} {isOccupiedByOther ? `(${occupant})` : pKey === myKey ? "(Actuel)" : "(Dispo)"}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      onUpdateNodeProperties?.(selectedNode.id, {
                        isPatched: false,
                        connectedRackId: undefined,
                        connectedSwitchId: undefined,
                        connectedSwitchPort: undefined,
                      });
                    }}
                    className="w-full py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-800/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition mt-1"
                  >
                    <Unlink className="w-3.5 h-3.5 text-red-400" />
                    <span>Débrancher du switch (Masquer le câble)</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-1 border-t border-slate-800">
                  <p className="text-[10px] text-slate-400 leading-tight">
                    L'équipement n'a pas de câble tiré sur le plateau. Branchez-le pour générer le cheminement Cat6A vers la baie et le switch choisis.
                  </p>
                  <button
                    onClick={() => {
                      const defRackId = availableRacks[0]?.id || "rack-01";
                      const defSwitches = getSwitchesForRack(defRackId);
                      const defSwId = selectedNode.connectedSwitchId || defSwitches[0]?.id;
                      const sw = defSwitches.find((s) => s.id === defSwId) ?? defSwitches[0];
                      const autoPort = findFirstAvailablePort(defRackId, defSwId, sw?.portsCount ?? 24);
                      onUpdateNodeProperties?.(selectedNode.id, {
                        isPatched: true,
                        connectedRackId: defRackId,
                        connectedSwitchId: defSwId,
                        connectedSwitchPort: autoPort,
                      });
                    }}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>⚡ Câbler vers la Baie (Afficher le tracé)</span>
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* 3. Traçage CTE & Circuit Physique */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Circuit Physique & VLAN
            </span>
            {onTriggerTrace && (
              <button
                onClick={() => onTriggerTrace(selectedNode)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-mono underline"
              >
                Actualiser
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              <Activity className="w-6 h-6 text-blue-500 animate-spin mb-2" />
              <p className="text-[11px] font-mono text-slate-300">Exécution de la CTE récursive...</p>
            </div>
          ) : traceResult ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1 font-mono text-[11px] flex-shrink-0">
                <div className="flex justify-between">
                  <span className="text-slate-400">Longueur cumulée :</span>
                  <span className="text-blue-400 font-semibold">{traceResult.totalCableLengthMeters} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Équipement terminal :</span>
                  <span className="text-slate-200 font-semibold">{traceResult.terminalNode?.name ?? "N/A"}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">VLAN Actif :</span>
                  {traceResult.resolvedVlan ? (
                    <span
                      className={`px-1.5 py-0.5 rounded border font-bold text-[10px] ${
                        traceResult.resolvedVlan.vid === 30
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                          : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      }`}
                    >
                      VID {traceResult.resolvedVlan.vid} — {traceResult.resolvedVlan.name}
                    </span>
                  ) : (
                    <span className="text-amber-400">Non assigné</span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {traceResult.hops.map((hop) => (
                  <div
                    key={hop.hopNumber}
                    className="p-2 rounded border bg-slate-900/80 border-slate-800 text-[10px]"
                  >
                    <div className="flex items-center justify-between font-mono text-slate-400 mb-0.5">
                      <span className="font-semibold text-blue-400">[Hop {hop.hopNumber}] {hop.transitionType}</span>
                      {hop.cableLengthMm > 0 && <span>{hop.cableLengthMm / 1000} m</span>}
                    </div>
                    <div className="font-medium text-slate-200">{hop.nodeName}</div>
                    <div className="text-[9px] text-slate-400">Port {hop.portLabel} ({hop.portDirection})</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-900/50 rounded border border-slate-800 text-center">
              <p className="text-[11px] text-slate-400">Circuit non encore tracé.</p>
              {onTriggerTrace && (
                <button
                  onClick={() => onTriggerTrace(selectedNode)}
                  className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-medium transition"
                >
                  ⚡ Lancer le traçage CTE SQL
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
}

  // Cas 2 : Baie Informatique 19" / Équipement Réseau DSI
  if (
    selectedNode.type === "PATCH_PANEL" ||
    selectedNode.type === "SWITCH" ||
    selectedNode.subType === "RACK_42U" ||
    selectedNode.subType === "RACK_18U"
  ) {
    const totalU = selectedNode.uHeight ?? (selectedNode.subType === "RACK_18U" ? 18 : 42);
    const rackWidthMm = selectedNode.widthMm ?? 800;
    const rackDepthMm = selectedNode.heightMm ?? 1000;
    const connectedOutlets = allNodes.filter((n) => n.type === "WALL_OUTLET");

    const rackDevices: RackDeviceItem[] = selectedNode.devices ?? [];

    const sortedRackDevices = [...rackDevices].sort((a, b) => b.slotU - a.slotU);
    const switchDevices = sortedRackDevices.filter((d) => d.deviceType === "SWITCH");

    // Vérifie si un équipement chevauche un slot U déjà occupé
    // Un équipement de position slotU et taille uSize occupe les slots [slotU - uSize + 1, slotU]
    const findSlotCollision = (candidateSlot: number, candidateSize: number, ignoreDeviceId?: string): RackDeviceItem | null => {
      const candMin = candidateSlot - candidateSize + 1;
      const candMax = candidateSlot;

      for (const dev of rackDevices) {
        if (ignoreDeviceId && dev.id === ignoreDeviceId) continue;
        const devSize = dev.uSize ?? 1;
        const devMin = dev.slotU - devSize + 1;
        const devMax = dev.slotU;

        // Condition de chevauchement d'intervalles entiers
        if (Math.max(candMin, devMin) <= Math.min(candMax, devMax)) {
          return dev;
        }
      }
      return null;
    };

    // Trouve le prochain slot U libre en partant du haut
    const findNextFreeSlot = (size: number = 1): number => {
      for (let u = totalU; u >= size; u--) {
        if (!findSlotCollision(u, size)) {
          return u;
        }
      }
      return 1;
    };

    const handleAddRackDevice = (newDev: RackDeviceItem) => {
      const collision = findSlotCollision(newDev.slotU, newDev.uSize ?? 1);
      if (collision) {
        setAddDeviceError(`Le slot U${newDev.slotU} chevauche "${collision.name}" (U${collision.slotU}, ${collision.uSize ?? 1}U).`);
        return;
      }
      setAddDeviceError(null);
      const updated = [...rackDevices, newDev];
      onUpdateNodeProperties?.(selectedNode.id, { devices: updated });
      setIsAddingRackDevice(false);
    };

    const handleUpdateRackDevice = (devId: string, updates: Partial<RackDeviceItem>) => {
      const targetDev = rackDevices.find((d) => d.id === devId);
      if (!targetDev) return;
      const finalSlot = updates.slotU ?? targetDev.slotU;
      const finalSize = updates.uSize ?? (targetDev.uSize ?? 1);

      const collision = findSlotCollision(finalSlot, finalSize, devId);
      if (collision) {
        setEditDeviceError(`Le slot U${finalSlot} chevauche "${collision.name}" (U${collision.slotU}, ${collision.uSize ?? 1}U).`);
        return;
      }
      setEditDeviceError(null);
      const updated = rackDevices.map((d) => (d.id === devId ? { ...d, ...updates } : d));
      onUpdateNodeProperties?.(selectedNode.id, { devices: updated });
      setEditingDeviceId(null);
    };

    const handleDeleteRackDevice = (devId: string) => {
      const updated = rackDevices.filter((d) => d.id !== devId);
      onUpdateNodeProperties?.(selectedNode.id, { devices: updated });
    };

    const filteredPatches = rackPatches.filter((p) => {
      if (rackVlanFilter === "ALL") return true;
      return String(p.vlanId) === rackVlanFilter;
    });

    const handleCreatePatch = () => {
      const newPatch: InternalRackPatch = {
        id: `patch-${Date.now()}`,
        sourceDevice: "PP-24P-CAT6A (U24)",
        sourcePort: newPatchSourcePort,
        targetDevice: "SW-ACCESS-4A (U22)",
        targetPort: newPatchTargetPort,
        vlanId: newPatchVlan,
        serviceName: newPatchRole || "Cordon de brassage interne",
        cableType: newPatchVlan === 99 ? "DAC_10G" : "CAT6A_RJ45",
        lengthM: 1.0,
        status: "UP",
        speedGbps: newPatchVlan === 99 ? 10 : 1,
      };
      setRackPatches((prev) => [...prev, newPatch]);
      setIsAddingPatch(false);
    };

    const handleDeletePatch = (patchId: string) => {
      setRackPatches((prev) => prev.filter((p) => p.id !== patchId));
    };

    return (
      <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
        {renderModeBanner()}

        {inspectorMode === "VIEW" ? (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Carte de supervision Baie */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 truncate">
                  <Server className="w-3.5 h-3.5 text-purple-400" />
                  <span className="truncate">{selectedNode.name}</span>
                </span>
                <button
                  onClick={() => setInspectorMode("EDIT")}
                  className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded text-[10px] font-semibold transition flex items-center gap-1 flex-shrink-0"
                >
                  ✏️ Modifier
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800">
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <div className="text-slate-400 text-[10px]">Châssis 19" :</div>
                  <div className="text-purple-300 font-bold mt-0.5">
                    Baie {selectedNode.subType === "RACK_18U" ? "18U" : "42U"} ({rackDevices.length} équipements)
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <div className="text-slate-400 text-[10px]">Liaisons brassées :</div>
                  <div className="text-emerald-400 font-bold mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {rackPatches.length} cordons actifs
                  </div>
                </div>
              </div>
            </div>

            {/* Aperçu des cordons de brassage internes */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
                  Cordons de Brassage Internes ({filteredPatches.length})
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Supervision
                </span>
              </div>

              {/* Filtre VLAN rapide sans ascenseur horizontal */}
              <div className="flex flex-wrap items-center gap-1 py-1 text-[10px] font-mono">
                {["ALL", "10", "20", "30", "40", "50", "99", "100"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setRackVlanFilter(v)}
                    className={`px-2 py-0.5 rounded border transition ${
                      rackVlanFilter === v
                        ? "bg-purple-600/30 text-purple-300 border-purple-500 font-bold shadow-sm"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {v === "ALL" ? "Tous" : `VLAN ${v}`}
                  </button>
                ))}
              </div>

              {/* Liste des patchs */}
              <div className="space-y-1.5">
                {filteredPatches.map((patch) => {
                  const vColor =
                    vlanStyles?.[patch.vlanId]?.color ??
                    DEFAULT_VLAN_STYLES[patch.vlanId]?.color ??
                    "#c084fc";

                  return (
                    <div
                      key={patch.id}
                      className="p-2 rounded bg-slate-950/70 border border-slate-850 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 text-[11px]">
                          {patch.serviceName}
                        </span>
                        <span
                          className="text-[9px] font-mono px-1.5 py-0.2 rounded border font-bold"
                          style={{
                            borderColor: `${vColor}60`,
                            backgroundColor: `${vColor}20`,
                            color: vColor,
                          }}
                        >
                          VLAN {patch.vlanId}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>{patch.sourceDevice} [{patch.sourcePort}]</span>
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                        <span>{patch.targetDevice} [{patch.targetPort}]</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bouton d'action pour passer en mode édition */}
            <div className="pt-1">
              <button
                onClick={() => setInspectorMode("EDIT")}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
              >
                ✏️ Gérer le brassage et les équipements
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* En-tête Baie */}
            <div className="border-b border-slate-800 pb-3 mb-2 flex-shrink-0">
              {isEditingRackName ? (
                <div className="flex items-center gap-1.5 w-full mb-1">
                  <Server className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={tempRackName}
                    onChange={(e) => setTempRackName(e.target.value)}
                    className="flex-1 px-2 py-0.5 bg-slate-900 border border-purple-500 rounded text-slate-100 text-xs font-semibold focus:outline-none"
                    autoFocus
                    placeholder="Nom de la baie..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tempRackName.trim()) {
                        onUpdateNodeProperties?.(selectedNode.id, { name: tempRackName.trim() });
                        setIsEditingRackName(false);
                      }
                      if (e.key === "Escape") setIsEditingRackName(false);
                    }}
                  />
                  <button
                    onClick={() => {
                      if (tempRackName.trim()) {
                        onUpdateNodeProperties?.(selectedNode.id, { name: tempRackName.trim() });
                      }
                      setIsEditingRackName(false);
                    }}
                    className="p-1 bg-purple-600 hover:bg-purple-500 text-white rounded transition"
                    title="Valider le renommage"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsEditingRackName(false)}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition"
                    title="Annuler"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 truncate min-w-0">
                    <Server className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="font-semibold text-slate-100 truncate text-xs">
                      {selectedNode.name}
                    </span>
                    <button
                      onClick={() => {
                        setTempRackName(selectedNode.name);
                        setIsEditingRackName(true);
                      }}
                      className="p-1 text-slate-400 hover:text-purple-300 transition"
                      title="Renommer cette baie"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex-shrink-0">
                    BAIE 19&quot; ({totalU}U)
                  </span>
                </div>
              )}

          {/* Éditeur rapide des dimensions et hauteur U de la baie */}
          <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5 mt-1.5 font-mono text-[10px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 text-slate-300 font-semibold">
                <Ruler className="w-3 h-3 text-purple-400" />
                Gabarit Châssis & Élévation :
              </span>
              <span className="text-slate-500">
                {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[9px] text-slate-500 block">Larg. (mm)</label>
                <select
                  value={rackWidthMm}
                  onChange={(e) =>
                    onUpdateNodeProperties?.(selectedNode.id, {
                      widthMm: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200 text-[10px]"
                >
                  <option value={600}>600 mm</option>
                  <option value={800}>800 mm</option>
                  <option value={1000}>1000 mm</option>
                  <option value={1200}>1200 mm</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] text-slate-500 block">Prof. (mm)</label>
                <select
                  value={rackDepthMm}
                  onChange={(e) =>
                    onUpdateNodeProperties?.(selectedNode.id, {
                      heightMm: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200 text-[10px]"
                >
                  <option value={600}>600 mm</option>
                  <option value={800}>800 mm</option>
                  <option value={1000}>1000 mm</option>
                  <option value={1200}>1200 mm</option>
                  <option value={1500}>1500 mm (Grand format)</option>
                  <option value={1800}>1800 mm (Optimal 42U/48U)</option>
                  <option value={2100}>2100 mm (Spacieux)</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] text-slate-500 block">Total U</label>
                <select
                  value={totalU}
                  onChange={(e) => {
                    const u = Number(e.target.value);
                    const minDepth = Math.max(1000, 320 + u * 36);
                    onUpdateNodeProperties?.(selectedNode.id, {
                      uHeight: u,
                      subType: u <= 18 ? "RACK_18U" : "RACK_42U",
                      heightMm: Math.max(rackDepthMm, minDepth),
                    });
                  }}
                  className="w-full bg-slate-900 border border-purple-500/50 text-purple-300 font-bold rounded px-1.5 py-0.5 text-[10px]"
                >
                  <option value={12}>12 U</option>
                  <option value={18}>18 U</option>
                  <option value={24}>24 U</option>
                  <option value={42}>42 U</option>
                  <option value={48}>48 U</option>
                </select>
              </div>
            </div>
          </div>

          {/* Navigation par Onglets de la Baie (4 Onglets) */}
          <div className="grid grid-cols-4 gap-1 mt-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setRackTab("PATCHING")}
              className={`py-1 px-1 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 ${
                rackTab === "PATCHING"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
              title="Brassage interne"
            >
              <ArrowLeftRight className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Brassage ({rackPatches.length})</span>
            </button>
            <button
              onClick={() => setRackTab("EQUIPMENT")}
              className={`py-1 px-1 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 ${
                rackTab === "EQUIPMENT"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
              title="Équipements et Châssis"
            >
              <Zap className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Châssis {totalU}U</span>
            </button>
            <button
              onClick={() => setRackTab("SWITCHES")}
              className={`py-1 px-1 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 ${
                rackTab === "SWITCHES"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
              title="Visualisation Face Avant Switch & Ports"
            >
              <Activity className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Switchs ({switchDevices.length})</span>
            </button>
            <button
              onClick={() => setRackTab("VLANS")}
              className={`py-1 px-1 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 ${
                rackTab === "VLANS"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
              title="Supervision VLANs et IP"
            >
              <Network className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">VLANs</span>
            </button>
          </div>
        </div>

        {/* Corps défilant selon l'onglet actif */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {rackTab === "PATCHING" && (
            <div className="space-y-3">
              {/* Entête & Statistiques de brassage */}
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
                      Branchements Internes de la Baie
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      Liaisons inter-switch, tiroirs optiques et distribution RJ45
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddingPatch(!isAddingPatch)}
                    className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-medium flex items-center gap-1 transition shadow"
                  >
                    <Plus className="w-3 h-3" />
                    {isAddingPatch ? "Fermer" : "Nouveau"}
                  </button>
                </div>

                {/* Formulaire ajout nouveau cordon */}
                {isAddingPatch && (
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-purple-500/40 space-y-2 mt-2">
                    <div className="text-[10px] font-semibold text-purple-300 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Brasser un nouveau cordon interne
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">Origine (U24 PP)</label>
                        <select
                          value={newPatchSourcePort}
                          onChange={(e) => setNewPatchSourcePort(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                        >
                          {Array.from({ length: 24 }).map((_, i) => (
                            <option key={`p-src-${i}`} value={`Port ${String(i + 1).padStart(2, "0")}`}>
                              Port {String(i + 1).padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">Destination (U22 Switch)</label>
                        <select
                          value={newPatchTargetPort}
                          onChange={(e) => setNewPatchTargetPort(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                        >
                          {Array.from({ length: 24 }).map((_, i) => (
                            <option key={`p-tgt-${i}`} value={`Gi1/0/${i + 1}`}>
                              Gi1/0/{i + 1}
                            </option>
                          ))}
                          <option value="Te1/0/1">Te1/0/1 (10G)</option>
                          <option value="Te1/0/2">Te1/0/2 (10G)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">VLAN Assigné</label>
                        <select
                          value={newPatchVlan}
                          onChange={(e) => setNewPatchVlan(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                        >
                          <option value={20}>VLAN 20 (Corp Data)</option>
                          <option value={30}>VLAN 30 (VoIP)</option>
                          <option value={40}>VLAN 40 (Print)</option>
                          <option value={50}>VLAN 50 (WiFi)</option>
                          <option value={99}>VLAN 99 (Trunk)</option>
                          <option value={10}>VLAN 10 (Infra)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">Libellé / Destination</label>
                        <input
                          type="text"
                          value={newPatchRole}
                          onChange={(e) => setNewPatchRole(e.target.value)}
                          placeholder="Ex: Bureau 403 - RJ45-1"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => setIsAddingPatch(false)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleCreatePatch}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold"
                      >
                        Créer le cordon
                      </button>
                    </div>
                  </div>
                )}

                {/* Filtre par VLAN */}
                <div className="flex items-center gap-1 flex-wrap pt-1 pb-0.5 font-mono text-[9px]">
                  <span className="text-slate-500 flex-shrink-0">Filtrer :</span>
                  {[
                    { id: "ALL", label: "Tous" },
                    { id: "20", label: "VLAN 20" },
                    { id: "30", label: "VLAN 30" },
                    { id: "40", label: "VLAN 40" },
                    { id: "50", label: "VLAN 50" },
                    { id: "99", label: "Trunk 99" },
                    { id: "10", label: "Infra 10" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setRackVlanFilter(filter.id)}
                      className={`px-1.5 py-0.5 rounded border transition flex-shrink-0 ${
                        rackVlanFilter === filter.id
                          ? "bg-purple-600 text-white border-purple-500"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Liste détaillée des cordons de brassage internes */}
              <div className="space-y-1.5">
                {filteredPatches.map((patch) => {
                  const isEditingThisPatch = editingPatchId === patch.id;
                  const isVlan30 = patch.vlanId === 30;
                  const isVlan50 = patch.vlanId === 50;
                  const isVlan40 = patch.vlanId === 40;
                  const isTrunk = patch.vlanId === 99;
                  const isInfra = patch.vlanId === 10;

                  const vlanColorClass = isVlan30
                    ? "text-purple-400 bg-purple-500/10 border-purple-500/30"
                    : isVlan50
                    ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/30"
                    : isVlan40
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                    : isTrunk
                    ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
                    : isInfra
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                    : "text-blue-400 bg-blue-500/10 border-blue-500/30";

                  if (isEditingThisPatch) {
                    return (
                      <div
                        key={patch.id}
                        className="p-2.5 bg-slate-950 rounded-lg border border-purple-500 space-y-2"
                      >
                        <div className="flex items-center justify-between text-[10px] text-purple-300 font-semibold">
                          <span className="flex items-center gap-1">
                            <Edit3 className="w-3 h-3" /> Modifier le cordon
                          </span>
                          <span className="font-mono text-[9px] text-slate-400">{patch.id}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-0.5">Port Origine</label>
                            <input
                              type="text"
                              value={editPatchSourcePort}
                              onChange={(e) => setEditPatchSourcePort(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-0.5">Port Destination</label>
                            <input
                              type="text"
                              value={editPatchTargetPort}
                              onChange={(e) => setEditPatchTargetPort(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-0.5">VLAN Assigné</label>
                            <select
                              value={editPatchVlan}
                              onChange={(e) => setEditPatchVlan(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                            >
                              <option value={20}>VLAN 20 (Corp Data)</option>
                              <option value={30}>VLAN 30 (VoIP)</option>
                              <option value={40}>VLAN 40 (Print)</option>
                              <option value={50}>VLAN 50 (WiFi)</option>
                              <option value={99}>VLAN 99 (Trunk)</option>
                              <option value={10}>VLAN 10 (Infra)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-0.5">Statut Liaison</label>
                            <select
                              value={editPatchStatus}
                              onChange={(e) => setEditPatchStatus(e.target.value as "UP" | "DOWN" | "TESTING")}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                            >
                              <option value="UP">UP (Actif)</option>
                              <option value="DOWN">DOWN (Inactif)</option>
                              <option value="TESTING">TESTING (Test)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-0.5">Type de média</label>
                            <select
                              value={editPatchCableType}
                              onChange={(e) =>
                                setEditPatchCableType(e.target.value as "CAT6A_RJ45" | "DAC_10G" | "FIBER_LC")
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200"
                            >
                              <option value="CAT6A_RJ45">Cat6A RJ45 (1G/10G)</option>
                              <option value="DAC_10G">DAC 10G SFP+</option>
                              <option value="FIBER_LC">Fibre Optique LC</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-0.5">Débit (Gbps)</label>
                            <select
                              value={editPatchSpeed}
                              onChange={(e) => setEditPatchSpeed(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                            >
                              <option value={1}>1 Gbps</option>
                              <option value={2.5}>2.5 Gbps (mGig)</option>
                              <option value={10}>10 Gbps (10G)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] text-slate-400 block mb-0.5">Libellé / Service</label>
                          <input
                            type="text"
                            value={editPatchServiceName}
                            onChange={(e) => setEditPatchServiceName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200"
                          />
                        </div>

                        <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-900">
                          <button
                            onClick={() => setEditingPatchId(null)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => {
                              setRackPatches((prev) =>
                                prev.map((p) =>
                                  p.id === patch.id
                                    ? {
                                        ...p,
                                        sourcePort: editPatchSourcePort || p.sourcePort,
                                        targetPort: editPatchTargetPort || p.targetPort,
                                        vlanId: editPatchVlan,
                                        serviceName: editPatchServiceName || p.serviceName,
                                        status: editPatchStatus,
                                        cableType: editPatchCableType,
                                        speedGbps: editPatchSpeed,
                                      }
                                    : p
                                )
                              );
                              setEditingPatchId(null);
                            }}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Enregistrer
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={patch.id}
                      className="p-2 bg-slate-950 rounded-lg border border-slate-800/80 hover:border-slate-700 transition space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 text-[11px] truncate flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              patch.status === "UP" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                            }`}
                          />
                          {patch.serviceName}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${vlanColorClass}`}>
                            VID {patch.vlanId}
                          </span>
                          <button
                            onClick={() => {
                              setEditingPatchId(patch.id);
                              setEditPatchSourcePort(patch.sourcePort);
                              setEditPatchTargetPort(patch.targetPort);
                              setEditPatchVlan(patch.vlanId);
                              setEditPatchServiceName(patch.serviceName);
                              setEditPatchStatus(patch.status);
                              setEditPatchCableType(patch.cableType as any);
                              setEditPatchSpeed(patch.speedGbps);
                            }}
                            className="text-slate-500 hover:text-purple-300 p-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                            title="Modifier ce cordon de brassage"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeletePatch(patch.id)}
                            className="text-slate-600 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                            title="Débrancher ce cordon de brassage"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Cheminement Ports */}
                      <div className="flex items-center justify-between font-mono text-[10px] bg-slate-900/60 p-1.5 rounded border border-slate-900">
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[9px]">{patch.sourceDevice}</span>
                          <span className="text-blue-300 font-semibold">{patch.sourcePort}</span>
                        </div>
                        <div className="flex flex-col items-center px-1 text-slate-500">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400">
                            {patch.cableType === "DAC_10G"
                              ? "DAC 10G"
                              : patch.cableType === "FIBER_LC"
                              ? "Fibre LC"
                              : "Cat6A RJ45"}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-slate-400 text-[9px]">{patch.targetDevice}</span>
                          <span className="text-emerald-300 font-semibold">{patch.targetPort}</span>
                        </div>
                      </div>

                      {/* Détails techniques bas */}
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-0.5">
                        <span>L: {patch.lengthM}m</span>
                        <span className="text-slate-300 font-medium">{patch.speedGbps} Gbps</span>
                        <span className="text-emerald-400 font-semibold">Liaison {patch.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rackTab === "EQUIPMENT" && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      Élévation Châssis Rack ({sortedRackDevices.length} équipements)
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Gestion des commutateurs Aruba, Zyxel, Cisco, PDU & Baie
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsCloudDiscoveryOpen(true)}
                      className="px-2 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-[10px] font-medium flex items-center gap-1 transition shadow"
                      title="Détecter automatiquement les switchs via Aruba Central, Zyxel Nebula Cloud ou SNMP Walk"
                    >
                      <Cloud className="w-3 h-3" />
                      <span>Découverte</span>
                    </button>
                    <button
                      onClick={() => {
                        const nextState = !isAddingRackDevice;
                        setIsAddingRackDevice(nextState);
                        if (nextState) {
                          setNewDeviceName(`SW-ACCESS-${sortedRackDevices.length + 1}`);
                          setNewDeviceSlotU(findNextFreeSlot(1));
                          setNewDeviceUSize(1);
                          setAddDeviceError(null);
                        }
                      }}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-medium flex items-center gap-1 transition"
                      title="Ajouter manuellement un équipement au rack"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isAddingRackDevice ? "Fermer" : "Ajouter"}</span>
                    </button>
                  </div>
                </div>

                {/* Formulaire d'ajout manuel d'équipement raqué */}
                {isAddingRackDevice && (
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-purple-500/40 space-y-2">
                    <div className="text-[10px] font-semibold text-purple-300 flex items-center gap-1">
                      <PlusCircle className="w-3 h-3" />
                      Nouvel Équipement Raqué
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">Nom équipement</label>
                        <input
                          type="text"
                          value={newDeviceName}
                          onChange={(e) => setNewDeviceName(e.target.value)}
                          placeholder="Ex: SW-ACCESS-02"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">Position U (1-{totalU})</label>
                        <input
                          type="number"
                          min={1}
                          max={totalU}
                          value={newDeviceSlotU}
                          onChange={(e) => setNewDeviceSlotU(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">Taille (U)</label>
                        <select
                          value={newDeviceUSize}
                          onChange={(e) => setNewDeviceUSize(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                        >
                          <option value={1}>1 U</option>
                          <option value={2}>2 U</option>
                          <option value={3}>3 U</option>
                          <option value={4}>4 U</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">Marque / Écosystème</label>
                        <select
                          value={newDeviceBrand}
                          onChange={(e) => setNewDeviceBrand(e.target.value as RackDeviceBrand)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200"
                        >
                          <option value="ARUBA">Aruba / HPE</option>
                          <option value="ZYXEL">Zyxel Nebula</option>
                          <option value="CISCO">Cisco Catalyst</option>
                          <option value="FORTINET">Fortinet FortiGate</option>
                          <option value="GENERIC">Générique / Autre</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">Type de matériel</label>
                        <select
                          value={newDeviceType}
                          onChange={(e) => setNewDeviceType(e.target.value as RackDeviceType)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200"
                        >
                          <option value="SWITCH">Commutateur (Switch)</option>
                          <option value="PATCH_PANEL">Panneau de Brassage</option>
                          <option value="FIREWALL">Pare-feu / Routeur</option>
                          <option value="SERVER">Serveur / ESXi</option>
                          <option value="PDU">Bandeau PDU / Onduleur</option>
                          <option value="FIBER_TRAY">Tiroir Optique FTTO</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">Modèle / Référence</label>
                        <input
                          type="text"
                          value={newDeviceModel}
                          onChange={(e) => setNewDeviceModel(e.target.value)}
                          placeholder="Ex: CX 6200F 24G PoE+"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 block mb-0.5">
                          {newDeviceType === "SWITCH" ? "Nb Ports & IP Mgmt" : "Adresse IP Mgmt"}
                        </label>
                        <div className="flex gap-1">
                          {newDeviceType === "SWITCH" && (
                            <input
                              type="number"
                              min={8}
                              max={48}
                              value={newDevicePorts}
                              onChange={(e) => setNewDevicePorts(Number(e.target.value))}
                              title="Nombre de ports"
                              className="w-12 bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                            />
                          )}
                          <input
                            type="text"
                            value={newDeviceIp}
                            onChange={(e) => setNewDeviceIp(e.target.value)}
                            placeholder="Ex: 10.42.0.25"
                            className="flex-1 bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {addDeviceError && (
                      <div className="p-2 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-mono flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0 animate-ping" />
                        <span>{addDeviceError}</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          setIsAddingRackDevice(false);
                          setAddDeviceError(null);
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => {
                          const newDev: RackDeviceItem = {
                            id: `dev-${Date.now()}`,
                            name: newDeviceName.trim() || `DEV-U${newDeviceSlotU}`,
                            slotU: newDeviceSlotU,
                            uSize: newDeviceUSize,
                            deviceType: newDeviceType,
                            brand: newDeviceBrand,
                            model: newDeviceModel.trim() || `${newDeviceBrand} Device`,
                            ipAddress: newDeviceIp.trim() || undefined,
                            portsCount: newDeviceType === "SWITCH" ? newDevicePorts : undefined,
                            status: "ONLINE",
                          };
                          handleAddRackDevice(newDev);
                        }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold"
                      >
                        Ajouter au rack
                      </button>
                    </div>
                  </div>
                )}

                {/* Liste ordonnée des équipements dans le rack */}
                <div className="space-y-1.5">
                  {sortedRackDevices.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-slate-800 text-center space-y-1 my-2">
                      <Server className="w-5 h-5 mx-auto text-slate-600" />
                      <div className="text-[11px] text-slate-400 font-semibold">Aucun module dans cette baie</div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        Cliquez sur "+ Ajouter un équipement" ci-dessus pour équiper cette baie.
                      </div>
                    </div>
                  ) : (
                    sortedRackDevices.map((dev) => {
                    const isBrandAruba = dev.brand === "ARUBA";
                    const isBrandZyxel = dev.brand === "ZYXEL";
                    const isBrandCisco = dev.brand === "CISCO";
                    const isBrandFortinet = dev.brand === "FORTINET";

                    const brandBadgeColor = isBrandAruba
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                      : isBrandZyxel
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      : isBrandCisco
                      ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                      : isBrandFortinet
                      ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
                      : "text-slate-400 bg-slate-800 border-slate-700";

                    return (
                      <div
                        key={dev.id}
                        className="p-2 bg-slate-950 rounded border border-slate-800 hover:border-slate-700 transition space-y-1 group"
                      >
                        {editingDeviceId === dev.id ? (
                          <div className="space-y-2 p-1.5 bg-slate-900/60 rounded border border-purple-500/40">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editingDeviceName}
                                onChange={(e) => setEditingDeviceName(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-100 font-mono text-[10px] flex-1"
                                placeholder="Nom équipement"
                              />
                              <div className="flex items-center gap-1">
                                <label className="text-[9px] text-slate-400">U</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={totalU}
                                  value={editingDeviceSlotU}
                                  onChange={(e) => {
                                    setEditingDeviceSlotU(Number(e.target.value));
                                    setEditDeviceError(null);
                                  }}
                                  className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-1 text-purple-300 font-mono text-[10px]"
                                />
                                <label className="text-[9px] text-slate-400">Taille</label>
                                <select
                                  value={editingDeviceUSize}
                                  onChange={(e) => {
                                    setEditingDeviceUSize(Number(e.target.value));
                                    setEditDeviceError(null);
                                  }}
                                  className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-slate-200 text-[10px]"
                                >
                                  <option value={1}>1U</option>
                                  <option value={2}>2U</option>
                                  <option value={3}>3U</option>
                                  <option value={4}>4U</option>
                                </select>
                              </div>
                            </div>
                            {editDeviceError && (
                              <div className="p-1.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[9px] font-mono">
                                ⚠️ {editDeviceError}
                              </div>
                            )}
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingDeviceId(null);
                                  setEditDeviceError(null);
                                }}
                                className="px-2 py-0.5 bg-slate-800 text-slate-400 hover:text-white rounded text-[10px]"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={() => {
                                  handleUpdateRackDevice(dev.id, {
                                    name: editingDeviceName.trim() || dev.name,
                                    slotU: editingDeviceSlotU,
                                    uSize: editingDeviceUSize,
                                  });
                                }}
                                className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Valider
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
                              <span className="font-mono text-purple-300 font-bold bg-purple-950/60 px-1 py-0.5 rounded text-[10px] border border-purple-800/40">
                                U{String(dev.slotU).padStart(2, "0")}
                                {dev.uSize && dev.uSize > 1 ? ` (${dev.uSize}U)` : ""}
                              </span>

                              <span className="font-mono text-slate-200 font-semibold truncate flex items-center gap-1">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    dev.status === "ONLINE" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                                  }`}
                                />
                                <span className="truncate">{dev.name}</span>
                                <button
                                  onClick={() => {
                                    setEditingDeviceId(dev.id);
                                    setEditingDeviceName(dev.name);
                                    setEditingDeviceSlotU(dev.slotU);
                                    setEditingDeviceUSize(dev.uSize ?? 1);
                                  }}
                                  className="text-slate-500 hover:text-purple-300 opacity-0 group-hover:opacity-100 transition p-0.5"
                                  title="Modifier le nom, emplacement et taille U"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className={`text-[8px] font-mono px-1 py-0.5 rounded border uppercase ${brandBadgeColor}`}>
                                {dev.brand ?? "GENERIC"}
                              </span>
                              {dev.cloudManaged && (
                                <span
                                  className="text-[8px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1 py-0.5 rounded flex items-center gap-0.5"
                                  title="Géré et synchronisé dans le Cloud"
                                >
                                  <Cloud className="w-2.5 h-2.5" />
                                  Cloud
                                </span>
                              )}
                              <button
                                onClick={() => handleDeleteRackDevice(dev.id)}
                                className="text-slate-600 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                                title="Retirer cet équipement du rack"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="truncate">{dev.model}</span>
                          <span className="font-mono text-[9px] text-slate-500 flex-shrink-0 ml-1">
                            {dev.ipAddress ? dev.ipAddress : dev.deviceType}
                            {dev.portsCount ? ` • ${dev.portsCount}P` : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>
            </div>
          )}

          {/* Onglet 3 : Visualiseur Face Avant Switch & Ports */}
          {rackTab === "SWITCHES" && (
            <div className="space-y-3">
              {switchDevices.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-center space-y-2">
                  <Activity className="w-6 h-6 text-slate-600 mx-auto" />
                  <div className="text-xs text-slate-300 font-semibold">Aucun commutateur dans cette baie</div>
                  <div className="text-[10px] text-slate-500">
                    Ajoutez un switch dans l'onglet &quot;Châssis {totalU}U&quot; ou lancez une détection Cloud/SNMP.
                  </div>
                  <button
                    onClick={() => setRackTab("EQUIPMENT")}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold transition"
                  >
                    Ajouter un équipement
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Sélecteur de switch actif si plusieurs switchs */}
                  {switchDevices.length > 1 && switchDevices[0] && (
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                        <span>Sélectionner le commutateur à visualiser :</span>
                        <span className="text-purple-400 font-semibold">{switchDevices.length} switchs</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {switchDevices.map((sw) => {
                          const isActive = (selectedSwitchId ?? switchDevices[0]?.id) === sw.id;
                          return (
                            <button
                              key={sw.id}
                              onClick={() => setSelectedSwitchId(sw.id)}
                              className={`px-2 py-1 rounded text-[10px] font-mono transition flex items-center gap-1.5 border ${
                                isActive
                                  ? "bg-purple-600/30 text-purple-200 border-purple-500 font-bold"
                                  : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  sw.status === "ONLINE" ? "bg-emerald-400" : "bg-slate-500"
                                }`}
                              />
                              <span>{sw.name}</span>
                              <span className="text-[9px] text-slate-500">U{sw.slotU}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Face avant réaliste et statut des ports du switch actif */}
                  {(() => {
                    const fallbackSwitch = switchDevices[0];
                    if (!fallbackSwitch) return null;
                    const activeSwitch =
                      switchDevices.find((sw) => sw.id === (selectedSwitchId ?? fallbackSwitch.id)) ??
                      fallbackSwitch;

                    return (
                      <SwitchPortVisualizer
                        device={activeSwitch}
                        rackPatches={rackPatches}
                      />
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {rackTab === "VLANS" && (
            <div className="space-y-3">
              {/* Management IP & SNMP */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-cyan-400" />
                    Management IP & SNMP Baie
                  </span>
                  {selectedNode.pingStatus ? (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        selectedNode.pingStatus === "ONLINE"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : selectedNode.pingStatus === "DEGRADED"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          selectedNode.pingStatus === "ONLINE" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                        }`}
                      />
                      {selectedNode.pingStatus}
                      {selectedNode.pingLatencyMs !== undefined ? ` (${selectedNode.pingLatencyMs}ms)` : ""}
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                      SNMP v3 Active
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-500" />
                      IP Switch Mgmt :
                    </span>
                    <input
                      type="text"
                      value={selectedNode.ipAddress ?? ""}
                      placeholder="Ex: 10.42.0.10"
                      onChange={(e) =>
                        onUpdateNodeProperties?.(selectedNode.id, {
                          ipAddress: e.target.value.trim() ? e.target.value.trim() : undefined,
                        })
                      }
                      className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[10px] font-mono focus:outline-none focus:border-cyan-500 w-36 text-right"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Activity className="w-3 h-3 text-slate-500" />
                      MAC Châssis :
                    </span>
                    <input
                      type="text"
                      value={selectedNode.macAddress ?? ""}
                      placeholder="Ex: 00:0A:41:88:99:A1"
                      onChange={(e) =>
                        onUpdateNodeProperties?.(selectedNode.id, {
                          macAddress: e.target.value.trim() ? e.target.value.trim() : undefined,
                        })
                      }
                      className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[10px] font-mono focus:outline-none focus:border-cyan-500 w-36 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Table des VLANs */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Segmentation VLANs & Trunks
                </span>

                <div className="space-y-1.5 text-[10px] font-mono">
                  <div className="p-2 bg-slate-950 rounded border border-blue-500/30 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-blue-300">VLAN 20 • VLAN_CORP_DATA</div>
                      <div className="text-[9px] text-slate-400">Subnet: 10.42.20.0/24 • GW: 10.42.20.1</div>
                    </div>
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">Access</span>
                  </div>

                  <div className="p-2 bg-slate-950 rounded border border-purple-500/30 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-purple-300">VLAN 30 • VLAN_VOIP</div>
                      <div className="text-[9px] text-slate-400">Subnet: 10.42.30.0/24 • QoS DSCP EF46</div>
                    </div>
                    <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">Access</span>
                  </div>

                  <div className="p-2 bg-slate-950 rounded border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-amber-300">VLAN 40 • VLAN_PRINT</div>
                      <div className="text-[9px] text-slate-400">Subnet: 10.42.40.0/24 • Filtrage ACL</div>
                    </div>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Access</span>
                  </div>

                  <div className="p-2 bg-slate-950 rounded border border-indigo-500/30 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-indigo-300">VLAN 50 • VLAN_WIFI_INFRA</div>
                      <div className="text-[9px] text-slate-400">Subnet: 10.42.50.0/24 • Bornes AP PoE+</div>
                    </div>
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Access</span>
                  </div>

                  <div className="p-2 bg-slate-950 rounded border border-rose-500/30 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-rose-300">VLAN 99 • VLAN_TRUNK_INTERSWITCH</div>
                      <div className="text-[9px] text-slate-400">Trunk 802.1Q • Ports 10GbE Uplink SFP+</div>
                    </div>
                    <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">Trunk</span>
                  </div>
                </div>
              </div>

              {/* Personnalisation du Tracé & Couleurs de Câbles par VLAN */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <VlanStyleCustomizer
                  vlanStyles={vlanStyles ?? DEFAULT_VLAN_STYLES}
                  onUpdateVlanStyle={onUpdateVlanStyle ?? (() => {})}
                  onResetVlanStyles={onResetVlanStyles}
                  compact={true}
                />
              </div>
            </div>
          )}

          {/* Section : Liaisons vers les prises du plateau */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              Prises Bureaux Raccordées au Panneau ({connectedOutlets.length})
            </span>

            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {connectedOutlets.map((outlet, oIdx) => (
                <button
                  key={outlet.id}
                  onClick={() => onSelectNode?.(outlet)}
                  className="w-full p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-left flex items-center justify-between transition group"
                >
                  <span className="font-mono text-[10px] text-slate-300 group-hover:text-white flex items-center gap-1.5">
                    {outlet.outletRole === "VOIP" ? (
                      <Phone className="w-3 h-3 text-purple-400" />
                    ) : (
                      <Laptop className="w-3 h-3 text-blue-400" />
                    )}
                    {outlet.name}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 group-hover:text-blue-400">
                    Port {String(oIdx + 1).padStart(2, "0")} →
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Champ Description éditable */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
            <label className="text-[10px] text-slate-400 block flex items-center gap-1">
              <FileText className="w-3 h-3 text-blue-400" />
              Notes & Description de la baie :
            </label>
            <textarea
              rows={2}
              value={selectedNode.description ?? ""}
              placeholder="Ex: Baie principale RDC, clés au local sécurité, maintenance annuelle effectuée..."
              onChange={(e) =>
                onUpdateNodeProperties?.(selectedNode.id, { description: e.target.value })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[11px] focus:outline-none focus:border-blue-500 resize-none font-sans"
            />
          </div>
        </div>
      </div>
    )}

    {/* Modal de découverte switchs Cloud (Aruba Central, Nebula, SNMP) */}
    <CloudSwitchDiscoveryModal
      isOpen={isCloudDiscoveryOpen}
      onClose={() => setIsCloudDiscoveryOpen(false)}
      rackName={selectedNode.name}
      rackUHeight={42}
      existingDevices={rackDevices}
      onAddDeviceToRack={handleAddRackDevice}
    />
  </div>
);
}

  // Cas 3 : Bureau / Mobilier (RH, Dimensions réelles & fausses mesures)
  const attachedOutlets = allNodes.filter((n) => n.attachedToDeskId === selectedNode.id);
  const currentWidth = selectedNode.widthMm ?? 1600;
  const currentHeight = selectedNode.heightMm ?? 800;

    return (
      <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
        {renderModeBanner()}

        {inspectorMode === "VIEW" ? (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Carte d'identité du bureau */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 truncate">
                  <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="truncate">{selectedNode.name}</span>
                </span>
                <button
                  onClick={() => setInspectorMode("EDIT")}
                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-semibold transition flex items-center gap-1 flex-shrink-0"
                >
                  ✏️ Modifier
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800">
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <div className="text-slate-400 text-[10px] shrink-0 whitespace-nowrap">Type de mobilier&nbsp;:</div>
                  <div className="text-emerald-400 font-bold mt-0.5 truncate">
                    {selectedNode.subType === "BENCH_QUAD"
                      ? "Îlot 4 Postes (Quad)"
                      : selectedNode.subType === "BENCH_DOUBLE"
                      ? "Bench 2 Postes (Double)"
                      : selectedNode.subType === "MEETING_TABLE"
                      ? "Table de Réunion"
                      : selectedNode.subType === "DESK_EXECUTIVE"
                      ? "Bureau Direction"
                      : selectedNode.subType === "DESK_COMPACT"
                      ? "Poste Compact"
                      : "Bureau Solo Standard"}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <div className="text-slate-400 text-[10px] shrink-0 whitespace-nowrap">Dimensions&nbsp;:</div>
                  <div className="text-slate-200 font-bold mt-0.5">
                    {(currentWidth / 1000).toFixed(2)} × {(currentHeight / 1000).toFixed(2)} m
                  </div>
                </div>
              </div>
            </div>

            {/* Téléphone IP du poste (VoIP) */}
            {(() => {
              const voipOutlet = attachedOutlets.find(
                (o) => o.outletRole === "VOIP" || o.vlanId === 30 || o.stackedPorts?.some((sp) => sp.outletRole === "VOIP" || sp.vlanId === 30)
              );
              const voipIp = voipOutlet?.ipAddress || (voipOutlet?.stackedPorts?.find((sp) => sp.outletRole === "VOIP" || sp.vlanId === 30)?.ipAddress);
              const deskNumDigits = selectedNode.name.match(/\d+/) ? selectedNode.name.match(/\d+/)![0] : "10";
              const userExt = `20${String(deskNumDigits).padStart(2, "0")}`;

              return (
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                      <Phone className="w-3.5 h-3.5 text-purple-400" />
                      <span>Téléphone IP & VoIP</span>
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        voipOutlet
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30 font-bold"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {voipOutlet ? "ÉQUIPÉ" : "NON INSTALLÉ"}
                    </span>
                  </div>

                  {voipOutlet ? (
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-850 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] gap-1">
                        <span className="shrink-0 text-slate-400 whitespace-nowrap">IP Téléphone&nbsp;:</span>
                        <span className="font-mono text-cyan-300 font-bold bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/40">
                          {voipIp || `10.42.30.${100 + (Number(deskNumDigits) % 150)}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 gap-1">
                        <span className="shrink-0 whitespace-nowrap">Ligne / Poste&nbsp;:</span>
                        <span className="font-mono text-slate-200 font-medium">Poste {userExt} (VLAN 30)</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 gap-1">
                        <span className="shrink-0 whitespace-nowrap">Port raccordé&nbsp;:</span>
                        <span className="text-purple-300 font-medium truncate">{voipOutlet.name}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded border border-slate-850 text-[10px] text-slate-400">
                      <span>Aucun terminal VoIP rattaché à ce bureau.</span>
                      {onAddOutletToDesk && (
                        <button
                          onClick={() => onAddOutletToDesk(selectedNode.id, "VOIP")}
                          className="px-2 py-1 bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 rounded text-[10px] font-semibold transition flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          + Ajouter IP Phone
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Places RH et Collaborateurs assignés */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Places & Occupants ({occupiedSeatsCount}/{deskSeatCount} occupés)
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    occupiedSeatsCount === deskSeatCount
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold"
                      : occupiedSeatsCount > 0
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {occupiedSeatsCount === deskSeatCount
                    ? "COMPLET"
                    : occupiedSeatsCount > 0
                    ? "PARTIEL"
                    : "DISPONIBLE"}
                </span>
              </div>

              <div className="space-y-1.5">
                {currentSeats.map((seat, idx) => {
                  const isOccupied = Boolean(seat.fullName);
                  const assignedUser = seat.userId
                    ? ENTERPRISE_DIRECTORY.find((u) => u.id === seat.userId)
                    : seat.fullName
                    ? ENTERPRISE_DIRECTORY.find(
                        (u) => u.fullName.toLowerCase() === seat.fullName?.toLowerCase()
                      )
                    : null;

                  return (
                    <div
                      key={`seat-view-${idx}`}
                      className="p-2 rounded bg-slate-950/70 border border-slate-850 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center text-[10px] font-mono font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                            {seat.fullName ? `👤 ${seat.fullName}` : "Poste Libre / Flex"}
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">
                            {assignedUser?.jobTitle ?? seat.department ?? seat.seatLabel ?? `Place ${idx + 1}`}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                          isOccupied
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {isOccupied ? "OCCUPÉ" : "LIBRE"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prises et équipements connectés à ce bureau */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-sky-400" />
                  Prises Rattachées ({attachedOutlets.length})
                </span>
              </div>

              {attachedOutlets.length > 0 ? (
                <div className="space-y-1">
                  {attachedOutlets.map((outlet) => {
                    const isStacked = Boolean(outlet.stackedPorts && outlet.stackedPorts.length > 0);
                    const vColor =
                      vlanStyles?.[outlet.vlanId ?? 20]?.color ??
                      DEFAULT_VLAN_STYLES[outlet.vlanId ?? 20]?.color ??
                      "#38bdf8";

                    return (
                      <div
                        key={outlet.id}
                        className="p-1.5 rounded bg-slate-950/70 border border-slate-850 flex items-center justify-between text-[10px]"
                      >
                        <span className="font-medium text-slate-200 flex items-center gap-1.5">
                          <span>{outlet.customEmote || (isStacked ? "🔲" : "🔌")}</span>
                          <span>{outlet.name}</span>
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span
                            className="text-[8px] px-1 py-0.2 rounded border font-semibold"
                            style={{
                              borderColor: `${vColor}60`,
                              backgroundColor: `${vColor}20`,
                              color: vColor,
                            }}
                          >
                            VLAN {outlet.vlanId ?? (outlet.outletRole === "VOIP" ? 30 : 20)}
                          </span>
                          <span className="text-slate-400">{outlet.outletRole || "DATA"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400">Aucune prise rattachée à ce mobilier.</p>
              )}
            </div>

            {/* Bouton d'action pour passer en mode édition */}
            <div className="pt-1">
              <button
                onClick={() => setInspectorMode("EDIT")}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
              >
                ✏️ Modifier le mobilier et les collaborateurs
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* En-tête Bureau */}
      <div className="border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-100 flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-emerald-400" />
            {selectedNode.name}
          </span>
          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
            MOBILIER RH
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
          <span>
            Dimensions : {(currentWidth / 1000).toFixed(2)} × {(currentHeight / 1000).toFixed(2)} m
          </span>
          <span className="text-slate-500">
            {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {/* Section 1 : Affectation RH (Multi-Places ou Place Solo) */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
          {deskSeatCount > 1 ? (
            /* Cas Multi-Postes : Bench Double (2 places) ou Îlot Quad (4 places) */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Affectation des Postes ({occupiedSeatsCount}/{deskSeatCount} occupés)
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    occupiedSeatsCount === deskSeatCount
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : occupiedSeatsCount > 0
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {occupiedSeatsCount === deskSeatCount
                    ? "COMPLET"
                    : occupiedSeatsCount > 0
                    ? "PARTIEL"
                    : "VIDE / FLEX"}
                </span>
              </div>

              {/* Cartes individuelles pour chaque place */}
              <div className="space-y-2">
                {currentSeats.map((seat, idx) => {
                  const assignedUser = seat.userId
                    ? ENTERPRISE_DIRECTORY.find((u) => u.id === seat.userId)
                    : seat.fullName
                    ? ENTERPRISE_DIRECTORY.find((u) => u.fullName.toLowerCase() === seat.fullName?.toLowerCase())
                    : null;
                  const isOccupied = Boolean(seat.fullName);
                  const isPickingThisSeat = pickingSeatIndex === idx;
                  const seatOutlets = attachedOutlets.filter((o) => o.attachedSeatIndex === idx);

                  return (
                    <div
                      key={`seat-card-${idx}`}
                      className={`p-2 rounded border transition ${
                        isOccupied
                          ? "bg-slate-950 border-slate-800"
                          : "bg-slate-950/50 border-dashed border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center text-[9px] font-mono">
                            {idx + 1}
                          </span>
                          {seat.seatLabel ?? `Place ${idx + 1}`}
                        </span>
                        <span
                          className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                            isOccupied
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-slate-800 text-slate-500 border-slate-700"
                          }`}
                        >
                          {isOccupied ? "OCCUPÉ" : "DISPONIBLE"}
                        </span>
                      </div>

                      {isOccupied ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                  assignedUser?.avatarColor ?? "bg-blue-600"
                                }`}
                              >
                                {(seat.fullName ?? "U")
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="truncate">
                                <div className="text-[11px] font-semibold text-slate-100 truncate">
                                  {seat.fullName}
                                </div>
                                <div className="text-[9px] text-slate-400 truncate">
                                  {assignedUser?.jobTitle ?? seat.department ?? "Collaborateur"}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleUnassignSeat(idx)}
                              title="Libérer cette place"
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded transition"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              setUserSearchQuery("");
                              setPickingSeatIndex(isPickingThisSeat ? null : idx);
                            }}
                            className="w-full py-0.5 px-2 text-[9px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition text-center"
                          >
                            {isPickingThisSeat ? "Fermer l'annuaire" : "Changer d'occupant..."}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setUserSearchQuery("");
                            setPickingSeatIndex(isPickingThisSeat ? null : idx);
                          }}
                          className="w-full py-1 px-2 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-slate-300 text-[10px] flex items-center justify-between transition"
                        >
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Plus className="w-3 h-3 text-blue-400" />
                            Attribuer un collaborateur
                          </span>
                          <span className="text-[9px] text-blue-400 font-mono">Entra ID</span>
                        </button>
                      )}

                      {/* Prises attribuées à cette place */}
                      {seatOutlets.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-1.5 mt-1.5 border-t border-slate-900">
                          <span className="text-[9px] text-slate-500 font-medium">Prises :</span>
                          {seatOutlets.map((outlet) => (
                            <button
                              key={outlet.id}
                              onClick={() => onSelectNode?.(outlet)}
                              className="px-1.5 py-0.5 rounded bg-blue-950/60 hover:bg-blue-900 border border-blue-800/60 text-[9px] font-mono text-blue-300 flex items-center gap-1 transition"
                              title="Inspecter cette prise"
                            >
                              {outlet.outletRole === "VOIP" ? (
                                <Phone className="w-2.5 h-2.5 text-purple-400" />
                              ) : (
                                <Laptop className="w-2.5 h-2.5 text-blue-400" />
                              )}
                              {outlet.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Sélecteur Annuaire Déroulant pour cette place */}
                      {isPickingThisSeat && (
                        <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5 mt-2 shadow-xl">
                          <div className="relative">
                            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                            <input
                              type="text"
                              value={userSearchQuery}
                              onChange={(e) => setUserSearchQuery(e.target.value)}
                              placeholder="Rechercher par nom, métier ou service..."
                              className="w-full pl-6 pr-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[9px] focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                          </div>

                          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs">
                            {filteredUsers.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => handleAssignUserToSeat(idx, user)}
                                className="w-full p-1.5 rounded flex items-center justify-between text-left transition hover:bg-slate-800 text-slate-300"
                              >
                                <div className="truncate">
                                  <div className="text-[10px] font-medium text-slate-200 truncate">
                                    {user.fullName}
                                  </div>
                                  <div className="text-[8px] text-slate-400 truncate">
                                    {user.jobTitle} • {user.department}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Cas Bureau Solo : 1 seule personne assignée */
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Collaborateur Assigné (Entra ID)
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    selectedNode.assignedPerson
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {selectedNode.assignedPerson ? "OCCUPÉ" : "FLEX / LIBRE"}
                </span>
              </div>

              {/* Profil assigné ou sélection */}
              {currentAssignedUser || selectedNode.assignedPerson ? (
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          currentAssignedUser?.avatarColor ?? "bg-blue-600"
                        }`}
                      >
                        {(currentAssignedUser?.fullName ?? selectedNode.assignedPerson ?? "U")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-100">
                          {currentAssignedUser?.fullName ?? selectedNode.assignedPerson}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {currentAssignedUser?.jobTitle ?? selectedNode.department ?? "Collaborateur"}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        onUpdateNodeProperties?.(selectedNode.id, {
                          assignedPerson: undefined,
                          assignedUserId: undefined,
                          department: undefined,
                          seats: [],
                        })
                      }
                      title="Libérer le poste (passer en flex)"
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded transition"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {currentAssignedUser && (
                    <div className="pt-1.5 border-t border-slate-900 grid grid-cols-1 gap-1 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span>{currentAssignedUser.department}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-400">
                        <Mail className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{currentAssignedUser.email}</span>
                      </div>
                      {currentAssignedUser.phone && (
                        <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-400">
                          <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span>{currentAssignedUser.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setIsUserPickerOpen((prev) => !prev)}
                    className="w-full py-1 px-2 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition text-center"
                  >
                    {isUserPickerOpen ? "Fermer l'annuaire" : "Changer d'occupant..."}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-400">
                    Poste vacant ou flexible. Attribuez un collaborateur :
                  </div>
                  <button
                    onClick={() => setIsUserPickerOpen((prev) => !prev)}
                    className="w-full py-1.5 px-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs flex items-center justify-between transition"
                  >
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                      Sélectionner dans l'annuaire...
                    </span>
                    <span className="text-[10px] text-blue-400 font-mono">Entra ID</span>
                  </button>
                </div>
              )}

              {/* Menu déroulant de l'Annuaire Entra ID */}
              {isUserPickerOpen && (
                <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg space-y-2 mt-1 shadow-xl">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Rechercher par nom, métier ou service..."
                      className="w-full pl-7 pr-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 text-[10px] focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 pr-1 text-xs">
                    {filteredUsers.map((user) => {
                      const isCurrent = (currentAssignedUser?.id ?? selectedNode.assignedUserId) === user.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            onUpdateNodeProperties?.(selectedNode.id, {
                              assignedPerson: user.fullName,
                              assignedUserId: user.id,
                              department: user.department,
                              seats: [
                                {
                                  seatIndex: 0,
                                  seatLabel: "Place Unique",
                                  userId: user.id,
                                  fullName: user.fullName,
                                  department: user.department,
                                },
                              ],
                            });
                            setIsUserPickerOpen(false);
                          }}
                          className={`w-full p-1.5 rounded flex items-center justify-between text-left transition ${
                            isCurrent
                              ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300"
                              : "hover:bg-slate-900 text-slate-300"
                          }`}
                        >
                          <div className="truncate">
                            <div className="text-[11px] font-medium text-slate-200 truncate flex items-center gap-1">
                              {user.fullName}
                              {isCurrent && <Check className="w-3 h-3 text-emerald-400" />}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate">
                              {user.jobTitle} • <span className="text-slate-500">{user.department}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Champ Description & Notes du poste */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3 text-blue-400" />
              Description & Notes du poste :
            </label>
            <textarea
              rows={2}
              value={selectedNode.description ?? ""}
              placeholder="Ex: Double écran 27 pouces, station d'accueil USB-C, proche baie vitrée..."
              onChange={(e) =>
                onUpdateNodeProperties?.(selectedNode.id, { description: e.target.value })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[11px] focus:outline-none focus:border-blue-500 resize-none font-sans"
            />
          </div>

          {/* Position du libellé du bureau */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] text-slate-400 mb-1 font-medium flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-cyan-400" />
                Position du libellé :
              </span>
              <span className="text-cyan-400 font-mono text-[10px]">
                {selectedNode.labelPosition === "TOP"
                  ? "Haut"
                  : selectedNode.labelPosition === "BOTTOM"
                  ? "Bas"
                  : selectedNode.labelPosition === "LEFT"
                  ? "Gauche"
                  : selectedNode.labelPosition === "RIGHT"
                  ? "Droite"
                  : "Centre"}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
              {[
                { id: "TOP" as const, label: "↑ Haut" },
                { id: "BOTTOM" as const, label: "↓ Bas" },
                { id: "LEFT" as const, label: "← Gauche" },
                { id: "RIGHT" as const, label: "→ Droite" },
              ].map((pos) => (
                <button
                  key={pos.id}
                  onClick={() =>
                    onUpdateNodeProperties?.(selectedNode.id, { labelPosition: pos.id })
                  }
                  className={`py-1 rounded border transition text-center ${
                    selectedNode.labelPosition === pos.id
                      ? "bg-cyan-600/30 text-cyan-300 border-cyan-500 font-bold shadow-sm"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2 : Vraies Échelles vs Mesures Libres / Fausses Mesures */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-blue-400" />
              Dimensions Métriques Réelles
            </span>
            <span className="text-[10px] text-slate-500 font-mono">1 mm = 1 unité</span>
          </div>

          {/* Gabarits rapides standards */}
          <div>
            <div className="text-[10px] text-slate-400 mb-1">Gabarits normalisés rapides :</div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() =>
                  onUpdateNodeProperties?.(selectedNode.id, { widthMm: 1600, heightMm: 800, subType: "DESK_SOLO" })
                }
                className={`py-1 px-1 rounded text-[10px] font-mono border transition ${
                  currentWidth === 1600 && currentHeight === 800 && selectedNode.subType === "DESK_SOLO"
                    ? "bg-blue-600 text-white border-blue-500 font-bold"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                Solo 160 × 80 cm
              </button>
              <button
                onClick={() =>
                  onUpdateNodeProperties?.(selectedNode.id, { widthMm: 1200, heightMm: 700, subType: "DESK_COMPACT" })
                }
                className={`py-1 px-1 rounded text-[10px] font-mono border transition ${
                  currentWidth === 1200 && currentHeight === 700 && selectedNode.subType === "DESK_COMPACT"
                    ? "bg-blue-600 text-white border-blue-500 font-bold"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                Solo 120 × 70 cm
              </button>
              <button
                onClick={() => {
                  const dblLabels = getDefaultSeatLabels("BENCH_DOUBLE");
                  const initSeats: DeskSeatOccupant[] = dblLabels.map((lbl, i) => ({
                    seatIndex: i,
                    seatLabel: lbl,
                    userId: selectedNode.seats?.[i]?.userId,
                    fullName: selectedNode.seats?.[i]?.fullName,
                    department: selectedNode.seats?.[i]?.department,
                  }));
                  onUpdateNodeProperties?.(selectedNode.id, {
                    widthMm: 1600,
                    heightMm: 1600,
                    subType: "BENCH_DOUBLE",
                    seats: initSeats,
                  });
                }}
                className={`py-1 px-1 rounded text-[10px] font-mono border transition ${
                  currentWidth === 1600 && currentHeight === 1600 && selectedNode.subType === "BENCH_DOUBLE"
                    ? "bg-blue-600 text-white border-blue-500 font-bold"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                Bench 2P (160²)
              </button>
              <button
                onClick={() => {
                  const quadLabels = getDefaultSeatLabels("BENCH_QUAD");
                  const initSeats: DeskSeatOccupant[] = quadLabels.map((lbl, i) => ({
                    seatIndex: i,
                    seatLabel: lbl,
                    userId: selectedNode.seats?.[i]?.userId,
                    fullName: selectedNode.seats?.[i]?.fullName,
                    department: selectedNode.seats?.[i]?.department,
                  }));
                  onUpdateNodeProperties?.(selectedNode.id, {
                    widthMm: 3200,
                    heightMm: 1600,
                    subType: "BENCH_QUAD",
                    seats: initSeats,
                  });
                }}
                className={`py-1 px-1 rounded text-[10px] font-mono border transition ${
                  currentWidth === 3200 && currentHeight === 1600 && selectedNode.subType === "BENCH_QUAD"
                    ? "bg-blue-600 text-white border-blue-500 font-bold"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                Îlot 4P (320×160)
              </button>
            </div>
          </div>

          {/* Saisie manuelle libre (fausses ou vraies mesures au mm) */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 shrink-0 whitespace-nowrap">Largeur (mm)&nbsp;:</label>
              <input
                type="number"
                step="50"
                value={currentWidth}
                onChange={(e) =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    widthMm: Math.max(400, Number(e.target.value)),
                  })
                }
                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-slate-200 text-[11px] focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 shrink-0 whitespace-nowrap">Profondeur (mm)&nbsp;:</label>
              <input
                type="number"
                step="50"
                value={currentHeight}
                onChange={(e) =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    heightMm: Math.max(400, Number(e.target.value)),
                  })
                }
                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-slate-200 text-[11px] focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Orientation & Fauteuil */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 whitespace-nowrap">
              <Armchair className="w-3.5 h-3.5 text-slate-400" />
              <span>Position Fauteuil&nbsp;:</span>
            </span>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    chairPosition: selectedNode.chairPosition === "NONE" ? "BOTTOM" : "NONE",
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  selectedNode.chairPosition !== "NONE"
                    ? "bg-slate-800 text-emerald-400 border-emerald-500/40"
                    : "bg-slate-950 text-slate-500 border-slate-800"
                }`}
              >
                {selectedNode.chairPosition !== "NONE" ? "Actif" : "Masqué"}
              </button>
              <button
                onClick={() =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    rotationDeg: ((selectedNode.rotationDeg ?? 0) + 90) % 360,
                  })
                }
                title="Pivoter le bureau de 90° (sens horaire)"
                className="px-2 py-0.5 text-[10px] text-blue-400 hover:text-white bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 transition flex items-center gap-1 font-mono"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{selectedNode.rotationDeg ?? 0}°</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 3 : Prises Solidaires & Câblage Réseau */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              Prises Solidaires ({attachedOutlets.length})
            </span>
          </div>

          <div className="space-y-1.5">
            {onAddColonnetteToDesk && (
              <button
                onClick={() => onAddColonnetteToDesk(selectedNode.id, 4)}
                className="w-full py-1.5 px-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1.5 transition"
                title="Ajouter une colonnette 4 ports RJ45 au milieu du bureau"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                + Colonnette 4x RJ45 (Centre bureau)
              </button>
            )}

            {onAddOutletToDesk && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => onAddOutletToDesk(selectedNode.id, "VOIP")}
                  className="py-1.5 px-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3 h-3" />
                  <Phone className="w-3 h-3 text-purple-400" />
                  + Prise IP Phone
                </button>
                <button
                  onClick={() => onAddOutletToDesk(selectedNode.id, "DATA")}
                  className="py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3 h-3" />
                  <Laptop className="w-3 h-3 text-blue-400" />
                  + Prise Data
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-1">
            {attachedOutlets.map((outlet) => {
              const isVoip = outlet.outletRole === "VOIP";
              const dx = Math.round(outlet.xMm - selectedNode.xMm);
              const dy = Math.round(outlet.yMm - selectedNode.yMm);

              return (
                <div
                  key={outlet.id}
                  className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    {isVoip ? (
                      <Phone className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <Laptop className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <div>
                      <div className="font-mono text-slate-200">{outlet.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        ΔX {dx > 0 ? `+${dx}` : dx}mm, ΔY {dy > 0 ? `+${dy}` : dy}mm
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {deskSeatCount > 1 && (
                      <select
                        value={outlet.attachedSeatIndex !== undefined ? outlet.attachedSeatIndex : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            onUpdateNodeProperties?.(outlet.id, {
                              attachedSeatIndex: undefined,
                              assignedPerson: undefined,
                            });
                          } else {
                            const seatIdx = Number(val);
                            const occupant = currentSeats.find((s) => s.seatIndex === seatIdx);
                            onUpdateNodeProperties?.(outlet.id, {
                              attachedSeatIndex: seatIdx,
                              assignedPerson: occupant?.fullName || undefined,
                            });
                          }
                        }}
                        className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] text-slate-300 focus:outline-none focus:border-blue-500 font-sans"
                        title="Attribution à une place"
                      >
                        <option value="">Commune</option>
                        {currentSeats.map((s, sIdx) => (
                          <option key={sIdx} value={sIdx}>
                            P{sIdx + 1} {s.fullName ? `(${s.fullName.split(" ")[0]})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => onSelectNode?.(outlet)}
                      title="Inspecter le circuit"
                      className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onToggleAttachment(outlet.id, undefined)}
                      title="Détacher"
                      className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  )}
</div>
);
};

export const CircuitInspector = memo(CircuitInspectorComponent);
