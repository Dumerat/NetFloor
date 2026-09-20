"use client";

import { useState, useMemo, type FC } from "react";
import { X, Boxes, Sparkles, ArrowRight, Layers, Server, Grid, Users } from "lucide-react";
import { FloorZone } from "@/types/zones";
import { RackDisplay } from "@/components/canvas/EquipmentLayer";
import { generateBatchDesks, BatchSpawnResult } from "@/engine/spatial/batchSpawner";

interface BatchDeskSpawnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: FloorZone[];
  racks: RackDisplay[];
  onSpawn: (result: BatchSpawnResult) => void;
}

export const BatchDeskSpawnerModal: FC<BatchDeskSpawnerModalProps> = ({
  isOpen,
  onClose,
  zones,
  racks,
  onSpawn,
}) => {
  const [deskType, setDeskType] = useState<"bench_2" | "quad_4">("quad_4");
  const [rows, setRows] = useState(2);
  const [columns, setColumns] = useState(2);
  const [spacingX, setSpacingX] = useState(1.8);
  const [spacingY, setSpacingY] = useState(2.4);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.id ?? "");
  const [selectedRackId, setSelectedRackId] = useState<string>(racks[0]?.id ?? "rack-01");
  const [startNumber, setStartNumber] = useState(501);
  const [outletsPerSeat, setOutletsPerSeat] = useState<1 | 2>(1);
  const [outletMode, setOutletMode] = useState<"pack" | "individual">("pack");

  // Pré-génération schématique réactive pour l'aperçu SVG
  const previewData = useMemo(() => {
    return generateBatchDesks(
      {
        deskType,
        rows: Math.max(1, Math.min(8, rows)),
        columns: Math.max(1, Math.min(8, columns)),
        spacingXMeters: spacingX,
        spacingYMeters: spacingY,
        zoneId: selectedZoneId || undefined,
        defaultRackId: selectedRackId,
        startDeskNumber: startNumber,
        originX: 0,
        originY: 0,
        outletsPerSeat,
        outletMode,
      },
      zones
    );
  }, [
    deskType,
    rows,
    columns,
    spacingX,
    spacingY,
    selectedZoneId,
    selectedRackId,
    startNumber,
    outletsPerSeat,
    outletMode,
    zones,
  ]);

  if (!isOpen) return null;

  const isQuad = deskType === "quad_4";
  const totalBenches = rows * columns;
  const totalDesks = totalBenches * (isQuad ? 4 : 2);
  const totalOutlets = totalDesks * outletsPerSeat;

  const handleValidate = () => {
    onSpawn(previewData);
    onClose();
  };

  // Dimensions pour le canevas SVG d'aperçu schématique
  const deskSvgW = isQuad ? 48 : 32;
  const deskSvgH = 32;
  const gapSvgX = Math.round(spacingX * 12);
  const gapSvgY = Math.round(spacingY * 12);
  const svgTotalW = columns * deskSvgW + (columns - 1) * gapSvgX + 32;
  const svgTotalH = rows * deskSvgH + (rows - 1) * gapSvgY + 32;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-xs">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                Générateur d&apos;Îlots de Bureaux en Masse
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                  Batch Spawner
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Peuplement automatique d&apos;open-spaces avec connectique RJ45 solidaire
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps de la modale */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Colonne 1 : Paramètres du formulaire */}
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                Type de Mobilier / Îlot
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeskType("quad_4")}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    deskType === "quad_4"
                      ? "bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Îlot Quad (4 postes)</span>
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] text-slate-400">3.20m × 1.60m • 8 ports RJ45</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeskType("bench_2")}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    deskType === "bench_2"
                      ? "bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Bench Double (2 postes)</span>
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="text-[10px] text-slate-400">1.60m × 1.60m • 4 ports RJ45</span>
                </button>
              </div>
            </div>

            {/* Matrice Rangées × Colonnes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Rangées (Lignes Y)
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Colonnes (Axes X)
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={columns}
                  onChange={(e) => setColumns(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Espacements métriques */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Allée X (mètres)
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={0.5}
                  max={10}
                  value={spacingX}
                  onChange={(e) => setSpacingX(parseFloat(e.target.value) || 1.8)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Allée Y (mètres)
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={0.5}
                  max={10}
                  value={spacingY}
                  onChange={(e) => setSpacingY(parseFloat(e.target.value) || 2.4)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Zone & Baie de raccordement */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-emerald-400" /> Zone Cible
                </label>
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">(Coordonnées libres)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Server className="w-3 h-3 text-blue-400" /> Baie Réseau Cible
                </label>
                <select
                  value={selectedRackId}
                  onChange={(e) => setSelectedRackId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {racks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prises par poste & Format connectique */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Connectique par Poste</span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {outletsPerSeat === 1 ? "1 port / place" : "2 ports / place"}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutletsPerSeat(1)}
                    className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                      outletsPerSeat === 1
                        ? "bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="font-bold text-xs">1 prise par poste</span>
                    <span className="text-[10px] text-slate-400">1 port RJ45 cuivre</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOutletsPerSeat(2)}
                    className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                      outletsPerSeat === 2
                        ? "bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="font-bold text-xs">2 prises par poste</span>
                    <span className="text-[10px] text-slate-400">2 ports RJ45 cuivre</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Format d&apos;Intégration Réseau</span>
                  <span className="text-[10px] font-mono text-sky-400">
                    {outletMode === "pack" ? "Pack compact (sans spam)" : "Prises séparées"}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutletMode("pack")}
                    className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                      outletMode === "pack"
                        ? "bg-sky-950/40 border-sky-500/60 text-white shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="font-bold text-xs flex items-center gap-1">
                      <span>📦</span> Pack Centralisé
                    </span>
                    <span className="text-[10px] text-slate-400">1 Bloc RJ45 multi-ports</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOutletMode("individual")}
                    className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                      outletMode === "individual"
                        ? "bg-sky-950/40 border-sky-500/60 text-white shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="font-bold text-xs flex items-center gap-1">
                      <span>🔌</span> Prises Séparées
                    </span>
                    <span className="text-[10px] text-slate-400">Prises individuelles</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Numérotation de Départ des Bureaux
              </label>
              <input
                type="number"
                value={startNumber}
                onChange={(e) => setStartNumber(parseInt(e.target.value) || 501)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Colonne 2 : Aperçu Schématique SVG & Bilan */}
          <div className="flex flex-col space-y-4">
            <div>
              <span className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Grid className="w-3 h-3 text-sky-400" /> Aperçu Schématique de la Disposition
              </span>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-center min-h-[220px] max-h-[240px] overflow-hidden">
                <svg
                  viewBox={`0 0 ${svgTotalW} ${svgTotalH}`}
                  className="max-h-full max-w-full drop-shadow-md"
                >
                  {/* Fond de grille */}
                  <pattern id="modal-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                    <path
                      d="M 16 0 L 0 0 0 16"
                      fill="none"
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="0.5"
                    />
                  </pattern>
                  <rect width={svgTotalW} height={svgTotalH} fill="url(#modal-grid)" />

                  {/* Rendu des bureaux */}
                  {Array.from({ length: rows }).map((_, rIdx) =>
                    Array.from({ length: columns }).map((_, cIdx) => {
                      const x = 16 + cIdx * (deskSvgW + gapSvgX);
                      const y = 16 + rIdx * (deskSvgH + gapSvgY);
                      return (
                        <g key={`${rIdx}-${cIdx}`}>
                          {/* Rectangle bureau */}
                          <rect
                            x={x}
                            y={y}
                            width={deskSvgW}
                            height={deskSvgH}
                            rx={3}
                            fill="#1e293b"
                            stroke="#3b82f6"
                            strokeWidth={1}
                          />
                          {/* Cloison acoustique */}
                          <line
                            x1={x}
                            y1={y + deskSvgH / 2}
                            x2={x + deskSvgW}
                            y2={y + deskSvgH / 2}
                            stroke="#475569"
                            strokeWidth={1}
                          />
                          {isQuad && (
                            <line
                              x1={x + deskSvgW / 2}
                              y1={y}
                              x2={x + deskSvgW / 2}
                              y2={y + deskSvgH}
                              stroke="#475569"
                              strokeWidth={1}
                            />
                          )}

                          {/* Rendu connectique : Pack Centralisé vs Prises Séparées */}
                          {outletMode === "pack" ? (
                            <g>
                              {/* Boîtier pack compact central */}
                              <rect
                                x={x + deskSvgW / 2 - (isQuad ? 10 : 7)}
                                y={y + deskSvgH / 2 - 4}
                                width={isQuad ? 20 : 14}
                                height={8}
                                rx={2}
                                fill="#0f172a"
                                stroke="#10b981"
                                strokeWidth={0.8}
                              />
                              {/* Ports RJ45 représentés dans le boîtier */}
                              {isQuad ? (
                                <>
                                  <circle cx={x + deskSvgW / 2 - 6} cy={y + deskSvgH / 2} r={1.2} fill="#38bdf8" />
                                  <circle cx={x + deskSvgW / 2 - 2} cy={y + deskSvgH / 2} r={1.2} fill={outletsPerSeat === 2 ? "#c084fc" : "#38bdf8"} />
                                  <circle cx={x + deskSvgW / 2 + 2} cy={y + deskSvgH / 2} r={1.2} fill="#38bdf8" />
                                  <circle cx={x + deskSvgW / 2 + 6} cy={y + deskSvgH / 2} r={1.2} fill={outletsPerSeat === 2 ? "#c084fc" : "#38bdf8"} />
                                </>
                              ) : (
                                <>
                                  <circle cx={x + deskSvgW / 2 - 3} cy={y + deskSvgH / 2} r={1.2} fill="#38bdf8" />
                                  <circle cx={x + deskSvgW / 2 + 3} cy={y + deskSvgH / 2} r={1.2} fill={outletsPerSeat === 2 ? "#c084fc" : "#38bdf8"} />
                                </>
                              )}
                            </g>
                          ) : (
                            <g>
                              {/* Prises séparées individuelles */}
                              <circle cx={x + 8} cy={y + 6} r={2} fill="#38bdf8" />
                              {outletsPerSeat === 2 && <circle cx={x + 13} cy={y + 6} r={2} fill="#c084fc" />}
                              <circle cx={x + 8} cy={y + deskSvgH - 6} r={2} fill="#38bdf8" />
                              {outletsPerSeat === 2 && <circle cx={x + 13} cy={y + deskSvgH - 6} r={2} fill="#c084fc" />}
                              {isQuad && (
                                <>
                                  <circle cx={x + deskSvgW - (outletsPerSeat === 2 ? 13 : 8)} cy={y + 6} r={2} fill="#38bdf8" />
                                  {outletsPerSeat === 2 && <circle cx={x + deskSvgW - 8} cy={y + 6} r={2} fill="#c084fc" />}
                                  <circle cx={x + deskSvgW - (outletsPerSeat === 2 ? 13 : 8)} cy={y + deskSvgH - 6} r={2} fill="#38bdf8" />
                                  {outletsPerSeat === 2 && <circle cx={x + deskSvgW - 8} cy={y + deskSvgH - 6} r={2} fill="#c084fc" />}
                                </>
                              )}
                            </g>
                          )}
                        </g>
                      );
                    })
                  )}
                </svg>
              </div>
            </div>

            {/* Bilan récapitulatif */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <span className="font-semibold text-slate-300 block text-[11px]">
                Bilan du Peuplement :
              </span>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-400">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="block text-[10px] text-slate-500">Mobilier :</span>
                  <span className="text-slate-200 font-bold text-xs">{totalBenches}</span> benches
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="block text-[10px] text-slate-500">Collaborateurs :</span>
                  <span className="text-emerald-400 font-bold text-xs">{totalDesks}</span> postes
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="block text-[10px] text-slate-500">Connectique :</span>
                  <span className="text-sky-400 font-bold text-xs">{totalOutlets}</span> ports
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                {outletMode === "pack"
                  ? `${totalBenches} boîtier(s) Bloc RJ45 centralisé(s) sans encombrement. Le rôle et le VLAN sont déterminés par le switch.`
                  : `${totalOutlets} prise(s) individuelle(s). Le rôle et le VLAN sont déterminés par le switch.`}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition text-xs"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleValidate}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              Générer l&apos;Îlot ({totalDesks} Bureaux • {totalOutlets} RJ45)
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
