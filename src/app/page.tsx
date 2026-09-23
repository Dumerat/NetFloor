"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useCameraStore } from "@/engine/spatial/useCameraStore";
import { CircuitInspector } from "@/components/ui/CircuitInspector";
import {
  EquipmentPalette,
  PaletteItem,
  ScannedDeviceItem,
  isDeviceMatch,
} from "@/components/ui/EquipmentPalette";
import { CsvImportModal } from "@/components/ui/CsvImportModal";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { NetworkTopologyPanel } from "@/components/ui/NetworkTopologyPanel";
import { InventoryPanel } from "@/components/ui/InventoryPanel";
import { DeviceTelemetry } from "@/data/settingsStore";
import { CircuitTraceResult } from "@/db/queries/trace-link";
import {
  NodeDisplay,
  RackDisplay,
  RackDeviceItem,
  RackDeviceBrand,
  OutletRole,
  StackedPortItem,
  getDefaultSeatLabels,
} from "@/components/canvas/EquipmentLayer";
import { CableData, CableFilterMode } from "@/components/canvas/CableLayer";
import { FloorDimensionsModal } from "@/components/ui/FloorDimensionsModal";
import { FloorZone } from "@/types/zones";
import { BatchDeskSpawnerModal } from "@/components/ui/BatchDeskSpawnerModal";
import { BatchSpawnResult } from "@/engine/spatial/batchSpawner";
import { UnpositionedElementsDrawer } from "@/components/ui/UnpositionedElementsDrawer";
import { PlanManagerModal } from "@/components/ui/PlanManagerModal";
import { SitesPanel } from "@/components/ui/SitesPanel";
import {
  saveBackgroundPlan,
  loadBackgroundPlan,
  deleteBackgroundPlan,
  loadAllBackgroundPlans,
  StoredBackgroundPlan,
  FloorSite,
  loadAllSites,
  saveSite,
  deleteSite,
  clearAllSites,
  DEFAULT_SITE_ID,
  DEFAULT_SITE,
} from "@/engine/storage/planStorage";
import { autoRoutePortsToRack } from "@/engine/spatial/autoRoute";
import { ApplyMatrixResult } from "@/engine/ingestion/matrixCsvParser";
import { snapToGrid } from "@/engine/spatial/snapping";
import { getRackAABB } from "@/components/canvas/FloorCanvas";
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
  Trash2,
  Unlink,
  Search,
  AlertCircle,
  Ruler,
  Image as ImageIcon,
  Building2,
} from "lucide-react";
import { screenToWorld } from "@/engine/spatial/matrix";
import {
  VlanStyle,
  DEFAULT_VLAN_STYLES,
  loadStoredVlanStyles,
  saveStoredVlanStyles,
} from "@/data/vlanStyles";
import { VlanStyleCustomizer } from "@/components/ui/VlanStyleCustomizer";
import { unlinkAdAccountsFromNodes, clearEnterpriseDirectory } from "@/data/directory";
import {
  autoDeployDiscoveredTopology,
  DiscoveredDeviceInput,
  DiscoveredConnectionInput,
} from "@/engine/discovery/auto-placement";

// Chargement dynamique du canvas Konva sans SSR
const DynamicFloorCanvas = dynamic(() => import("@/components/canvas/FloorCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-500 font-mono text-xs">
      <Activity className="w-5 h-5 animate-spin mr-2 text-blue-500" />
      Initialisation du moteur spatial React-Konva...
    </div>
  ),
});

function CameraScaleIndicator() {
  const scale = useCameraStore((s) => s.viewport.scale);
  const ppm = 1000 * scale;
  return (
    <span className="text-blue-400 font-semibold font-mono">
      {ppm >= 1 ? `${ppm.toFixed(1)} px/m` : `${ppm.toFixed(2)} px/m`}
    </span>
  );
}

/**
 * Calcule les coudes naturels orthogonaux (90°) pour relier une prise à une baie,
 * garantissant que CHAQUE angle visible sur le plan correspond à un coude modifiable sans coude orphelin.
 */

/**
 * Génère des équipements dédiés et indépendants pour chaque baie créée sur le plan.
 * Évite le partage erroné de modules ou d'identifiants entre baies informatiques.
 */
export function createDefaultRackDevices(rackId: string, rackName: string): RackDeviceItem[] {
  const shortNum = rackId.replace(/[^0-9]/g, "").slice(-2) || "02";
  const numInt = parseInt(shortNum, 10) || 2;
  return [
    {
      id: `dev-${rackId}-sw-01`,
      name: `SW-${rackName}-01`,
      slotU: 24,
      uSize: 1,
      deviceType: "SWITCH",
      brand: "ARUBA",
      model: "Aruba CX 6200F 24G 4SFP+ 370W",
      ipAddress: `10.42.0.${20 + numInt}`,
      macAddress: `B4:0C:25:88:${shortNum.padStart(2, "0")}:01`,
      status: "ONLINE",
      portsCount: 24,
      cloudManagedBy: "ARUBA_CENTRAL",
    },
    {
      id: `dev-${rackId}-pp-01`,
      name: `PP-${rackName}-CAT6A`,
      slotU: 23,
      uSize: 1,
      deviceType: "PATCH_PANEL",
      brand: "GENERIC",
      model: "LCS3 Panneau droit 24 ports RJ45 Cat6A STP",
      portsCount: 24,
      status: "ONLINE",
    },
    {
      id: `dev-${rackId}-pdu-01`,
      name: `PDU-${rackName}-A`,
      slotU: 1,
      uSize: 1,
      deviceType: "PDU",
      brand: "GENERIC",
      model: "Basic Rack PDU 16A 230V",
      status: "ONLINE",
    },
  ];
}

export function getNaturalCableWaypoints(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
  _index: number
): { x: number; y: number }[] {
  // Cheminement naturel par défaut : le câble monte verticalement depuis la prise
  // puis part horizontalement direct vers la baie informatique (1 seul angle droit net)
  return [{ x: sourcePos.x, y: targetPos.y }];
}

