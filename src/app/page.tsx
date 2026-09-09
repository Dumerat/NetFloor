"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useCameraStore } from "@/engine/spatial/useCameraStore";
import { CircuitInspector } from "@/components/ui/CircuitInspector";
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
  Link2,
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

  // Nœuds d'équipements : mobilier et prises murales (solidaires multi-prises ou fixes)
  const [nodes, setNodes] = useState<NodeDisplay[]>([
    {
      id: "desk-408",
      type: "DESK",
      name: "Poste 408 (Tech Lead)",
      xMm: 42000,
      yMm: 18000,
    },
    {
      id: "outlet-408-a",
      type: "WALL_OUTLET",
      name: "PRISE-DESK-408-A",
      xMm: 43600,
      yMm: 18200,
      portId: "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c",
      attachedToDeskId: "desk-408", // Solidaire du poste 408 (Prise 1 : PC Data)
      outletRole: "DATA",
    },
    {
      id: "outlet-408-b",
      type: "WALL_OUTLET",
      name: "PRISE-DESK-408-B",
      xMm: 43600,
      yMm: 18650, // 450mm en dessous : plastron double VoIP !
      portId: "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d",
      attachedToDeskId: "desk-408", // Également solidaire du poste 408 (Prise 2 : IP Phone)
      outletRole: "VOIP",
    },
    {
      id: "outlet-fixe-01",
      type: "WALL_OUTLET",
      name: "PRISE-MURALE-FIXE-02",
      xMm: 48000,
      yMm: 14000,
      portId: "3cc9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9e",
      attachedToDeskId: undefined, // Fixe / Indépendante par défaut !
      outletRole: "DATA",
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
      const cableColor = isVoip
        ? "rgba(168, 85, 247, 0.75)"
        : isPrinter
        ? "rgba(245, 158, 11, 0.75)"
        : "rgba(59, 130, 246, 0.75)";

      list.push({
        id: `cable-run-${outlet.id}`,
        cableType: "HORIZONTAL_RUN",
        category: "CAT6A",
        lengthMm: 44200 + index * 400,
        colorCode: cableColor,
        sourcePos: { x: outlet.xMm, y: outlet.yMm },
        targetPos: { x: rack.xMm + 400, y: rack.yMm + 240 + index * 40 },
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
  }, [nodes, racks]);

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

      // Si on déplace un bureau : on déplace solidairement TOUTES les prises rattachées (PC, VoIP...) avec leur écart respectif !
      if (current.type === "DESK") {
        const deltaX = newPos.x - current.xMm;
        const deltaY = newPos.y - current.yMm;

        return prev.map((n) => {
          if (n.id === id) {
            return { ...n, xMm: newPos.x, yMm: newPos.y };
          }
          if (n.attachedToDeskId === id) {
            // Conserve l'écartement personnalisé de chaque prise du poste
            return { ...n, xMm: n.xMm + deltaX, yMm: n.yMm + deltaY };
          }
          return n;
        });
      }

      // Déplacement direct d'une prise :
      // Le bureau et les autres prises ne bougent pas !
      // Son écart personnalisé est mémorisé pour les futurs déplacements du bureau.
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

  // Option : Ajouter une nouvelle prise à un bureau existant (ex: Prise IP Phone supplémentaire)
  const handleAddOutletToDesk = (deskId: string, role: OutletRole) => {
    setNodes((prev) => {
      const desk = prev.find((d) => d.id === deskId);
      if (!desk) return prev;

      const existingDeskOutlets = prev.filter((n) => n.attachedToDeskId === deskId);
      const suffixLetter = String.fromCharCode(65 + existingDeskOutlets.length);
      const isVoip = role === "VOIP";
      const newOutletId = `outlet-${deskId}-${role.toLowerCase()}-${Date.now()}`;
      const newPortId = isVoip
        ? "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d"
        : "1aa9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9c";

      // Positionnement à droite du bureau avec espacement pour chaque prise
      const yOffset = 200 + existingDeskOutlets.length * 450;

      const newOutlet: NodeDisplay = {
        id: newOutletId,
        type: "WALL_OUTLET",
        name: `PRISE-${desk.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}-${suffixLetter}`,
        xMm: desk.xMm + 1600,
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

      return prev.map((n) => {
        if (n.id === outletId) {
          return {
            ...n,
            xMm: desk.xMm + 1600 + 200,
            yMm: desk.yMm + 400,
            attachedToDeskId: deskId,
          };
        }
        return n;
      });
    });
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
      {/* 1. Header Toolbar */}
      <header className="h-14 border-b border-slate-800 px-5 flex items-center justify-between bg-slate-950/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
              NetFloor Architect
              <span className="text-[10px] uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 font-mono">
                SaaS B2B
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Plateau R+4 • Multi-prises par poste (PC Data & IP Phone VoIP)</p>
          </div>
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
        {/* Main Canvas Area */}
        <div className="flex-1 h-full relative">
          <DynamicFloorCanvas
            floorWidthMm={floorData.widthMm}
            floorHeightMm={floorData.heightMm}
            racks={racks}
            nodes={nodes}
            cables={cables}
            selectedNodeId={selectedNodeId}
            onSelectOutlet={handleSelectOutlet}
            onSelectNode={handleSelectNode}
            onNodePositionChange={handleNodeUpdate}
            onNodeDragMove={handleNodeUpdate}
            onRackDragMove={handleRackUpdate}
          />

          {/* Quick tips badge */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 backdrop-blur rounded-lg p-2.5 text-[11px] text-slate-400 shadow-xl font-mono flex items-center gap-2 pointer-events-none">
            <Link2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span>
              <strong>Multi-prises par poste :</strong> Poste 408 dispose d&apos;une prise 💻 Data (VLAN 20) et d&apos;une prise ☎️ VoIP (VLAN 30). Déplacer le bureau emporte les deux en conservant leurs écarts.
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
