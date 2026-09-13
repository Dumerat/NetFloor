"use client";

import { useState, type FC } from "react";
import { Group, Line, Circle, Text as KonvaText, Rect } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import { Ruler, X, ArrowRight } from "lucide-react";

export interface CalibrationPoint {
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
}

// --- 1. Pure Konva Layer Component (0 DOM/SVG to avoid Konva reconciler crashes) ---
export interface ScaleCalibrationLayerProps {
  floorWidthMm: number;
  floorHeightMm: number;
  point1: CalibrationPoint | null;
  point2: CalibrationPoint | null;
  hoverPoint: CalibrationPoint | null;
  scale: number;
  isModalOpen: boolean;
  onPointSelect: (pt: CalibrationPoint) => void;
  onHoverMove: (pt: CalibrationPoint) => void;
}

export const ScaleCalibrationLayer: FC<ScaleCalibrationLayerProps> = ({
  floorWidthMm,
  floorHeightMm,
  point1,
  point2,
  hoverPoint,
  scale,
  isModalOpen,
  onPointSelect,
  onHoverMove,
}) => {
  const activeSecondPt = point2 || hoverPoint;
  const distPx =
    point1 && activeSecondPt
      ? Math.hypot(
          activeSecondPt.screenX - point1.screenX,
          activeSecondPt.screenY - point1.screenY
        )
      : 0;

  const midX = point1 && activeSecondPt ? (point1.worldX + activeSecondPt.worldX) / 2 : 0;
  const midY = point1 && activeSecondPt ? (point1.worldY + activeSecondPt.worldY) / 2 : 0;

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    if (isModalOpen) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const worldX = (pos.x - stage.x()) / stage.scaleX();
    const worldY = (pos.y - stage.y()) / stage.scaleY();
    onPointSelect({
      worldX,
      worldY,
      screenX: pos.x,
      screenY: pos.y,
    });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!point1 || point2 || isModalOpen) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const worldX = (pos.x - stage.x()) / stage.scaleX();
    const worldY = (pos.y - stage.y()) / stage.scaleY();
    onHoverMove({
      worldX,
      worldY,
      screenX: pos.x,
      screenY: pos.y,
    });
  };

  return (
    <Group>
      {/* Event catcher overlay */}
      {!isModalOpen && !point2 && (
        <Rect
          x={-50000}
          y={-50000}
          width={floorWidthMm + 100000}
          height={floorHeightMm + 100000}
          fill="transparent"
          listening={true}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
        />
      )}

      {/* Point 1 marker */}
      {point1 && (
        <Group x={point1.worldX} y={point1.worldY} listening={false}>
          <Circle radius={Math.max(6, 14 / scale)} fill="#3b82f6" opacity={0.3} />
          <Circle radius={Math.max(4, 8 / scale)} fill="#3b82f6" stroke="#ffffff" strokeWidth={Math.max(1.5, 2 / scale)} />
          <KonvaText
            text="P1 (Départ)"
            x={12 / scale}
            y={-6 / scale}
            fontSize={Math.max(9, 12 / scale)}
            fontStyle="bold"
            fill="#60a5fa"
          />
        </Group>
      )}

      {/* Segment line and pixel distance badge */}
      {point1 && activeSecondPt && (
        <Group listening={false}>
          <Line
            points={[point1.worldX, point1.worldY, activeSecondPt.worldX, activeSecondPt.worldY]}
            stroke="#38bdf8"
            strokeWidth={Math.max(1.5, 2.5 / scale)}
            dash={[6 / scale, 4 / scale]}
          />
          <Group x={midX} y={midY - 14 / scale}>
            <Rect
              x={-40 / scale}
              y={-10 / scale}
              width={80 / scale}
              height={20 / scale}
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth={1.5 / scale}
              cornerRadius={4 / scale}
              opacity={0.92}
            />
            <KonvaText
              text={`${distPx.toFixed(1)} px`}
              x={-40 / scale}
              y={-6 / scale}
              width={80 / scale}
              align="center"
              fontSize={Math.max(8, 11 / scale)}
              fontStyle="bold"
              fill="#38bdf8"
              fontFamily="monospace"
            />
          </Group>
        </Group>
      )}

      {/* Point 2 marker */}
      {point2 && (
        <Group x={point2.worldX} y={point2.worldY} listening={false}>
          <Circle radius={Math.max(6, 14 / scale)} fill="#10b981" opacity={0.3} />
          <Circle radius={Math.max(4, 8 / scale)} fill="#10b981" stroke="#ffffff" strokeWidth={Math.max(1.5, 2 / scale)} />
          <KonvaText
            text="P2 (Fin)"
            x={12 / scale}
            y={-6 / scale}
            fontSize={Math.max(9, 12 / scale)}
            fontStyle="bold"
            fill="#34d399"
          />
        </Group>
      )}
    </Group>
  );
};

// --- 2. Pure HTML Modal Component (rendu dans le DOM en dehors de Stage) ---
export interface ScaleCalibrationModalProps {
  isOpen: boolean;
  distPx: number;
  onClose: () => void;
  onValidate: (realMeters: number) => void;
}

export const ScaleCalibrationModal: FC<ScaleCalibrationModalProps> = ({
  isOpen,
  distPx,
  onClose,
  onValidate,
}) => {
  const [realMetersInput, setRealMetersInput] = useState("5.0");

  if (!isOpen) return null;

  const handleSubmit = () => {
    const meters = parseFloat(realMetersInput.replace(",", "."));
    if (!isNaN(meters) && meters > 0) {
      onValidate(meters);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 text-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Étalonnage de l&apos;Échelle</h3>
              <p className="text-[11px] text-slate-400">Calibrage métrique par segment connu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center font-mono">
            <span className="text-slate-400">Distance mesurée :</span>
            <span className="text-sky-400 font-bold">{distPx.toFixed(1)} px</span>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Longueur réelle en mètres :
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={realMetersInput}
                onChange={(e) => setRealMetersInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                placeholder="Ex: 5.0"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 pr-10 font-mono text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                m
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Exemple : un mur de bureau standard de 5.0 mètres.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>Valider l&apos;Échelle</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
