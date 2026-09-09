"use client";

import { useState, useMemo, type FC } from "react";
import { CircuitTraceResult } from "@/db/queries/trace-link";
import {
  NodeDisplay,
  OutletRole,
  DeskSeatOccupant,
  getDeskSeatCount,
  getDefaultSeatLabels,
} from "@/components/canvas/EquipmentLayer";
import { ENTERPRISE_DIRECTORY } from "@/data/directory";
import {
  Zap,
  ShieldCheck,
  Activity,
  Link2,
  Unlink,
  MapPin,
  Target,
  Monitor,
  Phone,
  Laptop,
  Printer,
  Plus,
  ArrowRight,
  Ruler,
  RotateCw,
  Armchair,
  Box,
  Wifi,
  Search,
  Check,
  UserMinus,
  FileText,
  Mail,
  Building,
  UserCheck,
  Users,
  Server,
} from "lucide-react";

export interface CircuitInspectorProps {
  traceResult: CircuitTraceResult | null;
  isLoading: boolean;
  selectedNode: NodeDisplay | null;
  allNodes: NodeDisplay[];
  desks: NodeDisplay[];
  onToggleAttachment: (outletId: string, deskId?: string | undefined) => void;
  onAlignWithDesk?: ((outletId: string, deskId: string) => void) | undefined;
  onTriggerTrace?: ((outletNode: NodeDisplay) => void) | undefined;
  onSelectNode?: ((node: NodeDisplay) => void) | undefined;
  onChangeRole?: ((outletId: string, role: OutletRole) => void) | undefined;
  onAddOutletToDesk?: ((deskId: string, role: OutletRole) => void) | undefined;
  onUpdateNodeProperties?: ((nodeId: string, updates: Partial<NodeDisplay>) => void) | undefined;
}

