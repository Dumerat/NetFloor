"use client";

import { useRef, useEffect, useState, useCallback, type FC } from "react";
import { Stage, Layer } from "react-konva";
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
  activeViewMode?: "ALL" | "HR" | "TECH" | "MAINTENANCE" | "NETWORK" | undefined;
  cableFilterMode?: CableFilterMode | undefined;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  showAllLabels?: boolean | undefined;
  onSelectOutlet: (node: NodeDisplay) => void;
  onSelectNode?: ((node: NodeDisplay) => void) | undefined;
  onNodeContextMenu?: ((node: NodeDisplay, pos: { x: number; y: number }) => void) | undefined;
  onNodePositionChange?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onNodeDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onRackDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onPivotChange?: ((cableId: string, newPivot: { x: number; y: number }) => void) | undefined;
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
  activeViewMode = "ALL",
  cableFilterMode = "ALL",
  vlanStyles,
  showAllLabels = false,
  onSelectOutlet,
  onSelectNode,
  onNodeContextMenu,
  onNodePositionChange,
  onNodeDragMove,
  onRackDragMove,
  onPivotChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewport, setViewport, zoomAt, fitFloor, gridConfig } = useCameraStore();
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  const hasInitialFitRef = useRef(false);

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
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-950 cursor-grab active:cursor-grabbing">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        x={viewport.panX}
        y={viewport.panY}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        draggable={true} // Pan natif GPU Konva 60 FPS
        onDragEnd={handleStageDragEnd}
        onWheel={handleWheel}
      >
        {/* Calque 1 : Grille Métrique (listening={false} pour 0 overhead hit-canvas) */}
        <Layer listening={false}>
          <GridLayer
            floorWidthMm={floorWidthMm}
            floorHeightMm={floorHeightMm}
            scale={viewport.scale}
          />
        </Layer>

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
            activeViewMode={activeViewMode}
            showAllLabels={showAllLabels}
            vlanStyles={vlanStyles}
            onSelectOutlet={onSelectOutlet}
            onSelectNode={onSelectNode}
            onNodeContextMenu={onNodeContextMenu}
            onNodeMoveEnd={handleNodeMoveEnd}
            onNodeDragMove={onNodeDragMove}
            onRackDragMove={onRackDragMove}
          />
        </Layer>
      </Stage>
    </div>
  );
};
