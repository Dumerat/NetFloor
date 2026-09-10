"use client";

import React, { useState } from "react";
import { Activity, ArrowRight, Shield } from "lucide-react";
import { RackDeviceItem } from "@/components/canvas/EquipmentLayer";
import { InternalRackPatch } from "@/components/ui/CircuitInspector";
import { DEFAULT_VLAN_STYLES } from "@/data/vlanStyles";

interface SwitchPortVisualizerProps {
  device: RackDeviceItem;
  rackPatches: InternalRackPatch[];
}

export const SwitchPortVisualizer: React.FC<SwitchPortVisualizerProps> = ({
  device,
  rackPatches,
}) => {
  const [selectedPortNum, setSelectedPortNum] = useState<number | null>(null);

  const totalPorts = device.portsCount ?? 24;
  const sfpCount = totalPorts >= 24 ? 4 : 2;

  // Recherche des connexions actives sur chaque port de ce switch
  const portConnections = React.useMemo(() => {
    const map = new Map<string, InternalRackPatch>();
    rackPatches.forEach((patch) => {
      if (patch.targetDevice.includes(device.name) || patch.targetDevice.includes(`U${device.slotU}`)) {
        map.set(patch.targetPort, patch);
      }
      if (patch.sourceDevice.includes(device.name) || patch.sourceDevice.includes(`U${device.slotU}`)) {
        map.set(patch.sourcePort, patch);
      }
    });
    return map;
  }, [rackPatches, device]);

  const selectedPatch = selectedPortNum !== null ? portConnections.get(`Gi1/0/${selectedPortNum}`) : null;

  return (
    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3 font-sans">
      {/* En-tête Face Avant Switch */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <div className="text-xs font-bold text-slate-100 font-mono flex items-center gap-1.5">
              <span>{device.name}</span>
              <span className="text-[10px] text-blue-400 font-normal">({device.model || "Commutateur Gigabit"})</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              IP: {device.ipAddress ?? "DHCP/Non configurée"} • {totalPorts} Ports RJ45 + {sfpCount} Uplinks SFP+
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {device.brand}
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            U{String(device.slotU).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Face Avant Réaliste du Commutateur 19" */}
      <div className="p-2.5 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 rounded-lg border border-slate-700 shadow-inner space-y-2">
        {/* Voyants d'état globaux du switch */}
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 px-1 border-b border-slate-800/80 pb-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> PWR</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" /> FAULT</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> PoE MAX</span>
          </div>
          <span className="text-slate-400 uppercase tracking-wider font-semibold">{device.brand} NETWORKING</span>
        </div>

        {/* Panneau RJ45 étagé */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {/* Bloc ports RJ45 10/100/1000 */}
          <div className="grid grid-rows-2 grid-flow-col gap-1 bg-slate-900/90 p-1.5 rounded border border-slate-800">
            {Array.from({ length: totalPorts }).map((_, i) => {
              const portNum = i + 1;
              const portId = `Gi1/0/${portNum}`;
              const patch = portConnections.get(portId);
              const isConnected = Boolean(patch);
              const isSelected = selectedPortNum === portNum;
              const isTrunk = patch?.vlanId === 99;
              const isWifi = patch?.vlanId === 50;

              const vColor = patch
                ? DEFAULT_VLAN_STYLES[patch.vlanId]?.color ?? "#38bdf8"
                : "#475569";

              return (
                <button
                  key={portId}
                  onClick={() => setSelectedPortNum(isSelected ? null : portNum)}
                  className={`w-7 h-7 rounded flex flex-col items-center justify-between p-0.5 border transition relative ${
                    isSelected
                      ? "border-sky-400 ring-2 ring-sky-400/40 bg-slate-800"
                      : isConnected
                      ? "border-slate-600 bg-slate-950 hover:border-slate-500"
                      : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700 opacity-60"
                  }`}
                  title={`${portId} ${isConnected ? `(Actif - VLAN ${patch?.vlanId} : ${patch?.serviceName})` : "(Libre)"}`}
                >
                  <div className="flex items-center justify-between w-full px-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isConnected ? "bg-emerald-400 animate-pulse shadow-[0_0_4px_#22c55e]" : "bg-slate-700"
                      }`}
                    />
                    {isTrunk ? (
                      <span className="text-[7px] text-rose-400 font-mono font-bold leading-none">T</span>
                    ) : isWifi ? (
                      <span className="text-[7px] text-indigo-400 font-mono font-bold leading-none">W</span>
                    ) : null}
                  </div>

                  <span
                    className="text-[8px] font-mono font-bold leading-none"
                    style={{ color: isConnected ? vColor : "#64748b" }}
                  >
                    {portNum}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bloc SFP+ Uplinks (10G Fiber / DAC) */}
          <div className="flex flex-col gap-1 bg-slate-900/90 p-1.5 rounded border border-purple-900/50">
            <span className="text-[7px] font-mono text-purple-400 uppercase text-center font-semibold">10G SFP+</span>
            <div className="grid grid-rows-2 grid-flow-col gap-1">
              {Array.from({ length: sfpCount }).map((_, sfpIdx) => {
                const sfpPortId = `Te1/0/${sfpIdx + 1}`;
                const patch = portConnections.get(sfpPortId);
                const isConnected = Boolean(patch);

                return (
                  <div
                    key={sfpPortId}
                    className={`w-8 h-7 rounded border flex flex-col items-center justify-center p-0.5 font-mono ${
                      isConnected
                        ? "bg-purple-950/60 border-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.3)]"
                        : "bg-slate-950 border-slate-800 opacity-60"
                    }`}
                    title={`${sfpPortId} (Uplink 10G SFP+) ${isConnected ? `- Lié à ${patch?.targetDevice}` : ""}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full mb-0.5 ${isConnected ? "bg-purple-400" : "bg-slate-700"}`} />
                    <span className="text-[7px] font-bold text-purple-300">SFP{sfpIdx + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Détail du Port Sélectionné */}
      {selectedPortNum !== null && (
        <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2 text-[11px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Port Gi1/0/{selectedPortNum} — {selectedPatch ? "Connecté" : "Non raccordé"}
            </span>
            {selectedPatch && (
              <span
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
                style={{
                  color: DEFAULT_VLAN_STYLES[selectedPatch.vlanId]?.color ?? "#38bdf8",
                  borderColor: `${DEFAULT_VLAN_STYLES[selectedPatch.vlanId]?.color ?? "#38bdf8"}40`,
                  backgroundColor: `${DEFAULT_VLAN_STYLES[selectedPatch.vlanId]?.color ?? "#38bdf8"}15`,
                }}
              >
                VLAN {selectedPatch.vlanId}
              </span>
            )}
          </div>

          {selectedPatch ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300 font-mono text-[10px]">
                <span>Service : <strong>{selectedPatch.serviceName}</strong></span>
                <span className="text-emerald-400 font-semibold">{selectedPatch.speedGbps} Gbps • UP</span>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-850 flex items-center justify-between font-mono text-[10px]">
                <div>
                  <div className="text-[9px] text-slate-500">Origine (Switch)</div>
                  <div className="text-sky-300 font-bold">{selectedPatch.targetPort}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                <div className="text-right">
                  <div className="text-[9px] text-slate-500">Destination (Prise / Switch)</div>
                  <div className="text-purple-300 font-bold">{selectedPatch.sourceDevice} : {selectedPatch.sourcePort}</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
                <span>Câble : {selectedPatch.cableType} ({selectedPatch.lengthM}m)</span>
                {selectedPatch.vlanId === 99 && (
                  <span className="text-rose-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Trunk 802.1Q Inter-Switch
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Port libre disponible pour brassage ou liaison Uplink.</span>
              <span className="text-slate-500 font-mono">1000BASE-T RJ45</span>
            </div>
          )}
        </div>
      )}

      {/* Légende rapide de la matrice des ports */}
      <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span>VLAN 20 (Data)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span>VLAN 30 (VoIP)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          <span>VLAN 50 (Wi-Fi)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span>VLAN 99 (Trunk)</span>
        </div>
      </div>
    </div>
  );
};