export default function NetFloorApp() {
  const zoomIn = useCameraStore((s) => s.zoomIn);
  const zoomOut = useCameraStore((s) => s.zoomOut);
  const fitFloor = useCameraStore((s) => s.fitFloor);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedRackDeviceId, setSelectedRackDeviceId] = useState<string | null>(null);
  const [isRulerActive, setIsRulerActive] = useState<boolean>(false);
  const [isPlanManagerOpen, setIsPlanManagerOpen] = useState<boolean>(false);
  const [allBackgroundPlans, setAllBackgroundPlans] = useState<StoredBackgroundPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [sites, setSites] = useState<FloorSite[]>([DEFAULT_SITE]);
  const [activeSiteId, setActiveSiteId] = useState<string>(DEFAULT_SITE_ID);
  const [isSitesOpen, setIsSitesOpen] = useState<boolean>(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState<boolean>(false);
  const [traceResult, setTraceResult] = useState<CircuitTraceResult | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDimensionsModalOpen, setIsDimensionsModalOpen] = useState(false);
  // Étage & Dimensions configurables
  const [floorData, setFloorData] = useState({
    widthMm: 60000,
    heightMm: 35000,
  });
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isTopologyOpen, setIsTopologyOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(400);
  const [inspectorWidth, setInspectorWidth] = useState(384);
  const isResizingLeftRef = useRef(false);
  const isResizingRightRef = useRef(false);
  const savePlanTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Gestionnaire global du glisser-redimensionner (Drag-to-Resize) avec bornes min/max
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeftRef.current) {
        const minW = 320;
        const maxW = Math.min(Math.round(window.innerWidth * 0.45), 620);
        const newW = Math.min(Math.max(e.clientX, minW), maxW);
        setLeftPanelWidth(newW);
      } else if (isResizingRightRef.current) {
        const minW = 320;
        const maxW = Math.min(Math.round(window.innerWidth * 0.5), 680);
        const newW = Math.min(Math.max(window.innerWidth - e.clientX, minW), maxW);
        setInspectorWidth(newW);
      }
    };

    const handleMouseUp = () => {
      if (isResizingLeftRef.current || isResizingRightRef.current) {
        isResizingLeftRef.current = false;
        isResizingRightRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleStartLeftResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingLeftRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleStartRightResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRightRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  // Mode d'affichage des libellés (false = au survol par défaut, true = tous affichés en permanence)
  const [showAllLabels, _setShowAllLabels] = useState(false);

  // Vue Métier active
  const [activeViewMode, setActiveViewMode] = useState<
    "ALL" | "HR" | "TECH" | "MAINTENANCE" | "NETWORK"
  >("ALL");

  // Filtre actif des câbles (DSI / Réseau)
  const [cableFilterMode, setCableFilterMode] = useState<CableFilterMode>("ALL");

  // Styles visuels des câbles par VLAN (couleur, motif plein/pointillé, épaisseur)
  const [vlanStyles, setVlanStyles] = useState<Record<number, VlanStyle>>(DEFAULT_VLAN_STYLES);
  const [isVlanStyleModalOpen, setIsVlanStyleModalOpen] = useState(false);

  // Menu contextuel au clic droit sur un équipement
  const [contextMenu, setContextMenu] = useState<{
    node: NodeDisplay;
    x: number;
    y: number;
  } | null>(null);

  // Confirmation de transfert de rattachement d'une prise déjà liée vers un autre meuble
  const [pendingAttachmentTransfer, setPendingAttachmentTransfer] = useState<{
    outletId: string;
    currentDeskId: string;
    targetDeskId: string;
    newPos: { x: number; y: number };
    seatIdx?: number | undefined;
  } | null>(null);

  // Fermer le menu contextuel lors d'un clic ailleurs
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Chargement des styles VLAN stockés au montage
  useEffect(() => {
    setVlanStyles(loadStoredVlanStyles());
  }, []);

  // Mise à jour d'un style de VLAN avec persistance
  const handleUpdateVlanStyle = useCallback((vlanId: number, updates: Partial<VlanStyle>) => {
    setVlanStyles((prev) => {
      const existing = prev[vlanId] ??
        DEFAULT_VLAN_STYLES[vlanId] ?? {
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

  // Pivots orthogonaux uniques personnalisés déplacés par l'utilisateur à la souris
  const [customPivots, setCustomPivots] = useState<Record<string, { x: number; y: number }>>({});

  // État du Fond de Plan Architectural (Image/PDF)
  const [backgroundPlan, setBackgroundPlan] = useState<{
    imageUrl: string | null;
    name: string;
    opacity: number;
    isLocked: boolean;
    xMm: number;
    yMm: number;
    scale: number;
    widthMm?: number | undefined;
    heightMm?: number | undefined;
    visible: boolean;
  }>({
    imageUrl: null,
    name: "",
    opacity: 0.6,
    isLocked: false,
    xMm: 0,
    yMm: 0,
    scale: 1.0,
    visible: true,
  });

  // État de la modale Batch Spawner
  const [isBatchSpawnerOpen, setIsBatchSpawnerOpen] = useState(false);

  // Éléments Non Positionnés (importés depuis CSV mais pas encore sur le canevas)
  const [unpositionedNodes, setUnpositionedNodes] = useState<NodeDisplay[]>([]);

  // Chargement du fond de plan et des sites stockés dans IndexedDB au montage
  useEffect(() => {
    loadAllSites().then((loadedSites) => {
      if (loadedSites.length > 0) {
        setSites(loadedSites);
        if (!loadedSites.some((s) => s.id === activeSiteId)) {
          setActiveSiteId(loadedSites[0]?.id ?? DEFAULT_SITE_ID);
        }
      }
    });

    loadAllBackgroundPlans().then((plans) => {
      setAllBackgroundPlans(plans);
    });
    loadBackgroundPlan(DEFAULT_SITE_ID).then((plan) => {
      if (plan && plan.imageData) {
        setBackgroundPlan({
          imageUrl: plan.imageData,
          name: plan.name,
          opacity: plan.opacity,
          isLocked: plan.isLocked,
          xMm: plan.xMm,
          yMm: plan.yMm,
          scale: plan.scale,
          widthMm: plan.widthMm,
          heightMm: plan.heightMm,
          visible: plan.visible,
        });
      }
    });
  }, [activeSiteId]);

  const handleUpdateBackgroundPlan = useCallback((updates: Partial<typeof backgroundPlan>) => {
    setBackgroundPlan((prev) => {
      const updated = { ...prev, ...updates };
      if (updated.imageUrl) {
        saveBackgroundPlan({
          name: updated.name,
          imageData: updated.imageUrl,
          opacity: updated.opacity,
          isLocked: updated.isLocked,
          xMm: updated.xMm,
          yMm: updated.yMm,
          scale: updated.scale,
          widthMm: updated.widthMm,
          heightMm: updated.heightMm,
          visible: updated.visible,
        });
      }
      return updated;
    });
    loadAllBackgroundPlans().then(setAllBackgroundPlans);
  }, []);

  const handleCalibrateScale = useCallback(
    (result: {
      pixelsPerMeter: number;
      realMeters: number;
      distPx: number;
      distWorldMm: number;
    }) => {
      setBackgroundPlan((prev) => {
        if (prev.imageUrl && result.distWorldMm > 0) {
          const targetWorldMm = result.realMeters * 1000;
          const ratio = targetWorldMm / result.distWorldMm;
          const newScale = (prev.scale || 1.0) * ratio;
          saveBackgroundPlan({
            name: prev.name,
            imageData: prev.imageUrl,
            opacity: prev.opacity,
            isLocked: prev.isLocked,
            xMm: prev.xMm,
            yMm: prev.yMm,
            scale: newScale,
            visible: prev.visible,
          });
          return { ...prev, scale: newScale };
        }
        return prev;
      });
    },
    []
  );

  // État de synchronisation temps réel avec la base de données PostgreSQL
  const [dbSyncStatus, setDbSyncStatus] = useState<"SAVED" | "SAVING" | "OFFLINE" | "ERROR">(
    "SAVED"
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const isInitialLoadedRef = useRef<boolean>(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // Zones de services / pôles d'aménagement (initialisé vierge)
  const [zones, setZones] = useState<FloorZone[]>([]);

  // Baies informatiques (initialisé vierge)
  const [racks, setRacks] = useState<RackDisplay[]>([]);

  // Nœuds du plateau (Bureaux multi-places RH, Prises Réseau, Boîtes de Sol, Wi-Fi) (initialisé vierge)
  const [nodes, setNodes] = useState<NodeDisplay[]>([]);

  // Chargement initial depuis la base de données PostgreSQL
  useEffect(() => {
    let isMounted = true;
    async function loadTopology() {
      try {
        setDbSyncStatus("SAVING");
        const res = await fetch("/api/topology");
        if (!res.ok) {
          if (isMounted) setDbSyncStatus("OFFLINE");
          return;
        }
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && !data.isEmpty) {
          if (data.racks) setRacks(data.racks);
          if (data.nodes) setNodes(data.nodes);
          if (data.zones && data.zones.length > 0) setZones(data.zones);
          if (data.sites && data.sites.length > 0) setSites(data.sites);
          if (data.customPivots) setCustomPivots(data.customPivots);
          if (data.floor) {
            setFloorData({
              widthMm: data.floor.widthMm || 60000,
              heightMm: data.floor.heightMm || 35000,
            });
          }
        }
        setDbSyncStatus("SAVED");
      } catch {
        if (isMounted) setDbSyncStatus("OFFLINE");
      } finally {
        if (isMounted) isInitialLoadedRef.current = true;
      }
    }

    loadTopology();
    return () => {
      isMounted = false;
    };
  }, []);

  // Déclencheur d'auto-sauvegarde debouncé (800ms) vers PostgreSQL
  const triggerAutoSave = useCallback(() => {
    if (!isInitialLoadedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setDbSyncStatus("SAVING");

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/topology", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            floor: {
              id: "floor-rdc",
              name: "Plateau Principal - RDC",
              building: "Bâtiment Principal",
              floorNumber: 1,
              widthMm: floorData.widthMm,
              heightMm: floorData.heightMm,
              scaleRatio: 1.0,
            },
            racks,
            nodes,
            zones,
            sites,
            customPivots,
          }),
        });

        if (res.ok) {
          setDbSyncStatus("SAVED");
          setLastSavedAt(
            new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
        } else {
          setDbSyncStatus("ERROR");
        }
      } catch {
        setDbSyncStatus("OFFLINE");
      }
    }, 800);
  }, [floorData, racks, nodes, zones, sites, customPivots]);

  // Surveillance des modifications du plateau pour la persistance automatique en BDD
  useEffect(() => {
    if (isInitialLoadedRef.current) {
      triggerAutoSave();
    }
  }, [nodes, racks, zones, floorData, customPivots, triggerAutoSave]);

  // Filtrage des éléments par site actif
  const visibleRacks = useMemo(
    () =>
      racks.filter(
        (r) =>
          !activeSiteId || activeSiteId === "ALL" || (r.siteId ?? DEFAULT_SITE_ID) === activeSiteId
      ),
    [racks, activeSiteId]
  );
  const visibleNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          !activeSiteId || activeSiteId === "ALL" || (n.siteId ?? DEFAULT_SITE_ID) === activeSiteId
      ),
    [nodes, activeSiteId]
  );
  const visibleZones = useMemo(
    () =>
      zones.filter(
        (z) =>
          !activeSiteId || activeSiteId === "ALL" || (z.siteId ?? DEFAULT_SITE_ID) === activeSiteId
      ),
    [zones, activeSiteId]
  );

  // Bureaux disponibles pour la liaison sur le site actif
  const desks = useMemo(() => visibleNodes.filter((n) => n.type === "DESK"), [visibleNodes]);

  // Fonction pour concentrer la caméra et la vue sur un site spécifique
  const handleFocusSite = useCallback(
    (siteId: string) => {
      const sitePlans = allBackgroundPlans.filter(
        (p) => (p.siteId ?? DEFAULT_SITE_ID) === siteId && p.visible
      );
      const siteRacks = racks.filter((r) => (r.siteId ?? DEFAULT_SITE_ID) === siteId);
      const siteNodes = nodes.filter((n) => (n.siteId ?? DEFAULT_SITE_ID) === siteId);
      const siteZones = zones.filter((z) => (z.siteId ?? DEFAULT_SITE_ID) === siteId);

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let hasElements = false;

      for (const p of sitePlans) {
        hasElements = true;
        const w = p.widthMm ?? floorData.widthMm;
        const h = p.heightMm ?? floorData.heightMm;
        minX = Math.min(minX, p.xMm);
        minY = Math.min(minY, p.yMm);
        maxX = Math.max(maxX, p.xMm + w);
        maxY = Math.max(maxY, p.yMm + h);
      }

      for (const r of siteRacks) {
        hasElements = true;
        minX = Math.min(minX, r.xMm);
        minY = Math.min(minY, r.yMm);
        maxX = Math.max(maxX, r.xMm + (r.widthMm ?? 800));
        maxY = Math.max(maxY, r.yMm + (r.depthMm ?? 1000));
      }

      for (const n of siteNodes) {
        if (n.xMm < 0 || n.yMm < 0) continue;
        hasElements = true;
        minX = Math.min(minX, n.xMm);
        minY = Math.min(minY, n.yMm);
        maxX = Math.max(maxX, n.xMm + (n.widthMm ?? 1000));
        maxY = Math.max(maxY, n.yMm + (n.heightMm ?? 1000));
      }

      for (const z of siteZones) {
        hasElements = true;
        minX = Math.min(minX, z.xMm);
        minY = Math.min(minY, z.yMm);
        maxX = Math.max(maxX, z.xMm + z.widthMm);
        maxY = Math.max(maxY, z.yMm + z.heightMm);
      }

      if (hasElements && minX < Infinity && minY < Infinity) {
        const widthMm = Math.max(2000, maxX - minX);
        const heightMm = Math.max(2000, maxY - minY);
        const centerX = minX + widthMm / 2;
        const centerY = minY + heightMm / 2;

        const screenW = typeof window !== "undefined" ? window.innerWidth : 1200;
        const screenH = typeof window !== "undefined" ? window.innerHeight : 800;

        const scaleX = (screenW * 0.75) / widthMm;
        const scaleY = (screenH * 0.75) / heightMm;
        const targetScale = Math.min(scaleX, scaleY, 0.15);

        useCameraStore.getState().setViewport({
          panX: screenW / 2 - centerX * targetScale,
          panY: screenH / 2 - centerY * targetScale,
          scale: targetScale,
        });
      } else {
        fitFloor(floorData.widthMm, floorData.heightMm, window.innerWidth, window.innerHeight);
      }
    },
    [allBackgroundPlans, racks, nodes, zones, floorData, fitFloor]
  );

  const handleBatchSpawn = useCallback(
    (result: BatchSpawnResult) => {
      const siteTag = activeSiteId || DEFAULT_SITE_ID;
      const taggedDesks = result.desks.map((d) => ({ ...d, siteId: d.siteId ?? siteTag }));
      const taggedOutlets = result.outlets.map((o) => ({ ...o, siteId: o.siteId ?? siteTag }));
      setNodes((prev) => [...prev, ...taggedDesks, ...taggedOutlets]);
      if (taggedDesks.length > 0) {
        setSelectedNodeId(taggedDesks[0]!.id);
      }
    },
    [activeSiteId]
  );

  const handleAutoRoute = useCallback(
    (portIds: string[], targetRackId: string, targetSwitchId?: string) => {
      setNodes((currentNodes) => {
        const result = autoRoutePortsToRack({
          portIds,
          rackId: targetRackId,
          switchId: targetSwitchId,
          allNodes: currentNodes,
          racks: visibleRacks.length > 0 ? visibleRacks : racks,
          customPivots,
        });
        setCustomPivots(result.updatedCustomPivots);
        return result.updatedNodes;
      });
    },
    [visibleRacks, racks, customPivots]
  );

  const handleSelectNodeToggle = useCallback((node: NodeDisplay, isShift: boolean) => {
    setSelectedZoneId(null);
    if (isShift) {
      setSelectedNodeIds((prev) => {
        const next = prev.includes(node.id)
          ? prev.filter((id) => id !== node.id)
          : [...prev, node.id];
        if (next.length === 1 && next[0]) setSelectedNodeId(next[0]);
        else setSelectedNodeId(null);
        return next;
      });
    } else {
      setSelectedNodeIds([node.id]);
      setSelectedNodeId(node.id);
    }
  }, []);

  const handleSelectNodeIds = useCallback((ids: string[]) => {
    setSelectedZoneId(null);
    setSelectedNodeIds(ids);
    if (ids.length === 1 && ids[0]) {
      setSelectedNodeId(ids[0]);
    } else {
      setSelectedNodeId(null);
    }
  }, []);

  const handleGroupNodeMoveEnd = useCallback(
    (nodeIds: string[], delta: { deltaX: number; deltaY: number }) => {
      if (nodeIds.length === 0 || (delta.deltaX === 0 && delta.deltaY === 0)) return;
      const idSet = new Set(nodeIds);
      setNodes((prev) =>
        prev.map((n) => {
          if (idSet.has(n.id) || (n.attachedToDeskId && idSet.has(n.attachedToDeskId))) {
            return {
              ...n,
              xMm: Math.round(n.xMm + delta.deltaX),
              yMm: Math.round(n.yMm + delta.deltaY),
            };
          }
          return n;
        })
      );
      setRacks((prev) =>
        prev.map((r) => {
          if (idSet.has(r.id)) {
            return {
              ...r,
              xMm: Math.round(r.xMm + delta.deltaX),
              yMm: Math.round(r.yMm + delta.deltaY),
            };
          }
          return r;
        })
      );
    },
    []
  );

  const handleBulkDelete = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setNodes((prev) =>
      prev.filter(
        (n) => !idSet.has(n.id) && (!n.attachedToDeskId || !idSet.has(n.attachedToDeskId))
      )
    );
    setRacks((prev) => prev.filter((r) => !idSet.has(r.id)));
    setSelectedNodeIds([]);
    setSelectedNodeId(null);
    setSelectedRackDeviceId(null);
  }, []);

  const handleSelectRackDevice = useCallback((rack: RackDisplay, device: any) => {
    setSelectedZoneId(null);
    setSelectedNodeIds([rack.id]);
    setSelectedNodeId(rack.id);
    setSelectedRackDeviceId(device.id);
    setInspectorWidth((w) => Math.max(w, 384));
  }, []);

  const handleMoveRackDeviceSlot = useCallback(
    (rackId: string, deviceId: string, targetSlotU: number) => {
      setRacks((prev) =>
        prev.map((r) => {
          if (r.id !== rackId) return r;
          const updatedDevices = (r.devices || []).map((d) =>
            d.id === deviceId ? { ...d, slotU: targetSlotU } : d
          );
          return { ...r, devices: updatedDevices };
        })
      );
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== rackId) return n;
          const updatedDevices = (n.devices || []).map((d) =>
            d.id === deviceId ? { ...d, slotU: targetSlotU } : d
          );
          return { ...n, devices: updatedDevices };
        })
      );
    },
    []
  );

  const handleClearMultiSelection = useCallback(() => {
    setSelectedNodeIds([]);
  }, []);

  const handleApplyMatrixImport = useCallback((result: ApplyMatrixResult) => {
    setNodes(result.updatedNodes);
    if (result.unpositionedNodes.length > 0) {
      setUnpositionedNodes((prev) => [...prev, ...result.unpositionedNodes]);
    }
  }, []);

  // Nœud actuellement sélectionné (synchronisé en direct, incluant les baies)
  const selectedNode = useMemo(() => {
    // 1. Priorité absolue aux baies pour garantir l'indépendance et la synchronisation en temps réel des modules
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
        subType: fromRacks.uHeight === 18 ? ("RACK_18U" as const) : ("RACK_42U" as const),
        uHeight: fromRacks.uHeight,
        description: fromRacks.description ?? "",
        devices: fromRacks.devices ?? [],
        patches: fromRacks.patches ?? [],
        siteId: fromRacks.siteId ?? DEFAULT_SITE_ID,
      };
    }
    const fromNodes = nodes.find((n) => n.id === selectedNodeId);
    if (fromNodes) return fromNodes;
    return null;
  }, [nodes, racks, selectedNodeId]);

  // Zone actuellement sélectionnée
  const selectedZone = useMemo(() => {
    if (!selectedZoneId) return null;
    return zones.find((z) => z.id === selectedZoneId) ?? null;
  }, [zones, selectedZoneId]);

  // Actions de manipulation des zones
  const handleSelectZone = useCallback((zone: FloorZone) => {
    setSelectedZoneId(zone.id);
    setSelectedNodeId(null);
  }, []);

  const handleZoneMoveEnd = useCallback((id: string, newPos: { x: number; y: number }) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, xMm: newPos.x, yMm: newPos.y } : z)));
  }, []);

  const handleUpdateZone = useCallback((zoneId: string, updates: Partial<FloorZone>) => {
    setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, ...updates } : z)));
  }, []);

  const handleDeleteZone = useCallback((zoneId: string) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    setSelectedZoneId((prev) => (prev === zoneId ? null : prev));
  }, []);

  const handleAddZone = useCallback(
    (newZone?: Partial<FloorZone>) => {
      const nextIdx = zones.length + 1;
      const createdZone: FloorZone = {
        id: `zone-${Date.now()}`,
        name: newZone?.name || `Zone de Service ${nextIdx}`,
        serviceCode: newZone?.serviceCode || `S${nextIdx}`,
        department: newZone?.department,
        color: newZone?.color || "#0284c7",
        xMm: newZone?.xMm ?? 15000,
        yMm: newZone?.yMm ?? 15000,
        widthMm: newZone?.widthMm ?? 12000,
        heightMm: newZone?.heightMm ?? 8000,
        opacity: newZone?.opacity ?? 0.12,
        description: newZone?.description || "Nouvelle zone de service délimitée.",
        siteId: newZone?.siteId || activeSiteId || DEFAULT_SITE_ID,
      };
      setZones((prev) => [...prev, createdZone]);
      setSelectedZoneId(createdZone.id);
      setSelectedNodeId(null);
    },
    [zones.length, activeSiteId]
  );

  // Calcul dynamique des câbles : regroupement en faisceau par bloc de prises RJ45 + baie cible avec décalage ruban parallèle
  const cables: CableData[] = useMemo(() => {
    if (activeViewMode === "HR") return [];
    if (visibleRacks.length === 0) return [];

    const list: CableData[] = [];
    let globalIndex = 0;

    const patchedEndpoints = visibleNodes.filter(
      (n) => n.type !== "PATCH_PANEL" && (n.isPatched || n.stackedPorts?.some((p) => p.isPatched))
    );

    patchedEndpoints.forEach((outlet) => {
      const isStacked =
        outlet.subType === "FLOOR_BOX" || (outlet.stackedPorts && outlet.stackedPorts.length > 0);

      if (isStacked && outlet.stackedPorts && outlet.stackedPorts.length > 0) {
        // Filtrer les ports branchés du bloc
        const patchedPorts = outlet.stackedPorts
          .map((sp, originalIdx) => ({ sp, originalIdx }))
          .filter(({ sp }) => sp.isPatched);

        // Regroupement par baie cible pour former les faisceaux communs (split si baies différentes)
        const portsByRack: Record<string, typeof patchedPorts> = {};
        patchedPorts.forEach((item) => {
          const targetRackId =
            item.sp.connectedRackId || outlet.connectedRackId || visibleRacks[0]?.id || "rack-01";
          if (!portsByRack[targetRackId]) {
            portsByRack[targetRackId] = [];
          }
          portsByRack[targetRackId]!.push(item);
        });

        // Générer chaque faisceau vers sa baie cible
        Object.entries(portsByRack).forEach(([rackId, bundleItems]) => {
          const rack = visibleRacks.find((r) => r.id === rackId) ?? visibleRacks[0];
          if (!rack) return;

          const bundleKey = `bundle-${outlet.id}-${rack.id}`;
          const targetBasePos = { x: rack.xMm + 400, y: rack.yMm + 240 + globalIndex * 25 };

          // Pivot partagé pour l'ensemble du faisceau de ce bloc vers cette baie
          const customPivot = customPivots[bundleKey] ?? customPivots[`cable-run-${outlet.id}`];
          const bundlePivot = customPivot ?? {
            x: outlet.xMm,
            y: targetBasePos.y,
          };

          const totalInBundle = bundleItems.length;

          bundleItems.forEach(({ sp, originalIdx }, bIdx) => {
            const isVoip = sp.outletRole === "VOIP";
            const isPrinter = sp.outletRole === "PRINTER";
            const isWifi = sp.outletRole === "WIFI";
            const vlanId = sp.vlanId ?? (isVoip ? 30 : isPrinter ? 40 : isWifi ? 50 : 20);

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

            const cableId = `cable-run-${outlet.id}-p${originalIdx}`;

            // Écart parallèle régulier (ruban plat / ribbon) : 6mm d'écartement constant
            const offsetDistanceMm = totalInBundle > 1 ? (bIdx - (totalInBundle - 1) / 2) * 6 : 0;

            list.push({
              id: cableId,
              cableType: "HORIZONTAL_RUN",
              category: "CAT6A",
              lengthMm: 44200 + globalIndex * 300,
              colorCode: cableColor,
              sourcePos: { x: outlet.xMm, y: outlet.yMm },
              targetPos: targetBasePos,
              vlanId,
              sourceNodeId: outlet.id,
              targetNodeId: rack.id,
              pivot: bundlePivot,
              bundleKey,
              bundleIndex: bIdx,
              bundleTotal: totalInBundle,
              offsetDistanceMm,
            });
          });

          globalIndex++;
        });
      } else if (outlet.isPatched) {
        // Prise simple standard ou équipement réseau sur le plancher
        const rack =
          visibleRacks.find((r) => r.id === outlet.connectedRackId) ??
          visibleRacks.find((r) => r.id === "rack-01") ??
          visibleRacks[0];
        if (!rack) return;
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
        const targetPos = { x: rack.xMm + 400, y: rack.yMm + 240 + globalIndex * 25 };
        const sourceCenterPos = {
          x: outlet.xMm + (outlet.widthMm ? Math.round(outlet.widthMm / 2) : 0),
          y: outlet.yMm + (outlet.heightMm ? Math.round(outlet.heightMm / 2) : 0),
        };

        const customPivot = customPivots[cableId];
        const pivot = customPivot ?? {
          x: sourceCenterPos.x,
          y: targetPos.y,
        };

        list.push({
          id: cableId,
          cableType: "HORIZONTAL_RUN",
          category: "CAT6A",
          lengthMm: 44200 + globalIndex * 400,
          colorCode: cableColor,
          sourcePos: sourceCenterPos,
          targetPos,
          vlanId,
          sourceNodeId: outlet.id,
          targetNodeId: rack.id,
          pivot,
          bundleKey: cableId,
          bundleIndex: 0,
          bundleTotal: 1,
          offsetDistanceMm: 0,
        });
        globalIndex++;
      }
    });

    // Trunks dorsaux inter-baies (LLDP / Trunks 10G)
    for (let i = 0; i < visibleRacks.length - 1; i++) {
      const r1 = visibleRacks[i];
      const r2 = visibleRacks[i + 1];
      if (!r1 || !r2) continue;

      const hasInterRackPatch =
        r1.patches?.some(
          (p) =>
            p.cableType === "FIBER_OM4" ||
            p.cableType === "DAC_10G" ||
            p.serviceName?.includes("TRUNK")
        ) ||
        r2.patches?.some(
          (p) =>
            p.cableType === "FIBER_OM4" ||
            p.cableType === "DAC_10G" ||
            p.serviceName?.includes("TRUNK")
        );

      if (hasInterRackPatch) {
        const trunkCableId = `trunk-${r1.id}-${r2.id}`;
        list.push({
          id: trunkCableId,
          cableType: "BACKBONE_TRUNK",
          category: "FIBER_OM4",
          lengthMm: Math.abs(r2.xMm - r1.xMm),
          colorCode: "rgba(16, 185, 129, 0.95)",
          sourcePos: { x: r1.xMm + r1.widthMm, y: r1.yMm + 200 },
          targetPos: { x: r2.xMm, y: r2.yMm + 200 },
          vlanId: 1,
          sourceNodeId: r1.id,
          targetNodeId: r2.id,
          bundleKey: trunkCableId,
          bundleIndex: 0,
          bundleTotal: 1,
          offsetDistanceMm: 0,
        });
      }
    }

    return list;
  }, [visibleNodes, visibleRacks, activeViewMode, customPivots, vlanStyles]);

  // Déplacement interactif libre 2D du pivot orthogonal unique
  const handlePivotChange = useCallback((cableId: string, newPivot: { x: number; y: number }) => {
    setCustomPivots((prev) => ({
      ...prev,
      [cableId]: {
        x: Math.max(0, Math.round(newPivot.x)),
        y: Math.max(0, Math.round(newPivot.y)),
      },
    }));
  }, []);

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
  const handleFocusNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const target = nodes.find((n) => n.id === nodeId) || racks.find((r) => r.id === nodeId);
      if (!target) return;

      const currentScale = useCameraStore.getState().viewport.scale;
      const targetScale = Math.max(currentScale, 0.035);

      const canvasLeft = isPaletteOpen || isTopologyOpen || isInventoryOpen ? leftPanelWidth : 56;
      const canvasWidth =
        typeof window !== "undefined" ? window.innerWidth - canvasLeft - inspectorWidth : 800;
      const canvasHeight = typeof window !== "undefined" ? window.innerHeight - 56 : 600;

      const panX = canvasLeft + canvasWidth / 2 - target.xMm * targetScale;
      const panY = 56 + canvasHeight / 2 - target.yMm * targetScale;

      useCameraStore.getState().setViewport({ panX, panY, scale: targetScale });
    },
    [nodes, racks, isPaletteOpen, isTopologyOpen]
  );

  const handleSelectNode = (node: NodeDisplay) => {
    setSelectedNodeId(node.id);
    if (node.type === "WALL_OUTLET") {
      handleSelectOutlet(node);
    }
  };

  // Ouverture du menu contextuel au clic droit sur un équipement
  const handleNodeContextMenu = useCallback((node: NodeDisplay, pos: { x: number; y: number }) => {
    setSelectedNodeId(node.id);
    setContextMenu({ node, x: pos.x, y: pos.y });
  }, []);

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
  const pendingPivotDragRef = useRef<{ cableId: string; pos: { x: number; y: number } } | null>(
    null
  );
  const rafPivotDragRef = useRef<number | null>(null);

  // Déplacement d'un nœud (bureau ou prise)
  const handleNodeUpdate = useCallback((id: string, newPos: { x: number; y: number }) => {
    setNodes((prev) => {
      const current = prev.find((n) => n.id === id);
      if (!current || (current.xMm === newPos.x && current.yMm === newPos.y)) return prev;

      if (current.type === "DESK") {
        const deltaX = newPos.x - current.xMm;
        const deltaY = newPos.y - current.yMm;

        // Les coudes et waypoints intermédiaires restent STRICTEMENT fixes et indépendants
        return prev.map((n) => {
          if (n.id === id) {
            return { ...n, xMm: newPos.x, yMm: newPos.y };
          }
          // Seules les prises rattachées exclusivement à CE bureau bougent solidairement ; les blocs partagés restent fixes au sol
          const isExclusiveToDesk =
            n.attachedToDeskId === id &&
            (!n.attachedDeskIds || n.attachedDeskIds.length <= 1) &&
            (!n.stackedPorts ||
              new Set(n.stackedPorts.map((p) => p.attachedToDeskId).filter(Boolean)).size <= 1);

          if (isExclusiveToDesk) {
            return { ...n, xMm: n.xMm + deltaX, yMm: n.yMm + deltaY };
          }
          return n;
        });
      }

      // Pour les prises murales, les waypoints intermédiaires restent également immobiles
      return prev.map((n) => (n.id === id ? { ...n, xMm: newPos.x, yMm: newPos.y } : n));
    });
  }, []);

  // Déplacement direct d'un nœud : Konva gère le déplacement fluide à 60 FPS sur GPU
  // Aucun re-rendu React n'est déclenché en cours de vol afin d'éliminer toute chute de framerate.
  // La position finale et les liaisons sont enregistrées sur handleNodeMoveEnd à la fin du glissement.
  const handleThrottledNodeDragMove = useCallback(
    (_id: string, _newPos: { x: number; y: number }) => {
      // No-op pendant le drag pour 60 FPS constants
    },
    []
  );

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

  // Fin du déplacement d'un nœud ou d'une baie (liaison automatique si lâché sur un bureau, ou détachement fluide)
  const handleNodeMoveEnd = useCallback(
    (id: string, newPos: { x: number; y: number }) => {
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

      setNodes((prev) => {
        const node = prev.find((n) => n.id === id);
        if (node && node.type === "WALL_OUTLET") {
          // A. Glisser-déposer DANS un bloc : si une prise simple est lâchée sur un bloc existant, l'absorber !
          const isSingleOutlet =
            (!node.stackedPorts || node.stackedPorts.length <= 1) &&
            node.subType !== "SOCKET_BLOCK";

          if (isSingleOutlet) {
            // A1. Glisser-déposer sur un bloc existant -> Absorption
            const hitBlock = prev.find(
              (b) =>
                b.id !== id &&
                b.type === "WALL_OUTLET" &&
                (b.subType === "SOCKET_BLOCK" || (b.stackedPorts && b.stackedPorts.length > 0)) &&
                Math.hypot(newPos.x - b.xMm, newPos.y - b.yMm) < 260
            );

            if (hitBlock) {
              const curStacked = hitBlock.stackedPorts || [];
              if (curStacked.length < 8) {
                const newIdx = curStacked.length;
                const absorbedPort: StackedPortItem = {
                  portIndex: newIdx,
                  portLabel: node.name.startsWith("Prise") ? `P${newIdx + 1}` : node.name,
                  outletRole: node.outletRole || "DATA",
                  vlanId: node.vlanId,
                  poeMode: node.poeMode || "NONE",
                  isPatched: node.isPatched,
                  connectedRackId: node.connectedRackId,
                  connectedSwitchId: node.connectedSwitchId,
                  connectedSwitchPort: node.connectedSwitchPort,
                  assignedPerson: node.assignedPerson,
                  attachedSeatIndex: node.attachedSeatIndex,
                  attachedToDeskId: node.attachedToDeskId,
                  ipAddress: node.ipAddress,
                  macAddress: node.macAddress,
                  pingStatus: node.pingStatus,
                  pingLatencyMs: node.pingLatencyMs,
                };

                const allDeskIds = Array.from(
                  new Set(
                    [
                      hitBlock.attachedToDeskId,
                      ...(hitBlock.attachedDeskIds || []),
                      node.attachedToDeskId,
                      ...curStacked.map((p) => p.attachedToDeskId),
                    ].filter(Boolean) as string[]
                  )
                );

                return prev
                  .filter((n) => n.id !== id)
                  .map((n) =>
                    n.id === hitBlock.id
                      ? {
                          ...n,
                          subType: "SOCKET_BLOCK",
                          portCount: curStacked.length + 1,
                          stackedPorts: [...curStacked, absorbedPort],
                          attachedDeskIds: allDeskIds,
                          attachedToDeskId: hitBlock.attachedToDeskId || node.attachedToDeskId,
                        }
                      : n
                  );
              }
            }

            // A2. Glisser-déposer sur une AUTRE prise simple -> Fusion immédiate en Bloc de prises RJ45 !
            const hitOutlet = prev.find(
              (o) =>
                o.id !== id &&
                o.type === "WALL_OUTLET" &&
                o.subType !== "SOCKET_BLOCK" &&
                (!o.stackedPorts || o.stackedPorts.length <= 1) &&
                o.subType !== "FLOOR_BOX" &&
                o.subType !== "WIFI_AP" &&
                o.subType !== "PRINTER_STATION" &&
                Math.hypot(newPos.x - o.xMm, newPos.y - o.yMm) < 260
            );

            if (hitOutlet) {
              const port1: StackedPortItem = {
                portIndex: 0,
                portLabel: hitOutlet.name.startsWith("Prise") ? "P1" : hitOutlet.name,
                outletRole: hitOutlet.outletRole || "DATA",
                vlanId: hitOutlet.vlanId,
                poeMode: hitOutlet.poeMode || "NONE",
                isPatched: hitOutlet.isPatched,
                connectedRackId: hitOutlet.connectedRackId,
                connectedSwitchId: hitOutlet.connectedSwitchId,
                connectedSwitchPort: hitOutlet.connectedSwitchPort,
                assignedPerson: hitOutlet.assignedPerson,
                attachedSeatIndex: hitOutlet.attachedSeatIndex,
                attachedToDeskId: hitOutlet.attachedToDeskId,
                ipAddress: hitOutlet.ipAddress,
                macAddress: hitOutlet.macAddress,
                pingStatus: hitOutlet.pingStatus,
                pingLatencyMs: hitOutlet.pingLatencyMs,
              };

              const port2: StackedPortItem = {
                portIndex: 1,
                portLabel: node.name.startsWith("Prise") ? "P2" : node.name,
                outletRole: node.outletRole || "DATA",
                vlanId: node.vlanId,
                poeMode: node.poeMode || "NONE",
                isPatched: node.isPatched,
                connectedRackId: node.connectedRackId,
                connectedSwitchId: node.connectedSwitchId,
                connectedSwitchPort: node.connectedSwitchPort,
                assignedPerson: node.assignedPerson,
                attachedSeatIndex: node.attachedSeatIndex,
                attachedToDeskId: node.attachedToDeskId,
                ipAddress: node.ipAddress,
                macAddress: node.macAddress,
                pingStatus: node.pingStatus,
                pingLatencyMs: node.pingLatencyMs,
              };

              const combinedDeskIds = Array.from(
                new Set(
                  [hitOutlet.attachedToDeskId, node.attachedToDeskId].filter(Boolean) as string[]
                )
              );

              return prev
                .filter((n) => n.id !== id)
                .map((n) =>
                  n.id === hitOutlet.id
                    ? {
                        ...n,
                        subType: "SOCKET_BLOCK",
                        name: n.name.startsWith("Prise")
                          ? n.name.replace(/^Prise\s*/i, "Bloc RJ45 ")
                          : `Bloc RJ45 ${n.name}`,
                        portCount: 2,
                        stackedPorts: [port1, port2],
                        attachedDeskIds: combinedDeskIds,
                        attachedToDeskId: hitOutlet.attachedToDeskId || node.attachedToDeskId,
                      }
                    : n
                );
            }
          }

          // 1. Détection si la prise est déposée sur un bureau
          const hitDesk = prev.find((d) => {
            if (d.type !== "DESK") return false;
            const deskW = d.widthMm ?? 1600;
            const deskH = d.heightMm ?? 800;
            return (
              newPos.x >= d.xMm &&
              newPos.x <= d.xMm + deskW &&
              newPos.y >= d.yMm &&
              newPos.y <= d.yMm + deskH
            );
          });

          if (hitDesk) {
            let seatIdx: number | undefined = undefined;
            if (hitDesk.subType === "BENCH_QUAD") {
              const w = hitDesk.widthMm ?? 3200;
              const h = hitDesk.heightMm ?? 1600;
              const relX = newPos.x - hitDesk.xMm;
              const relY = newPos.y - hitDesk.yMm;
              const isRight = relX > w / 2;
              const isBottom = relY > h / 2;
              seatIdx =
                !isRight && !isBottom ? 0 : isRight && !isBottom ? 1 : !isRight && isBottom ? 2 : 3;
            } else if (hitDesk.subType === "BENCH_DOUBLE") {
              const h = hitDesk.heightMm ?? 1600;
              const relY = newPos.y - hitDesk.yMm;
              seatIdx = relY < h / 2 ? 0 : 1;
            }

            // Si la prise est DÉJÀ liée à un AUTRE meuble, demander confirmation avant transfert
            if (node.attachedToDeskId && node.attachedToDeskId !== hitDesk.id) {
              setPendingAttachmentTransfer({
                outletId: id,
                currentDeskId: node.attachedToDeskId,
                targetDeskId: hitDesk.id,
                newPos,
                seatIdx,
              });
              // Déplacer la prise mais conserver la liaison d'origine en attendant la confirmation utilisateur
              return prev.map((n) =>
                n.id === id
                  ? {
                      ...n,
                      xMm: newPos.x,
                      yMm: newPos.y,
                    }
                  : n
              );
            }

            // Sinon (non liée ou déjà sur ce meuble) : liaison directe
            return prev.map((n) =>
              n.id === id
                ? {
                    ...n,
                    xMm: newPos.x,
                    yMm: newPos.y,
                    attachedToDeskId: hitDesk.id,
                    attachedSeatIndex: seatIdx,
                  }
                : n
            );
          }
        }
        return prev;
      });

      handleNodeUpdate(id, newPos);
      handleRackUpdate(id, newPos);
    },
    [handleNodeUpdate, handleRackUpdate]
  );

  // Déplacement d'une baie : Konva gère le déplacement fluide à 60 FPS sur GPU
  // Aucun re-rendu React en cours de déplacement pour éviter les chutes de FPS.
  const handleThrottledRackDragMove = useCallback(
    (_id: string, _newPos: { x: number; y: number }) => {
      // No-op pendant le drag pour 60 FPS constants
    },
    []
  );

  // Déplacement fluide du pivot de câble cadencé par RAF à 60 FPS
  const handleThrottledPivotChange = useCallback(
    (cableId: string, newPivot: { x: number; y: number }) => {
      pendingPivotDragRef.current = { cableId, pos: newPivot };
      if (!rafPivotDragRef.current) {
        rafPivotDragRef.current = requestAnimationFrame(() => {
          if (pendingPivotDragRef.current) {
            handlePivotChange(pendingPivotDragRef.current.cableId, pendingPivotDragRef.current.pos);
          }
          rafPivotDragRef.current = null;
        });
      }
    },
    [handlePivotChange]
  );

  // Nettoyage des timers RAF au démontage
  useEffect(() => {
    return () => {
      if (rafNodeDragRef.current) cancelAnimationFrame(rafNodeDragRef.current);
      if (rafRackDragRef.current) cancelAnimationFrame(rafRackDragRef.current);
      if (rafPivotDragRef.current) cancelAnimationFrame(rafPivotDragRef.current);
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

  // Extraction d'un port RJ45 depuis un bloc multi-ports vers le plateau en tant que prise autonome
  const handleExtractPortFromBlock = useCallback(
    (blockId: string, portIndex: number, worldPos?: { x: number; y: number }) => {
      setNodes((prev) => {
        const block = prev.find((n) => n.id === blockId);
        if (!block || !block.stackedPorts || block.stackedPorts.length === 0) return prev;

        const targetPort = block.stackedPorts[portIndex];
        if (!targetPort) return prev;

        const spawnX = worldPos ? Math.round(worldPos.x) : block.xMm + 250;
        const spawnY = worldPos ? Math.round(worldPos.y) : block.yMm + 250;
        const newOutletId = `outlet-extracted-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const deskForExtracted = targetPort.attachedToDeskId || block.attachedToDeskId;
        const newOutlet: NodeDisplay = {
          id: newOutletId,
          type: "WALL_OUTLET",
          subType: "WALL_OUTLET",
          name:
            targetPort.portLabel && !targetPort.portLabel.startsWith("P")
              ? targetPort.portLabel
              : `Prise ${block.name.replace(/^Bloc\s*/i, "")}-${targetPort.portLabel || `P${portIndex + 1}`}`,
          xMm: spawnX,
          yMm: spawnY,
          siteId: block.siteId,
          attachedToDeskId: deskForExtracted,
          attachedSeatIndex: targetPort.attachedSeatIndex,
          outletRole: targetPort.outletRole || "DATA",
          vlanId: targetPort.vlanId,
          poeMode: targetPort.poeMode,
          isPatched: targetPort.isPatched,
          connectedRackId: targetPort.connectedRackId,
          connectedSwitchId: targetPort.connectedSwitchId,
          connectedSwitchPort: targetPort.connectedSwitchPort,
          assignedPerson: targetPort.assignedPerson,
          ipAddress: targetPort.ipAddress,
          macAddress: targetPort.macAddress,
          pingStatus: targetPort.pingStatus,
          pingLatencyMs: targetPort.pingLatencyMs,
        };

        const remainingPorts = block.stackedPorts
          .filter((_, idx) => idx !== portIndex)
          .map((p, idx) => ({ ...p, portIndex: idx }));

        const remainingDeskIds = Array.from(
          new Set(remainingPorts.map((p) => p.attachedToDeskId).filter(Boolean) as string[])
        );

        return [
          ...prev.map((n) =>
            n.id === blockId
              ? {
                  ...n,
                  portCount: remainingPorts.length,
                  stackedPorts: remainingPorts,
                  attachedDeskIds:
                    remainingDeskIds.length > 0 ? remainingDeskIds : n.attachedDeskIds || [],
                  attachedToDeskId: remainingDeskIds[0] || n.attachedToDeskId,
                }
              : n
          ),
          newOutlet,
        ];
      });
    },
    []
  );

  // Option : Ajouter une prise à un bureau existant
  const handleAddOutletToDesk = (deskId: string, role: OutletRole) => {
    setNodes((prev) => {
      const desk = prev.find((d) => d.id === deskId);
      if (!desk) return prev;

      const deskW = desk.widthMm ?? 1600;
      const existingDeskOutlets = prev.filter((n) => n.attachedToDeskId === deskId);
      const suffixLetter = String.fromCharCode(65 + existingDeskOutlets.length);
      const newOutletId = `outlet-${deskId}-${role.toLowerCase()}-${Date.now()}`;

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
      const primaryOccupant = desk.assignedPerson || desk.seats?.find((s) => s.fullName)?.fullName;

      const newOutlet: NodeDisplay = {
        id: newOutletId,
        type: "WALL_OUTLET",
        subType: "WALL_OUTLET",
        name: `Prise ${deskNum}-${suffixLetter}`,
        xMm: Math.round(worldX),
        yMm: Math.round(worldY),
        attachedToDeskId: deskId,
        outletRole: role,
        vlanId: undefined, // Cuivre passif : hérite de l'équipement actif au brassage
        assignedPerson: primaryOccupant || undefined,
        attachedSeatIndex: desk.seats && desk.seats.length > 0 ? 0 : undefined,
        siteId: desk.siteId ?? activeSiteId ?? DEFAULT_SITE_ID,
      };

      return [...prev, newOutlet];
    });
  };

  // Option : Ajouter un bloc de prises RJ45 (jusqu'à 8 ports) au centre d'un bureau
  const handleAddSocketBlockToDesk = (deskId: string, portsCount: number = 4) => {
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

      const blockId = `socket-block-${deskId}-${Date.now()}`;
      const deskNum = desk.name.replace(/^Bureau\s*/i, "").trim();

      const numPorts = Math.min(8, Math.max(2, portsCount));
      const initialPorts: StackedPortItem[] = Array.from({ length: numPorts }).map((_, i) => {
        const seatOccupant = desk.seats && desk.seats[i] ? desk.seats[i] : undefined;
        return {
          portIndex: i,
          portLabel: `P${i + 1}`,
          outletRole: "DATA",
          vlanId: undefined, // Cuivre passif : hérité dynamiquement
          assignedPerson: seatOccupant?.fullName,
          attachedSeatIndex: seatOccupant ? i : undefined,
        };
      });

      const newSocketBlock: NodeDisplay = {
        id: blockId,
        type: "WALL_OUTLET",
        subType: "SOCKET_BLOCK",
        name: `Bloc RJ45 ${deskNum}`,
        xMm: Math.round(worldCenterX),
        yMm: Math.round(worldCenterY),
        attachedToDeskId: deskId,
        outletRole: "DATA",
        portCount: numPorts,
        stackedPorts: initialPorts,
        siteId: desk.siteId ?? activeSiteId ?? DEFAULT_SITE_ID,
      };

      return [...prev, newSocketBlock];
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

  // Option : Mise à jour libre des propriétés (RH, Dimensions réelles ou fausses mesures, Rotation, Baies)
  const handleUpdateNodeProperties = (nodeId: string, updates: Partial<NodeDisplay>) => {
    // Si mise à jour du nom, dimensions, équipements, description, patches ou site d'une baie, synchroniser racks
    if (
      updates.name ||
      updates.description !== undefined ||
      updates.devices ||
      updates.patches !== undefined ||
      updates.widthMm ||
      updates.heightMm ||
      updates.uHeight ||
      updates.siteId
    ) {
      setRacks((prevRacks) =>
        prevRacks.map((r) =>
          r.id === nodeId
            ? {
                ...r,
                ...(updates.name ? { name: updates.name } : {}),
                ...(updates.description !== undefined ? { description: updates.description } : {}),
                ...(updates.devices ? { devices: updates.devices } : {}),
                ...(updates.patches !== undefined ? { patches: updates.patches } : {}),
                ...(updates.widthMm ? { widthMm: updates.widthMm } : {}),
                ...(updates.heightMm ? { depthMm: updates.heightMm } : {}),
                ...(updates.uHeight ? { uHeight: updates.uHeight } : {}),
                ...(updates.siteId !== undefined ? { siteId: updates.siteId } : {}),
              }
            : r
        )
      );
    }

    setNodes((prev) => {
      const target = prev.find((n) => n.id === nodeId);
      if (!target) return prev;

      // Si on change le site d'un bureau, propager aux prises solidaires attachées
      if (updates.siteId !== undefined && target.type === "DESK") {
        return prev.map((n) => {
          if (n.id === nodeId) {
            return { ...n, ...updates };
          }
          if (n.attachedToDeskId === nodeId) {
            return { ...n, siteId: updates.siteId };
          }
          return n;
        });
      }

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
        const centerX =
          target.xMm + (deskW / 2) * Math.cos(oldRad) - (deskH / 2) * Math.sin(oldRad);
        const centerY =
          target.yMm + (deskW / 2) * Math.sin(oldRad) + (deskH / 2) * Math.cos(oldRad);

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
          // Faire pivoter les prises exclusivement rattachées autour du même centre (les blocs partagés restent fixes)
          const isExclusiveToDesk =
            n.attachedToDeskId === nodeId &&
            (!n.attachedDeskIds || n.attachedDeskIds.length <= 1) &&
            (!n.stackedPorts ||
              new Set(n.stackedPorts.map((p) => p.attachedToDeskId).filter(Boolean)).size <= 1);

          if (isExclusiveToDesk) {
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

      return prev.map((n) => {
        if (n.id !== nodeId) return n;
        const updated = { ...n, ...updates };
        if ("iotProperties" in updates && updates.iotProperties === undefined) {
          delete updated.iotProperties;
        }
        return updated;
      });
    });
  };

  // Helper de conversion d'un équipement scanné/découvert en élément de châssis baies (RackDeviceItem)
  const convertScannedToRackDevice = useCallback(
    (dev: ScannedDeviceItem, slotU: number): RackDeviceItem => {
      const brandUpper = (dev.manufacturer || "").toUpperCase();
      let brand: RackDeviceBrand = "GENERIC";
      if (brandUpper.includes("ARUBA") || brandUpper.includes("HPE")) brand = "ARUBA";
      else if (brandUpper.includes("CISCO") || brandUpper.includes("MERAKI")) brand = "CISCO";
      else if (brandUpper.includes("ZYXEL")) brand = "ZYXEL";
      else if (brandUpper.includes("UBIQUITI") || brandUpper.includes("UNIFI")) brand = "UBIQUITI";
      else if (brandUpper.includes("FORTINET") || brandUpper.includes("FORTIGATE"))
        brand = "FORTINET";

      return {
        id: `dev-${dev.id}-${Date.now()}`,
        name: dev.name,
        slotU,
        uSize: dev.uSize || 1,
        deviceType: (dev.deviceType as any) || "SWITCH",
        brand,
        model: dev.model,
        ipAddress: dev.ip,
        macAddress: dev.mac,
        portsCount: dev.portsCount || 24,
        poeBudgetW: dev.poeBudgetW,
        status: dev.status || "ONLINE",
      };
    },
    []
  );

  // Insertion d'un équipement scanné directement dans une baie avec vérification de disponibilité de U
  // et relocalisation automatique si déjà présent dans une baie (sans duplication)
  const handleInsertScannedDeviceIntoRack = useCallback(
    (rackId: string, dev: ScannedDeviceItem, targetSlotU?: number) => {
      const rack = racks.find((r) => r.id === rackId);
      if (!rack) return;

      // 1. Chercher si l'équipement est déjà présent dans une baie existante
      let previousRackId: string | null = null;
      let existingDeviceItem: RackDeviceItem | null = null;
      for (const r of racks) {
        const found = (r.devices || []).find((d) => isDeviceMatch(d, dev));
        if (found) {
          previousRackId = r.id;
          existingDeviceItem = found;
          break;
        }
      }

      // Appareils déjà dans la baie cible, en excluant l'équipement en cours de déplacement
      const targetRackDevices = (rack.devices ?? []).filter((d) => !isDeviceMatch(d, dev));
      const totalU = rack.uHeight || 42;
      const reqSize = dev.uSize ?? 1;
      let slotU = targetSlotU ? Math.max(reqSize, Math.min(totalU, targetSlotU)) : 24;

      // Les équipements occupent les slots [slotU - uSize + 1, slotU]
      const occupiedSlots = new Set(
        targetRackDevices.flatMap((d) => {
          const uSize = d.uSize ?? 1;
          return Array.from({ length: uSize }, (_, i) => d.slotU - i);
        })
      );

      const isAvailable = (s: number) => {
        const minU = s - reqSize + 1;
        const maxU = s;
        if (minU < 1 || maxU > totalU) return false;
        for (let u = minU; u <= maxU; u++) {
          if (occupiedSlots.has(u)) return false;
        }
        return true;
      };

      if (!isAvailable(slotU)) {
        let found = false;
        for (let offset = 1; offset < totalU; offset++) {
          if (isAvailable(slotU - offset)) {
            slotU = slotU - offset;
            found = true;
            break;
          }
          if (isAvailable(slotU + offset)) {
            slotU = slotU + offset;
            found = true;
            break;
          }
        }
        if (!found) {
          console.warn(
            `[Baie ${rack.name}] Espace insuffisant pour placer un équipement de ${reqSize}U.`
          );
          return;
        }
      }

      const deviceToAdd: RackDeviceItem = existingDeviceItem
        ? { ...existingDeviceItem, slotU, uSize: dev.uSize ?? existingDeviceItem.uSize }
        : convertScannedToRackDevice(dev, slotU);

      setRacks((prev) =>
        prev.map((r) => {
          if (r.id === rackId) {
            const cleaned = (r.devices || []).filter((d) => !isDeviceMatch(d, dev));
            return { ...r, devices: [...cleaned, deviceToAdd] };
          }
          if (previousRackId && r.id === previousRackId) {
            return {
              ...r,
              devices: (r.devices || []).filter((d) => !isDeviceMatch(d, dev)),
            };
          }
          return r;
        })
      );

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === rackId) {
            const cleaned = (n.devices || []).filter((d) => !isDeviceMatch(d, dev));
            return { ...n, devices: [...cleaned, deviceToAdd] };
          }
          if (previousRackId && n.id === previousRackId) {
            return {
              ...n,
              devices: (n.devices || []).filter((d) => !isDeviceMatch(d, dev)),
            };
          }
          return n;
        })
      );

      setSelectedNodeId(rackId);
    },
    [racks, convertScannedToRackDevice]
  );

  // Ajout depuis la Palette d'équipements multi-métiers (Générique, Profils Personnalisés, Mobilier, Baies)
  // Supporte le placement aux coordonnées mondes exactes (Glisser-Déposer) et la liaison automatique aux bureaux
  const handleAddItemFromPalette = (item: PaletteItem, position?: { x: number; y: number }) => {
    const offset = nodes.length % 6;
    let newX = position ? Math.round(position.x) : 32000 + offset * 1800;
    let newY = position ? Math.round(position.y) : 16000 + Math.floor(nodes.length / 6) * 1600;

    // Si déposé via glisser-déposer, centrer les meubles sur le curseur
    if (position && item.targetType === "DESK") {
      newX = Math.round(position.x - (item.widthMm ?? 1600) / 2);
      newY = Math.round(position.y - (item.heightMm ?? 800) / 2);
    }

    // Liaison automatique : si une prise / bloc de prises est déposé sur un bureau, lier immédiatement !
    let linkedDeskId: string | undefined = undefined;
    let seatIndex: number | undefined = undefined;

    if (item.targetType === "WALL_OUTLET") {
      const hitDesk = nodes.find((d) => {
        if (d.type !== "DESK") return false;
        const deskW = d.widthMm ?? 1600;
        const deskH = d.heightMm ?? 800;
        return newX >= d.xMm && newX <= d.xMm + deskW && newY >= d.yMm && newY <= d.yMm + deskH;
      });

      if (hitDesk) {
        linkedDeskId = hitDesk.id;
        if (hitDesk.subType === "BENCH_QUAD") {
          const w = hitDesk.widthMm ?? 3200;
          const h = hitDesk.heightMm ?? 1600;
          const relX = newX - hitDesk.xMm;
          const relY = newY - hitDesk.yMm;
          const isRight = relX > w / 2;
          const isBottom = relY > h / 2;
          seatIndex =
            !isRight && !isBottom ? 0 : isRight && !isBottom ? 1 : !isRight && isBottom ? 2 : 3;
        } else if (hitDesk.subType === "BENCH_DOUBLE") {
          const h = hitDesk.heightMm ?? 1600;
          const relY = newY - hitDesk.yMm;
          seatIndex = relY < h / 2 ? 0 : 1;
        }
      }
    }

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
    const portCount = item.portCount ?? 1;
    const assignedVlan = item.vlanId ?? (item.outletRole === "VOIP" ? 30 : undefined);

    const computeName = () => {
      if (isCustom) {
        const count = nodes.filter((n) => n.name.startsWith(item.name)).length;
        return count > 0 ? `${item.name} (${count + 1})` : item.name;
      }
      if (isGenericPort) {
        const count =
          nodes.filter((n) => n.subType === "GENERIC_PORT" || n.name.startsWith("Port-")).length +
          1;
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
      if (item.subType === "SOCKET_BLOCK") {
        const blockCount =
          nodes.filter((n) => n.subType === "SOCKET_BLOCK" || n.name.startsWith("Bloc RJ45"))
            .length + 1;
        return `Bloc RJ45 0${blockCount}`;
      }
      if (item.subType === "PRINTER_STATION") {
        const pCount = nodes.filter((n) => n.subType === "PRINTER_STATION").length;
        return `Copieur RH ${pCount + 1}`;
      }
      const outletCount = nodes.filter(
        (n) => n.type === "WALL_OUTLET" && (!n.subType || n.subType === "WALL_OUTLET")
      ).length;
      return `Prise ${403 + outletCount}`;
    };

    const finalName = computeName();

    if (isRack) {
      const rackU = item.customUHeight ?? (item.subType === "RACK_18U" ? 18 : 42);
      const rackName = item.name && !item.name.startsWith("Baie ") ? item.name : finalName;
      const newRack: RackDisplay = {
        id: newId,
        name: rackName,
        xMm: newX,
        yMm: newY,
        widthMm: item.widthMm ?? 800,
        depthMm: Math.max(item.heightMm ?? 1000, 320 + rackU * 36),
        uHeight: rackU,
        description: item.description ?? "",
        devices: [],
        patches: [],
        siteId: activeSiteId || DEFAULT_SITE_ID,
      };
      setRacks((prev) => [...prev, newRack]);
      setSelectedNodeId(newId);
      return;
    }

    let stackedPorts: StackedPortItem[] | undefined = undefined;
    if (item.subType === "SOCKET_BLOCK" || portCount > 1) {
      const pCount = item.subType === "SOCKET_BLOCK" ? (item.portCount ?? 4) : portCount;
      stackedPorts = Array.from({ length: pCount }).map((_, idx) => ({
        portIndex: idx,
        portLabel: `P${idx + 1}`,
        outletRole: "DATA",
        vlanId: undefined, // Cuivre passif : hérité dynamiquement
        poeMode: "NONE",
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
      attachedToDeskId: linkedDeskId,
      attachedSeatIndex: seatIndex,
      vlanId: item.targetType === "WALL_OUTLET" ? undefined : assignedVlan,
      poeMode: item.poeMode,
      customEmote: item.customEmote,
      portCount: portCount,
      stackedPorts,
      siteId: activeSiteId || DEFAULT_SITE_ID,
      portId: item.targetType === "WALL_OUTLET" ? `port-${newId}` : undefined,
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
  };

  // Suppression complète d'un équipement (par Clic droit, menu Inspecteur ou touches Suppr / Retour arrière)
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => {
        const target = prev.find((n) => n.id === nodeId);
        if (!target) return prev;
        // Si c'est un meuble / bureau, détacher toutes les prises solidaires
        if (target.type === "DESK") {
          return prev
            .filter((n) => n.id !== nodeId)
            .map((n) =>
              n.attachedToDeskId === nodeId
                ? { ...n, attachedToDeskId: undefined, attachedSeatIndex: undefined }
                : n
            );
        }
        return prev.filter((n) => n.id !== nodeId);
      });

      // Retirer des baies si c'était une baie
      setRacks((prev) => prev.filter((r) => r.id !== nodeId));

      // Nettoyer le pivot de câble personnalisé rattaché
      setCustomPivots((prev) => {
        const copy = { ...prev };
        delete copy[`cable-run-${nodeId}`];
        return copy;
      });

      // Désélectionner si c'était l'élément inspecté
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
        setTraceResult(null);
      }

      setContextMenu(null);
    },
    [selectedNodeId]
  );

  // Raccourci clavier de suppression pour l'équipement sélectionné (Touche Suppr ou Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        handleDeleteNode(selectedNodeId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, handleDeleteNode]);

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
        dev.deviceType === "WIFI_AP" ? "WIFI" : dev.deviceType === "PRINTER" ? "PRINTER" : "DATA";

      const newNode: NodeDisplay = {
        id: dev.id,
        name: dev.name,
        type: targetType,
        xMm: 24000 + Math.floor(Math.random() * 8000),
        yMm: 12000 + Math.floor(Math.random() * 8000),
        widthMm: dev.deviceType === "SERVER_RACK" ? 800 : dev.deviceType === "PRINTER" ? 800 : 350,
        heightMm:
          dev.deviceType === "SERVER_RACK" ? 1000 : dev.deviceType === "PRINTER" ? 700 : 350,
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
            ) /
              1000 +
              4
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

  // Chargement de la configuration d'exemple complète (Démo Campus Horizon)
  const handleLoadDemoConfig = async () => {
    setIsFileMenuOpen(false);
    try {
      setDbSyncStatus("SAVING");
      const res = await fetch("/api/topology/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "demo" }),
      });
      if (res.ok) {
        const data = await res.json();
        const cfg = data.importedConfig;
        if (cfg) {
          if (cfg.racks) setRacks(cfg.racks);
          if (cfg.nodes) setNodes(cfg.nodes);
          if (cfg.zones) setZones(cfg.zones);
          if (cfg.site) {
            setSites([cfg.site]);
            setActiveSiteId(cfg.site.id);
          } else if (cfg.sites && cfg.sites.length > 0) {
            setSites(cfg.sites);
            setActiveSiteId(cfg.sites[0].id);
          }
          if (cfg.floor) {
            setFloorData({
              widthMm: cfg.floor.widthMm || 60000,
              heightMm: cfg.floor.heightMm || 35000,
            });
          }
          if (cfg.customPivots) setCustomPivots(cfg.customPivots);
        }
        setDbSyncStatus("SAVED");
        setLastSavedAt(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } else {
        setDbSyncStatus("ERROR");
      }
    } catch {
      setDbSyncStatus("OFFLINE");
    }
  };

  // Réinitialisation complète du plateau à l'état vierge
  const handleResetFloorPlan = async () => {
    setIsFileMenuOpen(false);
    if (
      !window.confirm(
        "Êtes-vous sûr de vouloir vider l'ensemble du plateau et repartir sur un projet vierge ?"
      )
    ) {
      return;
    }
    try {
      setDbSyncStatus("SAVING");
      await fetch("/api/topology", { method: "DELETE" });
      setNodes([]);
      setRacks([]);
      setZones([]);
      setCustomPivots({});
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setFloorData({ widthMm: 60000, heightMm: 35000 });
      setUnpositionedNodes([]);
      // Nettoyer tous les plans de fond et sites stockés dans IndexedDB et réinitialiser
      await deleteBackgroundPlan().catch(() => {});
      await clearAllSites().catch(() => {});
      await saveSite(DEFAULT_SITE).catch(() => {});
      setAllBackgroundPlans([]);
      setSites([DEFAULT_SITE]);
      setActiveSiteId(DEFAULT_SITE_ID);
      setBackgroundPlan({
        imageUrl: null,
        name: "",
        opacity: 0.6,
        isLocked: false,
        xMm: 0,
        yMm: 0,
        scale: 1.0,
        visible: true,
      });

      await fetch("/api/discovery/status", { method: "DELETE" }).catch(() => null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("netfloor_discovery_updated"));
        window.dispatchEvent(new CustomEvent("netfloor_full_reset"));
      }

      clearEnterpriseDirectory();
      setDbSyncStatus("SAVED");
      setLastSavedAt(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    } catch {
      setDbSyncStatus("ERROR");
    }
  };

  // Déliement de tous les comptes AD sur les postes et sièges
  const handleUnlinkAllAdUsers = useCallback(() => {
    setNodes((prevNodes) => unlinkAdAccountsFromNodes(prevNodes));
  }, []);

  // Remise à zéro complète du système (appelée par SettingsModal)
  const handleFullSystemReset = useCallback(async () => {
    await fetch("/api/discovery/status", { method: "DELETE" }).catch(() => null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("netfloor_discovery_updated"));
      window.dispatchEvent(new CustomEvent("netfloor_full_reset"));
    }
    clearEnterpriseDirectory();
    setNodes([]);
    setRacks([]);
    setZones([]);
    setCustomPivots({});
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setFloorData({ widthMm: 60000, heightMm: 35000 });
    setUnpositionedNodes([]);
    setAllBackgroundPlans([]);
    setSites([DEFAULT_SITE]);
    setActiveSiteId(DEFAULT_SITE_ID);
    setBackgroundPlan({
      imageUrl: null,
      name: "",
      opacity: 0.6,
      isLocked: false,
      xMm: 0,
      yMm: 0,
      scale: 1.0,
      visible: true,
    });
    setDbSyncStatus("SAVED");
  }, []);

  // Auto-déploiement topologique intelligent multi-baies & auto-câblage physique depuis la découverte réseau
  const handleAutoDeployDiscoveredTopology = useCallback(
    async (options?: {
      forceResetExisting?: boolean;
      devices?: DiscoveredDeviceInput[];
      connections?: DiscoveredConnectionInput[];
    }) => {
      try {
        setDbSyncStatus("SAVING");
        let devices = options?.devices;
        let connections = options?.connections;

        if (!devices || devices.length === 0) {
          const res = await fetch("/api/discovery/status?jobId=latest");
          if (res.ok) {
            const data = await res.json();
            devices = data.devices || [];
            connections = data.connections || [];
          }
        }

        if (!devices || devices.length === 0) {
          const resAll = await fetch("/api/discovery/status?allDevices=true");
          if (resAll.ok) {
            const dataAll = await resAll.json();
            devices = dataAll.devices || [];
          }
        }

        if (!devices || devices.length === 0) {
          return;
        }

        const existingRacks = options?.forceResetExisting ? [] : racks;
        const existingNodes = options?.forceResetExisting ? [] : nodes;

        const result = autoDeployDiscoveredTopology({
          devices,
          connections: connections || [],
          existingRacks,
          existingNodes,
          floorBounds: { widthMm: floorData.widthMm, heightMm: floorData.heightMm },
        });

        // Appliquer les baies créées ou mises à jour
        setRacks(result.racks);

        // Convertir également les baies en nœuds PATCH_PANEL de premier ordre
        const rackNodes: NodeDisplay[] = result.racks.map((r) => ({
          id: r.id,
          type: "PATCH_PANEL",
          subType: "RACK_42U",
          name: r.name,
          widthMm: r.widthMm,
          heightMm: r.depthMm,
          xMm: r.xMm,
          yMm: r.yMm,
          uHeight: r.uHeight || 42,
          devices: r.devices || [],
          patches: r.patches || [],
          siteId: r.siteId || activeSiteId || DEFAULT_SITE_ID,
        }));

        const floorNodes = result.nodes.filter((n) => n.type !== "PATCH_PANEL");
        setNodes([...rackNodes, ...floorNodes]);

        // Cadrer automatiquement l'affichage sur la zone de travail
        if (typeof window !== "undefined") {
          fitFloor(floorData.widthMm, floorData.heightMm, window.innerWidth, window.innerHeight);
          window.dispatchEvent(new CustomEvent("netfloor_discovery_updated"));
        }
      } catch (err) {
        console.error("Erreur lors de l'auto-déploiement de la topologie :", err);
      }
    },
    [racks, nodes, floorData, activeSiteId, fitFloor]
  );

  // Export du plan complet au format JSON
  const handleExportJsonConfig = () => {
    setIsFileMenuOpen(false);
    const payload = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      floor: {
        id: "floor-rdc",
        name: "Plateau Principal - RDC",
        building: "Bâtiment Principal",
        floorNumber: 1,
        widthMm: floorData.widthMm,
        heightMm: floorData.heightMm,
        scaleRatio: 1.0,
      },
      racks,
      nodes,
      zones,
      sites,
      customPivots,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `netfloor-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import d'un fichier JSON personnalisé
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsFileMenuOpen(false);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const cfg = JSON.parse(evt.target?.result as string);
        if (cfg.racks) setRacks(cfg.racks);
        if (cfg.nodes) setNodes(cfg.nodes);
        if (cfg.zones) setZones(cfg.zones);
        if (cfg.site) {
          setSites([cfg.site]);
          setActiveSiteId(cfg.site.id);
          await saveSite(cfg.site).catch(() => {});
        } else if (cfg.sites && cfg.sites.length > 0) {
          setSites(cfg.sites);
          setActiveSiteId(cfg.sites[0].id);
          for (const s of cfg.sites) {
            await saveSite(s).catch(() => {});
          }
        }
        if (cfg.floor) {
          setFloorData({
            widthMm: cfg.floor.widthMm || 60000,
            heightMm: cfg.floor.heightMm || 35000,
          });
        }
        if (cfg.customPivots) setCustomPivots(cfg.customPivots);

        // Sauvegarde en BDD
        await fetch("/api/topology", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            floor: cfg.floor || {
              id: "floor-rdc",
              name: "Plateau Principal - RDC",
              building: "Bâtiment Principal",
              floorNumber: 1,
              widthMm: floorData.widthMm,
              heightMm: floorData.heightMm,
              scaleRatio: 1.0,
            },
            racks: cfg.racks || [],
            nodes: cfg.nodes || [],
            zones: cfg.zones || [],
            sites: cfg.site ? [cfg.site] : cfg.sites || sites,
            customPivots: cfg.customPivots || {},
          }),
        });
        setDbSyncStatus("SAVED");
        setLastSavedAt(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch (err) {
        console.error("Erreur import JSON :", err);
        alert("Format de fichier JSON invalide.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

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
            <p className="text-[11px] text-slate-400">
              Plateau R+4 • RH & Espace • Maintenance & Câblage • DSI Réseau
            </p>
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
            <Network className="w-3.5 h-3.5" />⚡ Vue DSI & Câblage
          </button>
        </div>

        {/* Camera & Ingestion Controls */}
        <div className="flex items-center gap-2.5 text-xs font-mono">
          {/* Sélecteur rapide de Site Actif */}
          {/* Bouton du Site Actif */}
          <button
            type="button"
            onClick={() => setIsDimensionsModalOpen(true)}
            title="Site géographique actif et dimensions du plateau (cliquez pour modifier)"
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-amber-500/50 rounded-lg transition flex items-center gap-2 text-xs font-sans cursor-pointer shadow-sm group"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400 group-hover:scale-105 transition shrink-0" />
            <span className="font-semibold text-slate-100 max-w-[160px] truncate">
              {sites.find((s) => s.id === activeSiteId)?.name ?? "Site Principal"}
            </span>
          </button>

          <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 flex items-center gap-2 text-slate-400">
            <span>
              Échelle : <CameraScaleIndicator />
            </span>
          </div>

          {/* Bouton Création d'une nouvelle Zone */}
          <button
            onClick={() => handleAddZone()}
            title="Créer une nouvelle zone de service ou d'aménagement"
            className="px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-emerald-100 border border-emerald-800/50 hover:border-emerald-600 rounded-lg transition flex items-center gap-1.5 text-xs font-sans"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>+ Zone</span>
          </button>

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
              onClick={() =>
                fitFloor(
                  floorData.widthMm,
                  floorData.heightMm,
                  window.innerWidth,
                  window.innerHeight
                )
              }
              title="Cadrer l'Étage"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Bouton Gestionnaire de Plans & Fonds d'étages */}
          <button
            type="button"
            onClick={() => setIsPlanManagerOpen(true)}
            title="Gestionnaire de Plans & Fonds d'étages (Upload PNG/PDF, échelle métrique en mètres, calage X/Y)"
            className="px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 hover:text-amber-100 border border-amber-800/50 hover:border-amber-600 rounded-lg transition flex items-center gap-1.5 text-xs font-sans shadow-sm cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Gestion des Plans</span>
          </button>

          {/* Bouton Outil Règle Permanente & Étalonnage Fusionnés */}
          <button
            type="button"
            onClick={() => setIsRulerActive((prev) => !prev)}
            title="Outil Règle & Mesure métrique (permet de mesurer n'importe quel segment et d'étalonner l'échelle)"
            className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 text-xs font-sans shadow-sm cursor-pointer ${
              isRulerActive
                ? "bg-sky-600 text-white border-sky-400 font-semibold shadow-sky-600/30"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-850"
            }`}
          >
            <Ruler className="w-3.5 h-3.5 text-sky-400" />
            <span>Règle</span>
          </button>

          {/* Badge de synchronisation BDD temps réel */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-[11px] font-sans">
            {dbSyncStatus === "SAVED" && (
              <span
                className="flex items-center gap-1.5 text-emerald-400"
                title="Plateau synchronisé avec PostgreSQL"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span className="hidden sm:inline font-medium">BDD Synchronisée</span>
                {lastSavedAt && <span className="text-[9px] text-slate-500">({lastSavedAt})</span>}
              </span>
            )}
            {dbSyncStatus === "SAVING" && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="hidden sm:inline font-medium">Sauvegarde BDD...</span>
              </span>
            )}
            {dbSyncStatus === "OFFLINE" && (
              <span
                className="flex items-center gap-1.5 text-slate-400"
                title="PostgreSQL non connecté (démarrage via ./run.sh)"
              >
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="hidden sm:inline">BDD Hors Ligne</span>
              </span>
            )}
            {dbSyncStatus === "ERROR" && (
              <button
                type="button"
                onClick={triggerAutoSave}
                className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 cursor-pointer"
                title="Erreur de sauvegarde. Cliquez pour réessayer"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Erreur BDD (Réessayer)</span>
              </button>
            )}
          </div>

          {/* Input fichier caché pour import JSON */}
          <input
            type="file"
            ref={jsonFileInputRef}
            accept=".json"
            className="hidden"
            onChange={handleImportJsonFile}
          />

          {/* Menu Déroulant Compact : Échanges & Fichiers */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFileMenuOpen((prev) => !prev)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-sans font-medium rounded-lg shadow-md shadow-blue-600/20 flex items-center gap-1 transition text-[11px] cursor-pointer"
              title="Importer ou Exporter les données"
            >
              <UploadCloud className="w-3 h-3" />
              <span>⇄ Fichiers</span>
              <span className="text-[9px] opacity-80">▾</span>
            </button>

            {isFileMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Fermer le menu"
                  className="fixed inset-0 z-40 cursor-default bg-transparent border-none w-full h-full"
                  onClick={() => setIsFileMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs text-slate-200 animate-in fade-in slide-in-from-top-1 font-sans">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Configuration & Démo
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadDemoConfig}
                    className="w-full text-left px-2.5 py-2 hover:bg-slate-800 rounded-lg flex items-center gap-2 text-slate-200 hover:text-white transition cursor-pointer"
                  >
                    <Network className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs text-blue-300">
                        Charger la Démo d'Exemple
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Campus Horizon (3 baies, bureaux, VLANs)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      jsonFileInputRef.current?.click();
                    }}
                    className="w-full text-left px-2.5 py-2 hover:bg-slate-800 rounded-lg flex items-center gap-2 text-slate-200 hover:text-white transition cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">Importer Projet (JSON)</div>
                      <div className="text-[10px] text-slate-400">
                        Restaurer une configuration sauvegardée
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportJsonConfig}
                    className="w-full text-left px-2.5 py-2 hover:bg-slate-800 rounded-lg flex items-center gap-2 text-slate-200 hover:text-white transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">Exporter Projet (JSON)</div>
                      <div className="text-[10px] text-slate-400">
                        Sauvegarde complète du plateau
                      </div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-800" />
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Carnets CSV DSI
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      setIsImportModalOpen(true);
                    }}
                    className="w-full text-left px-2.5 py-2 hover:bg-slate-800 rounded-lg flex items-center gap-2 text-slate-200 hover:text-white transition cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">Importer CSV / Matrice</div>
                      <div className="text-[10px] text-slate-400">
                        Carnet de câblage, baies et prises
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      handleExportCsv();
                    }}
                    className="w-full text-left px-2.5 py-2 hover:bg-slate-800 rounded-lg flex items-center gap-2 text-slate-200 hover:text-white transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">Exporter Carnet CSV</div>
                      <div className="text-[10px] text-slate-400">
                        Inventaire et raccordements complets
                      </div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-800" />

                  <button
                    type="button"
                    onClick={handleResetFloorPlan}
                    className="w-full text-left px-2.5 py-2 hover:bg-rose-950/40 rounded-lg flex items-center gap-2 text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">Vider le plateau</div>
                      <div className="text-[10px] text-rose-400/70">
                        Remettre à zéro (Projet vierge)
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Workspace Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Palette d'Équipements Escamotable & Redimensionnable avec Topologie & Inventaire intégrés */}
        <EquipmentPalette
          isOpen={isPaletteOpen}
          onToggle={() => {
            if (isTopologyOpen || isInventoryOpen || isSitesOpen) {
              setIsTopologyOpen(false);
              setIsInventoryOpen(false);
              setIsSitesOpen(false);
              setIsPaletteOpen(true);
            } else {
              setIsPaletteOpen((prev) => !prev);
            }
          }}
          onAddItem={handleAddItemFromPalette}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenBatchSpawner={() => setIsBatchSpawnerOpen(true)}
          onOpenSites={() => {
            if (isSitesOpen) {
              setIsSitesOpen(false);
            } else {
              setIsPaletteOpen(false);
              setIsTopologyOpen(false);
              setIsInventoryOpen(false);
              setIsSitesOpen(true);
            }
          }}
          isSitesOpen={isSitesOpen}
          sitesContent={
            <SitesPanel
              sites={sites}
              activeSiteId={activeSiteId}
              onSelectActiveSite={(id) => {
                setActiveSiteId(id);
              }}
              onFocusSite={handleFocusSite}
              onSaveSite={async (site) => {
                await saveSite(site);
                const updated = await loadAllSites();
                setSites(updated);
              }}
              onDeleteSite={async (id) => {
                await deleteSite(id);
                const updated = await loadAllSites();
                setSites(updated);
                if (activeSiteId === id) {
                  const fallbackId = updated[0]?.id ?? DEFAULT_SITE_ID;
                  setActiveSiteId(fallbackId);
                  handleFocusSite(fallbackId);
                }
              }}
              plans={allBackgroundPlans}
              racks={racks}
              nodes={nodes}
              onOpenPlanManager={() => setIsPlanManagerOpen(true)}
            />
          }
          onOpenTopology={() => {
            if (isTopologyOpen) {
              setIsTopologyOpen(false);
            } else {
              setIsPaletteOpen(false);
              setIsInventoryOpen(false);
              setIsSitesOpen(false);
              setIsTopologyOpen(true);
            }
          }}
          isTopologyOpen={isTopologyOpen}
          onOpenInventory={() => {
            if (isInventoryOpen) {
              setIsInventoryOpen(false);
            } else {
              setIsPaletteOpen(false);
              setIsTopologyOpen(false);
              setIsSitesOpen(false);
              setIsInventoryOpen(true);
            }
          }}
          isInventoryOpen={isInventoryOpen}
          inventoryContent={
            <InventoryPanel
              nodes={visibleNodes}
              racks={visibleRacks}
              zones={visibleZones}
              vlanStyles={vlanStyles}
              onClose={() => setIsInventoryOpen(false)}
              onSelectNode={(node) => {
                handleSelectNode(node);
              }}
              onFocusNode={(nodeId) => {
                handleFocusNode(nodeId);
              }}
              onUpdateNode={handleUpdateNodeProperties}
            />
          }
          vlanStyles={vlanStyles}
          width={leftPanelWidth}
          onResizeStart={handleStartLeftResize}
          topologyContent={
            <NetworkTopologyPanel
              racks={visibleRacks}
              nodes={visibleNodes}
              cables={cables}
              vlanStyles={vlanStyles}
              onClose={() => setIsTopologyOpen(false)}
              onSelectNode={(node) => {
                handleSelectNode(node);
              }}
              onFocusNode={(nodeId) => {
                handleFocusNode(nodeId);
              }}
            />
          }
          racks={visibleRacks}
          nodes={visibleNodes}
          selectedRackId={selectedNode?.type === "PATCH_PANEL" ? selectedNode.id : null}
          onInsertScannedDevice={handleInsertScannedDeviceIntoRack}
          onAutoDeployDiscoveredTopology={handleAutoDeployDiscoveredTopology}
        />

        {/* Main Canvas Area */}
        <div
          style={{
            marginLeft:
              isPaletteOpen || isTopologyOpen || isInventoryOpen || isSitesOpen
                ? `${leftPanelWidth}px`
                : "56px",
          }}
          className="flex-1 h-full relative min-w-0"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const rawData = e.dataTransfer.getData("application/json");
            if (!rawData) return;
            try {
              const parsed = JSON.parse(rawData);
              const rect = e.currentTarget.getBoundingClientRect();
              const screenX = e.clientX - rect.left;
              const screenY = e.clientY - rect.top;

              const viewport = useCameraStore.getState().viewport;
              const worldPos = screenToWorld({ x: screenX, y: screenY }, viewport);

              // 0. Cas du glisser-déposer d'un élément non positionné (importé depuis CSV matriciel)
              if (parsed && parsed.type === "UNPOSITIONED_NODE" && parsed.node) {
                const unpositionedNode = parsed.node as NodeDisplay;
                const snappedPos = snapToGrid(worldPos, useCameraStore.getState().gridConfig).point;
                const placedNode: NodeDisplay = {
                  ...unpositionedNode,
                  xMm: snappedPos.x,
                  yMm: snappedPos.y,
                  siteId: unpositionedNode.siteId ?? activeSiteId ?? DEFAULT_SITE_ID,
                };

                // Retirer de unpositionedNodes et ajouter à nodes
                setUnpositionedNodes((prev) => prev.filter((n) => n.id !== unpositionedNode.id));
                setNodes((prev) => [...prev, placedNode]);
                setSelectedNodeId(placedNode.id);
                return;
              }

              // 1. Cas du glisser-déposer d'un utilisateur depuis l'inventaire
              if (parsed && parsed.type === "DIRECTORY_USER" && parsed.user) {
                const user = parsed.user as { id: string; fullName: string; department?: string };

                // Détecter si on a déposé l'utilisateur sur un meuble/bureau
                const hitDesk = visibleNodes.find((d) => {
                  if (d.type !== "DESK") return false;
                  const deskW = d.widthMm ?? 1600;
                  const deskH = d.heightMm ?? 800;
                  return (
                    worldPos.x >= d.xMm &&
                    worldPos.x <= d.xMm + deskW &&
                    worldPos.y >= d.yMm &&
                    worldPos.y <= d.yMm + deskH
                  );
                });

                if (hitDesk) {
                  setNodes((prev) =>
                    prev.map((node) => {
                      if (node.id !== hitDesk.id) return node;

                      // Si meuble multi-places (Bench 4 ou Bench 2)
                      if (node.seats && node.seats.length > 0) {
                        const deskW = node.widthMm ?? 1600;
                        const deskH = node.heightMm ?? 800;
                        const relX = worldPos.x - node.xMm;
                        const relY = worldPos.y - node.yMm;

                        let targetSeatIdx = 0;
                        if (node.subType === "BENCH_QUAD") {
                          const isRight = relX > deskW / 2;
                          const isBottom = relY > deskH / 2;
                          targetSeatIdx =
                            !isRight && !isBottom
                              ? 0
                              : isRight && !isBottom
                                ? 1
                                : !isRight && isBottom
                                  ? 2
                                  : 3;
                        } else if (node.subType === "BENCH_DOUBLE") {
                          targetSeatIdx = relY < deskH / 2 ? 0 : 1;
                        }

                        const updatedSeats = node.seats.map((seat, sIdx) => {
                          if (sIdx === targetSeatIdx) {
                            return {
                              ...seat,
                              fullName: user.fullName,
                              userId: user.id,
                              department: user.department ?? node.department,
                            };
                          }
                          return seat;
                        });

                        return {
                          ...node,
                          seats: updatedSeats,
                          assignedPerson: user.fullName,
                          department: user.department ?? node.department,
                        };
                      }

                      // Bureau simple / solo
                      return {
                        ...node,
                        assignedPerson: user.fullName,
                        assignedUserId: user.id,
                        department: user.department ?? node.department,
                      };
                    })
                  );

                  setSelectedNodeId(hitDesk.id);
                } else {
                  // Dépôt direct sur l'espace vide du plan : création automatique d'un poste de travail assigné
                  const deskCount = nodes.filter((n) => n.type === "DESK").length;
                  const newDeskId = `node-desk-${Date.now()}`;
                  const deskWidth = 1600;
                  const deskHeight = 800;
                  const snapped = snapToGrid(
                    {
                      x: Math.round(worldPos.x - deskWidth / 2),
                      y: Math.round(worldPos.y - deskHeight / 2),
                    },
                    useCameraStore.getState().gridConfig
                  ).point;

                  const newDeskNode: NodeDisplay = {
                    id: newDeskId,
                    type: "DESK",
                    subType: "DESK_SOLO",
                    name: `Bureau ${403 + deskCount}`,
                    widthMm: deskWidth,
                    heightMm: deskHeight,
                    xMm: snapped.x,
                    yMm: snapped.y,
                    assignedPerson: user.fullName,
                    assignedUserId: user.id,
                    department: user.department || "Plateau",
                    siteId: activeSiteId ?? DEFAULT_SITE_ID,
                  };

                  setNodes((prev) => [...prev, newDeskNode]);
                  setSelectedNodeId(newDeskNode.id);
                }
                return;
              }

              // 2. Cas du glisser-déposer d'un équipement scanné/découvert (Switch, Serveur, Firewall, etc.)
              if (parsed && parsed.type === "SCANNED_RACK_DEVICE" && parsed.device) {
                const scannedDev = parsed.device as ScannedDeviceItem;

                // Détecter si on a déposé l'équipement au-dessus d'une baie existante
                const hitRack = visibleRacks.find((r) => {
                  const aabb = getRackAABB(r);
                  return (
                    worldPos.x >= aabb.minX &&
                    worldPos.x <= aabb.maxX &&
                    worldPos.y >= aabb.minY &&
                    worldPos.y <= aabb.maxY
                  );
                });

                if (hitRack) {
                  const totalU = hitRack.uHeight || 42;
                  const minDepthForU = 340 + totalU * 58;
                  const rDepth = Math.max(hitRack.depthMm ?? 1000, minDepthForU);
                  const usableTop = 150;
                  const usableHeight = Math.max(300, rDepth - 330);
                  const uStep = usableHeight / totalU;
                  const relY = worldPos.y - hitRack.yMm;
                  const targetSlotU = Math.max(
                    1,
                    Math.min(totalU, Math.round(totalU - (relY - usableTop) / uStep))
                  );

                  handleInsertScannedDeviceIntoRack(hitRack.id, scannedDev, targetSlotU);
                } else {
                  // Dépôt sur l'espace vide du plan : création automatique d'une Baie 42U contenant cet équipement
                  // Vérifier si l'équipement était déjà présent dans une autre baie pour le relocaliser
                  let previousRackId: string | null = null;
                  let existingDevItem: RackDeviceItem | null = null;
                  for (const r of racks) {
                    const found = (r.devices || []).find((d) => isDeviceMatch(d, scannedDev));
                    if (found) {
                      previousRackId = r.id;
                      existingDevItem = found;
                      break;
                    }
                  }

                  const newRackId = `rack-${Date.now()}`;
                  const rackCount = racks.length + 1;
                  const rackWidth = 960;
                  const rackDepth = 1000;
                  const snapped = snapToGrid(
                    {
                      x: Math.round(worldPos.x - rackWidth / 2),
                      y: Math.round(worldPos.y - rackDepth / 2),
                    },
                    useCameraStore.getState().gridConfig
                  ).point;

                  const slotU = 24;
                  const initialDevice: RackDeviceItem = existingDevItem
                    ? {
                        ...existingDevItem,
                        slotU,
                        uSize: scannedDev.uSize ?? existingDevItem.uSize,
                      }
                    : convertScannedToRackDevice(scannedDev, slotU);

                  const newRack: RackDisplay = {
                    id: newRackId,
                    name: `BAIE-DSI-0${rackCount}`,
                    xMm: snapped.x,
                    yMm: snapped.y,
                    widthMm: rackWidth,
                    depthMm: Math.max(rackDepth, 340 + 42 * 58),
                    uHeight: 42,
                    description: `Baie créée avec ${scannedDev.name}`,
                    devices: [initialDevice],
                    patches: [],
                    siteId: activeSiteId || DEFAULT_SITE_ID,
                  };

                  const newRackNode: NodeDisplay = {
                    id: newRackId,
                    type: "PATCH_PANEL",
                    subType: "RACK_42U",
                    name: newRack.name,
                    widthMm: newRack.widthMm,
                    heightMm: newRack.depthMm,
                    xMm: newRack.xMm,
                    yMm: newRack.yMm,
                    uHeight: 42,
                    devices: [initialDevice],
                    patches: [],
                    siteId: newRack.siteId,
                  };

                  setRacks((prev) => {
                    const cleaned = previousRackId
                      ? prev.map((r) =>
                          r.id === previousRackId
                            ? {
                                ...r,
                                devices: (r.devices || []).filter(
                                  (d) => !isDeviceMatch(d, scannedDev)
                                ),
                              }
                            : r
                        )
                      : prev;
                    return [...cleaned, newRack];
                  });

                  setNodes((prev) => {
                    const cleaned = previousRackId
                      ? prev.map((n) =>
                          n.id === previousRackId
                            ? {
                                ...n,
                                devices: (n.devices || []).filter(
                                  (d) => !isDeviceMatch(d, scannedDev)
                                ),
                              }
                            : n
                        )
                      : prev;
                    return [...cleaned, newRackNode];
                  });
                  setSelectedNodeId(newRackId);
                }
                return;
              }

              // 3. Cas du glisser-déposer d'un équipement IOT/AP scanné (Borne Wi-Fi, Imprimante, Caméra, Poste, etc.)
              if (parsed && parsed.type === "SCANNED_IOT_DEVICE" && parsed.device) {
                const scannedDev = parsed.device as ScannedDeviceItem;
                const isAp = scannedDev.deviceType === "ACCESS_POINT";
                const isCam = scannedDev.deviceType === "CAMERA";
                const isPc = scannedDev.deviceType === "WORKSTATION";
                const isPhone = scannedDev.deviceType === "PHONE_VOIP";

                const existingNode = nodes.find((n) => isDeviceMatch(n, scannedDev));
                const widthMm = isAp ? 350 : isCam ? 300 : isPc ? 800 : isPhone ? 250 : 800;
                const heightMm = isAp ? 350 : isCam ? 300 : isPc ? 600 : isPhone ? 250 : 700;
                const snapped = snapToGrid(
                  {
                    x: Math.round(worldPos.x - widthMm / 2),
                    y: Math.round(worldPos.y - heightMm / 2),
                  },
                  useCameraStore.getState().gridConfig
                ).point;

                if (existingNode) {
                  // Déplacement / relocalisation sans duplication
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === existingNode.id ? { ...n, xMm: snapped.x, yMm: snapped.y } : n
                    )
                  );
                  setSelectedNodeId(existingNode.id);
                } else {
                  // Création du noeud AP ou IOT sur le plan
                  const prefix = isAp
                    ? "node-ap"
                    : isCam
                      ? "node-cam"
                      : isPc
                        ? "node-pc"
                        : isPhone
                          ? "node-voip"
                          : "node-iot";
                  const newNodeId = `${prefix}-${Date.now()}`;
                  const subType = isAp
                    ? "WIFI_AP"
                    : isCam
                      ? "CAMERA_IP"
                      : isPc
                        ? "DESK_SOLO"
                        : isPhone
                          ? "WALL_OUTLET"
                          : "PRINTER_STATION";
                  const outletRole = isAp
                    ? "WIFI"
                    : isCam
                      ? "CAMERA"
                      : isPc
                        ? "DATA"
                        : isPhone
                          ? "VOIP"
                          : "PRINTER";
                  const customEmote = isAp
                    ? "📶"
                    : isCam
                      ? "🎥"
                      : isPc
                        ? "💻"
                        : isPhone
                          ? "📞"
                          : "🖨️";
                  const vlanId = isAp ? 50 : isCam ? 50 : isPc ? 20 : isPhone ? 30 : 40;
                  const poeMode = isAp ? "POE_PLUS" : isCam ? "POE" : isPhone ? "POE" : "NONE";

                  const newNode: NodeDisplay = {
                    id: newNodeId,
                    name: scannedDev.name,
                    type: isPc ? "DESK" : "WALL_OUTLET",
                    subType,
                    outletRole,
                    xMm: snapped.x,
                    yMm: snapped.y,
                    widthMm,
                    heightMm,
                    siteId: activeSiteId || DEFAULT_SITE_ID,
                    ipAddress: scannedDev.ip !== "Passif" ? scannedDev.ip : undefined,
                    macAddress: scannedDev.mac !== "Non applicable" ? scannedDev.mac : undefined,
                    description:
                      `${scannedDev.manufacturer || ""} ${scannedDev.model || ""}`.trim(),
                    vlanId,
                    poeMode,
                    pingStatus: "ONLINE",
                    customEmote,
                  };
                  setNodes((prev) => [...prev, newNode]);
                  setSelectedNodeId(newNodeId);
                }
                return;
              }

              // 3. Cas standard du glisser-déposer d'un équipement depuis la palette
              const item: PaletteItem = parsed;
              handleAddItemFromPalette(item, worldPos);
            } catch (err) {
              console.error("Erreur lors du dépôt sur le plan :", err);
            }
          }}
        >
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
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: vlanStyles[20]?.color ?? "#3b82f6" }}
                />
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
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: vlanStyles[30]?.color ?? "#a855f7" }}
                />
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
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: vlanStyles[40]?.color ?? "#f59e0b" }}
                />
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
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: vlanStyles[50]?.color ?? "#6366f1" }}
                />
                VLAN 50 (Wi-Fi)
              </button>
              <button
                onClick={() => setCableFilterMode("SELECTED_ONLY")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  cableFilterMode === "SELECTED_ONLY"
                    ? "bg-blue-600 text-white font-bold shadow"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                Sélectionné
              </button>
            </div>
          )}

          {/* Canvas React-Konva */}
          <DynamicFloorCanvas
            floorWidthMm={floorData.widthMm}
            floorHeightMm={floorData.heightMm}
            zones={visibleZones}
            selectedZoneId={selectedZoneId}
            onSelectZone={handleSelectZone}
            onZoneMoveEnd={handleZoneMoveEnd}
            racks={visibleRacks}
            nodes={visibleNodes}
            cables={cables}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={selectedNodeIds}
            onSelectNodeToggle={handleSelectNodeToggle}
            onSelectNodeIds={handleSelectNodeIds}
            onGroupNodeMoveEnd={handleGroupNodeMoveEnd}
            activeViewMode={activeViewMode}
            cableFilterMode={cableFilterMode}
            vlanStyles={vlanStyles}
            showAllLabels={showAllLabels}
            onDeselectAll={() => {
              setSelectedZoneId(null);
              setSelectedNodeId(null);
              setSelectedNodeIds([]);
              setSelectedRackDeviceId(null);
            }}
            onSelectOutlet={handleSelectOutlet}
            onSelectNode={(node) => {
              setSelectedZoneId(null);
              setSelectedRackDeviceId(null);
              handleSelectNode(node);
            }}
            onNodeContextMenu={handleNodeContextMenu}
            onNodePositionChange={handleNodeMoveEnd}
            onNodeDragMove={handleThrottledNodeDragMove}
            onRackDragMove={handleThrottledRackDragMove}
            onPivotChange={handleThrottledPivotChange}
            onExtractPortFromBlock={handleExtractPortFromBlock}
            selectedRackDeviceId={selectedRackDeviceId}
            onSelectRackDevice={handleSelectRackDevice}
            onMoveRackDeviceSlot={handleMoveRackDeviceSlot}
            backgroundPlan={{
              ...backgroundPlan,
              plans:
                allBackgroundPlans.length > 0
                  ? allBackgroundPlans.filter(
                      (p) =>
                        !activeSiteId ||
                        activeSiteId === "ALL" ||
                        (p.siteId ?? DEFAULT_SITE_ID) === activeSiteId
                    )
                  : undefined,
            }}
            onBackgroundPlanPositionChange={(pos) =>
              handleUpdateBackgroundPlan({ xMm: pos.x, yMm: pos.y })
            }
            onCalibrateScale={handleCalibrateScale}
            isRulerActive={isRulerActive}
            onCloseRuler={() => setIsRulerActive(false)}
          />

          {/* Bannière d'accueil si plateau vierge */}
          {nodes.length === 0 && racks.length === 0 && (
            <div className="absolute inset-x-0 bottom-16 flex justify-center pointer-events-none z-10 animate-in fade-in slide-in-from-bottom-3">
              <div className="bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-5 pointer-events-auto">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-100">
                    Plateau vierge prêt à l&apos;emploi
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Glissez des baies ou bureaux depuis la palette à gauche, ou chargez
                    l&apos;environnement de démo.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLoadDemoConfig}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-xs shadow-lg shadow-blue-600/25 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Charger la démo</span>
                </button>
              </div>
            </div>
          )}

          {/* Tiroir des Éléments Non Positionnés (importés par CSV) */}
          <UnpositionedElementsDrawer
            unpositionedNodes={unpositionedNodes}
            onRemoveItem={(id: string) =>
              setUnpositionedNodes((prev) => prev.filter((n) => n.id !== id))
            }
            onClearAll={() => setUnpositionedNodes([])}
          />

          {/* Quick tips badge */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 backdrop-blur rounded-lg p-2.5 text-[11px] text-slate-400 shadow-xl font-mono flex items-center gap-2 pointer-events-none z-10">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span>
              <strong>Fidélité 2D Réelle :</strong> Bureaux avec fauteuils et écrans • Blocs de
              prises RJ45 stackés jusqu&apos;à 8 ports • Tracés orthogonaux 90° avec pivot unique
              ajustable.
            </span>
          </div>
        </div>

        {/* Right Inspector Sidebar - Redimensionnable et protégé contre tout écrasement flex */}
        <div
          style={{ width: `${inspectorWidth}px` }}
          className="flex-shrink-0 relative border-l border-slate-800 bg-slate-950/90 backdrop-blur-md p-4 flex flex-col shadow-2xl z-10 overflow-hidden"
        >
          {/* Poignée de redimensionnement interactif sur la bordure gauche */}
          <div
            onMouseDown={handleStartRightResize}
            onDoubleClick={() => setInspectorWidth(384)}
            className="absolute top-0 left-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-600 transition-colors z-30 group flex items-center justify-center select-none"
            title="Glisser pour redimensionner l'inspecteur (Double-clic pour réinitialiser à 384px)"
          >
            <div className="w-0.5 h-8 bg-slate-700 group-hover:bg-blue-400 group-active:bg-white rounded-full transition" />
          </div>

          <CircuitInspector
            traceResult={traceResult}
            isLoading={isTracing}
            selectedNode={selectedNode}
            selectedZone={selectedZone}
            selectedNodeIds={selectedNodeIds}
            onClearMultiSelection={handleClearMultiSelection}
            onBulkDelete={handleBulkDelete}
            allNodes={visibleNodes}
            desks={desks}
            racks={visibleRacks}
            onToggleAttachment={handleToggleAttachment}
            onAlignWithDesk={handleAlignWithDesk}
            onTriggerTrace={handleSelectOutlet}
            onSelectNode={handleSelectNode}
            onChangeRole={handleChangeRole}
            onAddOutletToDesk={handleAddOutletToDesk}
            onAddSocketBlockToDesk={handleAddSocketBlockToDesk}
            onExtractPortFromBlock={handleExtractPortFromBlock}
            onUpdateNodeProperties={handleUpdateNodeProperties}
            onDeleteNode={handleDeleteNode}
            onUpdateZone={handleUpdateZone}
            onDeleteZone={handleDeleteZone}
            vlanStyles={vlanStyles}
            onUpdateVlanStyle={handleUpdateVlanStyle}
            onResetVlanStyles={handleResetVlanStyles}
            onAutoRoute={handleAutoRoute}
            sites={sites}
            activeSiteId={activeSiteId}
            selectedRackDeviceId={selectedRackDeviceId}
            onSelectRackDeviceId={setSelectedRackDeviceId}
          />
        </div>
      </div>

      {/* 3. CSV Ingestion Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        nodes={nodes}
        racks={racks}
        onApplyImport={handleApplyMatrixImport}
        onSuccess={() => {
          // Callback après import réussi
        }}
      />

      {/* 3a. Batch Desk Spawner Modal */}
      <BatchDeskSpawnerModal
        isOpen={isBatchSpawnerOpen}
        onClose={() => setIsBatchSpawnerOpen(false)}
        zones={visibleZones}
        racks={visibleRacks}
        onSpawn={handleBatchSpawn}
      />

      {/* 3b. Gestionnaire Multi-Plans & Calage Métrique */}
      <PlanManagerModal
        isOpen={isPlanManagerOpen}
        onClose={() => {
          setIsPlanManagerOpen(false);
          loadAllBackgroundPlans().then(setAllBackgroundPlans);
        }}
        plans={allBackgroundPlans}
        sites={sites}
        activeSiteId={activeSiteId}
        activePlanId={activePlanId ?? allBackgroundPlans[0]?.id ?? null}
        onSelectActivePlan={(id) => {
          setActivePlanId(id);
          const target = allBackgroundPlans.find((p) => p.id === id);
          if (target) {
            setBackgroundPlan({
              imageUrl: target.imageData,
              name: target.name,
              opacity: target.opacity,
              isLocked: target.isLocked,
              xMm: target.xMm,
              yMm: target.yMm,
              scale: target.scale,
              widthMm: target.widthMm,
              heightMm: target.heightMm,
              visible: target.visible,
            });
          }
        }}
        onUpdatePlan={(id, updates) => {
          // 1. Mise à jour synchrone instantanée en mémoire (0ms, zéro freeze)
          setAllBackgroundPlans((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
          );

          // 2. Synchronisation du canevas si c'est le plan affiché
          if (activePlanId === id || (!activePlanId && allBackgroundPlans[0]?.id === id)) {
            setBackgroundPlan((prev) => ({
              ...prev,
              ...updates,
              ...(updates.imageData ? { imageUrl: updates.imageData } : {}),
            }));
          }

          // 3. Persistance asynchrone debouncée dans IndexedDB (sans relecture du disque)
          if (savePlanTimeoutRef.current[id]) {
            clearTimeout(savePlanTimeoutRef.current[id]);
          }
          savePlanTimeoutRef.current[id] = setTimeout(() => {
            setAllBackgroundPlans((currentPlans) => {
              const target = currentPlans.find((p) => p.id === id);
              if (target) {
                saveBackgroundPlan(target);
              }
              return currentPlans;
            });
          }, 300);
        }}
        onAddPlan={async (newPlan) => {
          await saveBackgroundPlan(newPlan);
          const updatedPlans = await loadAllBackgroundPlans();
          setAllBackgroundPlans(updatedPlans);
          const created =
            updatedPlans.find((p) => p.id === newPlan.id) ?? updatedPlans[updatedPlans.length - 1];
          if (created) {
            setActivePlanId(created.id);
            setBackgroundPlan({
              imageUrl: created.imageData,
              name: created.name,
              opacity: created.opacity,
              isLocked: created.isLocked,
              xMm: created.xMm,
              yMm: created.yMm,
              scale: created.scale,
              widthMm: created.widthMm,
              heightMm: created.heightMm,
              visible: created.visible,
            });
          }
        }}
        onDeletePlan={async (id) => {
          await deleteBackgroundPlan(id);
          const updatedPlans = await loadAllBackgroundPlans();
          setAllBackgroundPlans(updatedPlans);
          if (activePlanId === id || updatedPlans.length === 0) {
            const nextActive = updatedPlans[0];
            setActivePlanId(nextActive?.id ?? null);
            if (nextActive) {
              setBackgroundPlan({
                imageUrl: nextActive.imageData,
                name: nextActive.name,
                opacity: nextActive.opacity,
                isLocked: nextActive.isLocked,
                xMm: nextActive.xMm,
                yMm: nextActive.yMm,
                scale: nextActive.scale,
                widthMm: nextActive.widthMm,
                heightMm: nextActive.heightMm,
                visible: nextActive.visible,
              });
            } else {
              setBackgroundPlan({
                imageUrl: null,
                name: "",
                opacity: 0.6,
                isLocked: true,
                xMm: 0,
                yMm: 0,
                scale: 1.0,
                visible: true,
              });
            }
          }
        }}
        floorWidthMm={floorData.widthMm}
        floorHeightMm={floorData.heightMm}
        onOpenScaleCalibration={() => {
          setIsPlanManagerOpen(false);
          setIsRulerActive(true);
        }}
      />

      {/* 3b. Modal de Personnalisation des Dimensions de la Zone & du Site */}
      <FloorDimensionsModal
        isOpen={isDimensionsModalOpen}
        onClose={() => setIsDimensionsModalOpen(false)}
        currentWidthMm={floorData.widthMm}
        currentHeightMm={floorData.heightMm}
        siteName={sites.find((s) => s.id === activeSiteId)?.name ?? "Site Principal"}
        sites={sites}
        activeSiteId={activeSiteId}
        onSelectSite={(id) => {
          setActiveSiteId(id);
          handleFocusSite(id);
        }}
        onApplyDimensions={(w, h) => {
          setFloorData({ widthMm: w, heightMm: h });
          fitFloor(w, h, window.innerWidth, window.innerHeight);
        }}
      />

      {/* 4. Centre d'Administration & Paramètres DSI Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        nodes={nodes}
        racks={racks}
        onUpdateNodeProperties={handleUpdateNodeProperties}
        onImportDiscoveredDevice={handleImportDiscoveredDevice}
        onAutoDeployDiscoveredTopology={handleAutoDeployDiscoveredTopology}
        vlanStyles={vlanStyles}
        onUpdateVlanStyle={handleUpdateVlanStyle}
        onResetVlanStyles={handleResetVlanStyles}
        onFullSystemReset={handleFullSystemReset}
        onUnlinkAllAdUsers={handleUnlinkAllAdUsers}
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
                  <h3 className="text-xs font-bold text-slate-100">
                    Personnalisation des Tracés par VLAN
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Couleurs, motifs (plein, pointillés, tirets) et épaisseurs
                  </p>
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

      {/* 6. Menu Contextuel au Clic Droit sur un Équipement */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md p-1.5 min-w-[220px] animate-in fade-in zoom-in-95 duration-100 font-sans"
          style={{
            left: Math.min(
              contextMenu.x,
              (typeof window !== "undefined" ? window.innerWidth : 1200) - 230
            ),
            top: Math.min(
              contextMenu.y,
              (typeof window !== "undefined" ? window.innerHeight : 800) - 160
            ),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <span>
                {contextMenu.node.type === "DESK"
                  ? "🖥️"
                  : contextMenu.node.type === "PATCH_PANEL"
                    ? "⚡"
                    : "🔌"}
              </span>
              <span className="truncate">{contextMenu.node.name}</span>
            </div>
            <button
              onClick={() => setContextMenu(null)}
              className="text-slate-500 hover:text-slate-300 text-xs p-0.5"
            >
              ✕
            </button>
          </div>

          <div className="py-1 space-y-0.5 text-xs">
            <button
              onClick={() => {
                handleSelectNode(contextMenu.node);
                setContextMenu(null);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition"
            >
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span>Inspecter / Modifier</span>
            </button>

            {contextMenu.node.type === "WALL_OUTLET" && contextMenu.node.attachedToDeskId && (
              <button
                onClick={() => {
                  handleToggleAttachment(contextMenu.node.id, undefined);
                  setContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 flex items-center gap-2 transition"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Détacher du bureau</span>
              </button>
            )}

            <button
              onClick={() => handleDeleteNode(contextMenu.node.id)}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-950/60 flex items-center gap-2 transition font-medium group"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
              <span>Supprimer cet équipement</span>
            </button>
          </div>
        </div>
      )}
      {/* 7. Modal de Confirmation de Transfert de Liaison (prise déjà rattachée à un autre bureau) */}
      {pendingAttachmentTransfer &&
        (() => {
          const currentDesk = nodes.find((n) => n.id === pendingAttachmentTransfer.currentDeskId);
          const targetDesk = nodes.find((n) => n.id === pendingAttachmentTransfer.targetDeskId);
          const outlet = nodes.find((n) => n.id === pendingAttachmentTransfer.outletId);

          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-slate-950 border border-amber-700/60 rounded-xl w-[420px] max-w-[95vw] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Transférer la liaison ?</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Cette prise est déjà rattachée à un bureau.
                    </p>
                  </div>
                </div>

                <div className="py-4 space-y-2 text-xs text-slate-300">
                  <p>
                    <strong className="text-slate-100">{outlet?.name ?? "Prise"}</strong> est
                    actuellement rattachée à{" "}
                    <strong className="text-amber-400">
                      {currentDesk?.name ?? "Bureau actuel"}
                    </strong>
                    .
                  </p>
                  <p>
                    Souhaitez-vous la transférer sur{" "}
                    <strong className="text-blue-400">
                      {targetDesk?.name ?? "Nouveau bureau"}
                    </strong>{" "}
                    ?
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setPendingAttachmentTransfer(null)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                  >
                    Conserver le rattachement actuel
                  </button>
                  <button
                    onClick={() => {
                      const transfer = pendingAttachmentTransfer;
                      setNodes((prev) =>
                        prev.map((n) =>
                          n.id === transfer.outletId
                            ? {
                                ...n,
                                attachedToDeskId: transfer.targetDeskId,
                                attachedSeatIndex: transfer.seatIdx,
                              }
                            : n
                        )
                      );
                      setPendingAttachmentTransfer(null);
                    }}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition"
                  >
                    Transférer la prise
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
