"use client";

import { memo, FC } from "react";
import { Group, Rect, Text, Line } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import { FloorZone } from "@/types/zones";

interface ZoneLayerProps {
  zones: FloorZone[];
  selectedZoneId?: string | null | undefined;
  onSelectZone?: ((zone: FloorZone) => void) | undefined;
  onZoneMoveEnd?: ((id: string, newPos: { x: number; y: number }) => void) | undefined;
}

export const ZoneLayerComponent: FC<ZoneLayerProps> = ({
  zones,
  selectedZoneId,
  onSelectZone,
  onZoneMoveEnd,
}) => {
  return (
    <Group>
      {zones.map((zone) => {
        const isSelected = selectedZoneId === zone.id;
        const canDrag = isSelected && !zone.isLocked;
        const widthM = (zone.widthMm / 1000).toFixed(1);
        const heightM = (zone.heightMm / 1000).toFixed(1);
        const areaM2 = Math.round((zone.widthMm * zone.heightMm) / 1000000);
        const subText = `${widthM}m × ${heightM}m • ${areaM2} m²${zone.serviceCode ? ` • [${zone.serviceCode}]` : ""}`;

        return (
          <Group
            key={zone.id}
            x={zone.xMm}
            y={zone.yMm}
            draggable={canDrag}
            onDragStart={(e: KonvaEventObject<DragEvent>) => {
              e.cancelBubble = true;
            }}
            onDragEnd={(e: KonvaEventObject<DragEvent>) => {
              e.cancelBubble = true;
              onZoneMoveEnd?.(zone.id, {
                x: Math.round(e.target.x()),
                y: Math.round(e.target.y()),
              });
            }}
          >
            {/* 1. Rectangle d'emprise de zone : listening uniquement si sélectionnée, sinon laisse passer les clics pour le scroll/pan du canvas */}
            <Rect
              width={zone.widthMm}
              height={zone.heightMm}
              fill={zone.color}
              opacity={
                isSelected ? Math.min(1, (zone.opacity ?? 0.12) + 0.08) : (zone.opacity ?? 0.12)
              }
              cornerRadius={24}
              stroke={isSelected ? "#ffffff" : zone.color}
              strokeWidth={isSelected ? 60 : 35}
              dash={isSelected ? [120, 60] : [80, 50]}
              listening={isSelected}
            />

            {/* 2. Liseré intérieur architectural */}
            <Rect
              x={40}
              y={40}
              width={Math.max(10, zone.widthMm - 80)}
              height={Math.max(10, zone.heightMm - 80)}
              stroke={zone.color}
              strokeWidth={15}
              opacity={0.35}
              cornerRadius={18}
              listening={false}
            />

            {/* 3. Cartouche d'en-tête de zone : toujours interactif pour permettre la sélection au clic */}
            <Group
              x={60}
              y={60}
              listening={true}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectZone?.(zone);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onSelectZone?.(zone);
              }}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) {
                  stage.container().style.cursor = isSelected ? "move" : "pointer";
                }
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) {
                  stage.container().style.cursor = "grab";
                }
              }}
            >
              {/* Fond du badge cartouche */}
              <Rect
                width={Math.min(zone.widthMm - 120, 2600)}
                height={550}
                fill="rgba(15, 23, 42, 0.94)"
                stroke={isSelected ? "#38bdf8" : zone.color}
                strokeWidth={isSelected ? 24 : 16}
                cornerRadius={14}
                shadowForStrokeEnabled={false}
              />

              {/* Pastille de couleur du service */}
              <Rect
                x={40}
                y={80}
                width={70}
                height={390}
                fill={zone.color}
                cornerRadius={8}
                listening={false}
              />

              {/* Nom du service / pôle */}
              <Text
                x={140}
                y={65}
                width={Math.min(zone.widthMm - 280, 2400)}
                text={zone.name.toUpperCase()}
                fontSize={160}
                fontFamily="sans-serif"
                fontStyle="bold"
                fill="#ffffff"
                wrap="none"
                ellipsis={true}
                listening={false}
              />

              {/* Sous-titre : dimensions, surface métrique et code service */}
              <Text
                x={140}
                y={280}
                width={Math.min(zone.widthMm - 280, 2400)}
                text={subText}
                fontSize={120}
                fontFamily="monospace"
                fill={isSelected ? "#38bdf8" : zone.color}
                wrap="none"
                ellipsis={true}
                listening={false}
              />

              {/* Indicateur d'état */}
              {isSelected && (
                <Text
                  x={Math.min(zone.widthMm - 120, 2600) - 520}
                  y={190}
                  text={zone.isLocked ? "🔒 FIXE" : "✥ DÉPLACER"}
                  fontSize={100}
                  fontFamily="monospace"
                  fontStyle="bold"
                  fill="#38bdf8"
                  listening={false}
                />
              )}
            </Group>

            {/* Repère de coin inférieur droit */}
            <Line
              points={[
                zone.widthMm - 250,
                zone.heightMm - 50,
                zone.widthMm - 50,
                zone.heightMm - 50,
                zone.widthMm - 50,
                zone.heightMm - 250,
              ]}
              stroke={zone.color}
              strokeWidth={20}
              opacity={0.6}
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
};

export const ZoneLayer = memo(ZoneLayerComponent);
