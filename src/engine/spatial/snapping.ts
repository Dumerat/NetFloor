import { Point2D, BoundingBox, GridConfig, SnapGuide, SnapResult } from "./types";
import { distanceBetween } from "./matrix";

/**
 * Moteur de magnétisme (Snapping) métrique et guides intelligents
 * Calcule l'attraction sur grille et l'alignement sur arêtes/ports en millimètres réels.
 */

/**
 * Aligne un point sur la grille métrique régulière la plus proche (ex: 100mm, 500mm, 1000mm)
 * si la distance est inférieure au rayon d'attraction (snapRadiusMm).
 */
export function snapToGrid(point: Point2D, config: GridConfig): SnapResult {
  if (!config.enabled || config.stepMm <= 0) {
    return {
      point,
      guides: [],
      snappedX: false,
      snappedY: false,
    };
  }

  const nearestGridX = Math.round(point.x / config.stepMm) * config.stepMm;
  const nearestGridY = Math.round(point.y / config.stepMm) * config.stepMm;

  const diffX = Math.abs(point.x - nearestGridX);
  const diffY = Math.abs(point.y - nearestGridY);

  const snappedX = diffX <= config.snapRadiusMm;
  const snappedY = diffY <= config.snapRadiusMm;

  const finalX = snappedX ? nearestGridX : point.x;
  const finalY = snappedY ? nearestGridY : point.y;

  const guides: SnapGuide[] = [];

  if (snappedX) {
    guides.push({
      axis: "X",
      positionMm: nearestGridX,
      startMm: finalY - 500,
      endMm: finalY + 500,
      type: "GRID",
    });
  }

  if (snappedY) {
    guides.push({
      axis: "Y",
      positionMm: nearestGridY,
      startMm: finalX - 500,
      endMm: finalX + 500,
      type: "GRID",
    });
  }

  return {
    point: { x: finalX, y: finalY },
    guides,
    snappedX,
    snappedY,
  };
}

export interface TargetPortPoint extends Point2D {
  readonly portId: string;
  readonly portLabel: string;
}

/**
 * Magnétisme direct sur un port ou connecteur lors du tracé d'un câble
 */
export function snapToPort(
  point: Point2D,
  targetPorts: readonly TargetPortPoint[],
  snapRadiusMm = 80
): { snappedPoint: Point2D; connectedPort: TargetPortPoint | null; guide: SnapGuide | null } {
  let closestPort: TargetPortPoint | null = null;
  let minDistance = snapRadiusMm;

  for (const port of targetPorts) {
    const dist = distanceBetween(point, port);
    if (dist < minDistance) {
      minDistance = dist;
      closestPort = port;
    }
  }

  if (closestPort) {
    const guide: SnapGuide = {
      axis: "X",
      positionMm: closestPort.x,
      startMm: closestPort.y - 100,
      endMm: closestPort.y + 100,
      type: "PORT_CONNECT",
    };

    return {
      snappedPoint: { x: closestPort.x, y: closestPort.y },
      connectedPort: closestPort,
      guide,
    };
  }

  return {
    snappedPoint: point,
    connectedPort: null,
    guide: null,
  };
}

export interface NodeAlignmentResult {
  readonly snappedX: number;
  readonly snappedY: number;
  readonly guides: readonly SnapGuide[];
  readonly hasSnappedX: boolean;
  readonly hasSnappedY: boolean;
}

/**
 * Guides intelligents d'alignement (Smart Guides) entre boîtes englobantes de nœuds (racks, bureaux, prises).
 * Détecte les alignements : bord gauche, centre, bord droit, bord haut, centre, bord bas.
 */
