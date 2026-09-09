"use client";

import { useState, useMemo, type FC } from "react";
import { CircuitTraceResult } from "@/db/queries/trace-link";
import {
  NodeDisplay,
  OutletRole,
  PoeMode,
  DeskSeatOccupant,
  StackedPortItem,
  getDeskSeatCount,
  getDefaultSeatLabels,
} from "@/components/canvas/EquipmentLayer";
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
  ArrowUpDown,
} from "lucide-react";
import { VlanStyleCustomizer } from "./VlanStyleCustomizer";
import { VlanStyle, DEFAULT_VLAN_STYLES } from "@/data/vlanStyles";

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
  status: "UP" | "DOWN";
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
  allNodes: NodeDisplay[];
  desks: NodeDisplay[];
  onToggleAttachment: (outletId: string, deskId?: string | undefined) => void;
  onAlignWithDesk?: ((outletId: string, deskId: string) => void) | undefined;
  onTriggerTrace?: ((outletNode: NodeDisplay) => void) | undefined;
  onSelectNode?: ((node: NodeDisplay) => void) | undefined;
  onChangeRole?: ((outletId: string, role: OutletRole) => void) | undefined;
  onAddOutletToDesk?: ((deskId: string, role: OutletRole) => void) | undefined;
  onAddColonnetteToDesk?: ((deskId: string, portsCount?: number | undefined) => void) | undefined;
  onUpdateNodeProperties?: ((nodeId: string, updates: Partial<NodeDisplay>) => void) | undefined;
  onAddWaypoint?: ((cableId: string) => void) | undefined;
  onRemoveWaypoint?: ((cableId: string) => void) | undefined;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  onUpdateVlanStyle?: ((vlanId: number, updates: Partial<VlanStyle>) => void) | undefined;
  onResetVlanStyles?: (() => void) | undefined;
}

