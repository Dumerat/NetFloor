"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Image as ImageIcon,
  Plus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Maximize2,
  Layers,
  Ruler,
  Check,
  Building2,
  ArrowRight,
  ArrowDown,
  LayoutGrid,
  RotateCcw,
  MoveHorizontal,
  MoveVertical,
} from "lucide-react";
import {
  StoredBackgroundPlan,
  FloorSite,
  DEFAULT_SITE_ID,
  generatePlanId,
} from "@/engine/storage/planStorage";

export interface PlanManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: StoredBackgroundPlan[];
  activePlanId: string | null;
  onSelectActivePlan: (id: string) => void;
  onUpdatePlan: (id: string, updates: Partial<StoredBackgroundPlan>) => void;
  onAddPlan: (newPlan: Omit<StoredBackgroundPlan, "updatedAtIso">) => void;
  onDeletePlan: (id: string) => void;
  floorWidthMm: number;
  floorHeightMm: number;
  sites?: FloorSite[] | undefined;
  activeSiteId?: string | undefined;
  onOpenScaleCalibration?: (() => void) | undefined;
}

export const PlanManagerModal: React.FC<PlanManagerModalProps> = ({
  isOpen,
  onClose,
  plans,
  activePlanId,
  onSelectActivePlan,
  onUpdatePlan,
  onAddPlan,
  onDeletePlan,
  floorWidthMm,
  floorHeightMm,
  sites = [],
  activeSiteId = DEFAULT_SITE_ID,
  onOpenScaleCalibration,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(activePlanId);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [filterSiteId, setFilterSiteId] = useState<string>("ALL");

  useEffect(() => {
    if (activePlanId) {
      setSelectedPlanId(activePlanId);
    }
  }, [activePlanId]);

  useEffect(() => {
    if (plans.length > 0) {
      setSelectedPlanId((prev) =>
        prev && plans.some((p) => p.id === prev) ? prev : (plans[0]?.id ?? null)
      );
    } else {
      setSelectedPlanId(null);
    }
  }, [plans]);

  const [nameInput, setNameInput] = useState("");

  const currentPlan =
    plans.find((p) => p.id === selectedPlanId) ??
    plans.find((p) => p.id === activePlanId) ??
    plans[0] ??
    null;

  useEffect(() => {
    if (currentPlan) {
      setNameInput(currentPlan.name);
    }
  }, [currentPlan?.id]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      if (!imageData) return;

      const img = new window.Image();
      img.onload = () => {
        // Par défaut, donner la largeur de l'étage pour éviter l'effet miniature
        const defaultWidthMm = floorWidthMm > 0 ? floorWidthMm : 60000;
        const aspectRatio = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 0.6;
        const defaultHeightMm = Math.round(defaultWidthMm * aspectRatio);

        const newPlanName = file.name.replace(/\.[^/.]+$/, "") || `Plan ${plans.length + 1}`;
        const newPlanId = generatePlanId();
        const targetSiteId = activeSiteId || DEFAULT_SITE_ID;

        // Auto-décalage intelligent : si d'autres plans existent déjà sur ce site, positionner à droite
        const sitePlans = plans.filter((p) => (p.siteId ?? DEFAULT_SITE_ID) === targetSiteId);
        let nextX = 0;
        let nextY = 0;
        if (sitePlans.length > 0) {
          const rightmostPlan = sitePlans.reduce((acc, p) => {
            const accRight = acc.xMm + (acc.widthMm ?? defaultWidthMm);
            const pRight = p.xMm + (p.widthMm ?? defaultWidthMm);
            return pRight > accRight ? p : acc;
          }, sitePlans[0]!);
          nextX = rightmostPlan.xMm + (rightmostPlan.widthMm ?? defaultWidthMm) + 3000;
          nextY = rightmostPlan.yMm;
        }

        onAddPlan({
          id: newPlanId,
          name: newPlanName,
          imageData,
          opacity: 0.6,
          isLocked: true,
          xMm: nextX,
          yMm: nextY,
          scale: 1.0,
          widthMm: defaultWidthMm,
          heightMm: defaultHeightMm,
          visible: true,
          siteId: targetSiteId,
          siteOrFloorGroup: "RDC",
        });

        setSelectedPlanId(newPlanId);
        onSelectActivePlan(newPlanId);
      };
      img.src = imageData;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleWidthChangeMeters = (meters: number) => {
    if (!currentPlan) return;
    const safeM = Math.max(0.1, meters);
    const newWidthMm = Math.round(safeM * 1000);

    if (lockAspectRatio && currentPlan.widthMm && currentPlan.heightMm) {
      const ratio = currentPlan.heightMm / currentPlan.widthMm;
      onUpdatePlan(currentPlan.id, {
        widthMm: newWidthMm,
        heightMm: Math.round(newWidthMm * ratio),
      });
    } else {
      onUpdatePlan(currentPlan.id, { widthMm: newWidthMm });
    }
  };

  const handleHeightChangeMeters = (meters: number) => {
    if (!currentPlan) return;
    const safeM = Math.max(0.1, meters);
    const newHeightMm = Math.round(safeM * 1000);

    if (lockAspectRatio && currentPlan.widthMm && currentPlan.heightMm) {
      const ratio = currentPlan.widthMm / currentPlan.heightMm;
      onUpdatePlan(currentPlan.id, {
        heightMm: newHeightMm,
        widthMm: Math.round(newHeightMm * ratio),
      });
    } else {
      onUpdatePlan(currentPlan.id, { heightMm: newHeightMm });
    }
  };

  const handleFitToFloor = () => {
    if (!currentPlan) return;
    onUpdatePlan(currentPlan.id, {
      widthMm: floorWidthMm,
      heightMm: floorHeightMm,
      xMm: 0,
      yMm: 0,
    });
  };

  // Disposer le plan sélectionné immédiatement à droite du plan précédent / voisin (+3m de dégagement)
  const handlePlaceAdjacentRight = () => {
    if (!currentPlan) return;
    const sameSitePlans = plans.filter(
      (p) =>
        p.id !== currentPlan.id &&
        (p.siteId ?? DEFAULT_SITE_ID) === (currentPlan.siteId ?? DEFAULT_SITE_ID)
    );
    if (sameSitePlans.length === 0) return;
    const refPlan = sameSitePlans.reduce((acc, p) => {
      const accRight = acc.xMm + (acc.widthMm ?? floorWidthMm);
      const pRight = p.xMm + (p.widthMm ?? floorWidthMm);
      return pRight > accRight ? p : acc;
    }, sameSitePlans[0]!);

    const newX = refPlan.xMm + (refPlan.widthMm ?? floorWidthMm) + 3000;
    const newY = refPlan.yMm;
    onUpdatePlan(currentPlan.id, { xMm: newX, yMm: newY });
  };

  // Disposer le plan sélectionné immédiatement en dessous du plan précédent / voisin (+3m de dégagement)
  const handlePlaceAdjacentBelow = () => {
    if (!currentPlan) return;
    const sameSitePlans = plans.filter(
      (p) =>
        p.id !== currentPlan.id &&
        (p.siteId ?? DEFAULT_SITE_ID) === (currentPlan.siteId ?? DEFAULT_SITE_ID)
    );
    if (sameSitePlans.length === 0) return;
    const refPlan = sameSitePlans.reduce((acc, p) => {
      const accBottom = acc.yMm + (acc.heightMm ?? floorHeightMm);
      const pBottom = p.yMm + (p.heightMm ?? floorHeightMm);
      return pBottom > accBottom ? p : acc;
    }, sameSitePlans[0]!);

    const newX = refPlan.xMm;
    const newY = refPlan.yMm + (refPlan.heightMm ?? floorHeightMm) + 3000;
    onUpdatePlan(currentPlan.id, { xMm: newX, yMm: newY });
  };

  // Disposer tous les plans du site courant côte à côte en ligne avec 3m d'espacement
  const handleAutoAlignSitePlans = () => {
    const targetSiteId = currentPlan
      ? (currentPlan.siteId ?? DEFAULT_SITE_ID)
      : activeSiteId || DEFAULT_SITE_ID;
    const sitePlans = plans.filter((p) => (p.siteId ?? DEFAULT_SITE_ID) === targetSiteId);
    let curX = 0;
    const curY = 0;
    for (const p of sitePlans) {
      onUpdatePlan(p.id, { xMm: curX, yMm: curY });
      curX += (p.widthMm ?? floorWidthMm) + 3000;
    }
  };

  // Déplacement pas-à-pas (Nudge)
  const handleNudge = (deltaXMeters: number, deltaYMeters: number) => {
    if (!currentPlan) return;
    const newX = Math.round(currentPlan.xMm + deltaXMeters * 1000);
    const newY = Math.round(currentPlan.yMm + deltaYMeters * 1000);
    onUpdatePlan(currentPlan.id, { xMm: newX, yMm: newY });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Gestionnaire de Fonds de Plan & Multi-Étages</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-xs border border-slate-700">
                  {plans.length} plan{plans.length > 1 ? "s" : ""}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Dimensionnez vos plans architecturaux en mètres réels, superposez plusieurs étages
                ou visualisez des sites distants.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps de la modale en 2 colonnes */}
        <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-slate-800">
          {/* Colonne gauche : Liste des plans */}
          <div className="w-72 flex flex-col bg-slate-950/50 p-4 space-y-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Plans Enregistrés
              </span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau</span>
              </button>
            </div>

            {/* Filtre par site */}
            {sites.length > 1 && (
              <div className="pt-1">
                <select
                  value={filterSiteId}
                  onChange={(e) => setFilterSiteId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
                >
                  <option value="ALL">🌐 Tous les sites ({plans.length})</option>
                  {sites.map((s) => {
                    const count = plans.filter(
                      (p) => (p.siteId ?? DEFAULT_SITE_ID) === s.id
                    ).length;
                    return (
                      <option key={s.id} value={s.id}>
                        🏢 {s.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {plans.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs flex flex-col items-center gap-2">
                  <Layers className="w-6 h-6 text-slate-600" />
                  <span>Aucun fond de plan</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sky-400 hover:underline text-[11px]"
                  >
                    + Importer un fichier PNG/JPG
                  </button>
                </div>
              ) : (
                plans
                  .filter(
                    (p) => filterSiteId === "ALL" || (p.siteId ?? DEFAULT_SITE_ID) === filterSiteId
                  )
                  .map((plan) => {
                    const isSelected = currentPlan?.id === plan.id;
                    const widthM = ((plan.widthMm ?? floorWidthMm) / 1000).toFixed(1);
                    const heightM = ((plan.heightMm ?? floorHeightMm) / 1000).toFixed(1);
                    const planSite = sites.find((s) => s.id === (plan.siteId ?? DEFAULT_SITE_ID));

                    return (
                      <div
                        key={plan.id}
                        onClick={() => {
                          setSelectedPlanId(plan.id);
                          onSelectActivePlan(plan.id);
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? "bg-sky-950/40 border-sky-500/60 shadow-lg shadow-sky-950/50 ring-1 ring-sky-500/30"
                            : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="font-semibold text-xs text-slate-200 truncate flex items-center gap-1.5">
                            <span className={isSelected ? "text-sky-300 font-bold" : ""}>
                              {plan.name}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 truncate">
                            <span className="text-sky-400 font-sans truncate">
                              {planSite?.name ?? "Site Principal"}
                            </span>
                            <span>•</span>
                            <span className="shrink-0">
                              {widthM}m × {heightM}m
                            </span>
                          </div>
                          <div className="text-[9px] text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5" />
                            <span>X: {(plan.xMm / 1000).toFixed(1)}m</span>
                            <span>•</span>
                            <span>Y: {(plan.yMm / 1000).toFixed(1)}m</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdatePlan(plan.id, { visible: !plan.visible });
                            }}
                            className={`p-1 rounded hover:bg-slate-800 ${
                              plan.visible ? "text-slate-300" : "text-slate-600"
                            }`}
                            title={plan.visible ? "Masquer ce plan" : "Afficher ce plan"}
                          >
                            {plan.visible ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <div
                            className="p-1 text-emerald-400/80 cursor-default"
                            title="Plan verrouillé sur le canvas (garantie 60 FPS sans lag)"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Colonne droite : Détails, Sizing en mètres et Position */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {currentPlan ? (
              <>
                {/* 1. Métadonnées du plan sélectionné */}
                <div className="space-y-3 pb-4 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Nom du Plan / Étage
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        onDeletePlan(currentPlan.id);
                        const remaining = plans.filter((p) => p.id !== currentPlan.id);
                        setSelectedPlanId(remaining[0]?.id ?? null);
                      }}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Supprimer ce plan</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      onUpdatePlan(currentPlan.id, { name: e.target.value });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-medium"
                    placeholder="ex: Bâtiment A - RDC"
                  />

                  {/* Rattachement à un Site géographique */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Site géographique de rattachement</span>
                    </label>
                    <select
                      value={currentPlan.siteId ?? DEFAULT_SITE_ID}
                      onChange={(e) => onUpdatePlan(currentPlan.id, { siteId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-sky-500"
                    >
                      {sites.length > 0 ? (
                        sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            🏢 {s.name} {s.code ? `(${s.code})` : ""}
                          </option>
                        ))
                      ) : (
                        <option value={DEFAULT_SITE_ID}>🏢 Site Principal</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* 2. Sizing Métrique en Mètres (Résout le problème du plan miniature !) */}
                <div className="space-y-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                        <Ruler className="w-4 h-4 text-sky-400" />
                        <span>Dimensionnement Métrique Réel</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Ajustez la largeur ou la longueur en mètres réels pour adapter
                        instantanément le plan à l&apos;échelle du bâtiment.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleFitToFloor}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
                      title="Adapter le plan exactement aux dimensions du plateau"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>
                        Ajuster à l&apos;Étage ({floorWidthMm / 1000}m × {floorHeightMm / 1000}m)
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Largeur réelle du plan (mètres)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="500"
                          value={((currentPlan.widthMm ?? floorWidthMm) / 1000).toFixed(2)}
                          onChange={(e) => handleWidthChangeMeters(parseFloat(e.target.value) || 1)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-xs text-slate-400 font-mono font-bold">m</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Longueur réelle du plan (mètres)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="500"
                          value={((currentPlan.heightMm ?? floorHeightMm) / 1000).toFixed(2)}
                          onChange={(e) =>
                            handleHeightChangeMeters(parseFloat(e.target.value) || 1)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-xs text-slate-400 font-mono font-bold">m</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockAspectRatio}
                        onChange={(e) => setLockAspectRatio(e.target.checked)}
                        className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
                      />
                      <span>Conserver les proportions de l&apos;image (Aspect Ratio)</span>
                    </label>

                    {onOpenScaleCalibration && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenScaleCalibration();
                        }}
                        className="text-xs text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 transition"
                      >
                        <Ruler className="w-3 h-3" />
                        <span>Étalonner par repère 2-points sur la carte</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Positionnement & Décalage Spatial (Multi-étages côte à côte) */}
                <div className="space-y-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        <span>Positionnement Spatial & Agencement Multi-Plans</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Disposez facilement plusieurs étages côte-à-côte ou superposés sur le même
                        plateau pour relier leurs baies sans conflit de position.
                      </p>
                    </div>
                  </div>

                  {/* Coordonnées métriques absolues */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Décalage horizontal X (mètres)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          value={(currentPlan.xMm / 1000).toFixed(1)}
                          onChange={(e) =>
                            onUpdatePlan(currentPlan.id, {
                              xMm: Math.round((parseFloat(e.target.value) || 0) * 1000),
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-xs text-slate-400 font-mono font-bold">m</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Décalage vertical Y (mètres)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          value={(currentPlan.yMm / 1000).toFixed(1)}
                          onChange={(e) =>
                            onUpdatePlan(currentPlan.id, {
                              yMm: Math.round((parseFloat(e.target.value) || 0) * 1000),
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-xs text-slate-400 font-mono font-bold">m</span>
                      </div>
                    </div>
                  </div>

                  {/* Boutons d'Alignement Rapide */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                      Préréglages d&apos;Alignement Rapide
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={handlePlaceAdjacentRight}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center justify-center gap-1.5 transition hover:border-sky-500"
                        title="Positionner ce plan immédiatement à droite du plan précédent avec 3m d'espacement"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                        <span>À droite (+3m)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePlaceAdjacentBelow}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center justify-center gap-1.5 transition hover:border-sky-500"
                        title="Positionner ce plan immédiatement en dessous du plan précédent avec 3m d'espacement"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                        <span>En dessous (+3m)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAutoAlignSitePlans}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center justify-center gap-1.5 transition hover:border-sky-500"
                        title="Agencer automatiquement tous les plans du site actif en ligne horizontale avec 3m d'espacement"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
                        <span>Aligner en ligne</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdatePlan(currentPlan.id, { xMm: 0, yMm: 0 })}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center justify-center gap-1.5 transition hover:border-sky-500"
                        title="Réinitialiser la position du plan à l'origine (0, 0)"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                        <span>Origine (0, 0)</span>
                      </button>
                    </div>
                  </div>

                  {/* Boutons Pas-à-Pas (Nudge) */}
                  <div className="space-y-2 pt-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                      Déplacement Pas-à-Pas (Ajustement fin)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Axe Horizontal */}
                      <div className="flex items-center justify-between bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-xs text-slate-300 flex items-center gap-1">
                          <MoveHorizontal className="w-3 h-3 text-sky-400" />
                          <span>Axe X :</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleNudge(-5, 0)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono hover:text-white"
                            title="Déplacer de 5m vers la gauche"
                          >
                            -5m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudge(-1, 0)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono hover:text-white"
                            title="Déplacer de 1m vers la gauche"
                          >
                            -1m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudge(1, 0)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono hover:text-white"
                            title="Déplacer de 1m vers la droite"
                          >
                            +1m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudge(5, 0)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono hover:text-white"
                            title="Déplacer de 5m vers la droite"
                          >
                            +5m
                          </button>
                        </div>
                      </div>

                      {/* Axe Vertical */}
                      <div className="flex items-center justify-between bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-xs text-slate-300 flex items-center gap-1">
                          <MoveVertical className="w-3 h-3 text-emerald-400" />
                          <span>Axe Y :</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleNudge(0, -5)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono hover:text-white"
                            title="Déplacer de 5m vers le haut"
                          >
                            -5m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudge(0, -1)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono hover:text-white"
                            title="Déplacer de 1m vers le haut"
                          >
                            -1m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudge(0, 1)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono hover:text-white"
                            title="Déplacer de 1m vers le bas"
                          >
                            +1m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNudge(0, 5)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono hover:text-white"
                            title="Déplacer de 5m vers le bas"
                          >
                            +5m
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Réglages Visuels (Opacité & Verrouillage Canvas) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Affichage & Intégrité Canvas (60 FPS)</span>
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Transparence / Opacité du plan</span>
                      <span className="font-mono font-bold">
                        {Math.round(currentPlan.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={Math.round(currentPlan.opacity * 100)}
                      onChange={(e) =>
                        onUpdatePlan(currentPlan.id, {
                          opacity: parseInt(e.target.value, 10) / 100,
                        })
                      }
                      className="w-full accent-sky-500 bg-slate-800 rounded-lg h-2"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>Verrouillé en permanence sur le canvas (garantie 60 FPS)</span>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentPlan.visible}
                        onChange={(e) =>
                          onUpdatePlan(currentPlan.id, { visible: e.target.checked })
                        }
                        className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
                      />
                      <span>Visible</span>
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm space-y-2">
                <ImageIcon className="w-8 h-8 text-slate-600" />
                <span>Sélectionnez ou importez un plan architectural pour le dimensionner</span>
              </div>
            )}
          </div>
        </div>

        {/* Pied de modale */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {currentPlan
              ? `Plan actif : ${currentPlan.name} • Dimensions : ${((currentPlan.widthMm ?? floorWidthMm) / 1000).toFixed(1)}m × ${((currentPlan.heightMm ?? floorHeightMm) / 1000).toFixed(1)}m`
              : "Aucun plan actif"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-600/30 transition"
          >
            Fermer et Appliquer
          </button>
        </div>
      </div>
    </div>
  );
};