export function snapToNodeAlignments(
  draggedBox: BoundingBox,
  referenceBoxes: readonly BoundingBox[],
  snapRadiusMm = 100
): NodeAlignmentResult {
  const draggedCenterX = (draggedBox.minX + draggedBox.maxX) / 2;
  const draggedCenterY = (draggedBox.minY + draggedBox.maxY) / 2;

  let bestDiffX = snapRadiusMm;
  let snapX: number | null = null;
  let guideX: SnapGuide | null = null;

  let bestDiffY = snapRadiusMm;
  let snapY: number | null = null;
  let guideY: SnapGuide | null = null;

  // Lignes cibles de l'objet déplacé
  const draggedPointsX = [
    { pos: draggedBox.minX, offset: 0 },
    { pos: draggedCenterX, offset: draggedBox.width / 2 },
    { pos: draggedBox.maxX, offset: draggedBox.width },
  ];

  const draggedPointsY = [
    { pos: draggedBox.minY, offset: 0 },
    { pos: draggedCenterY, offset: draggedBox.height / 2 },
    { pos: draggedBox.maxY, offset: draggedBox.height },
  ];

  for (const ref of referenceBoxes) {
    const refCenterX = (ref.minX + ref.maxX) / 2;
    const refCenterY = (ref.minY + ref.maxY) / 2;

    const refPointsX = [ref.minX, refCenterX, ref.maxX];
    const refPointsY = [ref.minY, refCenterY, ref.maxY];

    // Alignement sur axe X
    for (const dp of draggedPointsX) {
      for (const rp of refPointsX) {
        const diff = Math.abs(dp.pos - rp);
        if (diff < bestDiffX) {
          bestDiffX = diff;
          snapX = rp - dp.offset;
          const minY = Math.min(draggedBox.minY, ref.minY);
          const maxY = Math.max(draggedBox.maxY, ref.maxY);
          guideX = {
            axis: "X",
            positionMm: rp,
            startMm: minY,
            endMm: maxY,
            type: "NODE_ALIGNMENT",
          };
        }
      }
    }

    // Alignement sur axe Y
    for (const dp of draggedPointsY) {
      for (const rp of refPointsY) {
        const diff = Math.abs(dp.pos - rp);
        if (diff < bestDiffY) {
          bestDiffY = diff;
          snapY = rp - dp.offset;
          const minX = Math.min(draggedBox.minX, ref.minX);
          const maxX = Math.max(draggedBox.maxX, ref.maxX);
          guideY = {
            axis: "Y",
            positionMm: rp,
            startMm: minX,
            endMm: maxX,
            type: "NODE_ALIGNMENT",
          };
        }
      }
    }
  }

  const finalX = snapX !== null ? snapX : draggedBox.minX;
  const finalY = snapY !== null ? snapY : draggedBox.minY;

  const guides: SnapGuide[] = [];
  if (guideX) guides.push(guideX);
  if (guideY) guides.push(guideY);

  return {
    snappedX: finalX,
    snappedY: finalY,
    guides,
    hasSnappedX: snapX !== null,
    hasSnappedY: snapY !== null,
  };
}

/**
 * Accrochage magnétique direct entre deux prises RJ45 (Docking côte-à-côte ou en ligne)
 */
export function snapToOutletDocking(
  draggedPoint: Point2D,
  otherOutletPoints: readonly { id: string; point: Point2D }[],
  snapRadiusMm = 300,
  spacingMm = 260
): { snappedPoint: Point2D; dockedWithId: string | null } {
  for (const other of otherOutletPoints) {
    const dist = distanceBetween(draggedPoint, other.point);
    if (dist < snapRadiusMm && dist > 40) {
      const dx = draggedPoint.x - other.point.x;
      const dy = draggedPoint.y - other.point.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        // Côte à côte horizontal
        return {
          snappedPoint: {
            x: other.point.x + (dx > 0 ? spacingMm : -spacingMm),
            y: other.point.y,
          },
          dockedWithId: other.id,
        };
      } else {
        // En ligne vertical
        return {
          snappedPoint: {
            x: other.point.x,
            y: other.point.y + (dy > 0 ? spacingMm : -spacingMm),
          },
          dockedWithId: other.id,
        };
      }
    }
  }
  return { snappedPoint: draggedPoint, dockedWithId: null };
}

