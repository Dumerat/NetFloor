import React, { FC, useState } from "react";
import {
  Package,
  X,
  GripVertical,
  Monitor,
  Plug,
  Users,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { NodeDisplay } from "@/components/canvas/EquipmentLayer";

interface UnpositionedElementsDrawerProps {
  unpositionedNodes: NodeDisplay[];
  onRemoveItem?: ((id: string) => void) | undefined;
  onClearAll?: (() => void) | undefined;
}

export const UnpositionedElementsDrawer: FC<UnpositionedElementsDrawerProps> = ({
  unpositionedNodes,
  onRemoveItem,
  onClearAll,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (unpositionedNodes.length === 0) return null;

  const desks = unpositionedNodes.filter((n) => n.type === "DESK");
  const outlets = unpositionedNodes.filter((n) => n.type === "WALL_OUTLET");

  const handleDragStart = (e: React.DragEvent, node: NodeDisplay) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: "UNPOSITIONED_NODE",
        node,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="absolute bottom-4 left-20 z-40 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden max-w-md w-full text-xs text-slate-200 transition-all">
      {/* Header bar */}
      <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">Éléments Non Positionnés</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
              {desks.length > 0 ? `${desks.length}B ` : ""}{outlets.length > 0 ? `${outlets.length}P` : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700/50"
            title={isExpanded ? "Réduire" : "Développer"}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {onClearAll && (
            <button
              onClick={onClearAll}
              className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700/50"
              title="Tout vider"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contenu rétractable */}
      {isExpanded && (
        <div className="p-3 max-h-56 overflow-y-auto space-y-2">
          <p className="text-[11px] text-slate-400 mb-2">
            Glissez-déposez ces éléments directement sur le plan pour les positionner :
          </p>

          <div className="space-y-1.5">
            {unpositionedNodes.map((node) => {
              const isDesk = node.type === "DESK";
              return (
                <div
                  key={node.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, node)}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-800/40 cursor-grab active:cursor-grabbing transition group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                        isDesk
                          ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                          : "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {isDesk ? <Monitor className="w-3 h-3" /> : <Plug className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 truncate">{node.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
                        {node.assignedPerson && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Users className="w-2.5 h-2.5 text-blue-400" />
                            {node.assignedPerson}
                          </span>
                        )}
                        {node.vlanId && (
                          <span className="text-purple-400 font-semibold">VLAN {node.vlanId}</span>
                        )}
                        {node.ipAddress && <span className="text-slate-400">{node.ipAddress}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition pr-1">
                      Glisser ➔
                    </span>
                    {onRemoveItem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveItem(node.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
