"use client";

import { useState, type FC } from "react";
import { X, Search, Radio, Cloud, Check, Plus, Activity, RefreshCw, Zap } from "lucide-react";
import { RackDeviceItem, RackDeviceBrand } from "@/components/canvas/EquipmentLayer";

interface CloudSwitchDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  rackName: string;
  rackUHeight?: number;
  existingDevices?: RackDeviceItem[];
  onAddDeviceToRack: (device: RackDeviceItem) => void;
}

type DiscoveryTab = "ARUBA" | "NEBULA" | "SNMP";

export interface CloudDiscoveredSwitch {
  name: string;
  model: string;
  portsCount: number;
  poeBudgetW?: number;
  ipAddress: string;
  macAddress: string;
  serial: string;
  firmware?: string;
  nebulaPack?: string;
  cloudStatus: "SYNCED" | "ONLINE";
}

export const CloudSwitchDiscoveryModal: FC<CloudSwitchDiscoveryModalProps> = ({
  isOpen,
  onClose,
  rackName,
  rackUHeight = 42,
  existingDevices = [],
  onAddDeviceToRack,
}) => {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("ARUBA");

  // Configuration Aruba Central
  const [arubaToken, setArubaToken] = useState("");
  const [arubaCluster, setArubaCluster] = useState("eu-central-1.central.arubanetworks.com");
  const [isSyncingAruba, setIsSyncingAruba] = useState(false);
  const [arubaSwitches, setArubaSwitches] = useState<CloudDiscoveredSwitch[]>([]);

  // Configuration Zyxel Nebula
  const [nebulaOrg, setNebulaOrg] = useState("");
  const [nebulaApiKey, setNebulaApiKey] = useState("");
  const [isSyncingNebula, setIsSyncingNebula] = useState(false);
  const [nebulaSwitches, setNebulaSwitches] = useState<CloudDiscoveredSwitch[]>([]);

  // Configuration SNMP Local
  const [snmpSubnet, setSnmpSubnet] = useState("10.42.0.0/24");
  const [snmpCommunity, setSnmpCommunity] = useState("public");
  const [isScanningSnmp, setIsScanningSnmp] = useState(false);
  const [snmpResultMsg, setSnmpResultMsg] = useState<string | null>(null);
  const [snmpDiscoveredSwitches, setSnmpDiscoveredSwitches] = useState<
    Array<{
      name: string;
      model: string;
      brand: RackDeviceBrand;
      portsCount: number;
      ipAddress: string;
      macAddress: string;
      status: "ONLINE" | "SYNCED";
    }>
  >([]);

  // Toast de notification local
  const [addedToast, setAddedToast] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calcul du prochain slot U libre (descendant de U42 à U1)
  const getNextFreeSlotU = (): number => {
    const occupiedSlots = new Set(existingDevices.map((d) => d.slotU));
    for (let u = 24; u >= 1; u--) {
      if (!occupiedSlots.has(u)) return u;
    }
    for (let u = rackUHeight; u >= 1; u--) {
      if (!occupiedSlots.has(u)) return u;
    }
    return 1;
  };

  const handleAddArubaSwitch = (sw: CloudDiscoveredSwitch) => {
    const freeSlot = getNextFreeSlotU();
    const newDev: RackDeviceItem = {
      id: `dev-aruba-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: sw.name,
      slotU: freeSlot,
      uSize: 1,
      deviceType: "SWITCH",
      brand: "ARUBA",
      model: sw.model,
      ipAddress: sw.ipAddress,
      macAddress: sw.macAddress,
      portsCount: sw.portsCount,
      status: sw.cloudStatus,
      cloudManagedBy: "ARUBA_CENTRAL",
    };
    onAddDeviceToRack(newDev);
    setAddedToast(`✅ ${sw.name} ajouté à la baie ${rackName} en U${freeSlot} !`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  const handleAddNebulaSwitch = (sw: CloudDiscoveredSwitch) => {
    const freeSlot = getNextFreeSlotU();
    const newDev: RackDeviceItem = {
      id: `dev-nebula-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: sw.name,
      slotU: freeSlot,
      uSize: 1,
      deviceType: "SWITCH",
      brand: "ZYXEL_NEBULA",
      model: sw.model,
      ipAddress: sw.ipAddress,
      macAddress: sw.macAddress,
      portsCount: sw.portsCount,
      status: sw.cloudStatus,
      cloudManagedBy: "NEBULA_CLOUD",
    };
    onAddDeviceToRack(newDev);
    setAddedToast(`✅ ${sw.name} ajouté à la baie ${rackName} en U${freeSlot} !`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  const handleAddSnmpSwitch = (sw: (typeof snmpDiscoveredSwitches)[0]) => {
    const freeSlot = getNextFreeSlotU();
    const newDev: RackDeviceItem = {
      id: `dev-snmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: sw.name,
      slotU: freeSlot,
      uSize: 1,
      deviceType: "SWITCH",
      brand: sw.brand,
      model: sw.model,
      ipAddress: sw.ipAddress,
      macAddress: sw.macAddress,
      portsCount: sw.portsCount,
      status: sw.status,
      cloudManagedBy: "SNMP_LOCAL",
    };
    onAddDeviceToRack(newDev);
    setAddedToast(`✅ ${sw.name} ajouté à la baie ${rackName} en U${freeSlot} !`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  // Synchronisation Aruba Central (authentique sans données factices)
  const handleRefreshAruba = async () => {
    setIsSyncingAruba(true);
    if (!arubaToken.trim()) {
      setIsSyncingAruba(false);
      setArubaSwitches([]);
      setAddedToast("⚠️ Aucun commutateur détecté : renseignez un token d'accès Aruba Central.");
      setTimeout(() => setAddedToast(null), 3500);
      return;
    }
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "aruba", cluster: arubaCluster, token: arubaToken }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.switches) && data.switches.length > 0) {
        setArubaSwitches(data.switches);
        setAddedToast(`✅ ${data.switches.length} commutateur(s) Aruba synchronisé(s) !`);
      } else {
        setArubaSwitches([]);
        setAddedToast("⚠️ Aucun commutateur actif détecté sur ce compte Aruba Central.");
      }
    } catch {
      setArubaSwitches([]);
      setAddedToast("❌ Erreur de liaison avec l'API Aruba Central.");
    } finally {
      setIsSyncingAruba(false);
      setTimeout(() => setAddedToast(null), 3500);
    }
  };

  // Synchronisation Zyxel Nebula (authentique sans données factices)
  const handleRefreshNebula = async () => {
    setIsSyncingNebula(true);
    if (!nebulaApiKey.trim()) {
      setIsSyncingNebula(false);
      setNebulaSwitches([]);
      setAddedToast("⚠️ Aucun commutateur détecté : renseignez une clé d'API Zyxel Nebula.");
      setTimeout(() => setAddedToast(null), 3500);
      return;
    }
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "zyxel", org: nebulaOrg, apiKey: nebulaApiKey }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.switches) && data.switches.length > 0) {
        setNebulaSwitches(data.switches);
        setAddedToast(`✅ ${data.switches.length} commutateur(s) Zyxel Nebula synchronisé(s) !`);
      } else {
        setNebulaSwitches([]);
        setAddedToast("⚠️ Aucun commutateur actif détecté sur cette organisation Nebula.");
      }
    } catch {
      setNebulaSwitches([]);
      setAddedToast("❌ Erreur de liaison avec l'API Zyxel Nebula.");
    } finally {
      setIsSyncingNebula(false);
      setTimeout(() => setAddedToast(null), 3500);
    }
  };

  // Scan SNMP via l'API locale
  const handleRunSnmpScan = async () => {
    setIsScanningSnmp(true);
    setSnmpResultMsg(null);
    try {
      const res = await fetch("/api/snmp/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subnet: snmpSubnet, community: snmpCommunity }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.devices)) {
        const discovered = data.devices
          .filter(
            (d: any) => d.type === "SWITCH" || d.deviceType === "SWITCH" || d.name?.includes("SW-")
          )
          .map((d: any) => ({
            name: d.name || "SW-DETECTED-SNMP",
            model: d.model || "Commutateur SNMP MIB-II",
            brand: "CISCO" as RackDeviceBrand,
            portsCount: d.totalPorts || d.portsCount || 24,
            ipAddress: d.ip || d.ipAddress || "10.42.0.15",
            macAddress: d.mac || d.macAddress || "00:0A:41:66:77:88",
            status: "ONLINE" as const,
          }));
        setSnmpDiscoveredSwitches(discovered);
        if (discovered.length > 0) {
          setSnmpResultMsg(
            `Scan SNMP terminé sur ${snmpSubnet} (${discovered.length} commutateur(s) en ligne).`
          );
        } else {
          setSnmpResultMsg(`Scan SNMP terminé sur ${snmpSubnet} : aucun commutateur détecté.`);
        }
      } else {
        setSnmpDiscoveredSwitches([]);
        setSnmpResultMsg(`Scan SNMP terminé sur ${snmpSubnet} : aucun commutateur détecté.`);
      }
    } catch {
      setSnmpDiscoveredSwitches([]);
      setSnmpResultMsg("Échec de la communication SNMP (hôte ou réseau injoignable).");
    } finally {
      setIsScanningSnmp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-hidden">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-[780px] max-w-[95vw] h-[640px] max-h-[92vh] shadow-2xl flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Toast flottant */}
        {addedToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Check className="w-4 h-4" />
            <span>{addedToast}</span>
          </div>
        )}

        {/* En-tête de la modale */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  Découverte & Ajout de Commutateurs
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50">
                  Baie : {rackName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Détection automatique via Aruba Central (HPE), Zyxel Nebula Cloud ou SNMP local
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Onglets de sélection du fournisseur Cloud / SNMP */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-slate-900/40 border-b border-slate-800 flex-shrink-0 font-sans text-xs">
          <button
            onClick={() => setActiveTab("ARUBA")}
            className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
              activeTab === "ARUBA"
                ? "bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Cloud className="w-4 h-4 text-amber-400" />
            <span>Aruba Central (HPE)</span>
          </button>
          <button
            onClick={() => setActiveTab("NEBULA")}
            className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
              activeTab === "NEBULA"
                ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Zyxel Nebula Central</span>
          </button>
          <button
            onClick={() => setActiveTab("SNMP")}
            className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
              activeTab === "SNMP"
                ? "bg-sky-600/30 text-sky-300 border border-sky-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Scan SNMP Local</span>
          </button>
        </div>

        {/* Corps de l'onglet avec défilement fluide sans ascenseur horizontal */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 font-sans text-xs">
          {/* 1. ONGLET ARUBA CENTRAL */}
          {activeTab === "ARUBA" && (
            <div className="space-y-3">
              {/* Barre de configuration API Aruba */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4" />
                    Liaison Aruba Central REST API
                  </span>
                  <button
                    onClick={handleRefreshAruba}
                    disabled={isSyncingAruba}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingAruba ? "animate-spin" : ""}`} />
                    {isSyncingAruba ? "Interrogation..." : "Actualiser"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <label className="text-slate-400 block mb-0.5">Cluster Aruba Central :</label>
                    <input
                      type="text"
                      value={arubaCluster}
                      onChange={(e) => setArubaCluster(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Token d'accès OIDC :</label>
                    <input
                      type="password"
                      value={arubaToken}
                      onChange={(e) => setArubaToken(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Liste des commutateurs Aruba découverts */}
              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>Commutateurs gérés par Aruba Central ({arubaSwitches.length}) :</span>
                  <span className="text-slate-500 text-[10px]">
                    1 clic pour intégrer dans la baie
                  </span>
                </div>
                {arubaSwitches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60 px-4">
                    Aucun commutateur Aruba Central synchronisé. Renseignez votre token API et
                    cliquez sur "Actualiser".
                  </div>
                ) : (
                  <div className="space-y-2">
                    {arubaSwitches.map((sw) => (
                      <div
                        key={sw.serial}
                        className="p-3 bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl transition flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100 group-hover:text-amber-300 transition">
                              {sw.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Aruba CX / OS-S
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Cloud Synced
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{sw.model}</div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                            <span>IP: {sw.ipAddress}</span>
                            <span>•</span>
                            <span>MAC: {sw.macAddress}</span>
                            <span>•</span>
                            <span>{sw.portsCount} Ports</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddArubaSwitch(sw)}
                          className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition flex-shrink-0 shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ajouter à la Baie</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. ONGLET ZYXEL NEBULA CENTRAL */}
          {activeTab === "NEBULA" && (
            <div className="space-y-3">
              {/* Barre de configuration API Nebula */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    Liaison Zyxel Nebula Cloud API
                  </span>
                  <button
                    onClick={handleRefreshNebula}
                    disabled={isSyncingNebula}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingNebula ? "animate-spin" : ""}`} />
                    {isSyncingNebula ? "Synchronisation..." : "Actualiser"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <label className="text-slate-400 block mb-0.5">Organisation Nebula :</label>
                    <input
                      type="text"
                      value={nebulaOrg}
                      onChange={(e) => setNebulaOrg(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Clé API Nebula Pro :</label>
                    <input
                      type="password"
                      value={nebulaApiKey}
                      onChange={(e) => setNebulaApiKey(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Liste des commutateurs Nebula découverts */}
              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>Commutateurs NebulaFlex découverts ({nebulaSwitches.length}) :</span>
                  <span className="text-slate-500 text-[10px]">Intégration directe au châssis</span>
                </div>
                {nebulaSwitches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60 px-4">
                    Aucun commutateur Nebula synchronisé. Renseignez vos identifiants d'organisation
                    et cliquez sur "Actualiser".
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nebulaSwitches.map((sw) => (
                      <div
                        key={sw.serial}
                        className="p-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100 group-hover:text-emerald-300 transition">
                              {sw.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {sw.nebulaPack}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Nebula Cloud
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{sw.model}</div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                            <span>IP: {sw.ipAddress}</span>
                            <span>•</span>
                            <span>MAC: {sw.macAddress}</span>
                            <span>•</span>
                            <span>{sw.portsCount} Ports GbE</span>
                            {(sw.poeBudgetW ?? 0) > 0 && <span>• PoE+ {sw.poeBudgetW}W</span>}
                            {sw.firmware && <span>• Firmware: {sw.firmware}</span>}
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddNebulaSwitch(sw)}
                          className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition flex-shrink-0 shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ajouter à la Baie</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. ONGLET SNMP SCAN LOCAL */}
          {activeTab === "SNMP" && (
            <div className="space-y-3">
              {/* Formulaire de scan SNMP */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  Sonde SNMP v2c / v3 Walk
                </span>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="col-span-2">
                    <label className="text-slate-400 block mb-0.5">Sous-réseau ou IP Cible :</label>
                    <input
                      type="text"
                      value={snmpSubnet}
                      onChange={(e) => setSnmpSubnet(e.target.value)}
                      placeholder="Ex: 10.42.0.0/24 ou 127.0.0.1"
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Communauté :</label>
                    <input
                      type="text"
                      value={snmpCommunity}
                      onChange={(e) => setSnmpCommunity(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500 font-mono">
                    Interroge les OIDs sysName, sysDescr, Bridge-MIB dot1dTpFdbPort
                  </span>
                  <button
                    onClick={handleRunSnmpScan}
                    disabled={isScanningSnmp}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow"
                  >
                    <Search className={`w-3.5 h-3.5 ${isScanningSnmp ? "animate-spin" : ""}`} />
                    {isScanningSnmp ? "Scan en cours..." : "Lancer le scan SNMP"}
                  </button>
                </div>
              </div>

              {/* Résultat du scan SNMP */}
              {snmpResultMsg && (
                <div className="p-2.5 bg-sky-950/40 border border-sky-800/40 rounded-lg text-sky-200 text-xs font-mono">
                  {snmpResultMsg}
                </div>
              )}

              {/* Liste des commutateurs SNMP découverts */}
              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-2">
                  Commutateurs détectés via SNMP ({snmpDiscoveredSwitches.length}) :
                </div>
                {snmpDiscoveredSwitches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60 px-4">
                    Aucun commutateur SNMP détecté. Lancez un scan sur une IP ou un sous-réseau
                    joignable.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {snmpDiscoveredSwitches.map((sw) => (
                      <div
                        key={sw.ipAddress}
                        className="p-3 bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-xl transition flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100 group-hover:text-sky-300 transition">
                              {sw.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              SNMP v2c/v3
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Réponse OK
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{sw.model}</div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                            <span>IP: {sw.ipAddress}</span>
                            <span>•</span>
                            <span>MAC: {sw.macAddress}</span>
                            <span>•</span>
                            <span>{sw.portsCount} Ports</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddSnmpSwitch(sw)}
                          className="px-3 py-1.5 bg-sky-600/30 hover:bg-sky-600 text-sky-200 hover:text-white border border-sky-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition flex-shrink-0 shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ajouter à la Baie</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pied de la modale */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            {existingDevices.length} équipement(s) déjà présent(s) dans le châssis 42U
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
