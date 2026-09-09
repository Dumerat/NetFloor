"use client";

import { useRef, type FC } from "react";
import { Group, Rect, Text, Line, Circle } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";

export interface RackDisplay {
  id: string;
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
  uHeight: number;
}

export type OutletRole = "DATA" | "VOIP" | "WIFI" | "PRINTER" | "GENERIC";

export type NodeSubType =
  | "DESK_SOLO"
  | "DESK_COMPACT"
  | "DESK_EXECUTIVE"
  | "BENCH_DOUBLE"
  | "BENCH_QUAD"
  | "MEETING_TABLE"
  | "WALL_OUTLET"
  | "FLOOR_BOX"
  | "WIFI_AP"
  | "PRINTER_STATION"
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
}

interface EquipmentLayerProps {
  racks: RackDisplay[];
  nodes: NodeDisplay[];
  selectedOutletId?: string | null | undefined;
  selectedNodeId?: string | null | undefined;
  activeViewMode?: "ALL" | "HR" | "TECH" | "MAINTENANCE" | "NETWORK";
  onSelectOutlet: (outletNode: NodeDisplay) => void;
  onSelectNode?: ((node: NodeDisplay) => void) | undefined;
  onNodeMoveEnd: (id: string, newPos: { x: number; y: number }) => void;
  onNodeDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
  onRackDragMove?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
}

