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
  minScale: 0.005, // 1m = 5px (vision globale bâtiment entier)
  maxScale: 2.0,   // 1mm = 2px (zoom chirurgical sur baie/connecteurs)
  isPanning: false,
  gridConfig: DEFAULT_GRID,

  setViewport: (update) =>
    set((state) => ({
      viewport: { ...state.viewport, ...update },
    })),

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
    set({ viewport: nextViewport });
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
    set({ viewport: fittedViewport });
  },

  resetCamera: () => set({ viewport: DEFAULT_VIEWPORT }),

  setIsPanning: (isPanning) => set({ isPanning }),

  setGridConfig: (configUpdate) =>
    set((state) => ({
      gridConfig: { ...state.gridConfig, ...configUpdate },
    })),
}));
