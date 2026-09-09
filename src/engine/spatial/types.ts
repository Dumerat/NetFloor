/**
 * NetFloor Architect - Moteur Spatial 2D
 * Définitions de types géométriques purs en coordonnées millimétriques réelles.
 */

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Vector2D {
  readonly dx: number;
  readonly dy: number;
}

export interface Size2D {
  readonly width: number;
  readonly height: number;
}

export interface BoundingBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * État de la caméra virtuelle projetant l'espace monde (mm) vers l'espace écran (px)
 */
export interface Viewport {
  /** Translation horizontale en pixels d'écran */
  readonly panX: number;
  /** Translation verticale en pixels d'écran */
  readonly panY: number;
  /** Ratio d'échelle : pixels par millimètre (px/mm) */
  readonly scale: number;
}

/**
 * Configuration du système de magnétisme (snapping)
 */
export interface GridConfig {
  /** Pas de grille en millimètres (ex: 100mm, 500mm, 1000mm) */
  readonly stepMm: number;
  /** Activation du magnétisme */
  readonly enabled: boolean;
  /** Rayon d'attraction magnétique en millimètres réels */
  readonly snapRadiusMm: number;
}

export type SnapGuideType = "GRID" | "NODE_ALIGNMENT" | "PORT_CONNECT";

export interface SnapGuide {
  readonly axis: "X" | "Y";
  readonly positionMm: number;
  readonly startMm: number;
  readonly endMm: number;
  readonly type: SnapGuideType;
}

export interface SnapResult {
  readonly point: Point2D;
  readonly guides: readonly SnapGuide[];
  readonly snappedX: boolean;
  readonly snappedY: boolean;
}
