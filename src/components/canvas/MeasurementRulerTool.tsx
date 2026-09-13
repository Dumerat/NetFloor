"use client";

import { useState, useEffect, type FC } from "react";
import { Group, Line, Circle, Text as KonvaText, Rect } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import { Point2D } from "@/engine/spatial/types";
import { Ruler, X, Check, Target } from "lucide-react";

// --- 1. Pure Konva Layer Component (0 DOM/SVG to avoid Konva reconciler crashes) ---
export interface MeasurementRulerLayerProps {
  floorWidthMm: number;
  floorHeightMm: number;
  pointA: Point2D | null;
  pointB: Point2D | null;
  mousePos: Point2D | null;
  isCompleted: boolean;
  scale: number;
  onPointSelect: (pt: Point2D) => void;
  onHoverMove: (pt: Point2D) => void;
}

export const MeasurementRulerLayer: FC<MeasurementRulerLayerProps> = ({
  floorWidthMm,
  floorHeightMm,
  pointA,
  pointB,
  mousePos,
  isCompleted,
  scale,
  onPointSelect,
  onHoverMove,
}) => {
  const effectiveEnd = isCompleted ? pointB : (mousePos ?? pointB);

  let distanceMm = 0;
  let midX = 0;
  let midY = 0;

  if (pointA && effectiveEnd) {
    distanceMm = Math.hypot(effectiveEnd.x - pointA.x, effectiveEnd.y - pointA.y);
    midX = (pointA.x + effectiveEnd.x) / 2;
    midY = (pointA.y + effectiveEnd.y) / 2;
  }

  const distanceM = (distanceMm / 1000).toFixed(2);

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const worldX = (pos.x - stage.x()) / stage.scaleX();
    const worldY = (pos.y - stage.y()) / stage.scaleY();
    onPointSelect({ x: worldX, y: worldY });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!pointA || isCompleted) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const worldX = (pos.x - stage.x()) / stage.scaleX();
    const worldY = (pos.y - stage.y()) / stage.scaleY();
    onHoverMove({ x: worldX, y: worldY });
  };

  return (
    <Group>
      {/* Event catcher overlay */}
      {!isCompleted && (
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

      {pointA && effectiveEnd && (
        <Group listening={false}>
          {/* Ligne pointillée de mesure */}
          <Line
            points={[pointA.x, pointA.y, effectiveEnd.x, effectiveEnd.y]}
            stroke="#38bdf8"
            strokeWidth={Math.max(1.5, 2.5 / scale)}
            dash={[6 / scale, 6 / scale]}
            lineCap="round"
          />

          {/* Poignée Point A */}
          <Circle
            x={pointA.x}
            y={pointA.y}
            radius={Math.max(4, 7 / scale)}
            fill="#38bdf8"
            stroke="#0f172a"
            strokeWidth={Math.max(1, 2 / scale)}
          />

          {/* Poignée Point B */}
          <Circle
            x={effectiveEnd.x}
            y={effectiveEnd.y}
            radius={Math.max(4, 7 / scale)}
            fill={isCompleted ? "#38bdf8" : "#f59e0b"}
            stroke="#0f172a"
            strokeWidth={Math.max(1, 2 / scale)}
          />

          {/* Étiquette flottante métrique */}
          <Group x={midX} y={midY - 14 / scale}>
            <Rect
              x={-45 / scale}
              y={-11 / scale}
              width={90 / scale}
              height={22 / scale}
              fill="#0f172a"
              opacity={0.92}
              cornerRadius={4 / scale}
              stroke="#38bdf8"
              strokeWidth={1.5 / scale}
            />
            <KonvaText
              x={-45 / scale}
              y={-6 / scale}
              width={90 / scale}
              align="center"
              text={`${distanceM} m`}
              fill="#38bdf8"
              fontSize={Math.max(8, 11 / scale)}
              fontStyle="bold"
              fontFamily="monospace"
            />
          </Group>
        </Group>
      )}
    </Group>
  );
};

// --- 2. Pure HTML Overlay Component (rendu dans le DOM en dehors de Stage) ---
export interface MeasurementRulerOverlayProps {
  distanceM: string;
  angleDeg: number;
  isCompleted: boolean;
  hasPointA: boolean;
  onReset: () => void;
  onClose: () => void;
  onApplyScaleCalibration?: ((meters: number) => void) | undefined;
}

export const MeasurementRulerOverlay: FC<MeasurementRulerOverlayProps> = ({
  distanceM,
  angleDeg,
  isCompleted,
  hasPointA,
  onReset,
  onClose,
  onApplyScaleCalibration,
}) => {
  const [isCalibratingInline, setIsCalibratingInline] = useState(false);
  const [calibInput, setCalibInput] = useState(distanceM);

  useEffect(() => {
    setCalibInput(distanceM);
    setIsCalibratingInline(false);
  }, [distanceM, isCompleted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleValidateCalibration = () => {
    const val = parseFloat(calibInput.replace(",", "."));
    if (!isNaN(val) && val > 0 && onApplyScaleCalibration) {
      onApplyScaleCalibration(val);
      setIsCalibratingInline(false);
    }
  };

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-sky-500/50 shadow-2xl backdrop-blur-md rounded-2xl px-4 py-2 flex items-center gap-3 text-xs text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150 font-sans select-none">
      <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30 shrink-0">
        <Ruler className="w-4 h-4" />
      </div>

      <div className="flex items-center gap-2 font-mono">
        {!hasPointA ? (
          <span className="text-slate-300">Cliquez sur le premier point de mesure sur le plan</span>
        ) : !isCompleted ? (
          <span className="text-sky-300 font-semibold">
            Mesure en cours : <strong className="text-white text-sm">{distanceM} m</strong> (
            {angleDeg}°)
          </span>
        ) : (
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span>Distance mesurée :</span>
            <strong className="text-white text-sm px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              {distanceM} m
            </strong>
            <span className="text-[10px] text-slate-400 font-normal">({angleDeg}°)</span>
          </span>
        )}
      </div>

      <div className="h-4 w-px bg-slate-700 mx-1 shrink-0" />

      {/* Mode saisie d'étalonnage inline facultatif */}
      {isCompleted && isCalibratingInline ? (
        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-sky-500/40">
          <span className="text-[10px] text-slate-400">Longueur réelle :</span>
          <input
            type="text"
            autoFocus
            value={calibInput}
            onChange={(e) => setCalibInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleValidateCalibration();
              if (e.key === "Escape") setIsCalibratingInline(false);
            }}
            className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400 text-center"
          />
          <span className="text-[10px] text-slate-400 font-mono">m</span>
          <button
            type="button"
            onClick={handleValidateCalibration}
            className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-semibold transition cursor-pointer flex items-center gap-0.5"
          >
            <Check className="w-3 h-3" />
            <span>OK</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCalibratingInline(false)}
            className="text-slate-400 hover:text-white text-[10px] px-1 cursor-pointer"
          >
            Annuler
          </button>
        </div>
      ) : isCompleted && onApplyScaleCalibration ? (
        <button
          type="button"
          onClick={() => setIsCalibratingInline(true)}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
          title="Calibrer l'échelle globale du canevas en saisissant la longueur réelle connue de ce segment"
        >
          <Target className="w-3 h-3" />
          <span>Étalonner</span>
        </button>
      ) : null}

      {isCompleted && (
        <button
          type="button"
          onClick={() => {
            setIsCalibratingInline(false);
            onReset();
          }}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition cursor-pointer"
        >
          Nouvelle mesure
        </button>
      )}

      <button
        type="button"
        onClick={onClose}
        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
        title="Fermer la règle (Échap)"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
