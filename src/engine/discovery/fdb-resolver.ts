import {
  DiscoveredSwitch,
  FdbEntry,
  RawHostProbe,
  TopologyLink,
  ScanOptions,
  DiscoveredDeviceType,
} from "./types";
import { snmpSubtreePromise } from "./snmp-crawler";
import { lookupOui } from "./oui-database";
import snmp from "net-snmp";

/**
 * Convertit un suffixe d'OID SNMP de 6 nombres décimaux en adresse MAC hexadécimale standard.
 * Ex: [0, 26, 161, 1, 2, 3] -> "00:1A:A1:01:02:03"
 */
export function oidSuffixToMac(octets: number[]): string {
  return octets
    .slice(-6)
    .map((o) => (o || 0).toString(16).padStart(2, "0").toUpperCase())
    .join(":");
}

/**
 * Extrait la table Bridge FDB (Forwarding Database) standard et Q-BRIDGE multi-VLAN d'un switch.
 */
export async function extractSwitchFdb(host: string, options: ScanOptions): Promise<FdbEntry[]> {
  const version = options.snmpVersion === "v1" ? 0 : 1;
  const community = options.snmpCommunity || "public";
  const port = options.snmpPort || 161;

  const session = snmp.createSession(host, community, {
    port,
    version,
    timeout: options.pingTimeoutMs || 1500,
    retries: 1,
  });

  const fdbEntries: FdbEntry[] = [];

  try {
    // 1. Table de correspondance BridgePortNumber <-> ifIndex physique
    // 1.3.6.1.2.1.17.1.4.1.2 = dot1dBasePortIfIndex
    const bridgeToIfMap = new Map<number, number>();
    try {
      const basePorts = await snmpSubtreePromise(session, "1.3.6.1.2.1.17.1.4.1.2");
      for (const vb of basePorts) {
        const parts = vb.oid.split(".");
        const bPort = parseInt(parts[parts.length - 1], 10);
        const ifIdx = Number(vb.value);
        if (!isNaN(bPort) && !isNaN(ifIdx)) {
          bridgeToIfMap.set(bPort, ifIdx);
        }
      }
    } catch {
      // Si non supporté, bridgePort = ifIndex par défaut
    }

    // 2. Table FDB standard MIB-Bridge (RFC 1493 dot1dTpFdbPort)
    // 1.3.6.1.2.1.17.4.3.1.2 = dot1dTpFdbPort
    try {
      const dot1dVbs = await snmpSubtreePromise(session, "1.3.6.1.2.1.17.4.3.1.2");
      for (const vb of dot1dVbs) {
        const suffix = vb.oid.replace("1.3.6.1.2.1.17.4.3.1.2.", "");
        const octets = suffix.split(".").map(Number);
        if (octets.length >= 6) {
          const mac = oidSuffixToMac(octets);
          const bPort = Number(vb.value);
          const ifIdx = bridgeToIfMap.get(bPort) || bPort;

          fdbEntries.push({
            macAddress: mac,
            bridgePort: bPort,
            ifIndex: ifIdx,
            portName: `Port-${ifIdx}`,
            status: "learned",
          });
        }
      }
    } catch {
      // Ignorer si échec
    }

    // 3. Table Q-BRIDGE multi-VLAN (RFC 2674 dot1qTpFdbPort)
    // 1.3.6.1.2.1.17.7.1.2.2.1.2 = dot1qTpFdbPort (VLAN . MAC_6_OCTETS)
    try {
      const dot1qVbs = await snmpSubtreePromise(session, "1.3.6.1.2.1.17.7.1.2.2.1.2");
      for (const vb of dot1qVbs) {
        const suffix = vb.oid.replace("1.3.6.1.2.1.17.7.1.2.2.1.2.", "");
        const parts = suffix.split(".").map(Number);
        if (parts.length >= 7) {
          const vlanId = parts[0];
          const mac = oidSuffixToMac(parts.slice(1));
          const bPort = Number(vb.value);
          const ifIdx = bridgeToIfMap.get(bPort) || bPort;

          // Mettre à jour ou ajouter avec le VLAN
          const existing = fdbEntries.find((f) => f.macAddress === mac);
          if (existing) {
            existing.vlanId = vlanId;
          } else {
            fdbEntries.push({
              macAddress: mac,
              bridgePort: bPort,
              ifIndex: ifIdx,
              portName: `Port-${ifIdx}`,
              vlanId,
              status: "learned",
            });
          }
        }
      }
    } catch {
      // Ignorer
    }

    session.close();
    return fdbEntries;
  } catch {
    session.close();
    return [];
  }
}

