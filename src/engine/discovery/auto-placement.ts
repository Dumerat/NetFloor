/**
 * Moteur d'Auto-Placement et d'Auto-Câblage Topologique NetFloor Architect
 *
 * Ce module transforme une topologie réseau découverte (équipements scannés,
 * commutateurs managés, liaisons dorsales LLDP et raccordements de ports FDB)
 * en une disposition spatiale complète et ordonnée sur le plan 2D :
 * 1. Allocation d'une ou plusieurs baies 42U selon le volume d'équipements rackables
 * 2. Implantation des commutateurs, passerelles et serveurs dans les châssis (slots U)
 * 3. Disposition spatiale ordonnée des postes de travail et imprimantes en îlots réguliers
 * 4. Auto-câblage physique complet (ports de switchs câblés, patches internes et trunks LLDP)
 */

import type {
  RackDisplay,
  RackDeviceItem,
  RackDeviceBrand,
  NodeDisplay,
  OutletRole,
  NodeSubType,
} from "@/components/canvas/EquipmentLayer";
import type { ScannedDeviceType } from "@/components/ui/EquipmentPalette";
import type { InternalRackPatch } from "@/components/ui/CircuitInspector";

function inferBrand(m?: string | null): RackDeviceBrand {
  const norm = (m || "").toUpperCase();
  if (norm.includes("ARUBA")) return "ARUBA";
  if (norm.includes("CISCO")) return "CISCO";
  if (norm.includes("ZYXEL")) return "ZYXEL";
  if (norm.includes("UBIQUITI") || norm.includes("UNIFI")) return "UBIQUITI";
  if (norm.includes("FORTINET")) return "FORTINET";
  return "GENERIC";
}

export interface DiscoveredDeviceInput {
  id: string;
  ipAddress: string;
  macAddress: string;
  hostname?: string | null | undefined;
  manufacturer?: string | null | undefined;
  model?: string | null | undefined;
  deviceType?: string | null | undefined;
  sysDescr?: string | null | undefined;
  osVersion?: string | null | undefined;
  vlanId?: number | null | undefined;
  isManagedSwitch?: boolean | undefined;
  metadata?: Record<string, unknown> | null | undefined;
}

export interface DiscoveredConnectionInput {
  id: string;
  sourceDeviceId: string;
  sourcePortName: string;
  targetDeviceId: string;
  targetPortName?: string | null | undefined;
  connectionType:
    | "LLDP_BACKBONE"
    | "CDP_BACKBONE"
    | "FDB_ACCESS"
    | "VOIP_CASCADED"
    | "WIFI_CLIENT"
    | "CLOUD_MANAGED"
    | "MANUAL_OVERRIDE";
  vlanId?: number | null | undefined;
  confidenceScore?: number | undefined;
}

export interface AutoPlacementOptions {
  devices: DiscoveredDeviceInput[];
  connections: DiscoveredConnectionInput[];
  existingRacks?: RackDisplay[] | undefined;
  existingNodes?: NodeDisplay[] | undefined;
  floorBounds?: { widthMm: number; heightMm: number } | undefined;
}

export interface AutoPlacementResult {
  racks: RackDisplay[];
  nodes: NodeDisplay[];
  racksCreatedCount: number;
  devicesPlacedCount: number;
  cablesCreatedCount: number;
  summary: {
    racksCount: number;
    switchesInRacks: string[];
    serversInRacks: string[];
    workstationsOnFloor: string[];
    printersOnFloor: string[];
    accessPointsOnFloor: string[];
    otherOnFloor: string[];
    lldpTrunksCount: number;
    fdbAccessLinksCount: number;
  };
}

/**
 * Détermine le type et les attributs physiques d'un équipement scanné
 */
