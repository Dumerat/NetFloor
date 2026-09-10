"use client";

import { useState, useEffect, memo, type FC } from "react";
import {
  Monitor,
  Users,
  Briefcase,
  Layers,
  Phone,
  Laptop,
  Server,
  Wifi,
  Printer,
  ChevronLeft,
  ChevronRight,
  Plus,
  PlusCircle,
  Sparkles,
  Sliders,
  Plug,
  Trash2,
  Check,
  GripVertical,
  Network,
  } from "lucide-react";
import {
  OutletRole,
  NodeSubType,
  PoeMode,
} from "@/components/canvas/EquipmentLayer";
import { VlanStyle, DEFAULT_VLAN_STYLES } from "@/data/vlanStyles";

export type PaletteCategory = "FURNITURE" | "CONNECTIVITY" | "INFRASTRUCTURE";

export interface PaletteItem {
  id: string;
  category: PaletteCategory;
  name: string;
  subType: NodeSubType;
  targetType: "DESK" | "WALL_OUTLET" | "PATCH_PANEL" | "SWITCH";
  outletRole?: OutletRole | undefined;
  widthMm: number;
  heightMm: number;
  description: string;
  personaTag: "RH" | "MAINTENANCE" | "DSI";
  iconName: string;
  customEmote?: string | undefined;
  isCustomProfile?: boolean | undefined;
  portCount?: number | undefined;
  vlanId?: number | undefined;
  poeMode?: PoeMode | undefined;
  customPortCount?: number | undefined;
  customPoeMode?: PoeMode | undefined;
  customVlanId?: number | undefined;
}

export interface CustomPortProfile {
  id: string;
  name: string;
  portCount: number; // 1 à 8 ports
  poeMode: PoeMode; // "NONE" | "POE" | "POE_PLUS" | "POE_PLUS_PLUS"
  vlanId: number;
  customEmote: string;
  createdAtIso: string;
}

const STORAGE_KEY_PROFILES = "netfloor_custom_port_profiles_v1";

export function loadCustomPortProfiles(): CustomPortProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erreur de lecture des profils de ports dans localStorage", err);
    return [];
  }
}

export function saveCustomPortProfiles(profiles: CustomPortProfile[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
  } catch (err) {
    console.error("Erreur de sauvegarde des profils de ports dans localStorage", err);
  }
}

