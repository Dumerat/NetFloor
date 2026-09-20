"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Users,
  Monitor,
  Plug,
  Printer,
  Wifi,
  Camera,
  Server,
  Search,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Cpu,
  GripVertical,
  Phone,
  Laptop,
} from "lucide-react";
import { NodeDisplay, RackDisplay } from "@/components/canvas/EquipmentLayer";
import { loadEnterpriseDirectory, DirectoryUser } from "@/data/directory";
import { VlanStyle, DEFAULT_VLAN_STYLES } from "@/data/vlanStyles";
import { FloorZone } from "@/types/zones";

export type InventoryTab = "USERS" | "DESKS" | "PORTS" | "DEVICES" | "INFRA";
export type DeviceSubFilter = "ALL" | "PRINTER" | "WIFI" | "CAMERA" | "OTHER";

interface InventoryPanelProps {
  nodes: NodeDisplay[];
  racks: RackDisplay[];
  zones?: FloorZone[] | undefined;
  vlanStyles?: Record<number, VlanStyle>;
  onSelectNode?: (node: NodeDisplay) => void;
  onFocusNode?: (nodeId: string) => void;
  onClose?: () => void;
  onUpdateNode?: (nodeId: string, updates: Partial<NodeDisplay>) => void;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  nodes,
  racks,
  zones = [],
  vlanStyles = DEFAULT_VLAN_STYLES,
  onSelectNode,
  onFocusNode,
  onClose,
  onUpdateNode,
}) => {
  const [activeTab, setActiveTab] = useState<InventoryTab>("USERS");
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceSubFilter, setDeviceSubFilter] = useState<DeviceSubFilter>("ALL");

  // Synchronisation réactive de l'annuaire d'entreprise (AD + Hors Domaine / Custom)
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>(() => {
    if (typeof window !== "undefined") {
      return loadEnterpriseDirectory();
    }
    return [];
  });

  useEffect(() => {
    const refreshDirectory = () => {
      setDirectoryUsers(loadEnterpriseDirectory());
    };
    window.addEventListener("netfloor_directory_updated", refreshDirectory);
    window.addEventListener("storage", refreshDirectory);
    return () => {
      window.removeEventListener("netfloor_directory_updated", refreshDirectory);
      window.removeEventListener("storage", refreshDirectory);
    };
  }, []);

  // -------------------------------------------------------------
  // 1. DATA COMPUTATION & CROSS-REFERENCING
  // -------------------------------------------------------------

  // Liste consolidée de tous les bureaux
  const deskNodes = useMemo(() => {
    return nodes.filter((n) => n.type === "DESK");
  }, [nodes]);

  // Liste consolidée de toutes les prises murales et blocs de prises RJ45
  const outletNodes = useMemo(() => {
    return nodes.filter((n) => n.type === "WALL_OUTLET");
  }, [nodes]);

  // Consolidation de l'annuaire (SAML/AD/CUSTOM) et des collaborateurs assignés sur le plateau
  const allUsers: DirectoryUser[] = useMemo(() => {
    const userMap = new Map<string, DirectoryUser>();
    for (const u of directoryUsers) {
      userMap.set(u.fullName.toLowerCase(), u);
    }
    // Détecter les occupants assignés sur les bureaux et postes
    for (const desk of deskNodes) {
      if (desk.assignedPerson && !userMap.has(desk.assignedPerson.toLowerCase())) {
        const name = desk.assignedPerson.trim();
        userMap.set(name.toLowerCase(), {
          id: desk.assignedUserId || `custom-${name.toLowerCase().replace(/\s+/g, "-")}`,
          fullName: name,
          jobTitle: "Collaborateur",
          department: desk.department || "Plateau",
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@corp.local`,
          avatarColor: "bg-blue-600",
        });
      }
      if (desk.seats) {
        for (const s of desk.seats) {
          if (s.fullName && !userMap.has(s.fullName.toLowerCase())) {
            const name = s.fullName.trim();
            userMap.set(name.toLowerCase(), {
              id: s.userId || `custom-${name.toLowerCase().replace(/\s+/g, "-")}`,
              fullName: name,
              jobTitle: s.seatLabel || "Collaborateur",
              department: desk.department || "Plateau",
              email: `${name.toLowerCase().replace(/\s+/g, ".")}@corp.local`,
              avatarColor: "bg-purple-600",
            });
          }
        }
      }
    }
    // Détecter les occupants assignés sur les prises RJ45
    for (const outlet of outletNodes) {
      if (outlet.assignedPerson && !userMap.has(outlet.assignedPerson.toLowerCase())) {
        const name = outlet.assignedPerson.trim();
        userMap.set(name.toLowerCase(), {
          id: outlet.assignedUserId || `custom-${name.toLowerCase().replace(/\s+/g, "-")}`,
          fullName: name,
          jobTitle: "Collaborateur",
          department: outlet.department || "Plateau",
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@corp.local`,
          avatarColor: "bg-emerald-600",
        });
      }
      if (outlet.stackedPorts) {
        for (const sp of outlet.stackedPorts) {
          if (sp.assignedPerson && !userMap.has(sp.assignedPerson.toLowerCase())) {
            const name = sp.assignedPerson.trim();
            userMap.set(name.toLowerCase(), {
              id: `custom-${name.toLowerCase().replace(/\s+/g, "-")}`,
              fullName: name,
              jobTitle: sp.outletRole || "Collaborateur",
              department: outlet.department || "Plateau",
              email: `${name.toLowerCase().replace(/\s+/g, ".")}@corp.local`,
              avatarColor: "bg-indigo-600",
            });
          }
        }
      }
    }
    return Array.from(userMap.values());
  }, [directoryUsers, deskNodes, outletNodes]);

  // Correspondance Utilisateur -> Bureaux multiples, Prises multiples & Téléphone IP
  const usersWithAssignments = useMemo(() => {
    return allUsers.map((user) => {
      // 1. Trouver TOUS les meubles assignés à cet utilisateur
      interface UserDeskAssignment {
        desk: NodeDisplay;
        seatLabel: string;
      }
      const assignedDesks: UserDeskAssignment[] = [];

      for (const desk of deskNodes) {
        if (desk.assignedPerson === user.fullName) {
          assignedDesks.push({
            desk,
            seatLabel: "Poste principal",
          });
        }
        if (desk.seats && desk.seats.length > 0) {
          desk.seats.forEach((seatItem, seatIdx) => {
            if (seatItem.fullName === user.fullName) {
              assignedDesks.push({
                desk,
                seatLabel: `Place #${seatIdx + 1} (${seatItem.seatLabel ?? "Poste"})`,
              });
            }
          });
        }
      }

      // 2. Trouver TOUTES les prises/ports associés à cet utilisateur (directement ou via les bureaux)
      interface UserOutletAssignment {
        outlet: NodeDisplay;
        portInfo: string;
        vlanId?: number | undefined;
        isVoip?: boolean | undefined;
        ipAddress?: string | undefined;
      }
      const assignedOutlets: UserOutletAssignment[] = [];

      // Prises assignées nommément à l'utilisateur
      for (const outlet of outletNodes) {
        // Bloc de prises RJ45 multi-ports
        if (outlet.stackedPorts && outlet.stackedPorts.length > 0) {
          outlet.stackedPorts.forEach((sp) => {
            if (sp.assignedPerson === user.fullName) {
              assignedOutlets.push({
                outlet,
                portInfo: `${sp.portLabel} (${sp.outletRole || "DATA"})`,
                vlanId: sp.vlanId,
                isVoip: sp.outletRole === "VOIP" || sp.vlanId === 30,
                ipAddress: sp.ipAddress || outlet.ipAddress,
              });
            }
          });
        }
        // Prise simple
        if (outlet.assignedPerson === user.fullName) {
          assignedOutlets.push({
            outlet,
            portInfo: outlet.outletRole || "DATA",
            vlanId: outlet.vlanId,
            isVoip: outlet.outletRole === "VOIP" || outlet.vlanId === 30,
            ipAddress: outlet.ipAddress,
          });
        }
      }

      // Prises solidaires des bureaux occupés par l'utilisateur
      assignedDesks.forEach(({ desk }) => {
        const linkedOutlets = outletNodes.filter(
          (o) =>
            o.attachedToDeskId === desk.id ||
            o.attachedDeskIds?.includes(desk.id) ||
            o.stackedPorts?.some((p) => p.attachedToDeskId === desk.id)
        );
        linkedOutlets.forEach((lo) => {
          const alreadyInList = assignedOutlets.some((ao) => ao.outlet.id === lo.id);
          if (!alreadyInList) {
            if (lo.stackedPorts && lo.stackedPorts.length > 0) {
              lo.stackedPorts.forEach((sp) => {
                assignedOutlets.push({
                  outlet: lo,
                  portInfo: `${sp.portLabel} (via ${lo.name})`,
                  vlanId: sp.vlanId,
                  isVoip: sp.outletRole === "VOIP" || sp.vlanId === 30,
                  ipAddress: sp.ipAddress || lo.ipAddress,
                });
              });
            } else {
              assignedOutlets.push({
                outlet: lo,
                portInfo: `${lo.outletRole || "DATA"} (via ${lo.name})`,
                vlanId: lo.vlanId,
                isVoip: lo.outletRole === "VOIP" || lo.vlanId === 30,
                ipAddress: lo.ipAddress,
              });
            }
          }
        });
      });

      // 3. Identification du Poste de travail Utilisateur (PC / Laptop sur VLAN DATA 20)
      const dataOutlet = assignedOutlets.find((o) => !o.isVoip);
      const userNum = user.id.replace(/\D/g, "") || "10";
      const userNumInt = Number(userNum) % 200 || 12;
      const workstationIp =
        dataOutlet?.ipAddress || dataOutlet?.outlet.ipAddress || `10.42.20.${100 + userNumInt}`;
      const firstName = user.fullName.split(" ")[0] || "USER";
      const workstation = {
        name: `PC-${firstName.toUpperCase()}-${userNumInt}`,
        ipAddress: workstationIp,
        vlanId: dataOutlet?.vlanId ?? 20,
        connectedPort: dataOutlet ? `${dataOutlet.outlet.name} • ${dataOutlet.portInfo}` : null,
        hasDataPort: Boolean(dataOutlet),
      };

      // 4. Détection ou attribution du Téléphone IP relié au port Téléphonie (VLAN 30)
      const voipOutlet = assignedOutlets.find((o) => o.isVoip);
      const calculatedVoipIp =
        voipOutlet?.ipAddress || voipOutlet?.outlet.ipAddress || `10.42.30.${100 + userNumInt}`;
      const ipPhone = {
        model: "Cisco IP Phone 8845 / Yealink T54W",
        phoneNumber: user.phone || `+33 1 42 68 01 ${user.id.slice(-2)}`,
        macAddress: `00:08:5D:${user.id.slice(-2)}:A4:1F`,
        extension: `20${user.id.slice(-2)}`,
        ipAddress: calculatedVoipIp,
        connectedPort: voipOutlet ? `${voipOutlet.outlet.name} • ${voipOutlet.portInfo}` : null,
        vlanId: voipOutlet?.vlanId ?? 30,
        hasVoipPort: Boolean(voipOutlet),
      };

      return {
        user,
        assignedDesks,
        assignedOutlets,
        workstation,
        ipPhone,
        isAssigned: assignedDesks.length > 0 || assignedOutlets.length > 0,
      };
    });
  }, [deskNodes, outletNodes]);

  // Tous les ports individuels consolidés (Prises simples + chaque port de bloc P1..P8)
  const allConsolidatedPorts = useMemo(() => {
    interface PortItem {
      id: string;
      parentOutlet: NodeDisplay;
      portLabel: string;
      outletRole: string;
      vlanId?: number | undefined;
      isPatched: boolean;
      emote: string;
      connectedRackId?: string | undefined;
      connectedSwitchId?: string | undefined;
      connectedSwitchPort?: string | undefined;
      macAddress?: string | undefined;
      ipAddress?: string | undefined;
      assignedPerson?: string | undefined;
    }

    const list: PortItem[] = [];

    const getEmoteForRole = (role: string, custom?: string) => {
      if (custom) return custom;
      switch (role) {
        case "VOIP":
          return "📞";
        case "WIFI":
          return "📶";
        case "PRINTER":
          return "🖨️";
        case "CAMERA":
          return "📷";
        default:
          return "🔌";
      }
    };

    outletNodes.forEach((outlet) => {
      if (outlet.stackedPorts && outlet.stackedPorts.length > 0) {
        outlet.stackedPorts.forEach((sp, idx) => {
          list.push({
            id: `${outlet.id}-${sp.portIndex ?? idx}`,
            parentOutlet: outlet,
            portLabel: sp.portLabel || `P${idx + 1}`,
            outletRole: sp.outletRole || "DATA",
            vlanId: sp.vlanId,
            isPatched: !!sp.isPatched,
            emote: getEmoteForRole(sp.outletRole || "DATA"),
            connectedRackId: sp.connectedRackId || outlet.connectedRackId,
            connectedSwitchId: sp.connectedSwitchId,
            connectedSwitchPort: sp.connectedSwitchPort,
            macAddress: sp.macAddress,
            ipAddress: sp.ipAddress,
            assignedPerson: sp.assignedPerson,
          });
        });
      } else {
        list.push({
          id: outlet.id,
          parentOutlet: outlet,
          portLabel: "P1 (Principal)",
          outletRole: outlet.outletRole || "DATA",
          vlanId: outlet.vlanId,
          isPatched: !!outlet.isPatched,
          emote: getEmoteForRole(outlet.outletRole || "DATA", outlet.customEmote),
          connectedRackId: outlet.connectedRackId,
          connectedSwitchId: outlet.connectedSwitchId,
          connectedSwitchPort: outlet.connectedSwitchPort,
          macAddress: outlet.macAddress,
          ipAddress: outlet.ipAddress,
          assignedPerson: outlet.assignedPerson,
        });
      }
    });

    return list;
  }, [outletNodes]);

  // Équipements terminaux (Prises/Modules avec rôle spécifique : Wi-Fi, Imprimante, Caméra, ou sous-type spécial)
  const deviceNodes = useMemo(() => {
    return nodes.filter((n) => {
      // Exclure les gros bureaux et les baies
      if (n.type === "PATCH_PANEL") return false;
      if (n.subType === "RACK_42U" || n.subType === "RACK_18U") return false;
      if (
        n.type === "DESK" &&
        n.subType !== "DESK_SOLO" &&
        n.subType !== "BENCH_DOUBLE" &&
        n.subType !== "BENCH_QUAD" &&
        n.subType !== "MEETING_TABLE"
      ) {
        return true;
      }
      // Conserver les équipements à rôle périphérique ou connectique spéciale
      const isSpecialRole =
        n.outletRole === "WIFI" ||
        n.outletRole === "PRINTER" ||
        n.outletRole === "CAMERA" ||
        n.outletRole === "VOIP" ||
        n.subType === "WIFI_AP" ||
        n.subType === "PRINTER_STATION" ||
        n.subType === "CAMERA_IP";
      return isSpecialRole;
    });
  }, [nodes]);

  // Infrastructure : Baies informatiques consolidées avec métriques
  const infraMetrics = useMemo(() => {
    return racks.map((rack) => {
      const devices = rack.devices ?? [];
      const totalU = rack.uHeight || 42;
      const occupiedU = devices.reduce((sum, d) => sum + (d.uSize ?? 1), 0);

      const switches = devices.filter((d) => d.deviceType === "SWITCH");
      const patchPanels = devices.filter((d) => d.deviceType === "PATCH_PANEL");
      const servers = devices.filter((d) => d.deviceType === "SERVER");
      const pdus = devices.filter((d) => d.deviceType === "PDU");

      // Taux d'occupation des ports switch de cette baie
      let totalSwitchPorts = 0;
      let usedSwitchPorts = 0;

      switches.forEach((sw) => {
        const ports = sw.portsCount || 24;
        totalSwitchPorts += ports;
        // Compter les ports branchés vers ce switch depuis les prises
        const connectedCount = nodes.reduce((count, n) => {
          let c = 0;
          if (n.connectedSwitchId === sw.name || n.connectedSwitchId === sw.id) c++;
          if (n.stackedPorts) {
            n.stackedPorts.forEach((sp) => {
              if (sp.connectedSwitchId === sw.name || sp.connectedSwitchId === sw.id) c++;
            });
          }
          return count + c;
        }, 0);
        usedSwitchPorts += connectedCount;
      });

      return {
        rack,
        totalU,
        occupiedU,
        switchesCount: switches.length,
        patchPanelsCount: patchPanels.length,
        serversCount: servers.length,
        pdusCount: pdus.length,
        totalSwitchPorts,
        usedSwitchPorts,
      };
    });
  }, [nodes, racks]);

  // -------------------------------------------------------------
  // 2. FILTRAGE & RECHERCHE
  // -------------------------------------------------------------
  const query = searchTerm.trim().toLowerCase();

  // Filtre Utilisateurs
  const filteredUsers = useMemo(() => {
    return usersWithAssignments.filter(({ user, assignedDesks, assignedOutlets, ipPhone }) => {
      if (!query) return true;
      const matchName = user.fullName.toLowerCase().includes(query);
      const matchJob = user.jobTitle.toLowerCase().includes(query);
      const matchDept = user.department.toLowerCase().includes(query);
      const matchDesk = assignedDesks.some((d) => d.desk.name.toLowerCase().includes(query));
      const matchOutlet = assignedOutlets.some(
        (o) =>
          o.outlet.name.toLowerCase().includes(query) || o.portInfo.toLowerCase().includes(query)
      );
      const matchPhone =
        ipPhone.phoneNumber.toLowerCase().includes(query) ||
        ipPhone.extension.toLowerCase().includes(query);
      const matchSource = user.source ? user.source.toLowerCase().includes(query) : false;
      const matchEmail = user.email ? user.email.toLowerCase().includes(query) : false;
      const matchOffice = user.office ? user.office.toLowerCase().includes(query) : false;
      const matchSam = user.sAMAccountName ? user.sAMAccountName.toLowerCase().includes(query) : false;
      const matchCustom =
        query === "custom" ||
        query === "manuel" ||
        query === "hors domaine" ||
        query === "hors-domaine"
          ? user.source === "CUSTOM" || user.source === "MANUAL"
          : false;

      return (
        matchName ||
        matchJob ||
        matchDept ||
        matchDesk ||
        matchOutlet ||
        matchPhone ||
        matchSource ||
        matchEmail ||
        matchOffice ||
        matchSam ||
        matchCustom
      );
    });
  }, [usersWithAssignments, query]);

  // Filtre Bureaux
  const filteredDesks = useMemo(() => {
    return deskNodes.filter((desk) => {
      if (!query) return true;
      const matchName = desk.name.toLowerCase().includes(query);
      const matchPerson = desk.assignedPerson?.toLowerCase().includes(query);
      const matchSeat = desk.seats?.some((s) => s.fullName?.toLowerCase().includes(query));
      return matchName || matchPerson || matchSeat;
    });
  }, [deskNodes, query]);

  // Filtre Tous les Ports
  const filteredPorts = useMemo(() => {
    return allConsolidatedPorts.filter((p) => {
      if (!query) return true;
      return (
        p.parentOutlet.name.toLowerCase().includes(query) ||
        p.portLabel.toLowerCase().includes(query) ||
        p.outletRole.toLowerCase().includes(query) ||
        (p.ipAddress && p.ipAddress.toLowerCase().includes(query)) ||
        (p.macAddress && p.macAddress.toLowerCase().includes(query)) ||
        (p.assignedPerson && p.assignedPerson.toLowerCase().includes(query)) ||
        (p.connectedSwitchId && p.connectedSwitchId.toLowerCase().includes(query))
      );
    });
  }, [allConsolidatedPorts, query]);

  // Filtre Équipements
  const filteredDevices = useMemo(() => {
    return deviceNodes.filter((node) => {
      // 1. Sous-filtre de type
      if (
        deviceSubFilter === "PRINTER" &&
        node.outletRole !== "PRINTER" &&
        node.subType !== "PRINTER_STATION"
      ) {
        return false;
      }
      if (deviceSubFilter === "WIFI" && node.outletRole !== "WIFI" && node.subType !== "WIFI_AP") {
        return false;
      }
      if (
        deviceSubFilter === "CAMERA" &&
        node.outletRole !== "CAMERA" &&
        node.subType !== "CAMERA_IP"
      ) {
        return false;
      }
      if (
        deviceSubFilter === "OTHER" &&
        (node.outletRole === "PRINTER" ||
          node.subType === "PRINTER_STATION" ||
          node.outletRole === "WIFI" ||
          node.subType === "WIFI_AP" ||
          node.outletRole === "CAMERA" ||
          node.subType === "CAMERA_IP")
      ) {
        return false;
      }

      // 2. Recherche textuelle
      if (!query) return true;
      return (
        node.name.toLowerCase().includes(query) ||
        (node.description && node.description.toLowerCase().includes(query)) ||
        (node.ipAddress && node.ipAddress.toLowerCase().includes(query))
      );
    });
  }, [deviceNodes, deviceSubFilter, query]);

  // -------------------------------------------------------------
  // 3. ACTIONS
  // -------------------------------------------------------------
  const handleItemClick = (node: NodeDisplay) => {
    if (onSelectNode) onSelectNode(node);
    if (onFocusNode) onFocusNode(node.id);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* 1. Header du panneau d'inventaire */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-wide uppercase">
              Inventaire Global
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">Parc IT & Aménagement</span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition"
            title="Fermer le panneau"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Barre des 5 Sous-Menus Principaux */}
      <div className="p-2 border-b border-slate-800/80 bg-slate-900/40 flex-shrink-0">
        <div className="grid grid-cols-5 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-[10px]">
          <button
            onClick={() => setActiveTab("USERS")}
            className={`py-1.5 px-1 rounded flex flex-col items-center gap-0.5 font-medium transition ${
              activeTab === "USERS"
                ? "bg-blue-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
            title="Annuaire des Utilisateurs & Affectations"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="text-[9px]">Users</span>
          </button>

          <button
            onClick={() => setActiveTab("DESKS")}
            className={`py-1.5 px-1 rounded flex flex-col items-center gap-0.5 font-medium transition ${
              activeTab === "DESKS"
                ? "bg-indigo-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
            title="Mobilier & Bureaux"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="text-[9px]">Bureaux</span>
          </button>

          <button
            onClick={() => setActiveTab("PORTS")}
            className={`py-1.5 px-1 rounded flex flex-col items-center gap-0.5 font-medium transition ${
              activeTab === "PORTS"
                ? "bg-amber-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
            title="Recensement de tous les ports RJ45"
          >
            <Plug className="w-3.5 h-3.5" />
            <span className="text-[9px]">Ports</span>
          </button>

          <button
            onClick={() => setActiveTab("DEVICES")}
            className={`py-1.5 px-1 rounded flex flex-col items-center gap-0.5 font-medium transition ${
              activeTab === "DEVICES"
                ? "bg-cyan-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
            title="Périphériques & Équipements"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="text-[9px]">Équip.</span>
          </button>

          <button
            onClick={() => setActiveTab("INFRA")}
            className={`py-1.5 px-1 rounded flex flex-col items-center gap-0.5 font-medium transition ${
              activeTab === "INFRA"
                ? "bg-purple-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
            title="Infrastructure & Baies DSI"
          >
            <Server className="w-3.5 h-3.5" />
            <span className="text-[9px]">Infra</span>
          </button>
        </div>
      </div>

      {/* 3. Champ de recherche textuelle globale */}
      <div className="p-2 border-b border-slate-800/80 bg-slate-900/30 flex-shrink-0 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeTab === "USERS"
                ? "Rechercher un utilisateur, rôle..."
                : activeTab === "DESKS"
                  ? "Rechercher un bureau, occupant..."
                  : activeTab === "PORTS"
                    ? "Rechercher un port, IP, MAC, VLAN..."
                    : activeTab === "DEVICES"
                      ? "Rechercher un équipement, IP..."
                      : "Rechercher une baie, switch..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Sous-filtres pour l'onglet ÉQUIPEMENTS */}
      {activeTab === "DEVICES" && (
        <div className="px-2 py-1.5 border-b border-slate-800/80 bg-slate-900/20 flex items-center gap-1 overflow-x-auto flex-shrink-0 scrollbar-none text-[10px]">
          <button
            onClick={() => setDeviceSubFilter("ALL")}
            className={`px-2 py-1 rounded-full whitespace-nowrap transition ${
              deviceSubFilter === "ALL"
                ? "bg-slate-700 text-white font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            Tous ({deviceNodes.length})
          </button>
          <button
            onClick={() => setDeviceSubFilter("PRINTER")}
            className={`px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap transition ${
              deviceSubFilter === "PRINTER"
                ? "bg-amber-600 text-white font-semibold"
                : "text-slate-400 hover:text-amber-400 hover:bg-slate-850"
            }`}
          >
            <Printer className="w-3 h-3" /> Imprimantes
          </button>
          <button
            onClick={() => setDeviceSubFilter("WIFI")}
            className={`px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap transition ${
              deviceSubFilter === "WIFI"
                ? "bg-sky-600 text-white font-semibold"
                : "text-slate-400 hover:text-sky-400 hover:bg-slate-850"
            }`}
          >
            <Wifi className="w-3 h-3" /> Wi-Fi
          </button>
          <button
            onClick={() => setDeviceSubFilter("CAMERA")}
            className={`px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap transition ${
              deviceSubFilter === "CAMERA"
                ? "bg-rose-600 text-white font-semibold"
                : "text-slate-400 hover:text-rose-400 hover:bg-slate-850"
            }`}
          >
            <Camera className="w-3 h-3" /> Caméras
          </button>
          <button
            onClick={() => setDeviceSubFilter("OTHER")}
            className={`px-2 py-1 rounded-full whitespace-nowrap transition ${
              deviceSubFilter === "OTHER"
                ? "bg-purple-600 text-white font-semibold"
                : "text-slate-400 hover:text-purple-400 hover:bg-slate-850"
            }`}
          >
            Autres
          </button>
        </div>
      )}

      {/* 5. Contenu dynamique selon l'onglet actif */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* ========================================================= */}
        {/* ONGLET 1 : UTILISATEURS */}
        {/* ========================================================= */}
        {activeTab === "USERS" && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-slate-400 px-1 flex justify-between">
              <span>{filteredUsers.length} utilisateur(s) listé(s)</span>
              <span>{filteredUsers.filter((u) => u.isAssigned).length} poste(s) actif(s)</span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 px-4">
                {query
                  ? "Aucun utilisateur trouvé pour cette recherche."
                  : "Aucun utilisateur recensé. Connectez un annuaire d'entreprise (SAML/AD) ou assignez des collaborateurs aux bureaux et prises."}
              </div>
            ) : (
              filteredUsers.map(
                ({ user, assignedDesks, assignedOutlets, workstation, ipPhone }) => {
                  const primaryDesk = assignedDesks[0];

                  return (
                    <div
                      key={user.id}
                      draggable={true}
                      onDragStart={(e) => {
                        const userPayload = {
                          type: "DIRECTORY_USER",
                          user: {
                            id: user.id,
                            fullName: user.fullName,
                            jobTitle: user.jobTitle,
                            department: user.department,
                            email: user.email,
                            source: user.source,
                          },
                        };
                        e.dataTransfer.setData("application/json", JSON.stringify(userPayload));
                        e.dataTransfer.effectAllowed = "copy";

                        // Badge de drag flottant personnalisé épuré
                        const dragEl = document.createElement("div");
                        dragEl.style.position = "absolute";
                        dragEl.style.top = "-1000px";
                        dragEl.style.left = "-1000px";
                        dragEl.style.padding = "6px 12px";
                        dragEl.style.background = "#1e293b";
                        dragEl.style.color = "#ffffff";
                        dragEl.style.border = "1px solid #38bdf8";
                        dragEl.style.borderRadius = "8px";
                        dragEl.style.fontSize = "12px";
                        dragEl.style.fontWeight = "bold";
                        dragEl.style.display = "flex";
                        dragEl.style.alignItems = "center";
                        dragEl.style.gap = "6px";
                        dragEl.style.boxShadow = "0 8px 16px rgba(0,0,0,0.5)";
                        dragEl.innerHTML = `<span>👤</span> <span>${user.fullName}</span>`;
                        document.body.appendChild(dragEl);
                        e.dataTransfer.setDragImage(dragEl, 20, 15);
                        setTimeout(() => document.body.removeChild(dragEl), 0);
                      }}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition flex flex-col gap-1.5 cursor-grab active:cursor-grabbing group hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition flex-shrink-0" />
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner flex-shrink-0 ${
                              user.avatarColor || "bg-blue-600"
                            }`}
                          >
                            {user.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-100 group-hover:text-blue-300 transition flex items-center gap-1.5 flex-wrap">
                              <span>{user.fullName}</span>
                              {user.source === "AD" && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-mono font-medium">
                                  AD
                                </span>
                              )}
                              {user.source === "CUSTOM" && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-medium">
                                  Hors Domaine
                                </span>
                              )}
                              {user.source === "SAML" && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono font-medium">
                                  SAML
                                </span>
                              )}
                              {user.netFloorRole && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-sans">
                                  {user.netFloorRole}
                                </span>
                              )}
                              {assignedDesks.length > 0 ? (
                                <span
                                  className="w-2 h-2 rounded-full bg-emerald-400"
                                  title={`Au bureau (${assignedDesks.length} poste${assignedDesks.length > 1 ? "s" : ""})`}
                                />
                              ) : (
                                <span
                                  className="w-2 h-2 rounded-full bg-slate-500"
                                  title="Non assigné • À placer sur le plan"
                                />
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {user.jobTitle} •{" "}
                              <span className="text-slate-300">{user.department}</span>
                              {user.office && user.office !== "-" && (
                                <span className="text-slate-500"> • Bureau {user.office}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {primaryDesk && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(primaryDesk.desk);
                            }}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded transition"
                            title="Localiser le bureau principal sur le plan"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Détails consolidés des postes (Bureau 1, Bureau 2...) et prises rattachées */}
                      <div className="bg-slate-950/70 rounded p-1.5 border border-slate-800/80 text-[10px] flex flex-col gap-1.5">
                        {/* Section Bureaux */}
                        {assignedDesks.length === 0 ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="shrink-0 whitespace-nowrap text-slate-400 flex items-center gap-1">
                                <Monitor className="w-3 h-3 text-slate-500" />
                                <span>Bureau&nbsp;:</span>
                              </span>
                              <span className="min-w-0 truncate text-amber-400/90 italic font-mono text-[9px]">
                                ⚪ Non assigné (Glisser ou choisir ▾)
                              </span>
                            </div>
                            {onUpdateNode && deskNodes.length > 0 && (
                              <div
                                className="flex items-center gap-1 mt-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const selectedDeskId = e.target.value;
                                    if (!selectedDeskId) return;
                                    const targetDesk = deskNodes.find((d) => d.id === selectedDeskId);
                                    if (targetDesk) {
                                      onUpdateNode(targetDesk.id, {
                                        assignedPerson: user.fullName,
                                        assignedUserId: user.id,
                                        department: user.department || targetDesk.department,
                                      });
                                    }
                                  }}
                                  className="w-full bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-[9px] text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                                >
                                  <option value="">＋ Assigner à un bureau du plan...</option>
                                  {deskNodes.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name} {d.assignedPerson ? `(occupé: ${d.assignedPerson})` : "(libre)"}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        ) : (
                          assignedDesks.map(({ desk, seatLabel }, dIdx) => (
                            <div
                              key={desk.id + dIdx}
                              className="flex items-center justify-between gap-1"
                            >
                              <span className="shrink-0 whitespace-nowrap text-slate-400 flex items-center gap-1">
                                <Monitor className="w-3 h-3 text-slate-500" />
                                <span>
                                  {assignedDesks.length > 1
                                    ? `Bureau ${dIdx + 1}\u00A0:`
                                    : "Bureau\u00A0:"}
                                </span>
                              </span>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleItemClick(desk);
                                  }}
                                  className="min-w-0 truncate font-medium text-blue-400 hover:underline cursor-pointer"
                                  title="Cliquer pour centrer sur le plan"
                                >
                                  {desk.name} {seatLabel ? `• ${seatLabel}` : ""}
                                </span>
                                {onUpdateNode && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateNode(desk.id, {
                                        assignedPerson: undefined,
                                        assignedUserId: undefined,
                                      });
                                    }}
                                    className="text-[9px] text-slate-500 hover:text-rose-400 px-1 py-0.2 hover:bg-slate-800 rounded transition"
                                    title="Désassigner ce collaborateur du bureau"
                                  >
                                    ✕ Libérer
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}

                        {/* Section Prises & Ports RJ45 */}
                        {assignedOutlets.length === 0 ? (
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-850">
                            <span className="shrink-0 whitespace-nowrap text-slate-400 flex items-center gap-1">
                              <Plug className="w-3 h-3 text-slate-500" />
                              <span>Prise / Port&nbsp;:</span>
                            </span>
                            <span className="min-w-0 truncate text-slate-500 italic">
                              Aucune prise raccordée
                            </span>
                          </div>
                        ) : (
                          assignedOutlets.map((ao, oIdx) => {
                            const vStyle = ao.vlanId ? vlanStyles[ao.vlanId] : undefined;
                            return (
                              <div
                                key={ao.outlet.id + oIdx}
                                className="flex items-center justify-between gap-1 pt-1 border-t border-slate-850"
                              >
                                <span className="shrink-0 whitespace-nowrap text-slate-400 flex items-center gap-1">
                                  <Plug className="w-3 h-3 text-slate-500" />
                                  <span>
                                    {assignedOutlets.length > 1
                                      ? `Prise ${oIdx + 1}\u00A0:`
                                      : "Prise / Port\u00A0:"}
                                  </span>
                                </span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleItemClick(ao.outlet);
                                    }}
                                    className="min-w-0 truncate font-medium text-emerald-400 hover:underline cursor-pointer"
                                    title="Cliquer pour localiser sur le plan"
                                  >
                                    {ao.outlet.name} {ao.portInfo ? `[${ao.portInfo}]` : ""}
                                  </span>
                                  {ao.vlanId && (
                                    <span
                                      className="shrink-0 px-1 py-0.2 rounded text-[9px] font-mono border"
                                      style={{
                                        color: vStyle?.color ?? "#38bdf8",
                                        borderColor: `${vStyle?.color ?? "#38bdf8"}40`,
                                        backgroundColor: `${vStyle?.color ?? "#38bdf8"}15`,
                                      }}
                                    >
                                      V{ao.vlanId}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* Section Poste Utilisateur / PC (IP & Réseau Data) */}
                        <div className="pt-1.5 border-t border-slate-800/80 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="shrink-0 whitespace-nowrap text-slate-400 flex items-center gap-1">
                              <Laptop className="w-3 h-3 text-sky-400" />
                              <span>Poste / PC&nbsp;:</span>
                            </span>
                            <span className="min-w-0 truncate text-sky-300 font-mono font-medium">
                              {workstation.name}
                            </span>
                          </div>

                          {/* Bloc Réseau PC : Port raccordé & Adresse IP */}
                          <div className="flex flex-col gap-1 text-[9px] font-mono bg-slate-900/90 p-1.5 rounded border border-slate-800/90">
                            <div className="flex items-center justify-between gap-1">
                              <span className="shrink-0 text-slate-400">Prise Data&nbsp;:</span>
                              <span
                                className={`min-w-0 truncate font-sans text-right ${workstation.hasDataPort ? "text-slate-200" : "text-amber-400 italic"}`}
                              >
                                {workstation.connectedPort || "Port Data par défaut"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-slate-850">
                              <span className="shrink-0 text-slate-400">IP Poste&nbsp;:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-cyan-300 font-semibold bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded">
                                  {workstation.ipAddress}
                                </span>
                                <span
                                  className="px-1 py-0.2 rounded border text-[8px] font-mono whitespace-nowrap"
                                  style={{
                                    color: vlanStyles[workstation.vlanId]?.color ?? "#38bdf8",
                                    borderColor: `${vlanStyles[workstation.vlanId]?.color ?? "#38bdf8"}40`,
                                    backgroundColor: `${vlanStyles[workstation.vlanId]?.color ?? "#38bdf8"}15`,
                                  }}
                                >
                                  V{workstation.vlanId} DATA
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Section Téléphone IP dédié à l'utilisateur (VLAN 30) */}
                        <div className="pt-1.5 border-t border-slate-800/80 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="shrink-0 whitespace-nowrap text-slate-400 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-purple-400" />
                              <span>Téléphone IP&nbsp;:</span>
                            </span>
                            <span className="min-w-0 truncate text-purple-300 font-mono font-medium">
                              {ipPhone.phoneNumber}{" "}
                              <span className="text-slate-400 font-sans text-[9px]">
                                (Ext&nbsp;: {ipPhone.extension})
                              </span>
                            </span>
                          </div>

                          {/* Bloc Réseau Téléphone : Prise/Relais VoIP & Adresse IP Phone */}
                          <div className="flex flex-col gap-1 text-[9px] font-mono bg-purple-950/20 p-1.5 rounded border border-purple-900/40">
                            <div className="flex items-center justify-between gap-1">
                              <span className="shrink-0 text-slate-400">Relais&nbsp;:</span>
                              <span
                                className={`min-w-0 truncate font-sans text-right ${ipPhone.hasVoipPort ? "text-purple-200" : "text-amber-400 italic"}`}
                              >
                                {ipPhone.connectedPort || "Port VoIP dédié"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-purple-900/30">
                              <span className="shrink-0 text-slate-400">IP Phone&nbsp;:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-purple-200 font-semibold bg-purple-950/80 border border-purple-700/60 px-1.5 py-0.2 rounded">
                                  {ipPhone.ipAddress}
                                </span>
                                <span
                                  className="px-1 py-0.2 rounded border text-[8px] font-mono whitespace-nowrap"
                                  style={{
                                    color: vlanStyles[ipPhone.vlanId]?.color ?? "#c084fc",
                                    borderColor: `${vlanStyles[ipPhone.vlanId]?.color ?? "#c084fc"}40`,
                                    backgroundColor: `${vlanStyles[ipPhone.vlanId]?.color ?? "#c084fc"}15`,
                                  }}
                                >
                                  V{ipPhone.vlanId} VoIP
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ONGLET 2 : BUREAUX */}
        {/* ========================================================= */}
        {activeTab === "DESKS" && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-slate-400 px-1 flex justify-between">
              <span>{filteredDesks.length} meuble(s) / bureau(x)</span>
            </div>

            {filteredDesks.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">Aucun bureau trouvé.</div>
            ) : (
              filteredDesks.map((desk) => {
                // Trouver les prises liées à ce bureau
                const linkedOutlets = outletNodes.filter(
                  (o) =>
                    o.attachedToDeskId === desk.id ||
                    o.attachedDeskIds?.includes(desk.id) ||
                    o.stackedPorts?.some((p) => p.attachedToDeskId === desk.id)
                );

                // Trouver si un téléphone IP VoIP est présent sur ce bureau
                const voipOutlet = linkedOutlets.find(
                  (o) =>
                    o.outletRole === "VOIP" ||
                    o.vlanId === 30 ||
                    o.stackedPorts?.some((sp) => sp.outletRole === "VOIP" || sp.vlanId === 30)
                );
                const deskVoipIp =
                  voipOutlet?.ipAddress ||
                  voipOutlet?.stackedPorts?.find(
                    (sp) => sp.outletRole === "VOIP" || sp.vlanId === 30
                  )?.ipAddress;

                const seatCount =
                  desk.seats?.length ||
                  (desk.subType === "BENCH_QUAD" ? 4 : desk.subType === "BENCH_DOUBLE" ? 2 : 1);
                const occupiedSeats = desk.seats
                  ? desk.seats.filter((s) => s.fullName && s.fullName.trim() !== "").length
                  : desk.assignedPerson && !desk.assignedPerson.includes("vacant")
                    ? 1
                    : 0;

                // Trouver la zone contenant ce bureau
                const parentZone = zones.find(
                  (z) =>
                    desk.xMm >= z.xMm &&
                    desk.xMm <= z.xMm + z.widthMm &&
                    desk.yMm >= z.yMm &&
                    desk.yMm <= z.yMm + z.heightMm
                );

                return (
                  <div
                    key={desk.id}
                    onClick={() => handleItemClick(desk)}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition flex flex-col gap-1.5 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition">
                          <Monitor className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-100 group-hover:text-indigo-300 transition flex items-center gap-2">
                            <span>{desk.name}</span>
                            {parentZone && (
                              <span
                                className="px-1.5 py-0.2 rounded text-[9px] font-sans font-medium border"
                                style={{
                                  color: parentZone.color,
                                  borderColor: `${parentZone.color}40`,
                                  backgroundColor: `${parentZone.color}15`,
                                }}
                              >
                                {parentZone.name}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {desk.subType === "BENCH_QUAD"
                              ? "Bench 4 Postes"
                              : desk.subType === "BENCH_DOUBLE"
                                ? "Bench 2 Postes"
                                : desk.subType === "MEETING_TABLE"
                                  ? "Table Réunion"
                                  : "Bureau Solo"}
                            {" • "}
                            <span className="text-slate-300 font-mono">
                              {occupiedSeats}/{seatCount} places
                            </span>
                          </div>
                        </div>
                      </div>

                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
                    </div>

                    {/* Liste des occupants par place */}
                    {desk.seats && desk.seats.length > 0 ? (
                      <div className="bg-slate-950/70 rounded p-1.5 border border-slate-800/80 text-[10px] space-y-1">
                        {desk.seats.map((seat, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center justify-between text-slate-300 gap-1"
                          >
                            <span className="shrink-0 whitespace-nowrap text-slate-400 font-mono">
                              <span>{`P${sIdx + 1} (${seat.seatLabel || "Poste"})\u00A0:`}</span>
                            </span>
                            <span
                              className={
                                seat.fullName
                                  ? "min-w-0 truncate text-slate-200 font-medium"
                                  : "min-w-0 truncate text-slate-600 italic"
                              }
                            >
                              {seat.fullName || "Place libre"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : desk.assignedPerson ? (
                      <div className="text-[10px] text-slate-400 flex items-center justify-between bg-slate-950/50 p-1 rounded gap-1">
                        <span className="shrink-0 whitespace-nowrap">Occupant&nbsp;:</span>
                        <span className="min-w-0 truncate text-slate-200 font-medium">
                          {desk.assignedPerson}
                        </span>
                      </div>
                    ) : null}

                    {/* Téléphone IP sur le bureau le cas échéant */}
                    {voipOutlet && (
                      <div className="flex items-center justify-between pt-1 text-[10px] border-t border-slate-800/60 font-mono gap-1">
                        <span className="shrink-0 whitespace-nowrap text-purple-400 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-purple-400" />
                          <span>Téléphone IP&nbsp;:</span>
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="min-w-0 truncate text-purple-300 font-semibold">
                            {deskVoipIp || "10.42.30.xxx"}
                          </span>
                          <span className="shrink-0 px-1 py-0.2 rounded text-[8px] bg-purple-950/80 border border-purple-500/40 text-purple-300">
                            V30 VoIP
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Prises solidaires rattachées */}
                    <div className="flex items-center justify-between pt-1 text-[10px] border-t border-slate-800/60 gap-1">
                      <span className="shrink-0 whitespace-nowrap text-slate-400 flex items-center gap-1">
                        <Plug className="w-3 h-3 text-slate-500" />
                        <span>Prises solidaires&nbsp;:</span>
                      </span>
                      <span className="font-mono text-slate-300 shrink-0">
                        {linkedOutlets.length > 0 ? (
                          <span className="text-emerald-400">
                            {linkedOutlets.length} connectée(s)
                          </span>
                        ) : (
                          <span className="text-amber-500/80">0 liée</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ONGLET 3 : TOUS LES PORTS RJ45 */}
        {/* ========================================================= */}
        {activeTab === "PORTS" && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-slate-400 px-1 flex justify-between">
              <span>{filteredPorts.length} port(s) RJ45 au total</span>
              <span>{filteredPorts.filter((p) => p.isPatched).length} brassé(s)</span>
            </div>

            {filteredPorts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Aucun port ne correspond aux critères.
              </div>
            ) : (
              filteredPorts.map((port) => {
                const vlanStyle = port.vlanId !== undefined ? vlanStyles[port.vlanId] : undefined;

                return (
                  <div
                    key={port.id}
                    onClick={() => handleItemClick(port.parentOutlet)}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 cursor-pointer transition flex flex-col gap-1.5 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center text-sm ${
                            port.isPatched
                              ? "bg-amber-500/15 border-amber-500/30 shadow-sm"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                          title={`Port ${port.portLabel} (${port.outletRole})`}
                        >
                          <span>{port.emote}</span>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 transition flex items-center gap-1.5">
                            {port.parentOutlet.name} • {port.portLabel}
                            {port.isPatched ? (
                              <span title="Port brassé">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              </span>
                            ) : (
                              <span title="Non raccordé">
                                <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Type:{" "}
                            <span className="text-slate-200 font-medium">{port.outletRole}</span>
                            {port.assignedPerson ? ` • ${port.assignedPerson}` : ""}
                          </div>
                        </div>
                      </div>

                      {port.vlanId !== undefined ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono border"
                          style={{
                            color: vlanStyle?.color ?? "#38bdf8",
                            borderColor: `${vlanStyle?.color ?? "#38bdf8"}40`,
                            backgroundColor: `${vlanStyle?.color ?? "#38bdf8"}15`,
                          }}
                        >
                          VLAN {port.vlanId}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono border border-slate-700 bg-slate-800 text-slate-400">
                          Passif (Non raccordé)
                        </span>
                      )}
                    </div>

                    {/* Brassage Baie / Switch / Port */}
                    <div className="bg-slate-950/70 rounded p-1.5 border border-slate-800/80 text-[10px] flex items-center justify-between font-mono gap-1">
                      <span className="shrink-0 whitespace-nowrap text-slate-400">
                        Raccordement&nbsp;:
                      </span>
                      {port.isPatched && port.connectedSwitchPort ? (
                        <span className="min-w-0 truncate text-emerald-400 font-medium">
                          {port.connectedRackId || "BAIE"} ➔ {port.connectedSwitchId || "SW"} / Port{" "}
                          {port.connectedSwitchPort}
                        </span>
                      ) : (
                        <span className="min-w-0 truncate text-slate-500 italic">
                          Non brassé au switch
                        </span>
                      )}
                    </div>

                    {/* IP & MAC le cas échéant */}
                    {(port.ipAddress || port.macAddress) && (
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 gap-1">
                        <span className="shrink-0 whitespace-nowrap">
                          IP:&nbsp;{port.ipAddress || "DHCP"}
                        </span>
                        <span className="shrink-0 whitespace-nowrap">
                          MAC:&nbsp;{port.macAddress || "--:--"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ONGLET 4 : ÉQUIPEMENTS & PÉRIPHÉRIQUES */}
        {/* ========================================================= */}
        {activeTab === "DEVICES" && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-slate-400 px-1 flex justify-between">
              <span>{filteredDevices.length} équipement(s)</span>
            </div>

            {filteredDevices.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Aucun équipement ne correspond aux filtres.
              </div>
            ) : (
              filteredDevices.map((node) => {
                const isPrinter =
                  node.outletRole === "PRINTER" || node.subType === "PRINTER_STATION";
                const isWifi = node.outletRole === "WIFI" || node.subType === "WIFI_AP";
                const isCamera = node.outletRole === "CAMERA" || node.subType === "CAMERA_IP";

                return (
                  <div
                    key={node.id}
                    onClick={() => handleItemClick(node)}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition flex flex-col gap-1.5 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                            isPrinter
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                              : isWifi
                                ? "bg-sky-500/15 border-sky-500/30 text-sky-400"
                                : isCamera
                                  ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                                  : "bg-purple-500/15 border-purple-500/30 text-purple-400"
                          }`}
                        >
                          {isPrinter ? (
                            <Printer className="w-4 h-4" />
                          ) : isWifi ? (
                            <Wifi className="w-4 h-4" />
                          ) : isCamera ? (
                            <Camera className="w-4 h-4" />
                          ) : (
                            <Cpu className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition">
                            {node.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isPrinter
                              ? "Imprimante Réseau / MFP"
                              : isWifi
                                ? "Borne Wi-Fi Haute Densité"
                                : isCamera
                                  ? "Caméra de Surveillance IP"
                                  : node.description || "Périphérique IT"}
                          </div>
                        </div>
                      </div>

                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition" />
                    </div>

                    <div className="bg-slate-950/70 rounded p-1.5 border border-slate-800/80 text-[10px] flex items-center justify-between font-mono gap-1">
                      <span className="shrink-0 whitespace-nowrap text-slate-400">
                        IP / Statut&nbsp;:
                      </span>
                      <span className="min-w-0 truncate text-cyan-400">
                        {node.ipAddress ||
                          (isWifi ? "192.168.10.25" : isPrinter ? "192.168.20.150" : "DHCP")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ONGLET 5 : INFRASTRUCTURE & BAIES */}
        {/* ========================================================= */}
        {activeTab === "INFRA" && (
          <div className="space-y-3">
            <div className="text-[10px] font-mono text-slate-400 px-1">
              {infraMetrics.length} baie(s) dans le local technique
            </div>

            {infraMetrics.map(({ rack, totalU, occupiedU, totalSwitchPorts, usedSwitchPorts }) => {
              const occupancyPercent = Math.round((occupiedU / totalU) * 100);
              const switchPortPercent =
                totalSwitchPorts > 0 ? Math.round((usedSwitchPorts / totalSwitchPorts) * 100) : 0;

              // Chercher le nœud correspondant sur le canvas
              const rackNode = nodes.find((n) => n.id === rack.id) || {
                id: rack.id,
                name: rack.name,
                type: "PATCH_PANEL" as const,
                xMm: rack.xMm,
                yMm: rack.yMm,
                widthMm: rack.widthMm,
                heightMm: rack.depthMm,
              };

              return (
                <div
                  key={rack.id}
                  className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          {rack.name}
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {totalU}U
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Local Technique • {rack.widthMm}×{rack.depthMm} mm
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleItemClick(rackNode)}
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-purple-400 rounded transition"
                      title="Localiser la baie sur le plan"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Jauges d'occupation */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-950/70 p-2 rounded border border-slate-800">
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Hauteur U</span>
                        <span className="font-mono text-slate-200">
                          {occupiedU}/{totalU}U ({occupancyPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, occupancyPercent)}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-950/70 p-2 rounded border border-slate-800">
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Ports Switchs</span>
                        <span className="font-mono text-slate-200">
                          {usedSwitchPorts}/{totalSwitchPorts} ({switchPortPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, switchPortPercent)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Liste des équipements raqués */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Modules & Équipements ({rack.devices?.length ?? 0})
                    </span>
                    <div className="bg-slate-950/60 rounded border border-slate-800 divide-y divide-slate-850 text-[10px] font-mono">
                      {(rack.devices ?? []).map((dev) => (
                        <div
                          key={dev.id}
                          className="p-1.5 flex items-center justify-between hover:bg-slate-900 transition"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">U{dev.slotU}</span>
                            <span className="text-slate-200 font-sans font-medium">{dev.name}</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {dev.deviceType} ({dev.uSize ?? 1}U)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