export function inferDeviceAttributes(d: DiscoveredDeviceInput): {
  deviceType: ScannedDeviceType;
  portsCount: number;
  uSize: number;
  isRackable: boolean;
  name: string;
} {
  const rawType = (d.deviceType || "").toUpperCase();
  const name =
    d.hostname ||
    (d.model ? `${d.model}-${d.ipAddress.split(".").pop()}` : `Équipement ${d.ipAddress}`);
  const combined = [d.hostname, d.model, d.sysDescr, d.manufacturer, name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // 1. Commutateur réseau
  if (
    d.isManagedSwitch ||
    rawType === "SWITCH" ||
    combined.includes("switch") ||
    combined.includes("catalyst") ||
    combined.includes("arubaos") ||
    combined.includes("2930") ||
    combined.includes("9300") ||
    combined.includes("9500") ||
    combined.includes("gs1920") ||
    combined.includes("procurve")
  ) {
    const is48p = combined.includes("48") || combined.includes("48p") || combined.includes("48g");
    return {
      deviceType: "SWITCH",
      portsCount: is48p ? 48 : 24,
      uSize: 1,
      isRackable: true,
      name,
    };
  }

  // 2. Routeur / Passerelle / Firewall
  if (
    rawType === "ROUTER" ||
    rawType === "FIREWALL" ||
    combined.includes("gateway") ||
    combined.includes("router") ||
    combined.includes("firewall") ||
    combined.includes("fortigate") ||
    combined.includes("palo alto") ||
    combined.includes("pfsense") ||
    combined.includes("gw-")
  ) {
    return {
      deviceType: "FIREWALL",
      portsCount: 10,
      uSize: 1,
      isRackable: true,
      name,
    };
  }

  // 3. Serveur physique / Hyperviseur / NAS
  if (
    rawType === "SERVER" ||
    combined.includes("server") ||
    combined.includes("srv-") ||
    combined.includes("esxi") ||
    combined.includes("truenas") ||
    combined.includes("nas") ||
    combined.includes("storage") ||
    combined.includes("proliant") ||
    combined.includes("poweredge") ||
    combined.includes("proxmox") ||
    combined.includes("dl380") ||
    combined.includes("r740")
  ) {
    return {
      deviceType: "SERVER",
      portsCount: 4,
      uSize: combined.includes("1u") ? 1 : 2,
      isRackable: true,
      name,
    };
  }

  // 4. Imprimante réseau
  if (
    rawType === "PRINTER" ||
    combined.includes("printer") ||
    combined.includes("laserjet") ||
    combined.includes("pagekeeper") ||
    combined.includes("copieur") ||
    combined.includes("imprimante")
  ) {
    return {
      deviceType: "PRINTER",
      portsCount: 1,
      uSize: 0,
      isRackable: false,
      name,
    };
  }

  // 5. Borne Wi-Fi
  if (
    rawType === "ACCESS_POINT" ||
    combined.includes("ap-") ||
    combined.includes("wifi") ||
    combined.includes("u6-pro") ||
    combined.includes("ap-515") ||
    combined.includes("unifi") ||
    combined.includes("aironet")
  ) {
    return {
      deviceType: "ACCESS_POINT",
      portsCount: 1,
      uSize: 0,
      isRackable: false,
      name,
    };
  }

  // 6. Caméra IP
  if (
    rawType === "CAMERA" ||
    combined.includes("camera") ||
    combined.includes("cam-") ||
    combined.includes("hikvision") ||
    combined.includes("dahua") ||
    combined.includes("axis")
  ) {
    return {
      deviceType: "CAMERA",
      portsCount: 1,
      uSize: 0,
      isRackable: false,
      name,
    };
  }

  // 7. Poste de travail / PC client (par défaut pour les autres)
  return {
    deviceType: "WORKSTATION",
    portsCount: 1,
    uSize: 0,
    isRackable: false,
    name,
  };
}

/**
 * Calcule l'auto-déploiement topologique complet
 */
export function autoDeployDiscoveredTopology(options: AutoPlacementOptions): AutoPlacementResult {
  const {
    devices,
    connections,
    existingRacks = [],
    existingNodes = [],
    floorBounds: _floorBounds = { widthMm: 60000, heightMm: 35000 },
  } = options;

  const summary = {
    racksCount: 0,
    switchesInRacks: [] as string[],
    serversInRacks: [] as string[],
    workstationsOnFloor: [] as string[],
    printersOnFloor: [] as string[],
    accessPointsOnFloor: [] as string[],
    otherOnFloor: [] as string[],
    lldpTrunksCount: 0,
    fdbAccessLinksCount: 0,
  };

  if (!devices || devices.length === 0) {
    return {
      racks: existingRacks,
      nodes: existingNodes,
      racksCreatedCount: 0,
      devicesPlacedCount: 0,
      cablesCreatedCount: 0,
      summary,
    };
  }

  // 1. Classification de tous les équipements découverts
  const classifiedDevices = devices.map((d) => {
    const attr = inferDeviceAttributes(d);
    return {
      raw: d,
      attr,
    };
  });

  const rackable = classifiedDevices.filter((item) => item.attr.isRackable);
  const floorItems = classifiedDevices.filter((item) => !item.attr.isRackable);

  // 2. Gestion et Dimensionnement des Baies (Multi-baies si nécessaire)
  const racksList: RackDisplay[] = existingRacks.map((r) => ({
    ...r,
    devices: [...(r.devices || [])],
    patches: [...(r.patches || [])],
  }));

  let racksCreatedCount = 0;
  const standardRackHeight = 42;
  const maxUsableUPerRack = 38; // Garde 4U pour PDU et guidage de câblage

  // Calcul du volume U total nécessaire
  const totalRackableU = rackable.reduce((sum, item) => sum + item.attr.uSize, 0);

  // Si aucune baie n'existe, en créer au moins une, ou plusieurs si le volume U dépasse la capacité
  if (racksList.length === 0) {
    const racksNeeded = Math.max(1, Math.ceil(totalRackableU / maxUsableUPerRack));
    const startX = 4000;
    const rackSpacingX = 1400; // 800mm de large + 600mm d'espacement

    for (let i = 0; i < racksNeeded; i++) {
      const rackName =
        racksNeeded === 1
          ? "BAIE-PRINCIPALE-DSI"
          : i === 0
            ? "BAIE-RESEAU-01"
            : `BAIE-SERVEURS-0${i + 1}`;

      racksList.push({
        id: `rack-auto-${i + 1}-${Date.now().toString(36)}`,
        name: rackName,
        xMm: startX + i * rackSpacingX,
        yMm: 4000,
        widthMm: 800,
        depthMm: 1000,
        uHeight: standardRackHeight,
        description: `Baie 42U auto-déployée pour le scan réseau`,
        devices: [],
        patches: [],
      });
      racksCreatedCount++;
    }
  }

  // Dictionnaire pour retrouver rapidement la baie et le rackDeviceId d'un équipement
  // Map: device.id (ou ip/mac) -> { rackId: string, rackDevice: RackDeviceItem }
  const deviceRackMapping = new Map<string, { rackId: string; rackDevice: RackDeviceItem }>();

  // 3. Répartition ordonnée des équipements rackables dans les baies
  // Trier les équipements rackables par rôle : 1. Firewall/Router, 2. Switch Core, 3. Switch Access, 4. Serveurs
  const sortedRackable = [...rackable].sort((a, b) => {
    const priority = (type: ScannedDeviceType, name: string) => {
      if (type === "FIREWALL" || name.toLowerCase().includes("gw")) return 1;
      if (
        type === "SWITCH" &&
        (name.toLowerCase().includes("core") || name.toLowerCase().includes("distrib"))
      )
        return 2;
      if (type === "SWITCH") return 3;
      if (type === "SERVER") return 4;
      return 5;
    };
    return priority(a.attr.deviceType, a.attr.name) - priority(b.attr.deviceType, b.attr.name);
  });

  // Fonction pour trouver le prochain slot U libre dans une baie
  const getNextAvailableSlotU = (
    rack: RackDisplay,
    uSize: number,
    preferredU?: number
  ): number | null => {
    const occupied = new Set<number>();
    (rack.devices || []).forEach((dev) => {
      const devSize = dev.uSize || 1;
      for (let s = dev.slotU - devSize + 1; s <= dev.slotU; s++) {
        occupied.add(s);
      }
    });

    const isRangeFree = (topU: number) => {
      const bottomU = topU - uSize + 1;
      if (bottomU < 1 || topU > rack.uHeight) return false;
      for (let u = bottomU; u <= topU; u++) {
        if (occupied.has(u)) return false;
      }
      return true;
    };

    if (preferredU && isRangeFree(preferredU)) {
      return preferredU;
    }

    // Chercher du haut vers le bas
    for (let u = rack.uHeight; u >= uSize; u--) {
      if (isRangeFree(u)) return u;
    }
    return null;
  };

  // Installer chaque équipement rackable dans la baie adéquate
  const currentRackIdx = 0;
  for (const { raw, attr } of sortedRackable) {
    // Si c'est un serveur et qu'une baie dédiée existe (ex: BAIE-SERVEURS), préférer celle-ci
    let targetRack = racksList[currentRackIdx]!;
    if (attr.deviceType === "SERVER" && racksList.length > 1) {
      targetRack = racksList[1] || racksList[0]!;
    }

    let slotU = getNextAvailableSlotU(targetRack, attr.uSize);

    // Si la baie actuelle est pleine, chercher dans les autres baies
    if (slotU === null) {
      for (let r = 0; r < racksList.length; r++) {
        const altRack = racksList[r]!;
        const altSlot = getNextAvailableSlotU(altRack, attr.uSize);
        if (altSlot !== null) {
          targetRack = altRack;
          slotU = altSlot;
          break;
        }
      }
    }

    // Si toujours aucune baie n'a de place, créer une nouvelle baie d'extension
    if (slotU === null) {
      const newRackIndex = racksList.length + 1;
      const newRackX = (racksList[racksList.length - 1]?.xMm || 4000) + 1400;
      const newRack: RackDisplay = {
        id: `rack-auto-ext-${newRackIndex}-${Date.now().toString(36)}`,
        name: `BAIE-EXTENSION-0${newRackIndex}`,
        xMm: newRackX,
        yMm: 4000,
        widthMm: 800,
        depthMm: 1000,
        uHeight: standardRackHeight,
        description: `Baie d'extension ajoutée automatiquement`,
        devices: [],
        patches: [],
      };
      racksList.push(newRack);
      racksCreatedCount++;
      targetRack = newRack;
      slotU = standardRackHeight;
    }

    // Créer le RackDeviceItem complet avec toutes les métadonnées réelles
    const rackDevice: RackDeviceItem = {
      id: raw.id,
      name: attr.name,
      model: raw.model || raw.sysDescr?.slice(0, 50) || `${attr.deviceType} Découvert`,
      deviceType: attr.deviceType as any,
      brand: inferBrand(raw.manufacturer),
      slotU,
      uSize: attr.uSize,
      portsCount: attr.portsCount,
      ipAddress: raw.ipAddress,
      macAddress: raw.macAddress,
      status: "ONLINE",
    };

    // Retirer tout doublon éventuel ayant le même IP/MAC dans la baie cible
    targetRack.devices = (targetRack.devices || []).filter(
      (d) =>
        d.id !== rackDevice.id &&
        (!rackDevice.ipAddress || d.ipAddress !== rackDevice.ipAddress) &&
        (!rackDevice.macAddress || d.macAddress !== rackDevice.macAddress)
    );
    targetRack.devices.push(rackDevice);

    deviceRackMapping.set(raw.id, { rackId: targetRack.id, rackDevice });
    if (raw.ipAddress) deviceRackMapping.set(raw.ipAddress, { rackId: targetRack.id, rackDevice });
    if (raw.macAddress)
      deviceRackMapping.set(raw.macAddress.toUpperCase(), { rackId: targetRack.id, rackDevice });

    if (attr.deviceType === "SWITCH") {
      summary.switchesInRacks.push(`${attr.name} (${targetRack.name} U${slotU})`);
    } else if (attr.deviceType === "SERVER") {
      summary.serversInRacks.push(`${attr.name} (${targetRack.name} U${slotU})`);
    }
  }

  // 4. Implantation Spatiale des Équipements de Plancher (Non-Rackables)
  // Conserver les nœuds existants ne correspondant pas aux nouveaux découverts
  const remainingExistingNodes = existingNodes.filter((n) => {
    return !devices.some(
      (d) =>
        d.id === n.id ||
        (d.ipAddress && d.ipAddress === n.ipAddress) ||
        (d.macAddress && n.macAddress && d.macAddress.toUpperCase() === n.macAddress.toUpperCase())
    );
  });

  const deployedNodes: NodeDisplay[] = [...remainingExistingNodes];

  // Organisation en zones bien définies :
  // Zone Bureaux : x: 12000, y: 8000 avec pas de 2200mm en X et 1800mm en Y
  // Zone Impression : x: 9500, y: 6500
  // Zone Wi-Fi : x: 16000, y: 5000
  let workstationIndex = 0;
  let printerIndex = 0;
  let wifiIndex = 0;
  let otherIndex = 0;

  for (const { raw, attr } of floorItems) {
    let xMm = 12000;
    let yMm = 8000;
    let widthMm = 1400;
    let heightMm = 800;
    let subType: NodeSubType = "DESK_SOLO";
    let outletRole: OutletRole = "DATA";

    if (attr.deviceType === "PRINTER") {
      xMm = 9500 + (printerIndex % 2) * 1200;
      yMm = 6500 + Math.floor(printerIndex / 2) * 1400;
      widthMm = 800;
      heightMm = 700;
      subType = "PRINTER_STATION";
      outletRole = "PRINTER";
      printerIndex++;
      summary.printersOnFloor.push(attr.name);
    } else if (attr.deviceType === "ACCESS_POINT") {
      xMm = 16000 + wifiIndex * 5000;
      yMm = 5000;
      widthMm = 350;
      heightMm = 350;
      subType = "WIFI_AP";
      outletRole = "WIFI";
      wifiIndex++;
      summary.accessPointsOnFloor.push(attr.name);
    } else if (attr.deviceType === "CAMERA") {
      xMm = 8000 + otherIndex * 3000;
      yMm = 3000;
      widthMm = 300;
      heightMm = 300;
      subType = "CAMERA_IP";
      outletRole = "CAMERA";
      otherIndex++;
      summary.otherOnFloor.push(attr.name);
    } else {
      // Workstations / Postes de travail en rangées régulières
      const cols = 3;
      const col = workstationIndex % cols;
      const row = Math.floor(workstationIndex / cols);
      xMm = 12000 + col * 2400;
      yMm = 8500 + row * 2000;
      widthMm = 1600;
      heightMm = 800;
      subType = "DESK_SOLO";
      outletRole = "DATA";
      workstationIndex++;
      summary.workstationsOnFloor.push(attr.name);

      // Création conjointe : 1. Le Bureau physique (DESK) avec son occupant
      const deskNode: NodeDisplay = {
        id: raw.id,
        name: `Bureau - ${attr.name}`,
        type: "DESK",
        category: "FURNITURE",
        subType: "DESK_SOLO",
        xMm,
        yMm,
        widthMm,
        heightMm,
        ipAddress: raw.ipAddress,
        macAddress: raw.macAddress,
        pingStatus: "ONLINE",
        pingLatencyMs: 2,
        assignedPerson: attr.name,
        description: raw.model || raw.sysDescr?.slice(0, 60) || "Poste de travail découvert",
        isPatched: false,
        vlanId: raw.vlanId || 20,
        seats: [
          {
            seatIndex: 0,
            seatLabel: "Poste 1",
            fullName: attr.name,
          },
        ],
      };
      deployedNodes.push(deskNode);

      // 2. La Prise RJ45 solidaire (WALL_OUTLET) raccordée au commutateur
      const outletNode: NodeDisplay = {
        id: `outlet-${raw.id}`,
        name: `Prise RJ45 - ${attr.name}`,
        type: "WALL_OUTLET",
        category: "CONNECTIVITY",
        subType: "GENERIC_PORT",
        outletRole: "DATA",
        xMm: xMm + 400,
        yMm: yMm + 150,
        widthMm: 120,
        heightMm: 120,
        attachedToDeskId: raw.id,
        attachedSeatIndex: 0,
        ipAddress: raw.ipAddress,
        macAddress: raw.macAddress,
        pingStatus: "ONLINE",
        pingLatencyMs: 2,
        description: `Prise réseau raccordée au ${attr.name}`,
        isPatched: false,
        vlanId: raw.vlanId || 20,
      };
      deployedNodes.push(outletNode);
      continue;
    }

    const newNode: NodeDisplay = {
      id: raw.id,
      name: attr.name,
      type: "WALL_OUTLET",
      category: "IOT",
      xMm,
      yMm,
      widthMm,
      heightMm,
      subType,
      outletRole,
      ipAddress: raw.ipAddress,
      macAddress: raw.macAddress,
      pingStatus: "ONLINE",
      pingLatencyMs: 2,
      description: raw.model || raw.sysDescr?.slice(0, 60) || "Équipement découvert",
      isPatched: false, // Sera activé à l'étape 5 de câblage
      vlanId:
        raw.vlanId ||
        ((outletRole as string) === "PRINTER"
          ? 40
          : (outletRole as string) === "VOIP"
            ? 30
            : (outletRole as string) === "WIFI"
              ? 50
              : 20),
    };

    deployedNodes.push(newNode);
  }

  // 5. Auto-Câblage Physique & Résolution des Liaisons L2 (FDB & LLDP)
  let cablesCreatedCount = 0;

  for (const conn of connections) {
    const isLldp =
      conn.connectionType === "LLDP_BACKBONE" || conn.connectionType === "CDP_BACKBONE";
    const isFdb =
      conn.connectionType === "FDB_ACCESS" ||
      conn.connectionType === "VOIP_CASCADED" ||
      conn.connectionType === "WIFI_CLIENT";

    // Identifier le switch source
    const sourceMapping =
      deviceRackMapping.get(conn.sourceDeviceId) ||
      Array.from(deviceRackMapping.values()).find(
        (m) => m.rackDevice.id === conn.sourceDeviceId || m.rackDevice.name === conn.sourceDeviceId
      );

    // Identifier la cible (dans une baie ou sur le plancher)
    const targetMapping =
      deviceRackMapping.get(conn.targetDeviceId) ||
      Array.from(deviceRackMapping.values()).find(
        (m) => m.rackDevice.id === conn.targetDeviceId || m.rackDevice.name === conn.targetDeviceId
      );

    const targetFloorNodes = deployedNodes.filter(
      (n) =>
        n.id === conn.targetDeviceId ||
        n.id === `outlet-${conn.targetDeviceId}` ||
        n.attachedToDeskId === conn.targetDeviceId ||
        (n.ipAddress && n.ipAddress === conn.targetDeviceId) ||
        (n.macAddress && n.macAddress.toUpperCase() === conn.targetDeviceId.toUpperCase())
    );

    // CAS A : Liaison dorsale LLDP entre deux switches
    if (isLldp && sourceMapping && targetMapping) {
      summary.lldpTrunksCount++;
      const sourceRack = racksList.find((r) => r.id === sourceMapping.rackId);
      const targetRack = racksList.find((r) => r.id === targetMapping.rackId);

      if (sourceRack && targetRack && sourceRack.id === targetRack.id) {
        // Deux switches dans la MÊME baie : patch interne DAC 10G ou Fibre
        const patch: InternalRackPatch = {
          id: `patch-lldp-${conn.id}`,
          sourceDevice: sourceMapping.rackDevice.name,
          sourcePort: conn.sourcePortName,
          targetDevice: targetMapping.rackDevice.name,
          targetPort: conn.targetPortName || "Gi1/0/24",
          vlanId: conn.vlanId || 1,
          serviceName: "TRUNK_LLDP_10G",
          cableType: "DAC_10G",
          lengthM: 1.0,
          status: "UP",
          speedGbps: 10,
        };
        sourceRack.patches = (sourceRack.patches || []).filter((p) => p.id !== patch.id);
        sourceRack.patches.push(patch);
        cablesCreatedCount++;
      } else if (sourceRack && targetRack) {
        // Switches dans deux baies distinctes : trunk inter-baie
        const patch: InternalRackPatch = {
          id: `patch-lldp-interrack-${conn.id}`,
          sourceDevice: `${sourceRack.name}:${sourceMapping.rackDevice.name}`,
          sourcePort: conn.sourcePortName,
          targetDevice: `${targetRack.name}:${targetMapping.rackDevice.name}`,
          targetPort: conn.targetPortName || "Gi1/0/24",
          vlanId: conn.vlanId || 1,
          serviceName: "TRUNK_LLDP_INTER_RACK_10G",
          cableType: "FIBER_LC",
          lengthM: 10.0,
          status: "UP",
          speedGbps: 10,
        };
        sourceRack.patches = (sourceRack.patches || []).filter((p) => p.id !== patch.id);
        sourceRack.patches.push(patch);
        cablesCreatedCount++;
      }
    }

    // CAS B : Raccordement FDB vers un équipement sur le plancher (Workstation bureau + prise, Imprimante, Wi-Fi)
    if (isFdb && sourceMapping && targetFloorNodes.length > 0) {
      summary.fdbAccessLinksCount++;
      for (const targetFloorNode of targetFloorNodes) {
        const vlanId =
          conn.vlanId ||
          targetFloorNode.vlanId ||
          (targetFloorNode.outletRole === "PRINTER"
            ? 40
            : targetFloorNode.outletRole === "VOIP"
              ? 30
              : targetFloorNode.outletRole === "WIFI"
                ? 50
                : 20);

        // Câbler le nœud vers la baie et le port du switch
        targetFloorNode.isPatched = true;
        targetFloorNode.connectedRackId = sourceMapping.rackId;
        targetFloorNode.connectedSwitchId = sourceMapping.rackDevice.id;
        targetFloorNode.connectedSwitchPort = conn.sourcePortName;
        targetFloorNode.vlanId = vlanId;
      }
      cablesCreatedCount++;
    }

    // CAS C : Raccordement FDB vers un serveur logé dans une baie
    if (
      isFdb &&
      sourceMapping &&
      targetMapping &&
      targetMapping.rackDevice.deviceType === "SERVER"
    ) {
      summary.fdbAccessLinksCount++;
      const sourceRack = racksList.find((r) => r.id === sourceMapping.rackId);
      if (sourceRack) {
        const patch: InternalRackPatch = {
          id: `patch-srv-${conn.id}`,
          sourceDevice: sourceMapping.rackDevice.name,
          sourcePort: conn.sourcePortName,
          targetDevice: targetMapping.rackDevice.name,
          targetPort: conn.targetPortName || "eth0",
          vlanId: conn.vlanId || 20,
          serviceName: `${targetMapping.rackDevice.name}_UPLINK`,
          cableType: "CAT6A_RJ45",
          lengthM: 1.5,
          status: "UP",
          speedGbps: 1,
        };
        sourceRack.patches = (sourceRack.patches || []).filter((p) => p.id !== patch.id);
        sourceRack.patches.push(patch);
        cablesCreatedCount++;
      }
    }
  }

  // Raccorder également tout nœud qui n'aurait pas eu de liaison explicite vers la première baie disponible
  const defaultRack = racksList[0];
  const defaultSwitch = defaultRack?.devices?.find((d) => d.deviceType === "SWITCH");
  let fallbackPortCounter = 12;

  for (const node of deployedNodes) {
    if (!node.isPatched && defaultRack) {
      node.isPatched = true;
      node.connectedRackId = defaultRack.id;
      if (defaultSwitch) {
        node.connectedSwitchId = defaultSwitch.id;
        node.connectedSwitchPort = `Gi1/0/${fallbackPortCounter++}`;
      }
      cablesCreatedCount++;
    }
  }

  summary.racksCount = racksList.length;

  return {
    racks: racksList,
    nodes: deployedNodes,
    racksCreatedCount,
    devicesPlacedCount: classifiedDevices.length,
    cablesCreatedCount,
    summary,
  };
}