export const PALETTE_CATALOG: PaletteItem[] = [
  // 1. Mobilier (RH & Espace)
  {
    id: "furniture-desk-solo",
    category: "FURNITURE",
    name: "Bureau Solo Standard",
    subType: "DESK_SOLO",
    targetType: "DESK",
    widthMm: 1600,
    heightMm: 800,
    description: "Échelle standard NF Environnement (1.60 × 0.80 m)",
    personaTag: "RH",
    iconName: "Monitor",
  },
  {
    id: "furniture-bench-double",
    category: "FURNITURE",
    name: "Bench Double Face-à-Face",
    subType: "BENCH_DOUBLE",
    targetType: "DESK",
    widthMm: 1600,
    heightMm: 1600,
    description: "2 postes avec cloisonnette centrale (1.60 × 1.60 m)",
    personaTag: "RH",
    iconName: "Users",
  },
  {
    id: "furniture-bench-quad",
    category: "FURNITURE",
    name: "Îlot Bench 4 Postes",
    subType: "BENCH_QUAD",
    targetType: "DESK",
    widthMm: 3200,
    heightMm: 1600,
    description: "Îlot collaboratif pour 4 personnes (3.20 × 1.60 m)",
    personaTag: "RH",
    iconName: "Users",
  },
  {
    id: "furniture-meeting",
    category: "FURNITURE",
    name: "Table de Réunion (6p)",
    subType: "MEETING_TABLE",
    targetType: "DESK",
    widthMm: 2400,
    heightMm: 1200,
    description: "Table de réunion ovale (2.40 × 1.20 m)",
    personaTag: "RH",
    iconName: "Users",
  },

  // 2. Connectique & Prises (Maintenance & Câblage) - Port Générique + Standards
  {
    id: "conn-generic-port",
    category: "CONNECTIVITY",
    name: "Port Réseau Générique",
    subType: "GENERIC_PORT",
    targetType: "WALL_OUTLET",
    outletRole: "GENERIC",
    widthMm: 250,
    heightMm: 250,
    description: "Port RJ45 universel paramétrable (multi-ports, PoE, VLAN direct, émote)",
    personaTag: "MAINTENANCE",
    iconName: "Plug",
    portCount: 1,
    poeMode: "NONE",
    vlanId: 20,
    customEmote: "🔌",
  },
  {
    id: "conn-wall-data",
    category: "CONNECTIVITY",
    name: "Plastron Mural PC Data",
    subType: "WALL_OUTLET",
    targetType: "WALL_OUTLET",
    outletRole: "DATA",
    widthMm: 250,
    heightMm: 250,
    description: "Prise murale Cat6A sur plinthe/goulotte (VLAN 20 Data)",
    personaTag: "MAINTENANCE",
    iconName: "Laptop",
    portCount: 1,
    poeMode: "NONE",
    vlanId: 20,
    customEmote: "💻",
  },
  {
    id: "conn-wall-voip",
    category: "CONNECTIVITY",
    name: "Plastron Mural Téléphonie VoIP",
    subType: "WALL_OUTLET",
    targetType: "WALL_OUTLET",
    outletRole: "VOIP",
    widthMm: 250,
    heightMm: 250,
    description: "Prise murale IP Phone Cat6A PoE (VLAN 30 Voice QoS)",
    personaTag: "MAINTENANCE",
    iconName: "Phone",
    portCount: 1,
    poeMode: "POE",
    vlanId: 30,
    customEmote: "📞",
  },

  // 3. Infrastructure & Réseau (DSI)
  {
    id: "infra-rack-42u",
    category: "INFRASTRUCTURE",
    name: "Baie Informatique 19\" (42U)",
    subType: "RACK_42U",
    targetType: "PATCH_PANEL",
    widthMm: 800,
    heightMm: 1000,
    description: "Armoire serveur & brassage standard (0.80 × 1.00 m)",
    personaTag: "DSI",
    iconName: "Server",
  },
  {
    id: "infra-wifi-ap",
    category: "INFRASTRUCTURE",
    name: "Borne Wi-Fi 6 (Ceiling AP)",
    subType: "WIFI_AP",
    targetType: "WALL_OUTLET",
    outletRole: "WIFI",
    widthMm: 350,
    heightMm: 350,
    description: "Point d'accès plafonnier PoE+ (VLAN 50 Wi-Fi)",
    personaTag: "DSI",
    iconName: "Wifi",
    portCount: 1,
    poeMode: "POE_PLUS",
    vlanId: 50,
    customEmote: "📶",
  },
  {
    id: "infra-printer-station",
    category: "INFRASTRUCTURE",
    name: "Copieur / Imprimante Réseau",
    subType: "PRINTER_STATION",
    targetType: "WALL_OUTLET",
    outletRole: "PRINTER",
    widthMm: 800,
    heightMm: 700,
    description: "Station d'impression d'étage sécurisée Badge/IP (VLAN 40)",
    personaTag: "DSI",
    iconName: "Printer",
    portCount: 1,
    poeMode: "NONE",
    vlanId: 40,
    customEmote: "🖨️",
  },
];

const EMOTE_OPTIONS = ["🔌", "💻", "📞", "🖨️", "📶", "🖥️", "🎥", "⚡", "🌐", "🔒", "🚪", "⚙️", "📦", "🏷️"];

interface EquipmentPaletteProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddItem: (item: PaletteItem) => void;
  onOpenSettings?: (() => void) | undefined;
  onOpenTopology?: (() => void) | undefined;
  isTopologyOpen?: boolean | undefined;
  vlanStyles?: Record<number, VlanStyle> | undefined;
}

