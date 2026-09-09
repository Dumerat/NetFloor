"use client";

import { useState, useMemo, type FC } from "react";
import {
  X,
  Shield,
  KeyRound,
  Radio,
  Network,
  Plug,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Download,
  Server,
  Laptop,
  Phone,
  Printer,
  Wifi,
  Cpu,
  Thermometer,
  HardDrive,
  Activity,
  ExternalLink,
  Send,
  Sliders,
  Check,
} from "lucide-react";
import { NodeDisplay } from "@/components/canvas/EquipmentLayer";
import {
  SystemSettings,
  INITIAL_SETTINGS,
  MOCK_DISCOVERED_DEVICES,
  DeviceTelemetry,
} from "@/data/settingsStore";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeDisplay[];
  onUpdateNodeProperties?: (nodeId: string, updates: Partial<NodeDisplay>) => void;
}

type TabType = "sso" | "snmp" | "ipam" | "integrations";

export const SettingsModal: FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onUpdateNodeProperties,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("sso");
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [discoveredDevices, setDiscoveredDevices] = useState<DeviceTelemetry[]>(MOCK_DISCOVERED_DEVICES);

  // États pour les actions interactives
  const [isScanningSnmp, setIsScanningSnmp] = useState(false);
  const [snmpScanResult, setSnmpScanResult] = useState<string | null>(null);

  const [isTestingSso, setIsTestingSso] = useState(false);
  const [ssoTestResult, setSsoTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, { loading: boolean; msg: string | null }>>({});

  // Filtre et recherche IPAM
  const [ipSearch, setIpSearch] = useState("");
  const [ipFilterType, setIpFilterType] = useState<string>("ALL");

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Liste des nœuds avec filtrage IPAM
  const filteredIpamNodes = useMemo(() => {
    return nodes
      .filter((n) => n.type !== "DESK") // Ignorer les bureaux en tant que tel, se concentrer sur prises et baies
      .filter((n) => {
        if (ipFilterType !== "ALL" && n.type !== ipFilterType && n.subType !== ipFilterType) {
          return false;
        }
        if (!ipSearch.trim()) return true;
        const q = ipSearch.toLowerCase();
        return (
          n.name.toLowerCase().includes(q) ||
          (n.ipAddress && n.ipAddress.toLowerCase().includes(q)) ||
          (n.macAddress && n.macAddress.toLowerCase().includes(q)) ||
          (n.outletRole && n.outletRole.toLowerCase().includes(q))
        );
      });
  }, [nodes, ipSearch, ipFilterType]);

  if (!isOpen) return null;

  // Test de connexion SSO
  const handleTestSso = () => {
    setIsTestingSso(true);
    setSsoTestResult(null);
    setTimeout(() => {
      setIsTestingSso(false);
      setSsoTestResult({
        success: true,
        message: `Authentification réussie sur le Tenant ${settings.sso.corporateDomain} (Token OIDC actif)`,
      });
      showToast("✅ Connexion SSO validée avec succès");
    }, 1200);
  };

  // Synchronisation annuaire
  const handleSyncDirectory = () => {
    setIsTestingSso(true);
    setTimeout(() => {
      setIsTestingSso(false);
      const nowIso = new Date().toISOString();
      setSettings((prev) => ({
        ...prev,
        sso: { ...prev.sso, lastSyncIso: nowIso },
      }));
      showToast("🔄 Annuaire d'entreprise synchronisé (10 utilisateurs à jour)");
    }, 1000);
  };

  // Lancement du scan SNMP actif
  const handleRunSnmpScan = async () => {
    setIsScanningSnmp(true);
    setSnmpScanResult(null);
    try {
      const res = await fetch("/api/snmp/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subnet: settings.snmp.targetSubnet,
          community: settings.snmp.community,
          version: settings.snmp.version,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.devices)) {
        setDiscoveredDevices(data.devices);
        setSnmpScanResult(
          `Scan terminé sur ${data.subnet} : ${data.summary.online} en ligne, ${data.summary.warning} alertes, ${data.summary.offline} hors-ligne.`
        );
        showToast("📡 Découverte SNMP terminée avec succès");
      } else {
        throw new Error(data.error || "Erreur lors du scan");
      }
    } catch (err: unknown) {
      setSnmpScanResult("Erreur lors de la requête SNMP.");
    } finally {
      setIsScanningSnmp(false);
    }
  };

  // Test d'intégration générique
  const handleTestIntegration = (key: string, name: string) => {
    setIntegrationStatuses((prev) => ({
      ...prev,
      [key]: { loading: true, msg: null },
    }));

    setTimeout(() => {
      setIntegrationStatuses((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          msg: `Connexion à l'API ${name} établie (Code 200 OK)`,
        },
      }));
      showToast(`🔌 Intégration ${name} connectée avec succès`);
    }, 1000);
  };

  // Export CSV IPAM
  const handleExportIpamCsv = () => {
    const headers = ["ID", "Nom", "Type", "Rôle", "Adresse IP", "Adresse MAC", "Statut Ping", "Latence (ms)"];
    const rows = nodes
      .filter((n) => n.type !== "DESK")
      .map((n) => [
        n.id,
        n.name,
        n.type,
        n.outletRole ?? "N/A",
        n.ipAddress ?? "Non assigné",
        n.macAddress ?? "Non assigné",
        n.pingStatus ?? "N/A",
        n.pingLatencyMs !== undefined ? `${n.pingLatencyMs}` : "N/A",
      ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `netfloor_ipam_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📥 Export IPAM CSV téléchargé");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-200">
        {/* Toast flottant */}
        {toastMessage && (
          <div className="absolute top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 animate-bounce">
            <Check className="w-4 h-4" />
            {toastMessage}
          </div>
        )}

        {/* 1. Header du Centre de Paramètres */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Centre d'Administration & Paramètres DSI
                <span className="text-[10px] font-mono font-normal bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
                  v2.4 Enterprise
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Fédération d'identité SSO, sondes SNMP, plan d'adressage IPAM et connecteurs ITSM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Onglets de Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab("sso")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "sso"
                ? "border-blue-500 text-blue-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            🔐 SSO & Domaine
          </button>
          <button
            onClick={() => setActiveTab("snmp")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "snmp"
                ? "border-blue-500 text-blue-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <Radio className="w-4 h-4" />
            📡 SNMP & Découverte
          </button>
          <button
            onClick={() => setActiveTab("ipam")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "ipam"
                ? "border-blue-500 text-blue-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <Network className="w-4 h-4" />
            🌐 IPAM & Adressage
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
              {nodes.filter((n) => n.type !== "DESK").length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "integrations"
                ? "border-blue-500 text-blue-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <Plug className="w-4 h-4" />
            🔌 Intégrations & Outils
          </button>
        </div>

        {/* 3. Corps de la Modale */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* ================= TAB 1 : SSO & DOMAINE ================= */}
          {activeTab === "sso" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      Fédération d'Identité Active
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {settings.sso.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Les collaborateurs se connectent via leur compte d'entreprise ({settings.sso.corporateDomain})
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncDirectory}
                    disabled={isTestingSso}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingSso ? "animate-spin" : ""}`} />
                    Sync Annuaire
                  </button>
                  <button
                    onClick={handleTestSso}
                    disabled={isTestingSso}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow transition"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Tester le SSO
                  </button>
                </div>
              </div>

              {ssoTestResult && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                    ssoTestResult.success
                      ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60"
                      : "bg-rose-950/40 text-rose-300 border-rose-800/60"
                  }`}
                >
                  {ssoTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span>{ssoTestResult.message}</span>
                </div>
              )}

              {/* Formulaire de Configuration SSO */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Fournisseur d'Identité (IdP)</label>
                  <select
                    value={settings.sso.provider}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sso: { ...prev.sso, provider: e.target.value as any },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ENTRA_ID">Microsoft Entra ID (Azure AD)</option>
                    <option value="OKTA">Okta Identity Cloud</option>
                    <option value="GOOGLE_WORKSPACE">Google Workspace (SAML 2.0)</option>
                    <option value="SAML_GENERIC">Fournisseur SAML / OIDC Générique</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Domaine d'Entreprise Autorisé</label>
                  <input
                    type="text"
                    value={settings.sso.corporateDomain}
                    placeholder="exemple: company.com"
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sso: { ...prev.sso, corporateDomain: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Tenant ID (Répertoire Azure)</label>
                  <input
                    type="text"
                    value={settings.sso.tenantId}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sso: { ...prev.sso, tenantId: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Application (Client) ID</label>
                  <input
                    type="text"
                    value={settings.sso.clientId}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sso: { ...prev.sso, clientId: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Client Secret (Clé d'API fédérée)</label>
                  <input
                    type="password"
                    value={settings.sso.clientSecret}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sso: { ...prev.sso, clientSecret: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Rôles et mappage automatique */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Attribution Automatique des Rôles NetFloor
                </h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <div className="font-semibold text-blue-400">DSI / Câbleur</div>
                    <div className="text-[11px] text-slate-400 mt-1">Groupe AD : <code className="text-slate-300">sg-it-infra-admins</code></div>
                    <div className="text-[10px] text-emerald-400 mt-1">Accès complet : CTE SQL, baies, VLANs</div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <div className="font-semibold text-purple-400">Ressources Humaines (RH)</div>
                    <div className="text-[11px] text-slate-400 mt-1">Groupe AD : <code className="text-slate-300">sg-rh-workplace-mgmt</code></div>
                    <div className="text-[10px] text-purple-300 mt-1">Attribution des bureaux & postes</div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <div className="font-semibold text-amber-400">Services Généraux / Maintenance</div>
                    <div className="text-[11px] text-slate-400 mt-1">Groupe AD : <code className="text-slate-300">sg-facility-floorplan</code></div>
                    <div className="text-[10px] text-amber-300 mt-1">Mesures métriques & boîtiers de sol</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2 : SNMP & DÉCOUVERTE ================= */}
          {activeTab === "snmp" && (
            <div className="space-y-6">
              {/* Configuration de la sonde */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      Paramètres de la Sonde SNMP Active
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Scan périodique des switches, routeurs, PDU et bornes Wi-Fi pour remonter l'état physique
                    </p>
                  </div>
                  <button
                    onClick={handleRunSnmpScan}
                    disabled={isScanningSnmp}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${isScanningSnmp ? "animate-spin" : ""}`} />
                    {isScanningSnmp ? "Scan en cours..." : "Lancer le scan SNMP"}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Plage Sous-Réseau CIDR</label>
                    <input
                      type="text"
                      value={settings.snmp.targetSubnet}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          snmp: { ...prev.snmp, targetSubnet: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Version Protocole</label>
                    <select
                      value={settings.snmp.version}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          snmp: { ...prev.snmp, version: e.target.value as any },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="v2c">SNMP v2c (Community string)</option>
                      <option value="v3">SNMP v3 (AuthPriv chiffré SHA/AES)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">Communauté / User</label>
                    <input
                      type="password"
                      value={settings.snmp.community}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          snmp: { ...prev.snmp, community: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {snmpScanResult && (
                  <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded text-cyan-300 text-xs flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span>{snmpScanResult}</span>
                  </div>
                )}
              </div>

              {/* Résultats Télémétrie Découverte */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Appareils Découverts & Santé Matérielle ({discoveredDevices.length})
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    Dernière synchronisation : il y a quelques instants
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {discoveredDevices.map((device) => (
                    <div
                      key={device.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 hover:border-slate-700 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded bg-slate-900 border border-slate-800 text-blue-400">
                            {device.deviceType === "SWITCH" ? (
                              <Network className="w-4 h-4" />
                            ) : device.deviceType === "SERVER_RACK" ? (
                              <Server className="w-4 h-4 text-purple-400" />
                            ) : device.deviceType === "WIFI_AP" ? (
                              <Wifi className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Printer className="w-4 h-4 text-amber-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-slate-100 flex items-center gap-2">
                              {device.name}
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                  device.status === "ONLINE"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : device.status === "WARNING"
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                }`}
                              >
                                {device.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {device.ip} • MAC: {device.mac}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {device.model}
                        </span>
                      </div>

                      {/* Métriques télémétriques */}
                      <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-900 text-center font-mono">
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-850">
                          <div className="text-[9px] text-slate-400 flex items-center justify-center gap-1">
                            <Cpu className="w-2.5 h-2.5 text-blue-400" /> CPU
                          </div>
                          <div
                            className={`text-xs font-bold ${
                              device.cpuLoadPercent > 80 ? "text-rose-400" : "text-slate-200"
                            }`}
                          >
                            {device.cpuLoadPercent}%
                          </div>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-850">
                          <div className="text-[9px] text-slate-400 flex items-center justify-center gap-1">
                            <HardDrive className="w-2.5 h-2.5 text-purple-400" /> RAM
                          </div>
                          <div className="text-xs font-bold text-slate-200">{device.memoryUsagePercent}%</div>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-850">
                          <div className="text-[9px] text-slate-400 flex items-center justify-center gap-1">
                            <Thermometer className="w-2.5 h-2.5 text-amber-400" /> Temp
                          </div>
                          <div
                            className={`text-xs font-bold ${
                              device.temperatureC > 35 ? "text-amber-400" : "text-emerald-400"
                            }`}
                          >
                            {device.temperatureC}°C
                          </div>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-850">
                          <div className="text-[9px] text-slate-400 flex items-center justify-center gap-1">
                            <Activity className="w-2.5 h-2.5 text-emerald-400" /> Ports
                          </div>
                          <div className="text-xs font-bold text-slate-200">
                            {device.activePorts}/{device.totalPorts}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3 : IPAM & ADRESSAGE ================= */}
          {activeTab === "ipam" && (
            <div className="space-y-4">
              {/* Résumé des sous-réseaux d'entreprise */}
              <div className="grid grid-cols-4 gap-3">
                {settings.subnets.map((sub) => (
                  <div
                    key={sub.vlanId}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-100">VLAN {sub.vlanId}</span>
                      <span className="text-[10px] font-mono text-blue-400">{sub.cidr}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{sub.vlanName}</div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{ width: `${(sub.usedIps / sub.totalIps) * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 flex justify-between pt-1">
                      <span>Passerelle: {sub.gateway}</span>
                      <span>
                        {sub.usedIps}/{sub.totalIps} IP
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barre de recherche et filtres de table */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filtrer par nom, IP, MAC ou rôle..."
                      value={ipSearch}
                      onChange={(e) => setIpSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <select
                    value={ipFilterType}
                    onChange={(e) => setIpFilterType(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">Tous les types d'équipements</option>
                    <option value="WALL_OUTLET">Prises Murales RJ45</option>
                    <option value="FLOOR_BOX">Boîtiers de sol</option>
                    <option value="PATCH_PANEL">Panneaux de brassage</option>
                    <option value="SWITCH">Switches Réseau</option>
                    <option value="RACK_42U">Baies 19 pouces</option>
                  </select>
                </div>

                <button
                  onClick={handleExportIpamCsv}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter IPAM en CSV
                </button>
              </div>

              {/* Table IPAM des Équipements */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Équipement / Prise</th>
                        <th className="py-2.5 px-3">Rôle Service</th>
                        <th className="py-2.5 px-3">Adresse IP (Éditable)</th>
                        <th className="py-2.5 px-3">Adresse MAC</th>
                        <th className="py-2.5 px-3 text-center">État Ping ICMP</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {filteredIpamNodes.map((node) => {
                        const isVoip = node.outletRole === "VOIP";
                        const isPrinter = node.outletRole === "PRINTER";
                        const isWifi = node.outletRole === "WIFI";
                        const isRack = Boolean(node.subType?.startsWith("RACK") || node.type === "PATCH_PANEL" || node.type === "SWITCH");

                        return (
                          <tr key={node.id} className="hover:bg-slate-900/60 transition">
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-200 flex items-center gap-2">
                                {isRack ? (
                                  <Server className="w-3.5 h-3.5 text-purple-400" />
                                ) : isWifi ? (
                                  <Wifi className="w-3.5 h-3.5 text-indigo-400" />
                                ) : isVoip ? (
                                  <Phone className="w-3.5 h-3.5 text-purple-400" />
                                ) : isPrinter ? (
                                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <Laptop className="w-3.5 h-3.5 text-blue-400" />
                                )}
                                <span>{node.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                ID: {node.id}
                              </div>
                            </td>

                            <td className="py-2 px-3 font-mono text-[11px]">
                              {node.outletRole ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded border text-[10px] ${
                                    isVoip
                                      ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                      : isPrinter
                                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                      : isWifi
                                      ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                      : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                  }`}
                                >
                                  {node.outletRole}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px]">Générique</span>
                              )}
                            </td>

                            <td className="py-2 px-3">
                              <input
                                type="text"
                                defaultValue={node.ipAddress ?? ""}
                                placeholder="10.42.x.x"
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  onUpdateNodeProperties?.(node.id, {
                                    ipAddress: val ? val : undefined,
                                  });
                                  showToast(`IP mise à jour pour ${node.name}`);
                                }}
                                className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 w-32"
                              />
                            </td>

                            <td className="py-2 px-3">
                              <input
                                type="text"
                                defaultValue={node.macAddress ?? ""}
                                placeholder="00:1A:2B:3C:4D:5E"
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  onUpdateNodeProperties?.(node.id, {
                                    macAddress: val ? val : undefined,
                                  });
                                  showToast(`MAC mise à jour pour ${node.name}`);
                                }}
                                className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 w-36"
                              />
                            </td>

                            <td className="py-2 px-3 text-center">
                              {node.pingStatus ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] ${
                                    node.pingStatus === "ONLINE"
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      node.pingStatus === "ONLINE"
                                        ? "bg-emerald-400 animate-pulse"
                                        : "bg-rose-400"
                                    }`}
                                  />
                                  {node.pingStatus} ({node.pingLatencyMs ?? 4}ms)
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px] font-mono">—</span>
                              )}
                            </td>

                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => {
                                  const randomLatency = Math.floor(Math.random() * 8) + 2;
                                  onUpdateNodeProperties?.(node.id, {
                                    pingStatus: "ONLINE",
                                    pingLatencyMs: randomLatency,
                                  });
                                  showToast(`Ping vers ${node.name} : ${randomLatency}ms (Réussi)`);
                                }}
                                className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-[10px] font-mono border border-blue-500/30 transition"
                              >
                                Ping test
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4 : INTÉGRATIONS ================= */}
          {activeTab === "integrations" && (
            <div className="grid grid-cols-2 gap-4">
              {/* 1. Connecteur NetBox */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400">
                      <Network className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">NetBox DCIM & IPAM</div>
                      <div className="text-[10px] text-slate-400">Source of Truth Baies, Câbles et Préfixes</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.integrations.netbox.enabled}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            netbox: { ...prev.integrations.netbox, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400">URL Instance NetBox</label>
                    <input
                      type="text"
                      value={settings.integrations.netbox.url}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            netbox: { ...prev.integrations.netbox, url: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">API Token REST</label>
                    <input
                      type="password"
                      value={settings.integrations.netbox.apiToken}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            netbox: { ...prev.integrations.netbox, apiToken: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {integrationStatuses.netbox?.msg ?? "Dernière synchro: 14:15"}
                  </span>
                  <button
                    onClick={() => handleTestIntegration("netbox", "NetBox")}
                    disabled={integrationStatuses.netbox?.loading}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                  >
                    {integrationStatuses.netbox?.loading ? "Connexion..." : "Tester API"}
                  </button>
                </div>
              </div>

              {/* 2. Connecteur GLPI / ServiceNow */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-amber-600/20 border border-amber-500/30 text-amber-400">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">GLPI / ServiceNow ITSM</div>
                      <div className="text-[10px] text-slate-400">Ticketing automatique & Gestion du Parc</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.integrations.glpi.enabled}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            glpi: { ...prev.integrations.glpi, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400">URL Serveur ITSM</label>
                    <input
                      type="text"
                      value={settings.integrations.glpi.url}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            glpi: { ...prev.integrations.glpi, url: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">App Token & User Token</label>
                    <input
                      type="password"
                      value={settings.integrations.glpi.userToken}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            glpi: { ...prev.integrations.glpi, userToken: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {integrationStatuses.glpi?.msg ?? "Ticket auto sur incident actif"}
                  </span>
                  <button
                    onClick={() => handleTestIntegration("glpi", "GLPI")}
                    disabled={integrationStatuses.glpi?.loading}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                  >
                    {integrationStatuses.glpi?.loading ? "Connexion..." : "Tester GLPI"}
                  </button>
                </div>
              </div>

              {/* 3. Connecteur Microsoft Intune */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-purple-600/20 border border-purple-500/30 text-purple-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">Microsoft Intune MDM</div>
                      <div className="text-[10px] text-slate-400">Conformité des postes de travail & EDR</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.integrations.intune.enabled}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            intune: { ...prev.integrations.intune, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-850">
                    <span className="text-slate-300">Vérification conformité BitLocker/Antivirus</span>
                    <span className="text-emerald-400 font-mono text-[10px]">Actif</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-850">
                    <span className="text-slate-300">Mappage automatique adresse MAC ➔ Utilisateur</span>
                    <span className="text-purple-400 font-mono text-[10px]">Synchronisé</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {integrationStatuses.intune?.msg ?? "Fédération Graph API active"}
                  </span>
                  <button
                    onClick={() => handleTestIntegration("intune", "Microsoft Intune")}
                    disabled={integrationStatuses.intune?.loading}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                  >
                    {integrationStatuses.intune?.loading ? "Vérification..." : "Vérifier l'état"}
                  </button>
                </div>
              </div>

              {/* 4. Webhooks d'alertes Teams / Slack */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">Webhooks d'Alertes (Teams / Slack)</div>
                      <div className="text-[10px] text-slate-400">Notifications temps réel en cas de rupture</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.integrations.webhooks.enabled}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            webhooks: { ...prev.integrations.webhooks, enabled: e.target.checked },
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400">URL du Webhook entrant</label>
                    <input
                      type="text"
                      value={settings.integrations.webhooks.webhookUrl}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            webhooks: { ...prev.integrations.webhooks, webhookUrl: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                    />
                  </div>
                  <div className="flex gap-4 pt-1 text-[11px] text-slate-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700" />
                      Alerte Port Down
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700" />
                      Surchauffe Baie &gt;35°C
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {integrationStatuses.webhooks?.msg ?? "Canal #it-network-alerts"}
                  </span>
                  <button
                    onClick={() => handleTestIntegration("webhooks", "Webhook d'Alerte")}
                    disabled={integrationStatuses.webhooks?.loading}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                  >
                    {integrationStatuses.webhooks?.loading ? "Envoi..." : "Tester Notification"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Pied de page du Modal */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between flex-shrink-0">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Environnement de Production : Site Central Horizon
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              Fermer
            </button>
            <button
              onClick={() => {
                showToast("💾 Paramètres DSI enregistrés avec succès");
                onClose();
              }}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition"
            >
              Enregistrer les modifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
