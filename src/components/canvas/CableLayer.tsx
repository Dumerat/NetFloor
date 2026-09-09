"use client";

import type { FC } from "react";
import { Line, Group } from "react-konva";

export interface CableData {
  id: string;
  cableType: "HORIZONTAL_RUN" | "PATCH_CORD" | "BACKBONE_TRUNK";
  category: string;
  lengthMm: number;
  colorCode?: string;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
}

interface CableLayerProps {
  cables: CableData[];
  activeCircuitCableIds?: Set<string>;
}

export const CableLayer: FC<CableLayerProps> = ({
  cables,
  activeCircuitCableIds = new Set(),
}) => {
  return (
    <Group>
      {cables.map((cable) => {
        const isHighlighted = activeCircuitCableIds.has(cable.id);

        if (cable.cableType === "HORIZONTAL_RUN") {
          // Routage orthogonal en faux-plafond (chemin de câbles à Y = 10000mm)
          const corridorY = 10000;
          const points = [
            cable.sourcePos.x,
            cable.sourcePos.y,
            cable.sourcePos.x,
            corridorY,
            cable.targetPos.x,
            corridorY,
            cable.targetPos.x,
            cable.targetPos.y,
          ];

          return (
            <Line
              key={cable.id}
              points={points}
              stroke={isHighlighted ? (cable.colorCode ?? "#60a5fa") : (cable.colorCode ?? "rgba(59, 130, 246, 0.65)")}
              strokeWidth={isHighlighted ? 80 : 45}
              shadowColor={isHighlighted ? (cable.colorCode ?? "#3b82f6") : "transparent"}
              shadowBlur={isHighlighted ? 150 : 0}
              lineCap="round"
              lineJoin="round"
            />
          );
        }

        if (cable.cableType === "PATCH_CORD") {
          // Cordon souple en baie
          const dy = cable.targetPos.y - cable.sourcePos.y;
          const points = [
            cable.sourcePos.x,
            cable.sourcePos.y,
            cable.sourcePos.x - 300,
            cable.sourcePos.y + dy / 2,
            cable.targetPos.x,
            cable.targetPos.y,
          ];

          return (
            <Line
              key={cable.id}
              points={points}
              bezier={true}
              stroke={isHighlighted ? "#facc15" : "rgba(234, 179, 8, 0.85)"}
              strokeWidth={isHighlighted ? 60 : 35}
              shadowColor={isHighlighted ? "#eab308" : "transparent"}
              shadowBlur={isHighlighted ? 120 : 0}
              lineCap="round"
            />
          );
        }

        return null;
      })}
    </Group>
  );
};
