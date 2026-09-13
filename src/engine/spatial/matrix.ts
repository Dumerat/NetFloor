import { Point2D, BoundingBox, Viewport } from "./types";

/**
 * Fonctions pures de transformation géométrique bidirectionnelle
 * Projetant entre l'espace écran (pixels) et l'espace monde (millimètres réels).
 */

/**
 * Convertit des coordonnées écran (pixels) en coordonnées monde (millimètres réels).
 */
export function screenToWorld(screenPoint: Point2D, viewport: Viewport): Point2D {
  if (viewport.scale <= 0) {
    throw new Error("L'échelle (scale) du viewport doit être strictement positive.");
  }
  return {
    x: (screenPoint.x - viewport.panX) / viewport.scale,
    y: (screenPoint.y - viewport.panY) / viewport.scale,
  };
}

/**
 * Convertit des coordonnées monde (millimètres réels) en coordonnées écran (pixels).
 */
export function worldToScreen(worldPoint: Point2D, viewport: Viewport): Point2D {
  return {
    x: worldPoint.x * viewport.scale + viewport.panX,
    y: worldPoint.y * viewport.scale + viewport.panY,
  };
}

/**
 * Calcule un nouveau Viewport lors d'un zoom centré sur le curseur souris (Zoom-to-Pointer).
 * Garantit que le point monde sous le curseur reste parfaitement immobile à l'écran.
 *
 * @param pointerScreenPos Position du curseur en pixels écran
 * @param currentViewport Viewport actuel (panX, panY, scale)
 * @param newScale Nouveau facteur d'échelle calculé
 * @param minScale Borne minimale d'échelle autorisée
 * @param maxScale Borne maximale d'échelle autorisée
 */
export function zoomAtPointer(
  pointerScreenPos: Point2D,
  currentViewport: Viewport,
  newScale: number,
  minScale = 0.0002, // 1m = 0.2px (vue d'ensemble très grand campus multi-bâtiments)
  maxScale = 2.0     // 1mm = 2px (vue ultra détaillée port RJ45)
): Viewport {
  const clampedScale = Math.min(Math.max(newScale, minScale), maxScale);

  if (clampedScale === currentViewport.scale) {
    return currentViewport;
  }

  const scaleRatio = clampedScale / currentViewport.scale;

  // Formule d'invariance du curseur :
  // panX' = sx - (sx - panX) * (scale' / scale)
  const newPanX = pointerScreenPos.x - (pointerScreenPos.x - currentViewport.panX) * scaleRatio;
  const newPanY = pointerScreenPos.y - (pointerScreenPos.y - currentViewport.panY) * scaleRatio;

  return {
    panX: newPanX,
    panY: newPanY,
    scale: clampedScale,
  };
}

/**
 * Détermine la BoundingBox visible dans le monde (en millimètres)
 * correspondant à la fenêtre d'affichage écran actuelle.
 */
export function getVisibleWorldBounds(
  viewport: Viewport,
  screenWidth: number,
  screenHeight: number
): BoundingBox {
  const topLeftWorld = screenToWorld({ x: 0, y: 0 }, viewport);
  const bottomRightWorld = screenToWorld({ x: screenWidth, y: screenHeight }, viewport);

  const minX = Math.min(topLeftWorld.x, bottomRightWorld.x);
  const maxX = Math.max(topLeftWorld.x, bottomRightWorld.x);
  const minY = Math.min(topLeftWorld.y, bottomRightWorld.y);
  const maxY = Math.max(topLeftWorld.y, bottomRightWorld.y);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calcule le Viewport optimal pour cadrer l'intégralité d'un bâtiment ou plateau d'étage
 * avec une marge de respiration (padding en pixels).
 */
export function fitToBounds(
  worldBounds: BoundingBox,
  screenWidth: number,
  screenHeight: number,
  paddingPx = 40,
  minScale = 0.0002,
  maxScale = 2.0
): Viewport {
  const availableWidth = Math.max(screenWidth - paddingPx * 2, 100);
  const availableHeight = Math.max(screenHeight - paddingPx * 2, 100);

  const scaleX = availableWidth / worldBounds.width;
  const scaleY = availableHeight / worldBounds.height;
  const targetScale = Math.min(Math.max(Math.min(scaleX, scaleY), minScale), maxScale);

  const centerWorldX = (worldBounds.minX + worldBounds.maxX) / 2;
  const centerWorldY = (worldBounds.minY + worldBounds.maxY) / 2;

  const panX = screenWidth / 2 - centerWorldX * targetScale;
  const panY = screenHeight / 2 - centerWorldY * targetScale;

  return {
    panX,
    panY,
    scale: targetScale,
  };
}

/**
 * Test d'intersection AABB pour le culling (ne rendre que ce qui est visible à l'écran).
 */
export function isBoxVisible(box: BoundingBox, visibleBounds: BoundingBox): boolean {
  return !(
    box.maxX < visibleBounds.minX ||
    box.minX > visibleBounds.maxX ||
    box.maxY < visibleBounds.minY ||
    box.minY > visibleBounds.maxY
  );
}

/**
 * Distance euclidienne entre deux points en millimètres.
 */
export function distanceBetween(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}
