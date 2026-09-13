/**
 * NetFloor Architect - Moteur de Profils Réseau & Règle d'Héritage Switch Port
 *
 * Vision Métier :
 * Une prise murale ou de sol RJ45 est un élément passif (cuivre Cat6A).
 * Elle n'a ni VLAN ni PoE intrinsèque.
 * Lorsqu'elle est branchée sur un port de commutateur actif, elle hérite
 * dynamiquement de l'identité de ce port (VLAN, PoE, Rôle, Débit).
 * Lorsqu'elle est débranchée, elle redevient passive/générique.
 *
 * Règle d'exclusivité stricte : Un port de switch ne peut alimenter qu'une seule prise à la fois (1:1).
 */

import {
  NodeDisplay,
  RackDisplay,
  RackDeviceItem,
  OutletRole,
} from "@/components/canvas/EquipmentLayer";

export interface SwitchPortProfile {
  portName: string; // ex: "Gi1/0/1"
  vlanId: number;
  vlanName: string;
  poeEnabled: boolean;
  poePowerW: number;
  role: OutletRole;
  speed: "1G" | "10G" | "2.5G";
}

export interface EffectiveOutletNetwork {
  isPatched: boolean;
  rackName?: string | undefined;
  switchName?: string | undefined;
  portName?: string | undefined;
  vlanId?: number | undefined;
  vlanName?: string | undefined;
  profileName?: string | undefined;
  poeEnabled: boolean;
  poePowerW: number;
  poeMode?: string | undefined;
  role: OutletRole;
  outletRole?: OutletRole | undefined;
  speed?: string | undefined;
  statusText: string;
}

/**
 * Détermine le profil réseau d'un port de commutateur donné
 */
export function getSwitchPortProfile(
  switchDevice: RackDeviceItem | undefined,
  portName: string
): SwitchPortProfile {
  // Extraction du numéro de port (ex: "Gi1/0/14" -> 14)
  const match = portName.match(/(\d+)$/);
  const portNum = match ? parseInt(match[1]!, 10) : 1;

  // Profils standards selon le numéro de port et le type de commutateur
  const isPoeSwitch =
    switchDevice?.model?.toLowerCase().includes("poe") ||
    switchDevice?.name.toLowerCase().includes("hp") ||
    switchDevice?.name.toLowerCase().includes("24p") ||
    (switchDevice?.poeBudgetW ?? 0) > 0;

  // Ports 17 à 20 : Réservés Téléphonie IP / VoIP
  if (portNum >= 17 && portNum <= 20) {
    return {
      portName,
      vlanId: 30,
      vlanName: "VLAN_VOIP_TELEPHONY",
      poeEnabled: true,
      poePowerW: 15.4, // 802.3af standard VoIP phone
      role: "VOIP",
      speed: "1G",
    };
  }

  // Ports 21 et 22 : Bornes Wi-Fi Haut Débit
  if (portNum >= 21 && portNum <= 22) {
    return {
      portName,
      vlanId: 50,
      vlanName: "VLAN_WIFI_INFRA",
      poeEnabled: true,
      poePowerW: 30.0, // 802.3at PoE+ pour Wi-Fi 6/7
      role: "WIFI",
      speed: "2.5G",
    };
  }

  // Ports 23 et 24 : Impression Réseau / Périphériques
  if (portNum >= 23 && portNum <= 24) {
    return {
      portName,
      vlanId: 40,
      vlanName: "VLAN_PRINTERS",
      poeEnabled: false,
      poePowerW: 0,
      role: "PRINTER",
      speed: "1G",
    };
  }

  // Ports 1 à 16 : Données Postes de Travail (Bureaux & Collaborateurs)
  return {
    portName,
    vlanId: 20,
    vlanName: "VLAN_CORP_DATA",
    poeEnabled: isPoeSwitch,
    poePowerW: isPoeSwitch ? 15.4 : 0,
    role: "DATA",
    speed: "1G",
  };
}

/**
 * Résout dynamiquement l'état réseau effectif d'une prise murale ou de sol
 * par héritage strict depuis le commutateur auquel elle est raccordée.
 */
