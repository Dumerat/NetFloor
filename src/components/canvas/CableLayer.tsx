"use client";

import { useState, type FC } from "react";
import { Line, Group, Circle, Rect, Text } from "react-konva";
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
  onWaypointChange?: ((cableId: string, waypointIndex: number, newPos: { x: number; y: number }) => void) | undefined;
  onAddWaypoint?: ((cableId: string) => void) | undefined;
  onRemoveWaypoint?: ((cableId: string) => void) | undefined;
}

export const CableLayer: FC<CableLayerProps> = ({
  cables,
  activeCircuitCableIds = new Set(),
  activeViewMode = "ALL",
  cableFilterMode = "ALL",
  selectedNodeId,
  vlanStyles,
  onSelectNodeId,
  onWaypointChange,
  onAddWaypoint,
  onRemoveWaypoint,
}) => {
  const [hoveredCableId, setHoveredCableId] = useState<string | null>(null);

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

        const isCableSelected = Boolean(
          selectedNodeId &&
            (cable.sourceNodeId === selectedNodeId || cable.targetNodeId === selectedNodeId)
        );

        // Détermination des points du tracé orthogonal 100% droit (Manhattan routing à angles droits 90°)
        let points: number[] = [];
        const waypoints =
          cable.waypoints && cable.waypoints.length > 0
            ? cable.waypoints
            : [{ x: Math.round((cable.sourcePos.x + cable.targetPos.x) / 2), y: cable.sourcePos.y }];

        if (cable.cableType === "HORIZONTAL_RUN") {
          // Tracé Manhattan orthogonal strict à angles droits 90° traversant tous les coudes/waypoints déplaçables
          points = [cable.sourcePos.x, cable.sourcePos.y];
          let curX = cable.sourcePos.x;

          for (let i = 0; i < waypoints.length; i++) {
            const wp = waypoints[i];
            if (!wp) continue;
            // Montée/descente verticale vers l'axe Y du coude
            points.push(curX, wp.y);
            // Déplacement horizontal rectiligne vers l'axe X du coude
            points.push(wp.x, wp.y);
            curX = wp.x;
          }

          // Descente verticale finale vers la hauteur d'insertion en baie
          points.push(curX, cable.targetPos.y);
          // Raccordement horizontal direct dans la baie
          points.push(cable.targetPos.x, cable.targetPos.y);
        } else {
          // Liaison droite directe
          points = [
            cable.sourcePos.x,
            cable.sourcePos.y,
            cable.targetPos.x,
            cable.targetPos.y,
          ];
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
              tension={0} // Strictement zéro courbure : traits 100% droits à 90°
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              {...(dash ? { dash } : {})}
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

            {/* Boîtiers de dérivation / Poignées interactives pour CHAQUE coude du câble */}
            {cable.cableType === "HORIZONTAL_RUN" &&
              waypoints.map((wp, wpIdx) => {
                const isThisWpHovered =
                  hoveredCableId === `${cable.id}-${wpIdx}` || hoveredCableId === cable.id;
                const showWpDetailed = isCableSelected || isThisWpHovered;
                const isLastWp = wpIdx === waypoints.length - 1;

                return (
                  <Group
                    key={`wp-${cable.id}-${wpIdx}`}
                    x={wp.x}
                    y={wp.y}
                    draggable={true}
                    onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = "grab";
                      setHoveredCableId(`${cable.id}-${wpIdx}`);
                    }}
                    onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = "default";
                      setHoveredCableId((prev) => (prev === `${cable.id}-${wpIdx}` ? null : prev));
                    }}
                    onDragStart={(e: KonvaEventObject<DragEvent>) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = "grabbing";
                      e.cancelBubble = true;
                    }}
                    onDragMove={(e: KonvaEventObject<DragEvent>) => {
                      e.cancelBubble = true;
                      onWaypointChange?.(cable.id, wpIdx, {
                        x: Math.round(e.target.x()),
                        y: Math.round(e.target.y()),
                      });
                    }}
                    onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = "grab";
                      e.cancelBubble = true;
                      onWaypointChange?.(cable.id, wpIdx, {
                        x: Math.round(e.target.x()),
                        y: Math.round(e.target.y()),
                      });
                    }}
                  >
                    {/* Halo de préhension actif */}
                    {showWpDetailed && (
                      <Circle radius={60} fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth={5} />
                    )}

                    {/* Boîtier de dérivation au coude orthogonal */}
                    <Rect
                      x={showWpDetailed ? -22 : -14}
                      y={showWpDetailed ? -22 : -14}
                      width={showWpDetailed ? 44 : 28}
                      height={showWpDetailed ? 44 : 28}
                      fill={showWpDetailed ? "#ffffff" : "rgba(30, 41, 59, 0.95)"}
                      stroke={showWpDetailed ? "#0284c7" : "#38bdf8"}
                      strokeWidth={showWpDetailed ? 6 : 4}
                      cornerRadius={6}
                    />

                    {/* Réticule d'alignement */}
                    <Line
                      points={showWpDetailed ? [-14, 0, 14, 0] : [-8, 0, 8, 0]}
                      stroke={showWpDetailed ? "#0284c7" : "#38bdf8"}
                      strokeWidth={showWpDetailed ? 4 : 2}
                      listening={false}
                    />
                    <Line
                      points={showWpDetailed ? [0, -14, 0, 14] : [0, -8, 0, 8]}
                      stroke={showWpDetailed ? "#0284c7" : "#38bdf8"}
                      strokeWidth={showWpDetailed ? 4 : 2}
                      listening={false}
                    />

                    {/* Bulle d'indication avec coordonnées métriques précises (sans mention superflue) */}
                    {showWpDetailed && (
                      <Group y={-65} listening={false}>
                        <Rect
                          x={-130}
                          y={-24}
                          width={260}
                          height={48}
                          fill="rgba(15, 23, 42, 0.96)"
                          stroke="#38bdf8"
                          strokeWidth={4}
                          cornerRadius={10}
                        />
                        <Text
                          x={-120}
                          y={-11}
                          width={240}
                          text={`📐 Coude ${waypoints.length > 1 ? `#${wpIdx + 1} ` : ""}: ${(wp.y / 1000).toFixed(1)}m • ${(wp.x / 1000).toFixed(1)}m`}
                          fontSize={18}
                          fontFamily="monospace"
                          fontStyle="bold"
                          fill="#ffffff"
                          align="center"
                        />
                      </Group>
                    )}

                    {/* Mini-boutons d'ajout / retrait de coudes supplémentaires sur ce câble */}
                    {isCableSelected && isLastWp && (
                      <Group y={showWpDetailed ? -120 : -55}>
                        {/* Bouton + Coude */}
                        <Group
                          x={waypoints.length > 1 ? -60 : 0}
                          onClick={(e: KonvaEventObject<MouseEvent>) => {
                            e.cancelBubble = true;
                            onAddWaypoint?.(cable.id);
                          }}
                          onTap={(e: KonvaEventObject<TouchEvent>) => {
                            e.cancelBubble = true;
                            onAddWaypoint?.(cable.id);
                          }}
                          onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = "pointer";
                          }}
                          onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = "default";
                          }}
                        >
                          <Rect
                            x={-55}
                            y={-18}
                            width={110}
                            height={36}
                            fill="#0284c7"
                            stroke="#38bdf8"
                            strokeWidth={2}
                            cornerRadius={8}
                          />
                          <Text
                            x={-50}
                            y={-9}
                            width={100}
                            text="+ Coude"
                            fontSize={16}
                            fontFamily="sans-serif"
                            fontStyle="bold"
                            fill="#ffffff"
                            align="center"
                            listening={false}
                          />
                        </Group>

                        {/* Bouton - Coude */}
                        {waypoints.length > 1 && (
                          <Group
                            x={60}
                            onClick={(e: KonvaEventObject<MouseEvent>) => {
                              e.cancelBubble = true;
                              onRemoveWaypoint?.(cable.id);
                            }}
                            onTap={(e: KonvaEventObject<TouchEvent>) => {
                              e.cancelBubble = true;
                              onRemoveWaypoint?.(cable.id);
                            }}
                            onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
                              const stage = e.target.getStage();
                              if (stage) stage.container().style.cursor = "pointer";
                            }}
                            onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                              const stage = e.target.getStage();
                              if (stage) stage.container().style.cursor = "default";
                            }}
                          >
                            <Rect
                              x={-55}
                              y={-18}
                              width={110}
                              height={36}
                              fill="#1e293b"
                              stroke="#64748b"
                              strokeWidth={2}
                              cornerRadius={8}
                            />
                            <Text
                              x={-50}
                              y={-9}
                              width={100}
                              text="- Coude"
                              fontSize={16}
                              fontFamily="sans-serif"
                              fontStyle="bold"
                              fill="#f87171"
                              align="center"
                              listening={false}
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
      })}
    </Group>
  );
};
