"use client";

import { useState, type FC } from "react";
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
  onSelectNodeId?: ((nodeId: string) => void) | undefined;
  onWaypointChange?: ((cableId: string, waypointIndex: number, newPos: { x: number; y: number }) => void) | undefined;
}

export const CableLayer: FC<CableLayerProps> = ({
  cables,
  activeCircuitCableIds = new Set(),
  activeViewMode = "ALL",
  cableFilterMode = "ALL",
  selectedNodeId,
  onSelectNodeId,
  onWaypointChange,
}) => {
  const [hoveredCableId, setHoveredCableId] = useState<string | null>(null);

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

        // Détermination des points du tracé orthogonal 100% droit (Manhattan routing à angles droits 90°)
        let points: number[] = [];
        const waypoints =
          cable.waypoints && cable.waypoints.length > 0
            ? cable.waypoints
            : [
                {
                  x: 15500,
                  y: 9000,
                },
              ];

        const primaryWp = waypoints[0] ?? { x: 15500, y: 9000 };

        if (cable.cableType === "HORIZONTAL_RUN") {
          // Tracé architectural orthogonal strict (4 segments droits à 90°) :
          // 1. Montée/descente verticale de la prise vers le couloir faux-plafond (Y = primaryWp.y)
          // 2. Circulation horizontale rectiligne dans le chemin de câbles jusqu'à la colonne technique (X = primaryWp.x)
          // 3. Descente verticale dans la colonne technique jusqu'à la hauteur de la baie (Y = cable.targetPos.y)
          // 4. Raccordement horizontal direct dans la baie
          points = [
            cable.sourcePos.x,
            cable.sourcePos.y,
            cable.sourcePos.x,
            primaryWp.y,
            primaryWp.x,
            primaryWp.y,
            primaryWp.x,
            cable.targetPos.y,
            cable.targetPos.x,
            cable.targetPos.y,
          ];
        } else if (cable.cableType === "PATCH_CORD") {
          // Cordon de brassage interne en baie (forme orthogonale en U propre)
          points = [
            cable.sourcePos.x,
            cable.sourcePos.y,
            cable.sourcePos.x - 220,
            cable.sourcePos.y,
            cable.sourcePos.x - 220,
            cable.targetPos.y,
            cable.targetPos.x,
            cable.targetPos.y,
          ];
        } else {
          // Liaison Backbone Trunk droite
          points = [
            cable.sourcePos.x,
            cable.sourcePos.y,
            cable.targetPos.x,
            cable.targetPos.y,
          ];
        }

        // Couleur selon le rôle / VLAN
        const strokeColor = isHighlighted
          ? "#38bdf8"
          : cable.vlanId === 30
          ? "rgba(192, 132, 252, 0.9)" // Violet VoIP
          : cable.vlanId === 40
          ? "rgba(251, 191, 36, 0.9)" // Ambre Print
          : cable.vlanId === 50
          ? "rgba(129, 140, 248, 0.9)" // Indigo Wi-Fi
          : "rgba(59, 130, 246, 0.85)"; // Bleu Data

        const isHovered = hoveredCableId === cable.id;
        const showDetailedHandle = isCableSelected || isHovered;

        return (
          <Group key={cable.id}>
            {/* Ligne principale orthogonale droite (tension=0, angles droits nets) */}
            <Line
              points={points}
              tension={0} // Strictement zéro courbure : traits 100% droits à 90°
              stroke={strokeColor}
              strokeWidth={isHighlighted ? 70 : 40}
              hitStrokeWidth={120} // Très facile à cliquer / survoler
              lineCap="round"
              lineJoin="round"
              {...(isHighlighted ? { shadowColor: "#38bdf8", shadowBlur: 20 } : { shadowBlur: 0 })}
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
                setHoveredCableId(cable.id);
              }}
              onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "default";
                setHoveredCableId((prev) => (prev === cable.id ? null : prev));
              }}
            />

            {/* Boîtier de dérivation / Poignée interactive de réglage du couloir et de la colonne */}
            {cable.cableType === "HORIZONTAL_RUN" && (
              <Group
                x={primaryWp.x}
                y={primaryWp.y}
                draggable={true}
                onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "grab";
                  setHoveredCableId(cable.id);
                }}
                onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "default";
                  setHoveredCableId((prev) => (prev === cable.id ? null : prev));
                }}
                onDragStart={(e: KonvaEventObject<DragEvent>) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "grabbing";
                  e.cancelBubble = true;
                }}
                onDragMove={(e: KonvaEventObject<DragEvent>) => {
                  e.cancelBubble = true;
                  onWaypointChange?.(cable.id, 0, {
                    x: Math.round(e.target.x()),
                    y: Math.round(e.target.y()),
                  });
                }}
                onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "grab";
                  e.cancelBubble = true;
                  onWaypointChange?.(cable.id, 0, {
                    x: Math.round(e.target.x()),
                    y: Math.round(e.target.y()),
                  });
                }}
              >
                {/* Halo étendu actif si sélectionné ou survolé */}
                {showDetailedHandle && (
                  <Circle radius={60} fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth={5} />
                )}

                {/* Boîtier de dérivation / pastille de contrôle au coude orthogonal */}
                <Rect
                  x={showDetailedHandle ? -22 : -14}
                  y={showDetailedHandle ? -22 : -14}
                  width={showDetailedHandle ? 44 : 28}
                  height={showDetailedHandle ? 44 : 28}
                  fill={showDetailedHandle ? "#ffffff" : "rgba(30, 41, 59, 0.95)"}
                  stroke={showDetailedHandle ? "#0284c7" : "#38bdf8"}
                  strokeWidth={showDetailedHandle ? 6 : 4}
                  cornerRadius={6}
                />

                {/* Réticule d'alignement */}
                <Line
                  points={showDetailedHandle ? [-14, 0, 14, 0] : [-8, 0, 8, 0]}
                  stroke={showDetailedHandle ? "#0284c7" : "#38bdf8"}
                  strokeWidth={showDetailedHandle ? 4 : 2}
                  listening={false}
                />
                <Line
                  points={showDetailedHandle ? [0, -14, 0, 14] : [0, -8, 0, 8]}
                  stroke={showDetailedHandle ? "#0284c7" : "#38bdf8"}
                  strokeWidth={showDetailedHandle ? 4 : 2}
                  listening={false}
                />

                {/* Bulle d'indication avec coordonnées d'alignement métrique (visible sur sélection ou survol) */}
                {showDetailedHandle && (
                  <Group y={-65} listening={false}>
                    <Rect
                      x={-115}
                      y={-24}
                      width={230}
                      height={48}
                      fill="rgba(15, 23, 42, 0.96)"
                      stroke="#38bdf8"
                      strokeWidth={4}
                      cornerRadius={10}
                    />
                    <Text
                      x={-105}
                      y={-11}
                      width={210}
                      text={`📐 Axe : ${(primaryWp.y / 1000).toFixed(1)}m • ${(primaryWp.x / 1000).toFixed(1)}m`}
                      fontSize={20}
                      fontFamily="monospace"
                      fontStyle="bold"
                      fill="#ffffff"
                      align="center"
                    />
                  </Group>
                )}
              </Group>
            )}
          </Group>
        );
      })}
    </Group>
  );
};
