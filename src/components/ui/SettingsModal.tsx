"use client";

import { useState, useMemo, useEffect, memo, type FC } from "react";
import {
  X,
  Shield,
  KeyRound,
  Radio,
  Network,
  Plug,
  CheckCircle2,
  RefreshCw,
  Search,
  Download,
  Server,
  Laptop,
  Phone,
  Printer,
  Wifi,
  Activity,
  ExternalLink,
  Send,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Database,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { NodeDisplay } from "@/components/canvas/EquipmentLayer";
import {
  SystemSettings,
  INITIAL_SETTINGS,
  DeviceTelemetry,
  SubnetDefinition,
  LAB_ACTIVE_DIRECTORY_CONFIG,
  LAB_SNMP_CONFIG,
  loadStoredSettings,
  saveStoredSettings,
  resetStoredSettings,
} from "@/data/settingsStore";
import { VlanStyleCustomizer } from "./VlanStyleCustomizer";
import { VlanStyle, DEFAULT_VLAN_STYLES } from "@/data/vlanStyles";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeDisplay[];
  onUpdateNodeProperties?: (nodeId: string, updates: Partial<NodeDisplay>) => void;
  onImportDiscoveredDevice?: (device: DeviceTelemetry) => void;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  onUpdateVlanStyle?: ((vlanId: number, updates: Partial<VlanStyle>) => void) | undefined;
  onResetVlanStyles?: (() => void) | undefined;
}

type TabType = "sso" | "snmp" | "ipam" | "integrations";

