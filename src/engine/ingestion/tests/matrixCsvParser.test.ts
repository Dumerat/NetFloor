import { describe, it, expect } from "vitest";
import {
  isWorkstationOrDeskName,
  classifyIotDevice,
  parseMatrixCsv,
  applyMatrixImport,
} from "../matrixCsvParser";
import { RackDisplay } from "@/components/canvas/EquipmentLayer";

describe("matrixCsvParser - Workstation & IoT Ingestion", () => {
  describe("isWorkstationOrDeskName", () => {
    it("should correctly identify PC and workstation identifiers", () => {
      expect(isWorkstationOrDeskName("PC DIR")).toBe(true);
      expect(isWorkstationOrDeskName("pc dir")).toBe(true);
      expect(isWorkstationOrDeskName("PC-FINANCE-01")).toBe(true);
      expect(isWorkstationOrDeskName("PC_RH")).toBe(true);
      expect(isWorkstationOrDeskName("Poste Direction")).toBe(true);
      expect(isWorkstationOrDeskName("Bureau 102")).toBe(true);
      expect(isWorkstationOrDeskName("Desk-A")).toBe(true);
      expect(isWorkstationOrDeskName("DIR")).toBe(true);
      expect(isWorkstationOrDeskName("Direction")).toBe(true);
      expect(isWorkstationOrDeskName("Laptop Commercial")).toBe(true);
    });

    it("should not confuse network infrastructure, outlets or IoT with desks", () => {
      expect(isWorkstationOrDeskName("PRISE-01")).toBe(false);
      expect(isWorkstationOrDeskName("Prise PC DIR")).toBe(false);
      expect(isWorkstationOrDeskName("SW-CORE-01")).toBe(false);
      expect(isWorkstationOrDeskName("PP-ETAGE-1")).toBe(false);
      expect(isWorkstationOrDeskName("AP-ETAGE-1")).toBe(false);
      expect(isWorkstationOrDeskName("CAM-PARKING")).toBe(false);
      expect(isWorkstationOrDeskName("IMP-COMPTA")).toBe(false);
      expect(isWorkstationOrDeskName("IOT-SENSOR-01")).toBe(false);
    });
  });

  describe("classifyIotDevice", () => {
    it("should classify Wi-Fi APs with radio properties", () => {
      const wifi = classifyIotDevice("AP-ETAGE-1");
      expect(wifi).not.toBeNull();
      expect(wifi?.subType).toBe("WIFI_AP");
      expect(wifi?.role).toBe("WIFI");
      expect(wifi?.defaultProperties.deviceCategory).toBe("WIFI_AP");
      expect(wifi?.defaultProperties.coverageRadiusM).toBeGreaterThan(0);
      expect(wifi?.defaultProperties.wifiStandard).toContain("Wi-Fi 6");
    });

    it("should classify IP Cameras with FOV and optics properties", () => {
      const cam = classifyIotDevice("CAM-ACCUEIL-01");
      expect(cam).not.toBeNull();
      expect(cam?.subType).toBe("CAMERA_IP");
      expect(cam?.role).toBe("CAMERA");
      expect(cam?.defaultProperties.deviceCategory).toBe("CAMERA");
      expect(cam?.defaultProperties.fovDegrees).toBe(110);
      expect(cam?.defaultProperties.resolution).toBe("4K Ultra HD");
    });

    it("should classify Printers with toner metrics", () => {
      const printer = classifyIotDevice("IMP-ETAGE-2");
      expect(printer).not.toBeNull();
      expect(printer?.subType).toBe("PRINTER_STATION");
      expect(printer?.role).toBe("PRINTER");
      expect(printer?.defaultProperties.deviceCategory).toBe("PRINTER");
      expect(printer?.defaultProperties.tonerCyan).toBeDefined();
      expect(printer?.defaultProperties.tonerBlack).toBeDefined();
    });

    it("should classify IoT Sensors with battery and telemetry", () => {
      const sensor = classifyIotDevice("IOT-CLIMAT-01");
      expect(sensor).not.toBeNull();
      expect(sensor?.defaultProperties.deviceCategory).toBe("IOT_SENSOR");
      expect(sensor?.defaultProperties.batteryLevelPercent).toBe(95);
    });
  });

  describe("applyMatrixImport", () => {
    const dummyRack: RackDisplay = {
      id: "rack-01",
      name: "BAIE-01",
      xMm: 1000,
      yMm: 1000,
      widthMm: 800,
      depthMm: 1000,
      uHeight: 42,
      devices: [],
    };

    it("should create a desk and an attached outlet when importing 'PC DIR'", () => {
      const csv = `Prise_ID;Bureau_ID;Utilisateur;IP_Machine;MAC;VLAN_ID;Baie;Switch_Nom;Port_Switch
PC DIR;;Directeur Général;192.168.10.50;00:11:22:33:44:55;10;BAIE-01;SW-01;Gi1/0/5`;

      const parseResult = parseMatrixCsv(csv);
      expect(parseResult.isValid).toBe(true);
      expect(parseResult.validRows.length).toBe(1);

      const importResult = applyMatrixImport(parseResult.validRows, [], [dummyRack]);

      // Should create unpositioned desk and unpositioned outlet
      expect(importResult.unpositionedNodes.length).toBe(2);

      const deskNode = importResult.unpositionedNodes.find((n) => n.type === "DESK");
      const outletNode = importResult.unpositionedNodes.find((n) => n.type === "WALL_OUTLET");

      expect(deskNode).toBeDefined();
      expect(deskNode?.name).toBe("Bureau PC DIR");
      expect(deskNode?.assignedPerson).toBe("Directeur Général");
      expect(deskNode?.category).toBe("FURNITURE");

      expect(outletNode).toBeDefined();
      expect(outletNode?.name).toBe("Prise PC DIR");
      expect(outletNode?.attachedToDeskId).toBe(deskNode?.id);
      expect(outletNode?.ipAddress).toBe("192.168.10.50");
      expect(outletNode?.vlanId).toBe(10);
      expect(outletNode?.connectedSwitchPort).toBe("Gi1/0/5");
    });

    it("should create categorized IoT terminals with custom properties", () => {
      const csv = `Prise_ID;Bureau_ID;Utilisateur;IP_Machine;MAC;VLAN_ID;Baie;Switch_Nom;Port_Switch
AP-OPENSPACE;;;192.168.50.10;AA:BB:CC:DD:EE:01;50;BAIE-01;SW-01;Gi1/0/10
CAM-PARKING;;;192.168.50.20;AA:BB:CC:DD:EE:02;50;BAIE-01;SW-01;Gi1/0/11
IMP-DIRECTION;;;192.168.40.10;AA:BB:CC:DD:EE:03;40;BAIE-01;SW-01;Gi1/0/12`;

      const parseResult = parseMatrixCsv(csv);
      expect(parseResult.isValid).toBe(true);
      expect(parseResult.validRows.length).toBe(3);

      const importResult = applyMatrixImport(parseResult.validRows, [], [dummyRack]);
      expect(importResult.unpositionedNodes.length).toBe(3);

      const ap = importResult.unpositionedNodes.find((n) => n.name === "AP-OPENSPACE");
      expect(ap).toBeDefined();
      expect(ap?.category).toBe("IOT");
      expect(ap?.subType).toBe("WIFI_AP");
      expect(ap?.iotProperties?.deviceCategory).toBe("WIFI_AP");
      expect(ap?.iotProperties?.ssid).toBe("NetFloor-Corp-WiFi");

      const cam = importResult.unpositionedNodes.find((n) => n.name === "CAM-PARKING");
      expect(cam).toBeDefined();
      expect(cam?.category).toBe("IOT");
      expect(cam?.subType).toBe("CAMERA_IP");
      expect(cam?.iotProperties?.deviceCategory).toBe("CAMERA");
      expect(cam?.iotProperties?.fovDegrees).toBe(110);

      const printer = importResult.unpositionedNodes.find((n) => n.name === "IMP-DIRECTION");
      expect(printer).toBeDefined();
      expect(printer?.category).toBe("IOT");
      expect(printer?.subType).toBe("PRINTER_STATION");
      expect(printer?.iotProperties?.deviceCategory).toBe("PRINTER");
      expect(printer?.iotProperties?.tonerBlack).toBe(90);
    });
  });
});
