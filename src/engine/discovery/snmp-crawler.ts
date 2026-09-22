import snmp from "net-snmp";
import {
  DiscoveredSwitch,
  DiscoveredDeviceType,
  LldpNeighbor,
  CdpNeighbor,
  SwitchPortInfo,
  ScanOptions,
} from "./types";

export function snmpGetPromise(session: any, oids: string[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    session.get(oids, (err: any, varbinds: any[]) => {
      if (err) reject(err);
      else resolve(varbinds || []);
    });
  });
}

export function snmpSubtreePromise(session: any, rootOid: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    session.subtree(
      rootOid,
      (varbinds: any[]) => {
        for (const vb of varbinds) {
          if (!snmp.isVarbindError(vb)) {
            results.push(vb);
          }
        }
      },
      (err: any) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
}

/**
 * Crée une session SNMP configurée selon les options v2c ou v3.
 */
function createSnmpSession(host: string, options: ScanOptions): any {
  const version = options.snmpVersion === "v1" ? 0 : 1; // 0 = v1, 1 = v2c
  const community = options.snmpCommunity || "public";
  const port = options.snmpPort || 161;
  const timeout = options.pingTimeoutMs || 1500;

  return snmp.createSession(host, community, {
    port,
    version,
    timeout,
    retries: 1,
  });
}

/**
 * Interroge un commutateur pour extraire ses métadonnées, ses interfaces physiques,
 * ses voisins LLDP (norme 802.1AB) et ses voisins Cisco CDP.
 */
export async function crawlSwitchLldpCdp(
  host: string,
  options: ScanOptions
): Promise<DiscoveredSwitch | null> {
  const session = createSnmpSession(host, options);

  try {
    // 1. MIB-II Système standard (RFC 1213)
    const sysOids = [
      "1.3.6.1.2.1.1.5.0", // sysName
      "1.3.6.1.2.1.1.1.0", // sysDescr
      "1.3.6.1.2.1.1.2.0", // sysObjectID
      "1.3.6.1.2.1.1.3.0", // sysUpTime
    ];

    const sysVbs = await snmpGetPromise(session, sysOids);
    const rawSysName = sysVbs[0]?.value ? sysVbs[0].value.toString().trim() : "";
    const rawSysDescr = sysVbs[1]?.value ? sysVbs[1].value.toString().trim() : "";
    const rawSysOid = sysVbs[2]?.value ? sysVbs[2].value.toString().trim() : "";

    if (!rawSysDescr && !rawSysName) {
      try {
        session.close();
      } catch {
        // Ignorer l'erreur de fermeture
      }
      return null;
    }

    let vendor = "Generic Managed Switch";
    const dLower = (rawSysDescr + " " + rawSysOid).toLowerCase();
    const sLower = (rawSysName || "").toLowerCase();

    if (dLower.includes("cisco") || rawSysOid.includes(".1.3.6.1.4.1.9.")) vendor = "Cisco Systems";
    else if (
      dLower.includes("aruba") ||
      dLower.includes("procurve") ||
      rawSysOid.includes(".1.3.6.1.4.1.11.")
    )
      vendor = "Aruba Networks";
    else if (
      dLower.includes("ubiquiti") ||
      dLower.includes("unifi") ||
      rawSysOid.includes(".1.3.6.1.4.1.41112.")
    )
      vendor = "Ubiquiti";
    else if (dLower.includes("zyxel") || rawSysOid.includes(".1.3.6.1.4.1.890.")) vendor = "Zyxel";

    // Détection précise du type d'équipement
    let deviceType: DiscoveredDeviceType = "SWITCH";
    let defaultPortsCount = 24;
    let uSize = 1;

    const isUps =
      dLower.includes("ups") ||
      dLower.includes("onduleur") ||
      dLower.includes("smart-ups") ||
      dLower.includes("eaton") ||
      dLower.includes("apc") ||
      dLower.includes("riello") ||
      dLower.includes("socomec") ||
      dLower.includes("vertiv") ||
      dLower.includes("liebert") ||
      sLower.includes("ups") ||
      sLower.includes("onduleur");
    const isCam =
      dLower.includes("camera") ||
      dLower.includes("caméra") ||
      dLower.includes("cam-") ||
      dLower.includes("hikvision") ||
      dLower.includes("dahua") ||
      dLower.includes("axis") ||
      dLower.includes("surveillance") ||
      dLower.includes("nvr") ||
      sLower.includes("cam-") ||
      sLower.startsWith("cam");
    const isPc =
      dLower.includes("workstation") ||
      dLower.includes("optiplex") ||
      dLower.includes("thinkcentre") ||
      dLower.includes("latitude") ||
      dLower.includes("elitebook") ||
      sLower.includes("pc-") ||
      sLower.startsWith("pc");

    if (isUps) {
      deviceType = "UNKNOWN";
      defaultPortsCount = 1;
      uSize = 2;
    } else if (isCam) {
      deviceType = "UNKNOWN";
      defaultPortsCount = 1;
      uSize = 0;
    } else if (isPc) {
      deviceType = "WORKSTATION";
      defaultPortsCount = 1;
      uSize = 0;
    } else if (
      dLower.includes("access point") ||
      dLower.includes("ap-") ||
      dLower.includes("arubaap") ||
      dLower.includes("uap") ||
      dLower.includes("wireless") ||
      dLower.includes("aironet") ||
      dLower.includes("meraki mr") ||
      sLower.includes("ap-") ||
      sLower.includes("uap") ||
      sLower.startsWith("ap")
    ) {
      deviceType = "ACCESS_POINT";
      defaultPortsCount = 1;
      uSize = 0;
    } else if (
      dLower.includes("poweredge") ||
      dLower.includes("proliant") ||
      dLower.includes("esxi") ||
      dLower.includes("linux") ||
      dLower.includes("windows server")
    ) {
      deviceType = "SERVER";
      defaultPortsCount = 4;
      uSize = dLower.includes("1u") || dLower.includes("r6") ? 1 : 2;
    } else if (
      dLower.includes("fortigate") ||
      dLower.includes("firepower") ||
      dLower.includes("asa") ||
      dLower.includes("pfsense") ||
      dLower.includes("palo alto")
    ) {
      deviceType = "ROUTER";
      defaultPortsCount = 10;
      uSize = 1;
    } else {
      if (
        dLower.includes("48p") ||
        dLower.includes("48g") ||
        dLower.includes("-48-") ||
        dLower.includes("48hp") ||
        dLower.includes(" 48")
      ) {
        defaultPortsCount = 48;
      } else if (
        dLower.includes("8p") ||
        dLower.includes("8g") ||
        dLower.includes("-8-") ||
        dLower.includes(" 8")
      ) {
        defaultPortsCount = 8;
      } else if (
        dLower.includes("16p") ||
        dLower.includes("16g") ||
        dLower.includes("-16-") ||
        dLower.includes(" 16")
      ) {
        defaultPortsCount = 16;
      } else if (dLower.includes("52p") || dLower.includes("52g") || dLower.includes("-52-")) {
        defaultPortsCount = 52;
      } else {
        defaultPortsCount = 24;
      }
      uSize = dLower.includes("9400") || dLower.includes("5406") || dLower.includes("6500") ? 4 : 1;
    }

    const namePrefix =
      deviceType === "ACCESS_POINT"
        ? "AP-"
        : deviceType === "SERVER"
          ? "SRV-"
          : isUps
            ? "UPS-"
            : isCam
              ? "CAM-"
              : isPc
                ? "PC-"
                : "SW-";
    const sysName = rawSysName || `${namePrefix}${host.replace(/\./g, "-")}`;
    const model =
      rawSysDescr.split("\n")[0]?.split(",")[0] ||
      (deviceType === "ACCESS_POINT"
        ? `${vendor} Access Point`
        : deviceType === "SERVER"
          ? `${vendor} Server`
          : isUps
            ? `${vendor} Onduleur / UPS`
            : isCam
              ? `${vendor} Caméra IP`
              : isPc
                ? `${vendor} Workstation`
                : `${vendor} Switch`);

    // 2. Interfaces physiques du commutateur (IF-MIB RFC 2863)
    const portsMap = new Map<number, SwitchPortInfo>();

    try {
      // ifDescr (1.3.6.1.2.1.2.2.1.2)
      const ifDescrs = await snmpSubtreePromise(session, "1.3.6.1.2.1.2.2.1.2");
      for (const vb of ifDescrs) {
        const oidParts = vb.oid.split(".");
        const ifIndex = Number.parseInt(oidParts[oidParts.length - 1], 10);
        const name = vb.value ? vb.value.toString().trim() : `Port ${ifIndex}`;
        portsMap.set(ifIndex, {
          ifIndex,
          portName: name,
          speedMbps: 1000,
          isUp: true,
          isUplink: false,
          fdbMacs: [],
        });
      }

      // ifName (1.3.6.1.2.1.31.1.1.1.1) si disponible
      try {
        const ifNames = await snmpSubtreePromise(session, "1.3.6.1.2.1.31.1.1.1.1");
        for (const vb of ifNames) {
          const oidParts = vb.oid.split(".");
          const ifIndex = Number.parseInt(oidParts[oidParts.length - 1], 10);
          const p = portsMap.get(ifIndex);
          if (p && vb.value) {
            p.portName = vb.value.toString().trim();
          }
        }
      } catch {
        // Fallback sur ifDescr
      }

      // ifOperStatus (1.3.6.1.2.1.2.2.1.8) : 1 = UP, 2 = DOWN
      try {
        const ifOper = await snmpSubtreePromise(session, "1.3.6.1.2.1.2.2.1.8");
        for (const vb of ifOper) {
          const oidParts = vb.oid.split(".");
          const ifIndex = Number.parseInt(oidParts[oidParts.length - 1], 10);
          const p = portsMap.get(ifIndex);
          if (p) {
            p.isUp = Number(vb.value) === 1;
          }
        }
      } catch {
        // Ignorer
      }
    } catch {
      // Ignorer l'erreur de parcours IF
    }

    // Si aucune interface n'a été découverte ou si la table IF était vide, créer des ports synthétiques
    if (portsMap.size === 0) {
      for (let i = 1; i <= defaultPortsCount; i++) {
        portsMap.set(i, {
          ifIndex: i,
          portName:
            deviceType === "ACCESS_POINT"
              ? i === 1
                ? "eth0"
                : `eth${i - 1}`
              : isUps
                ? "mgmt0"
                : isCam || isPc
                  ? "eth0"
                  : `Gi1/0/${i}`,
          speedMbps: 1000,
          isUp: true,
          isUplink: false,
          fdbMacs: [],
        });
      }
    }

    // 3. Extraction des voisins LLDP (802.1AB standard lldpRemTable)
    const lldpNeighbors: LldpNeighbor[] = [];
    try {
      // 1.0.8802.1.1.2.1.4.1.1.9 = lldpRemSysName
      const lldpSysNames = await snmpSubtreePromise(session, "1.0.8802.1.1.2.1.4.1.1.9");
      // 1.0.8802.1.1.2.1.4.1.1.7 = lldpRemPortId
      const lldpPortIds = await snmpSubtreePromise(session, "1.0.8802.1.1.2.1.4.1.1.7");
      // 1.0.8802.1.1.2.1.4.1.1.5 = lldpRemChassisId
      const lldpChassis = await snmpSubtreePromise(session, "1.0.8802.1.1.2.1.4.1.1.5");

      for (const sysVb of lldpSysNames) {
        const oidSuffix = sysVb.oid.replace("1.0.8802.1.1.2.1.4.1.1.9.", "");
        const parts = oidSuffix.split(".");
        const localPortIdx = Number.parseInt(parts[1] || "1", 10);
        const remSysName = sysVb.value ? sysVb.value.toString().trim() : "";

        // Trouver le Port ID distant correspondant
        const matchingPort = lldpPortIds.find((p) => p.oid.endsWith(oidSuffix));
        const remPortId = matchingPort?.value ? matchingPort.value.toString().trim() : "Uplink";

        // Trouver le Chassis ID distant
        const matchingChassis = lldpChassis.find((c) => c.oid.endsWith(oidSuffix));
        const remChassisId = matchingChassis?.value
          ? matchingChassis.value.toString("hex").toUpperCase()
          : "UNKNOWN";

        const localPortObj = portsMap.get(localPortIdx);
        const localPortName = localPortObj?.portName || `Port ${localPortIdx}`;

        // Marquer ce port comme UPLINK / DORSALE
        if (localPortObj) {
          localPortObj.isUplink = true;
        }

        lldpNeighbors.push({
          localPortIndex: localPortIdx,
          localPortName,
          remoteChassisId: remChassisId,
          remotePortId: remPortId,
          remoteSysName: remSysName || "SWITCH-VOISIN",
        });
      }
    } catch {
      // Pas de table LLDP active
    }

    // 4. Extraction des voisins Cisco CDP (CISCO-CDP-MIB cdpCacheTable)
    const cdpNeighbors: CdpNeighbor[] = [];
    if (vendor === "Cisco Systems" || lldpNeighbors.length === 0) {
      try {
        // 1.3.6.1.4.1.9.9.23.1.2.1.1.6 = cdpCacheDeviceId
        const cdpDevices = await snmpSubtreePromise(session, "1.3.6.1.4.1.9.9.23.1.2.1.1.6");
        // 1.3.6.1.4.1.9.9.23.1.2.1.1.7 = cdpCacheDevicePort
        const cdpPorts = await snmpSubtreePromise(session, "1.3.6.1.4.1.9.9.23.1.2.1.1.7");

        for (const devVb of cdpDevices) {
          const suffix = devVb.oid.replace("1.3.6.1.4.1.9.9.23.1.2.1.1.6.", "");
          const localIfIdx = Number.parseInt(suffix.split(".")[0] || "1", 10);
          const devName = devVb.value ? devVb.value.toString().trim() : "";

          const portMatch = cdpPorts.find((p) => p.oid.endsWith(suffix));
          const remPort = portMatch?.value
            ? portMatch.value.toString().trim()
            : "GigabitEthernet1/0/1";

          const localPortObj = portsMap.get(localIfIdx);
          const localPortName = localPortObj?.portName || `Port ${localIfIdx}`;

          if (localPortObj) {
            localPortObj.isUplink = true;
          }

          cdpNeighbors.push({
            localPortName,
            remoteDeviceId: devName,
            remoteDevicePort: remPort,
          });
        }
      } catch {
        // Pas de CDP actif
      }
    }

    try {
      session.close();
    } catch {
      // Ignorer l'erreur de fermeture
    }

    // MAC de management déduite ou construite
    const hostParts = host.split(".").map(Number);
    const mac =
      `00:81:C4:00:${hostParts[2]?.toString(16).padStart(2, "0")}:${hostParts[3]?.toString(16).padStart(2, "0")}`.toUpperCase();

    return {
      id: `${deviceType === "ACCESS_POINT" ? "ap" : deviceType === "SERVER" ? "srv" : isUps ? "ups" : isCam ? "cam" : isPc ? "pc" : "sw"}-${host.replace(/\./g, "-")}`,
      ip: host,
      mac,
      sysName,
      sysDescr: rawSysDescr,
      sysOid: rawSysOid,
      vendor,
      model,
      deviceType,
      uSize,
      ports: Array.from(portsMap.values()),
      lldpNeighbors,
      cdpNeighbors,
      fdbEntries: [],
    };
  } catch {
    try {
      session.close();
    } catch {
      // Ignorer l'erreur de fermeture
    }
    return null;
  }
}
