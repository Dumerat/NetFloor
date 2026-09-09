"use client";

import { useState, type FC } from "react";
import {
  Monitor,
  Users,
  Briefcase,
  Layers,
  Phone,
  Laptop,
  Box,
  Server,
  Wifi,
  Printer,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react";
import { OutletRole } from "@/components/canvas/EquipmentLayer";

export type PaletteCategory = "FURNITURE" | "CONNECTIVITY" | "INFRASTRUCTURE";

export interface PaletteItem {
  id: string;
  category: PaletteCategory;
  name: string;
  subType:
    | "DESK_SOLO"
    | "DESK_COMPACT"
    | "DESK_EXECUTIVE"
    | "BENCH_DOUBLE"
    | "BENCH_QUAD"
    | "MEETING_TABLE"
    | "WALL_OUTLET"
    | "FLOOR_BOX"
    | "WIFI_AP"
    | "PRINTER_STATION"
    | "RACK_42U"
    | "RACK_18U";
  targetType: "DESK" | "WALL_OUTLET" | "PATCH_PANEL" | "SWITCH";
  outletRole?: OutletRole | undefined;
  widthMm: number;
  heightMm: number;
  description: string;
  personaTag: "RH" | "MAINTENANCE" | "DSI";
  iconName: string;
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
    id: "furniture-desk-compact",
    category: "FURNITURE",
    name: "Bureau Solo Compact",
    subType: "DESK_COMPACT",
    targetType: "DESK",
    widthMm: 1200,
    heightMm: 700,
    description: "Idéal pour petits espaces et flex office (1.20 × 0.70 m)",
    personaTag: "RH",
    iconName: "Monitor",
  },
  {
    id: "furniture-desk-exec",
    category: "FURNITURE",
    name: "Bureau Direction / Manager",
    subType: "DESK_EXECUTIVE",
    targetType: "DESK",
    widthMm: 1800,
    heightMm: 900,
    description: "Grand plateau spacieux (1.80 × 0.90 m)",
    personaTag: "RH",
    iconName: "Briefcase",
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
    description: "Table de salle de réunion ovale/rectangulaire (2.40 × 1.20 m)",
    personaTag: "RH",
    iconName: "Users",
  },

  // 2. Connectique & Prises (Maintenance & Câblage)
  {
    id: "conn-wall-data",
    category: "CONNECTIVITY",
    name: "Plastron Mural PC Data",
    subType: "WALL_OUTLET",
    targetType: "WALL_OUTLET",
    outletRole: "DATA",
    widthMm: 250,
    heightMm: 250,
    description: "Prise murale Cat6A sur plinthe/goulotte (VLAN Data)",
    personaTag: "MAINTENANCE",
    iconName: "Laptop",
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
    description: "Prise murale IP Phone Cat6A (VLAN Voice QoS CoS 5)",
    personaTag: "MAINTENANCE",
    iconName: "Phone",
  },
  {
    id: "conn-floorbox-4p",
    category: "CONNECTIVITY",
    name: "Boîte de Sol Encastrée (4x RJ45)",
    subType: "FLOOR_BOX",
    targetType: "WALL_OUTLET",
    outletRole: "DATA",
    widthMm: 300,
    heightMm: 300,
    description: "Trappe inox encastrée en plancher technique (0.30 × 0.30 m)",
    personaTag: "MAINTENANCE",
    iconName: "Box",
  },
  {
    id: "conn-floorbox-2p",
    category: "CONNECTIVITY",
    name: "Nourrice de Sol (2x RJ45 + 230V)",
    subType: "FLOOR_BOX",
    targetType: "WALL_OUTLET",
    outletRole: "VOIP",
    widthMm: 250,
    heightMm: 250,
    description: "Boîtier de sol compact avec brosse passe-câbles",
    personaTag: "MAINTENANCE",
    iconName: "Box",
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
    description: "Point d'accès plafonnier PoE+ (VLAN Wi-Fi Infra)",
    personaTag: "DSI",
    iconName: "Wifi",
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
    description: "Station d'impression d'étage sécurisée Badge/IP",
    personaTag: "DSI",
    iconName: "Printer",
  },
];

