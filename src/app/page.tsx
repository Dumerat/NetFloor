"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useCameraStore } from "@/engine/spatial/useCameraStore";
import { CircuitInspector } from "@/components/ui/CircuitInspector";
import { EquipmentPalette, PaletteItem } from "@/components/ui/EquipmentPalette";
import { CsvImportModal } from "@/components/ui/CsvImportModal";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { DeviceTelemetry } from "@/data/settingsStore";
import { CircuitTraceResult } from "@/db/queries/trace-link";
import { NodeDisplay, RackDisplay, OutletRole, StackedPortItem, getDefaultSeatLabels } from "@/components/canvas/EquipmentLayer";
import { CableData, CableFilterMode } from "@/components/canvas/CableLayer";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  UploadCloud,
  Network,
  Activity,
  Users,
  Layers,
  Sparkles,
  Download,
  Palette,
  X,
} from "lucide-react";
import {
  VlanStyle,
  DEFAULT_VLAN_STYLES,
  loadStoredVlanStyles,
  saveStoredVlanStyles,
} from "@/data/vlanStyles";
import { VlanStyleCustomizer } from "@/components/ui/VlanStyleCustomizer";

// Chargement dynamique du canvas Konva sans SSR
const DynamicFloorCanvas = dynamic(
  () => import("@/components/canvas/FloorCanvas").then((mod) => mod.FloorCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-500 font-mono text-xs">
        <Activity className="w-5 h-5 animate-spin mr-2 text-blue-500" />
        Initialisation du moteur spatial React-Konva...
      </div>
    ),
  }
);

