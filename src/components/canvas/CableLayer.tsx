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

interface SegmentHandle {
  id: string;
  cableId: string;
  waypointIndex: number;
  axis: "X" | "Y"; // "X": segment vertical déplaçable en X; "Y": segment horizontal déplaçable en Y
  midX: number;
  midY: number;
  length: number;
}

const CableLayerComponent: FC<CableLayerProps> = ({
  cables,
  activeCircuitCableIds = new Set(),
  activeViewMode = "ALL",
  cableFilterMode = "ALL",
  selectedNodeId,
  vlanStyles,
  onSelectNodeId,
  onWaypointChange,
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

        // Construction du tracé orthogonal strict
        let points: number[] = [];
        const handles: SegmentHandle[] = [];

        if (cable.cableType === "HORIZONTAL_RUN") {
          const wps = cable.waypoints && cable.waypoints.length > 0 ? cable.waypoints : [];

          // 1. Génération des sommets orthogonaux
          points = [cable.sourcePos.x, cable.sourcePos.y];
          for (let i = 0; i < wps.length; i++) {
            const wp = wps[i]!;
            const lastX = points[points.length - 2] ?? cable.sourcePos.x;
            const lastY = points[points.length - 1] ?? cable.sourcePos.y;

            if (Math.abs(lastX - wp.x) > 1 && Math.abs(lastY - wp.y) > 1) {
              points.push(lastX, wp.y);
            }
            points.push(wp.x, wp.y);
          }

          const lastX = points[points.length - 2] ?? cable.sourcePos.x;
          const lastY = points[points.length - 1] ?? cable.sourcePos.y;
          if (Math.abs(lastX - cable.targetPos.x) > 1 && Math.abs(lastY - cable.targetPos.y) > 1) {
            points.push(lastX, cable.targetPos.y);
          }
          points.push(cable.targetPos.x, cable.targetPos.y);

          // Nettoyage des doublons et alignements colinéaires
          points = simplifyOrthogonalPoints(points);

          // 2. Création des poignées de contrôle mono-axe sur les segments intermédiaires
          // Chaque waypoint stocké correspond à un coude ou segment modifiable
          for (let wpIdx = 0; wpIdx < wps.length; wpIdx++) {
            const wp = wps[wpIdx]!;
            // Déterminer l'orientation du segment associé :
            // wpIdx === 0 : contrôle la hauteur du couloir (segment horizontal Y) ou le décalage X
            // Pour 3 waypoints standard :
            // wp[0]: hauteur de raccordement / couloir horizontal (déplacement Y)
            // wp[1]: position de la chute technique verticale (déplacement X)
            // wp[2]: hauteur d'arrivée baie (déplacement Y)
            const isVerticalSegment = wpIdx === 1 || (wps.length === 2 && wpIdx === 1);
            const axis: "X" | "Y" = isVerticalSegment ? "X" : "Y";

            handles.push({
              id: `handle-${cable.id}-${wpIdx}`,
              cableId: cable.id,
              waypointIndex: wpIdx,
              axis,
              midX: wp.x,
              midY: wp.y,
              length: 60,
            });
          }
        } else {
          // Liaison directe droite
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

            {/* Poignées de contrôle éditables avec contrainte mono-axe 90° (dragBoundFunc) */}
            {cable.cableType === "HORIZONTAL_RUN" &&
              handles.map((h) => {
                return (
                  <Group
                    key={h.id}
                    x={h.midX}
                    y={h.midY}
                    draggable={true}
                    // Règle 2 : dragBoundFunc contraint sur un axe unique selon l'orientation
                    dragBoundFunc={function (this: any, pos) {
                      const groupNode = this as any;
                      const stage = groupNode.getStage();
                      if (!stage) return pos;

                      // Transformation dans le repère local absolu pour préserver la position axiale fixe
                      const transform = groupNode.getParent().getAbsoluteTransform().copy().invert();
                      const localTarget = transform.point(pos);

                      if (h.axis === "X") {
                        // Segment vertical : se déplace UNIQUEMENT sur l'axe X (Y reste fixé à h.midY)
                        const constrainedLocal = { x: localTarget.x, y: h.midY };
                        return groupNode.getParent().getAbsoluteTransform().point(constrainedLocal);
                      } else {
                        // Segment horizontal : se déplace UNIQUEMENT sur l'axe Y (X reste fixé à h.midX)
                        const constrainedLocal = { x: h.midX, y: localTarget.y };
                        return groupNode.getParent().getAbsoluteTransform().point(constrainedLocal);
                      }
                    }}
                    onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
                      const stage = e.target.getStage();
                      if (stage) {
                        stage.container().style.cursor = h.axis === "X" ? "col-resize" : "row-resize";
                      }
                    }}
                    onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = "default";
                    }}
                    onDragStart={(e: KonvaEventObject<DragEvent>) => {
                      const stage = e.target.getStage();
                      if (stage) {
                        stage.container().style.cursor = h.axis === "X" ? "col-resize" : "row-resize";
                      }
                      e.cancelBubble = true;
                    }}
                    onDragMove={(e: KonvaEventObject<DragEvent>) => {
                      e.cancelBubble = true;
                      const newX = h.axis === "X" ? Math.round(e.target.x()) : h.midX;
                      const newY = h.axis === "Y" ? Math.round(e.target.y()) : h.midY;
                      onWaypointChange?.(cable.id, h.waypointIndex, { x: newX, y: newY });
                    }}
                    onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                      const stage = e.target.getStage();
                      if (stage) {
                        stage.container().style.cursor = h.axis === "X" ? "col-resize" : "row-resize";
                      }
                      e.cancelBubble = true;
                      const newX = h.axis === "X" ? Math.round(e.target.x()) : h.midX;
                      const newY = h.axis === "Y" ? Math.round(e.target.y()) : h.midY;
                      onWaypointChange?.(cable.id, h.waypointIndex, { x: newX, y: newY });
                    }}
                  >
                    {/* Zone de préhension tactile invisible et sans saut */}
                    <Circle radius={32} fill="transparent" />
                  </Group>
                );
              })}
          </Group>
        );
      })}
    </Group>
  );
};

export const CableLayer = memo(CableLayerComponent);