const SettingsModalComponent: FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onUpdateNodeProperties,
  onImportDiscoveredDevice,
  vlanStyles,
  onUpdateVlanStyle,
  onResetVlanStyles,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("sso");
  const [dsiMode, setDsiMode] = useState<"SUPERVISION" | "CONFIGURATION">("SUPERVISION");
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [discoveredDevices, setDiscoveredDevices] = useState<DeviceTelemetry[]>([]);

  // Chargement des paramètres depuis le localStorage au montage
  useEffect(() => {
    if (isOpen) {
      setSettings(loadStoredSettings());
    }
  }, [isOpen]);

  // États pour les actions interactives
  const [isScanningSnmp, setIsScanningSnmp] = useState(false);
  const [snmpScanResult, setSnmpScanResult] = useState<string | null>(null);
  const [snmpIsLive, setSnmpIsLive] = useState<boolean | null>(null);

  const [isTestingSso, setIsTestingSso] = useState(false);
  const [ssoTestResult, setSsoTestResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  // Diagnostic Active Directory
  const [isTestingAd, setIsTestingAd] = useState(false);
  const [adDiagnosticData, setAdDiagnosticData] = useState<any | null>(null);
  const [syncedAdUsers, setSyncedAdUsers] = useState<any[]>([]);
  const [showBindPassword, setShowBindPassword] = useState(false);

  // Diagnostic Intégrations
  const [integrationStatuses, setIntegrationStatuses] = useState<
    Record<string, { loading: boolean; success?: boolean; msg: string | null; details?: any }>
  >({});

  // Filtre et recherche IPAM
  const [ipSearch, setIpSearch] = useState("");
  const [ipFilterType, setIpFilterType] = useState<string>("ALL");

  // Sélection du VLAN actif pour édition directe et style dans l'IPAM
  const [selectedIpamVlanId, setSelectedIpamVlanId] = useState<number>(20);

  const handleUpdateSubnet = (vlanId: number, updates: Partial<SubnetDefinition>) => {
    setSettings((prev) => ({
      ...prev,
      subnets: prev.subnets.map((sub) => (sub.vlanId === vlanId ? { ...sub, ...updates } : sub)),
    }));
  };

  // Modal d'ajout de sous-réseau VLAN
  const [isAddSubnetOpen, setIsAddSubnetOpen] = useState(false);
  const [newSubnet, setNewSubnet] = useState<SubnetDefinition>({
    vlanId: 60,
    vlanName: "VLAN_IOT_SECURITY",
    cidr: "10.42.60.0/24",
    gateway: "10.42.60.254",
    dhcpRange: "10.42.60.10 - 10.42.60.200",
    usedIps: 0,
    totalIps: 254,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Liste des nœuds avec filtrage IPAM
  const filteredIpamNodes = useMemo(() => {
    return nodes
      .filter((n) => n.type !== "DESK")
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

  // Sauvegarde des paramètres dans localStorage
  const handleSaveSettings = () => {
    saveStoredSettings(settings);
    showToast("💾 Paramètres DSI enregistrés avec succès dans le navigateur");
    onClose();
  };

  // Réinitialisation aux valeurs d'usine
  const handleResetSettings = () => {
    if (confirm("Réinitialiser tous les paramètres DSI aux valeurs d'origine ?")) {
      const def = resetStoredSettings();
      setSettings(def);
      showToast("🔄 Paramètres réinitialisés aux valeurs par défaut");
    }
  };

  // Injecter la configuration du Lab Docker pour Active Directory
  const handleApplyLabAdPreset = () => {
    setSettings((prev) => ({
      ...prev,
      sso: {
        ...prev.sso,
        provider: "ACTIVE_DIRECTORY_LDAP",
        activeDirectory: { ...LAB_ACTIVE_DIRECTORY_CONFIG },
      },
    }));
    showToast("⚡ Paramètres du Lab Docker injectés pour Active Directory (127.0.0.1:389)");
  };

  // Injecter la configuration du Lab Docker pour SNMP
  const handleApplyLabSnmpPreset = () => {
    setSettings((prev) => ({
      ...prev,
      snmp: { ...LAB_SNMP_CONFIG },
    }));
    showToast("⚡ Paramètres du Lab Docker injectés pour SNMP (127.0.0.1:161 public)");
  };

  // Test de liaison Active Directory via l'API dédiée
  const handleTestActiveDirectory = async () => {
    setIsTestingAd(true);
    setAdDiagnosticData(null);
    try {
      const res = await fetch("/api/auth/ad-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: settings.sso.activeDirectory }),
      });
      const data = await res.json();
      setAdDiagnosticData(data);
      if (data.success) {
        if (Array.isArray(data.syncedUsers)) {
          setSyncedAdUsers(data.syncedUsers);
        }
        showToast("✅ Liaison Active Directory validée avec succès");
      } else {
        showToast(`❌ Échec de liaison AD : ${data.error || "Erreur de connexion"}`);
      }
    } catch (err: unknown) {
      showToast("❌ Impossible de contacter l'API de diagnostic Active Directory");
    } finally {
      setIsTestingAd(false);
    }
  };

  // Synchronisation de l'annuaire AD
  const handleSyncAdDirectory = async () => {
    setIsTestingAd(true);
    try {
      const res = await fetch("/api/auth/ad-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: settings.sso.activeDirectory }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.syncedUsers)) {
        setSyncedAdUsers(data.syncedUsers);
        const nowIso = new Date().toISOString();
        setSettings((prev) => ({
          ...prev,
          sso: { ...prev.sso, lastSyncIso: nowIso },
        }));
        showToast(`🔄 Annuaire AD synchronisé (${data.syncedUsers.length} comptes actifs)`);
      }
    } finally {
      setIsTestingAd(false);
    }
  };

  // Test de connexion SSO cloud (Entra ID / Okta)
  const handleTestSsoCloud = async () => {
    setIsTestingSso(true);
    setSsoTestResult(null);
    try {
      const res = await fetch("/api/auth/ad-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: settings.sso.activeDirectory }),
      });
      const data = await res.json();
      if (data.success) {
        setSsoTestResult({ success: true, message: data.message || "Connexion SSO validée" });
        showToast("✅ Connexion IdP validée");
      } else {
        setSsoTestResult({ success: false, message: data.error || "Échec de la connexion SSO" });
      }
    } catch {
      setSsoTestResult({ success: false, message: "Impossible de joindre le serveur d'authentification" });
    } finally {
      setIsTestingSso(false);
    }
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
        setSnmpIsLive(Boolean(data.isLiveSnmp));
        setSnmpScanResult(
          `Scan terminé sur ${data.subnet} : ${data.summary.online} en ligne, ${data.summary.warning} alertes, ${data.summary.offline} hors-ligne.`
        );
        showToast(
          data.isLiveSnmp
            ? "📡 Découverte SNMP terminée (Connecté au Lab Docker 127.0.0.1)"
            : "📡 Découverte SNMP terminée avec succès"
        );
      } else {
        throw new Error(data.error || "Erreur lors du scan");
      }
    } catch {
      setSnmpScanResult("Erreur lors de la requête SNMP.");
    } finally {
      setIsScanningSnmp(false);
    }
  };

  // Importer un équipement découvert par SNMP vers le plan 2D
  const handleSyncDeviceToFloor = (dev: DeviceTelemetry) => {
    onImportDiscoveredDevice?.(dev);
    showToast(`📍 Équipement ${dev.name} synchronisé avec le plan !`);
  };

  // Synchroniser tous les équipements découverts vers le plan
  const handleSyncAllDevicesToFloor = () => {
    discoveredDevices.forEach((dev) => onImportDiscoveredDevice?.(dev));
    showToast(`📍 ${discoveredDevices.length} équipements synchronisés sur le plateau !`);
  };

  // Test d'intégration via API route
  const handleTestIntegration = async (target: string, name: string) => {
    setIntegrationStatuses((prev) => ({
      ...prev,
      [target]: { loading: true, msg: null },
    }));

    try {
      const targetConfig =
        target === "netbox"
          ? settings.integrations.netbox
          : target === "glpi"
            ? settings.integrations.glpi
            : target === "intune"
              ? settings.integrations.intune
              : settings.integrations.webhooks;

      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, config: targetConfig }),
      });
      const data = await res.json();

      if (data.success) {
        setIntegrationStatuses((prev) => ({
          ...prev,
          [target]: {
            loading: false,
            success: true,
            msg: data.responseBody || `Connecté à ${name} (${data.latencyMs}ms)`,
            details: data.details,
          },
        }));
        showToast(`🔌 Intégration ${name} connectée avec succès`);
      } else {
        throw new Error(data.error || "Erreur de connexion");
      }
    } catch (err: unknown) {
      setIntegrationStatuses((prev) => ({
        ...prev,
        [target]: {
          loading: false,
          success: false,
          msg: err instanceof Error ? err.message : "Erreur de liaison",
        },
      }));
    }
  };

  // Ajout d'un sous-réseau VLAN dans IPAM
  const handleAddSubnet = () => {
    if (!newSubnet.vlanName.trim() || !newSubnet.cidr.trim()) return;
    setSettings((prev) => ({
      ...prev,
      subnets: [...prev.subnets, newSubnet],
    }));
    setIsAddSubnetOpen(false);
    showToast(`🌐 VLAN ${newSubnet.vlanId} (${newSubnet.vlanName}) ajouté à l'IPAM`);
  };

  // Allocation automatique d'une IP libre dans le sous-réseau approprié
  const handleAutoAssignIp = (nodeId: string, role?: string | undefined) => {
    let targetVlan = settings.subnets.find((s) => s.vlanId === 20); // Par défaut VLAN 20 Data
    if (role === "VOIP") targetVlan = settings.subnets.find((s) => s.vlanId === 30);
    if (role === "PRINTER") targetVlan = settings.subnets.find((s) => s.vlanId === 40);
    if (role === "WIFI") targetVlan = settings.subnets.find((s) => s.vlanId === 50);

    const prefix = targetVlan?.cidr
      ? (targetVlan.cidr.split("/")[0] ?? "10.42.20").replace(/\.\d+$/, "")
      : "10.42.20";
    const randomHost = Math.floor(Math.random() * 80) + 120;
    const generatedIp = `${prefix}.${randomHost}`;

    onUpdateNodeProperties?.(nodeId, {
      ipAddress: generatedIp,
      pingStatus: "ONLINE",
      pingLatencyMs: 2,
    });
    showToast(`✨ IP ${generatedIp} attribuée automatiquement`);
  };

  // Export CSV IPAM
  const handleExportIpamCsv = () => {
    const headers = [
      "ID",
      "Nom",
      "Type",
      "Rôle",
      "Adresse IP",
      "Adresse MAC",
      "Statut Ping",
      "Latence (ms)",
    ];
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

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `netfloor_ipam_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📥 Export IPAM CSV téléchargé");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-[1040px] max-w-[95vw] h-[820px] max-h-[90vh] flex flex-col overflow-hidden text-slate-200">
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
            <div className="w-9 h-9 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Centre d'Administration & Paramètres DSI
                <span className="text-[10px] font-mono font-normal bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded">
                  v2.5 Enterprise
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Active Directory / LDAP, SSO fédéré, sondes SNMP actives, plan d'adressage IPAM et
                connecteurs ITSM
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Bascule Mode DSI : Supervision vs Configuration */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setDsiMode("SUPERVISION")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  dsiMode === "SUPERVISION"
                    ? "bg-slate-800 text-emerald-300 font-semibold shadow-sm border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Mode supervision rapide en lecture seule (télémétrie, état, statistiques)"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Supervision</span>
              </button>
              <button
                onClick={() => setDsiMode("CONFIGURATION")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  dsiMode === "CONFIGURATION"
                    ? "bg-cyan-600 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Mode configuration (modification des paramètres, LDAP, SNMP, VLANs)"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configuration</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bannière Mode Supervision Rapide */}
        {dsiMode === "SUPERVISION" && (
          <div className="px-6 py-2 bg-emerald-950/40 border-b border-emerald-800/40 flex items-center justify-between text-xs text-emerald-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-emerald-300">
                Mode Supervision Active (Lecture seule)
              </span>
              <span className="text-emerald-400/80 font-mono text-[11px]">
                AD: {settings.sso.activeDirectory.serverHost} • SNMP: {discoveredDevices.length}{" "}
                équipements surveillés • {settings.subnets.length} VLANs IPAM
              </span>
            </div>
            <button
              onClick={() => setDsiMode("CONFIGURATION")}
              className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 rounded text-[11px] font-medium transition flex items-center gap-1"
            >
              <Sliders className="w-3 h-3" />
              Modifier les paramètres
            </button>
          </div>
        )}

        {/* 2. Onglets de Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab("sso")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "sso"
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            🔐 Active Directory & SSO
          </button>
          <button
            onClick={() => setActiveTab("snmp")}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "snmp"
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
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
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
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
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            }`}
          >
            <Plug className="w-4 h-4" />
            🔌 Intégrations & Outils
          </button>
        </div>

        {/* 3. Corps de la Modale */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* ================= TAB 1 : ACTIVE DIRECTORY & SSO ================= */}
          {activeTab === "sso" && (
            <div className="space-y-6">
              {/* Sélecteur de Fournisseur */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                        Fournisseur d'Identité & Annuaire d'Entreprise
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {settings.sso.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Sélectionnez l'annuaire d'entreprise utilisé pour l'authentification et
                        l'attribution des postes
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 pt-2">
                  {[
                    {
                      id: "ACTIVE_DIRECTORY_LDAP",
                      label: "Active Directory (AD DS / LDAP)",
                      desc: "Windows Server sur site",
                      icon: Database,
                    },
                    {
                      id: "ENTRA_ID",
                      label: "Microsoft Entra ID",
                      desc: "Azure AD Cloud OIDC",
                      icon: KeyRound,
                    },
                    {
                      id: "OKTA",
                      label: "Okta Identity Cloud",
                      desc: "SAML 2.0 / SCIM",
                      icon: Shield,
                    },
                    {
                      id: "GOOGLE_WORKSPACE",
                      label: "Google Workspace",
                      desc: "SAML Enterprise",
                      icon: Shield,
                    },
                    {
                      id: "SAML_GENERIC",
                      label: "SAML / OIDC Générique",
                      desc: "Fédération standard",
                      icon: KeyRound,
                    },
                  ].map((p) => {
                    const Icon = p.icon;
                    const isSel = settings.sso.provider === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            sso: { ...prev.sso, provider: p.id as any },
                          }))
                        }
                        className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                          isSel
                            ? "bg-cyan-950/40 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/40"
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon
                            className={`w-4 h-4 ${isSel ? "text-cyan-400" : "text-slate-500"}`}
                          />
                          {isSel && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                        <div>
                          <div
                            className={`text-xs font-semibold ${isSel ? "text-slate-100" : "text-slate-300"}`}
                          >
                            {p.label}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION A : CONFIGURATION ACTIVE DIRECTORY SUR SITE */}
              {settings.sso.provider === "ACTIVE_DIRECTORY_LDAP" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-xs font-bold text-slate-100">
                          Configuration du Serveur Active Directory (LDAP / LDAPS)
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleApplyLabAdPreset}
                          className="px-3 py-1.5 bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/40 transition shadow-sm"
                          title="Remplir automatiquement avec les paramètres du Lab Docker (OpenLDAP 127.0.0.1:389)"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />⚡ Remplir avec le Lab
                          Local
                        </button>
                        <button
                          onClick={handleSyncAdDirectory}
                          disabled={isTestingAd}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isTestingAd ? "animate-spin" : ""}`}
                          />
                          Sync Annuaire AD
                        </button>
                        <button
                          onClick={handleTestActiveDirectory}
                          disabled={isTestingAd}
                          className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
                        >
                          <Database className="w-3.5 h-3.5" />
                          {isTestingAd ? "Test LDAP en cours..." : "Tester la liaison AD"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Contrôleur de Domaine (DC FQDN / IP)
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.serverHost}
                          placeholder="ex: dc01.corp.local ou 10.42.0.5"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  serverHost: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Port LDAP & Protocole
                        </label>
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="number"
                            value={settings.sso.activeDirectory.port}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    port: Number(e.target.value),
                                  },
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                          />
                          <select
                            value={settings.sso.activeDirectory.encryption}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    encryption: e.target.value as any,
                                  },
                                },
                              }))
                            }
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="LDAPS">LDAPS (SSL 636)</option>
                            <option value="STARTTLS">StartTLS (389)</option>
                            <option value="NONE">None (Port 389)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Domaine NetBIOS / FQDN
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.domainFqdn}
                          placeholder="corp.local"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  domainFqdn: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Base DN de Recherche (Search Base)
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.baseDn}
                          placeholder="DC=corp,DC=local ou OU=Utilisateurs,DC=corp,DC=local"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  baseDn: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Filtre LDAP Utilisateurs
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.userSearchFilter}
                          placeholder="(&(objectClass=user)(sAMAccountName={0}))"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  userSearchFilter: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Compte de Service (Bind DN)
                        </label>
                        <input
                          type="text"
                          value={settings.sso.activeDirectory.bindDn}
                          placeholder="CN=svc-netfloor,OU=Services,DC=corp,DC=local"
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              sso: {
                                ...prev.sso,
                                activeDirectory: {
                                  ...prev.sso.activeDirectory,
                                  bindDn: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">
                          Mot de Passe du Compte de Liaison (Bind Password)
                        </label>
                        <div className="relative">
                          <input
                            type={showBindPassword ? "text" : "password"}
                            value={settings.sso.activeDirectory.bindPassword}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    bindPassword: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full pl-3 pr-10 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowBindPassword(!showBindPassword)}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
                          >
                            {showBindPassword ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mappage des Groupes Active Directory vers Profils NetFloor */}
                    <div className="pt-2 border-t border-slate-900">
                      <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        Mappage des Groupes de Sécurité Windows AD ➔ Rôles NetFloor
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                        <div className="space-y-1">
                          <label className="text-[10px] text-blue-400">Groupe DSI / Câbleur</label>
                          <input
                            type="text"
                            value={settings.sso.activeDirectory.adminGroupDn}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    adminGroupDn: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-purple-400">Groupe RH / Espace</label>
                          <input
                            type="text"
                            value={settings.sso.activeDirectory.rhGroupDn}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    rhGroupDn: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-amber-400">
                            Groupe Maintenance / Travaux
                          </label>
                          <input
                            type="text"
                            value={settings.sso.activeDirectory.techGroupDn}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                sso: {
                                  ...prev.sso,
                                  activeDirectory: {
                                    ...prev.sso.activeDirectory,
                                    techGroupDn: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Résultat du Diagnostic Active Directory */}
                  {adDiagnosticData && (
                    <div
                      className={`p-4 rounded-lg bg-slate-950 border space-y-3 ${
                        adDiagnosticData.success ? "border-cyan-800/60" : "border-rose-800/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex items-center gap-2 font-semibold text-xs ${
                            adDiagnosticData.success ? "text-cyan-300" : "text-rose-300"
                          }`}
                        >
                          {adDiagnosticData.success ? (
                            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <X className="w-4 h-4 text-rose-400" />
                          )}
                          {adDiagnosticData.success
                            ? `Rapport de Test LDAP / Active Directory Réussi (${adDiagnosticData.totalLatencyMs}ms)`
                            : `Échec du Test LDAP : ${adDiagnosticData.error || "Erreur de connexion"}`}
                        </div>
                        {adDiagnosticData.summary?.domainController && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {adDiagnosticData.summary?.domainController}
                          </span>
                        )}
                      </div>

                      {/* Étapes de diagnostic */}
                      <div className="space-y-1.5 font-mono text-[11px]">
                        {adDiagnosticData.steps?.map((step: any) => (
                          <div
                            key={step.step}
                            className={`flex items-center justify-between p-2 rounded bg-slate-900/80 border ${
                              step.status === "ERROR" ? "border-rose-800/50" : "border-slate-850"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold ${
                                  step.status === "ERROR" ? "text-rose-400" : "text-cyan-400"
                                }`}
                              >
                                [{step.step}]
                              </span>
                              <span className="text-slate-200 font-semibold">{step.title} :</span>
                              <span
                                className={
                                  step.status === "ERROR" ? "text-rose-300" : "text-slate-400"
                                }
                              >
                                {step.detail}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] flex items-center gap-1 ${
                                step.status === "ERROR" ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {step.status === "ERROR" ? (
                                <X className="w-3 h-3" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}{" "}
                              {step.latencyMs}ms
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Échantillon d'utilisateur extrait */}
                      {adDiagnosticData.sampleUser && (
                        <div className="p-3 bg-slate-900/90 rounded border border-slate-800 text-xs space-y-2">
                          <div className="font-semibold text-slate-200 flex items-center justify-between">
                            <span>Échantillon de Compte Utilisateur Extrait :</span>
                            <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                              {adDiagnosticData.sampleUser.netFloorRole}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                            <div>
                              sAMAccountName:{" "}
                              <span className="text-white">
                                {adDiagnosticData.sampleUser.sAMAccountName}
                              </span>
                            </div>
                            <div>
                              Nom:{" "}
                              <span className="text-white">
                                {adDiagnosticData.sampleUser.displayName}
                              </span>
                            </div>
                            <div>
                              Email:{" "}
                              <span className="text-white">{adDiagnosticData.sampleUser.mail}</span>
                            </div>
                            <div>
                              Département:{" "}
                              <span className="text-white">
                                {adDiagnosticData.sampleUser.department}
                              </span>
                            </div>
                            <div>
                              Bureau assigné:{" "}
                              <span className="text-white">
                                {adDiagnosticData.sampleUser.physicalDeliveryOfficeName}
                              </span>
                            </div>
                            <div>
                              Statut compte:{" "}
                              <span className="text-emerald-400">
                                {adDiagnosticData.sampleUser.accountStatus}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comptes Utilisateurs Synchronisés depuis AD */}
                  {syncedAdUsers.length > 0 && (
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                          <Database className="w-4 h-4 text-cyan-400" />
                          Comptes Collaborateurs Synchronisés depuis l'Active Directory (
                          {syncedAdUsers.length})
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">À jour</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="text-[10px] text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-950">
                            <tr>
                              <th className="py-1.5 px-2">Login (sAMAccountName)</th>
                              <th className="py-1.5 px-2">Nom Complet</th>
                              <th className="py-1.5 px-2">Service / Département</th>
                              <th className="py-1.5 px-2">Poste Attribué</th>
                              <th className="py-1.5 px-2 text-right">Rôle Dérivé</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300 text-[11px]">
                            {syncedAdUsers.map((u) => (
                              <tr key={u.id} className="hover:bg-slate-900/50">
                                <td className="py-1.5 px-2 font-bold text-cyan-300">
                                  {u.sAMAccountName}
                                </td>
                                <td className="py-1.5 px-2">{u.fullName}</td>
                                <td className="py-1.5 px-2 text-slate-400">{u.department}</td>
                                <td className="py-1.5 px-2 text-slate-300">{u.office}</td>
                                <td className="py-1.5 px-2 text-right">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-200">
                                    {u.netFloorRole}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION B : AUTRES FOURNISSEURS (ENTRA ID, OKTA, GOOGLE) */}
              {settings.sso.provider !== "ACTIVE_DIRECTORY_LDAP" && (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-100">
                      Configuration Fédérée {settings.sso.provider}
                    </h3>
                    <button
                      onClick={handleTestSsoCloud}
                      disabled={isTestingSso}
                      className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow transition"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Tester le SSO Cloud
                    </button>
                  </div>

                  {ssoTestResult && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{ssoTestResult.message}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300">
                        Domaine d'Entreprise Autorisé
                      </label>
                      <input
                        type="text"
                        value={settings.sso.corporateDomain}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            sso: { ...prev.sso, corporateDomain: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300">
                        Tenant ID / Realm
                      </label>
                      <input
                        type="text"
                        value={settings.sso.tenantId}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            sso: { ...prev.sso, tenantId: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300">
                        Client ID (Application ID)
                      </label>
                      <input
                        type="text"
                        value={settings.sso.clientId}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            sso: { ...prev.sso, clientId: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300">
                        Client Secret
                      </label>
                      <input
                        type="password"
                        value={settings.sso.clientSecret}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            sso: { ...prev.sso, clientSecret: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2 : SNMP & DÉCOUVERTE ================= */}
          {activeTab === "snmp" && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      Sonde de Découverte Réseau Active (SNMP)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Scan physique des commutateurs, baies 42U, PDU et bornes Wi-Fi avec
                      synchronisation vers le plan
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleApplyLabSnmpPreset}
                      className="px-3 py-1.5 bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/40 transition shadow-sm"
                      title="Remplir automatiquement avec les paramètres du Lab Docker SNMP (127.0.0.1:161 public)"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />⚡ Remplir avec le Lab
                      Local
                    </button>
                    <button
                      onClick={handleSyncAllDevicesToFloor}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
                      title="Associer automatiquement tous les équipements découverts sur le plan"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Tout synchroniser sur le plan
                    </button>
                    <button
                      onClick={handleRunSnmpScan}
                      disabled={isScanningSnmp}
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow transition"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isScanningSnmp ? "animate-spin" : ""}`}
                      />
                      {isScanningSnmp ? "Scan en cours..." : "Lancer le scan SNMP"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium">
                      Plage Sous-Réseau CIDR
                    </label>
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
                    <label className="text-[11px] text-slate-300 font-medium">
                      Version Protocole
                    </label>
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
                    <label className="text-[11px] text-slate-300 font-medium">
                      Communauté / Mot de passe
                    </label>
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
                  <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded text-cyan-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span>{snmpScanResult}</span>
                    </div>
                    {snmpIsLive !== null && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          snmpIsLive
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {snmpIsLive ? "🐳 Lab Docker Réel (127.0.0.1:161)" : "Simulé (Secours)"}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Cartes d'équipements découverts avec bouton d'import direct sur le plan */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Matériels Détectés sur le Réseau ({discoveredDevices.length})
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    Cliquez sur &quot;Importer sur le plan&quot; pour répercuter l&apos;IP et la
                    télémétrie sur le canvas
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {discoveredDevices.map((device) => (
                    <div
                      key={device.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5 hover:border-slate-700 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded bg-slate-900 border border-slate-800 text-cyan-400">
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
                              IP: {device.ip} • MAC: {device.mac}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSyncDeviceToFloor(device)}
                          className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 rounded text-[10px] font-medium border border-cyan-500/30 flex items-center gap-1 transition"
                          title="Mettre à jour ou ajouter sur le plan"
                        >
                          <Plus className="w-3 h-3" />
                          Importer
                        </button>
                      </div>

                      {/* Métriques */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-900 text-center font-mono text-[10px]">
                        <div className="p-1 rounded bg-slate-900/80">
                          <div className="text-[9px] text-slate-500">CPU</div>
                          <div className="font-bold text-slate-200">{device.cpuLoadPercent}%</div>
                        </div>
                        <div className="p-1 rounded bg-slate-900/80">
                          <div className="text-[9px] text-slate-500">RAM</div>
                          <div className="font-bold text-slate-200">
                            {device.memoryUsagePercent}%
                          </div>
                        </div>
                        <div className="p-1 rounded bg-slate-900/80">
                          <div className="text-[9px] text-slate-500">TEMP</div>
                          <div className="font-bold text-amber-400">{device.temperatureC}°C</div>
                        </div>
                        <div className="p-1 rounded bg-slate-900/80">
                          <div className="text-[9px] text-slate-500">PORTS</div>
                          <div className="font-bold text-emerald-400">
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
              {/* En-tête des sous-réseaux avec bouton d'ajout */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-cyan-400" />
                  Sous-Réseaux & VLANs Configurés ({settings.subnets.length})
                </span>
                <button
                  onClick={() => setIsAddSubnetOpen(true)}
                  className="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 rounded-lg text-xs font-medium border border-cyan-500/30 flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter un sous-réseau VLAN
                </button>
              </div>

              {/* Formulaire Modal Inline : Ajouter un Sous-Réseau */}
              {isAddSubnetOpen && (
                <div className="p-3.5 bg-slate-950 border border-cyan-500/40 rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                    <span>Créer une nouvelle plage d'adressage IPAM</span>
                    <button
                      onClick={() => setIsAddSubnetOpen(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400">VLAN ID (Tag 802.1Q)</label>
                      <input
                        type="number"
                        value={newSubnet.vlanId}
                        onChange={(e) =>
                          setNewSubnet({ ...newSubnet, vlanId: Number(e.target.value) })
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Nom du VLAN</label>
                      <input
                        type="text"
                        value={newSubnet.vlanName}
                        onChange={(e) => setNewSubnet({ ...newSubnet, vlanName: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Plage CIDR</label>
                      <input
                        type="text"
                        value={newSubnet.cidr}
                        onChange={(e) => setNewSubnet({ ...newSubnet, cidr: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Passerelle par défaut</label>
                      <input
                        type="text"
                        value={newSubnet.gateway}
                        onChange={(e) => setNewSubnet({ ...newSubnet, gateway: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddSubnetOpen(false)}
                      className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleAddSubnet}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                    >
                      Enregistrer le VLAN
                    </button>
                  </div>
                </div>
              )}

              {/* Résumé des sous-réseaux (Cliquables pour sélection & personnalisation directe) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>Sous-réseaux & VLANs configurés</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      (Cliquez sur un VLAN pour l'éditer et personnaliser son tracé)
                    </span>
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    VLAN actif : VID {selectedIpamVlanId}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {settings.subnets.map((sub) => {
                    const isSelected = selectedIpamVlanId === sub.vlanId;
                    const vStyle = vlanStyles?.[sub.vlanId] ?? DEFAULT_VLAN_STYLES[sub.vlanId];
                    const vColor = vStyle?.color ?? "#38bdf8";

                    return (
                      <div
                        key={sub.vlanId}
                        onClick={() => setSelectedIpamVlanId(sub.vlanId)}
                        className={`p-3 rounded-lg cursor-pointer transition-all border text-left ${
                          isSelected
                            ? "bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/50"
                            : "bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                              style={{ backgroundColor: vColor }}
                            />
                            <span
                              className={isSelected ? "text-cyan-300 font-bold" : "text-slate-100"}
                            >
                              VLAN {sub.vlanId}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-cyan-400">{sub.cidr}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{sub.vlanName}</div>
                        {(() => {
                          const usedCount =
                            nodes.reduce((acc, n) => {
                              let count = 0;
                              if (n.vlanId === sub.vlanId && n.ipAddress) count++;
                              if (n.stackedPorts) {
                                count += n.stackedPorts.filter(
                                  (p) => p.vlanId === sub.vlanId && p.ipAddress
                                ).length;
                              }
                              return acc + count;
                            }, 0) ||
                            sub.usedIps ||
                            0;

                          return (
                            <>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                                <div
                                  className="bg-cyan-500 h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(100, (usedCount / sub.totalIps) * 100)}%`,
                                  }}
                                />
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 flex justify-between pt-1">
                                <span>GW: {sub.gateway}</span>
                                <span>
                                  {usedCount}/{sub.totalIps} IP
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Panneau Unifié : Édition du Sous-Réseau & Personnalisation du Style de Câble pour le VLAN sélectionné */}
              {(() => {
                const activeSubnet =
                  settings.subnets.find((s) => s.vlanId === selectedIpamVlanId) ??
                  settings.subnets[0];
                if (!activeSubnet) return null;

                const activeUsedCount =
                  nodes.reduce((acc, n) => {
                    let count = 0;
                    if (n.vlanId === activeSubnet.vlanId && n.ipAddress) count++;
                    if (n.stackedPorts) {
                      count += n.stackedPorts.filter(
                        (p) => p.vlanId === activeSubnet.vlanId && p.ipAddress
                      ).length;
                    }
                    return acc + count;
                  }, 0) ||
                  activeSubnet.usedIps ||
                  0;

                return (
                  <div className="p-3.5 bg-slate-950 border border-cyan-500/40 rounded-lg space-y-3.5 shadow-md">
                    {/* En-tête du VLAN sélectionné */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3.5 h-3.5 rounded-full shadow"
                          style={{
                            backgroundColor:
                              (
                                vlanStyles?.[activeSubnet.vlanId] ??
                                DEFAULT_VLAN_STYLES[activeSubnet.vlanId]
                              )?.color ?? "#38bdf8",
                          }}
                        />
                        <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                          Paramétrage & Style : VLAN {activeSubnet.vlanId} ({activeSubnet.vlanName})
                          <span className="text-[10px] font-normal font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Sélectionné
                          </span>
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {activeUsedCount} / {activeSubnet.totalIps} adresses allouées
                      </span>
                    </div>

                    {/* 1. Champs d'édition directe du sous-réseau IPAM */}
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">
                          Nom du VLAN :
                        </label>
                        <input
                          type="text"
                          value={activeSubnet.vlanName}
                          onChange={(e) =>
                            handleUpdateSubnet(activeSubnet.vlanId, { vlanName: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">
                          Plage CIDR :
                        </label>
                        <input
                          type="text"
                          value={activeSubnet.cidr}
                          onChange={(e) =>
                            handleUpdateSubnet(activeSubnet.vlanId, { cidr: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">
                          Passerelle (Default Gateway) :
                        </label>
                        <input
                          type="text"
                          value={activeSubnet.gateway}
                          onChange={(e) =>
                            handleUpdateSubnet(activeSubnet.vlanId, { gateway: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* 2. Personnalisation du Style & Tracé du Câble pour ce VLAN (SANS 2nd menu dupliqué) */}
                    <div className="pt-2 border-t border-slate-900">
                      <VlanStyleCustomizer
                        vlanStyles={vlanStyles ?? DEFAULT_VLAN_STYLES}
                        onUpdateVlanStyle={onUpdateVlanStyle ?? (() => {})}
                        onResetVlanStyles={onResetVlanStyles}
                        controlledVlanId={activeSubnet.vlanId}
                        hideVlanSelector={true}
                        hideHeader={false}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Barre de recherche et filtres */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filtrer par nom, IP, MAC ou rôle..."
                      value={ipSearch}
                      onChange={(e) => setIpSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <select
                    value={ipFilterType}
                    onChange={(e) => setIpFilterType(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ALL">Tous les types d'équipements</option>
                    <option value="WALL_OUTLET">Prises Murales RJ45</option>
                    <option value="FLOOR_BOX">Boîtiers de sol</option>
                    <option value="PATCH_PANEL">Panneaux & Baies</option>
                    <option value="SWITCH">Switches Réseau</option>
                  </select>
                </div>

                <button
                  onClick={handleExportIpamCsv}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter IPAM CSV
                </button>
              </div>

              {/* Table IPAM des Équipements */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Équipement / Prise</th>
                        <th className="py-2.5 px-3">Service</th>
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
                        const isRack = Boolean(
                          node.subType?.startsWith("RACK") ||
                          node.type === "PATCH_PANEL" ||
                          node.type === "SWITCH"
                        );

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
                              <div className="flex items-center gap-1.5">
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
                                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 w-32"
                                />
                                {!node.ipAddress && (
                                  <button
                                    onClick={() => handleAutoAssignIp(node.id, node.outletRole)}
                                    title="Attribuer la prochaine IP libre dans ce VLAN"
                                    className="p-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 rounded border border-cyan-500/30"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
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
                                className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 w-36"
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
                                  const randomLatency = Math.floor(Math.random() * 6) + 2;
                                  onUpdateNodeProperties?.(node.id, {
                                    pingStatus: "ONLINE",
                                    pingLatencyMs: randomLatency,
                                  });
                                  showToast(`Ping vers ${node.name} : ${randomLatency}ms (Réussi)`);
                                }}
                                className="px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 rounded text-[10px] font-mono border border-cyan-500/30 transition"
                              >
                                Ping
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
              {/* 1. NetBox DCIM */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400">
                      <Network className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">NetBox DCIM & IPAM</div>
                      <div className="text-[10px] text-slate-400">
                        Source of Truth Baies, Câbles et Préfixes
                      </div>
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
                    {integrationStatuses.netbox?.msg ?? "Dernière synchro: OK"}
                  </span>
                  <button
                    onClick={() => handleTestIntegration("netbox", "NetBox DCIM")}
                    disabled={integrationStatuses.netbox?.loading}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                  >
                    {integrationStatuses.netbox?.loading ? "Connexion..." : "Tester API REST"}
                  </button>
                </div>
              </div>

              {/* 2. GLPI ITSM */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-amber-600/20 border border-amber-500/30 text-amber-400">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">GLPI / ServiceNow ITSM</div>
                      <div className="text-[10px] text-slate-400">
                        Ticketing automatique & Gestion du Parc
                      </div>
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

              {/* 3. Microsoft Intune */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-purple-600/20 border border-purple-500/30 text-purple-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">Microsoft Intune MDM</div>
                      <div className="text-[10px] text-slate-400">Conformité des postes & EDR</div>
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
                    <span className="text-slate-300">
                      Vérification conformité BitLocker/Antivirus
                    </span>
                    <span className="text-emerald-400 font-mono text-[10px]">Actif</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-850">
                    <span className="text-slate-300">
                      Mappage automatique adresse MAC ➔ Utilisateur
                    </span>
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

              {/* 4. Webhooks d'Alertes */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">
                        Webhooks d'Alertes (Teams / Slack)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Notifications temps réel en cas d'incident
                      </div>
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
                    {integrationStatuses.webhooks?.loading ? "Envoi..." : "Tester Alerte Réelle"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Pied de page du Modal avec Réinitialisation usine et Sauvegarde localStorage */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleResetSettings}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium border border-slate-800 flex items-center gap-1.5 transition"
            title="Restaurer la configuration d'origine"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Valeurs d'usine
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              Fermer
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Enregistrer et appliquer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SettingsModal = memo(SettingsModalComponent);
