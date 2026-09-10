"use client";

import { memo, type FC } from "react";
import { Line, Group, Circle } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import {
  VlanStyle,
  DEFAULT_VLAN_STYLES,
  getKonvaStrokeConfig,
} from "@/data/vlanStyles";

export type CableFilterMode =
  | "ALL"
  | "HORIZONTAL_ONLY"
  | "VLAN_20"
  | "VLAN_30"
  | "VLAN_40"
  | "VLAN_50"
  | "SELECTED_ONLY";

export interface CableData {
  id: string;
  cableType: "HORIZONTAL_RUN" | "PATCH_CORD" | "BACKBONE_TRUNK";
  category: string;
  lengthMm: number;
  colorCode?: string | undefined;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
  vlanId?: number | undefined;
  sourceNodeId?: string | undefined;
  targetNodeId?: string | undefined;
  pivot?: { x: number; y: number } | undefined;
  waypoints?: { x: number; y: number }[] | undefined;
}

interface CableLayerProps {
  cables: CableData[];
  activeCircuitCableIds?: Set<string> | undefined;
  activeViewMode?: "ALL" | "HR" | "TECH" | "MAINTENANCE" | "NETWORK" | undefined;
  cableFilterMode?: CableFilterMode | undefined;
  selectedNodeId?: string | null | undefined;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  onSelectNodeId?: ((nodeId: string) => void) | undefined;
  onPivotChange?: ((cableId: string, newPivot: { x: number; y: number }) => void) | undefined;
}

/**
 * Nettoie les points orthogonaux pour éliminer tout repli à 180° sur le même axe
 * et fusionner les segments colinéaires consécutifs.
 */
function simplifyOrthogonalPoints(raw: number[]): number[] {
  if (raw.length <= 4) return raw;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const x = raw[i];
    const y = raw[i + 1];
    if (x === undefined || y === undefined) continue;
    const prev = pts[pts.length - 1];
    if (prev && Math.abs(prev.x - x) < 1 && Math.abs(prev.y - y) < 1) {
      continue;
    }
    pts.push({ x, y });
  }

  // Élimination des points intermédiaires colinéaires (même droite horizontale ou verticale)
  let changed = true;
  while (changed && pts.length >= 3) {
    changed = false;
    for (let i = 0; i < pts.length - 2; i++) {
      const p0 = pts[i]!;
      const p1 = pts[i + 1]!;
      const p2 = pts[i + 2]!;

      // Colinéaire en X (vertical)
      if (Math.abs(p0.x - p1.x) < 1 && Math.abs(p1.x - p2.x) < 1) {
        pts.splice(i + 1, 1);
        changed = true;
        break;
      }
      // Colinéaire en Y (horizontal)
      if (Math.abs(p0.y - p1.y) < 1 && Math.abs(p1.y - p2.y) < 1) {
        pts.splice(i + 1, 1);
        changed = true;
        break;
      }
    }
  }

  const result: number[] = [];
  for (const p of pts) {
    result.push(p.x, p.y);
  }
  return result;
}