export default function NetFloorApp() {
  const { viewport, zoomIn, zoomOut, fitFloor } = useCameraStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("outlet-408-a");
  const [traceResult, setTraceResult] = useState<CircuitTraceResult | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);

  // Vue Métier active
  const [activeViewMode, setActiveViewMode] = useState<
    "ALL" | "HR" | "TECH" | "MAINTENANCE" | "NETWORK"
  >("ALL");

  // Filtre actif des câbles (DSI / Réseau)
  const [cableFilterMode, setCableFilterMode] = useState<CableFilterMode>("ALL");

  // Styles visuels des câbles par VLAN (couleur, motif plein/pointillé, épaisseur)
  const [vlanStyles, setVlanStyles] = useState<Record<number, VlanStyle>>(DEFAULT_VLAN_STYLES);
  const [isVlanStyleModalOpen, setIsVlanStyleModalOpen] = useState(false);

  // Chargement des styles VLAN stockés au montage
  useEffect(() => {
    setVlanStyles(loadStoredVlanStyles());
  }, []);

  // Mise à jour d'un style de VLAN avec persistance
  const handleUpdateVlanStyle = useCallback((vlanId: number, updates: Partial<VlanStyle>) => {
    setVlanStyles((prev) => {
      const existing = prev[vlanId] ?? DEFAULT_VLAN_STYLES[vlanId] ?? {
        vlanId,
        vlanName: `VLAN ${vlanId}`,
        color: "#3b82f6",
        strokePattern: "SOLID",
        thickness: "NORMAL",
      };
      const updated = {
        ...prev,
        [vlanId]: { ...existing, ...updates },
      };
      saveStoredVlanStyles(updated);
      return updated;
    });
  }, []);

  // Réinitialisation des styles de VLAN aux valeurs par défaut
  const handleResetVlanStyles = useCallback(() => {
    setVlanStyles(DEFAULT_VLAN_STYLES);
    saveStoredVlanStyles(DEFAULT_VLAN_STYLES);
  }, []);

  // Waypoints de courbure personnalisés déplacés par l'utilisateur à la souris
  const [customWaypoints, setCustomWaypoints] = useState<Record<string, { x: number; y: number }[]>>({});

  const handleWaypointChange = useCallback(
    (cableId: string, waypointIndex: number, newPos: { x: number; y: number }) => {
      setCustomWaypoints((prev) => {
        const existing = prev[cableId] ? [...prev[cableId]] : [];
        existing[waypointIndex] = newPos;
        return { ...prev, [cableId]: existing };
      });
    },
    []
  );

  // Étage
  const [floorData] = useState({
    widthMm: 60000,
    heightMm: 35000,
  });

  // Baies informatiques (Local Technique DSI)
  const [racks, setRacks] = useState<RackDisplay[]>([
    {
      id: "rack-01",
      name: "BAIE-PRINCIPALE-RDC",
      xMm: 12000,
      yMm: 14000,
      widthMm: 800,
      depthMm: 1000,
      uHeight: 42,
    },
  ]);

  // Nœuds du plateau (Bureaux multi-places RH, Prises Réseau, Boîtes de Sol, Wi-Fi, Baies DSI)
  const [nodes, setNodes] = useState<NodeDisplay[]>([
    // 0. Baie informatique principale (Local Technique)
    {
      id: "rack-01",
      type: "PATCH_PANEL",
      name: "BAIE-PRINCIPALE-RDC",
      xMm: 12000,
      yMm: 14000,
      widthMm: 800,
      heightMm: 1000,
      subType: "RACK_42U",
      description: "Baie principale de brassage & serveurs 42U avec commutateur Cisco Catalyst 9300 et bandeau Cat6A.",
      ipAddress: "10.42.0.10",
      macAddress: "00:0A:41:88:99:A1",
      pingStatus: "ONLINE",
      pingLatencyMs: 1,
    },
    // 1. Îlot Bench 4 Postes (4 collaborateurs distincts assignés)
    {
      id: "bench-402",
      type: "DESK",
      name: "Bureau 402",
      xMm: 23000,
      yMm: 15000,
      widthMm: 3200,
      heightMm: 1600,
      subType: "BENCH_QUAD",
      assignedPerson: "Thomas Roux, Sarah Benali, Lucas Vidal, Sophie Mercier",
      department: "Pôle Collaboratif Tech & RH",
      description: "Îlot central 4 postes avec cloisonnettes acoustiques croisées et colonnes de câblage intégrées.",
      chairPosition: "BOTTOM",
      seats: [
        {
          seatIndex: 0,
          seatLabel: "Place 1 (Haut-Gauche)",
          userId: "usr-005",
          fullName: "Thomas Roux",
          department: "Tech Lab",
        },
        {
          seatIndex: 1,
          seatLabel: "Place 2 (Haut-Droite)",
          userId: "usr-002",
          fullName: "Sarah Benali",
          department: "Ressources Humaines",
        },
        {
          seatIndex: 2,
          seatLabel: "Place 3 (Bas-Gauche)",
          userId: "usr-006",
          fullName: "Lucas Vidal",
          department: "Support & Réseaux",
        },
        {
          seatIndex: 3,
          seatLabel: "Place 4 (Bas-Droite)",
          userId: "usr-007",
          fullName: "Sophie Mercier",
          department: "Ressources Humaines",
        },
      ],
    },
    // 2. Bench Double Face-à-Face (2 collaborateurs distincts)
    {
      id: "bench-401",
      type: "DESK",
      name: "Bureau 401",
      xMm: 29000,
      yMm: 15000,
      widthMm: 1600,
      heightMm: 1600,
      subType: "BENCH_DOUBLE",
      assignedPerson: "Julie Dupont, Marc Lefebvre",
      department: "Direction & Infra",
      description: "Bench 2 postes face-à-face avec cloisonnette acoustique centrale.",
      chairPosition: "BOTTOM",
      seats: [
        {
          seatIndex: 0,
          seatLabel: "Place 1 (Face Nord)",
          userId: "usr-003",
          fullName: "Julie Dupont",
          department: "Direction Digitale",
        },
        {
          seatIndex: 1,
          seatLabel: "Place 2 (Face Sud)",
          userId: "usr-004",
          fullName: "Marc Lefebvre",
          department: "Infrastructure IT",
        },
      ],
    },
    // 3. Bureau Solo Standard
    {
      id: "desk-408",
      type: "DESK",
      name: "Bureau 408",
      xMm: 37000,
      yMm: 15000,
      widthMm: 1600,
      heightMm: 800,
      subType: "DESK_SOLO",
      assignedPerson: "Alexandre Martin",
      assignedUserId: "usr-001",
      department: "Tech Lab",
      description: "Station de développement double écran 27\", station d'accueil Thunderbolt USB-C.",
      chairPosition: "BOTTOM",
      seats: [
        {
          seatIndex: 0,
          seatLabel: "Place Unique",
          userId: "usr-001",
          fullName: "Alexandre Martin",
          department: "Tech Lab",
        },
      ],
    },
    // 4. Prises réseau solidaires du Bureau 408
    {
      id: "outlet-408-a",
      type: "WALL_OUTLET",
      name: "Prise 408-A",
      xMm: 38800,
      yMm: 15200,
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      attachedToDeskId: "desk-408",
      outletRole: "DATA",
      assignedPerson: "Alexandre Martin",
      ipAddress: "10.42.20.108",
      macAddress: "B4:2E:99:41:0A:12",
      pingStatus: "ONLINE",
      pingLatencyMs: 4,
    },
    {
      id: "outlet-408-b",
      type: "WALL_OUTLET",
      name: "Prise 408-B",
      xMm: 38800,
      yMm: 15650,
      portId: "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d",
      attachedToDeskId: "desk-408",
      outletRole: "VOIP",
      assignedPerson: "Alexandre Martin",
      ipAddress: "10.42.30.108",
      macAddress: "00:08:5D:8A:22:9C",
      pingStatus: "ONLINE",
      pingLatencyMs: 3,
    },
    // 5. Prises réseau pour l'îlot 402 (affectées aux collaborateurs des places 1 et 2)
    {
      id: "outlet-402-a",
      type: "WALL_OUTLET",
      name: "Prise 402-A",
      xMm: 26400,
      yMm: 15200,
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      attachedToDeskId: "bench-402",
      attachedSeatIndex: 0,
      assignedPerson: "Thomas Roux",
      outletRole: "DATA",
      ipAddress: "10.42.20.102",
      macAddress: "7C:10:C9:22:54:F1",
      pingStatus: "ONLINE",
      pingLatencyMs: 5,
    },
    {
      id: "outlet-402-b",
      type: "WALL_OUTLET",
      name: "Prise 402-B",
      xMm: 26400,
      yMm: 15650,
      portId: "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d",
      attachedToDeskId: "bench-402",
      attachedSeatIndex: 1,
      assignedPerson: "Sarah Benali",
      outletRole: "VOIP",
      ipAddress: "10.42.30.102",
      macAddress: "00:08:5D:9B:31:0D",
      pingStatus: "ONLINE",
      pingLatencyMs: 2,
    },
    // 5b. Colonnette Multi-Ports RJ45 intégrée au centre de l'îlot 402 (1 slot groupé 4 ports)
    {
      id: "colonnette-402",
      type: "WALL_OUTLET",
      name: "Colonnette 402",
      xMm: 23600,
      yMm: 14800,
      attachedToDeskId: "bench-402",
      outletRole: "DATA",
      stackedPorts: [
        {
          portIndex: 0,
          portLabel: "RJ45-1",
          outletRole: "DATA",
          vlanId: 20,
          attachedSeatIndex: 0,
          assignedPerson: "Thomas Roux",
          ipAddress: "10.42.20.101",
          macAddress: "7C:10:C9:22:54:F1",
          pingStatus: "ONLINE",
          pingLatencyMs: 4,
        },
        {
          portIndex: 1,
          portLabel: "RJ45-2",
          outletRole: "VOIP",
          vlanId: 30,
          attachedSeatIndex: 0,
          assignedPerson: "Thomas Roux",
          ipAddress: "10.42.30.101",
          macAddress: "00:08:5D:9B:31:0D",
          pingStatus: "ONLINE",
          pingLatencyMs: 2,
        },
        {
          portIndex: 2,
          portLabel: "RJ45-3",
          outletRole: "DATA",
          vlanId: 20,
          attachedSeatIndex: 1,
          assignedPerson: "Sarah Benali",
          ipAddress: "10.42.20.102",
          macAddress: "7C:10:C9:22:54:F2",
          pingStatus: "ONLINE",
          pingLatencyMs: 3,
        },
        {
          portIndex: 3,
          portLabel: "RJ45-4",
          outletRole: "VOIP",
          vlanId: 30,
          attachedSeatIndex: 1,
          assignedPerson: "Sarah Benali",
          ipAddress: "10.42.30.102",
          macAddress: "00:08:5D:9B:31:0E",
          pingStatus: "ONLINE",
          pingLatencyMs: 2,
        },
      ],
    },
    // 6. Boîte de Sol Centrale
    {
      id: "floorbox-01",
      type: "WALL_OUTLET",
      name: "Boîte Sol 1",
      xMm: 33000,
      yMm: 20000,
      widthMm: 300,
      heightMm: 300,
      subType: "FLOOR_BOX",
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      outletRole: "DATA",
      ipAddress: "10.42.20.50",
      macAddress: "00:1B:44:11:22:33",
      pingStatus: "ONLINE",
      pingLatencyMs: 4,
    },
    // 7. Borne Wi-Fi Plafond
    {
      id: "wifi-01",
      type: "WALL_OUTLET",
      name: "Wi-Fi 04",
      xMm: 28000,
      yMm: 11000,
      widthMm: 350,
      heightMm: 350,
      subType: "WIFI_AP",
      outletRole: "WIFI",
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      ipAddress: "10.42.50.4",
      macAddress: "70:69:79:AA:BB:CC",
      pingStatus: "ONLINE",
      pingLatencyMs: 6,
    },
    // 8. Copieur Multifonction Départemental
    {
      id: "printer-01",
      type: "WALL_OUTLET",
      name: "Copieur RH",
      xMm: 22000,
      yMm: 21000,
      widthMm: 800,
      heightMm: 700,
      subType: "PRINTER_STATION",
      outletRole: "PRINTER",
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      ipAddress: "10.42.40.2",
      macAddress: "00:1E:8F:77:88:99",
      pingStatus: "ONLINE",
      pingLatencyMs: 8,
    },
  ]);

  // Bureaux disponibles pour la liaison
  const desks = useMemo(() => nodes.filter((n) => n.type === "DESK"), [nodes]);

  // Nœud actuellement sélectionné (synchronisé en direct, incluant les baies)
  const selectedNode = useMemo(() => {
    const fromNodes = nodes.find((n) => n.id === selectedNodeId);
    if (fromNodes) return fromNodes;
    const fromRacks = racks.find((r) => r.id === selectedNodeId);
    if (fromRacks) {
      return {
        id: fromRacks.id,
        type: "PATCH_PANEL" as const,
        name: fromRacks.name,
        xMm: fromRacks.xMm,
        yMm: fromRacks.yMm,
        widthMm: fromRacks.widthMm,
        heightMm: fromRacks.depthMm,
        subType: "RACK_42U" as const,
        description: `Baie informatique 19" (${fromRacks.uHeight}U) dans le local technique.`,
      };
    }
    return null;
  }, [nodes, racks, selectedNodeId]);

  // Calcul dynamique des câbles : ils suivent TOUTES les prises en direct
  const cables: CableData[] = useMemo(() => {
    if (activeViewMode === "HR") return [];
    const rack = racks.find((r) => r.id === "rack-01") ?? racks[0];
    if (!rack) return [];

    const list: CableData[] = [];

    // Câbles horizontaux pour chaque prise murale présente sur le plateau
    const wallOutlets = nodes.filter((n) => n.type === "WALL_OUTLET");
    wallOutlets.forEach((outlet, index) => {
      const isVoip = outlet.outletRole === "VOIP";
      const isPrinter = outlet.outletRole === "PRINTER";
      const isWifi = outlet.outletRole === "WIFI";

      const vlanId = outlet.vlanId ?? (isVoip ? 30 : isPrinter ? 40 : isWifi ? 50 : 20);

      const customColor = vlanStyles[vlanId]?.color;
      const baseAlpha = "0.85";

      const cableColor = customColor
        ? customColor
        : isVoip
        ? `rgba(168, 85, 247, ${baseAlpha})`
        : isPrinter
        ? `rgba(245, 158, 11, ${baseAlpha})`
        : isWifi
        ? `rgba(99, 102, 241, ${baseAlpha})`
        : `rgba(59, 130, 246, ${baseAlpha})`;

      const cableId = `cable-run-${outlet.id}`;
      const targetPos = { x: rack.xMm + 400, y: rack.yMm + 240 + index * 35 };

      // Cheminement en nappe de câbles faux-plafond (lignes parallèles régulières à angles droits 90° évitant les bureaux)
      const defaultCorridorY = 8800 + (index % 10) * 80;
      const defaultChuteX = 14800 + (index % 10) * 60;
      const cableWaypoints = customWaypoints[cableId] ?? [{ x: defaultChuteX, y: defaultCorridorY }];

      list.push({
        id: cableId,
        cableType: "HORIZONTAL_RUN",
        category: "CAT6A",
        lengthMm: 44200 + index * 400,
        colorCode: cableColor,
        sourcePos: { x: outlet.xMm, y: outlet.yMm },
        targetPos,
        vlanId,
        sourceNodeId: outlet.id,
        targetNodeId: rack.id,
        waypoints: cableWaypoints,
      });
    });

    return list;
  }, [nodes, racks, activeViewMode, customWaypoints, vlanStyles]);

  // Traçage CTE récursif lors du clic sur une prise murale
  const handleSelectOutlet = useCallback(async (outletNode: NodeDisplay) => {
    setSelectedNodeId(outletNode.id);
    setIsTracing(true);

    const portIdToTrace =
      outletNode.portId && outletNode.portId.length > 10
        ? outletNode.portId
        : outletNode.outletRole === "VOIP"
        ? "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d"
        : "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c";

    try {
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startPortId: portIdToTrace }),
      });
      if (res.ok) {
        const data: CircuitTraceResult = await res.json();
        setTraceResult(data);
      }
    } catch (err) {
      console.error("Erreur appel API trace :", err);
    } finally {
      setIsTracing(false);
    }
  }, []);

  // Sélection d'un nœud quelconque (bureau ou prise)
  const handleSelectNode = (node: NodeDisplay) => {
    setSelectedNodeId(node.id);
    if (node.type === "WALL_OUTLET") {
      handleSelectOutlet(node);
    }
  };

  // Traçage automatique au montage pour la prise 408-A
  useEffect(() => {
    const initialOutlet = nodes.find((n) => n.id === "outlet-408-a");
    if (initialOutlet) {
      handleSelectOutlet(initialOutlet);
    }
  }, [handleSelectOutlet]);

  // Références pour le throttling 60 FPS des déplacements en direct
  const pendingNodeDragRef = useRef<{ id: string; pos: { x: number; y: number } } | null>(null);
  const rafNodeDragRef = useRef<number | null>(null);
  const pendingRackDragRef = useRef<{ id: string; pos: { x: number; y: number } } | null>(null);
  const rafRackDragRef = useRef<number | null>(null);
  const pendingWaypointDragRef = useRef<{ cableId: string; waypointIndex: number; pos: { x: number; y: number } } | null>(null);
  const rafWaypointDragRef = useRef<number | null>(null);

  // Déplacement d'un nœud (bureau ou prise)
  const handleNodeUpdate = useCallback((id: string, newPos: { x: number; y: number }) => {
    setNodes((prev) => {
      const current = prev.find((n) => n.id === id);
      if (!current || (current.xMm === newPos.x && current.yMm === newPos.y)) return prev;

      if (current.type === "DESK") {
        const deltaX = newPos.x - current.xMm;
        const deltaY = newPos.y - current.yMm;

        return prev.map((n) => {
          if (n.id === id) {
            return { ...n, xMm: newPos.x, yMm: newPos.y };
          }
          if (n.attachedToDeskId === id) {
            return { ...n, xMm: n.xMm + deltaX, yMm: n.yMm + deltaY };
          }
          return n;
        });
      }

      return prev.map((n) => (n.id === id ? { ...n, xMm: newPos.x, yMm: newPos.y } : n));
    });
  }, []);

  // Déplacement direct d'un nœud cadencé à 60 FPS par requestAnimationFrame
  const handleThrottledNodeDragMove = useCallback((id: string, newPos: { x: number; y: number }) => {
    pendingNodeDragRef.current = { id, pos: newPos };
    if (!rafNodeDragRef.current) {
      rafNodeDragRef.current = requestAnimationFrame(() => {
        if (pendingNodeDragRef.current) {
          handleNodeUpdate(pendingNodeDragRef.current.id, pendingNodeDragRef.current.pos);
        }
        rafNodeDragRef.current = null;
      });
    }
  }, [handleNodeUpdate]);

  // Déplacement d'une baie informatique
  const handleRackUpdate = useCallback((id: string, newPos: { x: number; y: number }) => {
    setRacks((prev) => {
      const current = prev.find((r) => r.id === id);
      if (!current || (current.xMm === newPos.x && current.yMm === newPos.y)) return prev;
      return prev.map((r) => (r.id === id ? { ...r, xMm: newPos.x, yMm: newPos.y } : r));
    });
    setNodes((prev) => {
      const current = prev.find((n) => n.id === id);
      if (!current || (current.xMm === newPos.x && current.yMm === newPos.y)) return prev;
      return prev.map((n) => (n.id === id ? { ...n, xMm: newPos.x, yMm: newPos.y } : n));
    });
  }, []);

  // Fin du déplacement d'un nœud ou d'une baie (commit immédiat avec magnétisme et détachement automatique fluide)
  const handleNodeMoveEnd = useCallback((id: string, newPos: { x: number; y: number }) => {
    if (rafNodeDragRef.current) {
      cancelAnimationFrame(rafNodeDragRef.current);
      rafNodeDragRef.current = null;
    }
    if (rafRackDragRef.current) {
      cancelAnimationFrame(rafRackDragRef.current);
      rafRackDragRef.current = null;
    }
    pendingNodeDragRef.current = null;
    pendingRackDragRef.current = null;

    // Détachement automatique au glissé : si une prise liée à un meuble est tirée loin du meuble
    setNodes((prev) => {
      const node = prev.find((n) => n.id === id);
      if (node && node.type === "WALL_OUTLET" && node.attachedToDeskId) {
        const linkedDesk = prev.find((d) => d.id === node.attachedToDeskId);
        if (linkedDesk) {
          const deskW = linkedDesk.widthMm ?? 1600;
          const deskH = linkedDesk.heightMm ?? 800;
          const deskCenterX = linkedDesk.xMm + deskW / 2;
          const deskCenterY = linkedDesk.yMm + deskH / 2;
          const dist = Math.hypot(newPos.x - deskCenterX, newPos.y - deskCenterY);
          const maxAttachDistance = Math.max(deskW, deskH) + 600;
          if (dist > maxAttachDistance) {
            return prev.map((n) =>
              n.id === id
                ? {
                    ...n,
                    xMm: newPos.x,
                    yMm: newPos.y,
                    attachedToDeskId: undefined,
                    attachedSeatIndex: undefined,
                  }
                : n
            );
          }
        }
      }
      return prev;
    });

    handleNodeUpdate(id, newPos);
    handleRackUpdate(id, newPos);
  }, [handleNodeUpdate, handleRackUpdate]);

  // Ajout d'un coude orthogonal supplémentaire sur un câble
  const handleAddWaypoint = useCallback((cableId: string) => {
    setCustomWaypoints((prev) => {
      const existing = prev[cableId] ?? [{ x: 14800, y: 9000 }];
      const lastWp = existing[existing.length - 1] ?? { x: 14800, y: 9000 };
      const newWp = {
        x: Math.round(lastWp.x - 1200),
        y: Math.round(lastWp.y + 1500),
      };
      return { ...prev, [cableId]: [...existing, newWp] };
    });
  }, []);

  // Retrait du dernier coude d'un câble (minimum 1)
  const handleRemoveWaypoint = useCallback((cableId: string) => {
    setCustomWaypoints((prev) => {
      const existing = prev[cableId] ?? [];
      if (existing.length <= 1) return prev;
      return { ...prev, [cableId]: existing.slice(0, -1) };
    });
  }, []);

  // Déplacement d'une baie throttlé par RAF
  const handleThrottledRackDragMove = useCallback((id: string, newPos: { x: number; y: number }) => {
    pendingRackDragRef.current = { id, pos: newPos };
    if (!rafRackDragRef.current) {
      rafRackDragRef.current = requestAnimationFrame(() => {
        if (pendingRackDragRef.current) {
          handleRackUpdate(pendingRackDragRef.current.id, pendingRackDragRef.current.pos);
        }
        rafRackDragRef.current = null;
      });
    }
  }, [handleRackUpdate]);

  // Déplacement fluide des waypoints de câbles cadencé par RAF à 60 FPS
  const handleThrottledWaypointChange = useCallback(
    (cableId: string, waypointIndex: number, newPos: { x: number; y: number }) => {
      pendingWaypointDragRef.current = { cableId, waypointIndex, pos: newPos };
      if (!rafWaypointDragRef.current) {
        rafWaypointDragRef.current = requestAnimationFrame(() => {
          if (pendingWaypointDragRef.current) {
            handleWaypointChange(
              pendingWaypointDragRef.current.cableId,
              pendingWaypointDragRef.current.waypointIndex,
              pendingWaypointDragRef.current.pos
            );
          }
          rafWaypointDragRef.current = null;
        });
      }
    },
    [handleWaypointChange]
  );

  // Nettoyage des timers RAF au démontage
  useEffect(() => {
    return () => {
      if (rafNodeDragRef.current) cancelAnimationFrame(rafNodeDragRef.current);
      if (rafRackDragRef.current) cancelAnimationFrame(rafRackDragRef.current);
      if (rafWaypointDragRef.current) cancelAnimationFrame(rafWaypointDragRef.current);
    };
  }, []);

  // Option : Basculer ou assigner la liaison d'une prise à un bureau
  const handleToggleAttachment = (outletId: string, deskId?: string | undefined) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === outletId ? { ...n, attachedToDeskId: deskId } : n))
    );
  };

  // Option : Changer le rôle de service de la prise (Data, VoIP, Imprimante)
  const handleChangeRole = (outletId: string, role: OutletRole) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === outletId) {
          const portId =
            role === "VOIP"
              ? "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d"
              : "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c";
          return { ...n, outletRole: role, portId };
        }
        return n;
      })
    );
  };

  // Option : Ajouter une prise à un bureau existant
  const handleAddOutletToDesk = (deskId: string, role: OutletRole) => {
    setNodes((prev) => {
      const desk = prev.find((d) => d.id === deskId);
      if (!desk) return prev;

      const deskW = desk.widthMm ?? 1600;
      const existingDeskOutlets = prev.filter((n) => n.attachedToDeskId === deskId);
      const suffixLetter = String.fromCharCode(65 + existingDeskOutlets.length);
      const isVoip = role === "VOIP";
      const newOutletId = `outlet-${deskId}-${role.toLowerCase()}-${Date.now()}`;
      const newPortId = isVoip
        ? "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d"
        : "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c";

      const yOffset = 200 + existingDeskOutlets.length * 450;
      const rotRad = ((desk.rotationDeg ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);

      // Local offset: à droite du bureau
      const localX = deskW + 150;
      const localY = yOffset;

      const worldX = desk.xMm + localX * cos - localY * sin;
      const worldY = desk.yMm + localX * sin + localY * cos;

      const deskNum = desk.name.replace(/^Bureau\s*/i, "").trim();
      const newOutlet: NodeDisplay = {
        id: newOutletId,
        type: "WALL_OUTLET",
        name: `Prise ${deskNum}-${suffixLetter}`,
        xMm: Math.round(worldX),
        yMm: Math.round(worldY),
        portId: newPortId,
        attachedToDeskId: deskId,
        outletRole: role,
      };

      return [...prev, newOutlet];
    });
  };

  // Option : Ajouter une colonnette multi-ports RJ45 (jusqu'à 8 ports) au centre d'un bureau
  const handleAddColonnetteToDesk = (deskId: string, portsCount: number = 4) => {
    setNodes((prev) => {
      const desk = prev.find((d) => d.id === deskId);
      if (!desk) return prev;

      const deskW = desk.widthMm ?? 1600;
      const deskH = desk.heightMm ?? 800;
      const rotRad = ((desk.rotationDeg ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);

      // Position au centre du bureau
      const localCenterX = deskW / 2;
      const localCenterY = deskH / 2;
      const worldCenterX = desk.xMm + localCenterX * cos - localCenterY * sin;
      const worldCenterY = desk.yMm + localCenterX * sin + localCenterY * cos;

      const colonnetteId = `colonnette-${deskId}-${Date.now()}`;
      const deskNum = desk.name.replace(/^Bureau\s*/i, "").trim();

      const numPorts = Math.min(8, Math.max(2, portsCount));
      const initialPorts: StackedPortItem[] = Array.from({ length: numPorts }).map((_, i) => {
        const isEven = i % 2 === 0;
        const seatOccupant = desk.seats && desk.seats[i] ? desk.seats[i] : undefined;
        return {
          portIndex: i,
          portLabel: `RJ45-${i + 1}`,
          outletRole: isEven ? "DATA" : "VOIP",
          vlanId: isEven ? 20 : 30,
          assignedPerson: seatOccupant?.fullName,
          attachedSeatIndex: seatOccupant ? i : undefined,
          ipAddress: `10.42.${isEven ? 20 : 30}.${100 + i}`,
          macAddress: `00:1A:2B:3C:4D:${String(i + 10).padStart(2, "0")}`,
          pingStatus: "ONLINE",
          pingLatencyMs: 2 + i,
        };
      });

      const newColonnette: NodeDisplay = {
        id: colonnetteId,
        type: "WALL_OUTLET",
        name: `Colonnette ${deskNum}`,
        xMm: Math.round(worldCenterX),
        yMm: Math.round(worldCenterY),
        attachedToDeskId: deskId,
        outletRole: "DATA",
        stackedPorts: initialPorts,
      };

      return [...prev, newColonnette];
    });
  };

  // Option : Aligner / repositionner la prise au bord du bureau
  const handleAlignWithDesk = (outletId: string, deskId: string) => {
    setNodes((prev) => {
      const desk = prev.find((d) => d.id === deskId);
      if (!desk) return prev;
      const deskW = desk.widthMm ?? 1600;
      const deskH = desk.heightMm ?? 800;
      const rotRad = ((desk.rotationDeg ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);

      const localX = deskW + 180;
      const localY = deskH / 2;

      const worldX = desk.xMm + localX * cos - localY * sin;
      const worldY = desk.yMm + localX * sin + localY * cos;

      return prev.map((n) => {
        if (n.id === outletId) {
          return {
            ...n,
            xMm: Math.round(worldX),
            yMm: Math.round(worldY),
            attachedToDeskId: deskId,
          };
        }
        return n;
      });
    });
  };

  // Option : Mise à jour libre des propriétés (RH, Dimensions réelles ou fausses mesures, Rotation)
  const handleUpdateNodeProperties = (nodeId: string, updates: Partial<NodeDisplay>) => {
    setNodes((prev) => {
      const target = prev.find((n) => n.id === nodeId);
      if (!target) return prev;

      // Si c'est une rotation de bureau : rotationner sur le centre et faire pivoter les prises solidaires
      if (updates.rotationDeg !== undefined && target.type === "DESK") {
        const oldRotDeg = target.rotationDeg ?? 0;
        const newRotDeg = updates.rotationDeg;
        const deltaDeg = (newRotDeg - oldRotDeg + 360) % 360;

        const deskW = target.widthMm ?? 1600;
        const deskH = target.heightMm ?? 800;
        const oldRad = (oldRotDeg * Math.PI) / 180;
        const newRad = (newRotDeg * Math.PI) / 180;
        const deltaRad = (deltaDeg * Math.PI) / 180;

        // Centre réel actuel du bureau en coordonnées monde
        const centerX = target.xMm + (deskW / 2) * Math.cos(oldRad) - (deskH / 2) * Math.sin(oldRad);
        const centerY = target.yMm + (deskW / 2) * Math.sin(oldRad) + (deskH / 2) * Math.cos(oldRad);

        // Nouvelle position (x, y) de l'origine du bureau pour que son centre reste identique en place
        const newDeskX = centerX - (deskW / 2) * Math.cos(newRad) + (deskH / 2) * Math.sin(newRad);
        const newDeskY = centerY - (deskW / 2) * Math.sin(newRad) - (deskH / 2) * Math.cos(newRad);

        const cosDelta = Math.cos(deltaRad);
        const sinDelta = Math.sin(deltaRad);

        return prev.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              ...updates,
              xMm: Math.round(newDeskX),
              yMm: Math.round(newDeskY),
              rotationDeg: newRotDeg,
            };
          }
          // Faire pivoter les prises rattachées autour du même centre
          if (n.attachedToDeskId === nodeId) {
            const dx = n.xMm - centerX;
            const dy = n.yMm - centerY;
            const rotatedX = centerX + dx * cosDelta - dy * sinDelta;
            const rotatedY = centerY + dx * sinDelta + dy * cosDelta;
            return {
              ...n,
              xMm: Math.round(rotatedX),
              yMm: Math.round(rotatedY),
            };
          }
          return n;
        });
      }

      return prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n));
    });
  };

  // Ajout depuis la Palette d'équipements multi-métiers (Générique, Profils Personnalisés, Mobilier, Baies)
  const handleAddItemFromPalette = (item: PaletteItem) => {
    const offset = nodes.length % 6;
    const newX = 32000 + offset * 1800;
    const newY = 16000 + Math.floor(nodes.length / 6) * 1600;
    const newId = `node-${item.category.toLowerCase()}-${Date.now()}`;

    const defaultLabels = item.targetType === "DESK" ? getDefaultSeatLabels(item.subType) : [];
    const initialSeats =
      item.targetType === "DESK"
        ? defaultLabels.map((lbl, i) => ({
            seatIndex: i,
            seatLabel: lbl,
          }))
        : undefined;

    const isRack =
      item.subType === "RACK_42U" ||
      item.subType === "RACK_18U" ||
      item.targetType === "PATCH_PANEL";

    const isCustom = Boolean(item.isCustomProfile);
    const isGenericPort = item.subType === "GENERIC_PORT";
    const portCount = item.portCount ?? (item.subType === "GENERIC_PORT" ? 1 : 1);
    const assignedVlan = item.vlanId ?? (item.outletRole === "VOIP" ? 30 : 20);

    const computeName = () => {
      if (isCustom) {
        const count = nodes.filter((n) => n.name.startsWith(item.name)).length;
        return count > 0 ? `${item.name} (${count + 1})` : item.name;
      }
      if (isGenericPort) {
        const count = nodes.filter((n) => n.subType === "GENERIC_PORT" || n.name.startsWith("Port-")).length + 1;
        return `Port-${count.toString().padStart(2, "0")}`;
      }
      if (isRack) {
        const rackCount = racks.length;
        return `BAIE-DSI-0${rackCount + 1}`;
      }
      if (item.targetType === "DESK") {
        const deskCount = nodes.filter((n) => n.type === "DESK").length;
        return `Bureau ${403 + deskCount}`;
      }
      if (item.subType === "WIFI_AP") {
        const wifiCount = nodes.filter((n) => n.subType === "WIFI_AP").length;
        return `Wi-Fi 0${wifiCount + 5}`;
      }
      if (item.subType === "PRINTER_STATION") {
        const pCount = nodes.filter((n) => n.subType === "PRINTER_STATION").length;
        return `Copieur RH ${pCount + 1}`;
      }
      const outletCount = nodes.filter((n) => n.type === "WALL_OUTLET" && !n.subType).length;
      return `Prise ${403 + outletCount}`;
    };

    const finalName = computeName();

    if (isRack) {
      const newRack: RackDisplay = {
        id: newId,
        name: finalName,
        xMm: newX,
        yMm: newY,
        widthMm: item.widthMm ?? 800,
        depthMm: item.heightMm ?? 1000,
        uHeight: item.subType === "RACK_18U" ? 18 : 42,
      };
      setRacks((prev) => [...prev, newRack]);
    }

    let stackedPorts: StackedPortItem[] | undefined = undefined;
    if (portCount > 1) {
      stackedPorts = Array.from({ length: portCount }).map((_, idx) => ({
        portIndex: idx,
        portLabel: `RJ45-${idx + 1}`,
        outletRole: item.outletRole ?? "GENERIC",
        vlanId: assignedVlan,
        poeMode: item.poeMode ?? "NONE",
        ipAddress: `10.42.${assignedVlan}.${110 + idx}`,
        macAddress: `00:1A:2B:3C:4D:${String(idx + 20).padStart(2, "0")}`,
        pingStatus: "ONLINE",
        pingLatencyMs: 2,
      }));
    }

    const newNode: NodeDisplay = {
      id: newId,
      type: item.targetType,
      name: finalName,
      xMm: newX,
      yMm: newY,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      subType: item.subType,
      outletRole: item.outletRole,
      assignedPerson: item.category === "FURNITURE" ? "Poste vacant / Flex" : undefined,
      department: item.category === "FURNITURE" ? "Espace Collaboratif" : undefined,
      chairPosition: item.category === "FURNITURE" ? "BOTTOM" : "NONE",
      seats: initialSeats,
      vlanId: assignedVlan,
      poeMode: item.poeMode,
      customEmote: item.customEmote,
      portCount: portCount,
      stackedPorts,
      portId:
        item.targetType === "WALL_OUTLET"
          ? item.outletRole === "VOIP"
            ? "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d"
            : "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c"
          : undefined,
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
  };

  // Synchronisation ou ajout d'un équipement découvert par SNMP sur le plateau 2D
  const handleImportDiscoveredDevice = (dev: DeviceTelemetry) => {
    const mappedStatus: "ONLINE" | "OFFLINE" | "DEGRADED" =
      dev.status === "WARNING" ? "DEGRADED" : dev.status;

    setNodes((prev) => {
      const existing = prev.find(
        (n) =>
          n.id === dev.id ||
          n.name.toLowerCase() === dev.name.toLowerCase() ||
          (n.ipAddress && n.ipAddress === dev.ip)
      );

      if (existing) {
        // Mettre à jour l'équipement existant
        return prev.map((n) => {
          if (n.id === existing.id) {
            return {
              ...n,
              ipAddress: dev.ip,
              macAddress: dev.mac,
              pingStatus: mappedStatus,
              pingLatencyMs: 2,
              description: `Modèle: ${dev.model} • Uptime: ${dev.uptimeDays}j • CPU: ${dev.cpuLoadPercent}% • T°: ${dev.temperatureC}°C`,
            };
          }
          return n;
        });
      }

      // Créer un nouvel équipement sur le plateau
      const targetType =
        dev.deviceType === "SWITCH" || dev.deviceType === "SERVER_RACK"
          ? "PATCH_PANEL"
          : "WALL_OUTLET";
      const subType =
        dev.deviceType === "SERVER_RACK"
          ? "RACK_42U"
          : dev.deviceType === "WIFI_AP"
          ? "WIFI_AP"
          : dev.deviceType === "PRINTER"
          ? "PRINTER_STATION"
          : undefined;
      const outletRole =
        dev.deviceType === "WIFI_AP"
          ? "WIFI"
          : dev.deviceType === "PRINTER"
          ? "PRINTER"
          : "DATA";

      const newNode: NodeDisplay = {
        id: dev.id,
        name: dev.name,
        type: targetType,
        xMm: 24000 + Math.floor(Math.random() * 8000),
        yMm: 12000 + Math.floor(Math.random() * 8000),
        widthMm: dev.deviceType === "SERVER_RACK" ? 800 : dev.deviceType === "PRINTER" ? 800 : 350,
        heightMm: dev.deviceType === "SERVER_RACK" ? 1000 : dev.deviceType === "PRINTER" ? 700 : 350,
        subType,
        outletRole,
        ipAddress: dev.ip,
        macAddress: dev.mac,
        pingStatus: mappedStatus,
        pingLatencyMs: 3,
        description: `Découvert par SNMP: ${dev.model} (Uptime ${dev.uptimeDays} jours)`,
      };

      return [...prev, newNode];
    });

    setSelectedNodeId(dev.id);
  };

  // Export du carnet de câblage au format CSV conforme au schéma CablingRowSchema
  const handleExportCsv = () => {
    const headers = [
      "outlet_name",
      "outlet_port",
      "desk_number",
      "floor_name",
      "rack_name",
      "patch_panel_name",
      "patch_panel_port",
      "cable_category",
      "cable_length_m",
      "switch_name",
      "switch_port",
      "vlan_vid",
      "vlan_name",
    ];

    const wallOutlets = nodes.filter((n) => n.type === "WALL_OUTLET");
    const primaryRack = racks[0] ?? { name: "BAIE-PRINCIPALE-RDC", xMm: 12000, yMm: 14000 };

    const rows = wallOutlets.map((outlet, index) => {
      const linkedDesk = outlet.attachedToDeskId
        ? nodes.find((n) => n.id === outlet.attachedToDeskId)
        : null;
      const deskNumber = linkedDesk ? linkedDesk.name : "";
      const portNum = String(index + 1).padStart(2, "0");
      const isVoip = outlet.outletRole === "VOIP";
      const isPrinter = outlet.outletRole === "PRINTER";
      const isWifi = outlet.outletRole === "WIFI";

      const vlanVid = isVoip ? 30 : isPrinter ? 40 : isWifi ? 50 : 20;
      const vlanName = isVoip
        ? "VLAN_VOIP"
        : isPrinter
        ? "VLAN_PRINT"
        : isWifi
        ? "VLAN_WIFI_INFRA"
        : "VLAN_CORP_DATA";

      const directDist = linkedDesk
        ? Math.round(
            Math.hypot(
              outlet.xMm - (primaryRack.xMm ?? 12000),
              outlet.yMm - (primaryRack.yMm ?? 14000)
            ) / 1000 + 4
          )
        : 25.0;

      return [
        outlet.name,
        "RJ45-1",
        deskNumber,
        "Étage 4 - Plateau",
        primaryRack.name,
        "PP-24P-CAT6A-U24",
        portNum,
        "CAT6A",
        directDist.toFixed(1),
        "SW-ACCESS-4A-U22",
        `Gi1/0/${index + 1}`,
        vlanVid,
        vlanName,
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `carnet_cablage_netfloor_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const scaleMetersText = `${(1000 * viewport.scale).toFixed(1)} px/m`;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* 1. Header Toolbar Multi-Métiers */}
      <header className="h-14 border-b border-slate-800 px-5 flex items-center justify-between bg-slate-950/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
              NetFloor Architect
              <span className="text-[10px] uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 font-mono">
                Multi-Métiers
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Plateau R+4 • RH & Espace • Maintenance & Câblage • DSI Réseau</p>
          </div>
        </div>

        {/* Filtres de Vue Métier (Layer Views) */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setActiveViewMode("ALL")}
            className={`px-3 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeViewMode === "ALL"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Vue Globale
          </button>
          <button
            onClick={() => setActiveViewMode("HR")}
            className={`px-3 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeViewMode === "HR"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-emerald-400"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            🏢 Vue RH & Espace
          </button>
          <button
            onClick={() => setActiveViewMode("TECH")}
            className={`px-3 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeViewMode === "TECH"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-blue-400"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            ⚡ Vue DSI & Câblage
          </button>
        </div>

        {/* Camera & Ingestion Controls */}
        <div className="flex items-center gap-2.5 text-xs font-mono">
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 flex items-center gap-2 text-slate-400">
            <span>Échelle : <span className="text-blue-400 font-semibold">{scaleMetersText}</span></span>
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => zoomIn()}
              title="Zoom Avant"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => zoomOut()}
              title="Zoom Arrière"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => fitFloor(floorData.widthMm, floorData.heightMm, window.innerWidth, window.innerHeight)}
              title="Cadrer l'Étage"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-sans font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition text-xs shadow-sm"
          >
            <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
            Importer CSV
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-sans font-medium rounded-lg shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition text-xs"
            title="Exporter l'inventaire complet en carnet de câblage CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter CSV
          </button>
        </div>
      </header>

      {/* 2. Workspace Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Palette d'Équipements Escamotable avec bouton Paramètres DSI en bas à gauche */}
        <EquipmentPalette
          isOpen={isPaletteOpen}
          onToggle={() => setIsPaletteOpen((prev) => !prev)}
          onAddItem={handleAddItemFromPalette}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          vlanStyles={vlanStyles}
        />

        {/* Main Canvas Area */}
        <div className={`flex-1 h-full relative transition-all duration-300 ${isPaletteOpen ? "ml-80" : "ml-12"}`}>
          {/* Barre de filtrage dynamique des câbles (DSI / Réseau / Maintenance) */}
          {activeViewMode !== "HR" && (
            <div className="absolute top-4 left-6 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-xl p-1.5 shadow-2xl z-10 flex items-center gap-1 text-[11px] font-mono">
              <span className="text-slate-400 px-2 flex items-center gap-1.5 text-[10px] font-semibold">
                <Network className="w-3.5 h-3.5 text-sky-400" />
                Filtre Câbles :
              </span>
              <button
                onClick={() => setCableFilterMode("ALL")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  cableFilterMode === "ALL"
                    ? "bg-blue-600 text-white font-bold shadow"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                Tous ({cables.length})
              </button>
              <button
                onClick={() => setCableFilterMode("HORIZONTAL_ONLY")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  cableFilterMode === "HORIZONTAL_ONLY"
                    ? "bg-blue-600 text-white font-bold shadow"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                Horizontal
              </button>
              <button
                onClick={() => setCableFilterMode("VLAN_20")}
                className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${
                  cableFilterMode === "VLAN_20"
                    ? "bg-blue-600 text-white font-bold shadow"
                    : "text-blue-400 hover:bg-slate-800"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: vlanStyles[20]?.color ?? "#3b82f6" }} />
                VLAN 20 (Data)
              </button>
              <button
                onClick={() => setCableFilterMode("VLAN_30")}
                className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${
                  cableFilterMode === "VLAN_30"
                    ? "bg-purple-600 text-white font-bold shadow"
                    : "text-purple-400 hover:bg-slate-800"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: vlanStyles[30]?.color ?? "#a855f7" }} />
                VLAN 30 (VoIP)
              </button>
              <button
                onClick={() => setCableFilterMode("VLAN_40")}
                className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${
                  cableFilterMode === "VLAN_40"
                    ? "bg-amber-600 text-white font-bold shadow"
                    : "text-amber-400 hover:bg-slate-800"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: vlanStyles[40]?.color ?? "#f59e0b" }} />
                VLAN 40 (Print)
              </button>
              <button
                onClick={() => setCableFilterMode("VLAN_50")}
                className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${
                  cableFilterMode === "VLAN_50"
                    ? "bg-indigo-600 text-white font-bold shadow"
                    : "text-indigo-400 hover:bg-slate-800"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: vlanStyles[50]?.color ?? "#6366f1" }} />
                VLAN 50 (Wi-Fi)
              </button>
              <button
                onClick={() => setCableFilterMode("SELECTED_ONLY")}
                className={`px-2 py-1 rounded-lg transition ${
                  cableFilterMode === "SELECTED_ONLY"
                    ? "bg-sky-500 text-slate-950 font-bold shadow"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                Sélectionné
              </button>

              {/* Bouton direct de personnalisation des styles & tracés de câbles par VLAN */}
              <button
                onClick={() => setIsVlanStyleModalOpen(true)}
                className="px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-800/70 shadow-sm ml-1 hover:border-sky-500/50"
                title="Personnaliser les couleurs, pointillés et épaisseurs des câbles par VLAN"
              >
                <Palette className="w-3.5 h-3.5 text-sky-400" />
                Styles & Tracés
              </button>
            </div>
          )}

          <DynamicFloorCanvas
            floorWidthMm={floorData.widthMm}
            floorHeightMm={floorData.heightMm}
            racks={racks}
            nodes={nodes}
            cables={cables}
            selectedNodeId={selectedNodeId}
            activeViewMode={activeViewMode}
            cableFilterMode={cableFilterMode}
            vlanStyles={vlanStyles}
            onSelectOutlet={handleSelectOutlet}
            onSelectNode={handleSelectNode}
            onNodePositionChange={handleNodeMoveEnd}
            onNodeDragMove={handleThrottledNodeDragMove}
            onRackDragMove={handleThrottledRackDragMove}
            onWaypointChange={handleThrottledWaypointChange}
            onAddWaypoint={handleAddWaypoint}
            onRemoveWaypoint={handleRemoveWaypoint}
          />

          {/* Quick tips badge */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 backdrop-blur rounded-lg p-2.5 text-[11px] text-slate-400 shadow-xl font-mono flex items-center gap-2 pointer-events-none z-10">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span>
              <strong>Fidélité 2D Réelle :</strong> Bureaux avec fauteuils et écrans • Colonnettes RJ45 stackées jusqu&apos;à 8 ports • Tracés orthogonaux 90° et couloirs de câblage ajustables.
            </span>
          </div>
        </div>

        {/* Right Inspector Sidebar */}
        <div className="w-96 border-l border-slate-800 bg-slate-950/90 backdrop-blur-md p-4 flex flex-col shadow-2xl z-10 overflow-hidden">
          <CircuitInspector
            traceResult={traceResult}
            isLoading={isTracing}
            selectedNode={selectedNode}
            allNodes={nodes}
            desks={desks}
            onToggleAttachment={handleToggleAttachment}
            onAlignWithDesk={handleAlignWithDesk}
            onTriggerTrace={handleSelectOutlet}
            onSelectNode={handleSelectNode}
            onChangeRole={handleChangeRole}
            onAddOutletToDesk={handleAddOutletToDesk}
            onAddColonnetteToDesk={handleAddColonnetteToDesk}
            onUpdateNodeProperties={handleUpdateNodeProperties}
            onAddWaypoint={handleAddWaypoint}
            onRemoveWaypoint={handleRemoveWaypoint}
            vlanStyles={vlanStyles}
            onUpdateVlanStyle={handleUpdateVlanStyle}
            onResetVlanStyles={handleResetVlanStyles}
          />
        </div>
      </div>

      {/* 3. CSV Ingestion Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          // Callback après import réussi
        }}
      />

      {/* 4. Centre d'Administration & Paramètres DSI Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        nodes={nodes}
        onUpdateNodeProperties={handleUpdateNodeProperties}
        onImportDiscoveredDevice={handleImportDiscoveredDevice}
        vlanStyles={vlanStyles}
        onUpdateVlanStyle={handleUpdateVlanStyle}
        onResetVlanStyles={handleResetVlanStyles}
      />

      {/* 5. Modal Dédié Personnalisation Styles & Tracés des Câbles par VLAN */}
      {isVlanStyleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl w-[480px] max-w-[95vw] h-[520px] max-h-[90vh] p-4 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100">Personnalisation des Tracés par VLAN</h3>
                  <p className="text-[10px] text-slate-400">Couleurs, motifs (plein, pointillés, tirets) et épaisseurs</p>
                </div>
              </div>
              <button
                onClick={() => setIsVlanStyleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 my-2">
              <VlanStyleCustomizer
                vlanStyles={vlanStyles}
                onUpdateVlanStyle={handleUpdateVlanStyle}
                onResetVlanStyles={handleResetVlanStyles}
              />
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800 flex-shrink-0">
              <button
                onClick={() => setIsVlanStyleModalOpen(false)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition"
              >
                Appliquer & Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
