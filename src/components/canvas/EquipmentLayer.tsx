"use client";

import { useRef, useState, memo, type FC } from "react";
import { Group, Rect, Text, Line, Circle } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import { VlanStyle, DEFAULT_VLAN_STYLES } from "@/data/vlanStyles";

export type RackDeviceType =
  "SWITCH" | "PATCH_PANEL" | "ROUTER" | "SERVER" | "PDU" | "FIREWALL" | "FIBER_TRAY";

export type RackDeviceBrand =
  "ARUBA" | "ZYXEL" | "ZYXEL_NEBULA" | "CISCO" | "UBIQUITI" | "FORTINET" | "GENERIC";

export interface RackDeviceItem {
  id: string;
  name: string; // ex: "SW-ARUBA-2930F-24G", "SW-ZYXEL-GS1920-24HP"
  slotU: number; // ex: 24 (U24)
  uSize?: number | undefined; // défaut 1U
  deviceType: RackDeviceType;
  brand: RackDeviceBrand;
  model?: string | undefined;
  ipAddress?: string | undefined;
  macAddress?: string | undefined;
  portsCount?: number | undefined;
  poeBudgetW?: number | undefined;
  status: "ONLINE" | "OFFLINE" | "SYNCED";
  cloudManaged?: boolean | undefined;
  cloudManagedBy?:
    | "ARUBA_CENTRAL"
    | "NEBULA_CLOUD"
    | "MERAKI"
    | "FORTICLOUD"
    | "SNMP_LOCAL"
    | "MANUAL"
    | undefined;
}

export interface RackDisplay {
  id: string;
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
  uHeight: number;
  devices?: RackDeviceItem[] | undefined;
  siteId?: string | undefined;
}

export type OutletRole = "DATA" | "VOIP" | "WIFI" | "PRINTER" | "CAMERA" | "GENERIC";

export type PoeMode = "NONE" | "POE" | "POE_PLUS" | "POE_PLUS_PLUS";

export type NodeSubType =
  | "DESK_SOLO"
  | "DESK_COMPACT"
  | "DESK_EXECUTIVE"
  | "BENCH_DOUBLE"
  | "BENCH_QUAD"
  | "MEETING_TABLE"
  | "WALL_OUTLET"
  | "GENERIC_PORT"
  | "FLOOR_BOX"
  | "WIFI_AP"
  | "PRINTER_STATION"
  | "CAMERA_IP"
  | "RACK_42U"
  | "RACK_18U";

export interface DeskSeatOccupant {
  seatIndex: number;
  seatLabel?: string | undefined;
  userId?: string | undefined;
  fullName?: string | undefined;
  department?: string | undefined;
}

export function getDeskSeatCount(subType?: NodeSubType): number {
  if (subType === "BENCH_QUAD") return 4;
  if (subType === "BENCH_DOUBLE") return 2;
  return 1;
}

export function getDefaultSeatLabels(subType?: NodeSubType): string[] {
  if (subType === "BENCH_QUAD") {
    return [
      "Place 1 (Haut-Gauche)",
      "Place 2 (Haut-Droite)",
      "Place 3 (Bas-Gauche)",
      "Place 4 (Bas-Droite)",
    ];
  }
  if (subType === "BENCH_DOUBLE") {
    return ["Place 1 (Face Nord)", "Place 2 (Face Sud)"];
  }
  return ["Place Unique"];
}

export interface StackedPortItem {
  portIndex: number; // 0, 1, 2, ... jusqu'à 7 (8 ports max)
  portLabel: string; // ex: "RJ45-1", "Port 1"
  outletRole: OutletRole; // "DATA", "VOIP", "PRINTER", "WIFI"
  assignedPerson?: string | undefined;
  assignedUserId?: string | undefined;
  attachedSeatIndex?: number | undefined;
  ipAddress?: string | undefined;
  macAddress?: string | undefined;
  pingStatus?: "ONLINE" | "OFFLINE" | "DEGRADED" | undefined;
  pingLatencyMs?: number | undefined;
  portId?: string | undefined;
  vlanId?: number | undefined;
  poeMode?: PoeMode | undefined;
  isPatched?: boolean | undefined;
  connectedRackId?: string | undefined;
  connectedSwitchId?: string | undefined;
  connectedSwitchPort?: string | undefined;
}

export interface NodeDisplay {
  id: string;
  type: "WALL_OUTLET" | "PATCH_PANEL" | "SWITCH" | "DESK";
  name: string;
  xMm: number;
  yMm: number;
  widthMm?: number | undefined;
  heightMm?: number | undefined;
  rotationDeg?: number | undefined;
  subType?: NodeSubType | undefined;
  portId?: string | undefined;
  attachedToDeskId?: string | undefined;
  outletRole?: OutletRole | undefined;
  assignedPerson?: string | undefined;
  assignedUserId?: string | undefined;
  department?: string | undefined;
  description?: string | undefined;
  chairPosition?: "BOTTOM" | "TOP" | "LEFT" | "RIGHT" | "NONE" | undefined;
  seats?: DeskSeatOccupant[] | undefined;
  attachedSeatIndex?: number | undefined;
  ipAddress?: string | undefined;
  macAddress?: string | undefined;
  pingStatus?: "ONLINE" | "OFFLINE" | "DEGRADED" | undefined;
  pingLatencyMs?: number | undefined;
  stackedPorts?: StackedPortItem[] | undefined;
  vlanId?: number | undefined;
  poeMode?: PoeMode | undefined;
  customEmote?: string | undefined;
  portCount?: number | undefined;
  labelPosition?: "TOP" | "BOTTOM" | "LEFT" | "RIGHT" | undefined;
  isPatched?: boolean | undefined;
  connectedRackId?: string | undefined;
  connectedSwitchId?: string | undefined;
  connectedSwitchPort?: string | undefined;
  devices?: RackDeviceItem[] | undefined;
  uHeight?: number | undefined;
  siteId?: string | undefined;
}

export function getLabelCoordinates(
  position: "TOP" | "BOTTOM" | "LEFT" | "RIGHT" | undefined,
  boxWidth: number,
  boxHeight: number,
  badgeWidth: number,
  badgeHeight: number,
  gap: number = 20
): { x: number; y: number } {
  switch (position) {
    case "TOP":
      return { x: -badgeWidth / 2, y: -boxHeight / 2 - badgeHeight - gap };
    case "BOTTOM":
      return { x: -badgeWidth / 2, y: boxHeight / 2 + gap };
    case "LEFT":
      return { x: -boxWidth / 2 - badgeWidth - gap, y: -badgeHeight / 2 };
    case "RIGHT":
    default:
      return { x: boxWidth / 2 + gap, y: -badgeHeight / 2 };
  }
}

interface EquipmentLayerProps {
  racks: RackDisplay[];
  nodes: NodeDisplay[];
  selectedOutletId?: string | null | undefined;
  selectedNodeId?: string | null | undefined;
  selectedNodeIds?: string[] | undefined;
  activeViewMode?: "ALL" | "HR" | "TECH" | "MAINTENANCE" | "NETWORK";
  showAllLabels?: boolean | undefined;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  onSelectOutlet: (outletNode: NodeDisplay) => void;
  onSelectNode?: ((node: NodeDisplay) => void) | undefined;
  onSelectNodeToggle?: ((node: NodeDisplay, isMulti: boolean) => void) | undefined;
  onNodeContextMenu?: ((node: NodeDisplay, pos: { x: number; y: number }) => void) | undefined;
  onNodeMoveEnd: (id: string, newPos: { x: number; y: number }) => void;
  onGroupNodeMoveEnd?:
    ((nodeIds: string[], delta: { deltaX: number; deltaY: number }) => void) | undefined;
  onNodeDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onRackDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  isMarqueeJustEnded?: (() => boolean) | undefined;
}

