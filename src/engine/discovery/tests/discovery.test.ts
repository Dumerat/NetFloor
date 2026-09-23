import { describe, it, expect, vi, afterEach } from "vitest";
import snmp from "net-snmp";
import dns from "dns";
import { expandCidr, getSystemArpTable, resolveReverseDns, executePingSweep } from "../ping-sweep";
import { lookupOui, normalizeMac } from "../oui-database";
import { oidSuffixToMac, resolveAttachmentPoints, extractSwitchFdb } from "../fdb-resolver";
import { detectTopologyDrift } from "../drift-detector";
import { snmpGetPromise, snmpSubtreePromise, crawlSwitchLldpCdp } from "../snmp-crawler";
import { runDiscoveryPipeline } from "../discovery-pipeline";
import { getDb, ensureDiscoveryTables } from "@/db";
import {
  discoveryJobs,
  discoveredDevices,
  discoveredConnections,
  discoveryLogs,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { DiscoveredSwitch, RawHostProbe } from "../types";

describe("Discovery Pipeline & Topology Engine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
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
      const wifiLinks = links.filter((l) => l.sourceDeviceId === "dev-00156D778899");
      expect(wifiLinks.length).toBe(2);
      const wifiClient = wifiLinks.find((l) => l.targetDeviceId === "dev-3C0630AA1122");
      expect(wifiClient).toBeDefined();
      expect(wifiClient?.connectionType).toBe("WIFI_CLIENT");
    });

    it("gère un mini-switch non administrable avec plusieurs postes et clients inconnus", () => {
      const swWithHub: DiscoveredSwitch = {
        ...mockSwitch,
        fdbEntries: [
          {
            macAddress: "00:14:22:99:88:77",
            bridgePort: 5,
            ifIndex: 5,
            portName: "Gi1/0/5",
            vlanId: 20,
            status: "learned",
          },
          {
            macAddress: "00:14:22:99:88:66",
            bridgePort: 5,
            ifIndex: 5,
            portName: "Gi1/0/5",
            vlanId: 20,
            status: "learned",
          },
          {
            macAddress: "00:14:22:99:88:55",
            bridgePort: 5,
            ifIndex: 5,
            portName: "Gi1/0/5",
            vlanId: 20,
            status: "learned",
          },
        ],
      };

      const { links, updatedHosts } = resolveAttachmentPoints(
        [swWithHub],
        [
          {
            ip: "10.42.20.77",
            mac: "00:14:22:99:88:77",
            hostname: "DESK-PC-01",
            isAlive: true,
            responseTimeMs: 1,
            openPorts: [],
            source: "ARP_LOCAL",
          },
        ]
      );

      expect(links.length).toBe(3);
      expect(links[0]?.connectionType).toBe("FDB_ACCESS");
      expect(links[0]?.details).toContain("mini-switch non administrable");
      expect(updatedHosts.length).toBe(3);
      const unknownHost = updatedHosts.find((h) => h.mac === "00:14:22:99:88:66");
      expect(unknownHost?.ip).toBe("0.0.0.0");
    });

    it("gère une borne Wi-Fi avec un client mobile non vu en ARP", () => {
      const swWithAp: DiscoveredSwitch = {
        ...mockSwitch,
        fdbEntries: [
          {
            macAddress: "00:15:6D:77:88:99",
            bridgePort: 3,
            ifIndex: 3,
            portName: "Gi1/0/3",
            vlanId: 50,
            status: "learned",
          },
          {
            macAddress: "3C:06:30:11:22:33",
            bridgePort: 3,
            ifIndex: 3,
            portName: "Gi1/0/3",
            vlanId: 50,
            status: "learned",
          },
          {
            macAddress: "AC:DE:48:FF:FF:FF",
            bridgePort: 3,
            ifIndex: 3,
            portName: "Gi1/0/3",
            vlanId: 50,
            status: "learned",
          },
        ],
      };

      const { links, updatedHosts } = resolveAttachmentPoints(
        [swWithAp],
        [
          {
            ip: "10.42.50.2",
            mac: "00:15:6D:77:88:99",
            hostname: "UAP-ETAGE1-NORD",
            isAlive: true,
            responseTimeMs: 1,
            openPorts: [],
            source: "ARP_LOCAL",
          },
        ]
      );

      expect(links.length).toBe(3);
      const wifiLink = links.find((l) => l.connectionType === "WIFI_CLIENT");
      expect(wifiLink).toBeDefined();
      const unknownWifiHost = updatedHosts.find((h) => h.mac === "AC:DE:48:FF:FF:FF");
      expect(unknownWifiHost?.ip).toBe("0.0.0.0");
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

  describe("4. SNMP Crawler & Helpers", () => {
    it("snmpGetPromise résout avec les varbinds reçus", async () => {
      const mockSession = {
        get: (oids: string[], cb: (err: any, vbs: any[]) => void) => {
          cb(null, [{ oid: oids[0], value: "test-system" }]);
        },
      };
      const res = await snmpGetPromise(mockSession, ["1.3.6.1.2.1.1.1.0"]);
      expect(res).toEqual([{ oid: "1.3.6.1.2.1.1.1.0", value: "test-system" }]);
    });

    it("snmpGetPromise rejette en cas d'erreur", async () => {
      const mockSession = {
        get: (_oids: string[], cb: (err: any, vbs: any[]) => void) => {
          cb(new Error("Timeout"), []);
        },
      };
      await expect(snmpGetPromise(mockSession, ["1.3.6.1.2.1.1.1.0"])).rejects.toThrow("Timeout");
    });

    it("snmpSubtreePromise filtre les varbinds en erreur et résout la liste", async () => {
      const mockSession = {
        subtree: (rootOid: string, feed: (vbs: any[]) => void, done: (err?: any) => void) => {
          feed([
            { oid: `${rootOid}.1`, value: "item-1" },
            { oid: `${rootOid}.2`, value: "item-2" },
          ]);
          done();
        },
      };
      const res = await snmpSubtreePromise(mockSession, "1.3.6.1.2.1.2.2.1.2");
      expect(res.length).toBe(2);
      expect(res[0]?.value).toBe("item-1");
    });

    it("snmpSubtreePromise rejette en cas d'échec du parcours", async () => {
      const mockSession = {
        subtree: (_rootOid: string, _feed: (vbs: any[]) => void, done: (err?: any) => void) => {
          done(new Error("Subtree failed"));
        },
      };
      await expect(snmpSubtreePromise(mockSession, "1.3.6.1.2.1.2.2.1.2")).rejects.toThrow(
        "Subtree failed"
      );
    });

    it("crawlSwitchLldpCdp profile un commutateur Cisco avec voisins LLDP et CDP", async () => {
      const createSessionSpy = vi.spyOn(snmp, "createSession").mockReturnValue({
        close: vi.fn(),
        get: (_oids: string[], cb: (err: any, vbs: any[]) => void) => {
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "SW-CISCO-CORE" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "Cisco Catalyst 2960X 24 Ports" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.9.1.1234" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 456789 },
          ]);
        },
        subtree: (rootOid: string, feed: (vbs: any[]) => void, done: (err?: any) => void) => {
          if (rootOid === "1.3.6.1.2.1.2.2.1.2") {
            feed([
              { oid: "1.3.6.1.2.1.2.2.1.2.1", value: "Gi1/0/1" },
              { oid: "1.3.6.1.2.1.2.2.1.2.2", value: "Gi1/0/2" },
            ]);
          } else if (rootOid === "1.3.6.1.2.1.31.1.1.1.1") {
            feed([
              { oid: "1.3.6.1.2.1.31.1.1.1.1.1", value: "Gi1/0/1" },
              { oid: "1.3.6.1.2.1.31.1.1.1.1.2", value: "Gi1/0/2" },
            ]);
          } else if (rootOid === "1.3.6.1.2.1.2.2.1.8") {
            feed([
              { oid: "1.3.6.1.2.1.2.2.1.8.1", value: 1 },
              { oid: "1.3.6.1.2.1.2.2.1.8.2", value: 1 },
            ]);
          } else if (rootOid === "1.0.8802.1.1.2.1.4.1.1.9") {
            feed([{ oid: "1.0.8802.1.1.2.1.4.1.1.9.0.1.1", value: "SW-DISTRIB-01" }]);
          } else if (rootOid === "1.0.8802.1.1.2.1.4.1.1.7") {
            feed([{ oid: "1.0.8802.1.1.2.1.4.1.1.7.0.1.1", value: "TenGigabitEthernet1/1/1" }]);
          } else if (rootOid === "1.0.8802.1.1.2.1.4.1.1.5") {
            feed([
              { oid: "1.0.8802.1.1.2.1.4.1.1.5.0.1.1", value: Buffer.from("001122334455", "hex") },
            ]);
          } else if (rootOid === "1.3.6.1.4.1.9.9.23.1.2.1.1.6") {
            feed([{ oid: "1.3.6.1.4.1.9.9.23.1.2.1.1.6.2.1", value: "SEP001122334455" }]);
          } else if (rootOid === "1.3.6.1.4.1.9.9.23.1.2.1.1.7") {
            feed([{ oid: "1.3.6.1.4.1.9.9.23.1.2.1.1.7.2.1", value: "Port 1" }]);
          }
          done();
        },
      } as any);

      try {
        const sw = await crawlSwitchLldpCdp("10.0.0.1", { subnetCidr: "10.0.0.0/24" });
        expect(sw).toBeDefined();
        expect(sw?.vendor).toBe("Cisco Systems");
        expect(sw?.deviceType).toBe("SWITCH");
        expect(sw?.uSize).toBe(1);
        expect(sw?.lldpNeighbors.length).toBe(1);
        expect(sw?.cdpNeighbors.length).toBe(1);
      } finally {
        createSessionSpy.mockRestore();
      }
    });

    it("crawlSwitchLldpCdp classifie correctement une borne Wi-Fi, un serveur et un firewall", async () => {
      // 1. Borne Wi-Fi
      let sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "AP-HALL" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "ArubaOS Access Point AP-515" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.14823.1.2.85" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      let spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const ap = await crawlSwitchLldpCdp("10.0.0.2", { subnetCidr: "10.0.0.0/24" });
      expect(ap?.deviceType).toBe("ACCESS_POINT");
      expect(ap?.uSize).toBe(0);
      expect(ap?.ports.length).toBe(1);
      expect(ap?.ports[0]?.portName).toBe("eth0");
      spy.mockRestore();

      // 2. Serveur Dell PowerEdge
      sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "SRV-HYPERVISOR" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "Linux Ubuntu 22.04 PowerEdge R740" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.8072.3.2.10" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const srv = await crawlSwitchLldpCdp("10.0.0.3", { subnetCidr: "10.0.0.0/24" });
      expect(srv?.deviceType).toBe("SERVER");
      expect(srv?.uSize).toBe(2);
      expect(srv?.ports.length).toBe(4);
      spy.mockRestore();

      // 3. Firewall Fortinet
      sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "FW-EDGE" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "Fortinet FortiGate-60F v7.2" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.12356.101.1" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const fw = await crawlSwitchLldpCdp("10.0.0.4", { subnetCidr: "10.0.0.0/24" });
      expect(fw?.deviceType).toBe("ROUTER");
      expect(fw?.uSize).toBe(1);
      expect(fw?.ports.length).toBe(10);
      spy.mockRestore();

      // 4. Châssis 4U (Cisco 9400 48P)
      sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "SW-CHASSIS" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "Cisco Catalyst 9400 Series 48P Modular" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.9.1.2222" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const chassis = await crawlSwitchLldpCdp("10.0.0.5", { subnetCidr: "10.0.0.0/24" });
      expect(chassis?.uSize).toBe(4);
      expect(chassis?.ports.length).toBe(48);
      spy.mockRestore();
    });

    it("crawlSwitchLldpCdp gère les commutateurs 8P, 16P, 52P et les constructeurs Zyxel/Ubiquiti", async () => {
      // 8 Ports
      let sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "SW-8" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "Zyxel GS1900-8HP Switch 8P" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.890.1.1" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      let spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const sw8 = await crawlSwitchLldpCdp("10.0.0.8", { subnetCidr: "10.0.0.0/24" });
      expect(sw8?.vendor).toBe("Zyxel");
      expect(sw8?.ports.length).toBe(8);
      spy.mockRestore();

      // 16 Ports
      sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "SW-16" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "Ubiquiti UniFi Switch 16P" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.41112.1.1" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const sw16 = await crawlSwitchLldpCdp("10.0.0.16", { subnetCidr: "10.0.0.0/24" });
      expect(sw16?.vendor).toBe("Ubiquiti");
      expect(sw16?.ports.length).toBe(16);
      spy.mockRestore();

      // 52 Ports
      sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "SW-52" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "Aruba 2930F 52G PoE Switch" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.11.2.3.7.11" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const sw52 = await crawlSwitchLldpCdp("10.0.0.52", { subnetCidr: "10.0.0.0/24" });
      expect(sw52?.ports.length).toBe(52);
      spy.mockRestore();

      // Onduleur (UPS APC)
      sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "UPS-SALLE-SERVEUR" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "APC Smart-UPS 1500 Onduleur" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.318.1.3.7" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const ups = await crawlSwitchLldpCdp("10.0.0.100", { subnetCidr: "10.0.0.0/24" });
      expect(ups?.uSize).toBe(2);
      expect(ups?.ports.length).toBe(1);
      expect(ups?.ports[0]?.portName).toBe("mgmt0");
      expect(ups?.sysName).toBe("UPS-SALLE-SERVEUR");
      spy.mockRestore();

      // Caméra de surveillance Hikvision
      sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "CAM-ENTREE-NORD" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "Hikvision IP Camera Surveillance Dome" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.39165.1.1" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const cam = await crawlSwitchLldpCdp("10.0.0.101", { subnetCidr: "10.0.0.0/24" });
      expect(cam?.uSize).toBe(0);
      expect(cam?.ports.length).toBe(1);
      expect(cam?.ports[0]?.portName).toBe("eth0");
      spy.mockRestore();

      // Workstation client
      sessionMock = {
        close: vi.fn(),
        get: (_oids: string[], cb: any) =>
          cb(null, [
            { oid: "1.3.6.1.2.1.1.5.0", value: "PC-FINANCE-01" },
            { oid: "1.3.6.1.2.1.1.1.0", value: "Dell OptiPlex 7090 Workstation" },
            { oid: "1.3.6.1.2.1.1.2.0", value: "1.3.6.1.4.1.674.10892.5" },
            { oid: "1.3.6.1.2.1.1.3.0", value: 1000 },
          ]),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      };
      spy = vi.spyOn(snmp, "createSession").mockReturnValue(sessionMock as any);
      const pc = await crawlSwitchLldpCdp("10.0.0.102", { subnetCidr: "10.0.0.0/24" });
      expect(pc?.deviceType).toBe("WORKSTATION");
      expect(pc?.uSize).toBe(0);
      expect(pc?.ports.length).toBe(1);
      expect(pc?.ports[0]?.portName).toBe("eth0");
      spy.mockRestore();
    });

    it("crawlSwitchLldpCdp retourne null en cas d'erreur de session SNMP", async () => {
      const spy = vi.spyOn(snmp, "createSession").mockReturnValue({
        close: vi.fn(),
        get: (_oids: string[], cb: any) => cb(new Error("Host down"), []),
        subtree: (_oid: string, _feed: any, done: any) => done(),
      } as any);

      const sw = await crawlSwitchLldpCdp("10.0.0.99", { subnetCidr: "10.0.0.0/24" });
      expect(sw).toBeNull();
      spy.mockRestore();
    });
  });

  describe("5. Extraction FDB (extractSwitchFdb)", () => {
    it("extrait les entrées FDB standard et Q-BRIDGE multi-VLAN", async () => {
      const spy = vi.spyOn(snmp, "createSession").mockReturnValue({
        close: vi.fn(),
        subtree: (rootOid: string, feed: (vbs: any[]) => void, done: (err?: any) => void) => {
          if (rootOid === "1.3.6.1.2.1.17.1.4.1.2") {
            // dot1dBasePortIfIndex : bridgePort 1 -> ifIndex 10
            feed([{ oid: "1.3.6.1.2.1.17.1.4.1.2.1", value: 10 }]);
          } else if (rootOid === "1.3.6.1.2.1.17.4.3.1.2") {
            // dot1dTpFdbPort : standard
            feed([{ oid: "1.3.6.1.2.1.17.4.3.1.2.0.26.161.1.2.3", value: 1 }]);
          } else if (rootOid === "1.3.6.1.2.1.17.7.1.2.2.1.2") {
            // dot1qTpFdbPort : Q-BRIDGE VLAN 20
            feed([{ oid: "1.3.6.1.2.1.17.7.1.2.2.1.2.20.0.26.161.1.2.4", value: 1 }]);
          }
          done();
        },
      } as any);

      const entries = await extractSwitchFdb("10.0.0.1", { subnetCidr: "10.0.0.0/24" });
      expect(entries.length).toBe(2);
      expect(entries[0]?.macAddress).toBe("00:1A:A1:01:02:03");
      expect(entries[0]?.ifIndex).toBe(10);
      expect(entries[1]?.vlanId).toBe(20);

      spy.mockRestore();
    });

    it("gère gracieusement les erreurs d'interrogation FDB", async () => {
      const spy = vi.spyOn(snmp, "createSession").mockReturnValue({
        close: vi.fn(),
        subtree: (_rootOid: string, _feed: any, done: any) => done(new Error("FDB error")),
      } as any);

      const entries = await extractSwitchFdb("10.0.0.1", { subnetCidr: "10.0.0.0/24" });
      expect(entries).toEqual([]);

      spy.mockRestore();
    });
  });

  describe("6. Sonde Réseau & Balayage Ping (ping-sweep)", () => {
    it("expandCidr développe les sous-réseaux /28, /30 et traite les entrées invalides", () => {
      const ips28 = expandCidr("10.0.0.0/28");
      expect(ips28.length).toBe(14);

      const ips30 = expandCidr("10.0.0.0/30");
      expect(ips30.length).toBe(2);

      const invalidFallback = expandCidr("not-an-ip/24");
      expect(invalidFallback).toEqual(["not-an-ip"]);

      const singleIp = expandCidr("192.168.1.50");
      expect(singleIp).toEqual(["192.168.1.50"]);
    });

    it("getSystemArpTable extrait et filtre les adresses MAC et ignore broadcast / multicast", async () => {
      const table = await getSystemArpTable();
      expect(table).toBeInstanceOf(Map);
    });

    it("resolveReverseDns gère les adresses résolues et non configurées", async () => {
      const spy = vi.spyOn(dns.promises, "reverse").mockResolvedValue(["host-test.local"]);
      const hostname = await resolveReverseDns("10.0.0.1");
      expect(hostname).toBe("host-test.local");
      spy.mockRestore();

      const failSpy = vi.spyOn(dns.promises, "reverse").mockRejectedValue(new Error("NXDOMAIN"));
      const empty = await resolveReverseDns("10.0.0.99");
      expect(empty).toBeUndefined();
      failSpy.mockRestore();
    });

    it("executePingSweep balaye une adresse IP avec notification de progression", async () => {
      let progressCalls = 0;
      const results = await executePingSweep("127.0.0.1/32", {
        timeoutMs: 100,
        concurrency: 1,
        onProgress: () => {
          progressCalls++;
        },
      });

      expect(Array.isArray(results)).toBe(true);
      expect(progressCalls).toBeGreaterThanOrEqual(1);
    }, 15000);
  });

  describe("7. Pipeline de Découverte de Bout en Bout (runDiscoveryPipeline)", () => {
    it("exécute avec succès les 4 passes du pipeline de découverte et persiste les résultats", async () => {
      await ensureDiscoveryTables();
      const db = await getDb();

      // 1. Créer un job de découverte initial
      const [job] = await db
        .insert(discoveryJobs)
        .values({
          subnetCidr: "127.0.0.1/32",
          snmpVersion: "v2c",
          options: { snmpCommunity: "public", pingTimeoutMs: 200 },
        })
        .returning();

      expect(job).toBeDefined();

      // 2. Exécuter le pipeline complet
      const result = await runDiscoveryPipeline(job!.id, {
        subnetCidr: "127.0.0.1/32",
        snmpCommunity: "public",
        snmpVersion: "v2c",
        pingTimeoutMs: 150,
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBe(job!.id);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // 3. Vérifier la mise à jour du statut en base
      const [updatedJob] = await db
        .select()
        .from(discoveryJobs)
        .where(eq(discoveryJobs.id, job!.id));

      expect(updatedJob?.status).toBe("COMPLETED");
      expect(updatedJob?.currentPass).toBe(4);

      // 4. Vérifier les journaux (discovery_logs)
      const logs = await db.select().from(discoveryLogs).where(eq(discoveryLogs.jobId, job!.id));

      expect(logs.length).toBeGreaterThanOrEqual(4);
    }, 25000);

    it("gère gracieusement les échecs de pipeline et enregistre l'erreur en base", async () => {
      await ensureDiscoveryTables();
      const db = await getDb();

      const [job] = await db
        .insert(discoveryJobs)
        .values({
          subnetCidr: "10.0.0.0/24",
          snmpVersion: "v2c",
        })
        .returning();

      const pingModule = await import("../ping-sweep");
      const sweepSpy = vi
        .spyOn(pingModule, "executePingSweep")
        .mockRejectedValueOnce(new Error("Panne critique réseau sonde"));

      const result = await runDiscoveryPipeline(job!.id, {
        subnetCidr: "10.0.0.0/24",
      });

      expect(result.success).toBe(false);
      expect(result.diffs).toEqual([]);

      const [failedJob] = await db
        .select()
        .from(discoveryJobs)
        .where(eq(discoveryJobs.id, job!.id));

      expect(failedJob?.status).toBe("FAILED");
      expect(failedJob?.error).toContain("Panne critique réseau sonde");

      sweepSpy.mockRestore();
    }, 15000);

    it("persiste les commutateurs, équipements découverts et connexions L2", async () => {
      await ensureDiscoveryTables();
      const db = await getDb();

      const [job] = await db
        .insert(discoveryJobs)
        .values({
          subnetCidr: "192.168.10.0/24",
          snmpVersion: "v2c",
        })
        .returning();

      const pingModule = await import("../ping-sweep");
      const crawlerModule = await import("../snmp-crawler");
      const fdbModule = await import("../fdb-resolver");

      const pingSpy = vi.spyOn(pingModule, "executePingSweep").mockResolvedValue([
        {
          ip: "192.168.10.1",
          mac: "00:81:C4:10:00:01",
          hostname: "SW-ACC-01",
          isAlive: true,
          responseTimeMs: 2,
          openPorts: [161],
          source: "TCP_PROBE",
        },
        {
          ip: "192.168.10.50",
          mac: "00:14:22:11:22:33",
          hostname: "PC-FINANCE-01",
          isAlive: true,
          responseTimeMs: 1,
          openPorts: [445],
          source: "ARP_LOCAL",
        },
      ]);

      const crawlSpy = vi.spyOn(crawlerModule, "crawlSwitchLldpCdp").mockResolvedValue({
        id: "sw-192-168-10-1",
        ip: "192.168.10.1",
        mac: "00:81:C4:10:00:01",
        sysName: "SW-ACC-01",
        sysDescr: "Cisco Catalyst 2960X",
        sysOid: "1.3.6.1.4.1.9.1.1234",
        vendor: "Cisco Systems",
        model: "WS-C2960X-24TS-L",
        deviceType: "SWITCH",
        uSize: 1,
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
            ifIndex: 24,
            portName: "Gi1/0/24",
            speedMbps: 1000,
            isUp: true,
            isUplink: true,
            fdbMacs: [],
          },
        ],
        lldpNeighbors: [
          {
            localPortIndex: 24,
            localPortName: "Gi1/0/24",
            remoteSysName: "SW-CORE-01",
            remotePortId: "TenGigabitEthernet1/1/1",
            remoteChassisId: "00:11:22:33:44:55",
          },
        ],
        cdpNeighbors: [],
        fdbEntries: [],
      });

      const fdbSpy = vi.spyOn(fdbModule, "extractSwitchFdb").mockResolvedValue([
        {
          macAddress: "00:14:22:11:22:33",
          bridgePort: 1,
          ifIndex: 1,
          portName: "Gi1/0/1",
          vlanId: 10,
          status: "learned",
        },
      ]);

      try {
        const result = await runDiscoveryPipeline(job!.id, {
          subnetCidr: "192.168.10.0/24",
        });

        expect(result.success).toBe(true);
        expect(result.devicesCount).toBeGreaterThanOrEqual(2);
        expect(result.connectionsCount).toBeGreaterThanOrEqual(1);

        const savedDevices = await db
          .select()
          .from(discoveredDevices)
          .where(eq(discoveredDevices.jobId, job!.id));

        expect(savedDevices.length).toBeGreaterThanOrEqual(2);

        const savedLinks = await db
          .select()
          .from(discoveredConnections)
          .where(eq(discoveredConnections.jobId, job!.id));

        expect(savedLinks.length).toBeGreaterThanOrEqual(1);
      } finally {
        pingSpy.mockRestore();
        crawlSpy.mockRestore();
        fdbSpy.mockRestore();
      }
    }, 25000);
  });
});