/**
 * Algorithme de résolution d'attachement des extrémités (Passe 3) :
 * - Élimine les ports de backbone/uplink (LLDP, CDP ou multi-MACs élevés).
 * - Identifie le port de connexion direct de chaque équipement.
 * - Gère les téléphones VoIP avec PC cascaded (Daisy-chain).
 * - Gère les bornes Wi-Fi avec clients sans-fil associés.
 * - Gère les mini-switches non administrables.
 */
export function resolveAttachmentPoints(
  switches: DiscoveredSwitch[],
  rawHosts: RawHostProbe[]
): {
  links: TopologyLink[];
  updatedHosts: Array<RawHostProbe & { deviceType: DiscoveredDeviceType }>;
} {
  const links: TopologyLink[] = [];
  const hostMap = new Map<string, RawHostProbe>();
  rawHosts.forEach((h) => {
    if (h.mac) hostMap.set(h.mac, h);
  });

  const updatedHosts: Array<RawHostProbe & { deviceType: DiscoveredDeviceType }> = [];

  for (const sw of switches) {
    // 1. Élaguer les ports d'interconnexion (LLDP / CDP / Backbone)
    const uplinkPorts = new Set<string>();
    sw.lldpNeighbors.forEach((n) => uplinkPorts.add(n.localPortName));
    sw.cdpNeighbors.forEach((n) => uplinkPorts.add(n.localPortName));

    // Regrouper les entrées FDB par port de switch
    const portMacsMap = new Map<string, FdbEntry[]>();
    for (const fdb of sw.fdbEntries) {
      const portName = sw.ports.find((p) => p.ifIndex === fdb.ifIndex)?.portName || fdb.portName;

      // Ignorer si ce port est un uplink déclaré par LLDP/CDP
      if (uplinkPorts.has(portName)) continue;

      if (!portMacsMap.has(portName)) {
        portMacsMap.set(portName, []);
      }
      portMacsMap.get(portName)!.push(fdb);
    }

    // 2. Analyser chaque port d'accès pour corréler les équipements
    for (const [portName, entries] of portMacsMap.entries()) {
      // Si plus de 15 adresses MAC sur le même port sans borne Wi-Fi, c'est un uplink non documenté
      if (entries.length > 15) {
        continue;
      }

      // Cas 1 : Exactement 1 seule adresse MAC -> Terminal direct (Workstation, Imprimante, Serveur)
      if (entries.length === 1) {
        const entry = entries[0]!;
        const host = hostMap.get(entry.macAddress);
        const { vendor, defaultType } = lookupOui(entry.macAddress);

        links.push({
          id: `link-${sw.id}-${portName}-${entry.macAddress}`,
          sourceDeviceId: sw.id,
          sourceDeviceName: sw.sysName,
          sourcePortName: portName,
          targetDeviceId: `dev-${entry.macAddress.replace(/:/g, "")}`,
          targetDeviceName: host?.hostname || `${vendor} [${entry.macAddress.slice(-8)}]`,
          connectionType: "FDB_ACCESS",
          vlanId: entry.vlanId,
          confidenceScore: 100,
          details: `Attachement exclusif direct sur ${portName}`,
        });

        updatedHosts.push({
          ...(host || {
            ip: "0.0.0.0",
            mac: entry.macAddress,
            isAlive: true,
            responseTimeMs: 2,
            openPorts: [],
            source: "ARP_LOCAL",
          }),
          deviceType: defaultType,
        });
      }

      // Cas 2 : Deux adresses MAC sur le port -> Téléphone VoIP avec PC en cascade (Daisy-chain)
      else if (entries.length === 2) {
        const [entryA, entryB] = entries as [FdbEntry, FdbEntry];
        const typeA = lookupOui(entryA.macAddress).defaultType;
        const typeB = lookupOui(entryB.macAddress).defaultType;

        const isVoipA = typeA === "PHONE_VOIP" || entryA.vlanId === 30;
        const isVoipB = typeB === "PHONE_VOIP" || entryB.vlanId === 30;

        if (isVoipA && !isVoipB) {
          // Téléphone A est branché sur le switch, PC B est branché derrière le téléphone
          const phoneHost = hostMap.get(entryA.macAddress);
          const pcHost = hostMap.get(entryB.macAddress);

          // Lien 1 : Switch -> Téléphone VoIP
          links.push({
            id: `link-${sw.id}-${portName}-${entryA.macAddress}`,
            sourceDeviceId: sw.id,
            sourceDeviceName: sw.sysName,
            sourcePortName: portName,
            targetDeviceId: `dev-${entryA.macAddress.replace(/:/g, "")}`,
            targetDeviceName: phoneHost?.hostname || `VoIP Phone [${entryA.macAddress.slice(-8)}]`,
            connectionType: "FDB_ACCESS",
            vlanId: entryA.vlanId ?? 30,
            confidenceScore: 95,
            details: "Téléphone VoIP raccordé sur le port d'accès",
          });

          // Lien 2 : Téléphone VoIP -> PC en cascade
          links.push({
            id: `link-cascade-${entryA.macAddress}-${entryB.macAddress}`,
            sourceDeviceId: `dev-${entryA.macAddress.replace(/:/g, "")}`,
            sourceDeviceName: phoneHost?.hostname || "VoIP Phone",
            sourcePortName: "PC-Port",
            targetDeviceId: `dev-${entryB.macAddress.replace(/:/g, "")}`,
            targetDeviceName: pcHost?.hostname || `Workstation [${entryB.macAddress.slice(-8)}]`,
            connectionType: "VOIP_CASCADED",
            vlanId: entryB.vlanId ?? 20,
            confidenceScore: 90,
            details: "Poste de travail relié au port Ethernet du téléphone IP",
          });

          updatedHosts.push(
            {
              ...(phoneHost || {
                ip: "0.0.0.0",
                mac: entryA.macAddress,
                isAlive: true,
                responseTimeMs: 2,
                openPorts: [],
                source: "ARP_LOCAL",
              }),
              deviceType: "PHONE_VOIP",
            },
            {
              ...(pcHost || {
                ip: "0.0.0.0",
                mac: entryB.macAddress,
                isAlive: true,
                responseTimeMs: 2,
                openPorts: [],
                source: "ARP_LOCAL",
              }),
              deviceType: "WORKSTATION",
            }
          );
        } else if (isVoipB && !isVoipA) {
          // Téléphone B branché sur switch, PC A derrière
          const phoneHost = hostMap.get(entryB.macAddress);
          const pcHost = hostMap.get(entryA.macAddress);

          links.push({
            id: `link-${sw.id}-${portName}-${entryB.macAddress}`,
            sourceDeviceId: sw.id,
            sourceDeviceName: sw.sysName,
            sourcePortName: portName,
            targetDeviceId: `dev-${entryB.macAddress.replace(/:/g, "")}`,
            targetDeviceName: phoneHost?.hostname || `VoIP Phone [${entryB.macAddress.slice(-8)}]`,
            connectionType: "FDB_ACCESS",
            vlanId: entryB.vlanId ?? 30,
            confidenceScore: 95,
            details: "Téléphone VoIP raccordé sur le port d'accès",
          });

          links.push({
            id: `link-cascade-${entryB.macAddress}-${entryA.macAddress}`,
            sourceDeviceId: `dev-${entryB.macAddress.replace(/:/g, "")}`,
            sourceDeviceName: phoneHost?.hostname || "VoIP Phone",
            sourcePortName: "PC-Port",
            targetDeviceId: `dev-${entryA.macAddress.replace(/:/g, "")}`,
            targetDeviceName: pcHost?.hostname || `Workstation [${entryA.macAddress.slice(-8)}]`,
            connectionType: "VOIP_CASCADED",
            vlanId: entryA.vlanId ?? 20,
            confidenceScore: 90,
            details: "Poste de travail relié au port Ethernet du téléphone IP",
          });

          updatedHosts.push(
            {
              ...(phoneHost || {
                ip: "0.0.0.0",
                mac: entryB.macAddress,
                isAlive: true,
                responseTimeMs: 2,
                openPorts: [],
                source: "ARP_LOCAL",
              }),
              deviceType: "PHONE_VOIP",
            },
            {
              ...(pcHost || {
                ip: "0.0.0.0",
                mac: entryA.macAddress,
                isAlive: true,
                responseTimeMs: 2,
                openPorts: [],
                source: "ARP_LOCAL",
              }),
              deviceType: "WORKSTATION",
            }
          );
        } else {
          // Deux terminaux sans distinction VoIP -> Mini switch ou double carte réseau
          for (const ent of entries) {
            const h = hostMap.get(ent.macAddress);
            const { vendor, defaultType } = lookupOui(ent.macAddress);
            links.push({
              id: `link-${sw.id}-${portName}-${ent.macAddress}`,
              sourceDeviceId: sw.id,
              sourceDeviceName: sw.sysName,
              sourcePortName: portName,
              targetDeviceId: `dev-${ent.macAddress.replace(/:/g, "")}`,
              targetDeviceName: h?.hostname || `${vendor} [${ent.macAddress.slice(-8)}]`,
              connectionType: "FDB_ACCESS",
              confidenceScore: 80,
              details: `Partage de port via switch non administrable sur ${portName}`,
            });
            updatedHosts.push({
              ...(h || {
                ip: "0.0.0.0",
                mac: ent.macAddress,
                isAlive: true,
                responseTimeMs: 2,
                openPorts: [],
                source: "ARP_LOCAL",
              }),
              deviceType: defaultType,
            });
          }
        }
      }

      // Cas 3 : 3 à 15 adresses MAC -> Détection de borne Wi-Fi ou mini-switch d'étage
      else {
        // Rechercher si une des MACs correspond à une borne d'accès Wi-Fi
        const apEntry = entries.find((e) => {
          const { defaultType, vendor } = lookupOui(e.macAddress);
          return (
            defaultType === "ACCESS_POINT" ||
            vendor.toLowerCase().includes("ubiquiti") ||
            vendor.toLowerCase().includes("aruba")
          );
        });

        if (apEntry) {
          const apHost = hostMap.get(apEntry.macAddress);
          // La borne est raccordée au switch
          links.push({
            id: `link-ap-${sw.id}-${portName}-${apEntry.macAddress}`,
            sourceDeviceId: sw.id,
            sourceDeviceName: sw.sysName,
            sourcePortName: portName,
            targetDeviceId: `dev-${apEntry.macAddress.replace(/:/g, "")}`,
            targetDeviceName: apHost?.hostname || `Borne Wi-Fi [${apEntry.macAddress.slice(-8)}]`,
            connectionType: "FDB_ACCESS",
            confidenceScore: 95,
            details: "Borne Wi-Fi d'infrastructure raccordée au commutateur",
          });

          updatedHosts.push({
            ...(apHost || {
              ip: "0.0.0.0",
              mac: apEntry.macAddress,
              isAlive: true,
              responseTimeMs: 2,
              openPorts: [],
              source: "ARP_LOCAL",
            }),
            deviceType: "ACCESS_POINT",
          });

          // Les autres MACs sont des clients Wi-Fi
          for (const clientEntry of entries) {
            if (clientEntry.macAddress === apEntry.macAddress) continue;
            const clientHost = hostMap.get(clientEntry.macAddress);
            const { defaultType } = lookupOui(clientEntry.macAddress);

            links.push({
              id: `link-wifi-${apEntry.macAddress}-${clientEntry.macAddress}`,
              sourceDeviceId: `dev-${apEntry.macAddress.replace(/:/g, "")}`,
              sourceDeviceName: apHost?.hostname || "Borne Wi-Fi",
              sourcePortName: "Radio-SSID",
              targetDeviceId: `dev-${clientEntry.macAddress.replace(/:/g, "")}`,
              targetDeviceName:
                clientHost?.hostname || `Client Wi-Fi [${clientEntry.macAddress.slice(-8)}]`,
              connectionType: "WIFI_CLIENT",
              confidenceScore: 85,
              details: "Client mobile connecté en Wi-Fi",
            });

            updatedHosts.push({
              ...(clientHost || {
                ip: "0.0.0.0",
                mac: clientEntry.macAddress,
                isAlive: true,
                responseTimeMs: 2,
                openPorts: [],
                source: "ARP_LOCAL",
              }),
              deviceType: defaultType,
            });
          }
        } else {
          // Mini-switch de bureau non administrable
          for (const ent of entries) {
            const h = hostMap.get(ent.macAddress);
            const { vendor, defaultType } = lookupOui(ent.macAddress);
            links.push({
              id: `link-${sw.id}-${portName}-${ent.macAddress}`,
              sourceDeviceId: sw.id,
              sourceDeviceName: sw.sysName,
              sourcePortName: portName,
              targetDeviceId: `dev-${ent.macAddress.replace(/:/g, "")}`,
              targetDeviceName: h?.hostname || `${vendor} [${ent.macAddress.slice(-8)}]`,
              connectionType: "FDB_ACCESS",
              confidenceScore: 70,
              details: `Raccordé via mini-switch non administrable sur ${portName}`,
            });

            updatedHosts.push({
              ...(h || {
                ip: "0.0.0.0",
                mac: ent.macAddress,
                isAlive: true,
                responseTimeMs: 2,
                openPorts: [],
                source: "ARP_LOCAL",
              }),
              deviceType: defaultType,
            });
          }
        }
      }
    }
  }

  // Dédupliquer les updatedHosts par adresse MAC
  const dedupHosts = Array.from(new Map(updatedHosts.map((h) => [h.mac, h])).values());

  return { links, updatedHosts: dedupHosts };
}
