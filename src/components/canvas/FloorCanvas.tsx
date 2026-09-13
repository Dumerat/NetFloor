"use client";

import { useRef, useEffect, useState, useCallback, type FC } from "react";
import { Stage, Layer, Rect } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import { useCameraStore } from "@/engine/spatial/useCameraStore";
import {
  snapToGrid,
  snapToNodeAlignments,
  snapToOutletDocking,
} from "@/engine/spatial/snapping";
import { GridLayer } from "./GridLayer";
import { ZoneLayer } from "./ZoneLayer";
import { CableLayer, CableData, CableFilterMode } from "./CableLayer";
import { EquipmentLayer, RackDisplay, NodeDisplay } from "./EquipmentLayer";
import { BackgroundPlanLayer, BackgroundPlanLayerProps } from "./BackgroundPlanLayer";
import {
  ScaleCalibrationLayer,
  ScaleCalibrationModal,
  CalibrationPoint,
} from "./ScaleCalibrationTool";
import {
  MeasurementRulerLayer,
  MeasurementRulerOverlay,
} from "./MeasurementRulerTool";
import { VlanStyle } from "@/data/vlanStyles";
import { FloorZone } from "@/types/zones";

interface FloorCanvasProps {
  floorWidthMm: number;
  floorHeightMm: number;
  zones?: FloorZone[] | undefined;
  selectedZoneId?: string | null | undefined;
  onSelectZone?: ((zone: FloorZone) => void) | undefined;
  onZoneMoveEnd?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  racks: RackDisplay[];
  nodes: NodeDisplay[];
  cables: CableData[];
  selectedOutletId?: string | null | undefined;
  selectedNodeId?: string | null | undefined;
  selectedNodeIds?: string[] | undefined;
  onSelectNodeToggle?: ((node: NodeDisplay, isShift: boolean) => void) | undefined;
  onSelectNodeIds?: ((ids: string[]) => void) | undefined;
  onGroupNodeMoveEnd?: ((nodeIds: string[], delta: { deltaX: number; deltaY: number }) => void) | undefined;
  activeViewMode?: "ALL" | "HR" | "TECH" | "MAINTENANCE" | "NETWORK" | undefined;
  cableFilterMode?: CableFilterMode | undefined;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  showAllLabels?: boolean | undefined;
  onDeselectAll?: (() => void) | undefined;
  onSelectOutlet: (node: NodeDisplay) => void;
  onSelectNode?: ((node: NodeDisplay) => void) | undefined;
  onNodeContextMenu?: ((node: NodeDisplay, pos: { x: number; y: number }) => void) | undefined;
  onNodePositionChange?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onNodeDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onRackDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onPivotChange?: ((cableId: string, newPivot: { x: number; y: number }) => void) | undefined;
  backgroundPlan?: BackgroundPlanLayerProps | undefined;
  onBackgroundPlanPositionChange?: ((pos: { x: number; y: number }) => void) | undefined;
  isCalibratingScale?: boolean | undefined;
  onCloseCalibration?: (() => void) | undefined;
  onCalibrateScale?: ((res: { pixelsPerMeter: number; realMeters: number; distPx: number; distWorldMm: number }) => void) | undefined;
  isRulerActive?: boolean | undefined;
  onCloseRuler?: (() => void) | undefined;
}