export function resolveEffectiveOutletNetwork(
  outlet: NodeDisplay,
  racksOrSwitches: RackDisplay[] | RackDeviceItem[] = []
): EffectiveOutletNetwork {
  if (!outlet.isPatched || !outlet.connectedRackId || !outlet.connectedSwitchPort) {
    // Prise débranchée / passive : aucun VLAN ni PoE actif
    return {
      isPatched: false,
      role: "GENERIC",
      outletRole: "GENERIC",
      poeEnabled: false,
      poePowerW: 0,
      poeMode: "NONE",
      statusText: "Prise RJ45 Passive Cat6A (Non raccordée)",
    };
  }

  // Supporte indifféremment une liste de baies ou directement une liste de switches
  let rack: RackDisplay | undefined;
  let targetSwitch: RackDeviceItem | undefined;

  const firstItem = racksOrSwitches[0];
  if (firstItem && "deviceType" in firstItem) {
    // Il s'agit d'une liste directe de switches (RackDeviceItem[])
    const switches = (racksOrSwitches as RackDeviceItem[]).filter((d) => d.deviceType === "SWITCH");
    targetSwitch = switches.find((s) => s.id === outlet.connectedSwitchId) ?? switches[0];
  } else {
    // Il s'agit d'une liste de baies (RackDisplay[])
    const racks = racksOrSwitches as RackDisplay[];
    rack = racks.find((r) => r.id === outlet.connectedRackId);
    const switches = (rack?.devices ?? []).filter((d) => d.deviceType === "SWITCH");
    targetSwitch =
      switches.find((s) => s.id === outlet.connectedSwitchId) ?? switches[0] ?? undefined;
  }

  const profile = getSwitchPortProfile(targetSwitch, outlet.connectedSwitchPort);
  const poeMode = profile.poeEnabled ? (profile.poePowerW >= 30 ? "POE_PLUS" : "POE") : "NONE";

  return {
    isPatched: true,
    ...(rack ? { rackName: rack.name } : {}),
    ...(targetSwitch ? { switchName: targetSwitch.name } : {}),
    portName: outlet.connectedSwitchPort,
    vlanId: profile.vlanId,
    vlanName: profile.vlanName,
    profileName: profile.vlanName,
    poeEnabled: profile.poeEnabled,
    poePowerW: profile.poePowerW,
    poeMode,
    role: profile.role,
    outletRole: profile.role,
    speed: profile.speed,
    statusText: `Brassé sur ${rack?.name ?? "Baie"} > ${targetSwitch?.name ?? "Switch"} [${outlet.connectedSwitchPort}] (VLAN ${profile.vlanId} - ${profile.vlanName}${profile.poeEnabled ? ` • PoE ${profile.poePowerW}W` : ""})`,
  };
}

/**
 * Vérifie si un port de switch spécifique est déjà occupé par une autre prise
 * Règle stricte anti-collision (1:1)
 */
export function isSwitchPortOccupied(
  rackId: string,
  switchId: string,
  portName: string,
  allNodes: NodeDisplay[],
  excludeOutletId?: string
): boolean {
  for (const node of allNodes) {
    if (node.type !== "WALL_OUTLET") continue;
    if (excludeOutletId && node.id === excludeOutletId) continue;

    if (node.stackedPorts && node.stackedPorts.length > 0) {
      for (const sp of node.stackedPorts) {
        if (
          sp.isPatched &&
          sp.connectedSwitchPort === portName &&
          (sp.connectedRackId || node.connectedRackId) === rackId &&
          (sp.connectedSwitchId || "sw-default") === switchId
        ) {
          return true;
        }
      }
    } else if (
      node.isPatched &&
      node.connectedSwitchPort === portName &&
      node.connectedRackId === rackId &&
      (node.connectedSwitchId || "sw-default") === switchId
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Retourne la liste des ports disponibles pour un switch donné avec leurs profils héritables
 */
export function getAvailableSwitchPorts(
  rack: RackDisplay,
  switchId: string | undefined,
  allNodes: NodeDisplay[]
): { portName: string; profile: SwitchPortProfile }[] {
  const switches = (rack.devices ?? []).filter((d) => d.deviceType === "SWITCH");
  const targetSwitch = switchId ? switches.find((s) => s.id === switchId) : switches[0];
  if (!targetSwitch) return [];

  const totalPorts = targetSwitch.portsCount ?? 24;
  const available: { portName: string; profile: SwitchPortProfile }[] = [];

  for (let i = 1; i <= totalPorts; i++) {
    const portName = `Gi1/0/${i}`;
    const occupied = isSwitchPortOccupied(rack.id, targetSwitch.id, portName, allNodes);
    if (!occupied) {
      available.push({
        portName,
        profile: getSwitchPortProfile(targetSwitch, portName),
      });
    }
  }

  return available;
}