const EquipmentPaletteComponent: FC<EquipmentPaletteProps> = ({
  isOpen,
  onToggle,
  onAddItem,
  onOpenSettings,
  onOpenTopology,
  isTopologyOpen = false,
  vlanStyles = DEFAULT_VLAN_STYLES,
}) => {
  // 3 sous-menus d'équipements dans la seconde fenêtre latérale
  const [selectedCategory, setSelectedCategory] = useState<PaletteCategory>("FURNITURE");

  // Profils personnalisés créés par l'utilisateur
  const [customProfiles, setCustomProfiles] = useState<CustomPortProfile[]>([]);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // État du formulaire de création de profil
  const [newProfileName, setNewProfileName] = useState("Prise Polyvalente");
  const [newProfilePorts, setNewProfilePorts] = useState<number>(2);
  const [newProfilePoe, setNewProfilePoe] = useState<PoeMode>("POE_PLUS");
  const [newProfileVlan, setNewProfileVlan] = useState<number>(20);
  const [newProfileEmote, setNewProfileEmote] = useState<string>("🔌");

  useEffect(() => {
    setCustomProfiles(loadCustomPortProfiles());
  }, []);

  const handleSaveProfile = () => {
    if (!newProfileName.trim()) return;
    const newProfile: CustomPortProfile = {
      id: `profile-${Date.now()}`,
      name: newProfileName.trim(),
      portCount: newProfilePorts,
      poeMode: newProfilePoe,
      vlanId: newProfileVlan,
      customEmote: newProfileEmote,
      createdAtIso: new Date().toISOString(),
    };

    const updated = [newProfile, ...customProfiles];
    setCustomProfiles(updated);
    saveCustomPortProfiles(updated);
    setIsCreatingProfile(false);
    setNewProfileName("Nouveau Port");
  };

  const handleDeleteProfile = (profileId: string) => {
    const updated = customProfiles.filter((p) => p.id !== profileId);
    setCustomProfiles(updated);
    saveCustomPortProfiles(updated);
  };

  const handleAddCustomProfileItem = (profile: CustomPortProfile) => {
    const isMulti = profile.portCount > 1;
    const customItem: PaletteItem = {
      id: `custom-item-${profile.id}-${Date.now()}`,
      category: "CONNECTIVITY",
      name: profile.name,
      subType: isMulti ? "WALL_OUTLET" : "GENERIC_PORT",
      targetType: "WALL_OUTLET",
      outletRole: "GENERIC",
      widthMm: isMulti ? 400 : 250,
      heightMm: isMulti ? 400 : 250,
      description: `${profile.portCount} port(s) RJ45 • ${
        profile.poeMode !== "NONE" ? profile.poeMode.replace("_", "+") : "Non-PoE"
      } • VLAN ${profile.vlanId}`,
      personaTag: "MAINTENANCE",
      iconName: "Plug",
      portCount: profile.portCount,
      poeMode: profile.poeMode,
      vlanId: profile.vlanId,
      customEmote: profile.customEmote,
      isCustomProfile: true,
    };
    onAddItem(customItem);
  };

  const filteredItems = PALETTE_CATALOG.filter(
    (item) => item.category === selectedCategory
  );

  const availableVlans = Object.values(vlanStyles).sort((a, b) => a.vlanId - b.vlanId);

  const renderIcon = (iconName: string, className: string = "w-4 h-4") => {
    switch (iconName) {
      case "Monitor":
        return <Monitor className={className} />;
      case "Briefcase":
        return <Briefcase className={className} />;
      case "Users":
        return <Users className={className} />;
      case "Laptop":
        return <Laptop className={className} />;
      case "Phone":
        return <Phone className={className} />;
      case "Plug":
        return <Plug className={className} />;
      case "Server":
        return <Server className={className} />;
      case "Wifi":
        return <Wifi className={className} />;
      case "Printer":
        return <Printer className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  return (
    <aside
      className={`fixed top-14 left-0 bottom-0 z-30 transition-all duration-300 ease-in-out flex ${
        isOpen ? "w-80" : "w-12"
      } bg-slate-950/95 backdrop-blur-md border-r border-slate-800 shadow-2xl text-slate-100 font-sans`}
    >
      {/* 1. Barre latérale étroite (UN SEUL BOUTON AJOUT + PARAMÈTRES DSI) */}
      <div className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 justify-between flex-shrink-0">
        <div className="flex flex-col items-center gap-3">
          {/* Menu unique "Ajout" dans la barre latérale */}
          <button
            onClick={() => {
              if (!isOpen) onToggle();
            }}
            title="Catalogue & Ajout d'équipements"
            className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 ${
              isOpen && !isTopologyOpen
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/40"
                : "text-slate-400 hover:text-blue-400 hover:bg-slate-800"
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-wider">Ajout</span>
          </button>

          {/* Bouton "Topologie" pour ouvrir le panneau arborescent réseau */}
          {onOpenTopology && (
            <button
              onClick={onOpenTopology}
              title="Topologie Réseau & Arborescence DSI"
              className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 ${
                isTopologyOpen
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/40"
                  : "text-slate-400 hover:text-purple-400 hover:bg-slate-800"
              }`}
            >
              <Network className="w-5 h-5" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Topo</span>
            </button>
          )}
        </div>

        {/* Paramètres DSI compact (Bas de barre) & Bouton replier */}
        <div className="flex flex-col items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Paramètres DSI (Active Directory, SSO, SNMP, IPAM)"
              className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
            >
              <Sliders className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onToggle}
            title={isOpen ? "Replier la palette" : "Déplier la palette"}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 2. Seconde fenêtre latérale déployable (3 sous-menus d'équipements) */}
      {isOpen && (
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          {/* Header Palette */}
          <div className="border-b border-slate-800 pb-2 mb-2 flex-shrink-0 flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Catalogue d'Ajout
            </span>
            <span className="text-[9px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
              Échelle réelle
            </span>
          </div>

          {/* LES 3 SOUS-MENUS D'ÉQUIPEMENTS DANS LA 2NDE FENÊTRE */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg mb-2.5 flex-shrink-0">
            <button
              onClick={() => setSelectedCategory("FURNITURE")}
              className={`py-1.5 px-1 rounded-md text-[10px] font-semibold flex flex-col items-center gap-1 transition ${
                selectedCategory === "FURNITURE"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-emerald-400 hover:bg-slate-850"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="truncate">Mobilier</span>
            </button>
            <button
              onClick={() => setSelectedCategory("CONNECTIVITY")}
              className={`py-1.5 px-1 rounded-md text-[10px] font-semibold flex flex-col items-center gap-1 transition ${
                selectedCategory === "CONNECTIVITY"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-blue-400 hover:bg-slate-850"
              }`}
            >
              <Plug className="w-3.5 h-3.5" />
              <span className="truncate">Prises/Ports</span>
            </button>
            <button
              onClick={() => setSelectedCategory("INFRASTRUCTURE")}
              className={`py-1.5 px-1 rounded-md text-[10px] font-semibold flex flex-col items-center gap-1 transition ${
                selectedCategory === "INFRASTRUCTURE"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-purple-400 hover:bg-slate-850"
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span className="truncate">Infra/Baies</span>
            </button>
          </div>

          {/* Contenu avec défilement fluide */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {/* Dans le sous-menu Prises & Ports : Bouton & Formulaire de Création de Profil Personnalisé */}
            {selectedCategory === "CONNECTIVITY" && (
              <div className="p-2.5 bg-slate-900/90 border border-blue-500/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                    <Plug className="w-3.5 h-3.5 text-blue-400" />
                    <span>Créer un Profil de Port</span>
                  </div>
                  <button
                    onClick={() => setIsCreatingProfile((prev) => !prev)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {isCreatingProfile ? "Fermer" : "Nouveau"}
                  </button>
                </div>

                {isCreatingProfile && (
                  <div className="space-y-2 pt-1.5 border-t border-slate-800 text-[10px] font-mono">
                    {/* Nom du profil */}
                    <div>
                      <label className="text-slate-400 block mb-0.5">Nom du profil :</label>
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="Ex: Borne Wi-Fi PoE+, Double Desk..."
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* Nombre de ports stackés (1 à 8) */}
                    <div>
                      <label className="text-slate-400 block mb-0.5">
                        Nombre de ports ({newProfilePorts}P) :
                      </label>
                      <div className="grid grid-cols-5 gap-1 text-center">
                        {[1, 2, 4, 6, 8].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setNewProfilePorts(cnt)}
                            className={`py-1 rounded border transition ${
                              newProfilePorts === cnt
                                ? "bg-blue-600 text-white border-blue-500 font-bold"
                                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                            }`}
                          >
                            {cnt}P
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mode PoE */}
                    <div>
                      <label className="text-slate-400 block mb-0.5">Alimentation PoE :</label>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { id: "NONE" as PoeMode, label: "Non-PoE" },
                          { id: "POE" as PoeMode, label: "PoE (15W)" },
                          { id: "POE_PLUS" as PoeMode, label: "PoE+ (30W)" },
                          { id: "POE_PLUS_PLUS" as PoeMode, label: "PoE++ (60W)" },
                        ].map((poe) => (
                          <button
                            key={poe.id}
                            type="button"
                            onClick={() => setNewProfilePoe(poe.id)}
                            className={`py-1 px-1 rounded border transition text-center ${
                              newProfilePoe === poe.id
                                ? "bg-amber-600/30 text-amber-300 border-amber-500 font-bold"
                                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                            }`}
                          >
                            {poe.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Attribution du VLAN */}
                    <div>
                      <label className="text-slate-400 block mb-0.5">Attribution du VLAN :</label>
                      <div className="grid grid-cols-3 gap-1">
                        {availableVlans.map((v) => (
                          <button
                            key={v.vlanId}
                            type="button"
                            onClick={() => setNewProfileVlan(v.vlanId)}
                            className={`py-1 px-1 rounded border transition flex items-center justify-center gap-1 ${
                              newProfileVlan === v.vlanId
                                ? "bg-slate-800 text-white border-blue-500 font-bold ring-1 ring-blue-500/40"
                                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                            }`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: v.color }}
                            />
                            <span>V{v.vlanId}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Choix de l'Émote */}
                    <div>
                      <label className="text-slate-400 block mb-0.5">Émote au choix :</label>
                      <div className="flex flex-wrap gap-1">
                        {EMOTE_OPTIONS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setNewProfileEmote(em)}
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs transition ${
                              newProfileEmote === em
                                ? "bg-blue-600 scale-110 shadow"
                                : "bg-slate-950 hover:bg-slate-800"
                            }`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bouton Enregistrer le Profil */}
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-sans font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Enregistrer ce profil
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Liste des profils personnalisés sauvegardés */}
            {selectedCategory === "CONNECTIVITY" && customProfiles.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 px-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Profils personnalisés ({customProfiles.length}) :</span>
                </div>
                {customProfiles.map((p) => {
                  const vStyle = vlanStyles[p.vlanId] ?? DEFAULT_VLAN_STYLES[p.vlanId];
                  const customItem: PaletteItem = {
                    id: `custom-${p.id}`,
                    category: "CONNECTIVITY",
                    name: p.name,
                    subType: "GENERIC_PORT",
                    targetType: "WALL_OUTLET",
                    outletRole: "GENERIC",
                    widthMm: 250,
                    heightMm: 250,
                    description: `Profil personnalisé : ${p.portCount}P, ${p.poeMode}, VLAN ${p.vlanId}`,
                    personaTag: "MAINTENANCE",
                    customEmote: p.customEmote,
                    customPortCount: p.portCount,
                    customPoeMode: p.poeMode,
                    customVlanId: p.vlanId,
                    isCustomProfile: true,
                    portCount: p.portCount,
                    vlanId: p.vlanId,
                    poeMode: p.poeMode,
                    iconName: "Plug",
                  };
                  return (
                    <div
                      key={p.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify(customItem));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      className="p-2.5 bg-slate-900 border border-blue-500/40 hover:border-blue-400 rounded-lg transition space-y-1.5 group shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition flex-shrink-0" />
                          <span className="text-base">{p.customEmote}</span>
                          <div>
                            <div className="text-xs font-semibold text-slate-100 group-hover:text-blue-300">
                              {p.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                              <span>{p.portCount}P RJ45</span>
                              <span>•</span>
                              <span className="text-amber-400 font-bold">
                                {p.poeMode !== "NONE" ? p.poeMode.replace("_", "+") : "Non-PoE"}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: vStyle?.color ?? "#38bdf8" }}
                                />
                                V{p.vlanId}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteProfile(p.id)}
                          title="Supprimer ce profil"
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleAddCustomProfileItem(p)}
                        className="w-full py-1 px-2 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition border border-blue-500/40"
                      >
                        <Plus className="w-3 h-3" />
                        Ajouter au plan
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Liste des équipements standards du catalogue */}
            <div className="space-y-2">
              {selectedCategory === "CONNECTIVITY" && customProfiles.length > 0 && (
                <div className="text-[10px] font-mono text-slate-400 px-1 pt-1">
                  Modèles de base :
                </div>
              )}
              {filteredItems.map((item) => {
                const dimMeters = `${(item.widthMm / 1000).toFixed(2)} × ${(
                  item.heightMm / 1000
                ).toFixed(2)} m`;
                const tagColor =
                  item.personaTag === "RH"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : item.personaTag === "MAINTENANCE"
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    : "bg-purple-500/20 text-purple-400 border-purple-500/30";

                return (
                  <div
                    key={item.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify(item));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="p-2.5 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition flex flex-col gap-1.5 group cursor-grab active:cursor-grabbing hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition flex-shrink-0" />
                        <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-blue-400 transition">
                          {item.customEmote ? (
                            <span className="text-sm">{item.customEmote}</span>
                          ) : (
                            renderIcon(item.iconName)
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                            {item.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {dimMeters} ({item.widthMm} × {item.heightMm} mm)
                          </div>
                        </div>
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${tagColor}`}>
                        {item.personaTag}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-tight">
                      {item.description}
                    </p>

                    <button
                      onClick={() => onAddItem(item)}
                      className="w-full py-1 px-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition border border-slate-700 hover:border-blue-500"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter au plan
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guide d'aide bas de palette */}
          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex-shrink-0 leading-relaxed">
            💡 <strong>Astuce :</strong> Glissez-déposez directement un équipement sur le plan ou cliquez sur Ajouter.
          </div>

          {/* Bouton Paramètres DSI en bas */}
          {onOpenSettings && (
            <div className="pt-2 border-t border-slate-800 flex-shrink-0">
              <button
                onClick={onOpenSettings}
                className="w-full p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between text-left transition group shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                      Paramètres DSI
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">AD, SNMP, IPAM</div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition" />
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export const EquipmentPalette = memo(EquipmentPaletteComponent);
