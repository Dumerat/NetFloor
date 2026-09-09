"use client";

import type { FC } from "react";
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
  department?: string | undefined;
  chairPosition?: "BOTTOM" | "TOP" | "LEFT" | "RIGHT" | "NONE" | undefined;
}

interface EquipmentLayerProps {
  racks: RackDisplay[];
  nodes: NodeDisplay[];
  selectedOutletId?: string | null | undefined;
  selectedNodeId?: string | null | undefined;
  activeViewMode?: "ALL" | "HR" | "MAINTENANCE" | "NETWORK";
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

  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
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
      {/* 0. Lignes d'ancrage en pointillés reliant les prises solidaires à leur bureau */}
      {nodes
        .filter((n) => n.type === "WALL_OUTLET" && n.attachedToDeskId)
        .map((outlet) => {
          const desk = nodes.find((d) => d.id === outlet.attachedToDeskId);
          if (!desk) return null;
          const deskW = desk.widthMm ?? 1600;
          const deskH = desk.heightMm ?? 800;
          const deskCenterX = desk.xMm + deskW / 2;
          const deskCenterY = desk.yMm + deskH / 2;

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
                points={[deskCenterX, deskCenterY, outlet.xMm, outlet.yMm]}
                stroke={lineColor}
                strokeWidth={18}
                dash={isVoip ? [60, 40] : [70, 50]}
                opacity={activeViewMode === "HR" ? 0.35 : 0.75}
              />
            </Group>
          );
        })}

      {/* 1. Baies Informatiques 19" Réalistes (Racks 42U) */}
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
            fill="#0f172a"
            stroke="#3b82f6"
            strokeWidth={30}
            cornerRadius={40}
            shadowColor="#000"
            shadowBlur={80}
            shadowOpacity={0.6}
          />
          {/* Grille de ventilation supérieure */}
          <Circle
            x={rack.depthMm / 2 - 150}
            y={rack.widthMm / 2}
            radius={80}
            stroke="#334155"
            strokeWidth={15}
            listening={false}
          />
          <Circle
            x={rack.depthMm / 2 + 150}
            y={rack.widthMm / 2}
            radius={80}
            stroke="#334155"
            strokeWidth={15}
            listening={false}
          />
          {/* Titre Baie */}
          <Text
            x={40}
            y={50}
            text={`${rack.name} (${rack.uHeight}U)`}
            fontSize={130}
            fontFamily="monospace"
            fontStyle="bold"
            fill="#38bdf8"
          />
          {/* Bandeau de Brassage U24 */}
          <Rect
            x={40}
            y={190}
            width={rack.depthMm - 80}
            height={110}
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth={12}
            cornerRadius={16}
          />
          <Text
            x={60}
            y={225}
            text="U24: PP-24P-CAT6A (Data/VoIP)"
            fontSize={75}
            fontFamily="monospace"
            fill="#cbd5e1"
          />
          {/* Switch Cisco U22 */}
          <Rect
            x={40}
            y={330}
            width={rack.depthMm - 80}
            height={110}
            fill="#1e3a8a"
            stroke="#2563eb"
            strokeWidth={12}
            cornerRadius={16}
          />
          <Text
            x={60}
            y={365}
            text="U22: CISCO C9300 (Gi1/0/8-9)"
            fontSize={75}
            fontFamily="monospace"
            fill="#93c5fd"
          />
        </Group>
      ))}

      {/* 2. Mobilier & Postes Réalistes (Bureaux avec écrans, chaises et côtes) */}
      {nodes
        .filter((n) => n.type === "DESK")
        .map((desk) => {
          const isSelected = activeSelectedId === desk.id;
          const width = desk.widthMm ?? 1600;
          const height = desk.heightMm ?? 800;
          const isMeeting = desk.subType === "MEETING_TABLE";
          const isBenchDouble = desk.subType === "BENCH_DOUBLE";
          const attachedOutlets = nodes.filter((n) => n.attachedToDeskId === desk.id);

          const dimText = `${(width / 1000).toFixed(2)} × ${(height / 1000).toFixed(2)} m`;

          return (
            <Group
              key={desk.id}
              x={desk.xMm}
              y={desk.yMm}
              rotation={desk.rotationDeg ?? 0}
              draggable
              onDragStart={handleDragStart}
              onDragMove={(e) => handleNodeDragMove(desk.id, e)}
              onDragEnd={(e) => handleDragEnd(desk.id, e)}
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
                shadowColor="#000"
                shadowBlur={isSelected ? 120 : 40}
                shadowOpacity={0.7}
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

              {/* Cloisonnette acoustique centrale pour bench double face-à-face */}
              {isBenchDouble && (
                <Rect
                  x={30}
                  y={height / 2 - 15}
                  width={width - 60}
                  height={30}
                  fill="#0284c7"
                  cornerRadius={10}
                  opacity={0.8}
                  listening={false}
                />
              )}

              {/* Moniteur(s) réaliste(s) et clavier vu du dessus */}
              {!isMeeting && (
                <Group listening={false}>
                  {/* Écran Principal */}
                  <Rect
                    x={width / 2 - 220}
                    y={isBenchDouble ? height / 4 - 30 : 90}
                    width={440}
                    height={40}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth={8}
                    cornerRadius={6}
                  />
                  {/* Pied de l'écran */}
                  <Rect
                    x={width / 2 - 50}
                    y={isBenchDouble ? height / 4 - 55 : 65}
                    width={100}
                    height={25}
                    fill="#475569"
                    cornerRadius={5}
                  />
                  {/* Clavier & Pavé tactile */}
                  <Rect
                    x={width / 2 - 180}
                    y={isBenchDouble ? height / 4 + 40 : 180}
                    width={360}
                    height={110}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={8}
                    cornerRadius={8}
                  />

                  {/* 2ème écran si bench double (côté face) */}
                  {isBenchDouble && (
                    <Group>
                      <Rect
                        x={width / 2 - 220}
                        y={(3 * height) / 4 - 10}
                        width={440}
                        height={40}
                        fill="#0284c7"
                        stroke="#38bdf8"
                        strokeWidth={8}
                        cornerRadius={6}
                      />
                      <Rect
                        x={width / 2 - 180}
                        y={(3 * height) / 4 + 50}
                        width={360}
                        height={110}
                        fill="#1e293b"
                        stroke="#334155"
                        strokeWidth={8}
                        cornerRadius={8}
                      />
                    </Group>
                  )}
                </Group>
              )}

              {/* Fauteuil de bureau ergonomique vu du dessus */}
              {!isMeeting && desk.chairPosition !== "NONE" && (
                <Group listening={false}>
                  {/* Assise */}
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
                  {/* Dossier ergonomique courbé */}
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
                  {/* Accoudoirs */}
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

              {/* Libellé et identification RH du collaborateur */}
              <Text
                x={40}
                y={height - 240}
                text={desk.name}
                fontSize={120}
                fontFamily="sans-serif"
                fontStyle="bold"
                fill="#e2e8f0"
              />

              {/* Collaborateur affecté RH */}
              <Text
                x={40}
                y={height - 110}
                text={
                  desk.assignedPerson
                    ? `👤 ${desk.assignedPerson}`
                    : "👤 Poste vacant / Flex"
                }
                fontSize={100}
                fontFamily="sans-serif"
                fontStyle={desk.assignedPerson ? "bold" : "normal"}
                fill={desk.assignedPerson ? "#34d399" : "#64748b"}
              />

              {/* Cotation métrique réelle ou personnalisée */}
              <Text
                x={width - 480}
                y={height - 70}
                text={dimText}
                fontSize={85}
                fontFamily="monospace"
                fill="#64748b"
              />

              {/* Prises solidaires attachées */}
              {attachedOutlets.length > 0 && (
                <Text
                  x={40}
                  y={40}
                  text={`🔗 ${attachedOutlets.length} prise(s) rattachée(s)`}
                  fontSize={90}
                  fontFamily="monospace"
                  fill="#38bdf8"
                />
              )}
            </Group>
          );
        })}

      {/* 3. Connectique & Prises Réalistes (Plastrons muraux, Boîtes de Sol, Wi-Fi, Imprimantes) */}
      {nodes
        .filter((n) => n.type === "WALL_OUTLET")
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
                  shadowColor="#000"
                  shadowBlur={isSelected ? 140 : 40}
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

                {/* Libellé Boîte de Sol */}
                <Text
                  x={180}
                  y={-80}
                  text={`📦 BOÎTE DE SOL • ${outlet.name}`}
                  fontSize={140}
                  fontFamily="monospace"
                  fontStyle="bold"
                  fill={isSelected ? "#ffffff" : "#38bdf8"}
                />
                <Text
                  x={180}
                  y={60}
                  text={
                    isLinked
                      ? `🔗 Rattachée au ${linkedDesk?.name}`
                      : "📍 Boîte de sol fixe (Plancher technique)"
                  }
                  fontSize={105}
                  fontFamily="monospace"
                  fill={isLinked ? "#38bdf8" : "#94a3b8"}
                />
              </Group>
            );
          }

          // Rendu Borne Wi-Fi Ceiling AP
          if (isWifiAp) {
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
                {/* Onde radio Wi-Fi externe */}
                <Circle radius={180} stroke="#818cf8" strokeWidth={10} dash={[30, 20]} opacity={0.6} listening={false} />
                {/* Dôme plafonnier */}
                <Circle
                  radius={120}
                  fill={isSelected ? "#312e81" : "#1e1b4b"}
                  stroke={isSelected ? "#c7d2fe" : "#818cf8"}
                  strokeWidth={25}
                  shadowColor="#6366f1"
                  shadowBlur={isSelected ? 160 : 60}
                />
                {/* LED d'état centrale verte */}
                <Circle radius={25} fill="#34d399" shadowColor="#10b981" shadowBlur={30} listening={false} />

                <Text
                  x={160}
                  y={-60}
                  text={`📡 BORNE WI-FI 6 • ${outlet.name}`}
                  fontSize={140}
                  fontFamily="monospace"
                  fontStyle="bold"
                  fill={isSelected ? "#ffffff" : "#c7d2fe"}
                />
                <Text
                  x={160}
                  y={60}
                  text="Plafonnier PoE+ (VLAN Wi-Fi Infra)"
                  fontSize={105}
                  fontFamily="monospace"
                  fill="#94a3b8"
                />
              </Group>
            );
          }

          // Rendu Copieur / Imprimante Réseau
          if (isPrinter) {
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
                  shadowColor="#d97706"
                  shadowBlur={isSelected ? 140 : 40}
                />
                {/* Vitre scanner & bac papier */}
                <Rect x={-160} y={-140} width={320} height={180} fill="#0f172a" stroke="#b45309" strokeWidth={10} cornerRadius={10} listening={false} />
                <Rect x={-160} y={70} width={320} height={70} fill="#334155" cornerRadius={6} listening={false} />

                <Text
                  x={230}
                  y={-60}
                  text={`🖨️ COPIEUR • ${outlet.name}`}
                  fontSize={140}
                  fontFamily="monospace"
                  fontStyle="bold"
                  fill={isSelected ? "#ffffff" : "#fbbf24"}
                />
                <Text
                  x={230}
                  y={60}
                  text="Station d'impression sécurisée"
                  fontSize={105}
                  fontFamily="monospace"
                  fill="#94a3b8"
                />
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
          const roleIcon = isVoip ? "☎️ VOIP" : "💻 DATA";

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
                shadowColor={isLinked ? (isVoip ? "#c084fc" : "#0284c7") : "#000"}
                shadowBlur={isSelected ? 150 : 35}
              />
              {/* Connecteur RJ45 frontal */}
              <Rect x={-45} y={-45} width={90} height={90} fill="#0f172a" stroke="#475569" strokeWidth={8} cornerRadius={10} listening={false} />

              <Text
                x={150}
                y={-80}
                text={`${roleIcon} • ${outlet.name}`}
                fontSize={140}
                fontFamily="monospace"
                fontStyle="bold"
                fill={isSelected ? "#ffffff" : roleColor}
              />
              <Text
                x={150}
                y={60}
                text={
                  isLinked
                    ? `🔗 Solidaire ${linkedDesk?.name}`
                    : "📍 Plastron mural fixe (Plinthe)"
                }
                fontSize={105}
                fontFamily="monospace"
                fill={isLinked ? roleColor : "#94a3b8"}
              />
            </Group>
          );
        })}
    </Group>
  );
};
