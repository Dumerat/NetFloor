"use client";

import { useState, type FC } from "react";
import { X, Radio, Cloud, Check, Plus, Activity, RefreshCw, Zap, Server, Wifi } from "lucide-react";
import { RackDeviceItem, RackDeviceBrand } from "@/components/canvas/EquipmentLayer";

interface CloudSwitchDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  rackName: string;
  rackUHeight?: number;
  existingDevices?: RackDeviceItem[];
  onAddDeviceToRack: (device: RackDeviceItem) => void;
}

type DiscoveryTab = "MERAKI" | "UBIQUITI" | "ARUBA" | "NEBULA" | "SNMP";

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
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("MERAKI");

  // Configuration Cisco Meraki
  const [merakiApiKey, setMerakiApiKey] = useState("");
  const [merakiOrgId, setMerakiOrgId] = useState("");
  const [isSyncingMeraki, setIsSyncingMeraki] = useState(false);
  const [merakiSwitches, setMerakiSwitches] = useState<CloudDiscoveredSwitch[]>([]);

  // Configuration Ubiquiti UniFi
  const [unifiHost, setUnifiHost] = useState("192.168.1.1");
  const [unifiApiKey, setUnifiApiKey] = useState("");
  const [unifiSite, setUnifiSite] = useState("default");
  const [isSyncingUnifi, setIsSyncingUnifi] = useState(false);
  const [unifiSwitches, setUnifiSwitches] = useState<CloudDiscoveredSwitch[]>([]);

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

  const handleAddMerakiSwitch = (sw: CloudDiscoveredSwitch) => {
    const freeSlot = getNextFreeSlotU();
    const newDev: RackDeviceItem = {
      id: `dev-meraki-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: sw.name,
      slotU: freeSlot,
      uSize: 1,
      deviceType: "SWITCH",
      brand: "CISCO",
      model: sw.model,
      ipAddress: sw.ipAddress,
      macAddress: sw.macAddress,
      portsCount: sw.portsCount,
      status: sw.cloudStatus,
      cloudManagedBy: "MERAKI",
    };
    onAddDeviceToRack(newDev);
    setAddedToast(`✅ ${sw.name} ajouté à la baie ${rackName} en U${freeSlot} !`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  const handleAddUnifiSwitch = (sw: CloudDiscoveredSwitch) => {
    const freeSlot = getNextFreeSlotU();
    const newDev: RackDeviceItem = {
      id: `dev-unifi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: sw.name,
      slotU: freeSlot,
      uSize: 1,
      deviceType: "SWITCH",
      brand: "UBIQUITI",
      model: sw.model,
      ipAddress: sw.ipAddress,
      macAddress: sw.macAddress,
      portsCount: sw.portsCount,
      status: sw.cloudStatus,
      cloudManagedBy: "UNIFI_CLOUD",
    };
    onAddDeviceToRack(newDev);
    setAddedToast(`✅ ${sw.name} ajouté à la baie ${rackName} en U${freeSlot} !`);
    setTimeout(() => setAddedToast(null), 3000);
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

  // Synchronisation Cisco Meraki
  const handleRefreshMeraki = async () => {
    setIsSyncingMeraki(true);
    if (!merakiApiKey.trim()) {
      setIsSyncingMeraki(false);
      setMerakiSwitches([]);
      setAddedToast("⚠️ Renseignez une clé d'API Cisco Meraki Dashboard.");
      setTimeout(() => setAddedToast(null), 3500);
      return;
    }
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "meraki", apiKey: merakiApiKey, orgId: merakiOrgId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.switches) && data.switches.length > 0) {
        setMerakiSwitches(data.switches);
        setAddedToast(`✅ ${data.switches.length} commutateur(s) Meraki synchronisé(s) !`);
      } else {
        setMerakiSwitches([]);
        setAddedToast("⚠️ Aucun commutateur Meraki MS trouvé.");
      }
    } catch {
      setMerakiSwitches([]);
      setAddedToast("❌ Erreur de liaison avec l'API Cisco Meraki.");
    } finally {
      setIsSyncingMeraki(false);
      setTimeout(() => setAddedToast(null), 3500);
    }
  };

  // Synchronisation Ubiquiti UniFi
  const handleRefreshUnifi = async () => {
    setIsSyncingUnifi(true);
    if (!unifiHost.trim()) {
      setIsSyncingUnifi(false);
      setUnifiSwitches([]);
      setAddedToast("⚠️ Renseignez l'hôte ou IP du contrôleur UniFi.");
      setTimeout(() => setAddedToast(null), 3500);
      return;
    }
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ubiquiti",
          host: unifiHost,
          apiKey: unifiApiKey,
          site: unifiSite,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.switches) && data.switches.length > 0) {
        setUnifiSwitches(data.switches);
        setAddedToast(`✅ ${data.switches.length} commutateur(s) UniFi synchronisé(s) !`);
      } else {
        setUnifiSwitches([]);
        setAddedToast("⚠️ Aucun commutateur UniFi USW trouvé.");
      }
    } catch {
      setUnifiSwitches([]);
      setAddedToast("❌ Erreur de liaison avec le contrôleur UniFi.");
    } finally {
      setIsSyncingUnifi(false);
      setTimeout(() => setAddedToast(null), 3500);
    }
  };

  // Synchronisation Aruba Central
  const handleRefreshAruba = async () => {
    setIsSyncingAruba(true);
    if (!arubaToken.trim()) {
      setIsSyncingAruba(false);
      setArubaSwitches([]);
      setAddedToast("⚠️ Renseignez un token d'accès Aruba Central.");
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

  // Synchronisation Zyxel Nebula
  const handleRefreshNebula = async () => {
    setIsSyncingNebula(true);
    if (!nebulaApiKey.trim()) {
      setIsSyncingNebula(false);
      setNebulaSwitches([]);
      setAddedToast("⚠️ Renseignez une clé d'API Zyxel Nebula.");
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
            brand: (d.brand || "GENERIC") as RackDeviceBrand,
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
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-[840px] max-w-[95vw] h-[660px] max-h-[92vh] shadow-2xl flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
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
                Détection automatique via Cisco Meraki, Ubiquiti UniFi, Aruba Central, Zyxel Nebula
                ou SNMP
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

        {/* Onglets de sélection du fournisseur Cloud / SNMP (5 onglets) */}
        <div className="grid grid-cols-5 gap-1 p-2 bg-slate-900/40 border-b border-slate-800 flex-shrink-0 font-sans text-xs">
          <button
            onClick={() => setActiveTab("MERAKI")}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition text-[11px] ${
              activeTab === "MERAKI"
                ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cisco Meraki</span>
          </button>
          <button
            onClick={() => setActiveTab("UBIQUITI")}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition text-[11px] ${
              activeTab === "UBIQUITI"
                ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-blue-400" />
            <span>Ubiquiti UniFi</span>
          </button>
          <button
            onClick={() => setActiveTab("ARUBA")}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition text-[11px] ${
              activeTab === "ARUBA"
                ? "bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-amber-400" />
            <span>Aruba Central</span>
          </button>
          <button
            onClick={() => setActiveTab("NEBULA")}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition text-[11px] ${
              activeTab === "NEBULA"
                ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span>Zyxel Nebula</span>
          </button>
          <button
            onClick={() => setActiveTab("SNMP")}
            className={`py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition text-[11px] ${
              activeTab === "SNMP"
                ? "bg-sky-600/30 text-sky-300 border border-sky-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Scan SNMP</span>
          </button>
        </div>

        {/* Corps de l'onglet */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 font-sans text-xs">
          {/* 1. ONGLET CISCO MERAKI */}
          {activeTab === "MERAKI" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Server className="w-4 h-4" />
                    Liaison Cisco Meraki Dashboard API v1
                  </span>
                  <button
                    onClick={handleRefreshMeraki}
                    disabled={isSyncingMeraki}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingMeraki ? "animate-spin" : ""}`} />
                    {isSyncingMeraki ? "Interrogation..." : "Actualiser"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <label className="text-slate-400 block mb-0.5">
                      Clé d&apos;API Meraki (X-Cisco-Meraki-API-Key) :
                    </label>
                    <input
                      type="password"
                      value={merakiApiKey}
                      onChange={(e) => setMerakiApiKey(e.target.value)}
                      placeholder="68497492c73295982..."
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">
                      Organisation ID (Optionnel) :
                    </label>
                    <input
                      type="text"
                      value={merakiOrgId}
                      onChange={(e) => setMerakiOrgId(e.target.value)}
                      placeholder="ex: 123456"
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>Commutateurs Meraki MS découverts ({merakiSwitches.length}) :</span>
                  <span className="text-slate-500 text-[10px]">Liaison Cloud Cisco Meraki</span>
                </div>
                {merakiSwitches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60 px-4">
                    Aucun commutateur Meraki chargé. Renseignez votre clé API Dashboard et cliquez
                    sur &quot;Actualiser&quot;.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {merakiSwitches.map((sw) => (
                      <div
                        key={sw.serial || sw.macAddress}
                        className="p-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100 group-hover:text-emerald-300 transition">
                              {sw.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Cisco Meraki MS
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              En ligne
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
                          onClick={() => handleAddMerakiSwitch(sw)}
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

          {/* 2. ONGLET UBIQUITI UNIFI */}
          {activeTab === "UBIQUITI" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-300 flex items-center gap-1.5">
                    <Wifi className="w-4 h-4" />
                    Liaison Ubiquiti UniFi Network Controller
                  </span>
                  <button
                    onClick={handleRefreshUnifi}
                    disabled={isSyncingUnifi}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingUnifi ? "animate-spin" : ""}`} />
                    {isSyncingUnifi ? "Interrogation..." : "Actualiser"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div>
                    <label className="text-slate-400 block mb-0.5">
                      Hôte Contrôleur (IP/FQDN) :
                    </label>
                    <input
                      type="text"
                      value={unifiHost}
                      onChange={(e) => setUnifiHost(e.target.value)}
                      placeholder="192.168.1.1 ou unifi.local"
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Clé d&apos;API UniFi OS :</label>
                    <input
                      type="password"
                      value={unifiApiKey}
                      onChange={(e) => setUnifiApiKey(e.target.value)}
                      placeholder="API Token..."
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Site UniFi :</label>
                    <input
                      type="text"
                      value={unifiSite}
                      onChange={(e) => setUnifiSite(e.target.value)}
                      placeholder="default"
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>Commutateurs UniFi USW découverts ({unifiSwitches.length}) :</span>
                  <span className="text-slate-500 text-[10px]">Contrôleur UniFi Network</span>
                </div>
                {unifiSwitches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60 px-4">
                    Aucun commutateur UniFi chargé. Renseignez l&apos;adresse du contrôleur et
                    cliquez sur &quot;Actualiser&quot;.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unifiSwitches.map((sw) => (
                      <div
                        key={sw.macAddress}
                        className="p-3 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl transition flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100 group-hover:text-blue-300 transition">
                              {sw.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Ubiquiti UniFi
                            </span>
                            <span className="text-[10px] font-mono text-blue-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                              Connecté
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{sw.model}</div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                            <span>IP: {sw.ipAddress}</span>
                            <span>•</span>
                            <span>MAC: {sw.macAddress}</span>
                            <span>•</span>
                            <span>{sw.portsCount} Ports</span>
                            {(sw.poeBudgetW ?? 0) > 0 && <span>• PoE {sw.poeBudgetW}W</span>}
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddUnifiSwitch(sw)}
                          className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition flex-shrink-0 shadow"
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

          {/* 3. ONGLET ARUBA CENTRAL */}
          {activeTab === "ARUBA" && (
            <div className="space-y-3">
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
                    <label className="text-slate-400 block mb-0.5">
                      Token d&apos;accès OAuth2 :
                    </label>
                    <input
                      type="password"
                      value={arubaToken}
                      onChange={(e) => setArubaToken(e.target.value)}
                      placeholder="Bearer token..."
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>Commutateurs gérés par Aruba Central ({arubaSwitches.length}) :</span>
                  <span className="text-slate-500 text-[10px]">HPE GreenLake / Aruba Central</span>
                </div>
                {arubaSwitches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60 px-4">
                    Aucun commutateur Aruba chargé. Renseignez votre token d&apos;accès et cliquez
                    sur &quot;Actualiser&quot;.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {arubaSwitches.map((sw) => (
                      <div
                        key={sw.serial || sw.macAddress}
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

          {/* 4. ONGLET ZYXEL NEBULA */}
          {activeTab === "NEBULA" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    Liaison Zyxel Nebula Cloud API
                  </span>
                  <button
                    onClick={handleRefreshNebula}
                    disabled={isSyncingNebula}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
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
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Clé API Nebula Pro :</label>
                    <input
                      type="password"
                      value={nebulaApiKey}
                      onChange={(e) => setNebulaApiKey(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>Commutateurs NebulaFlex découverts ({nebulaSwitches.length}) :</span>
                  <span className="text-slate-500 text-[10px]">Intégration directe au châssis</span>
                </div>
                {nebulaSwitches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60 px-4">
                    Aucun commutateur Nebula synchronisé. Renseignez vos identifiants
                    d&apos;organisation et cliquez sur &quot;Actualiser&quot;.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nebulaSwitches.map((sw) => (
                      <div
                        key={sw.serial || sw.macAddress}
                        className="p-3 bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-xl transition flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100 group-hover:text-purple-300 transition">
                              {sw.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {sw.nebulaPack || "NebulaFlex"}
                            </span>
                            <span className="text-[10px] font-mono text-purple-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
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
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddNebulaSwitch(sw)}
                          className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition flex-shrink-0 shadow"
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

          {/* 5. ONGLET SNMP LOCAL */}
          {activeTab === "SNMP" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    Scan SNMP Local Multi-Constructeurs (MIB-II)
                  </span>
                  <button
                    onClick={handleRunSnmpScan}
                    disabled={isScanningSnmp}
                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanningSnmp ? "animate-spin" : ""}`} />
                    {isScanningSnmp ? "Balayage..." : "Lancer le Scan"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <label className="text-slate-400 block mb-0.5">Sous-réseau ou IP cible :</label>
                    <input
                      type="text"
                      value={snmpSubnet}
                      onChange={(e) => setSnmpSubnet(e.target.value)}
                      placeholder="192.168.1.0/24 ou 192.168.1.254"
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Communauté SNMP (v2c) :</label>
                    <input
                      type="password"
                      value={snmpCommunity}
                      onChange={(e) => setSnmpCommunity(e.target.value)}
                      placeholder="public"
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {snmpResultMsg && (
                <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/50 text-sky-300 text-xs flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <span>{snmpResultMsg}</span>
                </div>
              )}

              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>Commutateurs SNMP détectés ({snmpDiscoveredSwitches.length}) :</span>
                  <span className="text-slate-500 text-[10px]">Détection MIB-II universelle</span>
                </div>
                {snmpDiscoveredSwitches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60 px-4">
                    Aucun commutateur SNMP détecté. Vérifiez l&apos;IP ou le sous-réseau et la
                    communauté SNMP.
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
                              {sw.brand}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              SNMP Réactif
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
        <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span>
              Baie active : <strong className="text-slate-200">{rackName}</strong>
            </span>
            <span>•</span>
            <span>
              Prochain emplacement libre :{" "}
              <strong className="text-purple-400 font-mono">U{getNextFreeSlotU()}</strong>
            </span>
          </div>
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