const CableLayerComponent: FC<CableLayerProps> = ({
  cables,
  activeCircuitCableIds = new Set(),
  activeViewMode = "ALL",
  cableFilterMode = "ALL",
  selectedNodeId,
  vlanStyles,
  onSelectNodeId,
  onPivotChange,
}) => {
  if (activeViewMode === "HR") {
    return null;
  }

  // Filtrage dynamique des câbles
  const filteredCables = cables.filter((cable) => {
    if (cableFilterMode === "ALL") return true;
    if (cableFilterMode === "HORIZONTAL_ONLY") {
      return cable.cableType === "HORIZONTAL_RUN";
    }
    if (cableFilterMode === "VLAN_20") return cable.vlanId === 20;
    if (cableFilterMode === "VLAN_30") return cable.vlanId === 30;
    if (cableFilterMode === "VLAN_40") return cable.vlanId === 40;
    if (cableFilterMode === "VLAN_50") return cable.vlanId === 50;
    if (cableFilterMode === "SELECTED_ONLY") {
      if (!selectedNodeId) return true;
      return (
        cable.sourceNodeId === selectedNodeId ||
        cable.targetNodeId === selectedNodeId ||
        activeCircuitCableIds.has(cable.id)
      );
    }
    return true;
  });

  return (
    <Group>
      {filteredCables.map((cable) => {
        const isHighlighted = Boolean(
          activeCircuitCableIds.has(cable.id) ||
          (selectedNodeId &&
            (cable.sourceNodeId === selectedNodeId || cable.targetNodeId === selectedNodeId))
        );

        const Ax = cable.sourcePos.x;
        const Ay = cable.sourcePos.y;
        const Bx = cable.targetPos.x;
        const By = cable.targetPos.y;

        // 1. Source de Vérité Unique : coordonnées absolues du pivot
        const pivot = cable.pivot ?? {
          x: Math.round((Ax + Bx) / 2),
          y: By,
        };

        // 2. Tracé Orthogonal Strict calculé dynamiquement : [Ax, Ay, Ax, pivot.y, pivot.x, pivot.y, pivot.x, By, Bx, By]
        let points: number[] = [];
        if (cable.cableType === "HORIZONTAL_RUN") {
          points = simplifyOrthogonalPoints([
            Ax, Ay,
            Ax, pivot.y,
            pivot.x, pivot.y,
            pivot.x, By,
            Bx, By,
          ]);
        } else {
          points = [Ax, Ay, Bx, By];
        }

        // Configuration du style personnalisé du câble (couleur, tirets/pointillés, épaisseur)
        const vlanStyle = cable.vlanId
          ? vlanStyles?.[cable.vlanId] ?? DEFAULT_VLAN_STYLES[cable.vlanId]
          : undefined;
        const { strokeColor, strokeWidth, dash } = getKonvaStrokeConfig(vlanStyle, isHighlighted);

        return (
          <Group key={cable.id}>
            {/* Ligne principale orthogonale droite (tension=0, angles droits nets) */}
            <Line
              id={`cable-line-${cable.id}`}
              points={points}
              tension={0}
              stroke={isHighlighted ? "#38bdf8" : strokeColor}
              strokeWidth={isHighlighted ? strokeWidth + 2 : strokeWidth}
              {...(dash ? { dash } : {})}
              hitStrokeWidth={40}
              lineCap="round"
              lineJoin="round"
              onClick={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                if (cable.sourceNodeId) {
                  onSelectNodeId?.(cable.sourceNodeId);
                }
              }}
              onTap={(e: KonvaEventObject<TouchEvent>) => {
                e.cancelBubble = true;
                if (cable.sourceNodeId) {
                  onSelectNodeId?.(cable.sourceNodeId);
                }
              }}
              onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "pointer";
              }}
              onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "default";
              }}
            />

            {/* 3. Poignée de Pivot Unique : Konva.Circle draggable déplaçable librement en 2D */}
            {cable.cableType === "HORIZONTAL_RUN" && (
              <Circle
                id={`pivot-${cable.id}`}
                x={pivot.x}
                y={pivot.y}
                radius={24}
                fill="transparent"
                hitStrokeWidth={20}
                draggable={true}
                onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "grab";
                }}
                onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "default";
                }}
                onDragStart={(e: KonvaEventObject<DragEvent>) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "grabbing";
                  e.cancelBubble = true;
                }}
                onDragMove={(e: KonvaEventObject<DragEvent>) => {
                  e.cancelBubble = true;
                  onPivotChange?.(cable.id, {
                    x: Math.round(e.target.x()),
                    y: Math.round(e.target.y()),
                  });
                }}
                onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "grab";
                  e.cancelBubble = true;
                  onPivotChange?.(cable.id, {
                    x: Math.round(e.target.x()),
                    y: Math.round(e.target.y()),
                  });
                }}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
};

export const CableLayer = memo(CableLayerComponent);
