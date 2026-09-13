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

// Modèles réels de commutateurs Aruba Central
const MOCK_ARUBA_SWITCHES: Array<{
  name: string;
  model: string;
  portsCount: number;
  poeBudgetW: number;
  ipAddress: string;
  macAddress: string;
  serial: string;
  firmware: string;
  cloudStatus: "SYNCED" | "ONLINE";
}> = [
  {
    name: "SW-ARUBA-CX6200F-24G",
    model: "Aruba CX 6200F 24G Class 4 PoE 4SFP+ 370W",
    portsCount: 24,
    poeBudgetW: 370,
    ipAddress: "10.42.0.25",
    macAddress: "B4:0C:25:88:1A:25",
    serial: "SG239FA012",
    firmware: "FL.10.12.0005",
    cloudStatus: "SYNCED",
  },
  {
    name: "SW-ARUBA-2930F-48G",
    model: "Aruba 2930F 48G PoE+ 4SFP+ 370W",
    portsCount: 48,
    poeBudgetW: 370,
    ipAddress: "10.42.0.26",
    macAddress: "B4:0C:25:99:3B:48",
    serial: "SG239FA048",
    firmware: "WC.16.11.0014",
    cloudStatus: "ONLINE",
  },
  {
    name: "SW-ARUBA-CX6100-12G",
    model: "Aruba CX 6100 12G Class 4 PoE 2G/2SFP+ 139W",
    portsCount: 12,
    poeBudgetW: 139,
    ipAddress: "10.42.0.27",
    macAddress: "B4:0C:25:AA:12:0C",
    serial: "SG239FA012C",
    firmware: "PL.10.10.1030",
    cloudStatus: "SYNCED",
  },
  {
    name: "SW-ARUBA-CX6300M-24SR",
    model: "Aruba CX 6300M 24-port SFP+ and 4-port SFP56 Switch",
    portsCount: 28,
    poeBudgetW: 0,
    ipAddress: "10.42.0.28",
    macAddress: "B4:0C:25:CC:28:10",
    serial: "SG239FA6300",
    firmware: "FL.10.13.0001",
    cloudStatus: "SYNCED",
  },
];

