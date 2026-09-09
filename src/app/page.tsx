"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useCameraStore } from "@/engine/spatial/useCameraStore";
import { CircuitInspector } from "@/components/ui/CircuitInspector";
import { EquipmentPalette, PaletteItem } from "@/components/ui/EquipmentPalette";
import { CsvImportModal } from "@/components/ui/CsvImportModal";
import { CircuitTraceResult } from "@/db/queries/trace-link";
import { NodeDisplay, RackDisplay, OutletRole } from "@/components/canvas/EquipmentLayer";
import { CableData } from "@/components/canvas/CableLayer";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  UploadCloud,
  Network,
  Activity,
  Users,
  Wrench,
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

  // Filtre de vue métier (RH, Câbleur / Maintenance, Informatique / DSI)
  const [activeViewMode, setActiveViewMode] = useState<"ALL" | "HR" | "MAINTENANCE" | "NETWORK">("ALL");

  // Étage
  const [floorData] = useState({
    widthMm: 60000,
    heightMm: 35000,
  });

  // Baies Informatiques
  const [racks, setRacks] = useState<RackDisplay[]>([
    {
      id: "rack-01",
      name: "BAIE-LT4A-01",
      uHeight: 42,
      xMm: 8500,
      yMm: 6500,
      widthMm: 600,
      depthMm: 800,
    },
  ]);

  // Nœuds d'équipements : Mobilier RH, Prises/Nourrices Maintenance, et Infra DSI
  const [nodes, setNodes] = useState<NodeDisplay[]>([
    {
      id: "desk-408",
      type: "DESK",
      name: "Poste 408 (Tech Lead)",
      xMm: 42000,
      yMm: 17500,
      widthMm: 1600,
      heightMm: 800,
      subType: "DESK_SOLO",
      assignedPerson: "Alexandre Martin (Tech Lead)",
      department: "Tech Lab",
      chairPosition: "BOTTOM",
    },
    {
      id: "desk-409",
      type: "DESK",
      name: "Poste 409 (RH Recrutement)",
      xMm: 42000,
      yMm: 21500,
      widthMm: 1600,
      heightMm: 800,
      subType: "DESK_SOLO",
      assignedPerson: "Sarah Benali (RH & Recrutement)",
      department: "RH",
      chairPosition: "BOTTOM",
    },
    {
      id: "outlet-408-a",
      type: "WALL_OUTLET",
      name: "PRISE-DESK-408-A",
      xMm: 43600,
      yMm: 17700,
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      attachedToDeskId: "desk-408",
      outletRole: "DATA",
    },
    {
      id: "outlet-408-b",
      type: "WALL_OUTLET",
      name: "PRISE-DESK-408-B",
      xMm: 43600,
      yMm: 18150,
      portId: "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d",
      attachedToDeskId: "desk-408",
      outletRole: "VOIP",
    },
    {
      id: "floorbox-01",
      type: "WALL_OUTLET",
      name: "BOITE-SOL-CENTRE-01",
      xMm: 35000,
      yMm: 20000,
      widthMm: 300,
      heightMm: 300,
      subType: "FLOOR_BOX",
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      outletRole: "DATA",
    },
    {
      id: "wifi-01",
      type: "WALL_OUTLET",
      name: "AP-WIFI-OPENSPACE-04",
      xMm: 32000,
      yMm: 13000,
      widthMm: 350,
      heightMm: 350,
      subType: "WIFI_AP",
      outletRole: "WIFI",
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
    },
    {
      id: "printer-01",
      type: "WALL_OUTLET",
      name: "COPIEUR-RH-ETAGE-4",
      xMm: 25000,
      yMm: 22000,
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
    const rack = racks.find((r) => r.id === "rack-01") ?? racks[0];
    if (!rack) return [];

    const list: CableData[] = [];

    // Câbles horizontaux pour chaque prise murale présente sur le plateau
    const wallOutlets = nodes.filter((n) => n.type === "WALL_OUTLET");
    wallOutlets.forEach((outlet, index) => {
      const isVoip = outlet.outletRole === "VOIP";
      const isPrinter = outlet.outletRole === "PRINTER";
      const isWifi = outlet.outletRole === "WIFI";

      // Opacité atténuée si en vue RH pour ne pas surcharger la vue spatiale
      const baseAlpha = activeViewMode === "HR" ? "0.2" : "0.75";

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

  // Déplacement d'un nœud (bureau ou prise)
  const handleNodeUpdate = (id: string, newPos: { x: number; y: number }) => {
    setNodes((prev) => {
      const current = prev.find((n) => n.id === id);
      if (!current) return prev;

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
  };

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

      const newOutlet: NodeDisplay = {
        id: newOutletId,
        type: "WALL_OUTLET",
        name: `PRISE-${desk.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}-${suffixLetter}`,
        xMm: desk.xMm + deskW,
        yMm: desk.yMm + yOffset,
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

      return prev.map((n) => {
        if (n.id === outletId) {
          return {
            ...n,
            xMm: desk.xMm + deskW + 200,
            yMm: desk.yMm + deskH / 2,
            attachedToDeskId: deskId,
          };
        }
        return n;
      });
    });
  };

  // Option : Mise à jour libre des propriétés (RH, Dimensions réelles ou fausses mesures)
  const handleUpdateNodeProperties = (nodeId: string, updates: Partial<NodeDisplay>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n))
    );
  };

  // Ajout depuis la Palette d'équipements multi-métiers
  const handleAddItemFromPalette = (item: PaletteItem) => {
    const offset = nodes.length % 6;
    const newX = 32000 + offset * 1800;
    const newY = 16000 + Math.floor(nodes.length / 6) * 1600;
    const newId = `node-${item.category.toLowerCase()}-${Date.now()}`;

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

  // Déplacement d'une baie informatique
  const handleRackUpdate = (id: string, newPos: { x: number; y: number }) => {
    setRacks((prev) =>
      prev.map((r) => (r.id === id ? { ...r, xMm: newPos.x, yMm: newPos.y } : r))
    );
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
            onClick={() => setActiveViewMode("MAINTENANCE")}
            className={`px-3 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeViewMode === "MAINTENANCE"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-blue-400"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            🔌 Vue Câbleur & Terrain
          </button>
          <button
            onClick={() => setActiveViewMode("NETWORK")}
            className={`px-3 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeViewMode === "NETWORK"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-purple-400"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            ⚡ Vue DSI & VLAN
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
            onNodePositionChange={handleNodeUpdate}
            onNodeDragMove={handleNodeUpdate}
            onRackDragMove={handleRackUpdate}
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