export const EquipmentLayer: FC<EquipmentLayerProps> = ({
  racks,
  nodes,
  selectedOutletId,
  selectedNodeId,
  activeViewMode = "ALL",
  onSelectOutlet,
  onSelectNode,
  onNodeMoveEnd,
  onNodeDragMove,
  onRackDragMove,
}) => {
  const activeSelectedId = selectedNodeId ?? selectedOutletId;

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

  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
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
    const attached = nodes.filter((n) => n.type === "WALL_OUTLET" && n.attachedToDeskId === desk.id);
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

          // 3. Mettre à jour l'extrémité du câble relié à cette prise
          const cableLineNode = stage.findOne("#cable-line-cable-run-" + item.id) as any;
          if (cableLineNode && typeof cableLineNode.points === "function") {
            const currentPts = cableLineNode.points();
            if (currentPts && currentPts.length >= 4) {
              const updatedPts = [...currentPts];
              updatedPts[0] = currentOutletX;
              updatedPts[1] = currentOutletY;
              updatedPts[2] = currentOutletX;
              cableLineNode.points(updatedPts);
            }
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
    handleDragEnd(desk.id, e);
  };

  const handleRackDragMove = (id: string, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    onRackDragMove?.(id, { x: e.target.x(), y: e.target.y() });
  };

  const handleNodeDragMove = (id: string, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    onNodeDragMove?.(id, { x: e.target.x(), y: e.target.y() });
  };

  const handleDragEnd = (id: string, e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
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
                  strokeWidth={18}
                  dash={isVoip ? [60, 40] : [70, 50]}
                  opacity={0.8}
                  listening={false}
                />
              </Group>
            );
          })}

      {/* 1. Baies Informatiques 19" Réalistes (Racks 42U) - Masquées en vue RH */}
      {activeViewMode !== "HR" &&
        racks.map((rack) => {
          const isSelected = activeSelectedId === rack.id;
          const rWidth = rack.widthMm ?? 800;
          const rDepth = rack.depthMm ?? 1000;

          return (
            <Group
              key={rack.id}
              x={rack.xMm}
              y={rack.yMm}
              draggable
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onDragStart={handleDragStart}
              onDragMove={(e) => handleRackDragMove(rack.id, e)}
              onDragEnd={(e) => handleDragEnd(rack.id, e)}
              onClick={() =>
                onSelectNode?.({
                  id: rack.id,
                  type: "PATCH_PANEL",
                  name: rack.name,
                  xMm: rack.xMm,
                  yMm: rack.yMm,
                  widthMm: rWidth,
                  heightMm: rDepth,
                  subType: "RACK_42U",
                  description: `Baie informatique standard 19" (${rack.uHeight}U) avec commutateurs Cisco et bandeaux Cat6A.`,
                })
              }
              onTap={() =>
                onSelectNode?.({
                  id: rack.id,
                  type: "PATCH_PANEL",
                  name: rack.name,
                  xMm: rack.xMm,
                  yMm: rack.yMm,
                  widthMm: rWidth,
                  heightMm: rDepth,
                  subType: "RACK_42U",
                  description: `Baie informatique standard 19" (${rack.uHeight}U) avec commutateurs Cisco et bandeaux Cat6A.`,
                })
              }
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
              {/* Montants intérieurs normalisés 19 pouces (Rails de rack) */}
              <Rect
                x={70}
                y={130}
                width={16}
                height={rDepth - 220}
                fill="#64748b"
                cornerRadius={4}
                listening={false}
              />
              <Rect
                x={rWidth - 86}
                y={130}
                width={16}
                height={rDepth - 220}
                fill="#64748b"
                cornerRadius={4}
                listening={false}
              />

              {/* Bandeau supérieur d'identification & Statut Baie */}
              <Rect
                x={40}
                y={40}
                width={rWidth - 80}
                height={95}
                fill="rgba(2, 6, 23, 0.92)"
                stroke={isSelected ? "#38bdf8" : "#2563eb"}
                strokeWidth={8}
                cornerRadius={14}
                listening={false}
              />
              <Text
                x={55}
                y={58}
                width={rWidth - 190}
                text={`⚡ ${rack.name}`}
                fontSize={56}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#38bdf8"
                wrap="none"
                ellipsis={true}
                listening={false}
              />
              <Text
                x={rWidth - 165}
                y={60}
                width={110}
                text={`${rack.uHeight}U`}
                fontSize={52}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#93c5fd"
                align="right"
                wrap="none"
                listening={false}
              />

              {/* Voyants LED d'état (Power vert, Uplink bleu) */}
              <Circle
                x={rWidth - 195}
                y={75}
                radius={12}
                fill="#22c55e"
                shadowColor="#22c55e"
                shadowBlur={15}
                listening={false}
              />
              <Circle
                x={rWidth - 225}
                y={75}
                radius={12}
                fill="#38bdf8"
                shadowColor="#38bdf8"
                shadowBlur={15}
                listening={false}
              />

              {/* Équipement U24 : Panneau de Brassage Cat6A (24 ports) */}
              <Rect
                x={95}
                y={160}
                width={rWidth - 190}
                height={120}
                fill="#1e293b"
                stroke="#64748b"
                strokeWidth={8}
                cornerRadius={12}
                listening={false}
              />
              <Text
                x={115}
                y={180}
                width={rWidth - 230}
                text="U24: PP-24P-CAT6A (Data/VoIP)"
                fontSize={46}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#f1f5f9"
                wrap="none"
                ellipsis={true}
                listening={false}
              />
              {/* Ports RJ45 du bandeau */}
              {Array.from({ length: 12 }).map((_, i) => (
                <Rect
                  key={`pp-port-${i}`}
                  x={120 + i * ((rWidth - 250) / 12)}
                  y={235}
                  width={22}
                  height={22}
                  fill={i < 8 ? "#38bdf8" : "#334155"}
                  cornerRadius={4}
                  listening={false}
                />
              ))}

              {/* Équipement U22 : Switch Cisco Catalyst 9300 */}
              <Rect
                x={95}
                y={305}
                width={rWidth - 190}
                height={120}
                fill="#172554"
                stroke="#3b82f6"
                strokeWidth={8}
                cornerRadius={12}
                listening={false}
              />
              <Text
                x={115}
                y={325}
                width={rWidth - 230}
                text="U22: CISCO C9300-24P (Gigabit)"
                fontSize={46}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#93c5fd"
                wrap="none"
                ellipsis={true}
                listening={false}
              />
              {/* LED d'activité des ports du switch */}
              {Array.from({ length: 12 }).map((_, i) => (
                <Circle
                  key={`sw-led-${i}`}
                  x={125 + i * ((rWidth - 250) / 12)}
                  y={385}
                  radius={7}
                  fill={i < 7 ? "#22c55e" : "#475569"}
                  listening={false}
                />
              ))}

              {/* Équipement U18 : Guide-câbles horizontal 1U */}
              <Rect
                x={95}
                y={445}
                width={rWidth - 190}
                height={70}
                fill="#0f172a"
                stroke="#334155"
                strokeWidth={6}
                cornerRadius={8}
                listening={false}
              />
              <Text
                x={115}
                y={462}
                width={rWidth - 230}
                text="U18: Guide-câbles horizontal 1U"
                fontSize={38}
                fontFamily="monospace"
                fill="#64748b"
                wrap="none"
                ellipsis={true}
                listening={false}
              />

              {/* Grille de ventilation inférieure */}
              {Array.from({ length: 4 }).map((_, i) => (
                <Circle
                  key={`fan-${i}`}
                  x={160 + i * ((rWidth - 320) / 3)}
                  y={rDepth - 100}
                  radius={50}
                  stroke="#334155"
                  strokeWidth={10}
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
          const isSelected = activeSelectedId === desk.id;
          const width = desk.widthMm ?? 1600;
          const height = desk.heightMm ?? 800;
          const rotDeg = desk.rotationDeg ?? 0;
          const isMeeting = desk.subType === "MEETING_TABLE";
          const isBenchQuad = desk.subType === "BENCH_QUAD";
          const isBenchDouble = desk.subType === "BENCH_DOUBLE";

          // Intitulé court : "Bureau {N}"
          const matchNum = desk.name.match(/\d+/);
          const shortTitle = matchNum ? `Bureau ${matchNum[0]}` : desk.name.replace(/^Poste\s+/i, "Bureau ");

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

          return (
            <Group
              key={desk.id}
              x={desk.xMm}
              y={desk.yMm}
              rotation={rotDeg}
              draggable
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onDragStart={(e) => handleDeskDragStart(desk, e)}
              onDragMove={(e) => handleDeskDragMove(desk, e)}
              onDragEnd={(e) => handleDeskDragEnd(desk, e)}
              onClick={() => onSelectNode?.(desk)}
              onTap={() => onSelectNode?.(desk)}
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
                  <Rect x={width / 4 - 210} y={height / 2 - 120} width={420} height={38} fill="#0284c7" stroke="#38bdf8" strokeWidth={7} cornerRadius={6} />
                  <Rect x={width / 4 - 45} y={height / 2 - 82} width={90} height={22} fill="#475569" cornerRadius={5} />
                  <Rect x={width / 4 - 160} y={80} width={320} height={95} fill="#1e293b" stroke="#334155" strokeWidth={7} cornerRadius={8} />

                  {/* Place 1 (Haut-Droite) */}
                  <Rect x={(3 * width) / 4 - 210} y={height / 2 - 120} width={420} height={38} fill="#0284c7" stroke="#38bdf8" strokeWidth={7} cornerRadius={6} />
                  <Rect x={(3 * width) / 4 - 45} y={height / 2 - 82} width={90} height={22} fill="#475569" cornerRadius={5} />
                  <Rect x={(3 * width) / 4 - 160} y={80} width={320} height={95} fill="#1e293b" stroke="#334155" strokeWidth={7} cornerRadius={8} />

                  {/* Place 2 (Bas-Gauche) */}
                  <Rect x={width / 4 - 210} y={height / 2 + 82} width={420} height={38} fill="#0284c7" stroke="#38bdf8" strokeWidth={7} cornerRadius={6} />
                  <Rect x={width / 4 - 45} y={height / 2 + 60} width={90} height={22} fill="#475569" cornerRadius={5} />
                  <Rect x={width / 4 - 160} y={height - 175} width={320} height={95} fill="#1e293b" stroke="#334155" strokeWidth={7} cornerRadius={8} />

                  {/* Place 3 (Bas-Droite) */}
                  <Rect x={(3 * width) / 4 - 210} y={height / 2 + 82} width={420} height={38} fill="#0284c7" stroke="#38bdf8" strokeWidth={7} cornerRadius={6} />
                  <Rect x={(3 * width) / 4 - 45} y={height / 2 + 60} width={90} height={22} fill="#475569" cornerRadius={5} />
                  <Rect x={(3 * width) / 4 - 160} y={height - 175} width={320} height={95} fill="#1e293b" stroke="#334155" strokeWidth={7} cornerRadius={8} />

                  {/* 4 Chaises (2 en haut tournées vers le bas, 2 en bas tournées vers le haut) */}
                  {desk.chairPosition !== "NONE" && (
                    <Group listening={false}>
                      {/* Chaise 0 (Top-Left) */}
                      <Rect x={width / 4 - 190} y={-380} width={380} height={320} fill="#1e293b" stroke="#475569" strokeWidth={12} cornerRadius={45} />
                      <Rect x={width / 4 - 170} y={-360} width={340} height={75} fill="#0f172a" stroke="#64748b" strokeWidth={10} cornerRadius={35} />
                      <Rect x={width / 4 - 210} y={-300} width={35} height={160} fill="#334155" cornerRadius={12} />
                      <Rect x={width / 4 + 175} y={-300} width={35} height={160} fill="#334155" cornerRadius={12} />

                      {/* Chaise 1 (Top-Right) */}
                      <Rect x={(3 * width) / 4 - 190} y={-380} width={380} height={320} fill="#1e293b" stroke="#475569" strokeWidth={12} cornerRadius={45} />
                      <Rect x={(3 * width) / 4 - 170} y={-360} width={340} height={75} fill="#0f172a" stroke="#64748b" strokeWidth={10} cornerRadius={35} />
                      <Rect x={(3 * width) / 4 - 210} y={-300} width={35} height={160} fill="#334155" cornerRadius={12} />
                      <Rect x={(3 * width) / 4 + 175} y={-300} width={35} height={160} fill="#334155" cornerRadius={12} />

                      {/* Chaise 2 (Bottom-Left) */}
                      <Rect x={width / 4 - 190} y={height + 50} width={380} height={320} fill="#1e293b" stroke="#475569" strokeWidth={12} cornerRadius={45} />
                      <Rect x={width / 4 - 170} y={height + 280} width={340} height={75} fill="#0f172a" stroke="#64748b" strokeWidth={10} cornerRadius={35} />
                      <Rect x={width / 4 - 210} y={height + 130} width={35} height={160} fill="#334155" cornerRadius={12} />
                      <Rect x={width / 4 + 175} y={height + 130} width={35} height={160} fill="#334155" cornerRadius={12} />

                      {/* Chaise 3 (Bottom-Right) */}
                      <Rect x={(3 * width) / 4 - 190} y={height + 50} width={380} height={320} fill="#1e293b" stroke="#475569" strokeWidth={12} cornerRadius={45} />
                      <Rect x={(3 * width) / 4 - 170} y={height + 280} width={340} height={75} fill="#0f172a" stroke="#64748b" strokeWidth={10} cornerRadius={35} />
                      <Rect x={(3 * width) / 4 - 210} y={height + 130} width={35} height={160} fill="#334155" cornerRadius={12} />
                      <Rect x={(3 * width) / 4 + 175} y={height + 130} width={35} height={160} fill="#334155" cornerRadius={12} />
                    </Group>
                  )}
                </Group>
              )}

              {!isMeeting && isBenchDouble && (
                <Group listening={false}>
                  {/* Écran & Clavier Place 0 (Haut) */}
                  <Rect x={width / 2 - 210} y={height / 2 - 120} width={420} height={38} fill="#0284c7" stroke="#38bdf8" strokeWidth={7} cornerRadius={6} />
                  <Rect x={width / 2 - 45} y={height / 2 - 82} width={90} height={22} fill="#475569" cornerRadius={5} />
                  <Rect x={width / 2 - 160} y={80} width={320} height={95} fill="#1e293b" stroke="#334155" strokeWidth={7} cornerRadius={8} />

                  {/* Écran & Clavier Place 1 (Bas) */}
                  <Rect x={width / 2 - 210} y={height / 2 + 82} width={420} height={38} fill="#0284c7" stroke="#38bdf8" strokeWidth={7} cornerRadius={6} />
                  <Rect x={width / 2 - 45} y={height / 2 + 60} width={90} height={22} fill="#475569" cornerRadius={5} />
                  <Rect x={width / 2 - 160} y={height - 175} width={320} height={95} fill="#1e293b" stroke="#334155" strokeWidth={7} cornerRadius={8} />

                  {/* 2 Chaises (1 en haut tournée vers le bas, 1 en bas tournée vers le haut) */}
                  {desk.chairPosition !== "NONE" && (
                    <Group listening={false}>
                      {/* Chaise 0 (Top) */}
                      <Rect x={width / 2 - 190} y={-380} width={380} height={320} fill="#1e293b" stroke="#475569" strokeWidth={12} cornerRadius={45} />
                      <Rect x={width / 2 - 170} y={-360} width={340} height={75} fill="#0f172a" stroke="#64748b" strokeWidth={10} cornerRadius={35} />
                      <Rect x={width / 2 - 210} y={-300} width={35} height={160} fill="#334155" cornerRadius={12} />
                      <Rect x={width / 2 + 175} y={-300} width={35} height={160} fill="#334155" cornerRadius={12} />

                      {/* Chaise 1 (Bottom) */}
                      <Rect x={width / 2 - 190} y={height + 50} width={380} height={320} fill="#1e293b" stroke="#475569" strokeWidth={12} cornerRadius={45} />
                      <Rect x={width / 2 - 170} y={height + 280} width={340} height={75} fill="#0f172a" stroke="#64748b" strokeWidth={10} cornerRadius={35} />
                      <Rect x={width / 2 - 210} y={height + 130} width={35} height={160} fill="#334155" cornerRadius={12} />
                      <Rect x={width / 2 + 175} y={height + 130} width={35} height={160} fill="#334155" cornerRadius={12} />
                    </Group>
                  )}
                </Group>
              )}

              {!isMeeting && !isBenchDouble && !isBenchQuad && (
                <Group listening={false}>
                  {/* Écran Principal Solo */}
                  <Rect x={width / 2 - 220} y={80} width={440} height={40} fill="#0284c7" stroke="#38bdf8" strokeWidth={8} cornerRadius={6} />
                  <Rect x={width / 2 - 50} y={55} width={100} height={25} fill="#475569" cornerRadius={5} />
                  {/* Clavier Solo */}
                  <Rect x={width / 2 - 180} y={170} width={360} height={110} fill="#1e293b" stroke="#334155" strokeWidth={8} cornerRadius={8} />

                  {/* Fauteuil Solo Ergonomique */}
                  {desk.chairPosition !== "NONE" && (
                    <Group listening={false}>
                      <Rect x={width / 2 - 200} y={height + 50} width={400} height={350} fill="#1e293b" stroke="#475569" strokeWidth={12} cornerRadius={50} />
                      <Rect x={width / 2 - 180} y={height + 280} width={360} height={90} fill="#0f172a" stroke="#64748b" strokeWidth={10} cornerRadius={40} />
                      <Rect x={width / 2 - 220} y={height + 110} width={40} height={180} fill="#334155" cornerRadius={15} />
                      <Rect x={width / 2 + 180} y={height + 110} width={40} height={180} fill="#334155" cornerRadius={15} />
                    </Group>
                  )}
                </Group>
              )}

              {/* Cartouches d'identification épurés et TOUJOURS horizontaux (rotation={-rotDeg}) */}
              {isBenchQuad ? (
                // ÎLOT 4 POSTES : 4 Grands Badges Distincts + Pill Centrale
                <Group listening={false}>
                  {/* Badge Central Îlot */}
                  <Group x={width / 2} y={height / 2} rotation={-rotDeg} listening={false}>
                    <Rect x={-270} y={-50} width={540} height={100} fill="rgba(10, 15, 30, 0.96)" stroke={isSelected ? "#60a5fa" : "#0284c7"} strokeWidth={6} cornerRadius={18} />
                    <Text x={-260} y={-28} width={520} text={`${shortTitle} • Îlot 4P`} fontSize={60} fontFamily="sans-serif" fontStyle="bold" fill="#38bdf8" align="center" wrap="none" ellipsis={true} />
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
                      <Group key={`quad-seat-${idx}`} x={cx} y={cy} rotation={-rotDeg} listening={false}>
                        <Rect x={-bW / 2} y={-bH / 2} width={bW} height={bH} fill="rgba(15, 23, 42, 0.95)" stroke={isOccupied ? "#38bdf8" : "#475569"} strokeWidth={7} cornerRadius={18} />
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
              ) : isBenchDouble ? (
                // BENCH DOUBLE 2 POSTES : 2 Grands Badges Distincts + Pill Centrale
                <Group listening={false}>
                  {/* Badge Central Bench */}
                  <Group x={width / 2} y={height / 2} rotation={-rotDeg} listening={false}>
                    <Rect x={-250} y={-45} width={500} height={90} fill="rgba(10, 15, 30, 0.96)" stroke={isSelected ? "#60a5fa" : "#0284c7"} strokeWidth={6} cornerRadius={16} />
                    <Text x={-240} y={-26} width={480} text={`${shortTitle} • Bench 2P`} fontSize={56} fontFamily="sans-serif" fontStyle="bold" fill="#38bdf8" align="center" wrap="none" ellipsis={true} />
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
                      <Group key={`double-seat-${idx}`} x={cx} y={cy} rotation={-rotDeg} listening={false}>
                        <Rect x={-bW / 2} y={-bH / 2} width={bW} height={bH} fill="rgba(15, 23, 42, 0.95)" stroke={isOccupied ? "#38bdf8" : "#475569"} strokeWidth={7} cornerRadius={18} />
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
              ) : (
                // BUREAU SOLO OU TABLE DE RÉUNION
                (() => {
                  const isRotatedVertical = rotDeg % 180 !== 0;
                  const personLen = desk.assignedPerson?.length ?? 12;
                  const baseBadgeW = isRotatedVertical
                    ? Math.max(650, height - 60)
                    : Math.max(760, Math.min(width - 60, personLen * 40));
                  const badgeWidth = Math.max(baseBadgeW, 760);
                  const badgeHeight = 200;
                  const personFontSize = personLen > 16 ? 70 : 82;

                  return (
                    <Group
                      x={width / 2}
                      y={height / 2 + 50}
                      rotation={-rotDeg}
                      listening={false}
                    >
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
                        text={
                          desk.assignedPerson
                            ? `👤 ${desk.assignedPerson}`
                            : "👤 Poste Libre"
                        }
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
                })()
              )}
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
          const isSelected = activeSelectedId === outlet.id;
          const isFloorBox = outlet.subType === "FLOOR_BOX";
          const isWifiAp = outlet.subType === "WIFI_AP";
          const isPrinter = outlet.subType === "PRINTER_STATION" || outlet.outletRole === "PRINTER";
          const isVoip = outlet.outletRole === "VOIP";

          const linkedDesk = outlet.attachedToDeskId
            ? nodes.find((n) => n.id === outlet.attachedToDeskId)
            : undefined;
          const isLinked = Boolean(linkedDesk);

          // Rendu Boîte de Sol encastrée (Nourrice inox 4x RJ45)
          if (isFloorBox) {
            return (
              <Group
                key={outlet.id}
                id={outlet.id}
                x={outlet.xMm}
                y={outlet.yMm}
                draggable
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onDragStart={handleDragStart}
                onDragMove={(e) => handleNodeDragMove(outlet.id, e)}
                onDragEnd={(e) => handleDragEnd(outlet.id, e)}
                onClick={() => {
                  onSelectOutlet(outlet);
                  onSelectNode?.(outlet);
                }}
                onTap={() => {
                  onSelectOutlet(outlet);
                  onSelectNode?.(outlet);
                }}
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
                {/* 4 Connecteurs RJ45 en grille 2x2 */}
                <Rect x={-80} y={-80} width={65} height={65} fill="#0284c7" cornerRadius={6} listening={false} />
                <Rect x={15} y={-80} width={65} height={65} fill="#0284c7" cornerRadius={6} listening={false} />
                <Rect x={-80} y={15} width={65} height={65} fill="#c084fc" cornerRadius={6} listening={false} />
                <Rect x={15} y={15} width={65} height={65} fill="#c084fc" cornerRadius={6} listening={false} />

                {/* Passe-câbles brosse */}
                <Rect x={-80} y={-100} width={160} height={12} fill="#000" cornerRadius={4} listening={false} />

                {/* Libellé Boîte de Sol épuré mono-ligne */}
                <Group x={180} y={0} listening={false}>
                  <Rect
                    x={0}
                    y={-45}
                    width={480}
                    height={90}
                    fill="rgba(15, 23, 42, 0.94)"
                    stroke={isSelected ? "#ffffff" : isLinked ? "#38bdf8" : "#475569"}
                    strokeWidth={6}
                    cornerRadius={16}
                  />
                  <Text
                    x={20}
                    y={-24}
                    width={440}
                    text="📦 Boîte de Sol (4x RJ45)"
                    fontSize={68}
                    fontFamily="sans-serif"
                    fontStyle="bold"
                    fill={isSelected ? "#ffffff" : "#38bdf8"}
                  />
                </Group>
              </Group>
            );
          }

          // Rendu Borne Wi-Fi Ceiling AP
          if (isWifiAp) {
            return (
              <Group
                key={outlet.id}
                id={outlet.id}
                x={outlet.xMm}
                y={outlet.yMm}
                draggable
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onDragStart={handleDragStart}
                onDragMove={(e) => handleNodeDragMove(outlet.id, e)}
                onDragEnd={(e) => handleDragEnd(outlet.id, e)}
                onClick={() => {
                  onSelectOutlet(outlet);
                  onSelectNode?.(outlet);
                }}
                onTap={() => {
                  onSelectOutlet(outlet);
                  onSelectNode?.(outlet);
                }}
              >
                {/* Onde radio Wi-Fi externe */}
                <Circle radius={180} stroke="#818cf8" strokeWidth={10} dash={[30, 20]} opacity={0.6} listening={false} />
                {/* Dôme plafonnier */}
                <Circle
                  radius={120}
                  fill={isSelected ? "#312e81" : "#1e1b4b"}
                  stroke={isSelected ? "#c7d2fe" : "#818cf8"}
                  strokeWidth={25}
                />
                {/* LED d'état centrale verte */}
                <Circle radius={25} fill="#34d399" listening={false} />

                {/* Libellé Wi-Fi épuré mono-ligne */}
                <Group x={160} y={0} listening={false}>
                  <Rect
                    x={0}
                    y={-45}
                    width={450}
                    height={90}
                    fill="rgba(15, 23, 42, 0.94)"
                    stroke={isSelected ? "#ffffff" : "#818cf8"}
                    strokeWidth={6}
                    cornerRadius={16}
                  />
                  <Text
                    x={20}
                    y={-24}
                    width={410}
                    text="📡 Wi-Fi 6 • Plafonnier"
                    fontSize={68}
                    fontFamily="sans-serif"
                    fontStyle="bold"
                    fill={isSelected ? "#ffffff" : "#c7d2fe"}
                  />
                </Group>
              </Group>
            );
          }

          // Rendu Copieur / Imprimante Réseau
          if (isPrinter) {
            return (
              <Group
                key={outlet.id}
                id={outlet.id}
                x={outlet.xMm}
                y={outlet.yMm}
                draggable
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onDragStart={handleDragStart}
                onDragMove={(e) => handleNodeDragMove(outlet.id, e)}
                onDragEnd={(e) => handleDragEnd(outlet.id, e)}
                onClick={() => {
                  onSelectOutlet(outlet);
                  onSelectNode?.(outlet);
                }}
                onTap={() => {
                  onSelectOutlet(outlet);
                  onSelectNode?.(outlet);
                }}
              >
                {/* Corps de l'imprimante */}
                <Rect
                  x={-200}
                  y={-175}
                  width={400}
                  height={350}
                  fill={isSelected ? "#78350f" : "#1e293b"}
                  stroke={isSelected ? "#fde68a" : "#d97706"}
                  strokeWidth={isSelected ? 30 : 20}
                  cornerRadius={25}
                />
                {/* Vitre scanner & bac papier */}
                <Rect x={-160} y={-140} width={320} height={180} fill="#0f172a" stroke="#b45309" strokeWidth={10} cornerRadius={10} listening={false} />
                <Rect x={-160} y={70} width={320} height={70} fill="#334155" cornerRadius={6} listening={false} />

                {/* Libellé Copieur épuré mono-ligne */}
                <Group x={230} y={0} listening={false}>
                  <Rect
                    x={0}
                    y={-45}
                    width={400}
                    height={90}
                    fill="rgba(15, 23, 42, 0.94)"
                    stroke={isSelected ? "#ffffff" : "#d97706"}
                    strokeWidth={6}
                    cornerRadius={16}
                  />
                  <Text
                    x={20}
                    y={-24}
                    width={360}
                    text="🖨️ Copieur RH"
                    fontSize={68}
                    fontFamily="sans-serif"
                    fontStyle="bold"
                    fill={isSelected ? "#ffffff" : "#fbbf24"}
                  />
                </Group>
              </Group>
            );
          }

          // Rendu Colonnette / Plastron Multi-Ports RJ45 (Stacké 2 à 8 ports)
          if (outlet.stackedPorts && outlet.stackedPorts.length > 1) {
            const portsCount = Math.min(8, outlet.stackedPorts.length);
            const isTwoColumns = portsCount >= 5;
            const blockWidth = isTwoColumns ? 520 : 340;
            const rows = isTwoColumns ? Math.ceil(portsCount / 2) : portsCount;
            const blockHeight = 100 + rows * 95;

            return (
              <Group
                key={outlet.id}
                id={outlet.id}
                x={outlet.xMm}
                y={outlet.yMm}
                draggable
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onDragStart={handleDragStart}
                onDragMove={(e) => handleNodeDragMove(outlet.id, e)}
                onDragEnd={(e) => handleDragEnd(outlet.id, e)}
                onClick={() => {
                  onSelectOutlet(outlet);
                  onSelectNode?.(outlet);
                }}
                onTap={() => {
                  onSelectOutlet(outlet);
                  onSelectNode?.(outlet);
                }}
              >
                {/* Châssis métallique de la colonnette multi-ports */}
                <Rect
                  x={-blockWidth / 2}
                  y={-blockHeight / 2}
                  width={blockWidth}
                  height={blockHeight}
                  fill={isSelected ? "#0f172a" : "#1e293b"}
                  stroke={isSelected ? "#38bdf8" : isLinked ? "#0284c7" : "#475569"}
                  strokeWidth={isSelected ? 30 : 18}
                  cornerRadius={24}
                />
                {/* En-tête bandeau colonnette */}
                <Rect
                  x={-blockWidth / 2 + 10}
                  y={-blockHeight / 2 + 10}
                  width={blockWidth - 20}
                  height={45}
                  fill="#0f172a"
                  cornerRadius={12}
                  listening={false}
                />
                <Text
                  x={-blockWidth / 2 + 20}
                  y={-blockHeight / 2 + 20}
                  text={`COLONNETTE ${portsCount}x RJ45`}
                  fontSize={26}
                  fontFamily="sans-serif"
                  fontStyle="bold"
                  fill="#94a3b8"
                  listening={false}
                />

                {/* Ports RJ45 individuels dans le châssis */}
                {outlet.stackedPorts.map((sp, idx) => {
                  const col = isTwoColumns ? (idx % 2 === 0 ? 0 : 1) : 0;
                  const row = isTwoColumns ? Math.floor(idx / 2) : idx;
                  const portX = isTwoColumns
                    ? (col === 0 ? -blockWidth / 4 : blockWidth / 4)
                    : 0;
                  const portY = -blockHeight / 2 + 80 + row * 90;

                  const spColor =
                    sp.outletRole === "VOIP"
                      ? "#c084fc"
                      : sp.outletRole === "PRINTER"
                      ? "#fbbf24"
                      : "#38bdf8";

                  return (
                    <Group key={`sp-${sp.portIndex}`} x={portX} y={portY} listening={false}>
                      {/* Embase RJ45 */}
                      <Rect
                        x={-90}
                        y={-35}
                        width={180}
                        height={70}
                        fill="#0f172a"
                        stroke={spColor}
                        strokeWidth={5}
                        cornerRadius={8}
                      />
                      {/* Prise RJ45 */}
                      <Rect
                        x={-75}
                        y={-22}
                        width={45}
                        height={45}
                        fill="#1e293b"
                        stroke="#64748b"
                        strokeWidth={4}
                        cornerRadius={6}
                      />
                      {/* LED d'activité */}
                      <Circle
                        x={-15}
                        y={0}
                        radius={6}
                        fill={sp.pingStatus === "ONLINE" ? "#22c55e" : "#64748b"}
                      />
                      {/* Label port & rôle */}
                      <Text
                        x={0}
                        y={-18}
                        text={`P${idx + 1} ${sp.outletRole}`}
                        fontSize={26}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill={spColor}
                      />
                      <Text
                        x={0}
                        y={6}
                        text={sp.assignedPerson ? sp.assignedPerson.slice(0, 12) : "Libre"}
                        fontSize={20}
                        fontFamily="sans-serif"
                        fill="#94a3b8"
                      />
                    </Group>
                  );
                })}

                {/* Cartouche latéral d'identification */}
                {(() => {
                  const title = `🔲 Colonnette (${portsCount}P) • ${outlet.name}`;
                  const badgeWidth = Math.max(380, title.length * 25 + 60);
                  return (
                    <Group x={blockWidth / 2 + 30} y={0} listening={false}>
                      <Rect
                        x={0}
                        y={-45}
                        width={badgeWidth}
                        height={90}
                        fill="rgba(15, 23, 42, 0.94)"
                        stroke={isSelected ? "#38bdf8" : "#475569"}
                        strokeWidth={6}
                        cornerRadius={16}
                      />
                      <Text
                        x={20}
                        y={-24}
                        width={badgeWidth - 40}
                        text={title}
                        fontSize={64}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill={isSelected ? "#ffffff" : "#38bdf8"}
                      />
                    </Group>
                  );
                })()}
              </Group>
            );
          }

          // Rendu Plastron Mural Standard RJ45 (Data ou VoIP)
          const roleColor = isVoip ? "#c084fc" : "#38bdf8";
          const roleFill = isSelected
            ? isVoip
              ? "#9333ea"
              : "#2563eb"
            : isLinked
            ? isVoip
              ? "#6b21a8"
              : "#0369a1"
            : "#334155";
          const roleStroke = isSelected
            ? isVoip
              ? "#f3e8ff"
              : "#93c5fd"
            : isLinked
            ? roleColor
            : "#64748b";

          return (
            <Group
              key={outlet.id}
              id={outlet.id}
              x={outlet.xMm}
              y={outlet.yMm}
              draggable
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onDragStart={handleDragStart}
              onDragMove={(e) => handleNodeDragMove(outlet.id, e)}
              onDragEnd={(e) => handleDragEnd(outlet.id, e)}
              onClick={() => {
                onSelectOutlet(outlet);
                onSelectNode?.(outlet);
              }}
              onTap={() => {
                onSelectOutlet(outlet);
                onSelectNode?.(outlet);
              }}
            >
              {/* Plastron mural compact */}
              <Rect
                x={-125}
                y={-125}
                width={250}
                height={250}
                fill={roleFill}
                stroke={roleStroke}
                strokeWidth={isSelected ? 35 : 20}
                cornerRadius={35}
              />
              {/* Connecteur RJ45 frontal */}
              <Rect x={-45} y={-45} width={90} height={90} fill="#0f172a" stroke="#475569" strokeWidth={8} cornerRadius={10} listening={false} />

              {/* Cartouche épuré mono-ligne avec nom court ou personne assignée */}
              {(() => {
                const isVoipRole = outlet.outletRole === "VOIP";
                const roleIcon = isVoipRole ? "📞" : "💻";
                const rolePrefix = isVoipRole ? "VoIP" : "Data";

                let shortOutletText = "";
                if (outlet.assignedPerson) {
                  shortOutletText = `${roleIcon} ${rolePrefix} • ${outlet.assignedPerson}`;
                } else {
                  const cleanName = outlet.name
                    .replace(/^PRISE-DESK-/i, "Prise ")
                    .replace(/^PRISE-BENCH-/i, "Prise ")
                    .replace(/^PRISE-/i, "Prise ");
                  shortOutletText = `${roleIcon} ${cleanName}`;
                }

                const badgeWidth = Math.max(380, shortOutletText.length * 28 + 60);

                return (
                  <Group x={150} y={0} listening={false}>
                    <Rect
                      x={0}
                      y={-45}
                      width={badgeWidth}
                      height={90}
                      fill="rgba(15, 23, 42, 0.94)"
                      stroke={isSelected ? "#ffffff" : isLinked ? roleColor : "#475569"}
                      strokeWidth={6}
                      cornerRadius={16}
                    />
                    <Text
                      x={20}
                      y={-24}
                      width={badgeWidth - 40}
                      text={shortOutletText}
                      fontSize={68}
                      fontFamily="sans-serif"
                      fontStyle="bold"
                      fill={isSelected ? "#ffffff" : roleColor}
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