const EquipmentLayerComponent: FC<EquipmentLayerProps> = ({
  racks,
  nodes,
  selectedOutletId,
  selectedNodeId,
  selectedNodeIds,
  activeViewMode = "ALL",
  showAllLabels = false,
  vlanStyles,
  onSelectOutlet,
  onSelectNode,
  onSelectNodeToggle,
  onNodeContextMenu,
  onNodeMoveEnd,
  onGroupNodeMoveEnd,
  onNodeDragMove,
  onRackDragMove,
  isMarqueeJustEnded,
}) => {
  const isNodeSelected = (id: string) => {
    if (selectedNodeIds && selectedNodeIds.length > 0) {
      return selectedNodeIds.includes(id);
    }
    return (selectedNodeId ?? selectedOutletId) === id;
  };
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = "move";
    }
  };

  const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = "grab";
    }
  };

  const handleNodeMouseEnter = (nodeId: string, e: KonvaEventObject<MouseEvent>) => {
    handleMouseEnter(e);
    setHoveredNodeId(nodeId);
  };

  const handleNodeMouseLeave = (nodeId: string, e: KonvaEventObject<MouseEvent>) => {
    handleMouseLeave(e);
    setHoveredNodeId((prev) => (prev === nodeId ? null : prev));
  };

  // Référence pour le déplacement groupé de la multi-sélection
  const groupDragStateRef = useRef<{
    leadNodeId: string;
    startLeadPos: { x: number; y: number };
    otherNodes: { id: string; startPos: { x: number; y: number } }[];
    attachedOutlets: {
      id: string;
      startPos: { x: number; y: number };
      startAnchorPos: { x: number; y: number };
    }[];
  } | null>(null);

  const initGroupDragIfMulti = (nodeId: string, e: KonvaEventObject<DragEvent>) => {
    if (selectedNodeIds && selectedNodeIds.length > 1 && selectedNodeIds.includes(nodeId)) {
      const selectedSet = new Set(selectedNodeIds);
      const otherNodes: { id: string; startPos: { x: number; y: number } }[] = [];
      nodes.forEach((n) => {
        if (selectedSet.has(n.id) && n.id !== nodeId) {
          otherNodes.push({ id: n.id, startPos: { x: n.xMm, y: n.yMm } });
        }
      });
      racks.forEach((r) => {
        if (selectedSet.has(r.id) && r.id !== nodeId) {
          otherNodes.push({ id: r.id, startPos: { x: r.xMm, y: r.yMm } });
        }
      });

      // Prises rattachées aux bureaux sélectionnés qui ne sont pas déjà dans la sélection
      const attachedOutlets: {
        id: string;
        startPos: { x: number; y: number };
        startAnchorPos: { x: number; y: number };
      }[] = [];
      nodes.forEach((n) => {
        if (
          n.type === "WALL_OUTLET" &&
          n.attachedToDeskId &&
          selectedSet.has(n.attachedToDeskId) &&
          !selectedSet.has(n.id)
        ) {
          const desk = nodes.find((d) => d.id === n.attachedToDeskId);
          let startAnchorX = n.xMm;
          let startAnchorY = n.yMm;
          if (desk) {
            const deskW = desk.widthMm ?? 1600;
            const deskH = desk.heightMm ?? 800;
            const rotRad = ((desk.rotationDeg ?? 0) * Math.PI) / 180;
            let localAnchorX = deskW / 2;
            let localAnchorY = deskH / 2;
            if (n.attachedSeatIndex !== undefined) {
              if (desk.subType === "BENCH_QUAD") {
                const sIdx = n.attachedSeatIndex;
                localAnchorX = sIdx === 0 || sIdx === 2 ? deskW / 4 : (3 * deskW) / 4;
                localAnchorY = sIdx === 0 || sIdx === 1 ? deskH / 4 : (3 * deskH) / 4;
              } else if (desk.subType === "BENCH_DOUBLE") {
                const sIdx = n.attachedSeatIndex;
                localAnchorX = deskW / 2;
                localAnchorY = sIdx === 0 ? deskH / 4 : (3 * deskH) / 4;
              }
            }
            startAnchorX =
              desk.xMm + localAnchorX * Math.cos(rotRad) - localAnchorY * Math.sin(rotRad);
            startAnchorY =
              desk.yMm + localAnchorX * Math.sin(rotRad) + localAnchorY * Math.cos(rotRad);
          }
          attachedOutlets.push({
            id: n.id,
            startPos: { x: n.xMm, y: n.yMm },
            startAnchorPos: { x: startAnchorX, y: startAnchorY },
          });
        }
      });

      groupDragStateRef.current = {
        leadNodeId: nodeId,
        startLeadPos: { x: e.target.x(), y: e.target.y() },
        otherNodes,
        attachedOutlets,
      };
      return true;
    }
    groupDragStateRef.current = null;
    return false;
  };

  const updateGroupDragMove = (nodeId: string, e: KonvaEventObject<DragEvent>) => {
    const groupState = groupDragStateRef.current;
    if (groupState && groupState.leadNodeId === nodeId) {
      const deltaX = e.target.x() - groupState.startLeadPos.x;
      const deltaY = e.target.y() - groupState.startLeadPos.y;
      const stage = e.target.getStage();
      if (stage) {
        groupState.otherNodes.forEach((item) => {
          const konvaNode = stage.findOne("#" + item.id);
          if (konvaNode)
            konvaNode.position({ x: item.startPos.x + deltaX, y: item.startPos.y + deltaY });
        });
        groupState.attachedOutlets.forEach((item) => {
          const konvaNode = stage.findOne("#" + item.id);
          if (konvaNode)
            konvaNode.position({ x: item.startPos.x + deltaX, y: item.startPos.y + deltaY });
          const anchorLine = stage.findOne("#anchor-line-" + item.id) as any;
          if (anchorLine && typeof anchorLine.points === "function") {
            anchorLine.points([
              item.startAnchorPos.x + deltaX,
              item.startAnchorPos.y + deltaY,
              item.startPos.x + deltaX,
              item.startPos.y + deltaY,
            ]);
          }
        });
        stage.batchDraw();
      }
      return true;
    }
    return false;
  };

  const finishGroupDragIfMulti = (nodeId: string, e: KonvaEventObject<DragEvent>) => {
    const groupState = groupDragStateRef.current;
    if (groupState && groupState.leadNodeId === nodeId) {
      const deltaX = Math.round(e.target.x() - groupState.startLeadPos.x);
      const deltaY = Math.round(e.target.y() - groupState.startLeadPos.y);
      groupDragStateRef.current = null;
      if (onGroupNodeMoveEnd && selectedNodeIds) {
        onGroupNodeMoveEnd(selectedNodeIds, { deltaX, deltaY });
        return true;
      }
    }
    return false;
  };

  // Référence pour le suivi synchrone GPU immédiat du bureau et de ses prises solidaires (0 latence)
  const deskDragStateRef = useRef<{
    deskId: string;
    startDeskPos: { x: number; y: number };
    attachedOutlets: {
      id: string;
      startPos: { x: number; y: number };
      localAnchorX: number;
      localAnchorY: number;
    }[];
  } | null>(null);

  const handleDeskDragStart = (desk: NodeDisplay, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    initGroupDragIfMulti(desk.id, e);

    const attached = nodes.filter(
      (n) => n.type === "WALL_OUTLET" && n.attachedToDeskId === desk.id
    );
    const deskW = desk.widthMm ?? 1600;
    const deskH = desk.heightMm ?? 800;

    deskDragStateRef.current = {
      deskId: desk.id,
      startDeskPos: { x: e.target.x(), y: e.target.y() },
      attachedOutlets: attached.map((outlet) => {
        let localAnchorX = deskW / 2;
        let localAnchorY = deskH / 2;
        if (outlet.attachedSeatIndex !== undefined) {
          if (desk.subType === "BENCH_QUAD") {
            const sIdx = outlet.attachedSeatIndex;
            localAnchorX = sIdx === 0 || sIdx === 2 ? deskW / 4 : (3 * deskW) / 4;
            localAnchorY = sIdx === 0 || sIdx === 1 ? deskH / 4 : (3 * deskH) / 4;
          } else if (desk.subType === "BENCH_DOUBLE") {
            const sIdx = outlet.attachedSeatIndex;
            localAnchorX = deskW / 2;
            localAnchorY = sIdx === 0 ? deskH / 4 : (3 * deskH) / 4;
          }
        }
        return {
          id: outlet.id,
          startPos: { x: outlet.xMm, y: outlet.yMm },
          localAnchorX,
          localAnchorY,
        };
      }),
    };
  };

  const handleDeskDragMove = (desk: NodeDisplay, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    updateGroupDragMove(desk.id, e);

    const state = deskDragStateRef.current;
    const currentDeskX = e.target.x();
    const currentDeskY = e.target.y();

    if (state && state.deskId === desk.id) {
      const deltaX = currentDeskX - state.startDeskPos.x;
      const deltaY = currentDeskY - state.startDeskPos.y;
      const stage = e.target.getStage();

      const rotRad = ((desk.rotationDeg ?? 0) * Math.PI) / 180;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);

      if (stage) {
        for (const item of state.attachedOutlets) {
          const currentOutletX = item.startPos.x + deltaX;
          const currentOutletY = item.startPos.y + deltaY;

          // 1. Déplacer instantanément le nœud Konva de la prise solidaire
          const outletNode = stage.findOne("#" + item.id);
          if (outletNode) {
            outletNode.position({ x: currentOutletX, y: currentOutletY });
          }

          // 2. Mettre à jour la ligne d'ancrage en pointillés
          const anchorLineNode = stage.findOne("#anchor-line-" + item.id) as any;
          if (anchorLineNode && typeof anchorLineNode.points === "function") {
            const anchorX = currentDeskX + item.localAnchorX * cosR - item.localAnchorY * sinR;
            const anchorY = currentDeskY + item.localAnchorX * sinR + item.localAnchorY * cosR;
            anchorLineNode.points([anchorX, anchorY, currentOutletX, currentOutletY]);
          }
        }

        // Re-dessin GPU synchrone immédiat (0 latence, même frame 60 FPS)
        stage.batchDraw();
      }
    }

    onNodeDragMove?.(desk.id, { x: currentDeskX, y: currentDeskY });
  };

  const handleDeskDragEnd = (desk: NodeDisplay, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    deskDragStateRef.current = null;
    if (finishGroupDragIfMulti(desk.id, e)) return;
    handleDragEnd(desk.id, e);
  };

  const handleRackDragMove = (id: string, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    updateGroupDragMove(id, e);
    onRackDragMove?.(id, { x: e.target.x(), y: e.target.y() });
  };

  const handleNodeDragStart = (id: string, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    initGroupDragIfMulti(id, e);
  };

  const handleNodeDragMove = (id: string, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    updateGroupDragMove(id, e);
    onNodeDragMove?.(id, { x: e.target.x(), y: e.target.y() });
  };

  const handleDragEnd = (id: string, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    if (finishGroupDragIfMulti(id, e)) return;
    onNodeMoveEnd(id, { x: e.target.x(), y: e.target.y() });
  };

  return (
    <Group>
      {/* 0. Lignes d'ancrage en pointillés reliant les prises solidaires à leur bureau (masquées en vue RH) */}
      {activeViewMode !== "HR" &&
        nodes
          .filter((n) => n.type === "WALL_OUTLET" && n.attachedToDeskId)
          .map((outlet) => {
            const desk = nodes.find((d) => d.id === outlet.attachedToDeskId);
            if (!desk) return null;
            const deskW = desk.widthMm ?? 1600;
            const deskH = desk.heightMm ?? 800;
            const rotRad = ((desk.rotationDeg ?? 0) * Math.PI) / 180;

            // Point d'ancrage sur le meuble : si la prise est liée à une place précise, on ancre vers sa place !
            let localAnchorX = deskW / 2;
            let localAnchorY = deskH / 2;

            if (outlet.attachedSeatIndex !== undefined) {
              if (desk.subType === "BENCH_QUAD") {
                const sIdx = outlet.attachedSeatIndex;
                localAnchorX = sIdx === 0 || sIdx === 2 ? deskW / 4 : (3 * deskW) / 4;
                localAnchorY = sIdx === 0 || sIdx === 1 ? deskH / 4 : (3 * deskH) / 4;
              } else if (desk.subType === "BENCH_DOUBLE") {
                const sIdx = outlet.attachedSeatIndex;
                localAnchorX = deskW / 2;
                localAnchorY = sIdx === 0 ? deskH / 4 : (3 * deskH) / 4;
              }
            }

            const anchorX =
              desk.xMm + localAnchorX * Math.cos(rotRad) - localAnchorY * Math.sin(rotRad);
            const anchorY =
              desk.yMm + localAnchorX * Math.sin(rotRad) + localAnchorY * Math.cos(rotRad);

            const isVoip = outlet.outletRole === "VOIP";
            const isPrinter = outlet.outletRole === "PRINTER";
            const isFloorBox = outlet.subType === "FLOOR_BOX";
            const lineColor = isVoip
              ? "#c084fc"
              : isPrinter
                ? "#fbbf24"
                : isFloorBox
                  ? "#38bdf8"
                  : "#38bdf8";

            return (
              <Group key={`anchor-link-${outlet.id}`} listening={false}>
                <Line
                  id={`anchor-line-${outlet.id}`}
                  points={[anchorX, anchorY, outlet.xMm, outlet.yMm]}
                  stroke={lineColor}
                  strokeWidth={8}
                  dash={isVoip ? [40, 30] : [50, 35]}
                  opacity={0.75}
                  listening={false}
                />
              </Group>
            );
          })}

      {/* 1. Baies Informatiques 19" Réalistes (Racks 42U) - Masquées en vue RH */}
      {activeViewMode !== "HR" &&
        racks.map((rack) => {
          const isSelected = isNodeSelected(rack.id);
          const totalU = rack.uHeight || 42;
          const rWidth = rack.widthMm ?? 800;
          // Hauteur proportionnelle garantissant une hauteur minimale par U pour une excellente lisibilité
          const minDepthForU = 320 + totalU * 36;
          const rDepth = Math.max(rack.depthMm ?? 1000, minDepthForU);

          const rackNodeDisplay: NodeDisplay = {
            id: rack.id,
            type: "PATCH_PANEL",
            name: rack.name,
            xMm: rack.xMm,
            yMm: rack.yMm,
            widthMm: rWidth,
            heightMm: rDepth,
            subType: "RACK_42U",
            description: `Baie informatique standard 19" (${rack.uHeight}U) avec commutateurs Cisco et bandeaux Cat6A.`,
          };

          return (
            <Group
              key={rack.id}
              id={rack.id}
              x={rack.xMm}
              y={rack.yMm}
              draggable
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onDragStart={(e) => handleNodeDragStart(rack.id, e)}
              onDragMove={(e) => handleRackDragMove(rack.id, e)}
              onDragEnd={(e) => handleDragEnd(rack.id, e)}
              onClick={(e) => {
                e.cancelBubble = true;
                if (isMarqueeJustEnded?.()) return;
                if (onSelectNodeToggle) {
                  onSelectNodeToggle(rackNodeDisplay, e.evt.shiftKey);
                } else {
                  onSelectNode?.(rackNodeDisplay);
                }
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                if (isMarqueeJustEnded?.()) return;
                if (onSelectNodeToggle) {
                  onSelectNodeToggle(rackNodeDisplay, false);
                } else {
                  onSelectNode?.(rackNodeDisplay);
                }
              }}
              onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                onNodeContextMenu?.(
                  {
                    id: rack.id,
                    type: "PATCH_PANEL",
                    name: rack.name,
                    xMm: rack.xMm,
                    yMm: rack.yMm,
                    widthMm: rWidth,
                    heightMm: rDepth,
                    subType: "RACK_42U",
                    description: `Baie informatique standard 19" (${rack.uHeight}U) avec commutateurs Cisco et bandeaux Cat6A.`,
                  },
                  { x: e.evt.clientX, y: e.evt.clientY }
                );
              }}
            >
              {/* Châssis extérieur métallique de la baie 19" */}
              <Rect
                width={rWidth}
                height={rDepth}
                fill={isSelected ? "#1e293b" : "#0f172a"}
                stroke={isSelected ? "#38bdf8" : "#3b82f6"}
                strokeWidth={isSelected ? 32 : 22}
                cornerRadius={30}
              />
              {/* Bordure intérieure de porte vitrée fumée */}
              <Rect
                x={25}
                y={25}
                width={rWidth - 50}
                height={rDepth - 50}
                stroke="#334155"
                strokeWidth={10}
                cornerRadius={20}
                fill="rgba(15, 23, 42, 0.65)"
                listening={false}
              />

              {/* Bandeau supérieur d'identification & Statut Baie */}
              <Rect
                x={40}
                y={40}
                width={rWidth - 80}
                height={85}
                fill="rgba(2, 6, 23, 0.92)"
                stroke={isSelected ? "#38bdf8" : "#2563eb"}
                strokeWidth={6}
                cornerRadius={12}
                listening={false}
              />
              <Text
                x={55}
                y={55}
                width={rWidth - 190}
                text={`⚡ ${rack.name}`}
                fontSize={48}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#38bdf8"
                wrap="none"
                ellipsis={true}
                listening={false}
              />
              <Text
                x={rWidth - 165}
                y={57}
                width={110}
                text={`${totalU}U`}
                fontSize={44}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#93c5fd"
                align="right"
                wrap="none"
                listening={false}
              />
              {/* Voyants LED d'état */}
              <Circle
                x={rWidth - 190}
                y={72}
                radius={10}
                fill="#22c55e"
                stroke="#15803d"
                strokeWidth={2}
                listening={false}
              />
              <Circle
                x={rWidth - 215}
                y={72}
                radius={10}
                fill="#38bdf8"
                stroke="#0284c7"
                strokeWidth={2}
                listening={false}
              />

              {/* Montants intérieurs normalisés 19 pouces (Rails de rack) avec graduations U */}
              <Rect
                x={70}
                y={130}
                width={20}
                height={rDepth - 220}
                fill="#475569"
                cornerRadius={4}
                listening={false}
              />
              <Rect
                x={rWidth - 90}
                y={130}
                width={20}
                height={rDepth - 220}
                fill="#475569"
                cornerRadius={4}
                listening={false}
              />

              {/* Rendu dynamique des équipements raqués dans le châssis selon slotU */}
              {(() => {
                const devList = rack.devices && rack.devices.length > 0 ? rack.devices : [];
                // Espace utile vertical pour les U : de y=150 à y=(rDepth - 180)
                const usableTop = 150;
                const usableHeight = Math.max(300, rDepth - 330);
                const uStep = usableHeight / totalU;

                // Repères textuels de U sur le rail gauche tous les 5U ou 1U si totalU <= 18
                const uMarks = Array.from({ length: totalU }).map((_, idx) => {
                  const uNum = idx + 1;
                  const isKeyU = uNum % 5 === 0 || uNum === 1 || uNum === totalU || totalU <= 18;
                  if (!isKeyU) return null;
                  const markY = usableTop + (totalU - uNum) * uStep + uStep / 2 - 8;
                  return (
                    <Text
                      key={`umark-${uNum}`}
                      x={35}
                      y={markY}
                      width={32}
                      text={`${uNum}`}
                      fontSize={Math.max(14, Math.min(22, uStep * 0.55))}
                      fontFamily="monospace"
                      fontStyle="bold"
                      fill="#64748b"
                      align="right"
                      listening={false}
                    />
                  );
                });

                return (
                  <Group>
                    {uMarks}
                    {devList.map((dev) => {
                      const uSize = dev.uSize ?? 1;
                      // slotU est de 1 (bas) à totalU (haut)
                      // Position Y inverse : slotU élevé = en haut
                      const devY = usableTop + (totalU - dev.slotU) * uStep;
                      const devH = Math.max(32, uStep * uSize - 4);

                      const isSw = dev.deviceType === "SWITCH";
                      const isPp = dev.deviceType === "PATCH_PANEL";
                      const isFw = dev.deviceType === "FIREWALL";
                      const isSrv = dev.deviceType === "SERVER";
                      const isPdu = dev.deviceType === "PDU";

                      const devFill = isSw
                        ? "#172554"
                        : isPp
                          ? "#1e293b"
                          : isFw
                            ? "#450a0a"
                            : isSrv
                              ? "#09090b"
                              : isPdu
                                ? "#422006"
                                : "#1e293b";

                      const devStroke = isSw
                        ? "#3b82f6"
                        : isPp
                          ? "#64748b"
                          : isFw
                            ? "#ef4444"
                            : isSrv
                              ? "#a1a1aa"
                              : isPdu
                                ? "#f59e0b"
                                : "#475569";

                      const typeBadge = isSw
                        ? "SW"
                        : isPp
                          ? "PP"
                          : isFw
                            ? "FW"
                            : isSrv
                              ? "SRV"
                              : isPdu
                                ? "PDU"
                                : "DEV";

                      return (
                        <Group key={dev.id}>
                          <Rect
                            x={95}
                            y={devY}
                            width={rWidth - 190}
                            height={devH}
                            fill={devFill}
                            stroke={devStroke}
                            strokeWidth={6}
                            cornerRadius={8}
                            listening={false}
                          />
                          {/* Badge de Type & Emplacement U */}
                          <Rect
                            x={105}
                            y={devY + Math.max(4, (devH - 28) / 2)}
                            width={75}
                            height={Math.min(28, devH - 8)}
                            fill="rgba(2, 6, 23, 0.75)"
                            stroke={devStroke}
                            strokeWidth={2}
                            cornerRadius={4}
                            listening={false}
                          />
                          <Text
                            x={107}
                            y={devY + Math.max(8, (devH - 20) / 2)}
                            width={71}
                            text={`U${dev.slotU} ${typeBadge}`}
                            fontSize={Math.min(18, Math.max(13, devH * 0.35))}
                            fontFamily="monospace"
                            fontStyle="bold"
                            fill="#38bdf8"
                            align="center"
                            listening={false}
                          />
                          {/* Nom de l'équipement avec excellente lisibilité */}
                          <Text
                            x={190}
                            y={devY + Math.max(6, (devH - 26) / 2)}
                            width={rWidth - 300}
                            text={dev.name}
                            fontSize={Math.min(32, Math.max(18, devH * 0.42))}
                            fontFamily="monospace"
                            fontStyle="bold"
                            fill="#f8fafc"
                            wrap="none"
                            ellipsis={true}
                            listening={false}
                          />
                          {/* Représentation des ports RJ45 / LEDs */}
                          {dev.portsCount && devH >= 54 && (
                            <Group y={devY + devH - 24}>
                              {Array.from({
                                length: Math.min(12, Math.ceil(dev.portsCount / 2)),
                              }).map((_, pIdx) => (
                                <Rect
                                  key={`dev-port-${dev.id}-${pIdx}`}
                                  x={190 + pIdx * ((rWidth - 320) / 12)}
                                  y={0}
                                  width={18}
                                  height={14}
                                  fill={pIdx < 7 ? (isSw ? "#22c55e" : "#38bdf8") : "#334155"}
                                  cornerRadius={3}
                                  listening={false}
                                />
                              ))}
                            </Group>
                          )}
                        </Group>
                      );
                    })}
                  </Group>
                );
              })()}

              {/* Grille de ventilation inférieure */}
              {Array.from({ length: 4 }).map((_, i) => (
                <Circle
                  key={`fan-${i}`}
                  x={160 + i * ((rWidth - 320) / 3)}
                  y={rDepth - 80}
                  radius={40}
                  stroke="#334155"
                  strokeWidth={8}
                  fill="rgba(15, 23, 42, 0.8)"
                  listening={false}
                />
              ))}
            </Group>
          );
        })}

      {/* 2. Mobilier & Postes Réalistes (Bureaux Solo, Bench Double 2P, Îlot Quad 4P) */}
      {nodes
        .filter((n) => n.type === "DESK")
        .map((desk) => {
          const isSelected = isNodeSelected(desk.id);
          const width = desk.widthMm ?? 1600;
          const height = desk.heightMm ?? 800;
          const rotDeg = desk.rotationDeg ?? 0;
          const isMeeting = desk.subType === "MEETING_TABLE";
          const isBenchQuad = desk.subType === "BENCH_QUAD";
          const isBenchDouble = desk.subType === "BENCH_DOUBLE";

          // Intitulé court : "Bureau {N}"
          const matchNum = desk.name.match(/\d+/);
          const shortTitle = matchNum
            ? `Bureau ${matchNum[0]}`
            : desk.name.replace(/^Poste\s+/i, "Bureau ");

          // Récupération sécurisée d'un occupant de place
          const getSeat = (idx: number): DeskSeatOccupant | undefined => {
            if (desk.seats && desk.seats[idx]) {
              return desk.seats[idx];
            }
            if (idx === 0 && desk.assignedPerson) {
              return {
                seatIndex: 0,
                fullName: desk.assignedPerson,
                userId: desk.assignedUserId,
                department: desk.department,
              };
            }
            return undefined;
          };

          // Détection d'une prise ou raccordement VoIP (VLAN 30 ou rôle VOIP) lié à ce bureau
          const deskOutlets = nodes.filter((n) => n.attachedToDeskId === desk.id);
          const hasVoipPhone = deskOutlets.some(
            (n) =>
              n.outletRole === "VOIP" ||
              n.vlanId === 30 ||
              n.stackedPorts?.some((sp) => sp.outletRole === "VOIP" || sp.vlanId === 30)
          );

          // Rendu d'un terminal téléphonique IP réaliste (combiné, écran rétroéclairé bleu avec "IP", pavé numérique et LED verte)
          const renderVoipPhone = (px: number, py: number, phoneRotation: number = 0) => (
            <Group x={px} y={py} rotation={phoneRotation} listening={false}>
              {/* Ombre / socle */}
              <Rect x={-55} y={-45} width={110} height={90} fill="#090d16" cornerRadius={10} />
              {/* Corps principal incliné du téléphone */}
              <Rect
                x={-52}
                y={-42}
                width={104}
                height={84}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={4}
                cornerRadius={8}
              />
              {/* Combiné téléphonique à gauche */}
              <Rect
                x={-45}
                y={-38}
                width={22}
                height={76}
                fill="#0f172a"
                stroke="#475569"
                strokeWidth={3}
                cornerRadius={6}
              />
              {/* Écran LCD rétroéclairé cyan */}
              <Rect
                x={-15}
                y={-36}
                width={60}
                height={32}
                fill="#0369a1"
                stroke="#38bdf8"
                strokeWidth={2}
                cornerRadius={4}
              />
              <Text
                x={-13}
                y={-28}
                width={56}
                text="IP TEL"
                fontSize={11}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#e0f2fe"
                align="center"
              />
              {/* Pavé numérique stylisé */}
              <Rect x={-15} y={4} width={42} height={32} fill="#0f172a" cornerRadius={3} />
              <Rect x={-11} y={8} width={8} height={6} fill="#475569" cornerRadius={1} />
              <Rect x={1} y={8} width={8} height={6} fill="#475569" cornerRadius={1} />
              <Rect x={13} y={8} width={8} height={6} fill="#475569" cornerRadius={1} />
              <Rect x={-11} y={18} width={8} height={6} fill="#475569" cornerRadius={1} />
              <Rect x={1} y={18} width={8} height={6} fill="#475569" cornerRadius={1} />
              <Rect x={13} y={18} width={8} height={6} fill="#475569" cornerRadius={1} />
              {/* Voyant LED statut réseau (vert en ligne) */}
              <Circle x={38} y={20} radius={4} fill="#22c55e" stroke="#15803d" strokeWidth={1} />
            </Group>
          );

          return (
            <Group
              key={desk.id}
              id={desk.id}
              x={desk.xMm}
              y={desk.yMm}
              rotation={rotDeg}
              draggable
              onMouseEnter={(e) => handleNodeMouseEnter(desk.id, e)}
              onMouseLeave={(e) => handleNodeMouseLeave(desk.id, e)}
              onDragStart={(e) => handleDeskDragStart(desk, e)}
              onDragMove={(e) => handleDeskDragMove(desk, e)}
              onDragEnd={(e) => handleDeskDragEnd(desk, e)}
              onClick={(e) => {
                e.cancelBubble = true;
                if (isMarqueeJustEnded?.()) return;
                if (onSelectNodeToggle) {
                  onSelectNodeToggle(desk, e.evt.shiftKey);
                } else {
                  onSelectNode?.(desk);
                }
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                if (isMarqueeJustEnded?.()) return;
                if (onSelectNodeToggle) {
                  onSelectNodeToggle(desk, false);
                } else {
                  onSelectNode?.(desk);
                }
              }}
              onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                onNodeContextMenu?.(desk, { x: e.evt.clientX, y: e.evt.clientY });
              }}
            >
              {/* Plateau de bureau réaliste (finition bois/anthracite) */}
              <Rect
                width={width}
                height={height}
                fill={isSelected ? "#1e293b" : "#0f172a"}
                stroke={isSelected ? "#60a5fa" : isMeeting ? "#059669" : "#334155"}
                strokeWidth={isSelected ? 35 : 22}
                cornerRadius={isMeeting ? 80 : 25}
              />

              {/* Liseré de chanfrein intérieur */}
              <Rect
                x={20}
                y={20}
                width={width - 40}
                height={height - 40}
                stroke="#1e293b"
                strokeWidth={8}
                cornerRadius={isMeeting ? 60 : 15}
                listening={false}
              />

              {/* Cloisonnettes acoustiques centrales pour Bench Double et Îlot Quad */}
              {isBenchDouble && (
                <Rect
                  x={30}
                  y={height / 2 - 15}
                  width={width - 60}
                  height={30}
                  fill="#0284c7"
                  cornerRadius={10}
                  opacity={0.85}
                  listening={false}
                />
              )}
              {isBenchQuad && (
                <Group listening={false}>
                  {/* Séparation acoustique horizontale */}
                  <Rect
                    x={30}
                    y={height / 2 - 15}
                    width={width - 60}
                    height={30}
                    fill="#0284c7"
                    cornerRadius={10}
                    opacity={0.85}
                  />
                  {/* Séparation acoustique verticale / colonne de câblage */}
                  <Rect
                    x={width / 2 - 15}
                    y={30}
                    width={30}
                    height={height - 60}
                    fill="#0284c7"
                    cornerRadius={10}
                    opacity={0.85}
                  />
                </Group>
              )}

              {/* Équipements informatiques (écrans, claviers) & Chaises selon le type */}
              {!isMeeting && isBenchQuad && (
                <Group listening={false}>
                  {/* Place 0 (Haut-Gauche) : Écran contre la cloisonnette centrale, clavier vers l'utilisateur */}
                  <Rect
                    x={width / 4 - 210}
                    y={height / 2 - 120}
                    width={420}
                    height={38}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth={7}
                    cornerRadius={6}
                  />
                  <Rect
                    x={width / 4 - 45}
                    y={height / 2 - 82}
                    width={90}
                    height={22}
                    fill="#475569"
                    cornerRadius={5}
                  />
                  <Rect
                    x={width / 4 - 160}
                    y={80}
                    width={320}
                    height={95}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={7}
                    cornerRadius={8}
                  />

                  {/* Place 1 (Haut-Droite) */}
                  <Rect
                    x={(3 * width) / 4 - 210}
                    y={height / 2 - 120}
                    width={420}
                    height={38}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth={7}
                    cornerRadius={6}
                  />
                  <Rect
                    x={(3 * width) / 4 - 45}
                    y={height / 2 - 82}
                    width={90}
                    height={22}
                    fill="#475569"
                    cornerRadius={5}
                  />
                  <Rect
                    x={(3 * width) / 4 - 160}
                    y={80}
                    width={320}
                    height={95}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={7}
                    cornerRadius={8}
                  />

                  {/* Place 2 (Bas-Gauche) */}
                  <Rect
                    x={width / 4 - 210}
                    y={height / 2 + 82}
                    width={420}
                    height={38}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth={7}
                    cornerRadius={6}
                  />
                  <Rect
                    x={width / 4 - 45}
                    y={height / 2 + 60}
                    width={90}
                    height={22}
                    fill="#475569"
                    cornerRadius={5}
                  />
                  <Rect
                    x={width / 4 - 160}
                    y={height - 175}
                    width={320}
                    height={95}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={7}
                    cornerRadius={8}
                  />

                  {/* Place 3 (Bas-Droite) */}
                  <Rect
                    x={(3 * width) / 4 - 210}
                    y={height / 2 + 82}
                    width={420}
                    height={38}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth={7}
                    cornerRadius={6}
                  />
                  <Rect
                    x={(3 * width) / 4 - 45}
                    y={height / 2 + 60}
                    width={90}
                    height={22}
                    fill="#475569"
                    cornerRadius={5}
                  />
                  <Rect
                    x={(3 * width) / 4 - 160}
                    y={height - 175}
                    width={320}
                    height={95}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={7}
                    cornerRadius={8}
                  />

                  {/* Téléphones IP si le bureau est équipé VoIP */}
                  {hasVoipPhone && (
                    <Group listening={false}>
                      {renderVoipPhone(width / 4 + 210, height / 2 - 120, 0)}
                      {desk.seats?.[1]?.fullName &&
                        renderVoipPhone((3 * width) / 4 + 210, height / 2 - 120, 0)}
                      {desk.seats?.[2]?.fullName &&
                        renderVoipPhone(width / 4 + 210, height / 2 + 120, 180)}
                      {desk.seats?.[3]?.fullName &&
                        renderVoipPhone((3 * width) / 4 + 210, height / 2 + 120, 180)}
                    </Group>
                  )}

                  {/* 4 Chaises (2 en haut tournées vers le bas, 2 en bas tournées vers le haut) */}
                  {desk.chairPosition !== "NONE" && (
                    <Group listening={false}>
                      {/* Chaise 0 (Top-Left) */}
                      <Rect
                        x={width / 4 - 190}
                        y={-380}
                        width={380}
                        height={320}
                        fill="#1e293b"
                        stroke="#475569"
                        strokeWidth={12}
                        cornerRadius={45}
                      />
                      <Rect
                        x={width / 4 - 170}
                        y={-360}
                        width={340}
                        height={75}
                        fill="#0f172a"
                        stroke="#64748b"
                        strokeWidth={10}
                        cornerRadius={35}
                      />
                      <Rect
                        x={width / 4 - 210}
                        y={-300}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />
                      <Rect
                        x={width / 4 + 175}
                        y={-300}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />

                      {/* Chaise 1 (Top-Right) */}
                      <Rect
                        x={(3 * width) / 4 - 190}
                        y={-380}
                        width={380}
                        height={320}
                        fill="#1e293b"
                        stroke="#475569"
                        strokeWidth={12}
                        cornerRadius={45}
                      />
                      <Rect
                        x={(3 * width) / 4 - 170}
                        y={-360}
                        width={340}
                        height={75}
                        fill="#0f172a"
                        stroke="#64748b"
                        strokeWidth={10}
                        cornerRadius={35}
                      />
                      <Rect
                        x={(3 * width) / 4 - 210}
                        y={-300}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />
                      <Rect
                        x={(3 * width) / 4 + 175}
                        y={-300}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />

                      {/* Chaise 2 (Bottom-Left) */}
                      <Rect
                        x={width / 4 - 190}
                        y={height + 50}
                        width={380}
                        height={320}
                        fill="#1e293b"
                        stroke="#475569"
                        strokeWidth={12}
                        cornerRadius={45}
                      />
                      <Rect
                        x={width / 4 - 170}
                        y={height + 280}
                        width={340}
                        height={75}
                        fill="#0f172a"
                        stroke="#64748b"
                        strokeWidth={10}
                        cornerRadius={35}
                      />
                      <Rect
                        x={width / 4 - 210}
                        y={height + 130}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />
                      <Rect
                        x={width / 4 + 175}
                        y={height + 130}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />

                      {/* Chaise 3 (Bottom-Right) */}
                      <Rect
                        x={(3 * width) / 4 - 190}
                        y={height + 50}
                        width={380}
                        height={320}
                        fill="#1e293b"
                        stroke="#475569"
                        strokeWidth={12}
                        cornerRadius={45}
                      />
                      <Rect
                        x={(3 * width) / 4 - 170}
                        y={height + 280}
                        width={340}
                        height={75}
                        fill="#0f172a"
                        stroke="#64748b"
                        strokeWidth={10}
                        cornerRadius={35}
                      />
                      <Rect
                        x={(3 * width) / 4 - 210}
                        y={height + 130}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />
                      <Rect
                        x={(3 * width) / 4 + 175}
                        y={height + 130}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />
                    </Group>
                  )}
                </Group>
              )}

              {!isMeeting && isBenchDouble && (
                <Group listening={false}>
                  {/* Écran & Clavier Place 0 (Haut) */}
                  <Rect
                    x={width / 2 - 210}
                    y={height / 2 - 120}
                    width={420}
                    height={38}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth={7}
                    cornerRadius={6}
                  />
                  <Rect
                    x={width / 2 - 45}
                    y={height / 2 - 82}
                    width={90}
                    height={22}
                    fill="#475569"
                    cornerRadius={5}
                  />
                  <Rect
                    x={width / 2 - 160}
                    y={80}
                    width={320}
                    height={95}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={7}
                    cornerRadius={8}
                  />

                  {/* Écran & Clavier Place 1 (Bas) */}
                  <Rect
                    x={width / 2 - 210}
                    y={height / 2 + 82}
                    width={420}
                    height={38}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth={7}
                    cornerRadius={6}
                  />
                  <Rect
                    x={width / 2 - 45}
                    y={height / 2 + 60}
                    width={90}
                    height={22}
                    fill="#475569"
                    cornerRadius={5}
                  />
                  <Rect
                    x={width / 2 - 160}
                    y={height - 175}
                    width={320}
                    height={95}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={7}
                    cornerRadius={8}
                  />

                  {/* Téléphones IP si le bureau double est équipé VoIP */}
                  {hasVoipPhone && (
                    <Group listening={false}>
                      {renderVoipPhone(width / 2 + 250, height / 2 - 120, 0)}
                      {desk.seats?.[1]?.fullName &&
                        renderVoipPhone(width / 2 + 250, height / 2 + 120, 180)}
                    </Group>
                  )}

                  {/* 2 Chaises (1 en haut tournée vers le bas, 1 en bas tournée vers le haut) */}
                  {desk.chairPosition !== "NONE" && (
                    <Group listening={false}>
                      {/* Chaise 0 (Top) */}
                      <Rect
                        x={width / 2 - 190}
                        y={-380}
                        width={380}
                        height={320}
                        fill="#1e293b"
                        stroke="#475569"
                        strokeWidth={12}
                        cornerRadius={45}
                      />
                      <Rect
                        x={width / 2 - 170}
                        y={-360}
                        width={340}
                        height={75}
                        fill="#0f172a"
                        stroke="#64748b"
                        strokeWidth={10}
                        cornerRadius={35}
                      />
                      <Rect
                        x={width / 2 - 210}
                        y={-300}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />
                      <Rect
                        x={width / 2 + 175}
                        y={-300}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />

                      {/* Chaise 1 (Bottom) */}
                      <Rect
                        x={width / 2 - 190}
                        y={height + 50}
                        width={380}
                        height={320}
                        fill="#1e293b"
                        stroke="#475569"
                        strokeWidth={12}
                        cornerRadius={45}
                      />
                      <Rect
                        x={width / 2 - 170}
                        y={height + 280}
                        width={340}
                        height={75}
                        fill="#0f172a"
                        stroke="#64748b"
                        strokeWidth={10}
                        cornerRadius={35}
                      />
                      <Rect
                        x={width / 2 - 210}
                        y={height + 130}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />
                      <Rect
                        x={width / 2 + 175}
                        y={height + 130}
                        width={35}
                        height={160}
                        fill="#334155"
                        cornerRadius={12}
                      />
                    </Group>
                  )}
                </Group>
              )}

              {!isMeeting && !isBenchDouble && !isBenchQuad && (
                <Group listening={false}>
                  {/* Écran Principal Solo */}
                  <Rect
                    x={width / 2 - 220}
                    y={80}
                    width={440}
                    height={40}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth={8}
                    cornerRadius={6}
                  />
                  <Rect
                    x={width / 2 - 50}
                    y={55}
                    width={100}
                    height={25}
                    fill="#475569"
                    cornerRadius={5}
                  />
                  {/* Clavier Solo */}
                  <Rect
                    x={width / 2 - 180}
                    y={170}
                    width={360}
                    height={110}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={8}
                    cornerRadius={8}
                  />

                  {/* Téléphone IP sur bureau Solo */}
                  {hasVoipPhone && renderVoipPhone(width / 2 + 260, 140, 15)}

                  {/* Fauteuil Solo Ergonomique */}
                  {desk.chairPosition !== "NONE" && (
                    <Group listening={false}>
                      <Rect
                        x={width / 2 - 200}
                        y={height + 50}
                        width={400}
                        height={350}
                        fill="#1e293b"
                        stroke="#475569"
                        strokeWidth={12}
                        cornerRadius={50}
                      />
                      <Rect
                        x={width / 2 - 180}
                        y={height + 280}
                        width={360}
                        height={90}
                        fill="#0f172a"
                        stroke="#64748b"
                        strokeWidth={10}
                        cornerRadius={40}
                      />
                      <Rect
                        x={width / 2 - 220}
                        y={height + 110}
                        width={40}
                        height={180}
                        fill="#334155"
                        cornerRadius={15}
                      />
                      <Rect
                        x={width / 2 + 180}
                        y={height + 110}
                        width={40}
                        height={180}
                        fill="#334155"
                        cornerRadius={15}
                      />
                    </Group>
                  )}
                </Group>
              )}

              {/* Cartouches d'identification épurés et TOUJOURS horizontaux (rotation={-rotDeg}) - VISIBLES EN PERMANENCE */}
              {(() => {
                if (isBenchQuad) {
                  // ÎLOT 4 POSTES : 4 Grands Badges Distincts + Pill Centrale
                  return (
                    <Group listening={false}>
                      {/* Badge Central Îlot */}
                      <Group x={width / 2} y={height / 2} rotation={-rotDeg} listening={false}>
                        <Rect
                          x={-270}
                          y={-50}
                          width={540}
                          height={100}
                          fill="rgba(10, 15, 30, 0.96)"
                          stroke={isSelected ? "#60a5fa" : "#0284c7"}
                          strokeWidth={6}
                          cornerRadius={18}
                        />
                        <Text
                          x={-260}
                          y={-28}
                          width={520}
                          text={`${shortTitle} • Îlot 4P`}
                          fontSize={60}
                          fontFamily="sans-serif"
                          fontStyle="bold"
                          fill="#38bdf8"
                          align="center"
                          wrap="none"
                          ellipsis={true}
                        />
                      </Group>

                      {/* 4 Grands Badges d'occupants dans les 4 quadrants (police adaptative + auto-ellipsis) */}
                      {[
                        { idx: 0, cx: width / 4, cy: 380 },
                        { idx: 1, cx: (3 * width) / 4, cy: 380 },
                        { idx: 2, cx: width / 4, cy: height - 380 },
                        { idx: 3, cx: (3 * width) / 4, cy: height - 380 },
                      ].map(({ idx, cx, cy }) => {
                        const seat = getSeat(idx);
                        const isOccupied = Boolean(seat?.fullName);
                        const nameLen = seat?.fullName?.length ?? 12;
                        const bW = Math.max(740, Math.min(840, nameLen * 36));
                        const bH = 180;
                        const nameFontSize = nameLen > 16 ? 68 : 78;

                        return (
                          <Group
                            key={`quad-seat-${idx}`}
                            x={cx}
                            y={cy}
                            rotation={-rotDeg}
                            listening={false}
                          >
                            <Rect
                              x={-bW / 2}
                              y={-bH / 2}
                              width={bW}
                              height={bH}
                              fill="rgba(15, 23, 42, 0.95)"
                              stroke={isOccupied ? "#38bdf8" : "#475569"}
                              strokeWidth={7}
                              cornerRadius={18}
                            />
                            <Text
                              x={-bW / 2 + 15}
                              y={-bH / 2 + 20}
                              width={bW - 30}
                              text={seat?.fullName ? `👤 ${seat.fullName}` : "👤 Poste Libre"}
                              fontSize={nameFontSize}
                              fontFamily="sans-serif"
                              fontStyle="bold"
                              fill={isOccupied ? "#f8fafc" : "#94a3b8"}
                              align="center"
                              wrap="none"
                              ellipsis={true}
                            />
                            <Text
                              x={-bW / 2 + 15}
                              y={-bH / 2 + 105}
                              width={bW - 30}
                              text={seat?.department ?? "Disponible / Flex"}
                              fontSize={54}
                              fontFamily="sans-serif"
                              fill={isOccupied ? "#38bdf8" : "#64748b"}
                              align="center"
                              wrap="none"
                              ellipsis={true}
                            />
                          </Group>
                        );
                      })}
                    </Group>
                  );
                }

                if (isBenchDouble) {
                  // BENCH DOUBLE 2 POSTES : 2 Grands Badges Distincts + Pill Centrale
                  return (
                    <Group listening={false}>
                      {/* Badge Central Bench */}
                      <Group x={width / 2} y={height / 2} rotation={-rotDeg} listening={false}>
                        <Rect
                          x={-250}
                          y={-45}
                          width={500}
                          height={90}
                          fill="rgba(10, 15, 30, 0.96)"
                          stroke={isSelected ? "#60a5fa" : "#0284c7"}
                          strokeWidth={6}
                          cornerRadius={16}
                        />
                        <Text
                          x={-240}
                          y={-26}
                          width={480}
                          text={`${shortTitle} • Bench 2P`}
                          fontSize={56}
                          fontFamily="sans-serif"
                          fontStyle="bold"
                          fill="#38bdf8"
                          align="center"
                          wrap="none"
                          ellipsis={true}
                        />
                      </Group>

                      {/* 2 Grands Badges d'occupants (Face Nord, Face Sud) */}
                      {[
                        { idx: 0, cx: width / 2, cy: 380 },
                        { idx: 1, cx: width / 2, cy: height - 380 },
                      ].map(({ idx, cx, cy }) => {
                        const seat = getSeat(idx);
                        const isOccupied = Boolean(seat?.fullName);
                        const nameLen = seat?.fullName?.length ?? 12;
                        const bW = Math.max(780, Math.min(920, nameLen * 38));
                        const bH = 180;
                        const nameFontSize = nameLen > 16 ? 70 : 80;

                        return (
                          <Group
                            key={`double-seat-${idx}`}
                            x={cx}
                            y={cy}
                            rotation={-rotDeg}
                            listening={false}
                          >
                            <Rect
                              x={-bW / 2}
                              y={-bH / 2}
                              width={bW}
                              height={bH}
                              fill="rgba(15, 23, 42, 0.95)"
                              stroke={isOccupied ? "#38bdf8" : "#475569"}
                              strokeWidth={7}
                              cornerRadius={18}
                            />
                            <Text
                              x={-bW / 2 + 15}
                              y={-bH / 2 + 20}
                              width={bW - 30}
                              text={seat?.fullName ? `👤 ${seat.fullName}` : "👤 Poste Libre"}
                              fontSize={nameFontSize}
                              fontFamily="sans-serif"
                              fontStyle="bold"
                              fill={isOccupied ? "#f8fafc" : "#94a3b8"}
                              align="center"
                              wrap="none"
                              ellipsis={true}
                            />
                            <Text
                              x={-bW / 2 + 15}
                              y={-bH / 2 + 105}
                              width={bW - 30}
                              text={seat?.department ?? "Disponible / Flex"}
                              fontSize={54}
                              fontFamily="sans-serif"
                              fill={isOccupied ? "#38bdf8" : "#64748b"}
                              align="center"
                              wrap="none"
                              ellipsis={true}
                            />
                          </Group>
                        );
                      })}
                    </Group>
                  );
                }

                // BUREAU SOLO OU TABLE DE RÉUNION
                const isRotatedVertical = rotDeg % 180 !== 0;
                const personLen = desk.assignedPerson?.length ?? 12;
                const baseBadgeW = isRotatedVertical
                  ? Math.max(650, height - 60)
                  : Math.max(760, Math.min(width - 60, personLen * 40));
                const badgeWidth = Math.max(baseBadgeW, 760);
                const badgeHeight = 200;
                const personFontSize = personLen > 16 ? 70 : 82;
                const labelPos = desk.labelPosition;

                let groupX = width / 2;
                let groupY = height / 2 + 50;
                if (labelPos === "TOP") {
                  groupY = -badgeHeight / 2 - 30;
                } else if (labelPos === "BOTTOM") {
                  groupY = height + badgeHeight / 2 + 30;
                } else if (labelPos === "LEFT") {
                  groupX = -badgeWidth / 2 - 30;
                  groupY = height / 2;
                } else if (labelPos === "RIGHT") {
                  groupX = width + badgeWidth / 2 + 30;
                  groupY = height / 2;
                }

                return (
                  <Group x={groupX} y={groupY} rotation={-rotDeg} listening={false}>
                    <Rect
                      x={-badgeWidth / 2}
                      y={-badgeHeight / 2}
                      width={badgeWidth}
                      height={badgeHeight}
                      fill="rgba(15, 23, 42, 0.94)"
                      stroke={isSelected ? "#60a5fa" : "#334155"}
                      strokeWidth={8}
                      cornerRadius={18}
                      listening={false}
                    />
                    <Text
                      x={-badgeWidth / 2 + 15}
                      y={-badgeHeight / 2 + 25}
                      width={badgeWidth - 30}
                      text={shortTitle}
                      fontSize={95}
                      fontFamily="sans-serif"
                      fontStyle="bold"
                      fill="#f8fafc"
                      align="center"
                      wrap="none"
                      ellipsis={true}
                      listening={false}
                    />
                    <Text
                      x={-badgeWidth / 2 + 15}
                      y={-badgeHeight / 2 + 115}
                      width={badgeWidth - 30}
                      text={desk.assignedPerson ? `👤 ${desk.assignedPerson}` : "👤 Poste Libre"}
                      fontSize={personFontSize}
                      fontFamily="sans-serif"
                      fontStyle={desk.assignedPerson ? "bold" : "normal"}
                      fill={desk.assignedPerson ? "#34d399" : "#94a3b8"}
                      align="center"
                      wrap="none"
                      ellipsis={true}
                      listening={false}
                    />
                  </Group>
                );
              })()}
            </Group>
          );
        })}

      {/* 3. Connectique & Prises Réalistes (masquées en vue RH sauf copieur/mobilier) */}
      {nodes
        .filter((n) => {
          if (n.type !== "WALL_OUTLET") return false;
          // En vue RH, on ne voit QUE les équipements de bureau (ex: copieurs/imprimantes), les prises et APs sont masquées
          if (activeViewMode === "HR") {
            return n.subType === "PRINTER_STATION" || n.outletRole === "PRINTER";
          }
          return true;
        })
        .map((outlet) => {
          const isSelected = isNodeSelected(outlet.id);
          const shouldShowOutletLabel = showAllLabels || isSelected || hoveredNodeId === outlet.id;
          const isFloorBox = outlet.subType === "FLOOR_BOX";
          const isWifiAp = outlet.subType === "WIFI_AP";
          const isPrinter = outlet.subType === "PRINTER_STATION" || outlet.outletRole === "PRINTER";

          const linkedDesk = outlet.attachedToDeskId
            ? nodes.find((n) => n.id === outlet.attachedToDeskId)
            : undefined;
          const isLinked = Boolean(linkedDesk);

          const interactiveProps = {
            draggable: true,
            onMouseEnter: (e: KonvaEventObject<MouseEvent>) => handleNodeMouseEnter(outlet.id, e),
            onMouseLeave: (e: KonvaEventObject<MouseEvent>) => handleNodeMouseLeave(outlet.id, e),
            onDragStart: (e: KonvaEventObject<DragEvent>) => handleNodeDragStart(outlet.id, e),
            onDragMove: (e: KonvaEventObject<DragEvent>) => handleNodeDragMove(outlet.id, e),
            onDragEnd: (e: KonvaEventObject<DragEvent>) => handleDragEnd(outlet.id, e),
            onClick: (e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              if (isMarqueeJustEnded?.()) return;
              if (onSelectNodeToggle) {
                onSelectNodeToggle(outlet, e.evt.shiftKey);
              } else {
                onSelectOutlet(outlet);
                onSelectNode?.(outlet);
              }
            },
            onTap: (e: KonvaEventObject<TouchEvent>) => {
              e.cancelBubble = true;
              if (isMarqueeJustEnded?.()) return;
              if (onSelectNodeToggle) {
                onSelectNodeToggle(outlet, false);
              } else {
                onSelectOutlet(outlet);
                onSelectNode?.(outlet);
              }
            },
            onContextMenu: (e: KonvaEventObject<PointerEvent>) => {
              e.evt.preventDefault();
              e.cancelBubble = true;
              onNodeContextMenu?.(outlet, { x: e.evt.clientX, y: e.evt.clientY });
            },
          };

          // Rendu Boîte de Sol encastrée (Nourrice inox 4x RJ45)
          if (isFloorBox) {
            const vlan20Color =
              vlanStyles?.[20]?.color ?? DEFAULT_VLAN_STYLES[20]?.color ?? "#38bdf8";
            const vlan30Color =
              vlanStyles?.[30]?.color ?? DEFAULT_VLAN_STYLES[30]?.color ?? "#a855f7";

            return (
              <Group
                key={outlet.id}
                id={outlet.id}
                x={outlet.xMm}
                y={outlet.yMm}
                {...interactiveProps}
              >
                {/* Cadre inox extérieur de la boîte de sol */}
                <Rect
                  x={-150}
                  y={-150}
                  width={300}
                  height={300}
                  fill={isSelected ? "#1e293b" : "#0f172a"}
                  stroke={isSelected ? "#93c5fd" : isLinked ? "#38bdf8" : "#94a3b8"}
                  strokeWidth={isSelected ? 35 : 22}
                  cornerRadius={20}
                />
                {/* Trappe centrale encastrée avec rainures */}
                <Rect
                  x={-110}
                  y={-110}
                  width={220}
                  height={220}
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth={10}
                  cornerRadius={10}
                  listening={false}
                />
                {/* 4 Connecteurs RJ45 avec contour couleur VLAN et statut vert/rouge */}
                <Rect
                  x={-80}
                  y={-80}
                  width={65}
                  height={65}
                  fill="#0f172a"
                  stroke={vlan20Color}
                  strokeWidth={6}
                  cornerRadius={8}
                  listening={false}
                />
                <Circle
                  x={-47}
                  y={-47}
                  radius={8}
                  fill={outlet.pingStatus === "ONLINE" ? "#22c55e" : "#ef4444"}
                  listening={false}
                />

                <Rect
                  x={15}
                  y={-80}
                  width={65}
                  height={65}
                  fill="#0f172a"
                  stroke={vlan20Color}
                  strokeWidth={6}
                  cornerRadius={8}
                  listening={false}
                />
                <Circle
                  x={47}
                  y={-47}
                  radius={8}
                  fill={outlet.pingStatus === "ONLINE" ? "#22c55e" : "#ef4444"}
                  listening={false}
                />

                <Rect
                  x={-80}
                  y={15}
                  width={65}
                  height={65}
                  fill="#0f172a"
                  stroke={vlan30Color}
                  strokeWidth={6}
                  cornerRadius={8}
                  listening={false}
                />
                <Circle
                  x={-47}
                  y={47}
                  radius={8}
                  fill={outlet.pingStatus === "ONLINE" ? "#22c55e" : "#ef4444"}
                  listening={false}
                />

                <Rect
                  x={15}
                  y={15}
                  width={65}
                  height={65}
                  fill="#0f172a"
                  stroke={vlan30Color}
                  strokeWidth={6}
                  cornerRadius={8}
                  listening={false}
                />
                <Circle
                  x={47}
                  y={47}
                  radius={8}
                  fill={outlet.pingStatus === "ONLINE" ? "#22c55e" : "#ef4444"}
                  listening={false}
                />

                {/* Passe-câbles brosse */}
                <Rect
                  x={-80}
                  y={-100}
                  width={160}
                  height={12}
                  fill="#000"
                  cornerRadius={4}
                  listening={false}
                />

                {/* Libellé Boîte de Sol (au survol / sélection / global) */}
                {shouldShowOutletLabel &&
                  (() => {
                    const badgeHeight = 88;
                    const textFontSize = 50;
                    const badgeWidth = 520;
                    const labelPos = outlet.labelPosition || "RIGHT";
                    const { x: groupX, y: groupY } = getLabelCoordinates(
                      labelPos,
                      300,
                      300,
                      badgeWidth,
                      badgeHeight,
                      20
                    );

                    return (
                      <Group x={groupX} y={groupY} listening={false}>
                        <Rect
                          x={0}
                          y={0}
                          width={badgeWidth}
                          height={badgeHeight}
                          fill="rgba(15, 23, 42, 0.96)"
                          stroke={isSelected ? "#ffffff" : isLinked ? "#38bdf8" : "#475569"}
                          strokeWidth={isSelected ? 6 : 4}
                          cornerRadius={14}
                        />
                        <Text
                          x={18}
                          y={(badgeHeight - textFontSize) / 2}
                          width={badgeWidth - 36}
                          text="📦 Boîte de Sol (4x RJ45)"
                          fontSize={textFontSize}
                          fontFamily="sans-serif"
                          fontStyle="bold"
                          fill={isSelected ? "#ffffff" : "#38bdf8"}
                          wrap="none"
                          ellipsis={true}
                        />
                      </Group>
                    );
                  })()}
              </Group>
            );
          }

          // Rendu Borne Wi-Fi Ceiling AP
          if (isWifiAp) {
            const vlan50Color =
              vlanStyles?.[50]?.color ?? DEFAULT_VLAN_STYLES[50]?.color ?? "#6366f1";
            const isConnected =
              outlet.isPatched !== undefined ? outlet.isPatched : outlet.pingStatus === "ONLINE";
            const statusColor = isConnected ? "#22c55e" : "#ef4444";

            return (
              <Group
                key={outlet.id}
                id={outlet.id}
                x={outlet.xMm}
                y={outlet.yMm}
                {...interactiveProps}
              >
                {/* Onde radio Wi-Fi externe */}
                <Circle
                  radius={180}
                  stroke={vlan50Color}
                  strokeWidth={10}
                  dash={[30, 20]}
                  opacity={0.6}
                  listening={false}
                />
                {/* Dôme plafonnier avec contour VLAN */}
                <Circle
                  radius={120}
                  fill={isSelected ? "#312e81" : "#1e1b4b"}
                  stroke={isSelected ? "#c7d2fe" : vlan50Color}
                  strokeWidth={20}
                />
                {/* LED d'état centrale verte ou rouge */}
                <Circle radius={25} fill={statusColor} listening={false} />

                {/* Libellé Wi-Fi (au survol / sélection / global) */}
                {shouldShowOutletLabel &&
                  (() => {
                    const badgeHeight = 88;
                    const textFontSize = 50;
                    const badgeWidth = 480;
                    const labelPos = outlet.labelPosition || "RIGHT";
                    const { x: groupX, y: groupY } = getLabelCoordinates(
                      labelPos,
                      260,
                      260,
                      badgeWidth,
                      badgeHeight,
                      20
                    );

                    return (
                      <Group x={groupX} y={groupY} listening={false}>
                        <Rect
                          x={0}
                          y={0}
                          width={badgeWidth}
                          height={badgeHeight}
                          fill="rgba(15, 23, 42, 0.96)"
                          stroke={isSelected ? "#ffffff" : vlan50Color}
                          strokeWidth={isSelected ? 6 : 4}
                          cornerRadius={14}
                        />
                        <Text
                          x={18}
                          y={(badgeHeight - textFontSize) / 2}
                          width={badgeWidth - 36}
                          text="📡 Wi-Fi 6 • Plafonnier"
                          fontSize={textFontSize}
                          fontFamily="sans-serif"
                          fontStyle="bold"
                          fill={isSelected ? "#ffffff" : "#c7d2fe"}
                          wrap="none"
                          ellipsis={true}
                        />
                      </Group>
                    );
                  })()}
              </Group>
            );
          }

          // Rendu Copieur / Imprimante Réseau
          if (isPrinter) {
            const vlan40Color =
              vlanStyles?.[40]?.color ?? DEFAULT_VLAN_STYLES[40]?.color ?? "#f59e0b";
            const isConnected =
              outlet.isPatched !== undefined ? outlet.isPatched : outlet.pingStatus === "ONLINE";
            const statusColor = isConnected ? "#22c55e" : "#ef4444";

            return (
              <Group
                key={outlet.id}
                id={outlet.id}
                x={outlet.xMm}
                y={outlet.yMm}
                {...interactiveProps}
              >
                {/* Corps de l'imprimante */}
                <Rect
                  x={-200}
                  y={-175}
                  width={400}
                  height={350}
                  fill={isSelected ? "#78350f" : "#1e293b"}
                  stroke={isSelected ? "#fde68a" : vlan40Color}
                  strokeWidth={isSelected ? 26 : 18}
                  cornerRadius={25}
                />
                {/* Vitre scanner & bac papier */}
                <Rect
                  x={-160}
                  y={-140}
                  width={320}
                  height={180}
                  fill="#0f172a"
                  stroke="#b45309"
                  strokeWidth={10}
                  cornerRadius={10}
                  listening={false}
                />
                <Rect
                  x={-160}
                  y={70}
                  width={320}
                  height={70}
                  fill="#334155"
                  cornerRadius={6}
                  listening={false}
                />
                {/* Voyant LED de statut vert ou rouge */}
                <Circle x={140} y={-115} radius={14} fill={statusColor} listening={false} />

                {/* Libellé Copieur (au survol / sélection / global) */}
                {shouldShowOutletLabel &&
                  (() => {
                    const badgeHeight = 88;
                    const textFontSize = 50;
                    const badgeWidth = 440;
                    const labelPos = outlet.labelPosition || "RIGHT";
                    const { x: groupX, y: groupY } = getLabelCoordinates(
                      labelPos,
                      400,
                      350,
                      badgeWidth,
                      badgeHeight,
                      20
                    );

                    return (
                      <Group x={groupX} y={groupY} listening={false}>
                        <Rect
                          x={0}
                          y={0}
                          width={badgeWidth}
                          height={badgeHeight}
                          fill="rgba(15, 23, 42, 0.96)"
                          stroke={isSelected ? "#ffffff" : "#d97706"}
                          strokeWidth={isSelected ? 6 : 4}
                          cornerRadius={14}
                        />
                        <Text
                          x={18}
                          y={(badgeHeight - textFontSize) / 2}
                          width={badgeWidth - 36}
                          text="🖨️ Copieur RH"
                          fontSize={textFontSize}
                          fontFamily="sans-serif"
                          fontStyle="bold"
                          fill={isSelected ? "#ffffff" : "#fbbf24"}
                          wrap="none"
                          ellipsis={true}
                        />
                      </Group>
                    );
                  })()}
              </Group>
            );
          }

          // Rendu Colonnette / Plastron Multi-Ports RJ45 (Stacké 2 à 8 ports)
          if (outlet.stackedPorts && outlet.stackedPorts.length > 1) {
            const portsCount = Math.min(8, outlet.stackedPorts.length);
            const isTwoColumns = portsCount >= 5;
            const blockWidth = isTwoColumns ? 520 : 340;
            const rows = isTwoColumns ? Math.ceil(portsCount / 2) : portsCount;
            const blockHeight = 85 + rows * 85;

            return (
              <Group
                key={outlet.id}
                id={outlet.id}
                x={outlet.xMm}
                y={outlet.yMm}
                {...interactiveProps}
              >
                {/* Châssis métallique de la colonnette multi-ports */}
                <Rect
                  x={-blockWidth / 2}
                  y={-blockHeight / 2}
                  width={blockWidth}
                  height={blockHeight}
                  fill={isSelected ? "#0f172a" : "#1e293b"}
                  stroke={isSelected ? "#38bdf8" : isLinked ? "#0284c7" : "#475569"}
                  strokeWidth={isSelected ? 24 : 14}
                  cornerRadius={20}
                />
                {/* En-tête bandeau colonnette épuré */}
                <Rect
                  x={-blockWidth / 2 + 10}
                  y={-blockHeight / 2 + 10}
                  width={blockWidth - 20}
                  height={36}
                  fill="#0f172a"
                  cornerRadius={8}
                  listening={false}
                />
                <Text
                  x={-blockWidth / 2 + 20}
                  y={-blockHeight / 2 + 18}
                  text={`COLONNETTE ${portsCount}x RJ45`}
                  fontSize={22}
                  fontFamily="sans-serif"
                  fontStyle="bold"
                  fill="#94a3b8"
                  listening={false}
                />

                {/* Ports RJ45 individuels : contour couleur du VLAN, vert (connecté) ou rouge (déconnecté) */}
                {outlet.stackedPorts.map((sp, idx) => {
                  const col = isTwoColumns ? (idx % 2 === 0 ? 0 : 1) : 0;
                  const row = isTwoColumns ? Math.floor(idx / 2) : idx;
                  const portX = isTwoColumns ? (col === 0 ? -blockWidth / 4 : blockWidth / 4) : 0;
                  const portY = -blockHeight / 2 + 70 + row * 82;

                  const portVlan = sp.vlanId ?? outlet.vlanId ?? 20;
                  const vlanColor =
                    vlanStyles?.[portVlan]?.color ??
                    DEFAULT_VLAN_STYLES[portVlan]?.color ??
                    "#38bdf8";
                  const isConnected =
                    sp.isPatched !== undefined
                      ? sp.isPatched
                      : outlet.isPatched !== undefined
                        ? outlet.isPatched
                        : sp.pingStatus === "ONLINE";
                  const statusColor = isConnected ? "#22c55e" : "#ef4444";

                  return (
                    <Group key={`sp-${sp.portIndex}`} x={portX} y={portY} listening={false}>
                      {/* Embase RJ45 avec contour à la couleur du VLAN */}
                      <Rect
                        x={-80}
                        y={-30}
                        width={160}
                        height={60}
                        fill="#0f172a"
                        stroke={vlanColor}
                        strokeWidth={6}
                        cornerRadius={10}
                      />
                      {/* Prise RJ45 centrale colorée avec statut vert/rouge */}
                      <Rect
                        x={-65}
                        y={-20}
                        width={42}
                        height={40}
                        fill="#1e293b"
                        stroke={statusColor}
                        strokeWidth={4}
                        cornerRadius={6}
                      />
                      {/* Voyant / LED de statut vert/rouge */}
                      <Circle
                        x={-15}
                        y={0}
                        radius={8}
                        fill={statusColor}
                        stroke={statusColor === "#22c55e" ? "#166534" : "#991b1b"}
                        strokeWidth={2}
                        listening={false}
                      />
                      {/* Numéro de port sobre et lisible sans texte surchargé */}
                      <Text
                        x={10}
                        y={-12}
                        text={`P${idx + 1}`}
                        fontSize={26}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill="#f8fafc"
                      />
                    </Group>
                  );
                })}

                {/* Cartouche d'identification (visible au survol, si sélectionné, ou si global) */}
                {shouldShowOutletLabel &&
                  (() => {
                    const icon = outlet.customEmote || "🔲";
                    const poeText =
                      outlet.poeMode === "POE_PLUS_PLUS"
                        ? " • ⚡PoE++"
                        : outlet.poeMode === "POE_PLUS"
                          ? " • ⚡PoE+"
                          : outlet.poeMode === "POE"
                            ? " • ⚡PoE"
                            : "";
                    const vlanText = outlet.vlanId ? ` [VLAN ${outlet.vlanId}]` : "";
                    const title = `${icon} Colonnette (${portsCount}P)${poeText}${vlanText} • ${outlet.name}`;
                    const badgeHeight = 88;
                    const textFontSize = 50;
                    const badgeWidth = Math.min(950, Math.max(380, title.length * 28 + 60));
                    const labelPos = outlet.labelPosition || "RIGHT";
                    const colonnetteVlan = outlet.vlanId ?? outlet.stackedPorts?.[0]?.vlanId ?? 20;
                    const badgeVlanColor =
                      vlanStyles?.[colonnetteVlan]?.color ??
                      DEFAULT_VLAN_STYLES[colonnetteVlan]?.color ??
                      "#38bdf8";
                    const { x: groupX, y: groupY } = getLabelCoordinates(
                      labelPos,
                      blockWidth,
                      blockHeight,
                      badgeWidth,
                      badgeHeight,
                      25
                    );

                    return (
                      <Group x={groupX} y={groupY} listening={false}>
                        <Rect
                          x={0}
                          y={0}
                          width={badgeWidth}
                          height={badgeHeight}
                          fill="rgba(15, 23, 42, 0.96)"
                          stroke={isSelected ? "#ffffff" : badgeVlanColor}
                          strokeWidth={isSelected ? 6 : 4}
                          cornerRadius={14}
                        />
                        <Text
                          x={18}
                          y={(badgeHeight - textFontSize) / 2}
                          width={badgeWidth - 36}
                          text={title}
                          fontSize={textFontSize}
                          fontFamily="sans-serif"
                          fontStyle="bold"
                          fill={isSelected ? "#ffffff" : "#38bdf8"}
                          wrap="none"
                          ellipsis={true}
                        />
                      </Group>
                    );
                  })()}
              </Group>
            );
          }

          // Rendu Plastron Mural Standard RJ45 (Data ou VoIP ou Générique avec Émote & PoE)
          const isVoipRole = outlet.outletRole === "VOIP";
          const roleIcon = outlet.customEmote || (isVoipRole ? "📞" : "🔌");
          const vlanId = outlet.vlanId ?? (isVoipRole ? 30 : 20);
          const vlanColor =
            vlanStyles?.[vlanId]?.color ??
            DEFAULT_VLAN_STYLES[vlanId]?.color ??
            (isVoipRole ? "#c084fc" : "#38bdf8");
          const isConnected =
            outlet.isPatched !== undefined ? outlet.isPatched : outlet.pingStatus === "ONLINE";
          const statusColor = isConnected ? "#22c55e" : "#ef4444";

          return (
            <Group
              key={outlet.id}
              id={outlet.id}
              x={outlet.xMm}
              y={outlet.yMm}
              {...interactiveProps}
            >
              {/* Plastron mural épuré avec contour couleur VLAN */}
              <Rect
                x={-110}
                y={-110}
                width={220}
                height={220}
                fill={isSelected ? "#0f172a" : "#1e293b"}
                stroke={isSelected ? "#ffffff" : vlanColor}
                strokeWidth={isSelected ? 20 : 12}
                cornerRadius={28}
              />

              {/* Connecteur RJ45 frontal ou Émote personnalisée */}
              {outlet.customEmote ? (
                <Text
                  x={-55}
                  y={-55}
                  width={110}
                  height={110}
                  text={outlet.customEmote}
                  fontSize={75}
                  align="center"
                  verticalAlign="middle"
                  listening={false}
                />
              ) : (
                <Group listening={false}>
                  <Rect
                    x={-42}
                    y={-42}
                    width={84}
                    height={84}
                    fill="#0f172a"
                    stroke={statusColor}
                    strokeWidth={6}
                    cornerRadius={12}
                  />
                  <Rect
                    x={-24}
                    y={-24}
                    width={48}
                    height={48}
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth={4}
                    cornerRadius={8}
                  />
                </Group>
              )}

              {/* Pastille de statut connecté (vert) ou déconnecté (rouge) */}
              <Circle
                x={70}
                y={-70}
                radius={14}
                fill={statusColor}
                stroke="#0f172a"
                strokeWidth={4}
                listening={false}
              />

              {/* Cartouche d'identification (visible au survol, si sélectionné ou global) */}
              {shouldShowOutletLabel &&
                (() => {
                  const poeText =
                    outlet.poeMode === "POE_PLUS_PLUS"
                      ? " ⚡PoE++"
                      : outlet.poeMode === "POE_PLUS"
                        ? " ⚡PoE+"
                        : outlet.poeMode === "POE"
                          ? " ⚡PoE"
                          : "";
                  const vlanText = outlet.vlanId ? ` [VLAN ${outlet.vlanId}]` : "";

                  let shortOutletText = "";
                  if (outlet.assignedPerson) {
                    shortOutletText = `${roleIcon} ${outlet.assignedPerson}${poeText}${vlanText}`;
                  } else {
                    const cleanName = outlet.name
                      .replace(/^PRISE-DESK-/i, "Prise ")
                      .replace(/^PRISE-BENCH-/i, "Prise ")
                      .replace(/^PRISE-/i, "Prise ");
                    shortOutletText = `${roleIcon} ${cleanName}${poeText}${vlanText}`;
                  }

                  const badgeHeight = 88;
                  const textFontSize = 50;
                  const badgeWidth = Math.min(920, Math.max(360, shortOutletText.length * 30 + 60));
                  const labelPos = outlet.labelPosition || "RIGHT";
                  const { x: groupX, y: groupY } = getLabelCoordinates(
                    labelPos,
                    220,
                    220,
                    badgeWidth,
                    badgeHeight,
                    20
                  );

                  return (
                    <Group x={groupX} y={groupY} listening={false}>
                      <Rect
                        x={0}
                        y={0}
                        width={badgeWidth}
                        height={badgeHeight}
                        fill="rgba(15, 23, 42, 0.96)"
                        stroke={isSelected ? "#ffffff" : isLinked ? vlanColor : "#475569"}
                        strokeWidth={isSelected ? 6 : 4}
                        cornerRadius={14}
                      />
                      <Text
                        x={18}
                        y={(badgeHeight - textFontSize) / 2}
                        width={badgeWidth - 36}
                        text={shortOutletText}
                        fontSize={textFontSize}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill={isSelected ? "#ffffff" : vlanColor}
                        wrap="none"
                        ellipsis={true}
                      />
                    </Group>
                  );
                })()}
            </Group>
          );
        })}
    </Group>
  );
};

export const EquipmentLayer = memo(EquipmentLayerComponent);
