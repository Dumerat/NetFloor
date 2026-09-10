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
        const widthM = (zone.widthMm / 1000).toFixed(1);
        const heightM = (zone.heightMm / 1000).toFixed(1);
        const areaM2 = Math.round((zone.widthMm * zone.heightMm) / 1000000);
        const subText = `${widthM}m × ${heightM}m • ${areaM2} m²${zone.serviceCode ? ` • [${zone.serviceCode}]` : ""}`;

        return (
          <Group
            key={zone.id}
            x={zone.xMm}
            y={zone.yMm}
            draggable={!zone.isLocked}
            onClick={() => onSelectZone?.(zone)}
            onTap={() => onSelectZone?.(zone)}
            onDragEnd={(e: KonvaEventObject<DragEvent>) => {
              onZoneMoveEnd?.(zone.id, {
                x: Math.round(e.target.x()),
                y: Math.round(e.target.y()),
              });
            }}
          >
            {/* 1. Rectangle d emprise de zone avec fond teinte semi-transparent */}
            <Rect
              width={zone.widthMm}
              height={zone.heightMm}
              fill={zone.color}
              opacity={isSelected ? Math.min(1, (zone.opacity ?? 0.12) + 0.08) : zone.opacity ?? 0.12}
              cornerRadius={24}
              stroke={isSelected ? "#ffffff" : zone.color}
              strokeWidth={isSelected ? 60 : 35}
              dash={isSelected ? [120, 60] : [80, 50]}
            />

            {/* 2. Lisere interieur pour finition architecturale */}
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

            {/* 3. Cartouche d en-tete de zone (titre, dimensions et surface) */}
            <Group x={60} y={60} listening={false}>
              {/* Fond du badge */}
              <Rect
                width={Math.min(zone.widthMm - 120, 2600)}
                height={550}
                fill="rgba(15, 23, 42, 0.92)"
                stroke={zone.color}
                strokeWidth={16}
                cornerRadius={14}
              />

              {/* Pastille de couleur du service */}
              <Rect
                x={40}
                y={80}
                width={70}
                height={390}
                fill={zone.color}
                cornerRadius={8}
              />

              {/* Nom du service / pole */}
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
              />

              {/* Sous-titre : dimensions, surface metrique et code service */}
              <Text
                x={140}
                y={280}
                width={Math.min(zone.widthMm - 280, 2400)}
                text={subText}
                fontSize={120}
                fontFamily="monospace"
                fill={zone.color}
                wrap="none"
                ellipsis={true}
              />
            </Group>

            {/* Repere de coin inferieur droit */}
            <Line
              points={[
                zone.widthMm - 250, zone.heightMm - 50,
                zone.widthMm - 50, zone.heightMm - 50,
                zone.widthMm - 50, zone.heightMm - 250
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
