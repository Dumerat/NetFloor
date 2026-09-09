"use client";

import type { FC } from "react";
import { Line, Group, Circle, Rect, Text } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";

export type CableFilterMode =
  | "ALL"
  | "BACKBONE_ONLY"
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
  waypoints?: { x: number; y: number }[] | undefined;
}

interface CableLayerProps {
  cables: CableData[];
  activeCircuitCableIds?: Set<string> | undefined;
  activeViewMode?: "ALL" | "HR" | "TECH" | "MAINTENANCE" | "NETWORK" | undefined;
  cableFilterMode?: CableFilterMode | undefined;
  selectedNodeId?: string | null | undefined;
  onWaypointChange?: ((cableId: string, waypointIndex: number, newPos: { x: number; y: number }) => void) | undefined;
}

export const CableLayer: FC<CableLayerProps> = ({
  cables,
  activeCircuitCableIds = new Set(),
  activeViewMode = "ALL",
  cableFilterMode = "ALL",
  selectedNodeId,
  onWaypointChange,
}) => {
  if (activeViewMode === "HR") {
    return null;
  }

  // Filtrage dynamique des câbles
  const filteredCables = cables.filter((cable) => {
    if (cableFilterMode === "ALL") return true;
    if (cableFilterMode === "BACKBONE_ONLY") {
      return cable.cableType === "BACKBONE_TRUNK" || cable.cableType === "PATCH_CORD";
    }
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
        const isHighlighted =
          activeCircuitCableIds.has(cable.id) ||
          (selectedNodeId &&
            (cable.sourceNodeId === selectedNodeId || cable.targetNodeId === selectedNodeId));

        const isCableSelected = Boolean(
          selectedNodeId &&
            (cable.sourceNodeId === selectedNodeId || cable.targetNodeId === selectedNodeId)
        );

        // Détermination des points du tracé :
        // S'il y a des waypoints personnalisés, on trace une spline courbe fluide passant par les waypoints.
        let points: number[] = [];
        const waypoints = cable.waypoints && cable.waypoints.length > 0
          ? cable.waypoints
          : [
              // Point de courbure médian par défaut (contourne le centre du plateau)
              {
                x: (cable.sourcePos.x + cable.targetPos.x) / 2,
                y: Math.min(cable.sourcePos.y, cable.targetPos.y) - 1800,
              },
            ];

        if (cable.cableType === "HORIZONTAL_RUN") {
          // Tracé fluide via waypoints
          points = [cable.sourcePos.x, cable.sourcePos.y];
          waypoints.forEach((wp) => {
            points.push(wp.x, wp.y);
          });
          points.push(cable.targetPos.x, cable.targetPos.y);
        } else {
          // Cordon de baie ou patch cord
          const dy = cable.targetPos.y - cable.sourcePos.y;
          points = [
            cable.sourcePos.x,
            cable.sourcePos.y,
            cable.sourcePos.x - 300,
            cable.sourcePos.y + dy / 2,
            cable.targetPos.x,
            cable.targetPos.y,
          ];
        }

        // Couleur selon le rôle / VLAN
        const strokeColor = isHighlighted
          ? "#38bdf8"
          : cable.vlanId === 30
          ? "rgba(192, 132, 252, 0.85)" // Violet VoIP
          : cable.vlanId === 40
          ? "rgba(251, 191, 36, 0.85)" // Ambre Print
          : cable.vlanId === 50
          ? "rgba(129, 140, 248, 0.85)" // Indigo Wi-Fi
          : "rgba(59, 130, 246, 0.75)"; // Bleu Data

        return (
          <Group key={cable.id}>
            {/* Ligne principale du câble avec tension spline pour éviter les angles droits coupants */}
            <Line
              points={points}
              tension={cable.cableType === "HORIZONTAL_RUN" ? 0.35 : 0.45}
              stroke={strokeColor}
              strokeWidth={isHighlighted ? 70 : 40}
              lineCap="round"
              lineJoin="round"
              {...(isHighlighted ? { shadowColor: "#38bdf8", shadowBlur: 25 } : { shadowBlur: 0 })}
              listening={false}
            />

            {/* Poignées interactives de courbure (Visibles quand le câble/nœud est sélectionné) */}
            {isCableSelected &&
              cable.cableType === "HORIZONTAL_RUN" &&
              waypoints.map((wp, wpIdx) => (
                <Group
                  key={`handle-${cable.id}-${wpIdx}`}
                  x={wp.x}
                  y={wp.y}
                  draggable={true}
                  onDragMove={(e: KonvaEventObject<DragEvent>) => {
                    e.cancelBubble = true;
                    onWaypointChange?.(cable.id, wpIdx, {
                      x: Math.round(e.target.x()),
                      y: Math.round(e.target.y()),
                    });
                  }}
                  onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                    e.cancelBubble = true;
                    onWaypointChange?.(cable.id, wpIdx, {
                      x: Math.round(e.target.x()),
                      y: Math.round(e.target.y()),
                    });
                  }}
                >
                  {/* Halo de préhension */}
                  <Circle radius={60} fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth={6} />
                  {/* Pastille de contrôle au centre */}
                  <Circle radius={25} fill="#ffffff" stroke="#0284c7" strokeWidth={6} />
                  {/* Bulle d'indication */}
                  <Group y={-70} listening={false}>
                    <Rect
                      x={-90}
                      y={-25}
                      width={180}
                      height={50}
                      fill="rgba(15, 23, 42, 0.9)"
                      stroke="#38bdf8"
                      strokeWidth={4}
                      cornerRadius={10}
                    />
                    <Text
                      x={-80}
                      y={-12}
                      width={160}
                      text="Courbure câble"
                      fontSize={20}
                      fontFamily="sans-serif"
                      fontStyle="bold"
                      fill="#ffffff"
                      align="center"
                    />
                  </Group>
                </Group>
              ))}
          </Group>
        );
      })}
    </Group>
  );
};