export const CircuitInspector: FC<CircuitInspectorProps> = ({
  traceResult,
  isLoading,
  selectedNode,
  allNodes,
  desks,
  onToggleAttachment,
  onAlignWithDesk,
  onTriggerTrace,
  onSelectNode,
  onChangeRole: _onChangeRole,
  onAddOutletToDesk,
  onAddColonnetteToDesk,
  onUpdateNodeProperties,
  onAddWaypoint,
  onRemoveWaypoint,
  vlanStyles,
  onUpdateVlanStyle,
  onResetVlanStyles,
}) => {
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);
  const [pickingSeatIndex, setPickingSeatIndex] = useState<number | null>(null);
  const [activeStackedPortIdx, setActiveStackedPortIdx] = useState(0);

  // État interactif du Menu Baie & Branchements Internes
  const [rackTab, setRackTab] = useState<"PATCHING" | "EQUIPMENT" | "VLANS">("PATCHING");
  const [rackVlanFilter, setRackVlanFilter] = useState<string>("ALL");
  const [rackPatches, setRackPatches] = useState<InternalRackPatch[]>(DEFAULT_RACK_PATCHES);
  const [isAddingPatch, setIsAddingPatch] = useState(false);
  const [newPatchSourcePort, setNewPatchSourcePort] = useState("Port 08");
  const [newPatchTargetPort, setNewPatchTargetPort] = useState("Gi1/0/8");
  const [newPatchVlan, setNewPatchVlan] = useState(20);
  const [newPatchRole, setNewPatchRole] = useState("Poste Travail Flex (Data)");

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

  // Accostage rapide bord à bord ou face à face d'un bureau avec son voisin
  const handleDockDesk = (side: "LEFT" | "RIGHT" | "TOP" | "BOTTOM") => {
    if (!selectedNode || selectedNode.type !== "DESK") return;
    const otherDesks = desks.filter((d) => d.id !== selectedNode.id);
    if (otherDesks.length === 0 || !otherDesks[0]) return;
    let closest = otherDesks[0];
    let minDist = Math.hypot(selectedNode.xMm - closest.xMm, selectedNode.yMm - closest.yMm);
    for (const d of otherDesks) {
      const dist = Math.hypot(selectedNode.xMm - d.xMm, selectedNode.yMm - d.yMm);
      if (dist < minDist) {
        minDist = dist;
        closest = d;
      }
    }
    if (!closest) return;

    const curW = selectedNode.widthMm ?? 1600;
    const curH = selectedNode.heightMm ?? 800;
    const targetW = closest.widthMm ?? 1600;
    const targetH = closest.heightMm ?? 800;

    let newX = selectedNode.xMm;
    let newY = selectedNode.yMm;

    if (side === "LEFT") {
      newX = closest.xMm - curW;
      newY = closest.yMm;
    } else if (side === "RIGHT") {
      newX = closest.xMm + targetW;
      newY = closest.yMm;
    } else if (side === "TOP") {
      newX = closest.xMm;
      newY = closest.yMm - curH;
    } else if (side === "BOTTOM") {
      newX = closest.xMm;
      newY = closest.yMm + targetH;
    }

    onUpdateNodeProperties?.(selectedNode.id, {
      xMm: Math.round(newX),
      yMm: Math.round(newY),
      rotationDeg: closest.rotationDeg ?? 0,
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

  // Aucun équipement sélectionné
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
          <Zap className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-xs font-semibold text-slate-300">Aucun élément sélectionné</p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
          Cliquez sur un bureau (RH & Espace), une prise murale, une boîte de sol ou une baie pour configurer ses propriétés réelles.
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

      return (
        <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
          {/* 1. En-tête Colonnette Multi-Ports */}
          <div className="border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
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

            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
              <span>Slot multiposte ({ports.length}x RJ45 Cat6A)</span>
              <span className="text-slate-500">
                {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
              </span>
            </div>

            {/* Position du libellé de la colonnette */}
            <div className="mt-2.5 pt-2 border-t border-slate-800">
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

            {/* Sélecteur d'onglets de Ports du slot (Port 1 à 8) */}
            <div className="mt-2.5 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
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
                      <span>P{pIdx + 1}</span>
                      <span className="text-[8px] opacity-80 uppercase tracking-tighter">
                        {p.outletRole || "DATA"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* 2. Détails complets du Port Actif */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-sky-400" />
                  Configuration Port P{safeStackedPortIdx + 1} ({curPort.portLabel})
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
                          className={`py-1 px-1 rounded border transition flex items-center justify-center gap-1.5 ${
                            isVlanSelected
                              ? "bg-slate-800 text-white border-cyan-500 font-bold ring-1 ring-cyan-500/50 shadow-sm"
                              : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
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

              {/* Alimentation PoE du port individuel */}
              <div className="pt-1.5 border-t border-slate-800/80">
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
                        handleUpdateStackedPort(safeStackedPortIdx, { poeMode: poe.id })
                      }
                      className={`py-1 rounded border transition text-center ${
                        (curPort.poeMode ?? "NONE") === poe.id
                          ? "bg-amber-600/30 text-amber-300 border-amber-500 font-bold"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {poe.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attribution à une place de bureau */}
              {linkedDesk && (
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-400" />
                    Attribution de ce port à la place :
                  </label>
                  <select
                    value={curPort.attachedSeatIndex !== undefined ? curPort.attachedSeatIndex : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        handleUpdateStackedPort(safeStackedPortIdx, {
                          attachedSeatIndex: undefined,
                          assignedPerson: undefined,
                        });
                      } else {
                        const sIdx = Number(val);
                        const occupant = linkedDesk.seats?.find((s) => s.seatIndex === sIdx);
                        handleUpdateStackedPort(safeStackedPortIdx, {
                          attachedSeatIndex: sIdx,
                          assignedPerson: occupant?.fullName || undefined,
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
                    <Globe className="w-3 h-3 text-slate-500" />
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
                    <Activity className="w-3 h-3 text-slate-500" />
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

            {/* 3. Carte : Liaison Mobilier & Postes */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
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

            {/* 4. Bouton Traçage CTE */}
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
      );
    }

    return (
      <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
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

        {/* 1b. Carte : Cheminement Câble & Coudes Orthogonaux 90° */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 mb-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-blue-400" />
              Coudes Câble (90° Orthogonal)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Routing</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Chaque coude est déplaçable librement pour contourner les bureaux ou suivre les cloisons.
          </p>
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              onClick={() => onAddWaypoint?.(`cable-run-${selectedNode.id}`)}
              className="py-1 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
              title="Ajouter un coude orthogonal à 90°"
            >
              <Plus className="w-3 h-3" />
              + Coude (90°)
            </button>
            <button
              onClick={() => onRemoveWaypoint?.(`cable-run-${selectedNode.id}`)}
              className="py-1 px-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
              title="Retirer le dernier coude du câble"
            >
              <Trash2 className="w-3 h-3" />
              - Retirer coude
            </button>
          </div>
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
    );
  }

  // Cas 2 : Baie Informatique 19" / Équipement Réseau DSI
  if (
    selectedNode.type === "PATCH_PANEL" ||
    selectedNode.type === "SWITCH" ||
    selectedNode.subType === "RACK_42U" ||
    selectedNode.subType === "RACK_18U"
  ) {
    const rackWidthMm = selectedNode.widthMm ?? 800;
    const rackDepthMm = selectedNode.heightMm ?? 1000;
    const connectedOutlets = allNodes.filter((n) => n.type === "WALL_OUTLET");

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
        {/* En-tête Baie */}
        <div className="border-b border-slate-800 pb-3 mb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
              <Server className="w-4 h-4 text-purple-400 flex-shrink-0" />
              {selectedNode.name}
            </span>
            <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex-shrink-0">
              BAIE 19&quot; (42U)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>
              Châssis : {(rackWidthMm / 1000).toFixed(2)} × {(rackDepthMm / 1000).toFixed(2)} m
            </span>
            <span className="text-slate-500">
              {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
            </span>
          </div>

          {/* Navigation par Onglets de la Baie */}
          <div className="grid grid-cols-3 gap-1 mt-2.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setRackTab("PATCHING")}
              className={`py-1 px-1.5 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 ${
                rackTab === "PATCHING"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" />
              Brassage ({rackPatches.length})
            </button>
            <button
              onClick={() => setRackTab("EQUIPMENT")}
              className={`py-1 px-1.5 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 ${
                rackTab === "EQUIPMENT"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Zap className="w-3 h-3" />
              Châssis 42U
            </button>
            <button
              onClick={() => setRackTab("VLANS")}
              className={`py-1 px-1.5 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 ${
                rackTab === "VLANS"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Network className="w-3 h-3" />
              VLANs & IP
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
                <div className="flex items-center gap-1 overflow-x-auto pt-1 pb-0.5 font-mono text-[9px]">
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
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  Élévation Châssis Rack 19&quot; (42U)
                </span>

                <div className="space-y-1.5">
                  {/* U24 Panneau de brassage */}
                  <div className="p-2 bg-slate-950 rounded border border-blue-500/30 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        U24 : PP-24P-CAT6A-U24
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {connectedOutlets.length}/24 brassés
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Panneau RJ45 Cat6A blindé STP • Câblage horizontal des bureaux
                    </div>
                  </div>

                  {/* U22 Switch Cisco */}
                  <div className="p-2 bg-slate-950 rounded border border-emerald-500/30 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        U22 : SW-ACCESS-4A-U22
                      </span>
                      <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                        Cisco C9300
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      24 Ports 1GbE PoE+ 370W • Uplink 10GbE SFP+ vers Cœur
                    </div>
                  </div>

                  {/* U20 Switch d'agrégation */}
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        U20 : SW-DISTRIB-4B
                      </span>
                      <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        48P 10GbE
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Commutateur de distribution & agrégation LACP 802.1AX
                    </div>
                  </div>

                  {/* U15 Pare-feu Fortinet */}
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        U15 : FW-FORTIGATE-100F
                      </span>
                      <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                        Next-Gen
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Pare-feu périmétrique, VPN IPsec & inspection SSL
                    </div>
                  </div>

                  {/* U10 Serveur ESXi */}
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        U10 : SRV-ESXI-POWEREDGE
                      </span>
                      <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                        VMware ESXi
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Serveur applicatif DSI, contrôleur AD DC & DNS local
                    </div>
                  </div>

                  {/* U05 Tiroir optique FTTO */}
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        U05 : Tiroir Optique FTTO
                      </span>
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        Fibre Orange
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Arrivée opérateur Fibre Dédiée 1 Gbps symétrique GTR 4H
                    </div>
                  </div>

                  {/* U01 PDU */}
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" />
                        U01 : PDU-APC-16A
                      </span>
                      <span className="text-[9px] font-mono text-amber-400">230V Ondulé</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Alimentation secourue sur onduleur centralisé
                    </div>
                  </div>
                </div>
              </div>
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
    );
  }

  // Cas 3 : Bureau / Mobilier (RH, Dimensions réelles & fausses mesures)
  const attachedOutlets = allNodes.filter((n) => n.attachedToDeskId === selectedNode.id);
  const currentWidth = selectedNode.widthMm ?? 1600;
  const currentHeight = selectedNode.heightMm ?? 800;

  return (
    <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
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
              <label className="text-[10px] text-slate-400 block mb-1">Largeur (mm) :</label>
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
              <label className="text-[10px] text-slate-400 block mb-1">Profondeur (mm) :</label>
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
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Armchair className="w-3.5 h-3.5 text-slate-400" />
              Position Fauteuil :
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

        {/* Section 2b : Accostage Rapide aux Bureaux Voisins */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-blue-400" />
              Accostage aux Bureaux Voisins
            </span>
            <span className="text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
              Magnétisme bord à bord
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            Coller ce bureau contre le bureau voisin le plus proche :
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleDockDesk("LEFT")}
              className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
              title="Coller bord à gauche du bureau voisin"
            >
              <ArrowLeftRight className="w-3 h-3 text-sky-400" />
              Coller à Gauche
            </button>
            <button
              onClick={() => handleDockDesk("RIGHT")}
              className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
              title="Coller bord à droite du bureau voisin"
            >
              <ArrowLeftRight className="w-3 h-3 text-sky-400" />
              Coller à Droite
            </button>
            <button
              onClick={() => handleDockDesk("TOP")}
              className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
              title="Coller face-à-face au-dessus"
            >
              <ArrowUpDown className="w-3 h-3 text-emerald-400" />
              Face-à-Face (Haut)
            </button>
            <button
              onClick={() => handleDockDesk("BOTTOM")}
              className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
              title="Coller face-à-face en-dessous"
            >
              <ArrowUpDown className="w-3 h-3 text-emerald-400" />
              Face-à-Face (Bas)
            </button>
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
  );
};
