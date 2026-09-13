/**
 * NetFloor Architect - Moteur de Câblage Automatique Orthogonal (« Auto-Route to Rack »)
 * Raccorde automatiquement une sélection de prises RJ45 vers les commutateurs / panneaux de brassage
 * d'une baie cible, avec calcul d'un tracé orthogonal strict à 90° et faisceau ruban partagé.
 */

import { NodeDisplay, RackDisplay, RackDeviceItem } from "@/components/canvas/EquipmentLayer";
import { getSwitchPortProfile } from "./networkProfiles";

export interface AutoRouteParams {
  /** Liste d'identifiants de prises ou de nœuds à raccorder */
  portIds: string[];
  /** Identifiant de la baie informatique cible (ex: "rack-01") */
  rackId: string;
  /** Identifiant du commutateur spécifique sélectionné (optionnel) */
  switchId?: string | undefined;
  /** Tous les nœuds du canevas */
  allNodes: NodeDisplay[];
  /** Toutes les baies informatiques */
  racks: RackDisplay[];
  /** Pivots personnalisés existants */
  customPivots?: Record<string, { x: number; y: number }> | undefined;
}

export interface AutoRouteResult {
  /** Nœuds mis à jour avec les nouveaux brassages */
  updatedNodes: NodeDisplay[];
  /** Nouveaux pivots Konva orthogonaux pour le faisceau */
  updatedCustomPivots: Record<string, { x: number; y: number }>;
  /** Nombre de prises raccordées avec succès */
  routedCount: number;
  /** Liste détaillée des affectations */
  assignments: {
    nodeId: string;
    nodeName: string;
    rackName: string;
    switchName: string;
    switchPort: string;
    vlanId: number;
    poe: string;
  }[];
}

export interface RackPortAvailability {
  rackId: string;
  rackName: string;
  totalPorts: number;
  occupiedPorts: number;
  freePorts: number;
}

/**
 * Calcule la disponibilité des ports de switchs pour chaque baie
 */
export function getRackPortAvailability(
  racks: RackDisplay[],
  allNodes: NodeDisplay[]
): RackPortAvailability[] {
  // Recensement des ports occupés par clé `${rackId}::${switchId}::${portName}`
  const occupiedSet = new Set<string>();

  allNodes.forEach((node) => {
    if (node.type !== "WALL_OUTLET") return;

    if (node.stackedPorts && node.stackedPorts.length > 0) {
      node.stackedPorts.forEach((sp) => {
        if (sp.isPatched && sp.connectedSwitchPort) {
          const rId = sp.connectedRackId || node.connectedRackId || "rack-01";
          const swId = sp.connectedSwitchId || "sw-default";
          occupiedSet.add(`${rId}::${swId}::${sp.connectedSwitchPort}`);
        }
      });
    } else if (node.isPatched && node.connectedSwitchPort) {
      const rId = node.connectedRackId || "rack-01";
      const swId = node.connectedSwitchId || "sw-default";
      occupiedSet.add(`${rId}::${swId}::${node.connectedSwitchPort}`);
    }
  });

  return racks.map((rack) => {
    const switches = (rack.devices ?? []).filter((d) => d.deviceType === "SWITCH");
    let totalPorts = 0;
    let occupiedInRack = 0;

    if (switches.length === 0) {
      // Baie sans switch explicite : estimation d'un switch standard 24 ports
      totalPorts = 24;
      for (let i = 1; i <= 24; i++) {
        if (occupiedSet.has(`${rack.id}::sw-default::Gi1/0/${i}`)) {
          occupiedInRack++;
        }
      }
    } else {
      switches.forEach((sw) => {
        const pCount = sw.portsCount ?? 24;
        totalPorts += pCount;
        for (let i = 1; i <= pCount; i++) {
          if (occupiedSet.has(`${rack.id}::${sw.id}::Gi1/0/${i}`)) {
            occupiedInRack++;
          }
        }
      });
    }

    return {
      rackId: rack.id,
      rackName: rack.name,
      totalPorts,
      occupiedPorts: occupiedInRack,
      freePorts: Math.max(0, totalPorts - occupiedInRack),
    };
  });
}

/**
 * Exécute l'auto-brassage orthogonal vers la baie cible
 */
