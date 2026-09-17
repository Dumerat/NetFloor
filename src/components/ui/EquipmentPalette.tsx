"use client";

import { useState, memo, type FC } from "react";
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
  GripVertical,
  Network,
  Camera,
  Boxes,
  Building2,
} from "lucide-react";
import { OutletRole, NodeSubType, PoeMode } from "@/components/canvas/EquipmentLayer";
import type { VlanStyle } from "@/data/vlanStyles";

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

  // 2. Connectique & Prises (Maintenance & Câblage) - Prise RJ45 & Bloc de prises RJ45
  {
    id: "conn-rj45-single",
    category: "CONNECTIVITY",
    name: "Prise RJ45",
    subType: "WALL_OUTLET",
    targetType: "WALL_OUTLET",
    outletRole: "GENERIC",
    widthMm: 250,
    heightMm: 250,
    description: "Prise RJ45 Cat6A unitaire passive (propriétés dynamiques selon switch)",
    personaTag: "MAINTENANCE",
    iconName: "Plug",
    portCount: 1,
    poeMode: "NONE",
  },
  {
    id: "conn-socket-block",
    category: "CONNECTIVITY",
    name: "Bloc de prises RJ45",
    subType: "SOCKET_BLOCK",
    targetType: "WALL_OUTLET",
    outletRole: "GENERIC",
    widthMm: 340,
    heightMm: 255,
    description: "Regroupement visuel de 4 ports RJ45 (supporte 2 à 8 ports, glisser-déposer)",
    personaTag: "MAINTENANCE",
    iconName: "Layers",
    portCount: 4,
    poeMode: "NONE",
  },

  // 3. Infrastructure & Réseau (DSI)
  {
    id: "infra-rack-42u",
    category: "INFRASTRUCTURE",
    name: 'Baie Informatique 19" (42U)',
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
  {
    id: "infra-camera-ip",
    category: "INFRASTRUCTURE",
    name: "Caméra IP Dôme Sécurité",
    subType: "CAMERA_IP",
    targetType: "WALL_OUTLET",
    outletRole: "CAMERA",
    widthMm: 300,
    heightMm: 300,
    description: "Caméra de surveillance dôme HD PoE (VLAN 50 Sécurité / Wi-Fi)",
    personaTag: "DSI",
    iconName: "Camera",
    portCount: 1,
    poeMode: "POE",
    vlanId: 50,
    customEmote: "🎥",
  },
];

interface EquipmentPaletteProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddItem: (item: PaletteItem) => void;
  onOpenSettings?: (() => void) | undefined;
  onOpenSites?: (() => void) | undefined;
  isSitesOpen?: boolean | undefined;
  sitesContent?: React.ReactNode | undefined;
  onOpenTopology?: (() => void) | undefined;
  isTopologyOpen?: boolean | undefined;
  onOpenInventory?: (() => void) | undefined;
  isInventoryOpen?: boolean | undefined;
  vlanStyles?: Record<number, VlanStyle> | undefined;
  width?: number | undefined;
  onResizeStart?: ((e: React.MouseEvent) => void) | undefined;
  topologyContent?: React.ReactNode | undefined;
  inventoryContent?: React.ReactNode | undefined;
  onOpenBatchSpawner?: (() => void) | undefined;
}

