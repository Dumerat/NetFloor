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
}

export const VlanStyleCustomizer: FC<VlanStyleCustomizerProps> = ({
  vlanStyles,
  onUpdateVlanStyle,
  onResetVlanStyles,
  compact = false,
}) => {
  const [activeVlanId, setActiveVlanId] = useState<number | null>(null);

  const vlanList = Object.values(vlanStyles).sort((a, b) => a.vlanId - b.vlanId);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          <Palette className="w-3.5 h-3.5 text-sky-400" />
          <span>Styles & Tracés des Câbles par VLAN</span>
        </div>
        {onResetVlanStyles && (
          <button
            onClick={onResetVlanStyles}
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono transition"
            title="Rétablir les couleurs et tracés d'origine"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Défaut
          </button>
        )}
      </div>

      <div className="space-y-2">
        {vlanList.map((style) => {
          const isExpanded = activeVlanId === style.vlanId;
          const strokeWidthPx =
            style.thickness === "FINE" ? 2 : style.thickness === "THICK" ? 5 : 3.5;
          const dashArray =
            style.strokePattern === "DASHED"
              ? "8,4"
              : style.strokePattern === "DOTTED"
              ? "2,4"
              : undefined;

          return (
            <div
              key={style.vlanId}
              className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-2"
            >
              {/* En-tête VLAN avec pastille et aperçu direct */}
              <div
                onClick={() => setActiveVlanId(isExpanded ? null : style.vlanId)}
                className="flex items-center justify-between cursor-pointer group select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/20 shadow-sm transition-transform group-hover:scale-110"
                    style={{ backgroundColor: style.color }}
                  />
                  <div className="truncate">
                    <span className="font-mono text-xs font-bold text-slate-200">
                      VID {style.vlanId}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1.5 truncate">
                      {style.vlanName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    {style.strokePattern === "SOLID"
                      ? "Plein"
                      : style.strokePattern === "DASHED"
                      ? "Pointillés"
                      : "Points"}
                    {" • "}
                    {style.thickness === "FINE"
                      ? "Fin"
                      : style.thickness === "THICK"
                      ? "Épais"
                      : "Normal"}
                  </span>
                  <span className="text-slate-500 text-[10px] group-hover:text-sky-400 transition font-mono">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Ligne d'aperçu dynamique du câble */}
              <div className="bg-slate-900/70 p-1.5 rounded border border-slate-900/90 flex items-center gap-2">
                <span className="text-[9px] font-mono text-slate-500 flex-shrink-0">Aperçu :</span>
                <svg className="w-full h-3" viewBox="0 0 200 10" preserveAspectRatio="none">
                  <line
                    x1="2"
                    y1="5"
                    x2="198"
                    y2="5"
                    stroke={style.color}
                    strokeWidth={strokeWidthPx}
                    strokeDasharray={dashArray}
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Panneau d'édition détaillé (ouvert par clic ou toujours affiché si non-compact) */}
              {(!compact || isExpanded) && (
                <div className="pt-2 border-t border-slate-900 space-y-2.5">
                  {/* 1. Sélection de la Couleur */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1.5">
                      <span>Couleur du câble :</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={style.color}
                          onChange={(e) =>
                            onUpdateVlanStyle(style.vlanId, { color: e.target.value })
                          }
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                          title="Choisir une couleur libre"
                        />
                        <span className="text-[9px] text-slate-300 font-mono uppercase">
                          {style.color}
                        </span>
                      </div>
                    </div>
                    {/* Palette rapide */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                      {PRESET_VLAN_COLORS.map((preset) => (
                        <button
                          key={preset.hex}
                          onClick={() => onUpdateVlanStyle(style.vlanId, { color: preset.hex })}
                          className={`w-5 h-5 rounded-full flex-shrink-0 transition border flex items-center justify-center ${
                            style.color.toLowerCase() === preset.hex.toLowerCase()
                              ? "border-white scale-110 shadow-md ring-2 ring-sky-500/50"
                              : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                          }`}
                          style={{ backgroundColor: preset.hex }}
                          title={preset.name}
                        >
                          {style.color.toLowerCase() === preset.hex.toLowerCase() && (
                            <Check className="w-3 h-3 text-white drop-shadow-md" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Type de Tracé (Plein / Pointillés / Points) */}
                  <div>
                    <label className="text-[10px] text-slate-400 font-mono block mb-1">
                      Motif du tracé :
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                      {[
                        { id: "SOLID" as CableStrokePattern, label: "Plein ───", desc: "Ligne continue" },
                        { id: "DASHED" as CableStrokePattern, label: "Pointillé - -", desc: "Tirets espacés" },
                        { id: "DOTTED" as CableStrokePattern, label: "Points • •", desc: "Points fins" },
                      ].map((pattern) => (
                        <button
                          key={pattern.id}
                          onClick={() =>
                            onUpdateVlanStyle(style.vlanId, { strokePattern: pattern.id })
                          }
                          className={`py-1.5 px-2 rounded border transition text-center ${
                            style.strokePattern === pattern.id
                              ? "bg-sky-600/30 text-sky-300 border-sky-500/50 font-bold"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                          }`}
                          title={pattern.desc}
                        >
                          {pattern.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Épaisseur du Câble */}
                  <div>
                    <label className="text-[10px] text-slate-400 font-mono block mb-1">
                      Épaisseur du câble :
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                      {[
                        { id: "FINE" as CableThickness, label: "Fin (2mm)", widthDesc: "Discret" },
                        { id: "NORMAL" as CableThickness, label: "Normal (4mm)", widthDesc: "Standard" },
                        { id: "THICK" as CableThickness, label: "Épais (7mm)", widthDesc: "Renforcé" },
                      ].map((thick) => (
                        <button
                          key={thick.id}
                          onClick={() =>
                            onUpdateVlanStyle(style.vlanId, { thickness: thick.id })
                          }
                          className={`py-1.5 px-2 rounded border transition text-center ${
                            style.thickness === thick.id
                              ? "bg-sky-600/30 text-sky-300 border-sky-500/50 font-bold"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                          }`}
                          title={thick.widthDesc}
                        >
                          {thick.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