export const FloorCanvas: FC<FloorCanvasProps> = ({
  floorWidthMm,
  floorHeightMm,
  zones = [],
  selectedZoneId,
  onSelectZone,
  onZoneMoveEnd,
  racks,
  nodes,
  cables,
  selectedOutletId,
  selectedNodeId,
  selectedNodeIds,
  onSelectNodeToggle,
  onSelectNodeIds,
  onGroupNodeMoveEnd,
  activeViewMode = "ALL",
  cableFilterMode = "ALL",
  vlanStyles,
  showAllLabels = false,
  onDeselectAll,
  onSelectOutlet,
  onSelectNode,
  onNodeContextMenu,
  onNodePositionChange,
  onNodeDragMove,
  onRackDragMove,
  onPivotChange,
  backgroundPlan,
  onBackgroundPlanPositionChange,
  isCalibratingScale,
  onCloseCalibration,
  onCalibrateScale,
  isRulerActive,
  onCloseRuler,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewport, setViewport, zoomAt, fitFloor, gridConfig } = useCameraStore();
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const isSelectingRef = useRef(false);
  const lastMarqueeEndTimeRef = useRef<number>(0);
  const isMarqueeJustEnded = useCallback(() => {
    return Date.now() - lastMarqueeEndTimeRef.current < 250;
  }, []);

  const hasInitialFitRef = useRef(false);

  // État de l'Outil Étalonnage Métrique
  const [calibPoint1, setCalibPoint1] = useState<CalibrationPoint | null>(null);
  const [calibPoint2, setCalibPoint2] = useState<CalibrationPoint | null>(null);
  const [calibHoverPoint, setCalibHoverPoint] = useState<CalibrationPoint | null>(null);
  const [isCalibModalOpen, setIsCalibModalOpen] = useState(false);

  useEffect(() => {
    if (!isCalibratingScale) {
      setCalibPoint1(null);
      setCalibPoint2(null);
      setCalibHoverPoint(null);
      setIsCalibModalOpen(false);
    }
  }, [isCalibratingScale]);

  const handleCalibPointSelect = useCallback((pt: CalibrationPoint) => {
    if (!calibPoint1) {
      setCalibPoint1(pt);
    } else if (!calibPoint2) {
      setCalibPoint2(pt);
      setIsCalibModalOpen(true);
    }
  }, [calibPoint1, calibPoint2]);

  const handleCalibHoverMove = useCallback((pt: CalibrationPoint) => {
    setCalibHoverPoint(pt);
  }, []);

  const activeCalibSecondPt = calibPoint2 || calibHoverPoint;
  const calibDistPx =
    calibPoint1 && activeCalibSecondPt
      ? Math.hypot(
          activeCalibSecondPt.screenX - calibPoint1.screenX,
          activeCalibSecondPt.screenY - calibPoint1.screenY
        )
      : 0;

  const handleValidateCalib = useCallback(
    (realMeters: number) => {
      if (!calibPoint1 || !calibPoint2) return;
      const dxPx = calibPoint2.screenX - calibPoint1.screenX;
      const dyPx = calibPoint2.screenY - calibPoint1.screenY;
      const distPx = Math.hypot(dxPx, dyPx);

      const dxMm = calibPoint2.worldX - calibPoint1.worldX;
      const dyMm = calibPoint2.worldY - calibPoint1.worldY;
      const distWorldMm = Math.hypot(dxMm, dyMm);

      const pixelsPerMeter = distPx / realMeters;

      onCalibrateScale?.({
        pixelsPerMeter,
        realMeters,
        distPx,
        distWorldMm,
      });

      setCalibPoint1(null);
      setCalibPoint2(null);
      setCalibHoverPoint(null);
      setIsCalibModalOpen(false);
      onCloseCalibration?.();
    },
    [calibPoint1, calibPoint2, onCalibrateScale, onCloseCalibration]
  );

  const handleCloseCalib = useCallback(() => {
    setCalibPoint1(null);
    setCalibPoint2(null);
    setCalibHoverPoint(null);
    setIsCalibModalOpen(false);
    onCloseCalibration?.();
  }, [onCloseCalibration]);

  // État de l'Outil Règle Permanente
  const [rulerPointA, setRulerPointA] = useState<{ x: number; y: number } | null>(null);
  const [rulerPointB, setRulerPointB] = useState<{ x: number; y: number } | null>(null);
  const [rulerMousePos, setRulerMousePos] = useState<{ x: number; y: number } | null>(null);
  const [rulerIsCompleted, setRulerIsCompleted] = useState(false);

  useEffect(() => {
    if (!isRulerActive) {
      setRulerPointA(null);
      setRulerPointB(null);
      setRulerMousePos(null);
      setRulerIsCompleted(false);
    }
  }, [isRulerActive]);

  const handleRulerPointSelect = useCallback(
    (pt: { x: number; y: number }) => {
      if (!rulerPointA) {
        setRulerPointA(pt);
      } else if (!rulerIsCompleted) {
        setRulerPointB(pt);
        setRulerIsCompleted(true);
      }
    },
    [rulerPointA, rulerIsCompleted]
  );

  const handleRulerHoverMove = useCallback((pt: { x: number; y: number }) => {
    setRulerMousePos(pt);
  }, []);

  const handleResetRuler = useCallback(() => {
    setRulerPointA(null);
    setRulerPointB(null);
    setRulerMousePos(null);
    setRulerIsCompleted(false);
  }, []);

  const effectiveRulerEnd = rulerIsCompleted ? rulerPointB : rulerMousePos ?? rulerPointB;
  let rulerDistanceMm = 0;
  let rulerAngleDeg = 0;
  if (rulerPointA && effectiveRulerEnd) {
    rulerDistanceMm = Math.hypot(effectiveRulerEnd.x - rulerPointA.x, effectiveRulerEnd.y - rulerPointA.y);
    const rad = Math.atan2(effectiveRulerEnd.y - rulerPointA.y, effectiveRulerEnd.x - rulerPointA.x);
    rulerAngleDeg = Math.round((rad * 180) / Math.PI);
  }
  const rulerDistanceM = (rulerDistanceMm / 1000).toFixed(2);

  // Marquee selection handlers
  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (isCalibratingScale || isRulerActive) return;
    const stage = e.target.getStage();
    if (!stage) return;

    if (e.evt.shiftKey) {
      stage.draggable(false);
      isSelectingRef.current = true;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldX = (pointer.x - viewport.panX) / viewport.scale;
      const worldY = (pointer.y - viewport.panY) / viewport.scale;
      setSelectionBox({
        startX: worldX,
        startY: worldY,
        currentX: worldX,
        currentY: worldY,
      });
    }
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!isSelectingRef.current) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const worldX = (pointer.x - viewport.panX) / viewport.scale;
    const worldY = (pointer.y - viewport.panY) / viewport.scale;
    setSelectionBox((prev) => (prev ? { ...prev, currentX: worldX, currentY: worldY } : null));
  };

  const handleStageMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) {
      stage.draggable(true);
    }
    if (!isSelectingRef.current || !selectionBox) {
      isSelectingRef.current = false;
      return;
    }
    isSelectingRef.current = false;

    const minX = Math.min(selectionBox.startX, selectionBox.currentX);
    const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
    const minY = Math.min(selectionBox.startY, selectionBox.currentY);
    const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

    setSelectionBox(null);

    // Si la boîte de sélection fait au moins 15mm de côté
    if (Math.abs(maxX - minX) > 15 || Math.abs(maxY - minY) > 15) {
      lastMarqueeEndTimeRef.current = Date.now();

      const getNodeAABB = (n: NodeDisplay) => {
        if (n.type === "DESK") {
          const w = n.widthMm ?? 1600;
          const h = n.heightMm ?? 800;
          const rotDeg = n.rotationDeg ?? 0;
          if (rotDeg === 0) {
            return { minX: n.xMm, maxX: n.xMm + w, minY: n.yMm, maxY: n.yMm + h };
          }
          const rad = (rotDeg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const corners = [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: 0, y: h },
          ];
          let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity;
          for (const c of corners) {
            const wx = n.xMm + c.x * cos - c.y * sin;
            const wy = n.yMm + c.x * sin + c.y * cos;
            if (wx < cMinX) cMinX = wx;
            if (wx > cMaxX) cMaxX = wx;
            if (wy < cMinY) cMinY = wy;
            if (wy > cMaxY) cMaxY = wy;
          }
          return { minX: cMinX, maxX: cMaxX, minY: cMinY, maxY: cMaxY };
        }

        if (n.widthMm && n.heightMm && n.widthMm > 0 && n.heightMm > 0) {
          return {
            minX: n.xMm,
            maxX: n.xMm + n.widthMm,
            minY: n.yMm,
            maxY: n.yMm + n.heightMm,
          };
        }

        const radius = 250;
        return {
          minX: n.xMm - radius,
          maxX: n.xMm + radius,
          minY: n.yMm - radius,
          maxY: n.yMm + radius,
        };
      };

      const getRackAABB = (r: RackDisplay) => {
        const rWidth = r.widthMm ?? 800;
        const totalU = r.uHeight || 42;
        const minDepthForU = 320 + totalU * 36;
        const rDepth = Math.max(r.depthMm ?? 1000, minDepthForU);
        return {
          minX: r.xMm,
          maxX: r.xMm + rWidth,
          minY: r.yMm,
          maxY: r.yMm + rDepth,
        };
      };

      const enclosedNodeIds = nodes
        .filter((n) => {
          const box = getNodeAABB(n);
          return minX <= box.maxX && maxX >= box.minX && minY <= box.maxY && maxY >= box.minY;
        })
        .map((n) => n.id);

      const enclosedRackIds = racks
        .filter((r) => {
          const box = getRackAABB(r);
          return minX <= box.maxX && maxX >= box.minX && minY <= box.maxY && maxY >= box.minY;
        })
        .map((r) => r.id);

      const allEnclosedIds = [...enclosedNodeIds, ...enclosedRackIds];

      if (allEnclosedIds.length > 0) {
        onSelectNodeIds?.(allEnclosedIds);
      } else {
        onDeselectAll?.();
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const updateDimensions = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      setDimensions({ width: w, height: h });
      if (!hasInitialFitRef.current) {
        hasInitialFitRef.current = true;
        fitFloor(floorWidthMm, floorHeightMm, w, h);
      }
    };

    const initialW = containerRef.current.clientWidth;
    const initialH = containerRef.current.clientHeight;
    if (initialW > 0 && initialH > 0) {
      updateDimensions(initialW, initialH);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateDimensions(width, height);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [floorWidthMm, floorHeightMm, fitFloor]);

  // Fin du déplacement du Stage (Pan natif Konva sans lag React)
  const handleStageDragEnd = (e: KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      setViewport({
        panX: e.target.x(),
        panY: e.target.y(),
      });
    }
  };

  // Zoom Molette centré (Zoom-to-Pointer)
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.15;
    const factor = e.evt.deltaY < 0 ? scaleBy : 1 / scaleBy;
    zoomAt(pointer, factor);
  };

  // Magnétisme d'accostage à la fin du déplacement (Bureaux bord-à-bord & Prises collées)
  const handleNodeMoveEnd = useCallback((id: string, newPos: { x: number; y: number }) => {
    const node = nodes.find((n) => n.id === id);

    // 1. Accostage intelligent bord-à-bord (côte-à-côte ou face-à-face) pour les bureaux
    if (node && node.type === "DESK") {
      const nodeW = node.widthMm ?? 1600;
      const nodeH = node.heightMm ?? 800;
      const draggedBox = {
        minX: newPos.x,
        minY: newPos.y,
        maxX: newPos.x + nodeW,
        maxY: newPos.y + nodeH,
        width: nodeW,
        height: nodeH,
      };

      const otherDeskBoxes = nodes
        .filter((n) => n.type === "DESK" && n.id !== id)
        .map((d) => {
          const w = d.widthMm ?? 1600;
          const h = d.heightMm ?? 800;
          return {
            minX: d.xMm,
            minY: d.yMm,
            maxX: d.xMm + w,
            maxY: d.yMm + h,
            width: w,
            height: h,
          };
        });

      if (otherDeskBoxes.length > 0) {
        const alignResult = snapToNodeAlignments(draggedBox, otherDeskBoxes, 200);
        if (alignResult.hasSnappedX || alignResult.hasSnappedY) {
          onNodePositionChange?.(id, {
            x: alignResult.snappedX,
            y: alignResult.snappedY,
          });
          return;
        }
      }
    }

    // 2. Accostage magnétique direct entre prises RJ45 (docking côte-à-côte)
    if (node && node.type === "WALL_OUTLET") {
      const otherOutlets = nodes
        .filter((n) => n.type === "WALL_OUTLET" && n.id !== id)
        .map((o) => ({ id: o.id, point: { x: o.xMm, y: o.yMm } }));

      const dockResult = snapToOutletDocking(newPos, otherOutlets, 300, 260);
      if (dockResult.dockedWithId) {
        onNodePositionChange?.(id, dockResult.snappedPoint);
        return;
      }
    }

    // 3. Magnétisme standard sur la grille métrique
    const snapResult = snapToGrid(newPos, gridConfig);
    onNodePositionChange?.(id, snapResult.point);
  }, [nodes, gridConfig, onNodePositionChange]);

  // Déplacement libre du pivot orthogonal du câble
  const handlePivotMove = useCallback((
    cableId: string,
    newPivot: { x: number; y: number }
  ) => {
    onPivotChange?.(cableId, newPivot);
  }, [onPivotChange]);

  const handleSelectNodeId = useCallback((id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (node) {
      if (node.type === "WALL_OUTLET") onSelectOutlet(node);
      else onSelectNode?.(node);
    }
  }, [nodes, onSelectOutlet, onSelectNode]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden bg-slate-950 ${
        isCalibratingScale || isRulerActive ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        x={viewport.panX}
        y={viewport.panY}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        draggable={!isCalibratingScale && !isRulerActive} // Pan natif GPU Konva 60 FPS (désactivé pendant la mesure/calibration)
        onDragEnd={handleStageDragEnd}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onClick={(e) => {
          if (isMarqueeJustEnded()) return;
          // Si on clique directement sur le fond vide du Stage (ou sur la grille)
          if (e.target === e.target.getStage()) {
            onDeselectAll?.();
          }
        }}
        onTap={(e) => {
          if (isMarqueeJustEnded()) return;
          if (e.target === e.target.getStage()) {
            onDeselectAll?.();
          }
        }}
      >
        {/* Calque 1 : Grille Métrique (listening={false} pour 0 overhead hit-canvas) */}
        <Layer listening={false}>
          <GridLayer
            floorWidthMm={floorWidthMm}
            floorHeightMm={floorHeightMm}
            scale={viewport.scale}
          />
        </Layer>

        {/* Calque 1.2 : Fond de Plan Architectural Multi-plans (Image PNG/JPG ou PDF matriciel) */}
        {backgroundPlan && (backgroundPlan.imageUrl || (backgroundPlan.plans && backgroundPlan.plans.length > 0)) && (
          <Layer>
            <BackgroundPlanLayer
              imageUrl={backgroundPlan.imageUrl}
              plans={backgroundPlan.plans}
              opacity={backgroundPlan.opacity ?? 0.7}
              isLocked={backgroundPlan.isLocked ?? true}
              xMm={backgroundPlan.xMm ?? 0}
              yMm={backgroundPlan.yMm ?? 0}
              scale={backgroundPlan.scale ?? 1.0}
              widthMm={backgroundPlan.widthMm}
              heightMm={backgroundPlan.heightMm}
              visible={backgroundPlan.visible ?? true}
              onPositionChange={onBackgroundPlanPositionChange}
            />
          </Layer>
        )}

        {/* Calque 1.5 : Zones et Délimitations des Services RH / DSI / Pôles */}
        <Layer>
          <ZoneLayer
            zones={zones}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
            onZoneMoveEnd={onZoneMoveEnd}
          />
        </Layer>

        {/* Calque 2 : Câblage physique dynamique avec pivot orthogonal unique */}
        <Layer>
          <CableLayer
            cables={cables}
            activeViewMode={activeViewMode}
            cableFilterMode={cableFilterMode}
            selectedNodeId={selectedNodeId ?? selectedOutletId}
            vlanStyles={vlanStyles}
            onSelectNodeId={handleSelectNodeId}
            onPivotChange={handlePivotMove}
          />
        </Layer>

        {/* Calque 3 : Équipements interactifs (Baies, Prises, Bureaux) */}
        <Layer>
          <EquipmentLayer
            racks={racks}
            nodes={nodes}
            selectedOutletId={selectedOutletId}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={selectedNodeIds}
            onSelectNodeToggle={onSelectNodeToggle}
            onGroupNodeMoveEnd={onGroupNodeMoveEnd}
            activeViewMode={activeViewMode}
            showAllLabels={showAllLabels}
            vlanStyles={vlanStyles}
            onSelectOutlet={onSelectOutlet}
            onSelectNode={onSelectNode}
            onNodeContextMenu={onNodeContextMenu}
            onNodeMoveEnd={handleNodeMoveEnd}
            onNodeDragMove={onNodeDragMove}
            onRackDragMove={onRackDragMove}
            isMarqueeJustEnded={isMarqueeJustEnded}
          />
        </Layer>

        {/* Calque 3.5 : Boîte de Sélection Rectangulaire (Marquee Shift+Drag) */}
        {selectionBox && (
          <Layer listening={false}>
            <Rect
              x={Math.min(selectionBox.startX, selectionBox.currentX)}
              y={Math.min(selectionBox.startY, selectionBox.currentY)}
              width={Math.abs(selectionBox.currentX - selectionBox.startX)}
              height={Math.abs(selectionBox.currentY - selectionBox.startY)}
              fill="rgba(56, 189, 248, 0.15)"
              stroke="#38bdf8"
              strokeWidth={2 / viewport.scale}
              dash={[6 / viewport.scale, 4 / viewport.scale]}
            />
          </Layer>
        )}

        {/* Calque 4 : Outil d'Étalonnage Métrique à 2 Points (Shapes Konva pures) */}
        {isCalibratingScale && (
          <Layer>
            <ScaleCalibrationLayer
              floorWidthMm={floorWidthMm}
              floorHeightMm={floorHeightMm}
              point1={calibPoint1}
              point2={calibPoint2}
              hoverPoint={calibHoverPoint}
              scale={viewport.scale}
              isModalOpen={isCalibModalOpen}
              onPointSelect={handleCalibPointSelect}
              onHoverMove={handleCalibHoverMove}
            />
          </Layer>
        )}

        {/* Calque 5 : Outil Règle Permanente de Mesure Métrique (Shapes Konva pures) */}
        {isRulerActive && (
          <Layer>
            <MeasurementRulerLayer
              floorWidthMm={floorWidthMm}
              floorHeightMm={floorHeightMm}
              pointA={rulerPointA}
              pointB={rulerPointB}
              mousePos={rulerMousePos}
              isCompleted={rulerIsCompleted}
              scale={viewport.scale}
              onPointSelect={handleRulerPointSelect}
              onHoverMove={handleRulerHoverMove}
            />
          </Layer>
        )}
      </Stage>

      {/* Modale HTML5 d'Étalonnage Métrique (rendue dans le DOM en dehors de Stage Konva) */}
      {isCalibratingScale && isCalibModalOpen && (
        <ScaleCalibrationModal
          isOpen={isCalibModalOpen}
          distPx={calibDistPx}
          onClose={handleCloseCalib}
          onValidate={handleValidateCalib}
        />
      )}

      {/* Barre d'Outils Flottante HTML5 de la Règle (rendue dans le DOM en dehors de Stage Konva) */}
      {isRulerActive && (
        <MeasurementRulerOverlay
          distanceM={rulerDistanceM}
          angleDeg={rulerAngleDeg}
          isCompleted={rulerIsCompleted}
          hasPointA={!!rulerPointA}
          onReset={handleResetRuler}
          onClose={() => onCloseRuler?.()}
          onApplyScaleCalibration={
            onCalibrateScale
              ? (meters) => {
                  const measuredPx = rulerDistanceMm * viewport.scale;
                  onCalibrateScale({
                    pixelsPerMeter: measuredPx / meters,
                    realMeters: meters,
                    distPx: measuredPx,
                    distWorldMm: rulerDistanceMm,
                  });
                  onCloseRuler?.();
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