const EquipmentPaletteComponent: FC<EquipmentPaletteProps> = ({
  isOpen,
  onToggle,
  onAddItem,
  onOpenSettings,
  onOpenSites,
  isSitesOpen = false,
  sitesContent,
  onOpenTopology,
  isTopologyOpen = false,
  onOpenInventory,
  isInventoryOpen = false,
  width = 340,
  onResizeStart,
  topologyContent,
  inventoryContent,
  onOpenBatchSpawner,
}) => {
  const isDrawerOpen = isOpen || isTopologyOpen || isInventoryOpen || isSitesOpen;
  // 3 sous-menus d'équipements dans la seconde fenêtre latérale
  const [selectedCategory, setSelectedCategory] = useState<PaletteCategory>("FURNITURE");

  const filteredItems = PALETTE_CATALOG.filter((item) => item.category === selectedCategory);

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
      case "Camera":
        return <Camera className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  // Génération d'une image de drag & drop représentant visuellement l'objet lui-même (et non la carte)
  const setupDragPreview = (e: React.DragEvent, item: PaletteItem) => {
    const isDesk = item.category === "FURNITURE";
    const isRack = item.subType === "RACK_42U" || item.subType === "RACK_18U";

    const ghost = document.createElement("div");
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    ghost.style.left = "-1000px";
    ghost.style.zIndex = "99999";
    ghost.style.pointerEvents = "none";
    ghost.style.display = "flex";
    ghost.style.alignItems = "center";
    ghost.style.justifyContent = "center";
    ghost.style.boxShadow = "0 12px 28px rgba(0,0,0,0.6)";

    let widthPx = 64;
    let heightPx = 64;

    if (isDesk) {
      // Représentation meuble/bureau
      widthPx = item.subType === "BENCH_QUAD" ? 110 : item.subType === "BENCH_DOUBLE" ? 75 : 65;
      heightPx = item.subType === "BENCH_QUAD" ? 55 : item.subType === "BENCH_DOUBLE" ? 75 : 45;
      ghost.style.width = `${widthPx}px`;
      ghost.style.height = `${heightPx}px`;
      ghost.style.backgroundColor = "#1e293b";
      ghost.style.border = "2px solid #38bdf8";
      ghost.style.borderRadius = "8px";
      ghost.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <span style="font-size:16px;">🪑</span>
          <span style="font-size:9px;font-weight:bold;color:#f8fafc;font-family:sans-serif;white-space:nowrap;">${item.name.slice(0, 14)}</span>
        </div>
      `;
    } else if (isRack) {
      // Représentation baie serveur
      widthPx = 60;
      heightPx = 75;
      ghost.style.width = `${widthPx}px`;
      ghost.style.height = `${heightPx}px`;
      ghost.style.backgroundColor = "#0f172a";
      ghost.style.border = "2px solid #a855f7";
      ghost.style.borderRadius = "6px";
      ghost.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <span style="font-size:18px;">🖥️</span>
          <span style="font-size:9px;font-weight:bold;color:#c084fc;font-family:sans-serif;">${item.subType === "RACK_18U" ? "18U" : "42U"}</span>
        </div>
      `;
    } else if (item.subType === "SOCKET_BLOCK") {
      widthPx = 80;
      heightPx = 54;
      ghost.style.width = `${widthPx}px`;
      ghost.style.height = `${heightPx}px`;
      ghost.style.backgroundColor = "#1e293b";
      ghost.style.border = "2px solid #38bdf8";
      ghost.style.borderRadius = "8px";
      ghost.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <span style="font-size:14px;">🔲</span>
          <span style="font-size:9px;font-weight:bold;color:#38bdf8;font-family:sans-serif;">Bloc 4x RJ45</span>
        </div>
      `;
    } else {
      // Représentation prise / port / équipement terminal
      widthPx = 54;
      heightPx = 54;
      ghost.style.width = `${widthPx}px`;
      ghost.style.height = `${heightPx}px`;
      ghost.style.backgroundColor = "#0f172a";
      ghost.style.border = "2px solid #38bdf8";
      ghost.style.borderRadius = "10px";
      const emote =
        item.customEmote ||
        (item.outletRole === "VOIP"
          ? "📞"
          : item.outletRole === "WIFI"
            ? "📶"
            : item.outletRole === "PRINTER"
              ? "🖨️"
              : item.outletRole === "CAMERA"
                ? "📷"
                : "🔌");
      ghost.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <span style="font-size:22px;">${emote}</span>
        </div>
      `;
    }

    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, widthPx / 2, heightPx / 2);
    setTimeout(() => {
      if (document.body.contains(ghost)) {
        document.body.removeChild(ghost);
      }
    }, 0);
  };

  return (
    <aside
      style={{ width: isDrawerOpen ? `${width}px` : "56px" }}
      className="fixed top-14 left-0 bottom-0 z-30 flex bg-slate-950/95 backdrop-blur-md border-r border-slate-800 shadow-2xl text-slate-100 font-sans"
    >
      {/* 1. Barre latérale étroite (BOUTON SITES EN PREMIER + AJOUT + PARAMÈTRES DSI) */}
      <div className="w-14 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 justify-between flex-shrink-0">
        <div className="flex flex-col items-center gap-3">
          {/* 1. PREMIER BOUTON ABSOLU : SITES & CAMPUS */}
          {onOpenSites && (
            <button
              type="button"
              onClick={onOpenSites}
              title="Gestion des Sites & Campus (Multi-sites)"
              className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 cursor-pointer ${
                isSitesOpen
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-600/40"
                  : "text-slate-400 hover:text-amber-400 hover:bg-slate-800"
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Sites</span>
            </button>
          )}

          {/* 2. Menu unique "Ajout" dans la barre latérale */}
          <button
            type="button"
            onClick={() => {
              if (!isOpen) onToggle();
            }}
            title="Catalogue & Ajout d'équipements"
            className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 cursor-pointer ${
              isOpen && !isTopologyOpen && !isInventoryOpen && !isSitesOpen
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
              type="button"
              onClick={onOpenTopology}
              title="Topologie Réseau & Arborescence DSI"
              className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 cursor-pointer ${
                isTopologyOpen
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/40"
                  : "text-slate-400 hover:text-purple-400 hover:bg-slate-800"
              }`}
            >
              <Network className="w-5 h-5" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Topo</span>
            </button>
          )}

          {/* Bouton "Inventaire" pour ouvrir l'inventaire complet */}
          {onOpenInventory && (
            <button
              type="button"
              onClick={onOpenInventory}
              title="Inventaire Global (Utilisateurs, Bureaux, Ports, Équipements, Infra)"
              className={`p-2 rounded-lg transition flex flex-col items-center gap-0.5 cursor-pointer ${
                isInventoryOpen
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/40"
                  : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
              }`}
            >
              <Boxes className="w-5 h-5" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Inven</span>
            </button>
          )}
        </div>

        {/* Paramètres DSI compact (Bas de barre) & Bouton replier */}
        <div className="flex flex-col items-center gap-2">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="Paramètres DSI (Active Directory, SSO, SNMP, IPAM)"
              className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <Sliders className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggle}
            title={isOpen ? "Replier la palette" : "Déplier la palette"}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            {isDrawerOpen ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Seconde fenêtre latérale déployable (Sites, Catalogue, Topologie ou Inventaire) */}
      {isDrawerOpen && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {isSitesOpen && sitesContent ? (
            sitesContent
          ) : isInventoryOpen && inventoryContent ? (
            inventoryContent
          ) : isTopologyOpen && topologyContent ? (
            topologyContent
          ) : (
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
                {/* Dans le sous-menu Mobilier : Bouton Générateur d'Îlots en Masse */}
                {selectedCategory === "FURNITURE" && onOpenBatchSpawner && (
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-lg space-y-2 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                        <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Générateur d&apos;Îlots en Masse</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Générez automatiquement un open-space entier avec mobilier et prises RJ45
                      pré-câblées.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenBatchSpawner}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <Boxes className="w-3 h-3" />
                      <span>Configurer la Matrice</span>
                    </button>
                  </div>
                )}

                {/* Liste des équipements du catalogue */}
                <div className="space-y-2">
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
                          setupDragPreview(e, item);
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
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${tagColor}`}
                          >
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
                💡 <strong>Astuce :</strong> Glissez-déposez directement un équipement sur le plan
                ou cliquez sur Ajouter.
              </div>

              {/* Bouton Paramtres DSI en bas */}
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
                          Paramtres DSI
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
        </div>
      )}

      {/* Poigne de redimensionnement interactif sur la bordure droite */}
      {isDrawerOpen && onResizeStart && (
        <div
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-50 group flex items-center justify-center select-none"
          title="Glisser pour redimensionner le panneau latral"
        >
          <div className="w-0.5 h-8 bg-slate-700 group-hover:bg-blue-400 group-active:bg-white rounded-full transition" />
        </div>
      )}
    </aside>
  );
};

export const EquipmentPalette = memo(EquipmentPaletteComponent);