export function autoRoutePortsToRack({
  portIds,
  rackId,
  switchId,
  allNodes,
  racks,
  customPivots = {},
}: AutoRouteParams): AutoRouteResult {
  const targetRack = racks.find((r) => r.id === rackId) ?? racks[0];
  if (!targetRack) {
    return {
      updatedNodes: allNodes,
      updatedCustomPivots: { ...customPivots },
      routedCount: 0,
      assignments: [],
    };
  }

  // 1. Lister les commutateurs de la baie
  const targetRackId = targetRack.id;
  const targetRackName = targetRack.name;
  const switches = (targetRack.devices ?? []).filter((d) => d.deviceType === "SWITCH");
  const fallbackSwitch: RackDeviceItem = {
    id: `dev-${targetRackId}-sw-01`,
    name: `SW-${targetRackName}-01`,
    slotU: 24,
    uSize: 1,
    deviceType: "SWITCH",
    brand: "GENERIC",
    status: "ONLINE",
    portsCount: 24,
  };
  const rawSwitches = switches.length > 0 ? switches : [fallbackSwitch];
  const activeSwitches = switchId
    ? [
        ...rawSwitches.filter((s) => s.id === switchId),
        ...rawSwitches.filter((s) => s.id !== switchId),
      ]
    : rawSwitches;

  // 2. Recenser tous les ports déjà occupés
  const occupiedKeys = new Set<string>();
  allNodes.forEach((node) => {
    if (node.type !== "WALL_OUTLET") return;

    if (node.stackedPorts && node.stackedPorts.length > 0) {
      node.stackedPorts.forEach((sp) => {
        if (sp.isPatched && sp.connectedSwitchPort) {
          const rId = sp.connectedRackId || node.connectedRackId || "rack-01";
          const swId = sp.connectedSwitchId || "sw-default";
          occupiedKeys.add(`${rId}::${swId}::${sp.connectedSwitchPort}`);
        }
      });
    } else if (node.isPatched && node.connectedSwitchPort) {
      const rId = node.connectedRackId || "rack-01";
      const swId = node.connectedSwitchId || "sw-default";
      occupiedKeys.add(`${rId}::${swId}::${node.connectedSwitchPort}`);
    }
  });

  // 3. Identifier les prises cibles (soit par ID direct, soit prises rattachées au meuble sélectionné)
  const targetPortIdSet = new Set(portIds);
  const outletsToRoute: NodeDisplay[] = [];

  allNodes.forEach((node) => {
    if (node.type === "WALL_OUTLET") {
      if (
        targetPortIdSet.has(node.id) ||
        (node.portId && targetPortIdSet.has(node.portId)) ||
        (node.attachedToDeskId && targetPortIdSet.has(node.attachedToDeskId))
      ) {
        outletsToRoute.push(node);
      }
    }
  });

  if (outletsToRoute.length === 0) {
    return {
      updatedNodes: allNodes,
      updatedCustomPivots: { ...customPivots },
      routedCount: 0,
      assignments: [],
    };
  }

  // 4. Attribution des ports libres
  const assignments: AutoRouteResult["assignments"] = [];
  const assignedNodesMap = new Map<string, NodeDisplay>();
  let currentSwitchIdx = 0;
  let currentPortNum = 1;

  function getNextFreePort(): { switchItem: RackDeviceItem; portName: string } {
    while (currentSwitchIdx < activeSwitches.length) {
      const sw = activeSwitches[currentSwitchIdx]!;
      const totalP = sw.portsCount ?? 24;

      while (currentPortNum <= totalP) {
        const portName = `Gi1/0/${currentPortNum}`;
        const key = `${targetRackId}::${sw.id}::${portName}`;
        currentPortNum++;

        if (!occupiedKeys.has(key)) {
          occupiedKeys.add(key);
          return { switchItem: sw, portName };
        }
      }

      currentSwitchIdx++;
      currentPortNum = 1;
    }

    // Si tous les ports sont épuisés, extension dynamique sur le dernier switch
    const lastSw = activeSwitches[activeSwitches.length - 1]!;
    const extPort = `Gi1/0/${currentPortNum++}`;
    return { switchItem: lastSw, portName: extPort };
  }

  // Mettre à jour les nœuds avec les ports attribués
  outletsToRoute.forEach((outlet) => {
    const { switchItem, portName } = getNextFreePort();
    const profile = getSwitchPortProfile(switchItem, portName);

    const updatedOutlet: NodeDisplay = {
      ...outlet,
      isPatched: true,
      connectedRackId: targetRackId,
      connectedSwitchId: switchItem.id,
      connectedSwitchPort: portName,
      vlanId: profile.vlanId,
      outletRole: profile.role,
      pingStatus: "ONLINE",
    };

    assignedNodesMap.set(outlet.id, updatedOutlet);
    assignments.push({
      nodeId: outlet.id,
      nodeName: outlet.name,
      rackName: targetRackName,
      switchName: switchItem.name,
      switchPort: portName,
      vlanId: profile.vlanId,
      poe: profile.poeEnabled ? `${profile.poePowerW}W (PoE)` : "Non",
    });
  });

  // 5. Calcul géométrique du tracé orthogonal à 90° et du faisceau commun
  // Calcul du barycentre (centre géométrique) de toutes les prises raccordées
  const avgOutletX = outletsToRoute.reduce((sum, o) => sum + o.xMm, 0) / outletsToRoute.length;

  const rackCenterPos = {
    x: targetRack.xMm + (targetRack.widthMm ?? 800) / 2,
    y: targetRack.yMm + (targetRack.depthMm ?? 800) / 2,
  };

  // Tracé orthogonal à 90° :
  // Le câble part des prises, monte/descend vers l'axe de goulotte/couloir principal le plus proche,
  // puis chemine horizontalement vers l'axe de la baie.
  // Pivot orthogonal partagé pour le faisceau (ribbon bundle) :
  const sharedBundlePivot = {
    x: avgOutletX,
    y: rackCenterPos.y,
  };

  const newPivots: Record<string, { x: number; y: number }> = { ...customPivots };

  outletsToRoute.forEach((outlet) => {
    const bundleKey = `bundle-${outlet.id}-${targetRack.id}`;
    const singleCableKey = `cable-run-${outlet.id}`;
    newPivots[bundleKey] = sharedBundlePivot;
    newPivots[singleCableKey] = sharedBundlePivot;
  });

  // Construction de la nouvelle liste atomique des nœuds
  const updatedNodes = allNodes.map((node) => {
    return assignedNodesMap.get(node.id) ?? node;
  });

  return {
    updatedNodes,
    updatedCustomPivots: newPivots,
    routedCount: assignments.length,
    assignments,
  };
}
