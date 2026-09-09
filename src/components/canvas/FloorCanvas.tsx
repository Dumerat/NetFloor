"use client";

import { useRef, useEffect, useState, type FC } from "react";
import { Stage, Layer } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import { useCameraStore } from "@/engine/spatial/useCameraStore";
import { snapToGrid } from "@/engine/spatial/snapping";
import { GridLayer } from "./GridLayer";
import { CableLayer, CableData } from "./CableLayer";
import { EquipmentLayer, RackDisplay, NodeDisplay } from "./EquipmentLayer";

interface FloorCanvasProps {
  floorWidthMm: number;
  floorHeightMm: number;
  racks: RackDisplay[];
  nodes: NodeDisplay[];
  cables: CableData[];
  selectedOutletId?: string | null | undefined;
  selectedNodeId?: string | null | undefined;
  activeViewMode?: "ALL" | "HR" | "MAINTENANCE" | "NETWORK" | undefined;
  onSelectOutlet: (node: NodeDisplay) => void;
  onSelectNode?: ((node: NodeDisplay) => void) | undefined;
  onNodePositionChange?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onNodeDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onRackDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
}

export const FloorCanvas: FC<FloorCanvasProps> = ({
  floorWidthMm,
  floorHeightMm,
  racks,
  nodes,
  cables,
  selectedOutletId,
  selectedNodeId,
  activeViewMode = "ALL",
  onSelectOutlet,
  onSelectNode,
  onNodePositionChange,
  onNodeDragMove,
  onRackDragMove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewport, setViewport, zoomAt, fitFloor, gridConfig } = useCameraStore();
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        setDimensions({ width: w, height: h });
        fitFloor(floorWidthMm, floorHeightMm, w, h);
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
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

  // Magnétisme à la fin du drag d'un équipement
  const handleNodeMoveEnd = (id: string, newPos: { x: number; y: number }) => {
    const snapResult = snapToGrid(newPos, gridConfig);
    onNodePositionChange?.(id, snapResult.point);
  };

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

        {/* Calque 2 : Câblage physique dynamique (listening={false} pour 0 overhead hit-canvas) */}
        <Layer listening={false}>
          <CableLayer cables={cables} />
        </Layer>

        {/* Calque 3 : Équipements interactifs (Baies, Prises, Bureaux) */}
        <Layer>
          <EquipmentLayer
            racks={racks}
            nodes={nodes}
            selectedOutletId={selectedOutletId}
            selectedNodeId={selectedNodeId}
            activeViewMode={activeViewMode}
            onSelectOutlet={onSelectOutlet}
            onSelectNode={onSelectNode}
            onNodeMoveEnd={handleNodeMoveEnd}
            onNodeDragMove={onNodeDragMove}
            onRackDragMove={onRackDragMove}
          />
        </Layer>
      </Stage>
    </div>
  );
};
