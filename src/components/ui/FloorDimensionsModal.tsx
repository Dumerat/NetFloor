"use client";

import { useState, FC } from "react";
import { X, Ruler, Sparkles, Check } from "lucide-react";

interface FloorDimensionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWidthMm: number;
  currentHeightMm: number;
  onApplyDimensions: (widthMm: number, heightMm: number) => void;
}

const PRESET_SIZES = [
  { label: "Compact • 30m × 20m", widthM: 30, heightM: 20, desc: "Petit plateau ou agence (600 m²)" },
  { label: "Standard • 45m × 25m", widthM: 45, heightM: 25, desc: "Étage entreprise standard (1 125 m²)" },
  { label: "Grand • 60m × 35m", widthM: 60, heightM: 35, desc: "Grand plateau open-space (2 100 m²)" },
  { label: "Campus • 80m × 45m", widthM: 80, heightM: 45, desc: "Bâtiment tertiaire étendu (3 600 m²)" },
  { label: "Siège • 100m × 60m", widthM: 100, heightM: 60, desc: "Campus ou tour multi-ailes (6 000 m²)" },
];

export const FloorDimensionsModal: FC<FloorDimensionsModalProps> = ({
  isOpen,
  onClose,
  currentWidthMm,
  currentHeightMm,
  onApplyDimensions,
}) => {
  const [widthM, setWidthM] = useState<number>(Math.round(currentWidthMm / 1000));
  const [heightM, setHeightM] = useState<number>(Math.round(currentHeightMm / 1000));

  if (!isOpen) return null;

  const areaM2 = widthM * heightM;

  const handleApply = (w: number, h: number) => {
    if (w < 10 || h < 10 || isNaN(w) || isNaN(h)) return;
    onApplyDimensions(w * 1000, h * 1000);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-[520px] max-w-[95vw] flex flex-col overflow-hidden text-slate-200">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Dimensions du Plan de Base
              </h3>
              <p className="text-[11px] text-slate-400">
                Échelle métrique réelle de l'étage en mètres
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-2">
              Préréglages d'aménagement standard :
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {PRESET_SIZES.map((preset, idx) => {
                const isCurrent = widthM === preset.widthM && heightM === preset.heightM;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setWidthM(preset.widthM);
                      setHeightM(preset.heightM);
                    }}
                    className={`p-2 rounded-lg border text-left flex items-center justify-between transition ${
                      isCurrent
                        ? "bg-blue-950/60 border-blue-500/60 text-white"
                        : "bg-slate-950/50 border-slate-800/80 text-slate-300 hover:bg-slate-850 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <span className="font-bold font-mono text-[11px] block">
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {preset.desc}
                      </span>
                    </div>
                    {isCurrent && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-3">
            <label className="text-[11px] font-semibold text-slate-300 block">
              Dimensions personnalisées (au mètre près) :
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400">Largeur X (mètres) :</span>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={widthM}
                  onChange={(e) => setWidthM(Math.max(10, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500 font-mono">= {widthM * 1000} mm</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400">Longueur / Profondeur Y (mètres) :</span>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={heightM}
                  onChange={(e) => setHeightM(Math.max(10, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500 font-mono">= {heightM * 1000} mm</span>
              </div>
            </div>

            <div className="p-2.5 bg-blue-950/30 border border-blue-800/40 rounded-lg flex items-center justify-between text-blue-200">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Surface totale du plateau :
              </span>
              <span className="font-bold font-mono text-sm text-white">
                {areaM2.toLocaleString("fr-FR")} m²
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs"
          >
            Annuler
          </button>
          <button
            onClick={() => handleApply(widthM, heightM)}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
          >
            <Check className="w-3.5 h-3.5" />
            Appliquer au Plan
          </button>
        </div>
      </div>
    </div>
  );
};
