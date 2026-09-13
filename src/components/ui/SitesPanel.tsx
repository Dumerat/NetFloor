"use client";

import { useState, type FC } from "react";
import {
  Building2,
  Plus,
  MapPin,
  Layers,
  Server,
  Network,
  Edit2,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { FloorSite, StoredBackgroundPlan, DEFAULT_SITE_ID, generateSiteId } from "@/engine/storage/planStorage";
import { RackDisplay, NodeDisplay } from "@/components/canvas/EquipmentLayer";

export interface SitesPanelProps {
  sites: FloorSite[];
  activeSiteId: string;
  onSelectActiveSite: (siteId: string) => void;
  onFocusSite: (siteId: string) => void;
  onSaveSite: (site: FloorSite) => void;
  onDeleteSite: (siteId: string) => void;
  plans: StoredBackgroundPlan[];
  racks: RackDisplay[];
  nodes: NodeDisplay[];
  onOpenPlanManager?: (() => void) | undefined;
}

export const SitesPanel: FC<SitesPanelProps> = ({
  sites,
  activeSiteId,
  onSelectActiveSite,
  onFocusSite,
  onSaveSite,
  onDeleteSite,
  plans,
  racks,
  nodes,
  onOpenPlanManager,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSurface, setFormSurface] = useState<number | undefined>(undefined);

  const startCreate = () => {
    setEditingSiteId(null);
    setFormName(`Site ${sites.length + 1}`);
    setFormCode(`SITE-0${sites.length + 1}`);
    setFormAddress("");
    setFormDescription("");
    setFormSurface(800);
    setIsEditing(true);
  };

  const startEdit = (site: FloorSite) => {
    setEditingSiteId(site.id);
    setFormName(site.name);
    setFormCode(site.code ?? "");
    setFormAddress(site.address ?? "");
    setFormDescription(site.description ?? "");
    setFormSurface(site.surfaceM2);
    setIsEditing(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingSiteId) {
      const existing = sites.find((s) => s.id === editingSiteId);
      if (existing) {
        onSaveSite({
          ...existing,
          name: formName.trim(),
          code: formCode.trim() || undefined,
          address: formAddress.trim() || undefined,
          description: formDescription.trim() || undefined,
          surfaceM2: formSurface,
          updatedAtIso: new Date().toISOString(),
        });
      }
    } else {
      const newSite: FloorSite = {
        id: generateSiteId(),
        name: formName.trim(),
        code: formCode.trim() || undefined,
        address: formAddress.trim() || undefined,
        description: formDescription.trim() || undefined,
        surfaceM2: formSurface,
        color: "#3b82f6",
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      };
      onSaveSite(newSite);
      onSelectActiveSite(newSite.id);
    }

    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans select-none">
      {/* 1. Header du Panneau Sites */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Sites & Campus
            </h2>
            <p className="text-[10px] text-slate-400">
              {sites.length} site{sites.length > 1 ? "s" : ""} configuré{sites.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={startCreate}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-md shadow-blue-600/30 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau Site</span>
          </button>
        )}
      </div>

      {/* 2. Formulaire Inline de Création / Modification */}
      {isEditing && (
        <form
          onSubmit={handleSubmitForm}
          className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-sky-400">
              {editingSiteId ? "Modifier le Site" : "Créer un Nouveau Site"}
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label className="block text-[11px] text-slate-300 font-medium mb-1">
                Nom du site *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="ex: Site Principal - Paris, Site 2 - Lyon"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-300 font-medium mb-1">
                  Code / Trigramme
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="ex: PARIS-HQ"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 font-medium mb-1">
                  Surface (m²)
                </label>
                <input
                  type="number"
                  value={formSurface ?? ""}
                  onChange={(e) => setFormSurface(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="ex: 1200"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-300 font-medium mb-1">
                Adresse postale / Ville
              </label>
              <input
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="ex: 12 Rue de la Paix, 75002 Paris"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-300 font-medium mb-1">
                Description / Rôle
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="ex: Siège social, centre R&D, agence régionale..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-md shadow-blue-600/30"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingSiteId ? "Enregistrer" : "Créer le Site"}</span>
            </button>
          </div>
        </form>
      )}

      {/* 3. Liste des Sites sous forme de Cartes */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sites.map((site) => {
          const isActive = site.id === activeSiteId;

          // Calcul des statistiques associées à ce site
          const sitePlans = plans.filter(
            (p) => (p.siteId ?? DEFAULT_SITE_ID) === site.id
          );
          // Racks et nodes associés à ce site
          const siteRacks = racks.filter(
            (r) => (r.siteId ?? DEFAULT_SITE_ID) === site.id
          );
          const siteNodes = nodes.filter(
            (n) => (n.siteId ?? DEFAULT_SITE_ID) === site.id
          );
          const siteRacksCount = siteRacks.length;
          const siteDesksCount = siteNodes.filter((n) => n.type === "DESK").length;
          const siteOutletsCount = siteNodes.filter(
            (n) => n.type === "WALL_OUTLET" || Boolean(n.portId)
          ).length;

          return (
            <div
              key={site.id}
              onClick={() => {
                onSelectActiveSite(site.id);
                onFocusSite(site.id);
              }}
              className={`p-3 rounded-xl border transition flex flex-col gap-2.5 cursor-pointer select-none group/card ${
                isActive
                  ? "bg-slate-900 border-blue-500/80 shadow-lg shadow-blue-950/40 ring-1 ring-blue-500/40"
                  : "bg-slate-900/50 border-slate-850 hover:border-blue-500/40 hover:bg-slate-900"
              }`}
            >
              {/* En-tête de la carte */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-slate-100 group-hover/card:text-blue-300 transition truncate">
                      {site.name}
                    </span>
                    {site.code && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 font-semibold border border-slate-700">
                        {site.code}
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" />
                        <span>Vue Active</span>
                      </span>
                    )}
                  </div>

                  {site.address && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{site.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(site);
                    }}
                    title="Modifier les informations du site"
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  {site.id !== DEFAULT_SITE_ID && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSite(site.id);
                      }}
                      title="Supprimer ce site"
                      className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Métriques du site */}
              <div className="grid grid-cols-4 gap-1 py-1.5 px-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-center font-mono">
                <div>
                  <div className="text-[9px] text-slate-500 flex items-center justify-center gap-0.5">
                    <Layers className="w-2.5 h-2.5 text-amber-400" />
                    <span>Plans</span>
                  </div>
                  <div className="text-xs font-bold text-amber-300 mt-0.5">
                    {sitePlans.length}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-500 flex items-center justify-center gap-0.5">
                    <Server className="w-2.5 h-2.5 text-purple-400" />
                    <span>Baies</span>
                  </div>
                  <div className="text-xs font-bold text-purple-300 mt-0.5">
                    {siteRacksCount}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-500 flex items-center justify-center gap-0.5">
                    <Building2 className="w-2.5 h-2.5 text-sky-400" />
                    <span>Bureaux</span>
                  </div>
                  <div className="text-xs font-bold text-sky-300 mt-0.5">
                    {siteDesksCount}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-500 flex items-center justify-center gap-0.5">
                    <Network className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Prises</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-300 mt-0.5">
                    {siteOutletsCount}
                  </div>
                </div>
              </div>

              {/* Plans rattachés à ce site */}
              {sitePlans.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Plans d&apos;étages rattachés :
                  </div>
                  <div className="space-y-0.5">
                    {sitePlans.map((p) => (
                      <div
                        key={p.id}
                        className="text-[11px] text-slate-300 flex items-center justify-between px-2 py-1 rounded bg-slate-950/40 border border-slate-800"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {((p.widthMm ?? 60000) / 1000).toFixed(0)}m × {((p.heightMm ?? 35000) / 1000).toFixed(0)}m
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bouton secondaire d'accès rapide aux plans */}
              {onOpenPlanManager && (
                <div className="flex items-center justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectActiveSite(site.id);
                      onOpenPlanManager();
                    }}
                    className="py-1 px-2.5 bg-slate-800 hover:bg-slate-750 text-amber-300 hover:text-amber-200 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition border border-slate-750 cursor-pointer"
                    title="Ouvrir le gestionnaire des plans pour ce site"
                  >
                    <Layers className="w-3 h-3" />
                    <span>Gérer les plans ({sitePlans.length})</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
