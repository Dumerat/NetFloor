import { TopologyDiffItem, TopologyLink, RawHostProbe, DiscoveredDeviceType } from "./types";

export interface DatabaseNodeSummary {
  id: string;
  name: string;
  type: string;
  ipAddress?: string | undefined;
  macAddress?: string | undefined;
  connectedSwitchId?: string | undefined;
  connectedSwitchPort?: string | undefined;
  isLocked?: boolean | undefined;
}

export interface DatabaseCableSummary {
  id: string;
  sourceNodeId: string;
  sourcePortName: string;
  targetNodeId: string;
  targetPortName?: string | undefined;
  isLocked?: boolean | undefined;
}

/**
 * Compare la topologie réseau réelle découverte avec l'état actuellement enregistré
 * dans le jumeau numérique NetFloor pour générer les propositions de réconciliation.
 */
export function detectTopologyDrift(
  discoveredHosts: Array<RawHostProbe & { deviceType?: DiscoveredDeviceType | undefined }>,
  discoveredLinks: TopologyLink[],
  existingNodes: DatabaseNodeSummary[],
  _existingCables: DatabaseCableSummary[] = []
): TopologyDiffItem[] {
  const diffs: TopologyDiffItem[] = [];

  const nodeByMac = new Map<string, DatabaseNodeSummary>();
  const nodeByIp = new Map<string, DatabaseNodeSummary>();

  existingNodes.forEach((n) => {
    if (n.macAddress) nodeByMac.set(n.macAddress.toUpperCase(), n);
    if (n.ipAddress) nodeByIp.set(n.ipAddress, n);
  });

  // 1. Détecter les conflits d'IP (même IP sur deux MACs distinctes)
  const ipOccurrences = new Map<string, string[]>();
  discoveredHosts.forEach((h) => {
    if (h.mac && h.ip && h.ip !== "0.0.0.0") {
      const list = ipOccurrences.get(h.ip) || [];
      list.push(h.mac);
      ipOccurrences.set(h.ip, list);
    }
  });

  ipOccurrences.forEach((macs, ip) => {
    if (macs.length > 1) {
      diffs.push({
        id: `diff-conflict-${ip}`,
        type: "IP_CONFLICT",
        severity: "CRITICAL",
        title: `Conflit d'adresse IP sur ${ip}`,
        description: `L'adresse IP ${ip} répond simultanément sur ${macs.length} adresses MAC distinctes (${macs.join(", ")}). Risque de collision réseau majeure.`,
        deviceIp: ip,
        deviceMac: macs[0]!,
        proposedAction: "RESOLVE_CONFLICT",
        payload: {
          switchPort: undefined,
        },
      });
    }
  });

  // 2. Détecter les nouveaux équipements découverts et les migrations de ports
  for (const host of discoveredHosts) {
    if (!host.mac) continue;

    const matchedNode = nodeByMac.get(host.mac.toUpperCase());
    const hostLink = discoveredLinks.find(
      (l) => l.targetDeviceId === `dev-${host.mac!.replace(/:/g, "")}`
    );

    // Cas A : Équipement absent du plan
    if (!matchedNode) {
      diffs.push({
        id: `diff-new-${host.mac}`,
        type: "NEW_DEVICE",
        severity: "INFO",
        title: `Nouvel équipement découvert : ${host.hostname || host.vendor || host.ip}`,
        description: `L'équipement (${host.mac}, IP: ${host.ip}) a été détecté${hostLink ? ` raccordé sur ${hostLink.sourceDeviceName} [${hostLink.sourcePortName}]` : ""}. Il n'est pas encore présent sur le plan.`,
        deviceIp: host.ip,
        deviceMac: host.mac,
        proposedAction: "CREATE_NODE",
        payload: {
          deviceType: host.deviceType,
          switchId: hostLink?.sourceDeviceId,
          switchPort: hostLink?.sourcePortName,
          vlanId: hostLink?.vlanId,
        },
      });
    } else {
      // Cas B : Équipement connu sur le plan -> Vérifier si son port de brassage a bougé
      if (hostLink && matchedNode.connectedSwitchPort) {
        const isSamePort =
          matchedNode.connectedSwitchPort.toLowerCase() === hostLink.sourcePortName.toLowerCase();

        if (!isSamePort) {
          const isLocked = Boolean(matchedNode.isLocked);
          diffs.push({
            id: `diff-moved-${host.mac}`,
            type: "PORT_MIGRATED",
            severity: isLocked ? "CRITICAL" : "WARNING",
            title: isLocked
              ? `⚠️ Alerte : Liaison verrouillée déplacée pour ${matchedNode.name}`
              : `Déplacement physique détecté : ${matchedNode.name}`,
            description: `Le terminal était enregistré sur [${matchedNode.connectedSwitchPort}], mais la table FDB le localise désormais sur ${hostLink.sourceDeviceName} [${hostLink.sourcePortName}].${isLocked ? " ATTENTION : Cette liaison était marquée VERROUILLÉE." : ""}`,
            deviceIp: host.ip,
            deviceMac: host.mac,
            proposedAction: "MOVE_CABLE",
            payload: {
              nodeId: matchedNode.id,
              switchId: hostLink.sourceDeviceId,
              switchPort: hostLink.sourcePortName,
              oldSwitchPort: matchedNode.connectedSwitchPort,
              vlanId: hostLink.vlanId,
            },
          });
        }
      } else if (hostLink && !matchedNode.connectedSwitchPort) {
        // Cas C : Équipement sur le plan sans port de switch associé -> Nouvelle liaison
        diffs.push({
          id: `diff-link-${host.mac}`,
          type: "NEW_CONNECTION",
          severity: "INFO",
          title: `Liaison détectée pour ${matchedNode.name}`,
          description: `Le commutateur ${hostLink.sourceDeviceName} a appris la MAC de ${matchedNode.name} sur le port [${hostLink.sourcePortName}].`,
          deviceIp: host.ip,
          deviceMac: host.mac,
          proposedAction: "CREATE_CABLE",
          payload: {
            nodeId: matchedNode.id,
            switchId: hostLink.sourceDeviceId,
            switchPort: hostLink.sourcePortName,
            vlanId: hostLink.vlanId,
          },
        });
      }
    }
  }

  // 3. Détecter les équipements du plan devenus hors-ligne
  const discoveredMacSet = new Set(
    discoveredHosts.map((h) => h.mac?.toUpperCase()).filter(Boolean)
  );

  for (const node of existingNodes) {
    if (
      node.macAddress &&
      !discoveredMacSet.has(node.macAddress.toUpperCase()) &&
      node.type !== "WALL_OUTLET" &&
      node.type !== "PATCH_PANEL" &&
      node.type !== "DESK"
    ) {
      diffs.push({
        id: `diff-offline-${node.id}`,
        type: "DEVICE_OFFLINE",
        severity: "INFO",
        title: `Équipement non joignable : ${node.name}`,
        description: `L'équipement ${node.name} (IP: ${node.ipAddress || "N/A"}, MAC: ${node.macAddress}) n'a émis aucun trafic lors de ce balayage.`,
        deviceIp: node.ipAddress || "0.0.0.0",
        deviceMac: node.macAddress,
        proposedAction: "MARK_OFFLINE",
        payload: {
          nodeId: node.id,
        },
      });
    }
  }

  return diffs;
}
