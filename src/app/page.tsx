"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useCameraStore } from "@/engine/spatial/useCameraStore";
import { CircuitInspector } from "@/components/ui/CircuitInspector";
import { EquipmentPalette, PaletteItem } from "@/components/ui/EquipmentPalette";
import { CsvImportModal } from "@/components/ui/CsvImportModal";
import { CircuitTraceResult } from "@/db/queries/trace-link";
import { NodeDisplay, RackDisplay, OutletRole, getDefaultSeatLabels } from "@/components/canvas/EquipmentLayer";
import { CableData } from "@/components/canvas/CableLayer";
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
} from "lucide-react";

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
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);

  // Vue Métier active
  const [activeViewMode, setActiveViewMode] = useState<
    "ALL" | "HR" | "TECH" | "MAINTENANCE" | "NETWORK"
  >("ALL");

  // Étage
  const [floorData] = useState({
    widthMm: 60000,
    heightMm: 35000,
  });

  // Baies informatiques
  const [racks, setRacks] = useState<RackDisplay[]>([
    {
      id: "rack-01",
      name: "BAIE-PRINCIPALE-RDC",
      xMm: 8000,
      yMm: 18000,
      widthMm: 600,
      depthMm: 800,
      uHeight: 42,
    },
  ]);

  // Nœuds du plateau (Bureaux multi-places RH, Prises Réseau, Boîtes de Sol, Wi-Fi)
  const [nodes, setNodes] = useState<NodeDisplay[]>([
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
      name: "PRISE-DESK-408-A",
      xMm: 38800,
      yMm: 15200,
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      attachedToDeskId: "desk-408",
      outletRole: "DATA",
    },
    {
      id: "outlet-408-b",
      type: "WALL_OUTLET",
      name: "PRISE-DESK-408-B",
      xMm: 38800,
      yMm: 15650,
      portId: "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d",
      attachedToDeskId: "desk-408",
      outletRole: "VOIP",
    },
    // 5. Prises réseau pour l'îlot 402
    {
      id: "outlet-402-a",
      type: "WALL_OUTLET",
      name: "PRISE-BENCH-402-A",
      xMm: 26400,
      yMm: 15200,
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      attachedToDeskId: "bench-402",
      outletRole: "DATA",
    },
    {
      id: "outlet-402-b",
      type: "WALL_OUTLET",
      name: "PRISE-BENCH-402-B",
      xMm: 26400,
      yMm: 15650,
      portId: "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d",
      attachedToDeskId: "bench-402",
      outletRole: "VOIP",
    },
    // 6. Boîte de Sol Centrale
    {
      id: "floorbox-01",
      type: "WALL_OUTLET",
      name: "BOITE-SOL-CENTRE-01",
      xMm: 33000,
      yMm: 20000,
      widthMm: 300,
      heightMm: 300,
      subType: "FLOOR_BOX",
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      outletRole: "DATA",
    },
    // 7. Borne Wi-Fi Plafond
    {
      id: "wifi-01",
      type: "WALL_OUTLET",
      name: "AP-WIFI-OPENSPACE-04",
      xMm: 28000,
      yMm: 11000,
      widthMm: 350,
      heightMm: 350,
      subType: "WIFI_AP",
      outletRole: "WIFI",
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
    },
    // 8. Copieur Multifonction Départemental
    {
      id: "printer-01",
      type: "WALL_OUTLET",
      name: "COPIEUR-RH-ETAGE-4",
      xMm: 22000,
      yMm: 21000,
      widthMm: 800,
      heightMm: 700,
      subType: "PRINTER_STATION",
      outletRole: "PRINTER",
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
    },
  ]);

  // Bureaux disponibles pour la liaison
  const desks = useMemo(() => nodes.filter((n) => n.type === "DESK"), [nodes]);

  // Nœud actuellement sélectionné (synchronisé en direct)
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

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

      const baseAlpha = "0.75";

      const cableColor = isVoip
        ? `rgba(168, 85, 247, ${baseAlpha})`
        : isPrinter
        ? `rgba(245, 158, 11, ${baseAlpha})`
        : isWifi
        ? `rgba(99, 102, 241, ${baseAlpha})`
        : `rgba(59, 130, 246, ${baseAlpha})`;

      list.push({
        id: `cable-run-${outlet.id}`,
        cableType: "HORIZONTAL_RUN",
        category: "CAT6A",
        lengthMm: 44200 + index * 400,
        colorCode: cableColor,
        sourcePos: { x: outlet.xMm, y: outlet.yMm },
        targetPos: { x: rack.xMm + 400, y: rack.yMm + 240 + index * 35 },
      });
    });

    // Cordons de brassage internes en baie (Data & VoIP)
    list.push({
      id: "cable-p1",
      cableType: "PATCH_CORD",
      category: "CAT6A",
      lengthMm: 1500,
      sourcePos: { x: rack.xMm + 100, y: rack.yMm + 260 },
      targetPos: { x: rack.xMm + 100, y: rack.yMm + 420 },
    });

    list.push({
      id: "cable-p2",
      cableType: "PATCH_CORD",
      category: "CAT6A",
      lengthMm: 1500,
      sourcePos: { x: rack.xMm + 100, y: rack.yMm + 290 },
      targetPos: { x: rack.xMm + 100, y: rack.yMm + 450 },
    });

    return list;
  }, [nodes, racks, activeViewMode]);

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

  // Fin du déplacement d'un nœud (commit immédiat avec magnétisme)
  const handleNodeMoveEnd = useCallback((id: string, newPos: { x: number; y: number }) => {
    if (rafNodeDragRef.current) {
      cancelAnimationFrame(rafNodeDragRef.current);
      rafNodeDragRef.current = null;
    }
    pendingNodeDragRef.current = null;
    handleNodeUpdate(id, newPos);
  }, [handleNodeUpdate]);

  // Déplacement d'une baie informatique
  const handleRackUpdate = useCallback((id: string, newPos: { x: number; y: number }) => {
    setRacks((prev) => {
      const current = prev.find((r) => r.id === id);
      if (!current || (current.xMm === newPos.x && current.yMm === newPos.y)) return prev;
      return prev.map((r) => (r.id === id ? { ...r, xMm: newPos.x, yMm: newPos.y } : r));
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

  // Nettoyage des timers RAF au démontage
  useEffect(() => {
    return () => {
      if (rafNodeDragRef.current) cancelAnimationFrame(rafNodeDragRef.current);
      if (rafRackDragRef.current) cancelAnimationFrame(rafRackDragRef.current);
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

      const newOutlet: NodeDisplay = {
        id: newOutletId,
        type: "WALL_OUTLET",
        name: `PRISE-${desk.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}-${suffixLetter}`,
        xMm: Math.round(worldX),
        yMm: Math.round(worldY),
        portId: newPortId,
        attachedToDeskId: deskId,
        outletRole: role,
      };

      return [...prev, newOutlet];
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

  // Ajout depuis la Palette d'équipements multi-métiers
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

    const newNode: NodeDisplay = {
      id: newId,
      type: item.targetType,
      name: `${item.name} #${nodes.length + 1}`,
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
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-sans font-medium rounded-lg shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition text-xs"
          >
            <UploadCloud className="w-4 h-4" />
            Importer Carnet (CSV)
          </button>
        </div>
      </header>

      {/* 2. Workspace Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Palette d'Équipements Escamotable */}
        <EquipmentPalette
          isOpen={isPaletteOpen}
          onToggle={() => setIsPaletteOpen((prev) => !prev)}
          onAddItem={handleAddItemFromPalette}
        />

        {/* Main Canvas Area */}
        <div className={`flex-1 h-full relative transition-all duration-300 ${isPaletteOpen ? "ml-80" : "ml-12"}`}>
          <DynamicFloorCanvas
            floorWidthMm={floorData.widthMm}
            floorHeightMm={floorData.heightMm}
            racks={racks}
            nodes={nodes}
            cables={cables}
            selectedNodeId={selectedNodeId}
            activeViewMode={activeViewMode}
            onSelectOutlet={handleSelectOutlet}
            onSelectNode={handleSelectNode}
            onNodePositionChange={handleNodeMoveEnd}
            onNodeDragMove={handleThrottledNodeDragMove}
            onRackDragMove={handleThrottledRackDragMove}
          />

          {/* Quick tips badge */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 backdrop-blur rounded-lg p-2.5 text-[11px] text-slate-400 shadow-xl font-mono flex items-center gap-2 pointer-events-none z-10">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span>
              <strong>Fidélité 2D Réelle :</strong> Bureaux avec fauteuils et écrans • Boîtes de sol encastrées inox • Dimensions éditables au mm près dans l&apos;inspecteur.
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
            onUpdateNodeProperties={handleUpdateNodeProperties}
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
    </div>
  );
}
