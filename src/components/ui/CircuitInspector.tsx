"use client";

import type { FC } from "react";
import { CircuitTraceResult } from "@/db/queries/trace-link";
import { NodeDisplay, OutletRole } from "@/components/canvas/EquipmentLayer";
import {
  Zap,
  ShieldCheck,
  Activity,
  Link2,
  Unlink,
  MapPin,
  Target,
  Monitor,
  Phone,
  Laptop,
  Printer,
  Plus,
  ArrowRight,
} from "lucide-react";

export interface CircuitInspectorProps {
  traceResult: CircuitTraceResult | null;
  isLoading: boolean;
  selectedNode: NodeDisplay | null;
  allNodes: NodeDisplay[];
  desks: NodeDisplay[];
  onToggleAttachment: (outletId: string, deskId?: string | undefined) => void;
  onAlignWithDesk?: ((outletId: string, deskId: string) => void) | undefined;
  onTriggerTrace?: ((outletNode: NodeDisplay) => void) | undefined;
  onSelectNode?: ((node: NodeDisplay) => void) | undefined;
  onChangeRole?: ((outletId: string, role: OutletRole) => void) | undefined;
  onAddOutletToDesk?: ((deskId: string, role: OutletRole) => void) | undefined;
}

export const CircuitInspector: FC<CircuitInspectorProps> = ({
  traceResult,
  isLoading,
  selectedNode,
  allNodes,
  desks,
  onToggleAttachment,
  onAlignWithDesk,
  onTriggerTrace,
  onSelectNode,
  onChangeRole,
  onAddOutletToDesk,
}) => {
  // Aucun équipement sélectionné
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
          <Zap className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-xs font-semibold text-slate-300">Aucun élément sélectionné</p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
          Cliquez sur une prise murale RJ45 (PC ou IP Phone) ou un bureau pour configurer ses prises et visualiser son circuit physique.
        </p>
      </div>
    );
  }

  // Cas 1 : Prise Murale RJ45 (Data, VoIP, Imprimante, etc.)
  if (selectedNode.type === "WALL_OUTLET") {
    const linkedDesk = selectedNode.attachedToDeskId
      ? desks.find((d) => d.id === selectedNode.attachedToDeskId)
      : undefined;
    const isLinked = Boolean(linkedDesk);

    const isVoip = selectedNode.outletRole === "VOIP";
    const isPrinter = selectedNode.outletRole === "PRINTER";

    const deltaX = linkedDesk ? Math.round(selectedNode.xMm - linkedDesk.xMm) : 0;
    const deltaY = linkedDesk ? Math.round(selectedNode.yMm - linkedDesk.yMm) : 0;
    const directDistanceM = linkedDesk
      ? (Math.hypot(deltaX, deltaY) / 1000).toFixed(2)
      : null;

    // Autres prises sur le même bureau (ex: Prise IP Phone si on regarde la prise Data)
    const siblingOutlets = linkedDesk
      ? allNodes.filter(
          (n) => n.type === "WALL_OUTLET" && n.attachedToDeskId === linkedDesk.id && n.id !== selectedNode.id
        )
      : [];

    return (
      <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
        {/* 1. En-tête de la prise */}
        <div className="border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
              {isVoip ? (
                <Phone className="w-4 h-4 text-purple-400 flex-shrink-0" />
              ) : isPrinter ? (
                <Printer className="w-4 h-4 text-amber-400 flex-shrink-0" />
              ) : (
                <Laptop className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
              {selectedNode.name}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isVoip
                    ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                    : isPrinter
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                }`}
              >
                {isVoip ? "VOIP / IP PHONE" : isPrinter ? "IMPRIMANTE" : "DATA / PC"}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isLinked
                    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {isLinked ? "SOLIDAIRE" : "FIXE"}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>Plastron RJ45 Cat6A</span>
            <span className="text-slate-500">
              {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
            </span>
          </div>

          {/* Sélecteur de rôle de service (Data vs IP Phone vs Imprimante) */}
          {onChangeRole && (
            <div className="mt-2 pt-2 border-t border-slate-800/80">
              <div className="text-[10px] text-slate-400 mb-1 font-medium">Affectation du service RJ45 :</div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => onChangeRole(selectedNode.id, "DATA")}
                  className={`py-1 px-1.5 rounded text-[10px] font-mono flex items-center justify-center gap-1 border transition ${
                    !selectedNode.outletRole || selectedNode.outletRole === "DATA"
                      ? "bg-blue-600 text-white border-blue-500 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Laptop className="w-3 h-3" />
                  Data / PC
                </button>
                <button
                  onClick={() => onChangeRole(selectedNode.id, "VOIP")}
                  className={`py-1 px-1.5 rounded text-[10px] font-mono flex items-center justify-center gap-1 border transition ${
                    selectedNode.outletRole === "VOIP"
                      ? "bg-purple-600 text-white border-purple-500 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Phone className="w-3 h-3" />
                  IP Phone
                </button>
                <button
                  onClick={() => onChangeRole(selectedNode.id, "PRINTER")}
                  className={`py-1 px-1.5 rounded text-[10px] font-mono flex items-center justify-center gap-1 border transition ${
                    selectedNode.outletRole === "PRINTER"
                      ? "bg-amber-600 text-white border-amber-500 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Printer className="w-3 h-3" />
                  Imprimante
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Carte : Liaison Mobilier & Postes */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 mb-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              Liaison au Mobilier
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Option au choix</span>
          </div>

          {/* Toggle Segmenté : Solidaire vs Fixe */}
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
            <button
              onClick={() => onToggleAttachment(selectedNode.id, desks[0]?.id)}
              className={`py-1 px-2 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                isLinked
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Link2 className="w-3 h-3" />
              Solidaire
            </button>
            <button
              onClick={() => onToggleAttachment(selectedNode.id, undefined)}
              className={`py-1 px-2 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                !isLinked
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <MapPin className="w-3 h-3" />
              Prise Fixe
            </button>
          </div>

          {/* Détails si liée */}
          {isLinked && linkedDesk ? (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] text-slate-300 bg-blue-950/40 border border-blue-900/50 p-2 rounded space-y-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Rattachée à :</span>
                  <span className="font-semibold text-slate-100">{linkedDesk.name}</span>
                </div>
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Écart relatif :</span>
                  <span className="text-sky-300 font-semibold">
                    ΔX: {deltaX > 0 ? `+${deltaX}` : deltaX}mm, ΔY: {deltaY > 0 ? `+${deltaY}` : deltaY}mm
                  </span>
                </div>
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Distance directe :</span>
                  <span className="text-slate-200">{directDistanceM} m</span>
                </div>
              </div>

              {/* Prises sœurs sur le même poste */}
              {siblingOutlets.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] text-slate-400 font-medium mb-1">
                    Autre(s) prise(s) sur ce même poste ({siblingOutlets.length}) :
                  </div>
                  <div className="space-y-1">
                    {siblingOutlets.map((sibling) => {
                      const isSiblingVoip = sibling.outletRole === "VOIP";
                      return (
                        <button
                          key={sibling.id}
                          onClick={() => onSelectNode?.(sibling)}
                          className="w-full p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-left flex items-center justify-between transition group"
                        >
                          <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-300 group-hover:text-white">
                            {isSiblingVoip ? (
                              <Phone className="w-3 h-3 text-purple-400" />
                            ) : (
                              <Laptop className="w-3 h-3 text-blue-400" />
                            )}
                            {sibling.name}
                          </span>
                          <span className="text-[9px] text-slate-500 group-hover:text-blue-400 flex items-center gap-0.5">
                            Voir <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {onAlignWithDesk && (
                <button
                  onClick={() => onAlignWithDesk(selectedNode.id, linkedDesk.id)}
                  className="w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-mono flex items-center justify-center gap-1.5 transition border border-slate-700"
                >
                  <Target className="w-3 h-3 text-blue-400" />
                  Repositionner sur le bord du bureau
                </button>
              )}
            </div>
          ) : (
            <div className="pt-1">
              <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-800">
                📍 <strong>Prise fixe :</strong> Ancrée au mur ou en boîte de sol. Les déplacements de mobilier ne l&apos;affectent pas.
              </p>
            </div>
          )}
        </div>

        {/* 3. Traçage CTE & Circuit Physique */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Liaison Certifiée (CTE SQL)
            </span>
            {onTriggerTrace && (
              <button
                onClick={() => onTriggerTrace(selectedNode)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-mono underline"
              >
                Actualiser
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              <Activity className="w-6 h-6 text-blue-500 animate-spin mb-2" />
              <p className="text-[11px] font-mono text-slate-300">Exécution de la CTE récursive...</p>
            </div>
          ) : traceResult ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              {/* Résumé Métrique */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1 font-mono text-[11px] flex-shrink-0">
                <div className="flex justify-between">
                  <span className="text-slate-400">Longueur cumulée :</span>
                  <span className="text-blue-400 font-semibold">{traceResult.totalCableLengthMeters} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Équipement terminal :</span>
                  <span className="text-slate-200 font-semibold">{traceResult.terminalNode?.name ?? "N/A"}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">VLAN Actif :</span>
                  {traceResult.resolvedVlan ? (
                    <span
                      className={`px-1.5 py-0.5 rounded border font-bold text-[10px] ${
                        traceResult.resolvedVlan.vid === 30
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                          : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      }`}
                    >
                      VID {traceResult.resolvedVlan.vid} — {traceResult.resolvedVlan.name}
                    </span>
                  ) : (
                    <span className="text-amber-400">Non assigné</span>
                  )}
                </div>
              </div>

              {/* Sauts (Hops) */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {traceResult.hops.map((hop) => {
                  const isCable = hop.transitionType === "CABLE";
                  const isInternal = hop.transitionType === "INTERNAL_PEER";

                  return (
                    <div
                      key={hop.hopNumber}
                      className={`p-2 rounded border transition text-[10px] ${
                        isCable
                          ? "bg-slate-900/80 border-blue-900/60"
                          : isInternal
                          ? "bg-slate-900/80 border-purple-900/60"
                          : "bg-slate-900/60 border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-slate-400 mb-0.5">
                        <span
                          className={`font-semibold ${
                            isCable
                              ? "text-blue-400"
                              : isInternal
                              ? "text-purple-400"
                              : "text-amber-400"
                          }`}
                        >
                          [Hop {hop.hopNumber}] {hop.transitionType}
                        </span>
                        {hop.cableLengthMm > 0 && (
                          <span>{hop.cableLengthMm / 1000} m</span>
                        )}
                      </div>
                      <div className="font-medium text-slate-200">{hop.nodeName}</div>
                      <div className="text-[9px] text-slate-400">
                        Port {hop.portLabel} ({hop.portDirection}) • {hop.portConnector}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-900/50 rounded border border-slate-800 text-center">
              <p className="text-[11px] text-slate-400">Circuit non encore tracé.</p>
              {onTriggerTrace && (
                <button
                  onClick={() => onTriggerTrace(selectedNode)}
                  className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-medium transition"
                >
                  ⚡ Lancer le traçage CTE SQL
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Cas 2 : Bureau (DESK) avec gestion multi-prises (IP Phone, PC Data...)
  const attachedOutlets = allNodes.filter((n) => n.attachedToDeskId === selectedNode.id);

  return (
    <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
      {/* En-tête Bureau */}
      <div className="border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-100 flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-emerald-400" />
            {selectedNode.name}
          </span>
          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
            MOBILIER
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
          <span>Dimensions : 1600 × 800 mm</span>
          <span className="text-slate-500">
            {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
          </span>
        </div>
      </div>

      {/* Prises solidaires de ce bureau (Data, VoIP...) */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2">
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-blue-400" />
            Prises Solidaires ({attachedOutlets.length})
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Multi-prises autorisées</span>
        </div>

        {/* Boutons d'ajout rapide de prises au poste */}
        {onAddOutletToDesk && (
          <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
            <button
              onClick={() => onAddOutletToDesk(selectedNode.id, "VOIP")}
              className="py-1.5 px-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
            >
              <Plus className="w-3 h-3" />
              <Phone className="w-3 h-3 text-purple-400" />
              + Prise IP Phone
            </button>
            <button
              onClick={() => onAddOutletToDesk(selectedNode.id, "DATA")}
              className="py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
            >
              <Plus className="w-3 h-3" />
              <Laptop className="w-3 h-3 text-blue-400" />
              + Prise Data
            </button>
          </div>
        )}

        {/* Liste des prises rattachées */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {attachedOutlets.length > 0 ? (
            attachedOutlets.map((outlet) => {
              const isVoip = outlet.outletRole === "VOIP";
              const isPrinter = outlet.outletRole === "PRINTER";
              const dx = Math.round(outlet.xMm - selectedNode.xMm);
              const dy = Math.round(outlet.yMm - selectedNode.yMm);
              const dist = (Math.hypot(dx, dy) / 1000).toFixed(2);

              return (
                <div
                  key={outlet.id}
                  className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {isVoip ? (
                        <Phone className="w-3.5 h-3.5 text-purple-400" />
                      ) : isPrinter ? (
                        <Printer className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Laptop className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      <span className="font-mono font-medium text-slate-200 text-xs">
                        {outlet.name}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        isVoip
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                          : isPrinter
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      }`}
                    >
                      {isVoip ? "IP PHONE" : isPrinter ? "IMPRIMANTE" : "DATA"}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono flex justify-between items-center">
                    <span>
                      Écart : ΔX {dx > 0 ? `+${dx}` : dx}mm, ΔY {dy > 0 ? `+${dy}` : dy}mm
                    </span>
                    <span className="text-slate-500">{dist}m</span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                    <button
                      onClick={() => onSelectNode?.(outlet)}
                      className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-mono flex items-center justify-center gap-1 transition"
                    >
                      <Zap className="w-3 h-3 text-blue-400" />
                      Inspecter le circuit
                    </button>
                    <button
                      onClick={() => onToggleAttachment(outlet.id, undefined)}
                      title="Détacher la prise de ce bureau"
                      className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 bg-slate-900/50 rounded border border-slate-800 text-center text-slate-500 italic">
              Aucune prise n&apos;est rattachée à ce poste. Cliquez sur &quot;+ Prise IP Phone&quot; ou &quot;+ Prise Data&quot; pour en ajouter.
            </div>
          )}
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed pt-1 flex-shrink-0">
          💡 En déplaçant ce bureau, <strong>toutes ses prises rattachées</strong> (PC, IP Phone...) le suivent en conservant leurs écartements personnalisés.
        </p>
      </div>
    </div>
  );
};
