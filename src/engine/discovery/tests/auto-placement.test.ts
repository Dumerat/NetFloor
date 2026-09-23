import { describe, it, expect } from "vitest";
import {
  autoDeployDiscoveredTopology,
  inferDeviceAttributes,
  type DiscoveredDeviceInput,
  type DiscoveredConnectionInput,
} from "../auto-placement";

describe("Topology Auto-Placement & Auto-Wiring Engine (autoDeployDiscoveredTopology)", () => {
  it("qualifie précisément les types d'équipements réels (switches, serveurs, routeurs, postes, imprimantes)", () => {
    const sw = inferDeviceAttributes({
      id: "dev-sw-1",
      ipAddress: "10.10.30.3",
      macAddress: "38:21:C7:A1:B0:10",
      hostname: "SW-DC-ACCESS-01",
      model: "Aruba 2930F-24G Managed Switch (ArubaOS)",
    });
    expect(sw.deviceType).toBe("SWITCH");
    expect(sw.isRackable).toBe(true);
    expect(sw.portsCount).toBe(24);

    const srv = inferDeviceAttributes({
      id: "dev-srv-1",
      ipAddress: "10.10.30.20",
      macAddress: "00:15:5D:12:34:56",
      hostname: "SRV-NAS-STORAGE",
      model: "TrueNAS Enterprise Storage Server (ZFS)",
    });
    expect(srv.deviceType).toBe("SERVER");
    expect(srv.isRackable).toBe(true);
    expect(srv.uSize).toBe(2);

    const printer = inferDeviceAttributes({
      id: "dev-prn-1",
      ipAddress: "10.10.30.50",
      macAddress: "00:00:85:AA:BB:CC",
      hostname: "PRINTER-HP-DC-01",
      model: "HP LaserJet Enterprise M608",
    });
    expect(printer.deviceType).toBe("PRINTER");
    expect(printer.isRackable).toBe(false);

    const pc = inferDeviceAttributes({
      id: "dev-pc-1",
      ipAddress: "10.10.30.101",
      macAddress: "00:14:22:11:22:33",
      hostname: "PC-SECOPS-ADMIN",
      model: "Dell OptiPlex 7090 Windows 11 Enterprise",
    });
    expect(pc.deviceType).toBe("WORKSTATION");
    expect(pc.isRackable).toBe(false);
  });

  it("déploie automatiquement le lab 10.10.30.0/24 (11 équipements, 2 switches, 4 serveurs, imprimante, postes) avec baie et câblage intégral", () => {
    // Topologie réelle scannée par l'utilisateur
    const devices: DiscoveredDeviceInput[] = [
      {
        id: "d-cisco",
        ipAddress: "10.10.30.4",
        macAddress: "00:81:C4:F2:30:01",
        hostname: "SW-CORE-01",
        model: "Cisco Catalyst 9500-24Y4C 10G Switch (Cisco IOS-XE)",
        isManagedSwitch: true,
      },
      {
        id: "d-aruba",
        ipAddress: "10.10.30.3",
        macAddress: "38:21:C7:A1:B0:10",
        hostname: "SW-DC-ACCESS-01",
        model: "Aruba 2930F-24G Managed Switch (ArubaOS)",
        isManagedSwitch: true,
      },
      {
        id: "d-gw",
        ipAddress: "10.10.30.1",
        macAddress: "52:54:00:12:34:56",
        hostname: "gw-core",
        model: "Linux L3 Inter-VLAN Gateway / Firewall",
      },
      {
        id: "d-srv-web",
        ipAddress: "10.10.30.10",
        macAddress: "52:54:00:10:00:10",
        hostname: "SRV-WEB-PROD-01",
        model: "Linux Ubuntu 22.04 LTS (Nginx Web Server)",
      },
      {
        id: "d-srv-nas",
        ipAddress: "10.10.30.20",
        macAddress: "52:54:00:10:00:20",
        hostname: "SRV-NAS-STORAGE",
        model: "TrueNAS Enterprise Storage Server (ZFS)",
      },
      {
        id: "d-srv-esxi",
        ipAddress: "10.10.30.30",
        macAddress: "52:54:00:10:00:30",
        hostname: "SRV-ESXI-CLUSTER-01",
        model: "VMware ESXi 8.0.2 ProLiant DL380 Gen10",
      },
      {
        id: "d-srv-pg",
        ipAddress: "10.10.30.40",
        macAddress: "52:54:00:10:00:40",
        hostname: "SRV-POSTGRES-MAIN",
        model: "Debian Linux PostgreSQL 16 Database Server",
      },
      {
        id: "d-printer",
        ipAddress: "10.10.30.50",
        macAddress: "00:00:85:12:34:56",
        hostname: "PRINTER-HP-DC-01",
        model: "HP LaserJet Enterprise M608 Network Printer",
      },
      {
        id: "d-pc1",
        ipAddress: "10.10.30.101",
        macAddress: "00:14:22:99:88:01",
        hostname: "PC-SECOPS-ADMIN",
        model: "Dell OptiPlex 7090 Windows 11 Enterprise",
      },
      {
        id: "d-pc2",
        ipAddress: "10.10.30.102",
        macAddress: "00:14:22:99:88:02",
        hostname: "PC-DEVOPS-LEAD",
        model: "Lenovo ThinkCentre M90q Ubuntu Desktop",
      },
    ];

    const connections: DiscoveredConnectionInput[] = [
      // Trunk LLDP inter-switches
      {
        id: "c-lldp-1",
        sourceDeviceId: "d-aruba",
        sourcePortName: "Gi1/0/1",
        targetDeviceId: "d-cisco",
        targetPortName: "Gi1/0/24",
        connectionType: "LLDP_BACKBONE",
        vlanId: 1,
      },
      // Raccordements FDB port-à-port
      {
        id: "c-fdb-web",
        sourceDeviceId: "d-aruba",
        sourcePortName: "Gi1/0/2",
        targetDeviceId: "d-srv-web",
        targetPortName: "eth0",
        connectionType: "FDB_ACCESS",
        vlanId: 20,
      },
      {
        id: "c-fdb-nas",
        sourceDeviceId: "d-aruba",
        sourcePortName: "Gi1/0/3",
        targetDeviceId: "d-srv-nas",
        targetPortName: "eth0",
        connectionType: "FDB_ACCESS",
        vlanId: 20,
      },
      {
        id: "c-fdb-esxi",
        sourceDeviceId: "d-aruba",
        sourcePortName: "Gi1/0/4",
        targetDeviceId: "d-srv-esxi",
        targetPortName: "vmnic0",
        connectionType: "FDB_ACCESS",
        vlanId: 20,
      },
      {
        id: "c-fdb-pg",
        sourceDeviceId: "d-aruba",
        sourcePortName: "Gi1/0/5",
        targetDeviceId: "d-srv-pg",
        targetPortName: "eth0",
        connectionType: "FDB_ACCESS",
        vlanId: 20,
      },
      {
        id: "c-fdb-prn",
        sourceDeviceId: "d-aruba",
        sourcePortName: "Gi1/0/6",
        targetDeviceId: "d-printer",
        connectionType: "FDB_ACCESS",
        vlanId: 40,
      },
      {
        id: "c-fdb-pc1",
        sourceDeviceId: "d-aruba",
        sourcePortName: "Gi1/0/7",
        targetDeviceId: "d-pc1",
        connectionType: "FDB_ACCESS",
        vlanId: 20,
      },
      {
        id: "c-fdb-pc2",
        sourceDeviceId: "d-aruba",
        sourcePortName: "Gi1/0/8",
        targetDeviceId: "d-pc2",
        connectionType: "FDB_ACCESS",
        vlanId: 20,
      },
    ];

    const result = autoDeployDiscoveredTopology({
      devices,
      connections,
      existingRacks: [],
      existingNodes: [],
    });

    // 1. Validation de la baie
    expect(result.racks.length).toBe(1);
    expect(result.racksCreatedCount).toBe(1);
    const mainRack = result.racks[0]!;
    expect(mainRack.name).toBe("BAIE-PRINCIPALE-DSI");
    expect(mainRack.uHeight).toBe(42);

    // 2. Vérification des équipements dans le châssis de baie
    const rackDevices = mainRack.devices || [];
    expect(rackDevices.length).toBe(7); // Cisco, Aruba, gw-core, 4 serveurs

    const ciscoDev = rackDevices.find((d) => d.id === "d-cisco");
    expect(ciscoDev).toBeDefined();
    expect(ciscoDev?.deviceType).toBe("SWITCH");

    const arubaDev = rackDevices.find((d) => d.id === "d-aruba");
    expect(arubaDev).toBeDefined();
    expect(arubaDev?.deviceType).toBe("SWITCH");

    const gwDev = rackDevices.find((d) => d.id === "d-gw");
    expect(gwDev).toBeDefined();
    expect(gwDev?.deviceType).toBe("FIREWALL");

    const esxiDev = rackDevices.find((d) => d.id === "d-srv-esxi");
    expect(esxiDev).toBeDefined();
    expect(esxiDev?.deviceType).toBe("SERVER");

    // 3. Vérification des équipements sur le plancher (Bureaux + Prises associées + Périphériques)
    expect(result.nodes.length).toBe(5); // 2 Postes Bureaux + 2 Prises RJ45 associées + 1 Imprimante
    const printerNode = result.nodes.find((n) => n.id === "d-printer");
    expect(printerNode).toBeDefined();
    expect(printerNode?.subType).toBe("PRINTER_STATION");
    expect(printerNode?.outletRole).toBe("PRINTER");
    expect(printerNode?.isPatched).toBe(true);
    expect(printerNode?.connectedRackId).toBe(mainRack.id);
    expect(printerNode?.connectedSwitchPort).toBe("Gi1/0/6");
    expect(printerNode?.vlanId).toBe(40);

    const pc1Node = result.nodes.find((n) => n.id === "d-pc1");
    expect(pc1Node).toBeDefined();
    expect(pc1Node?.type).toBe("DESK");
    expect(pc1Node?.subType).toBe("DESK_SOLO");
    expect(pc1Node?.isPatched).toBe(true);
    expect(pc1Node?.connectedRackId).toBe(mainRack.id);
    expect(pc1Node?.connectedSwitchPort).toBe("Gi1/0/7");

    const pc1Outlet = result.nodes.find((n) => n.id === "outlet-d-pc1");
    expect(pc1Outlet).toBeDefined();
    expect(pc1Outlet?.type).toBe("WALL_OUTLET");
    expect(pc1Outlet?.attachedToDeskId).toBe("d-pc1");
    expect(pc1Outlet?.isPatched).toBe(true);
    expect(pc1Outlet?.connectedSwitchPort).toBe("Gi1/0/7");

    const pc2Node = result.nodes.find((n) => n.id === "d-pc2");
    expect(pc2Node).toBeDefined();
    expect(pc2Node?.type).toBe("DESK");
    expect(pc2Node?.subType).toBe("DESK_SOLO");
    expect(pc2Node?.isPatched).toBe(true);
    expect(pc2Node?.connectedRackId).toBe(mainRack.id);
    expect(pc2Node?.connectedSwitchPort).toBe("Gi1/0/8");

    const pc2Outlet = result.nodes.find((n) => n.id === "outlet-d-pc2");
    expect(pc2Outlet).toBeDefined();
    expect(pc2Outlet?.type).toBe("WALL_OUTLET");
    expect(pc2Outlet?.attachedToDeskId).toBe("d-pc2");
    expect(pc2Outlet?.isPatched).toBe(true);
    expect(pc2Outlet?.connectedSwitchPort).toBe("Gi1/0/8");

    // 4. Vérification des patches internes de baie (LLDP trunk et liaisons serveurs)
    const patches = mainRack.patches || [];
    const lldpPatch = patches.find((p) => p.id === "patch-lldp-c-lldp-1");
    expect(lldpPatch).toBeDefined();
    expect(lldpPatch?.cableType).toBe("DAC_10G");
    expect(lldpPatch?.sourcePort).toBe("Gi1/0/1");
    expect(lldpPatch?.targetPort).toBe("Gi1/0/24");

    const srvWebPatch = patches.find((p) => p.id === "patch-srv-c-fdb-web");
    expect(srvWebPatch).toBeDefined();
    expect(srvWebPatch?.sourcePort).toBe("Gi1/0/2");
    expect(srvWebPatch?.targetPort).toBe("eth0");
  });

  it("alloue automatiquement plusieurs baies (Multi-baies) si le volume d'équipements dépasse la capacité d'une baie 42U", () => {
    // 25 serveurs de 2U chacun = 50U (> 38U de capacité utilisable)
    const heavyDevices: DiscoveredDeviceInput[] = Array.from({ length: 25 }, (_, i) => ({
      id: `dev-srv-heavy-${i + 1}`,
      ipAddress: `10.10.30.${i + 10}`,
      macAddress: `00:15:5D:99:00:${String(i + 1).padStart(2, "0")}`,
      hostname: `SRV-CLUSTER-NODE-${i + 1}`,
      model: "ProLiant DL380 2U Compute Node",
      deviceType: "SERVER",
    }));

    const result = autoDeployDiscoveredTopology({
      devices: heavyDevices,
      connections: [],
      existingRacks: [],
      existingNodes: [],
    });

    expect(result.racks.length).toBeGreaterThanOrEqual(2);
    expect(result.racksCreatedCount).toBeGreaterThanOrEqual(2);
    expect(result.racks[0]?.name).toBe("BAIE-RESEAU-01");
    expect(result.racks[1]?.name).toBe("BAIE-SERVEURS-02");
    expect(result.racks[1]?.xMm).toBeGreaterThan(result.racks[0]!.xMm);
  });
});