interface EquipmentPaletteProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddItem: (item: PaletteItem) => void;
  activeCategory?: PaletteCategory;
}

export const EquipmentPalette: FC<EquipmentPaletteProps> = ({
  isOpen,
  onToggle,
  onAddItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<PaletteCategory>("FURNITURE");

  const filteredItems = PALETTE_CATALOG.filter(
    (item) => item.category === selectedCategory
  );

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
      case "Box":
        return <Box className={className} />;
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
      {/* Barre d'onglets verticale compacte (Toujours visible) */}
      <div className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 justify-between flex-shrink-0">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => {
              if (!isOpen) onToggle();
              setSelectedCategory("FURNITURE");
            }}
            title="Mobilier & Postes (RH)"
            className={`p-2 rounded-lg transition ${
              isOpen && selectedCategory === "FURNITURE"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
            }`}
          >
            <Monitor className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              if (!isOpen) onToggle();
              setSelectedCategory("CONNECTIVITY");
            }}
            title="Prises & Nourrices (Maintenance)"
            className={`p-2 rounded-lg transition ${
              isOpen && selectedCategory === "CONNECTIVITY"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-blue-400 hover:bg-slate-800"
            }`}
          >
            <Box className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              if (!isOpen) onToggle();
              setSelectedCategory("INFRASTRUCTURE");
            }}
            title="Infrastructure & Réseau (DSI)"
            className={`p-2 rounded-lg transition ${
              isOpen && selectedCategory === "INFRASTRUCTURE"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "text-slate-400 hover:text-purple-400 hover:bg-slate-800"
            }`}
          >
            <Server className="w-5 h-5" />
          </button>
        </div>

        {/* Bouton pour ouvrir / fermer le tiroir */}
        <button
          onClick={onToggle}
          title={isOpen ? "Replier la palette" : "Déplier la palette"}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      {/* Contenu déployable de la palette */}
      {isOpen && (
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Header Palette */}
          <div className="border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Catalogue Équipements
              </span>
              <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                Échelle réelle
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Gabarits prêts à poser au millimètre près
            </p>
          </div>

          {/* Catégorie active sélectionnée via la barre latérale */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 mb-3 text-xs font-medium flex-shrink-0">
            {selectedCategory === "FURNITURE" && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Monitor className="w-3.5 h-3.5" />
                Mobilier & Postes RH
              </span>
            )}
            {selectedCategory === "CONNECTIVITY" && (
              <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                <Box className="w-3.5 h-3.5" />
                Prises & Boîtes de sol
              </span>
            )}
            {selectedCategory === "INFRASTRUCTURE" && (
              <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                <Server className="w-3.5 h-3.5" />
                Infrastructure DSI & Baies
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-mono">
              {filteredItems.length} modèles
            </span>
          </div>

          {/* Liste des gabarits */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredItems.map((item) => {
              const dimMeters = `${(item.widthMm / 1000).toFixed(2)} × ${(item.heightMm / 1000).toFixed(2)} m`;
              const tagColor =
                item.personaTag === "RH"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : item.personaTag === "MAINTENANCE"
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "bg-purple-500/20 text-purple-400 border-purple-500/30";

              return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition flex flex-col gap-2 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-blue-400 group-hover:bg-slate-750 transition">
                        {renderIcon(item.iconName)}
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

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    {item.description}
                  </p>

                  <button
                    onClick={() => onAddItem(item)}
                    className="w-full py-1.5 px-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition border border-slate-700 hover:border-blue-500"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter au plan
                  </button>
                </div>
              );
            })}
          </div>

          {/* Guide d'aide bas de palette */}
          <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 flex-shrink-0 leading-relaxed">
            💡 <strong>Astuce :</strong> Chaque équipement ajouté se place aux dimensions métriques réelles avec magnétisme sur la grille. Vous pourrez ajuster ses dimensions au millimètre dans l&apos;inspecteur.
          </div>
        </div>
      )}
    </aside>
  );
};