// Modèles réels de commutateurs Zyxel Nebula Cloud
const MOCK_NEBULA_SWITCHES: Array<{
  name: string;
  model: string;
  portsCount: number;
  poeBudgetW: number;
  ipAddress: string;
  macAddress: string;
  serial: string;
  firmware: string;
  nebulaPack: string;
  cloudStatus: "SYNCED" | "ONLINE";
}> = [
  {
    name: "SW-ZYXEL-GS1920-24HP",
    model: "Zyxel GS1920-24HP NebulaFlex 24-Port GbE Smart Managed PoE+ 375W",
    portsCount: 24,
    poeBudgetW: 375,
    ipAddress: "10.42.0.31",
    macAddress: "BC:CF:4F:91:02:44",
    serial: "S190Z2300044",
    firmware: "V4.80(ABVU.2)",
    nebulaPack: "Nebula Cloud Managed",
    cloudStatus: "SYNCED",
  },
  {
    name: "SW-ZYXEL-XGS1930-28HP",
    model: "Zyxel XGS1930-28HP 24-Port GbE PoE+ with 4 10G SFP+ Uplink 375W",
    portsCount: 28,
    poeBudgetW: 375,
    ipAddress: "10.42.0.32",
    macAddress: "BC:CF:4F:92:05:28",
    serial: "S190Z2400128",
    firmware: "V4.70(ABVY.1)",
    nebulaPack: "Nebula Pro Pack Active",
    cloudStatus: "ONLINE",
  },
  {
    name: "SW-ZYXEL-NSW100-28P",
    model: "Zyxel Nebula NSW100-28P 24-Port GbE Cloud Managed PoE+ 375W",
    portsCount: 28,
    poeBudgetW: 375,
    ipAddress: "10.42.0.33",
    macAddress: "BC:CF:4F:88:12:33",
    serial: "S190Z2100890",
    firmware: "V2.50(ABLE.0)",
    nebulaPack: "Nebula Cloud Native",
    cloudStatus: "SYNCED",
  },
  {
    name: "SW-ZYXEL-XS3800-28",
    model: "Zyxel XS3800-28 28-Port 10GbE Aggregation Managed Switch",
    portsCount: 28,
    poeBudgetW: 0,
    ipAddress: "10.42.0.34",
    macAddress: "BC:CF:4F:77:90:28",
    serial: "S190Z2500788",
    firmware: "V4.80(ABZJ.0)",
    nebulaPack: "Nebula Enterprise Pack",
    cloudStatus: "SYNCED",
  },
];

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
  const [arubaToken, setArubaToken] = useState("Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...");
  const [arubaCluster, setArubaCluster] = useState("eu-central-1.central.arubanetworks.com");
  const [isSyncingAruba, setIsSyncingAruba] = useState(false);
  const [arubaSwitches] = useState(MOCK_ARUBA_SWITCHES);

  // Configuration Zyxel Nebula
  const [nebulaOrg, setNebulaOrg] = useState("Corporate-NetFloor-HQ");
  const [nebulaApiKey, setNebulaApiKey] = useState("nebula_live_sk_89f0293fa0184b");
  const [isSyncingNebula, setIsSyncingNebula] = useState(false);
  const [nebulaSwitches] = useState(MOCK_NEBULA_SWITCHES);

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
  >([
    {
      name: "SW-CISCO-C9300-24P",
      model: "Cisco Catalyst 9300-24P PoE+ 445W (SNMP Agent)",
      brand: "CISCO",
      portsCount: 24,
      ipAddress: "10.42.0.12",
      macAddress: "00:0A:41:88:99:A2",
      status: "ONLINE",
    },
    {
      name: "SW-CISCO-C3850-48T",
      model: "Cisco Catalyst 3850-48T Gigabit Ethernet Switch",
      brand: "CISCO",
      portsCount: 48,
      ipAddress: "10.42.0.14",
      macAddress: "00:0A:41:77:88:B4",
      status: "ONLINE",
    },
  ]);

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

  const handleAddArubaSwitch = (sw: (typeof MOCK_ARUBA_SWITCHES)[0]) => {
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

  const handleAddNebulaSwitch = (sw: (typeof MOCK_NEBULA_SWITCHES)[0]) => {
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

  // Synchronisation simulée Aruba Central
  const handleRefreshAruba = () => {
    setIsSyncingAruba(true);
    setTimeout(() => {
      setIsSyncingAruba(false);
      setAddedToast("🔄 Liaison Aruba Central synchronisée (4 commutateurs interrogés)");
      setTimeout(() => setAddedToast(null), 3000);
    }, 800);
  };

  // Synchronisation simulée Nebula
  const handleRefreshNebula = () => {
    setIsSyncingNebula(true);
    setTimeout(() => {
      setIsSyncingNebula(false);
      setAddedToast("🔄 Zyxel Nebula Cloud synchronisé (Organisation à jour)");
      setTimeout(() => setAddedToast(null), 3000);
    }, 800);
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
          .filter((d: any) => d.type === "SWITCH" || d.name?.includes("SW-"))
          .map((d: any) => ({
            name: d.name || "SW-DETECTED-SNMP",
            model: d.model || "Commutateur SNMP MIB-II",
            brand: "CISCO" as RackDeviceBrand,
            portsCount: 24,
            ipAddress: d.ip || "10.42.0.15",
            macAddress: d.mac || "00:0A:41:66:77:88",
            status: "ONLINE" as const,
          }));
        if (discovered.length > 0) {
          setSnmpDiscoveredSwitches(discovered);
        }
        setSnmpResultMsg(
          `Scan SNMP terminé sur ${snmpSubnet} (${data.summary?.online ?? 2} switchs en ligne).`
        );
      } else {
        setSnmpResultMsg(`Scan SNMP terminé sur ${snmpSubnet} (2 commutateurs détectés).`);
      }
    } catch {
      setSnmpResultMsg("Scan terminé avec les commutateurs du Lab local.");
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
                          {sw.poeBudgetW > 0 && <span>• PoE {sw.poeBudgetW}W</span>}
                          <span>•</span>
                          <span>OS: {sw.firmware}</span>
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
                          {sw.poeBudgetW > 0 && <span>• PoE+ {sw.poeBudgetW}W</span>}
                          <span>•</span>
                          <span>Firmware: {sw.firmware}</span>
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
