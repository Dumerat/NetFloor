"use client";

import type { FC } from "react";
import { Group, Rect, Text, Line } from "react-konva";
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

export interface NodeDisplay {
  id: string;
  type: "WALL_OUTLET" | "PATCH_PANEL" | "SWITCH" | "DESK";
  name: string;
  xMm: number;
  yMm: number;
  portId?: string | undefined;
  attachedToDeskId?: string | undefined;
  outletRole?: OutletRole | undefined;
}

interface EquipmentLayerProps {
  racks: RackDisplay[];
  nodes: NodeDisplay[];
  selectedOutletId?: string | null | undefined;
  selectedNodeId?: string | null | undefined;
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
  onSelectOutlet,
  onSelectNode,
  onNodeMoveEnd,
  onNodeDragMove,
  onRackDragMove,
}) => {
  const activeSelectedId = selectedNodeId ?? selectedOutletId;

  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
    // Empêche le drag du Stage pendant qu'on déplace un équipement
    e.cancelBubble = true;
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
      {/* 0. Lignes d'ancrage en pointillés pour les prises solidaires d'un bureau */}
      {nodes
        .filter((n) => n.type === "WALL_OUTLET" && n.attachedToDeskId)
        .map((outlet) => {
          const desk = nodes.find((d) => d.id === outlet.attachedToDeskId);
          if (!desk) return null;
          const deskCenterX = desk.xMm + 800; // Mi-largeur 1600mm
          const deskCenterY = desk.yMm + 400; // Mi-hauteur 800mm

          const isVoip = outlet.outletRole === "VOIP";
          const isPrinter = outlet.outletRole === "PRINTER";
          const lineColor = isVoip ? "#c084fc" : isPrinter ? "#fbbf24" : "#38bdf8";

          return (
            <Group key={`anchor-link-${outlet.id}`} listening={false}>
              <Line
                points={[deskCenterX, deskCenterY, outlet.xMm, outlet.yMm]}
                stroke={lineColor}
                strokeWidth={18}
                dash={isVoip ? [60, 40] : [70, 50]}
                opacity={0.7}
              />
            </Group>
          );
        })}

      {/* 1. Baies Informatiques (Racks 19") */}
      {racks.map((rack) => (
        <Group
          key={rack.id}
          x={rack.xMm}
          y={rack.yMm}
          draggable
          onDragStart={handleDragStart}
          onDragMove={(e) => handleRackDragMove(rack.id, e)}
          onDragEnd={(e) => handleDragEnd(rack.id, e)}
        >
          {/* Corps de la baie */}
          <Rect
            width={rack.depthMm} // 800mm
            height={rack.widthMm} // 600mm
            fill="#1e293b"
            stroke="#3b82f6"
            strokeWidth={30}
            cornerRadius={40}
            shadowColor="#000"
            shadowBlur={80}
            shadowOpacity={0.6}
          />
          {/* Titre Baie */}
          <Text
            x={40}
            y={50}
            text={`${rack.name} (${rack.uHeight}U)`}
            fontSize={140}
            fontFamily="monospace"
            fontStyle="bold"
            fill="#38bdf8"
          />
          {/* Bandeau de Brassage U24 */}
          <Rect
            x={40}
            y={220}
            width={rack.depthMm - 80}
            height={130}
            fill="#334155"
            stroke="#64748b"
            strokeWidth={15}
            cornerRadius={20}
          />
          <Text
            x={60}
            y={260}
            text="U24: PP-24P-CAT6A (Port 08 Data / Port 09 VoIP)"
            fontSize={80}
            fontFamily="monospace"
            fill="#cbd5e1"
          />
          {/* Switch Cisco U22 */}
          <Rect
            x={40}
            y={380}
            width={rack.depthMm - 80}
            height={130}
            fill="#1e3a8a"
            stroke="#2563eb"
            strokeWidth={15}
            cornerRadius={20}
          />
          <Text
            x={60}
            y={420}
            text="U22: CISCO C9300 (Gi1/0/8 Data / Gi1/0/9 VoIP)"
            fontSize={80}
            fontFamily="monospace"
            fill="#93c5fd"
          />
        </Group>
      ))}

      {/* 2. Bureaux (Desks) - Rendus avant les prises */}
      {nodes
        .filter((n) => n.type === "DESK")
        .map((desk) => {
          const isSelected = activeSelectedId === desk.id;
          const attachedOutlets = nodes.filter((n) => n.attachedToDeskId === desk.id);
          const dataCount = attachedOutlets.filter((o) => (o.outletRole ?? "DATA") === "DATA").length;
          const voipCount = attachedOutlets.filter((o) => o.outletRole === "VOIP").length;
          const roleParts = [
            dataCount > 0 ? `${dataCount} Data` : null,
            voipCount > 0 ? `${voipCount} VoIP` : null,
          ].filter(Boolean);
          const roleBreakdown = roleParts.length > 0 ? ` (${roleParts.join(" • ")})` : "";

          return (
            <Group
              key={desk.id}
              x={desk.xMm}
              y={desk.yMm}
              draggable
              onDragStart={handleDragStart}
              onDragMove={(e) => handleNodeDragMove(desk.id, e)}
              onDragEnd={(e) => handleDragEnd(desk.id, e)}
              onClick={() => onSelectNode?.(desk)}
              onTap={() => onSelectNode?.(desk)}
            >
              <Rect
                width={1600}
                height={800}
                fill={isSelected ? "#1e293b" : "#0f172a"}
                stroke={isSelected ? "#60a5fa" : "#334155"}
                strokeWidth={isSelected ? 35 : 25}
                cornerRadius={40}
                shadowColor="#3b82f6"
                shadowBlur={isSelected ? 100 : 30}
              />
              <Text
                x={60}
                y={260}
                text={desk.name}
                fontSize={130}
                fontFamily="sans-serif"
                fontStyle="bold"
                fill="#e2e8f0"
              />
              <Text
                x={60}
                y={460}
                text={
                  attachedOutlets.length > 0
                    ? `🔗 ${attachedOutlets.length} prise(s) solidaire(s)${roleBreakdown}`
                    : "📍 Prises indépendantes (non groupées)"
                }
                fontSize={100}
                fontFamily="monospace"
                fill={attachedOutlets.length > 0 ? "#38bdf8" : "#64748b"}
              />
            </Group>
          );
        })}

      {/* 3. Prises Murales (Wall Outlets) */}
      {nodes
        .filter((n) => n.type === "WALL_OUTLET")
        .map((outlet) => {
          const isSelected = activeSelectedId === outlet.id;
          const linkedDesk = outlet.attachedToDeskId
            ? nodes.find((n) => n.id === outlet.attachedToDeskId)
            : undefined;
          const isLinked = Boolean(linkedDesk);

          const isVoip = outlet.outletRole === "VOIP";
          const isPrinter = outlet.outletRole === "PRINTER";

          const roleColor = isVoip ? "#c084fc" : isPrinter ? "#fbbf24" : "#38bdf8";
          const roleFill = isSelected
            ? (isVoip ? "#9333ea" : isPrinter ? "#d97706" : "#2563eb")
            : isLinked
            ? (isVoip ? "#6b21a8" : isPrinter ? "#92400e" : "#0369a1")
            : "#334155";
          const roleStroke = isSelected
            ? (isVoip ? "#f3e8ff" : isPrinter ? "#fef3c7" : "#93c5fd")
            : isLinked
            ? roleColor
            : "#64748b";
          const roleShadow = isLinked ? (isVoip ? "#a855f7" : isPrinter ? "#f59e0b" : "#0284c7") : "#000";

          const roleIcon = isVoip ? "☎️ VOIP" : isPrinter ? "🖨️ PRINT" : "💻 DATA";

          // Calcul de l'écart relatif avec le bureau si liée
          const deltaText = linkedDesk
            ? ` (ΔX:${outlet.xMm - linkedDesk.xMm > 0 ? "+" : ""}${Math.round(
                outlet.xMm - linkedDesk.xMm
              )}mm, ΔY:${outlet.yMm - linkedDesk.yMm > 0 ? "+" : ""}${Math.round(
                outlet.yMm - linkedDesk.yMm
              )}mm)`
            : "";

          return (
            <Group
              key={outlet.id}
              x={outlet.xMm}
              y={outlet.yMm}
              draggable
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
              {/* Boîtier Plastron RJ45 avec code couleur de service (Data/VoIP) */}
              <Rect
                x={-150}
                y={-150}
                width={300}
                height={300}
                fill={roleFill}
                stroke={roleStroke}
                strokeWidth={isSelected ? 40 : 25}
                cornerRadius={50}
                shadowColor={roleShadow}
                shadowBlur={isSelected ? 160 : 40}
              />

              {/* Libellé Prise avec icône de service */}
              <Text
                x={200}
                y={-100}
                text={`${roleIcon} • ${outlet.name}`}
                fontSize={150}
                fontFamily="monospace"
                fontStyle="bold"
                fill={isSelected ? "#ffffff" : roleColor}
              />

              {/* État de la liaison (Solidaire vs Fixe) */}
              <Text
                x={200}
                y={70}
                text={
                  isLinked
                    ? `🔗 Solidaire ${linkedDesk?.name}${deltaText}`
                    : "📍 Prise murale fixe (Indépendante)"
                }
                fontSize={110}
                fontFamily="monospace"
                fill={isLinked ? roleColor : "#94a3b8"}
              />

              {/* Indication interactive */}
              <Text
                x={200}
                y={200}
                text="Déplacer pour définir l'écart • Clic pour inspecter / changer rôle"
                fontSize={95}
                fontFamily="sans-serif"
                fill="#64748b"
              />
            </Group>
          );
        })}
    </Group>
  );
};
