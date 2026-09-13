"use client";

import type { FC } from "react";
import { Rect, Line, Text, Group } from "react-konva";

interface GridLayerProps {
  floorWidthMm: number;
  floorHeightMm: number;
  scale: number;
}

export const GridLayer: FC<GridLayerProps> = ({
  floorWidthMm,
  floorHeightMm,
  scale,
}) => {
  // Ajustement dynamique du pas de grille selon le zoom :
  // De 50m pour les vues macro très dézoomées à 1m en vue rapprochée
  const stepMm =
    scale < 0.001
      ? 50000 // 50m (très grand campus multi-bâtiments)
      : scale < 0.003
      ? 20000 // 20m
      : scale < 0.006
      ? 10000 // 10m
      : scale < 0.01
      ? 5000  // 5m
      : scale < 0.03
      ? 2000  // 2m
      : 1000; // 1m

  const verticalLines: number[] = [];
  for (let x = 0; x <= floorWidthMm; x += stepMm) {
    verticalLines.push(x);
  }

  const horizontalLines: number[] = [];
  for (let y = 0; y <= floorHeightMm; y += stepMm) {
    horizontalLines.push(y);
  }

  return (
    <Group listening={false}>
      {/* Fond sombre de l'étage */}
      <Rect
        x={0}
        y={0}
        width={floorWidthMm}
        height={floorHeightMm}
        fill="#090d16"
        stroke="#1e293b"
        strokeWidth={100}
      />

      {/* Lignes verticales de grille */}
      {verticalLines.map((x) => (
        <Line
          key={`v-${x}`}
          points={[x, 0, x, floorHeightMm]}
          stroke="rgba(30, 41, 59, 0.45)"
          strokeWidth={x % 5000 === 0 ? 35 : 15}
        />
      ))}

      {/* Lignes horizontales de grille */}
      {horizontalLines.map((y) => (
        <Line
          key={`h-${y}`}
          points={[0, y, floorWidthMm, y]}
          stroke="rgba(30, 41, 59, 0.45)"
          strokeWidth={y % 5000 === 0 ? 35 : 15}
        />
      ))}

      {/* Repères métriques */}
      <Text
        x={500}
        y={500}
        text="0,0 (Origine Bâtiment)"
        fontSize={350}
        fontFamily="monospace"
        fill="#64748b"
      />
      <Text
        x={floorWidthMm - 8000}
        y={floorHeightMm - 1000}
        text={`${floorWidthMm / 1000}m x ${floorHeightMm / 1000}m`}
        fontSize={400}
        fontFamily="monospace"
        fill="#64748b"
      />
    </Group>
  );
};