export const CircuitInspector: FC<CircuitInspectorProps> = ({
  traceResult,
  isLoading,
  selectedNode,
  allNodes,
  desks,
  onToggleAttachment,
  onAlignWithDesk,
  onTriggerTrace,
  onSelectNode,
  onChangeRole,
  onAddOutletToDesk,
  onUpdateNodeProperties,
}) => {
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);
  const [pickingSeatIndex, setPickingSeatIndex] = useState<number | null>(null);

  // Détection du nombre de places du bureau (1, 2 ou 4)
  const deskSeatCount = useMemo(() => {
    if (!selectedNode || selectedNode.type !== "DESK") return 1;
    return getDeskSeatCount(selectedNode.subType);
  }, [selectedNode]);

  // Liste normalisée des places du bureau
  const currentSeats: DeskSeatOccupant[] = useMemo(() => {
    if (!selectedNode || selectedNode.type !== "DESK") return [];
    const count = getDeskSeatCount(selectedNode.subType);
    const labels = getDefaultSeatLabels(selectedNode.subType);
    const list: DeskSeatOccupant[] = [];
    for (let i = 0; i < count; i++) {
      const existing = selectedNode.seats?.find((s) => s.seatIndex === i);
      if (existing) {
        list.push({ ...existing, seatLabel: existing.seatLabel ?? labels[i] });
      } else if (i === 0 && selectedNode.assignedPerson && count === 1) {
        list.push({
          seatIndex: 0,
          seatLabel: labels[0],
          fullName: selectedNode.assignedPerson,
          userId: selectedNode.assignedUserId,
          department: selectedNode.department,
        });
      } else {
        list.push({
          seatIndex: i,
          seatLabel: labels[i] ?? `Place ${i + 1}`,
        });
      }
    }
    return list;
  }, [selectedNode]);

  const occupiedSeatsCount = useMemo(
    () => currentSeats.filter((s) => s.fullName).length,
    [currentSeats]
  );

  // Assignation d'un collaborateur à une place spécifique
  const handleAssignUserToSeat = (seatIdx: number, user: (typeof ENTERPRISE_DIRECTORY)[0]) => {
    if (!selectedNode) return;
    const labels = getDefaultSeatLabels(selectedNode.subType);
    const updatedSeats: DeskSeatOccupant[] = [...currentSeats];
    updatedSeats[seatIdx] = {
      seatIndex: seatIdx,
      seatLabel: labels[seatIdx] ?? `Place ${seatIdx + 1}`,
      userId: user.id,
      fullName: user.fullName,
      department: user.department,
    };
    const summary = updatedSeats
      .filter((s) => s.fullName)
      .map((s) => s.fullName)
      .join(", ");
    onUpdateNodeProperties?.(selectedNode.id, {
      seats: updatedSeats,
      assignedPerson: summary || undefined,
      assignedUserId: updatedSeats[0]?.userId,
      department: updatedSeats[0]?.department,
    });
    // Propager le nom du collaborateur sur les prises affectées à cette place
    const seatOutlets = allNodes.filter(
      (n) => n.type === "WALL_OUTLET" && n.attachedToDeskId === selectedNode.id && n.attachedSeatIndex === seatIdx
    );
    seatOutlets.forEach((o) => {
      onUpdateNodeProperties?.(o.id, { assignedPerson: user.fullName });
    });
    setPickingSeatIndex(null);
  };

  // Libération d'une place spécifique
  const handleUnassignSeat = (seatIdx: number) => {
    if (!selectedNode) return;
    const labels = getDefaultSeatLabels(selectedNode.subType);
    const updatedSeats: DeskSeatOccupant[] = [...currentSeats];
    updatedSeats[seatIdx] = {
      seatIndex: seatIdx,
      seatLabel: labels[seatIdx] ?? `Place ${seatIdx + 1}`,
      userId: undefined,
      fullName: undefined,
      department: undefined,
    };
    const summary = updatedSeats
      .filter((s) => s.fullName)
      .map((s) => s.fullName)
      .join(", ");
    onUpdateNodeProperties?.(selectedNode.id, {
      seats: updatedSeats,
      assignedPerson: summary || undefined,
      assignedUserId: updatedSeats.find((s) => s.userId)?.userId,
      department: updatedSeats.find((s) => s.department)?.department,
    });
    // Libérer l'assignation sur les prises de cette place
    const seatOutlets = allNodes.filter(
      (n) => n.type === "WALL_OUTLET" && n.attachedToDeskId === selectedNode.id && n.attachedSeatIndex === seatIdx
    );
    seatOutlets.forEach((o) => {
      onUpdateNodeProperties?.(o.id, { assignedPerson: undefined });
    });
  };

  // Recherche de l'utilisateur actuellement assigné
  const currentAssignedUser = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.assignedUserId) {
      return ENTERPRISE_DIRECTORY.find((u) => u.id === selectedNode.assignedUserId) ?? null;
    }
    if (selectedNode.assignedPerson) {
      const match = selectedNode.assignedPerson.replace(/\s*\(.*\)/, "").trim().toLowerCase();
      return ENTERPRISE_DIRECTORY.find((u) => u.fullName.toLowerCase().includes(match)) ?? null;
    }
    return null;
  }, [selectedNode]);

  // Filtrage de l'annuaire selon la recherche
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return ENTERPRISE_DIRECTORY;
    const q = userSearchQuery.toLowerCase();
    return ENTERPRISE_DIRECTORY.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.jobTitle.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [userSearchQuery]);

  // Aucun équipement sélectionné
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
          <Zap className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-xs font-semibold text-slate-300">Aucun élément sélectionné</p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
          Cliquez sur un bureau (RH & Espace), une prise murale, une boîte de sol ou une baie pour configurer ses propriétés réelles.
        </p>
      </div>
    );
  }

  // Cas 1 : Prise Murale / Boîte de Sol / Wi-Fi
  if (selectedNode.type === "WALL_OUTLET") {
    const linkedDesk = selectedNode.attachedToDeskId
      ? desks.find((d) => d.id === selectedNode.attachedToDeskId)
      : undefined;
    const isLinked = Boolean(linkedDesk);

    const isVoip = selectedNode.outletRole === "VOIP";
    const isPrinter = selectedNode.outletRole === "PRINTER";
    const isWifi = selectedNode.outletRole === "WIFI";
    const isFloorBox = selectedNode.subType === "FLOOR_BOX";

    const deltaX = linkedDesk ? Math.round(selectedNode.xMm - linkedDesk.xMm) : 0;
    const deltaY = linkedDesk ? Math.round(selectedNode.yMm - linkedDesk.yMm) : 0;
    const directDistanceM = linkedDesk
      ? (Math.hypot(deltaX, deltaY) / 1000).toFixed(2)
      : null;

    const siblingOutlets = linkedDesk
      ? allNodes.filter(
          (n) => n.type === "WALL_OUTLET" && n.attachedToDeskId === linkedDesk.id && n.id !== selectedNode.id
        )
      : [];

    return (
      <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
        {/* 1. En-tête de la prise / boîte de sol */}
        <div className="border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
              {isFloorBox ? (
                <Box className="w-4 h-4 text-sky-400 flex-shrink-0" />
              ) : isWifi ? (
                <Wifi className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              ) : isVoip ? (
                <Phone className="w-4 h-4 text-purple-400 flex-shrink-0" />
              ) : isPrinter ? (
                <Printer className="w-4 h-4 text-amber-400 flex-shrink-0" />
              ) : (
                <Laptop className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
              {selectedNode.name}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isFloorBox
                    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                    : isVoip
                    ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                    : isPrinter
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                }`}
              >
                {isFloorBox ? "BOÎTE DE SOL" : isVoip ? "VOIP / PHONE" : isPrinter ? "IMPRIMANTE" : "DATA / PC"}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isLinked
                    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {isLinked ? "SOLIDAIRE" : "FIXE"}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>{isFloorBox ? "Trappe encastrée inox 4x RJ45" : "Plastron RJ45 Cat6A"}</span>
            <span className="text-slate-500">
              {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
            </span>
          </div>

          {/* Rôle de service RJ45 */}
          {onChangeRole && (
            <div className="mt-2 pt-2 border-t border-slate-800/80">
              <div className="text-[10px] text-slate-400 mb-1 font-medium">Affectation du service :</div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => onChangeRole(selectedNode.id, "DATA")}
                  className={`py-1 px-1 rounded text-[10px] font-mono flex items-center justify-center gap-1 border transition ${
                    !selectedNode.outletRole || selectedNode.outletRole === "DATA"
                      ? "bg-blue-600 text-white border-blue-500 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Laptop className="w-3 h-3" />
                  PC Data
                </button>
                <button
                  onClick={() => onChangeRole(selectedNode.id, "VOIP")}
                  className={`py-1 px-1 rounded text-[10px] font-mono flex items-center justify-center gap-1 border transition ${
                    selectedNode.outletRole === "VOIP"
                      ? "bg-purple-600 text-white border-purple-500 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Phone className="w-3 h-3" />
                  IP Phone
                </button>
                <button
                  onClick={() => onChangeRole(selectedNode.id, "PRINTER")}
                  className={`py-1 px-1 rounded text-[10px] font-mono flex items-center justify-center gap-1 border transition ${
                    selectedNode.outletRole === "PRINTER"
                      ? "bg-amber-600 text-white border-amber-500 font-bold"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Printer className="w-3 h-3" />
                  Copieur
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Carte : Liaison Mobilier & Postes */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 mb-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              Liaison au Mobilier
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Solidarité</span>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
            <button
              onClick={() => onToggleAttachment(selectedNode.id, desks[0]?.id)}
              className={`py-1 px-2 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                isLinked
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Link2 className="w-3 h-3" />
              Solidaire
            </button>
            <button
              onClick={() => onToggleAttachment(selectedNode.id, undefined)}
              className={`py-1 px-2 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                !isLinked
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <MapPin className="w-3 h-3" />
              Prise Fixe
            </button>
          </div>

          {isLinked && linkedDesk ? (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] text-slate-300 bg-blue-950/40 border border-blue-900/50 p-2 rounded space-y-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Bureau :</span>
                  <span className="font-semibold text-slate-100">{linkedDesk.name}</span>
                </div>
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Écart relatif :</span>
                  <span className="text-sky-300 font-semibold">
                    ΔX: {deltaX > 0 ? `+${deltaX}` : deltaX}mm, ΔY: {deltaY > 0 ? `+${deltaY}` : deltaY}mm
                  </span>
                </div>
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Distance :</span>
                  <span className="text-slate-200">{directDistanceM} m</span>
                </div>
              </div>

              {/* Affectation de la prise à une place spécifique du bureau */}
              {getDeskSeatCount(linkedDesk.subType) > 1 && (
                <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-300 font-medium flex items-center gap-1">
                      <Users className="w-3 h-3 text-blue-400" />
                      Attribution à la place :
                    </span>
                    {selectedNode.attachedSeatIndex !== undefined ? (
                      <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                        Place {selectedNode.attachedSeatIndex + 1}
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-500">Commune</span>
                    )}
                  </div>
                  <select
                    value={selectedNode.attachedSeatIndex !== undefined ? selectedNode.attachedSeatIndex : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        onUpdateNodeProperties?.(selectedNode.id, {
                          attachedSeatIndex: undefined,
                          assignedPerson: undefined,
                        });
                      } else {
                        const seatIdx = Number(val);
                        const occupant = linkedDesk.seats?.find((s) => s.seatIndex === seatIdx);
                        onUpdateNodeProperties?.(selectedNode.id, {
                          attachedSeatIndex: seatIdx,
                          assignedPerson: occupant?.fullName || undefined,
                        });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                  >
                    <option value="">🌐 Prise commune (non attribuée)</option>
                    {Array.from({ length: getDeskSeatCount(linkedDesk.subType) }).map((_, i) => {
                      const seatOccupant = linkedDesk.seats?.find((s) => s.seatIndex === i);
                      const labels = getDefaultSeatLabels(linkedDesk.subType);
                      const label = seatOccupant?.seatLabel ?? labels[i] ?? `Place ${i + 1}`;
                      const occupantDesc = seatOccupant?.fullName ? ` (${seatOccupant.fullName})` : " (Libre)";
                      return (
                        <option key={`opt-seat-${i}`} value={i}>
                          Place {i + 1} : {label}{occupantDesc}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {siblingOutlets.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] text-slate-400 font-medium mb-1">
                    Autre(s) prise(s) sur ce poste :
                  </div>
                  <div className="space-y-1">
                    {siblingOutlets.map((sibling) => (
                      <button
                        key={sibling.id}
                        onClick={() => onSelectNode?.(sibling)}
                        className="w-full p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-left flex items-center justify-between transition group"
                      >
                        <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-300 group-hover:text-white">
                          {sibling.outletRole === "VOIP" ? (
                            <Phone className="w-3 h-3 text-purple-400" />
                          ) : (
                            <Laptop className="w-3 h-3 text-blue-400" />
                          )}
                          {sibling.name}
                        </span>
                        <span className="text-[9px] text-slate-500 group-hover:text-blue-400 flex items-center gap-0.5">
                          Voir <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {onAlignWithDesk && (
                <button
                  onClick={() => onAlignWithDesk(selectedNode.id, linkedDesk.id)}
                  className="w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-mono flex items-center justify-center gap-1.5 transition border border-slate-700"
                >
                  <Target className="w-3 h-3 text-blue-400" />
                  Repositionner au bord du bureau
                </button>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800 leading-relaxed">
              📍 <strong>Prise ou boîte de sol fixe :</strong> Immobile lors des réaménagements de bureau.
            </p>
          )}
        </div>

        {/* 3. Traçage CTE & Circuit Physique */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Circuit Physique & VLAN
            </span>
            {onTriggerTrace && (
              <button
                onClick={() => onTriggerTrace(selectedNode)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-mono underline"
              >
                Actualiser
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              <Activity className="w-6 h-6 text-blue-500 animate-spin mb-2" />
              <p className="text-[11px] font-mono text-slate-300">Exécution de la CTE récursive...</p>
            </div>
          ) : traceResult ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1 font-mono text-[11px] flex-shrink-0">
                <div className="flex justify-between">
                  <span className="text-slate-400">Longueur cumulée :</span>
                  <span className="text-blue-400 font-semibold">{traceResult.totalCableLengthMeters} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Équipement terminal :</span>
                  <span className="text-slate-200 font-semibold">{traceResult.terminalNode?.name ?? "N/A"}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">VLAN Actif :</span>
                  {traceResult.resolvedVlan ? (
                    <span
                      className={`px-1.5 py-0.5 rounded border font-bold text-[10px] ${
                        traceResult.resolvedVlan.vid === 30
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                          : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      }`}
                    >
                      VID {traceResult.resolvedVlan.vid} — {traceResult.resolvedVlan.name}
                    </span>
                  ) : (
                    <span className="text-amber-400">Non assigné</span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {traceResult.hops.map((hop) => (
                  <div
                    key={hop.hopNumber}
                    className="p-2 rounded border bg-slate-900/80 border-slate-800 text-[10px]"
                  >
                    <div className="flex items-center justify-between font-mono text-slate-400 mb-0.5">
                      <span className="font-semibold text-blue-400">[Hop {hop.hopNumber}] {hop.transitionType}</span>
                      {hop.cableLengthMm > 0 && <span>{hop.cableLengthMm / 1000} m</span>}
                    </div>
                    <div className="font-medium text-slate-200">{hop.nodeName}</div>
                    <div className="text-[9px] text-slate-400">Port {hop.portLabel} ({hop.portDirection})</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-900/50 rounded border border-slate-800 text-center">
              <p className="text-[11px] text-slate-400">Circuit non encore tracé.</p>
              {onTriggerTrace && (
                <button
                  onClick={() => onTriggerTrace(selectedNode)}
                  className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-medium transition"
                >
                  ⚡ Lancer le traçage CTE SQL
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Cas 2 : Baie Informatique 19" / Équipement Réseau DSI
  if (
    selectedNode.type === "PATCH_PANEL" ||
    selectedNode.type === "SWITCH" ||
    selectedNode.subType === "RACK_42U" ||
    selectedNode.subType === "RACK_18U"
  ) {
    const rackWidthMm = selectedNode.widthMm ?? 800;
    const rackDepthMm = selectedNode.heightMm ?? 1000;
    const connectedOutlets = allNodes.filter((n) => n.type === "WALL_OUTLET");

    return (
      <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
        {/* En-tête Baie */}
        <div className="border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
              <Server className="w-4 h-4 text-purple-400 flex-shrink-0" />
              {selectedNode.name}
            </span>
            <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex-shrink-0">
              BAIE 19&quot; (42U)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>
              Châssis : {(rackWidthMm / 1000).toFixed(2)} × {(rackDepthMm / 1000).toFixed(2)} m
            </span>
            <span className="text-slate-500">
              {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* Section 1 : Équipements internes 19 pouces */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              Équipements Rackables Normalisés (U)
            </span>

            <div className="space-y-1.5">
              {/* U24 Panneau de brassage */}
              <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    U24 : PP-24P-CAT6A-U24
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {connectedOutlets.length}/24 brassés
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Panneau RJ45 Cat6A blindé STP • Câblage horizontal des bureaux
                </div>
              </div>

              {/* U22 Switch Cisco */}
              <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    U22 : SW-ACCESS-4A-U22
                  </span>
                  <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    Cisco C9300
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  24 Ports 1GbE PoE+ 370W • Uplink 10GbE SFP+ vers Cœur de réseau
                </div>
              </div>

              {/* U01 PDU */}
              <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    U01 : PDU-APC-16A
                  </span>
                  <span className="text-[9px] font-mono text-amber-400">230V Ondulé</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Alimentation secourue sur onduleur centralisé
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 : VLANs Actifs Distribués */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              VLANs & Segmentation Réseau
            </span>

            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="p-1.5 bg-slate-950 rounded border border-blue-500/30 text-blue-300">
                <div className="font-bold">VLAN 20</div>
                <div className="text-[9px] text-slate-400">VLAN_CORP_DATA</div>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-purple-500/30 text-purple-300">
                <div className="font-bold">VLAN 30</div>
                <div className="text-[9px] text-slate-400">VLAN_VOIP (QoS)</div>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-amber-500/30 text-amber-300">
                <div className="font-bold">VLAN 40</div>
                <div className="text-[9px] text-slate-400">VLAN_PRINT</div>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-indigo-500/30 text-indigo-300">
                <div className="font-bold">VLAN 50</div>
                <div className="text-[9px] text-slate-400">VLAN_WIFI_INFRA</div>
              </div>
            </div>
          </div>

          {/* Section 3 : Liaisons vers les prises du plateau */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              Prises Raccordées ({connectedOutlets.length})
            </span>

            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {connectedOutlets.map((outlet, oIdx) => (
                <button
                  key={outlet.id}
                  onClick={() => onSelectNode?.(outlet)}
                  className="w-full p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-left flex items-center justify-between transition group"
                >
                  <span className="font-mono text-[10px] text-slate-300 group-hover:text-white flex items-center gap-1.5">
                    {outlet.outletRole === "VOIP" ? (
                      <Phone className="w-3 h-3 text-purple-400" />
                    ) : (
                      <Laptop className="w-3 h-3 text-blue-400" />
                    )}
                    {outlet.name}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 group-hover:text-blue-400">
                    Port {String(oIdx + 1).padStart(2, "0")} →
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Champ Description éditable */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
            <label className="text-[10px] text-slate-400 block flex items-center gap-1">
              <FileText className="w-3 h-3 text-blue-400" />
              Notes & Description de la baie :
            </label>
            <textarea
              rows={2}
              value={selectedNode.description ?? ""}
              placeholder="Ex: Baie principale RDC, clés au local sécurité, maintenance annuelle effectuée..."
              onChange={(e) =>
                onUpdateNodeProperties?.(selectedNode.id, { description: e.target.value })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[11px] focus:outline-none focus:border-blue-500 resize-none font-sans"
            />
          </div>
        </div>
      </div>
    );
  }

  // Cas 3 : Bureau / Mobilier (RH, Dimensions réelles & fausses mesures)
  const attachedOutlets = allNodes.filter((n) => n.attachedToDeskId === selectedNode.id);
  const currentWidth = selectedNode.widthMm ?? 1600;
  const currentHeight = selectedNode.heightMm ?? 800;

  return (
    <div className="h-full flex flex-col text-xs font-sans overflow-hidden">
      {/* En-tête Bureau */}
      <div className="border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-100 flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-emerald-400" />
            {selectedNode.name}
          </span>
          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
            MOBILIER RH
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
          <span>
            Dimensions : {(currentWidth / 1000).toFixed(2)} × {(currentHeight / 1000).toFixed(2)} m
          </span>
          <span className="text-slate-500">
            {(selectedNode.xMm / 1000).toFixed(1)}m, {(selectedNode.yMm / 1000).toFixed(1)}m
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {/* Section 1 : Affectation RH (Multi-Places ou Place Solo) */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
          {deskSeatCount > 1 ? (
            /* Cas Multi-Postes : Bench Double (2 places) ou Îlot Quad (4 places) */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Affectation des Postes ({occupiedSeatsCount}/{deskSeatCount} occupés)
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    occupiedSeatsCount === deskSeatCount
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : occupiedSeatsCount > 0
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {occupiedSeatsCount === deskSeatCount
                    ? "COMPLET"
                    : occupiedSeatsCount > 0
                    ? "PARTIEL"
                    : "VIDE / FLEX"}
                </span>
              </div>

              {/* Cartes individuelles pour chaque place */}
              <div className="space-y-2">
                {currentSeats.map((seat, idx) => {
                  const assignedUser = seat.userId
                    ? ENTERPRISE_DIRECTORY.find((u) => u.id === seat.userId)
                    : seat.fullName
                    ? ENTERPRISE_DIRECTORY.find((u) => u.fullName.toLowerCase() === seat.fullName?.toLowerCase())
                    : null;
                  const isOccupied = Boolean(seat.fullName);
                  const isPickingThisSeat = pickingSeatIndex === idx;
                  const seatOutlets = attachedOutlets.filter((o) => o.attachedSeatIndex === idx);

                  return (
                    <div
                      key={`seat-card-${idx}`}
                      className={`p-2 rounded border transition ${
                        isOccupied
                          ? "bg-slate-950 border-slate-800"
                          : "bg-slate-950/50 border-dashed border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center text-[9px] font-mono">
                            {idx + 1}
                          </span>
                          {seat.seatLabel ?? `Place ${idx + 1}`}
                        </span>
                        <span
                          className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                            isOccupied
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-slate-800 text-slate-500 border-slate-700"
                          }`}
                        >
                          {isOccupied ? "OCCUPÉ" : "DISPONIBLE"}
                        </span>
                      </div>

                      {isOccupied ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                  assignedUser?.avatarColor ?? "bg-blue-600"
                                }`}
                              >
                                {(seat.fullName ?? "U")
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="truncate">
                                <div className="text-[11px] font-semibold text-slate-100 truncate">
                                  {seat.fullName}
                                </div>
                                <div className="text-[9px] text-slate-400 truncate">
                                  {assignedUser?.jobTitle ?? seat.department ?? "Collaborateur"}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleUnassignSeat(idx)}
                              title="Libérer cette place"
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded transition"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              setUserSearchQuery("");
                              setPickingSeatIndex(isPickingThisSeat ? null : idx);
                            }}
                            className="w-full py-0.5 px-2 text-[9px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition text-center"
                          >
                            {isPickingThisSeat ? "Fermer l'annuaire" : "Changer d'occupant..."}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setUserSearchQuery("");
                            setPickingSeatIndex(isPickingThisSeat ? null : idx);
                          }}
                          className="w-full py-1 px-2 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-slate-300 text-[10px] flex items-center justify-between transition"
                        >
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Plus className="w-3 h-3 text-blue-400" />
                            Attribuer un collaborateur
                          </span>
                          <span className="text-[9px] text-blue-400 font-mono">Entra ID</span>
                        </button>
                      )}

                      {/* Prises attribuées à cette place */}
                      {seatOutlets.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-1.5 mt-1.5 border-t border-slate-900">
                          <span className="text-[9px] text-slate-500 font-medium">Prises :</span>
                          {seatOutlets.map((outlet) => (
                            <button
                              key={outlet.id}
                              onClick={() => onSelectNode?.(outlet)}
                              className="px-1.5 py-0.5 rounded bg-blue-950/60 hover:bg-blue-900 border border-blue-800/60 text-[9px] font-mono text-blue-300 flex items-center gap-1 transition"
                              title="Inspecter cette prise"
                            >
                              {outlet.outletRole === "VOIP" ? (
                                <Phone className="w-2.5 h-2.5 text-purple-400" />
                              ) : (
                                <Laptop className="w-2.5 h-2.5 text-blue-400" />
                              )}
                              {outlet.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Sélecteur Annuaire Déroulant pour cette place */}
                      {isPickingThisSeat && (
                        <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5 mt-2 shadow-xl">
                          <div className="relative">
                            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                            <input
                              type="text"
                              value={userSearchQuery}
                              onChange={(e) => setUserSearchQuery(e.target.value)}
                              placeholder="Rechercher par nom, métier ou service..."
                              className="w-full pl-6 pr-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[9px] focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                          </div>

                          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs">
                            {filteredUsers.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => handleAssignUserToSeat(idx, user)}
                                className="w-full p-1.5 rounded flex items-center justify-between text-left transition hover:bg-slate-800 text-slate-300"
                              >
                                <div className="truncate">
                                  <div className="text-[10px] font-medium text-slate-200 truncate">
                                    {user.fullName}
                                  </div>
                                  <div className="text-[8px] text-slate-400 truncate">
                                    {user.jobTitle} • {user.department}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Cas Bureau Solo : 1 seule personne assignée */
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Collaborateur Assigné (Entra ID)
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    selectedNode.assignedPerson
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {selectedNode.assignedPerson ? "OCCUPÉ" : "FLEX / LIBRE"}
                </span>
              </div>

              {/* Profil assigné ou sélection */}
              {currentAssignedUser || selectedNode.assignedPerson ? (
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          currentAssignedUser?.avatarColor ?? "bg-blue-600"
                        }`}
                      >
                        {(currentAssignedUser?.fullName ?? selectedNode.assignedPerson ?? "U")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-100">
                          {currentAssignedUser?.fullName ?? selectedNode.assignedPerson}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {currentAssignedUser?.jobTitle ?? selectedNode.department ?? "Collaborateur"}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        onUpdateNodeProperties?.(selectedNode.id, {
                          assignedPerson: undefined,
                          assignedUserId: undefined,
                          department: undefined,
                          seats: [],
                        })
                      }
                      title="Libérer le poste (passer en flex)"
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded transition"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {currentAssignedUser && (
                    <div className="pt-1.5 border-t border-slate-900 grid grid-cols-1 gap-1 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span>{currentAssignedUser.department}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-400">
                        <Mail className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{currentAssignedUser.email}</span>
                      </div>
                      {currentAssignedUser.phone && (
                        <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-400">
                          <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span>{currentAssignedUser.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setIsUserPickerOpen((prev) => !prev)}
                    className="w-full py-1 px-2 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition text-center"
                  >
                    {isUserPickerOpen ? "Fermer l'annuaire" : "Changer d'occupant..."}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-400">
                    Poste vacant ou flexible. Attribuez un collaborateur :
                  </div>
                  <button
                    onClick={() => setIsUserPickerOpen((prev) => !prev)}
                    className="w-full py-1.5 px-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs flex items-center justify-between transition"
                  >
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                      Sélectionner dans l'annuaire...
                    </span>
                    <span className="text-[10px] text-blue-400 font-mono">Entra ID</span>
                  </button>
                </div>
              )}

              {/* Menu déroulant de l'Annuaire Entra ID */}
              {isUserPickerOpen && (
                <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg space-y-2 mt-1 shadow-xl">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Rechercher par nom, métier ou service..."
                      className="w-full pl-7 pr-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 text-[10px] focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 pr-1 text-xs">
                    {filteredUsers.map((user) => {
                      const isCurrent = (currentAssignedUser?.id ?? selectedNode.assignedUserId) === user.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            onUpdateNodeProperties?.(selectedNode.id, {
                              assignedPerson: user.fullName,
                              assignedUserId: user.id,
                              department: user.department,
                              seats: [
                                {
                                  seatIndex: 0,
                                  seatLabel: "Place Unique",
                                  userId: user.id,
                                  fullName: user.fullName,
                                  department: user.department,
                                },
                              ],
                            });
                            setIsUserPickerOpen(false);
                          }}
                          className={`w-full p-1.5 rounded flex items-center justify-between text-left transition ${
                            isCurrent
                              ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300"
                              : "hover:bg-slate-900 text-slate-300"
                          }`}
                        >
                          <div className="truncate">
                            <div className="text-[11px] font-medium text-slate-200 truncate flex items-center gap-1">
                              {user.fullName}
                              {isCurrent && <Check className="w-3 h-3 text-emerald-400" />}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate">
                              {user.jobTitle} • <span className="text-slate-500">{user.department}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Champ Description & Notes du poste */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3 text-blue-400" />
              Description & Notes du poste :
            </label>
            <textarea
              rows={2}
              value={selectedNode.description ?? ""}
              placeholder="Ex: Double écran 27 pouces, station d'accueil USB-C, proche baie vitrée..."
              onChange={(e) =>
                onUpdateNodeProperties?.(selectedNode.id, { description: e.target.value })
              }
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[11px] focus:outline-none focus:border-blue-500 resize-none font-sans"
            />
          </div>
        </div>

        {/* Section 2 : Vraies Échelles vs Mesures Libres / Fausses Mesures */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-blue-400" />
              Dimensions Métriques Réelles
            </span>
            <span className="text-[10px] text-slate-500 font-mono">1 mm = 1 unité</span>
          </div>

          {/* Gabarits rapides standards */}
          <div>
            <div className="text-[10px] text-slate-400 mb-1">Gabarits normalisés rapides :</div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() =>
                  onUpdateNodeProperties?.(selectedNode.id, { widthMm: 1600, heightMm: 800, subType: "DESK_SOLO" })
                }
                className={`py-1 px-1 rounded text-[10px] font-mono border transition ${
                  currentWidth === 1600 && currentHeight === 800 && selectedNode.subType === "DESK_SOLO"
                    ? "bg-blue-600 text-white border-blue-500 font-bold"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                Solo 160 × 80 cm
              </button>
              <button
                onClick={() =>
                  onUpdateNodeProperties?.(selectedNode.id, { widthMm: 1200, heightMm: 700, subType: "DESK_COMPACT" })
                }
                className={`py-1 px-1 rounded text-[10px] font-mono border transition ${
                  currentWidth === 1200 && currentHeight === 700 && selectedNode.subType === "DESK_COMPACT"
                    ? "bg-blue-600 text-white border-blue-500 font-bold"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                Solo 120 × 70 cm
              </button>
              <button
                onClick={() => {
                  const dblLabels = getDefaultSeatLabels("BENCH_DOUBLE");
                  const initSeats: DeskSeatOccupant[] = dblLabels.map((lbl, i) => ({
                    seatIndex: i,
                    seatLabel: lbl,
                    userId: selectedNode.seats?.[i]?.userId,
                    fullName: selectedNode.seats?.[i]?.fullName,
                    department: selectedNode.seats?.[i]?.department,
                  }));
                  onUpdateNodeProperties?.(selectedNode.id, {
                    widthMm: 1600,
                    heightMm: 1600,
                    subType: "BENCH_DOUBLE",
                    seats: initSeats,
                  });
                }}
                className={`py-1 px-1 rounded text-[10px] font-mono border transition ${
                  currentWidth === 1600 && currentHeight === 1600 && selectedNode.subType === "BENCH_DOUBLE"
                    ? "bg-blue-600 text-white border-blue-500 font-bold"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                Bench 2P (160²)
              </button>
              <button
                onClick={() => {
                  const quadLabels = getDefaultSeatLabels("BENCH_QUAD");
                  const initSeats: DeskSeatOccupant[] = quadLabels.map((lbl, i) => ({
                    seatIndex: i,
                    seatLabel: lbl,
                    userId: selectedNode.seats?.[i]?.userId,
                    fullName: selectedNode.seats?.[i]?.fullName,
                    department: selectedNode.seats?.[i]?.department,
                  }));
                  onUpdateNodeProperties?.(selectedNode.id, {
                    widthMm: 3200,
                    heightMm: 1600,
                    subType: "BENCH_QUAD",
                    seats: initSeats,
                  });
                }}
                className={`py-1 px-1 rounded text-[10px] font-mono border transition ${
                  currentWidth === 3200 && currentHeight === 1600 && selectedNode.subType === "BENCH_QUAD"
                    ? "bg-blue-600 text-white border-blue-500 font-bold"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                Îlot 4P (320×160)
              </button>
            </div>
          </div>

          {/* Saisie manuelle libre (fausses ou vraies mesures au mm) */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Largeur (mm) :</label>
              <input
                type="number"
                step="50"
                value={currentWidth}
                onChange={(e) =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    widthMm: Math.max(400, Number(e.target.value)),
                  })
                }
                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-slate-200 text-[11px] focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Profondeur (mm) :</label>
              <input
                type="number"
                step="50"
                value={currentHeight}
                onChange={(e) =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    heightMm: Math.max(400, Number(e.target.value)),
                  })
                }
                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-slate-200 text-[11px] focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Orientation & Fauteuil */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Armchair className="w-3.5 h-3.5 text-slate-400" />
              Position Fauteuil :
            </span>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    chairPosition: selectedNode.chairPosition === "NONE" ? "BOTTOM" : "NONE",
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  selectedNode.chairPosition !== "NONE"
                    ? "bg-slate-800 text-emerald-400 border-emerald-500/40"
                    : "bg-slate-950 text-slate-500 border-slate-800"
                }`}
              >
                {selectedNode.chairPosition !== "NONE" ? "Actif" : "Masqué"}
              </button>
              <button
                onClick={() =>
                  onUpdateNodeProperties?.(selectedNode.id, {
                    rotationDeg: ((selectedNode.rotationDeg ?? 0) + 90) % 360,
                  })
                }
                title="Pivoter le bureau de 90° (sens horaire)"
                className="px-2 py-0.5 text-[10px] text-blue-400 hover:text-white bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 transition flex items-center gap-1 font-mono"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{selectedNode.rotationDeg ?? 0}°</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 3 : Prises Solidaires & Câblage Réseau */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              Prises Solidaires ({attachedOutlets.length})
            </span>
          </div>

          {onAddOutletToDesk && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onAddOutletToDesk(selectedNode.id, "VOIP")}
                className="py-1.5 px-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
              >
                <Plus className="w-3 h-3" />
                <Phone className="w-3 h-3 text-purple-400" />
                + Prise IP Phone
              </button>
              <button
                onClick={() => onAddOutletToDesk(selectedNode.id, "DATA")}
                className="py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition"
              >
                <Plus className="w-3 h-3" />
                <Laptop className="w-3 h-3 text-blue-400" />
                + Prise Data
              </button>
            </div>
          )}

          <div className="space-y-1.5 pt-1">
            {attachedOutlets.map((outlet) => {
              const isVoip = outlet.outletRole === "VOIP";
              const dx = Math.round(outlet.xMm - selectedNode.xMm);
              const dy = Math.round(outlet.yMm - selectedNode.yMm);

              return (
                <div
                  key={outlet.id}
                  className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    {isVoip ? (
                      <Phone className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <Laptop className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <div>
                      <div className="font-mono text-slate-200">{outlet.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        ΔX {dx > 0 ? `+${dx}` : dx}mm, ΔY {dy > 0 ? `+${dy}` : dy}mm
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {deskSeatCount > 1 && (
                      <select
                        value={outlet.attachedSeatIndex !== undefined ? outlet.attachedSeatIndex : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            onUpdateNodeProperties?.(outlet.id, {
                              attachedSeatIndex: undefined,
                              assignedPerson: undefined,
                            });
                          } else {
                            const seatIdx = Number(val);
                            const occupant = currentSeats.find((s) => s.seatIndex === seatIdx);
                            onUpdateNodeProperties?.(outlet.id, {
                              attachedSeatIndex: seatIdx,
                              assignedPerson: occupant?.fullName || undefined,
                            });
                          }
                        }}
                        className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] text-slate-300 focus:outline-none focus:border-blue-500 font-sans"
                        title="Attribution à une place"
                      >
                        <option value="">Commune</option>
                        {currentSeats.map((s, sIdx) => (
                          <option key={sIdx} value={sIdx}>
                            P{sIdx + 1} {s.fullName ? `(${s.fullName.split(" ")[0]})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => onSelectNode?.(outlet)}
                      title="Inspecter le circuit"
                      className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onToggleAttachment(outlet.id, undefined)}
                      title="Détacher"
                      className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
