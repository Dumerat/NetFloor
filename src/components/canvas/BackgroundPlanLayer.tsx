"use client";

import { useEffect, useState, memo, type FC } from "react";
import { Group, Image as KonvaImage } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import { StoredBackgroundPlan } from "@/engine/storage/planStorage";

interface SinglePlanItemProps {
  plan: StoredBackgroundPlan;
  onPositionChange?: ((id: string, pos: { x: number; y: number }) => void) | undefined;
}

const SinglePlanItem: FC<SinglePlanItemProps> = memo(({ plan, onPositionChange }) => {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!plan.imageData) {
      setImageElement(null);
      return;
    }

    let isCurrent = true;
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      if (isCurrent) setImageElement(img);
    };
    img.onerror = (err) => {
      console.warn(`NetFloor: Erreur de chargement de l'image de fond pour [${plan.name}]`, err);
      if (isCurrent) setImageElement(null);
    };
    img.src = plan.imageData;

    return () => {
      isCurrent = false;
    };
  }, [plan.imageData, plan.name]);

  if (!plan.visible || !imageElement) {
    return null;
  }

  const clampedOpacity = Math.max(0.1, Math.min(1.0, plan.opacity));

  // Calcul du scale métrique automatique :
  // Si widthMm est spécifié, on adapte l'échelle pour que l'image fasse exactement widthMm dans l'espace monde
  let scaleX = plan.scale || 1.0;
  let scaleY = plan.scale || 1.0;

  if (plan.widthMm && imageElement.naturalWidth > 0) {
    scaleX = plan.widthMm / imageElement.naturalWidth;
    if (plan.heightMm && imageElement.naturalHeight > 0) {
      scaleY = plan.heightMm / imageElement.naturalHeight;
    } else {
      scaleY = scaleX;
    }
  } else if (plan.heightMm && imageElement.naturalHeight > 0) {
    scaleY = plan.heightMm / imageElement.naturalHeight;
    scaleX = scaleY;
  }

  const safeScaleX = Math.max(0.0001, scaleX);
  const safeScaleY = Math.max(0.0001, scaleY);

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    if (plan.isLocked) return;
    const newX = Math.round(e.target.x());
    const newY = Math.round(e.target.y());
    onPositionChange?.(plan.id, { x: newX, y: newY });
  };

  return (
    <Group
      x={plan.xMm}
      y={plan.yMm}
      draggable={!plan.isLocked}
      listening={!plan.isLocked}
      onDragEnd={handleDragEnd}
    >
      <KonvaImage
        image={imageElement}
        opacity={clampedOpacity}
        scaleX={safeScaleX}
        scaleY={safeScaleY}
        listening={!plan.isLocked}
      />
    </Group>
  );
});
SinglePlanItem.displayName = "SinglePlanItem";

export interface BackgroundPlanLayerProps {
  /** Liste complète des fonds de plans enregistrés */
  plans?: StoredBackgroundPlan[] | undefined;
  /** Callback lors du déplacement d'un plan non verrouillé */
  onPlanPositionChange?: ((id: string, pos: { x: number; y: number }) => void) | undefined;

  // Propriétés de rétrocompatibilité pour plan unique
  imageUrl?: string | null | undefined;
  opacity?: number | undefined;
  isLocked?: boolean | undefined;
  xMm?: number | undefined;
  yMm?: number | undefined;
  scale?: number | undefined;
  widthMm?: number | undefined;
  heightMm?: number | undefined;
  visible?: boolean | undefined;
  onPositionChange?: ((pos: { x: number; y: number }) => void) | undefined;
}

export const BackgroundPlanLayer: FC<BackgroundPlanLayerProps> = memo(
  ({
    plans,
    onPlanPositionChange,
    imageUrl,
    opacity = 0.6,
    isLocked = true,
    xMm = 0,
    yMm = 0,
    scale = 1.0,
    widthMm,
    heightMm,
    visible = true,
    onPositionChange,
  }) => {
    // Si une liste de plans est passée, on les rend tous
    if (plans && plans.length > 0) {
      return (
        <Group listening={false}>
          {plans.map((p) => (
            <SinglePlanItem
              key={p.id}
              plan={p}
              onPositionChange={onPlanPositionChange}
            />
          ))}
        </Group>
      );
    }

    // Sinon, mode rétrocompatible avec le plan unique
    if (!imageUrl) return null;

    const singlePlan: StoredBackgroundPlan = {
      id: "active_plan",
      name: "Fond de plan",
      imageData: imageUrl,
      opacity,
      isLocked,
      xMm,
      yMm,
      scale,
      ...(widthMm !== undefined ? { widthMm } : {}),
      ...(heightMm !== undefined ? { heightMm } : {}),
      visible,
      updatedAtIso: "",
    };

    return (
      <Group listening={false}>
        <SinglePlanItem
          plan={singlePlan}
          onPositionChange={(_id, pos) => onPositionChange?.(pos)}
        />
      </Group>
    );
  }
);

BackgroundPlanLayer.displayName = "BackgroundPlanLayer";
