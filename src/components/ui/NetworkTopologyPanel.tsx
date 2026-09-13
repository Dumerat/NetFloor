"use client";

import React, { useState, useMemo } from "react";
import {
  Network,
  Server,
  Shield,
  Search,
  ExternalLink,
  Laptop,
  Wifi,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";
import { NodeDisplay, RackDisplay, RackDeviceItem } from "@/components/canvas/EquipmentLayer";
import { VlanStyle, DEFAULT_VLAN_STYLES } from "@/data/vlanStyles";

interface NetworkTopologyPanelProps {
  racks: RackDisplay[];
  nodes: NodeDisplay[];
  cables?: any[];
  vlanStyles?: Record<number, VlanStyle>;
  onSelectNode?: (node: NodeDisplay) => void;
  onFocusNode?: (nodeId: string) => void;
  onClose?: () => void;
}

export const NetworkTopologyPanel: React.FC<NetworkTopologyPanelProps> = ({
  racks,
  nodes,
  cables = [],
  vlanStyles = DEFAULT_VLAN_STYLES,
  onSelectNode,
  onFocusNode,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [vlanFilter, setVlanFilter] = useState<string>("ALL");
  const [expandedRacks, setExpandedRacks] = useState<Record<string, boolean>>({ "rack-01": true });

  const toggleRack = (rackId: string) => {
    setExpandedRacks((prev) => ({ ...prev, [rackId]: !prev[rackId] }));
  };

  // Liste de tous les equipements raques consolides
  const allRackDevices = useMemo(() => {
    const list: { rack: RackDisplay; device: RackDeviceItem }[] = [];
    racks.forEach((rack) => {
      (rack.devices ?? []).forEach((dev) => {
        list.push({ rack, device: dev });
      });
    });
    return list;
  }, [racks]);

  // Equipements de terminaison (Prises murales, AP Wi-Fi, Imprimantes)
  const endpointNodes = useMemo(() => {
    return nodes.filter((n) => n.type === "WALL_OUTLET" || n.type === "DESK");
  }, [nodes]);

  // Prises murales filtrees
  const filteredWallOutlets = useMemo(() => {
    return nodes
      .filter((n) => n.type === "WALL_OUTLET")
      .filter((node) => {
        const matchSearch =
          searchTerm === "" ||
          node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (node.subType ? node.subType.toLowerCase().includes(searchTerm.toLowerCase()) : false) ||
          (node.ipAddress && node.ipAddress.includes(searchTerm));

        const matchVlan = vlanFilter === "ALL" || String(node.vlanId ?? 20) === vlanFilter;

        return matchSearch && matchVlan;
      });
  }, [nodes, searchTerm, vlanFilter]);

  // Switchs principaux
  const switches = useMemo(() => {
    return allRackDevices.filter((item) => item.device.deviceType === "SWITCH");
  }, [allRackDevices]);

  // Routeurs / Pare-feux
  const firewalls = useMemo(() => {
    return allRackDevices.filter((item) => item.device.deviceType === "FIREWALL");
  }, [allRackDevices]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans text-xs select-none">
      {/* En-tete Topologie */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Network className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-slate-100 flex items-center gap-1.5">
              <span>Topologie Reseau DSI</span>
              <span className="text-[9px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.2 rounded border border-blue-500/20">
                Arborescence
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {racks.length} Baie(s) • {switches.length} Switch(s) • {cables.length} Liaison(s)
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Fermer le panneau de topologie"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Barre de recherche et filtres VLAN */}
      <div className="p-2.5 border-b border-slate-800/80 bg-slate-950 space-y-2 flex-shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher un switch, baie, VLAN, IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap text-[9px] font-mono">
          <span className="text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="w-2.5 h-2.5" /> VLAN :
          </span>
          <button
            onClick={() => setVlanFilter("ALL")}
            className={`px-1.5 py-0.5 rounded border transition ${
              vlanFilter === "ALL"
                ? "bg-blue-600 text-white border-blue-500 font-bold"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            Tous
          </button>
          {[10, 20, 30, 40, 50, 99].map((vlanId) => {
            const style = vlanStyles[vlanId] ?? DEFAULT_VLAN_STYLES[vlanId];
            return (
              <button
                key={vlanId}
                onClick={() => setVlanFilter(String(vlanId))}
                className={`px-1.5 py-0.5 rounded border transition flex items-center gap-1 ${
                  vlanFilter === String(vlanId)
                    ? "bg-slate-800 text-white border-slate-600 font-bold"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: style?.color ?? "#3b82f6" }}
                />
                <span>VLAN {vlanId}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Arborescence interactive du reseau */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* NIVEAU 1 : Passerelle Internet & Coeur (WAN / FTTO / Firewall) */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                firewalls.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            1. Entree Operateur & Securite (Core) ({firewalls.length})
          </div>

          {firewalls.length > 0 ? (
            firewalls.map((fw, idx) => (
              <div
                key={fw.device.id || idx}
                className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200 text-xs">{fw.device.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {fw.device.model} • {fw.rack.name} (U{fw.device.slotU})
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {fw.device.status ?? "ONLINE"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1 border-t border-slate-800/80 text-slate-400">
                  <div>IP : {fw.device.ipAddress || "Non assignée"}</div>
                  <div className="text-right text-emerald-400 font-semibold">
                    {fw.device.portsCount ? `${fw.device.portsCount} ports` : "Passerelle"}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 text-slate-500 text-xs text-center">
              Aucun équipement pare-feu ou arrivée opérateur configuré
            </div>
          )}
        </div>

        {/* NIVEAU 2 : Baies Informatiques et Commutateurs de Distribution */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            2. Distribution & Chassis Baies ({racks.length})
          </div>

          {racks.map((rack) => {
            const isExpanded = expandedRacks[rack.id] ?? true;
            const rackDevs = rack.devices ?? [];
            const rackSwitches = rackDevs.filter((d) => d.deviceType === "SWITCH");
            const rackPP = rackDevs.filter((d) => d.deviceType === "PATCH_PANEL");
            const totalU = rack.uHeight || 42;

            return (
              <div
                key={rack.id}
                className="rounded-lg bg-slate-900/70 border border-slate-800 overflow-hidden"
              >
                {/* En-tete Baie cliquable */}
                <div
                  onClick={() => toggleRack(rack.id)}
                  className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-850/60 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button className="text-slate-400 p-0.5">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <Server className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-slate-200 text-xs truncate">
                        {rack.name}
                      </span>
                      <span className="text-[10px] text-purple-300 font-mono ml-1.5">
                        ({totalU}U)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {rackDevs.length} modules
                    </span>
                    {onFocusNode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusNode(rack.id);
                        }}
                        title="Localiser et zoomer sur cette baie sur le plan"
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Modules internes de la Baie */}
                {isExpanded && (
                  <div className="p-2.5 pt-0 space-y-1.5 border-t border-slate-850/80 bg-slate-950/40">
                    {/* Commutateurs de la Baie */}
                    <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider pt-1.5">
                      Commutateurs ({rackSwitches.length}) & Trunks DAC/SFP+ :
                    </div>
                    {rackSwitches.map((sw) => (
                      <div
                        key={sw.id}
                        className="p-2 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-mono text-purple-300 font-bold bg-purple-950/60 px-1 py-0.2 rounded text-[9px] border border-purple-800/40">
                              U{String(sw.slotU).padStart(2, "0")}
                            </span>
                            <span className="font-semibold text-slate-200 text-[11px] truncate">
                              {sw.name}
                            </span>
                          </div>
                          <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {sw.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>{sw.model}</span>
                          <span className="text-blue-400">{sw.ipAddress ?? "DHCP"}</span>
                        </div>
                      </div>
                    ))}

                    {/* Panneaux de Brassage */}
                    {rackPP.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                          Tiroirs de Brassage ({rackPP.length}) :
                        </div>
                        <div className="space-y-1 mt-1">
                          {rackPP.map((pp) => (
                            <div
                              key={pp.id}
                              className="p-1.5 rounded bg-slate-900/60 border border-slate-850 flex items-center justify-between text-[10px] font-mono"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">U{pp.slotU}</span>
                                <span className="text-slate-300 font-semibold">{pp.name}</span>
                              </div>
                              <span className="text-slate-500">{pp.portsCount ?? 24}P RJ45</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* NIVEAU 3 : Liaisons Horizontales & Equipements de Distribution Terminaux */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            3. Desserte Horizontale & Terminaux ({endpointNodes.length})
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                <Laptop className="w-3.5 h-3.5 text-blue-400" />
                <span>Bureaux & Postes</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {nodes.filter((n) => n.type === "DESK").length} ilots / benchs
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                <Wifi className="w-3.5 h-3.5 text-indigo-400" />
                <span>Bornes Wi-Fi AP</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {nodes.filter((n) => n.subType === "WIFI_AP").length} points d&apos;acces PoE+
              </div>
            </div>
          </div>

          {/* Liste filtree des prises et terminaux avec selection et centrage */}
          <div className="pt-2">
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
              Prises murales ({filteredWallOutlets.length}) :
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {filteredWallOutlets.slice(0, 25).map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => onSelectNode && onSelectNode(ep)}
                  className="p-1.5 rounded bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-850/60 transition cursor-pointer flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400 text-[10px]">
                      {ep.subType === "WIFI_AP"
                        ? "📶"
                        : ep.subType === "PRINTER_STATION"
                          ? "🖨️"
                          : "🔌"}
                    </span>
                    <span className="font-semibold text-slate-200 truncate">{ep.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: vlanStyles[ep.vlanId ?? 20]?.color ?? "#3b82f6" }}
                      title={`VLAN ${ep.vlanId ?? 20}`}
                    />
                    {onFocusNode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusNode(ep.id);
                        }}
                        className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                        title="Centrer sur le plan"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredWallOutlets.length > 25 && (
                <div className="text-[10px] text-slate-500 text-center py-1 font-mono">
                  + {filteredWallOutlets.length - 25} autres prises...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
