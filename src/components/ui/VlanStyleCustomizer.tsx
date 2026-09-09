"use client";

import { FC, useState } from "react";
import {
  VlanStyle,
  CableStrokePattern,
  CableThickness,
  PRESET_VLAN_COLORS,
} from "@/data/vlanStyles";
import { Palette, RotateCcw, Check } from "lucide-react";

interface VlanStyleCustomizerProps {
  vlanStyles: Record<number, VlanStyle>;
  onUpdateVlanStyle: (vlanId: number, updates: Partial<VlanStyle>) => void;
  onResetVlanStyles?: (() => void) | undefined;
  compact?: boolean | undefined;
  controlledVlanId?: number | undefined;
  hideVlanSelector?: boolean | undefined;
  hideHeader?: boolean | undefined;
}

export const VlanStyleCustomizer: FC<VlanStyleCustomizerProps> = ({
  vlanStyles,
  onUpdateVlanStyle,
  onResetVlanStyles,
  controlledVlanId,
  hideVlanSelector = false,
  hideHeader = false,
}) => {
  const vlanList = Object.values(vlanStyles).sort((a, b) => a.vlanId - b.vlanId);
  const [internalSelectedVlanId, setInternalSelectedVlanId] = useState<number>(() => {
    return vlanStyles[20] ? 20 : (vlanList[0]?.vlanId ?? 20);
  });

  const activeVlanId = controlledVlanId ?? internalSelectedVlanId;
  const currentStyle = vlanStyles[activeVlanId] ?? vlanList[0];
  if (!currentStyle) return null;

  const strokeWidthPx =
    currentStyle.thickness === "FINE" ? 2.2 : currentStyle.thickness === "THICK" ? 5.2 : 3.6;
  const dashArray =
    currentStyle.strokePattern === "DASHED"
      ? `${(strokeWidthPx * 2.6).toFixed(1)},${(strokeWidthPx * 2.8).toFixed(1)}`
      : currentStyle.strokePattern === "DOTTED"
      ? `0.1,${(strokeWidthPx * 2.4).toFixed(1)}`
      : undefined;

  return (
    <div className="space-y-3">
      {/* En-tête avec bouton de réinitialisation */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Palette className="w-3.5 h-3.5 text-sky-400" />
            <span>Styles & Tracés des Câbles</span>
          </div>
          {onResetVlanStyles && (
            <button
              onClick={onResetVlanStyles}
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono transition"
              title="Rétablir les couleurs et tracés d'origine de tous les VLANs"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Barre de sélection du VLAN (masquée si contrôlée depuis la liste IPAM principale) */}
      {!hideVlanSelector && (
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 font-mono block">
            Sélectionner le VLAN à personnaliser :
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 font-mono text-[10px]">
            {vlanList.map((vlan) => {
              const isSelected = activeVlanId === vlan.vlanId;
              return (
                <button
                  key={vlan.vlanId}
                  onClick={() => setInternalSelectedVlanId(vlan.vlanId)}
                  className={`px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 flex-shrink-0 ${
                    isSelected
                      ? "bg-slate-800 text-white border-sky-500 shadow-sm font-bold ring-1 ring-sky-500/50"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: vlan.color }}
                  />
                  <span>VID {vlan.vlanId}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Fiche détaillée UNIQUE du VLAN sélectionné */}
      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
        {/* Titre du VLAN sélectionné */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-900">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20 shadow"
              style={{ backgroundColor: currentStyle.color }}
            />
            <div>
              <span className="font-mono text-xs font-bold text-slate-100">
                VID {currentStyle.vlanId}
              </span>
              <span className="text-xs text-slate-300 ml-2 font-medium">
                {currentStyle.vlanName}
              </span>
            </div>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 text-sky-400 border border-slate-800">
            {currentStyle.strokePattern === "SOLID"
              ? "Plein"
              : currentStyle.strokePattern === "DASHED"
              ? "Pointillés"
              : "Points"}
            {" • "}
            {currentStyle.thickness === "FINE"
              ? "Fin (2mm)"
              : currentStyle.thickness === "THICK"
              ? "Épais (7mm)"
              : "Normal (4mm)"}
          </span>
        </div>

        {/* Ligne d'aperçu dynamique du câble */}
        <div className="bg-slate-900/80 p-2 rounded-md border border-slate-800/80 flex items-center gap-2.5">
          <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">Aperçu :</span>
          <svg className="w-full h-3.5" viewBox="0 0 200 10" preserveAspectRatio="none">
            <line
              x1="2"
              y1="5"
              x2="198"
              y2="5"
              stroke={currentStyle.color}
              strokeWidth={strokeWidthPx}
              strokeDasharray={dashArray}
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* 1. Sélection de la Couleur */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Couleur du câble :</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={currentStyle.color}
                onChange={(e) =>
                  onUpdateVlanStyle(currentStyle.vlanId, { color: e.target.value })
                }
                className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                title="Choisir une couleur libre"
              />
              <span className="text-[10px] text-slate-200 font-mono uppercase font-semibold">
                {currentStyle.color}
              </span>
            </div>
          </div>
          {/* Palette rapide */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {PRESET_VLAN_COLORS.map((preset) => (
              <button
                key={preset.hex}
                onClick={() => onUpdateVlanStyle(currentStyle.vlanId, { color: preset.hex })}
                className={`w-5 h-5 rounded-full flex-shrink-0 transition border flex items-center justify-center ${
                  currentStyle.color.toLowerCase() === preset.hex.toLowerCase()
                    ? "border-white scale-110 shadow-md ring-2 ring-sky-500/50"
                    : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                }`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              >
                {currentStyle.color.toLowerCase() === preset.hex.toLowerCase() && (
                  <Check className="w-3 h-3 text-white drop-shadow-md" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Type de Tracé (Plein / Pointillés / Points) */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-mono block">
            Motif du tracé sur le plan :
          </label>
          <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
            {[
              { id: "SOLID" as CableStrokePattern, label: "Plein ───", desc: "Ligne continue" },
              { id: "DASHED" as CableStrokePattern, label: "Pointillé - -", desc: "Tirets espacés" },
              { id: "DOTTED" as CableStrokePattern, label: "Points • •", desc: "Petits points fins" },
            ].map((pattern) => (
              <button
                key={pattern.id}
                onClick={() =>
                  onUpdateVlanStyle(currentStyle.vlanId, { strokePattern: pattern.id })
                }
                className={`py-2 px-2 rounded-lg border transition text-center ${
                  currentStyle.strokePattern === pattern.id
                    ? "bg-sky-600/30 text-sky-300 border-sky-500/50 font-bold shadow-sm"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
                title={pattern.desc}
              >
                {pattern.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Épaisseur du Câble */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-mono block">
            Épaisseur du câble :
          </label>
          <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
            {[
              { id: "FINE" as CableThickness, label: "Fin (2mm)", widthDesc: "Discret & fin" },
              { id: "NORMAL" as CableThickness, label: "Normal (4mm)", widthDesc: "Standard" },
              { id: "THICK" as CableThickness, label: "Épais (7mm)", widthDesc: "Renforcé" },
            ].map((thick) => (
              <button
                key={thick.id}
                onClick={() =>
                  onUpdateVlanStyle(currentStyle.vlanId, { thickness: thick.id })
                }
                className={`py-2 px-2 rounded-lg border transition text-center ${
                  currentStyle.thickness === thick.id
                    ? "bg-sky-600/30 text-sky-300 border-sky-500/50 font-bold shadow-sm"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
                title={thick.widthDesc}
              >
                {thick.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
