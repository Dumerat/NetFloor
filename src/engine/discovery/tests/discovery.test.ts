import { describe, it, expect } from "vitest";
import { expandCidr } from "../ping-sweep";
import { lookupOui, normalizeMac } from "../oui-database";
import { oidSuffixToMac, resolveAttachmentPoints } from "../fdb-resolver";
import { detectTopologyDrift } from "../drift-detector";
import { DiscoveredSwitch, RawHostProbe } from "../types";

describe("Discovery Pipeline & Topology Engine", () => {
  describe("1. OUI & CIDR Mathematics", () => {
    it("développe un sous-réseau /24 en liste complète d'adresses IP", () => {
      const ips = expandCidr("192.168.1.0/24");
      expect(ips.length).toBe(254);
      expect(ips[0]).toBe("192.168.1.1");
      expect(ips[253]).toBe("192.168.1.254");
    });

    it("gère une adresse IP unique /32 ou sans masque", () => {
      expect(expandCidr("10.42.0.1")).toEqual(["10.42.0.1"]);
      expect(expandCidr("10.42.0.1/32")).toEqual(["10.42.0.1"]);
    });

    it("normalise les formats d'adresses MAC hétérogènes", () => {
      expect(normalizeMac("001122334455")).toBe("00:11:22:33:44:55");
      expect(normalizeMac("00-11-22-33-44-55")).toBe("00:11:22:33:44:55");
      expect(normalizeMac("0011.2233.4455")).toBe("00:11:22:33:44:55");
      expect(normalizeMac("00:11:22:33:44:55")).toBe("00:11:22:33:44:55");
    });

    it("identifie avec précision les constructeurs réseau et terminaux clés", () => {
      expect(lookupOui("00:00:0C:12:34:56").vendor).toBe("Cisco Systems");
      expect(lookupOui("00:04:4D:AA:BB:CC").defaultType).toBe("PHONE_VOIP");
      expect(lookupOui("00:0B:86:11:22:33").vendor).toBe("Aruba Networks");
      expect(lookupOui("00:15:6D:44:55:66").defaultType).toBe("ACCESS_POINT");
      expect(lookupOui("00:15:65:11:22:33").defaultType).toBe("PHONE_VOIP");
      expect(lookupOui("00:14:22:99:88:77").vendor).toBe("Dell");
      expect(lookupOui("00:00:85:12:34:56").defaultType).toBe("PRINTER");
    });

    it("convertit un tableau d'octets OID SNMP FDB en adresse MAC", () => {
      const octets = [1, 2, 0, 26, 161, 1, 2, 3];
      expect(oidSuffixToMac(octets)).toBe("00:1A:A1:01:02:03");
    });
  });

  describe("2. Résolution d'Attachement FDB & Cas Complexes", () => {
    const mockSwitch: DiscoveredSwitch = {
      id: "sw-core-01",
      ip: "10.42.0.1",
      mac: "00:81:C4:00:00:01",
      sysName: "SW-CORE-01",
      sysDescr: "Cisco Catalyst 2960X-24TD-L",
      sysOid: "1.3.6.1.4.1.9.1.1",
      vendor: "Cisco Systems",
      model: "WS-C2960X-24TD-L",
      ports: [
        {
          ifIndex: 1,
          portName: "Gi1/0/1",
          speedMbps: 1000,
          isUp: true,
          isUplink: false,
          fdbMacs: [],
        },
        {
          ifIndex: 2,
          portName: "Gi1/0/2",
          speedMbps: 1000,
          isUp: true,
          isUplink: false,
          fdbMacs: [],
        },
        {
          ifIndex: 3,
          portName: "Gi1/0/3",
          speedMbps: 1000,
          isUp: true,
          isUplink: false,
          fdbMacs: [],
        },
        {
          ifIndex: 24,
          portName: "Gi1/0/24",
          speedMbps: 10000,
          isUp: true,
          isUplink: true,
          fdbMacs: [],
        },
      ],
      lldpNeighbors: [
        {
          localPortIndex: 24,
          localPortName: "Gi1/0/24",
          remoteChassisId: "SW-DIST-01",
          remotePortId: "TenGigabitEthernet1/1/1",
          remoteSysName: "SW-DIST-01",
        },
      ],
      cdpNeighbors: [],
      fdbEntries: [
        // Port 1 : 1 seule MAC (PC Dell standard)
        {
          macAddress: "00:14:22:AA:BB:CC",
          bridgePort: 1,
          ifIndex: 1,
          portName: "Gi1/0/1",
          vlanId: 20,
          status: "learned",
        },
        // Port 2 : 2 MACs (Téléphone Cisco VoIP + PC Lenovo cascaded)
        {
          macAddress: "00:04:4D:11:22:33",
          bridgePort: 2,
          ifIndex: 2,
          portName: "Gi1/0/2",
          vlanId: 30,
          status: "learned",
        },
        {
          macAddress: "00:21:CC:44:55:66",
          bridgePort: 2,
          ifIndex: 2,
          portName: "Gi1/0/2",
          vlanId: 20,
          status: "learned",
        },
        // Port 3 : Borne Wi-Fi Ubiquiti + 2 clients sans-fil
        {
          macAddress: "00:15:6D:77:88:99",
          bridgePort: 3,
          ifIndex: 3,
          portName: "Gi1/0/3",
          vlanId: 50,
          status: "learned",
        },
        {
          macAddress: "3C:06:30:AA:11:22",
          bridgePort: 3,
          ifIndex: 3,
          portName: "Gi1/0/3",
          vlanId: 50,
          status: "learned",
        },
        {
          macAddress: "AC:DE:48:BB:33:44",
          bridgePort: 3,
          ifIndex: 3,
          portName: "Gi1/0/3",
          vlanId: 50,
          status: "learned",
        },
        // Port 24 : Uplink LLDP vers SW-DIST-01 (doit être ignoré pour les terminaux)
        {
          macAddress: "00:81:C4:99:99:99",
          bridgePort: 24,
          ifIndex: 24,
          portName: "Gi1/0/24",
          vlanId: 1,
          status: "learned",
        },
      ],
    };

    const mockProbes: RawHostProbe[] = [
      {
        ip: "10.42.20.10",
        mac: "00:14:22:AA:BB:CC",
        hostname: "PC-FINANCE-01",
        isAlive: true,
        responseTimeMs: 2,
        openPorts: [445],
        source: "ARP_LOCAL",
      },
      {
        ip: "10.42.30.15",
        mac: "00:04:4D:11:22:33",
        hostname: "SEP00044D112233",
        isAlive: true,
        responseTimeMs: 3,
        openPorts: [80],
        source: "ARP_LOCAL",
      },
      {
        ip: "10.42.20.16",
        mac: "00:21:CC:44:55:66",
        hostname: "LAPTOP-DEV-02",
        isAlive: true,
        responseTimeMs: 2,
        openPorts: [22],
        source: "ARP_LOCAL",
      },
      {
        ip: "10.42.50.2",
        mac: "00:15:6D:77:88:99",
        hostname: "UAP-ETAGE1-NORD",
        isAlive: true,
        responseTimeMs: 1,
        openPorts: [80, 443],
        source: "ARP_LOCAL",
      },
      {
        ip: "10.42.50.101",
        mac: "3C:06:30:AA:11:22",
        hostname: "MacBook-Pro-CEO",
        isAlive: true,
        responseTimeMs: 12,
        openPorts: [],
        source: "ARP_LOCAL",
      },
      {
        ip: "10.42.50.102",
        mac: "AC:DE:48:BB:33:44",
        hostname: "iPhone-Sophie",
        isAlive: true,
        responseTimeMs: 18,
        openPorts: [],
        source: "ARP_LOCAL",
      },
    ];

    it("élague automatiquement les ports d'interconnexion / Uplink LLDP", () => {
      const { links } = resolveAttachmentPoints([mockSwitch], mockProbes);
      // Le port Gi1/0/24 est un uplink LLDP : aucun lien terminal direct ne doit être créé dessus
      const uplinkLink = links.find((l) => l.sourcePortName === "Gi1/0/24");
      expect(uplinkLink).toBeUndefined();
    });

    it("associe directement un terminal unique sur port d'accès", () => {
      const { links } = resolveAttachmentPoints([mockSwitch], mockProbes);
      const port1Link = links.find((l) => l.sourcePortName === "Gi1/0/1");
      expect(port1Link).toBeDefined();
      expect(port1Link?.targetDeviceId).toBe("dev-001422AABBCC");
      expect(port1Link?.connectionType).toBe("FDB_ACCESS");
      expect(port1Link?.confidenceScore).toBe(100);
    });

    it("résout la cascade Téléphone VoIP + PC en daisy-chain sur le même port", () => {
      const { links } = resolveAttachmentPoints([mockSwitch], mockProbes);

      // 1. Liaison Switch Gi1/0/2 -> Téléphone VoIP
      const swToPhone = links.find(
        (l) => l.sourcePortName === "Gi1/0/2" && l.targetDeviceId === "dev-00044D112233"
      );
      expect(swToPhone).toBeDefined();
      expect(swToPhone?.connectionType).toBe("FDB_ACCESS");
      expect(swToPhone?.vlanId).toBe(30);

      // 2. Liaison Téléphone VoIP -> PC cascaded
      const phoneToPc = links.find(
        (l) => l.sourceDeviceId === "dev-00044D112233" && l.targetDeviceId === "dev-0021CC445566"
      );
      expect(phoneToPc).toBeDefined();
      expect(phoneToPc?.connectionType).toBe("VOIP_CASCADED");
      expect(phoneToPc?.sourcePortName).toBe("PC-Port");
      expect(phoneToPc?.vlanId).toBe(20);
    });

    it("identifie une borne Wi-Fi d'infrastructure et sépare les clients mobiles", () => {
      const { links } = resolveAttachmentPoints([mockSwitch], mockProbes);

      // La borne doit être raccordée au switch Gi1/0/3
      const swToAp = links.find(
        (l) => l.sourcePortName === "Gi1/0/3" && l.targetDeviceId === "dev-00156D778899"
      );
      expect(swToAp).toBeDefined();
      expect(swToAp?.connectionType).toBe("FDB_ACCESS");

      // Les clients doivent être raccordés à la borne en WIFI_CLIENT
      const apToClient1 = links.find(
        (l) => l.sourceDeviceId === "dev-00156D778899" && l.targetDeviceId === "dev-3C0630AA1122"
      );
      expect(apToClient1).toBeDefined();
      expect(apToClient1?.connectionType).toBe("WIFI_CLIENT");
    });
  });

  describe("3. Détection de Dérive & Réconciliation Human-in-the-Loop", () => {
    it("détecte les nouveaux équipements non placés sur le plan", () => {
      const probed = [
        {
          ip: "10.42.20.50",
          mac: "00:14:22:99:99:99",
          hostname: "NEW-PC-RH",
          isAlive: true,
          responseTimeMs: 3,
          openPorts: [445],
          source: "ARP_LOCAL" as const,
          deviceType: "WORKSTATION" as const,
        },
      ];
      const diffs = detectTopologyDrift(probed, [], [], []);

      expect(diffs.length).toBe(1);
      expect(diffs[0]?.type).toBe("NEW_DEVICE");
      expect(diffs[0]?.proposedAction).toBe("CREATE_NODE");
      expect(diffs[0]?.deviceMac).toBe("00:14:22:99:99:99");
    });

    it("détecte une migration de port physique et alerte en cas de verrouillage isLocked", () => {
      const probed = [
        {
          ip: "10.42.20.10",
          mac: "00:14:22:AA:BB:CC",
          hostname: "PC-FINANCE-01",
          isAlive: true,
          responseTimeMs: 2,
          openPorts: [445],
          source: "ARP_LOCAL" as const,
        },
      ];
      const links = [
        {
          id: "link-1",
          sourceDeviceId: "sw-1",
          sourceDeviceName: "SW-01",
          sourcePortName: "Gi1/0/12", // Nouveau port découvert
          targetDeviceId: "dev-001422AABBCC",
          targetDeviceName: "PC-FINANCE-01",
          connectionType: "FDB_ACCESS" as const,
          confidenceScore: 100,
        },
      ];
      const existingNodes = [
        {
          id: "node-1",
          name: "PC-FINANCE-01",
          type: "WALL_OUTLET",
          macAddress: "00:14:22:AA:BB:CC",
          connectedSwitchPort: "Gi1/0/4", // Ancien port sur le plan
          isLocked: true, // Verrouillé manuellement par la DSI
        },
      ];

      const diffs = detectTopologyDrift(probed, links, existingNodes, []);

      expect(diffs.length).toBe(1);
      expect(diffs[0]?.type).toBe("PORT_MIGRATED");
      expect(diffs[0]?.severity).toBe("CRITICAL"); // Alerté comme critique car isLocked
      expect(diffs[0]?.proposedAction).toBe("MOVE_CABLE");
      expect(diffs[0]?.payload.oldSwitchPort).toBe("Gi1/0/4");
      expect(diffs[0]?.payload.switchPort).toBe("Gi1/0/12");
    });

    it("détecte les collisions d'adresses IP sur le réseau", () => {
      const probed = [
        {
          ip: "10.42.20.99",
          mac: "00:14:22:11:11:11",
          isAlive: true,
          responseTimeMs: 2,
          openPorts: [],
          source: "ARP_LOCAL" as const,
        },
        {
          ip: "10.42.20.99",
          mac: "00:14:22:22:22:22",
          isAlive: true,
          responseTimeMs: 2,
          openPorts: [],
          source: "ARP_LOCAL" as const,
        },
      ];

      const diffs = detectTopologyDrift(probed, [], [], []);
      const conflictDiff = diffs.find((d) => d.type === "IP_CONFLICT");
      expect(conflictDiff).toBeDefined();
      expect(conflictDiff?.severity).toBe("CRITICAL");
      expect(conflictDiff?.deviceIp).toBe("10.42.20.99");
    });
  });
});
