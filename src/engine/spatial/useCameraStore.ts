import { create } from "zustand";
import { Point2D, Viewport, GridConfig } from "./types";
import { zoomAtPointer, fitToBounds } from "./matrix";

export interface CameraState {
  readonly viewport: Viewport;
  readonly minScale: number;
  readonly maxScale: number;
  readonly isPanning: boolean;
  readonly gridConfig: GridConfig;

  // Actions
  readonly pixelsPerMeter: number;
  readonly setPixelsPerMeter: (ppm: number) => void;
  readonly setViewport: (update: Partial<Viewport>) => void;
  readonly panBy: (dx: number, dy: number) => void;
  readonly zoomAt: (pointerScreen: Point2D, scaleFactor: number) => void;
  readonly zoomIn: (centerScreen?: Point2D) => void;
  readonly zoomOut: (centerScreen?: Point2D) => void;
  readonly fitFloor: (
    floorWidthMm: number,
    floorHeightMm: number,
    screenWidth: number,
    screenHeight: number,
    paddingPx?: number
  ) => void;
  readonly resetCamera: () => void;
  readonly setIsPanning: (isPanning: boolean) => void;
  readonly setGridConfig: (config: Partial<GridConfig>) => void;
}

const DEFAULT_VIEWPORT: Viewport = {
  panX: 50,
  panY: 50,
  scale: 0.025, // 1m = 25px par défaut
};

const DEFAULT_GRID: GridConfig = {
  stepMm: 500, // Grille standard demi-mètre (500mm)
  enabled: true,
  snapRadiusMm: 35, // Attraction magnétique sur 35mm
};

export const useCameraStore = create<CameraState>()((set, get) => ({
  viewport: DEFAULT_VIEWPORT,
  minScale: 0.0002, // 1m = 0.2px (vision globale très grands sites / campus multi-bâtiments)
  maxScale: 2.0, // 1mm = 2px (zoom chirurgical sur baie/connecteurs)
  isPanning: false,
  gridConfig: DEFAULT_GRID,
  pixelsPerMeter: DEFAULT_VIEWPORT.scale * 1000,

  setPixelsPerMeter: (ppm: number) => {
    const { minScale, maxScale, viewport } = get();
    // ppm = pixels / meter. Since world is in mm (1000mm = 1m), scale = px/mm = ppm / 1000
    const nextScale = Math.min(Math.max(ppm / 1000, minScale), maxScale);
    set({
      pixelsPerMeter: nextScale * 1000,
      viewport: { ...viewport, scale: nextScale },
    });
  },

  setViewport: (update) =>
    set((state) => {
      const nextViewport = { ...state.viewport, ...update };
      return {
        viewport: nextViewport,
        pixelsPerMeter: nextViewport.scale * 1000,
      };
    }),

  panBy: (dx, dy) =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        panX: state.viewport.panX + dx,
        panY: state.viewport.panY + dy,
      },
    })),

  zoomAt: (pointerScreen, scaleFactor) => {
    const { viewport, minScale, maxScale } = get();
    const newScale = viewport.scale * scaleFactor;
    const nextViewport = zoomAtPointer(pointerScreen, viewport, newScale, minScale, maxScale);
    set({
      viewport: nextViewport,
      pixelsPerMeter: nextViewport.scale * 1000,
    });
  },

  zoomIn: (centerScreen = { x: 800, y: 500 }) => {
    get().zoomAt(centerScreen, 1.25);
  },

  zoomOut: (centerScreen = { x: 800, y: 500 }) => {
    get().zoomAt(centerScreen, 0.8);
  },

  fitFloor: (floorWidthMm, floorHeightMm, screenWidth, screenHeight, paddingPx = 60) => {
    const { minScale, maxScale } = get();
    const floorBounds = {
      minX: 0,
      minY: 0,
      maxX: floorWidthMm,
      maxY: floorHeightMm,
      width: floorWidthMm,
      height: floorHeightMm,
    };
    const fittedViewport = fitToBounds(
      floorBounds,
      screenWidth,
      screenHeight,
      paddingPx,
      minScale,
      maxScale
    );
    set({
      viewport: fittedViewport,
      pixelsPerMeter: fittedViewport.scale * 1000,
    });
  },

  resetCamera: () =>
    set({
      viewport: DEFAULT_VIEWPORT,
      pixelsPerMeter: DEFAULT_VIEWPORT.scale * 1000,
    }),

  setIsPanning: (isPanning) => set({ isPanning }),

  setGridConfig: (configUpdate) =>
    set((state) => ({
      gridConfig: { ...state.gridConfig, ...configUpdate },
    })),
}));
