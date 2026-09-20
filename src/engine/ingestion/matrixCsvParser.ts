/**
 * NetFloor Architect - Moteur de Traitement CSV Matriciel (Tables de Brassage DSI)
 * Valide et convertit les fichiers CSV matriciels de DSI en mises à jour atomiques
 * pour les équipements réseau, bureaux et utilisateurs, avec gestion des éléments non positionnés.
 */

import { NodeDisplay, RackDisplay } from "@/components/canvas/EquipmentLayer";

export interface MatrixRowData {
  rowNumber: number;
  outletId: string;
  deskId?: string | undefined;
  userName?: string | undefined;
  ipAddress?: string | undefined;
  macAddress?: string | undefined;
  vlanId?: number | undefined;
  rackName?: string | undefined;
  switchName?: string | undefined;
  switchPort?: string | undefined;
}

export interface MatrixRowError {
  row: number;
  column: string;
  value: string;
  message: string;
}

export interface MatrixAuditResult {
  isValid: boolean;
  totalRows: number;
  validRows: MatrixRowData[];
  errors: MatrixRowError[];
  summary: {
    totalRows: number;
    validCount: number;
    errorCount: number;
    distinctOutlets: number;
    distinctDesks: number;
    distinctUsers: number;
    distinctVlans: number;
  };
}

export interface ApplyMatrixResult {
  updatedNodes: NodeDisplay[];
  unpositionedNodes: NodeDisplay[];
  matchedOutletsCount: number;
  matchedDesksCount: number;
  newUnpositionedCount: number;
}

const IP_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

/**
 * Analyse et valide le contenu CSV matriciel avec feedback précis par cellule
 */
export function parseAndAuditMatrixCsv(csvText: string): MatrixAuditResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      isValid: false,
      totalRows: 0,
      validRows: [],
      errors: [
        {
          row: 0,
          column: "FICHIER",
          value: "",
          message: "Le fichier CSV est vide.",
        },
      ],
      summary: {
        totalRows: 0,
        validCount: 0,
        errorCount: 1,
        distinctOutlets: 0,
        distinctDesks: 0,
        distinctUsers: 0,
        distinctVlans: 0,
      },
    };
  }

  // Détection du délimiteur (, ou ; ou \t)
  const headerLine = lines[0]!;
  const delimiter = headerLine.includes(";") ? ";" : headerLine.includes("\t") ? "\t" : ",";

  const rawHeaders = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());

  // Correspondance normalisée des colonnes
  const colIndex = {
    outletId: rawHeaders.findIndex((h) =>
      ["prise_id", "prise", "outlet_id", "id_prise", "priseid"].includes(h)
    ),
    deskId: rawHeaders.findIndex((h) =>
      ["bureau_id", "bureau", "desk_id", "id_bureau", "bureauid"].includes(h)
    ),
    userName: rawHeaders.findIndex((h) =>
      ["utilisateur", "user", "agent", "collaborateur", "personne", "fullname"].includes(h)
    ),
    ipAddress: rawHeaders.findIndex((h) =>
      ["ip_machine", "ip", "ip_address", "ipaddress", "adresse_ip"].includes(h)
    ),
    macAddress: rawHeaders.findIndex((h) =>
      ["mac", "mac_address", "macaddress", "adresse_mac"].includes(h)
    ),
    vlanId: rawHeaders.findIndex((h) => ["vlan_id", "vlan", "vlanid", "vid"].includes(h)),
    rackName: rawHeaders.findIndex((h) =>
      ["baie", "rack", "rack_name", "baie_nom", "rackid"].includes(h)
    ),
    switchName: rawHeaders.findIndex((h) =>
      ["switch_nom", "switch", "switch_name", "nom_switch"].includes(h)
    ),
    switchPort: rawHeaders.findIndex((h) =>
      ["port_switch", "port", "switch_port", "switchport", "port_nom"].includes(h)
    ),
  };

  if (colIndex.outletId === -1) {
    return {
      isValid: false,
      totalRows: lines.length - 1,
      validRows: [],
      errors: [
        {
          row: 1,
          column: "En-tête",
          value: headerLine,
          message:
            "Colonne 'Prise_ID' introuvable. Colonnes requises : Prise_ID, Bureau_ID, Utilisateur, IP_Machine, MAC, VLAN_ID, Baie, Switch_Nom, Port_Switch.",
        },
      ],
      summary: {
        totalRows: lines.length - 1,
        validCount: 0,
        errorCount: 1,
        distinctOutlets: 0,
        distinctDesks: 0,
        distinctUsers: 0,
        distinctVlans: 0,
      },
    };
  }

  const validRows: MatrixRowData[] = [];
  const errors: MatrixRowError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const rawCols = lines[i]!.split(delimiter).map((c) => c.trim());
    if (rawCols.every((c) => c.length === 0)) continue;

    const getVal = (idx: number): string | undefined => {
      if (idx === -1 || idx >= rawCols.length) return undefined;
      const val = rawCols[idx]!.trim();
      return val.length > 0 ? val : undefined;
    };

    const outletId = getVal(colIndex.outletId);
    const deskId = getVal(colIndex.deskId);
    const userName = getVal(colIndex.userName);
    const rawIp = getVal(colIndex.ipAddress);
    const rawMac = getVal(colIndex.macAddress);
    const rawVlan = getVal(colIndex.vlanId);
    const rackName = getVal(colIndex.rackName);
    const switchName = getVal(colIndex.switchName);
    const switchPort = getVal(colIndex.switchPort);

    // Validation Prise_ID
    if (!outletId) {
      errors.push({
        row: rowNum,
        column: "Prise_ID",
        value: "",
        message: "L'identifiant de la prise murale est obligatoire.",
      });
      continue;
    }

    // Validation IP_Machine
    let ipAddress: string | undefined = undefined;
    if (rawIp) {
      if (!IP_REGEX.test(rawIp)) {
        errors.push({
          row: rowNum,
          column: "IP_Machine",
          value: rawIp,
          message: "Format d'adresse IPv4 invalide (attendu ex: 10.42.20.101).",
        });
      } else {
        ipAddress = rawIp;
      }
    }

    // Validation MAC
    let macAddress: string | undefined = undefined;
    if (rawMac) {
      const normalizedMac = rawMac.replace(/-/g, ":").toUpperCase();
      if (!MAC_REGEX.test(normalizedMac)) {
        errors.push({
          row: rowNum,
          column: "MAC",
          value: rawMac,
          message: "Format d'adresse MAC invalide (attendu ex: AA:BB:CC:DD:EE:FF).",
        });
      } else {
        macAddress = normalizedMac;
      }
    }

    // Validation VLAN_ID
    let vlanId: number | undefined = undefined;
    if (rawVlan) {
      const parsed = Number.parseInt(rawVlan, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 4094) {
        errors.push({
          row: rowNum,
          column: "VLAN_ID",
          value: rawVlan,
          message: "VLAN VID invalide (doit être un entier compris entre 1 et 4094).",
        });
      } else {
        vlanId = parsed;
      }
    }

    validRows.push({
      rowNumber: rowNum,
      outletId,
      ...(deskId ? { deskId } : {}),
      ...(userName ? { userName } : {}),
      ...(ipAddress ? { ipAddress } : {}),
      ...(macAddress ? { macAddress } : {}),
      ...(vlanId !== undefined ? { vlanId } : {}),
      ...(rackName ? { rackName } : {}),
      ...(switchName ? { switchName } : {}),
      ...(switchPort ? { switchPort } : {}),
    });
  }

  const outletsSet = new Set(validRows.map((r) => r.outletId));
  const desksSet = new Set(validRows.map((r) => r.deskId).filter(Boolean));
  const usersSet = new Set(validRows.map((r) => r.userName).filter(Boolean));
  const vlansSet = new Set(validRows.map((r) => r.vlanId).filter((v) => v !== undefined));

  return {
    isValid: errors.length === 0,
    totalRows: lines.length - 1,
    validRows,
    errors,
    summary: {
      totalRows: lines.length - 1,
      validCount: validRows.length,
      errorCount: errors.length,
      distinctOutlets: outletsSet.size,
      distinctDesks: desksSet.size,
      distinctUsers: usersSet.size,
      distinctVlans: vlansSet.size,
    },
  };
}

/**
 * Applique atomiquement les lignes matricielles validées sur l'état des nœuds
 * Associe les prises et bureaux existants ou génère les éléments non positionnés.
 */
export function applyMatrixImport(
  validRows: MatrixRowData[],
  currentNodes: NodeDisplay[],
  racks: RackDisplay[] = [],
  defaultSiteId?: string | undefined
): ApplyMatrixResult {
  let updatedNodes: NodeDisplay[] = [...currentNodes];
  const unpositionedNodes: NodeDisplay[] = [];
  let matchedOutletsCount = 0;
  let matchedDesksCount = 0;

  // Création d'index rapides par ID et par nom (insensible à la casse)
  const nodeMap = new Map<string, NodeDisplay>();
  const nodeNameMap = new Map<string, NodeDisplay>();

  updatedNodes.forEach((node) => {
    nodeMap.set(node.id.toLowerCase(), node);
    nodeNameMap.set(node.name.toLowerCase(), node);
  });

  // Table de correspondance baie nom -> ID
  const rackMap = new Map<string, string>();
  racks.forEach((r) => {
    rackMap.set(r.name.toLowerCase(), r.id);
    rackMap.set(r.id.toLowerCase(), r.id);
  });

  const createdDesksMap = new Map<string, NodeDisplay>();

  validRows.forEach((row) => {
    // 1. Résolution de la baie
    const targetRackId =
      (row.rackName && rackMap.get(row.rackName.toLowerCase())) || racks[0]?.id || "rack-01";

    // 2. Recherche du meuble associé si spécifié
    let attachedDeskId: string | undefined = undefined;
    if (row.deskId) {
      const lowerDeskId = row.deskId.toLowerCase();
      let deskNode = nodeMap.get(lowerDeskId) || nodeNameMap.get(lowerDeskId);

      if (deskNode && deskNode.type === "DESK") {
        matchedDesksCount++;
        attachedDeskId = deskNode.id;

        // Si un utilisateur est renseigné, mise à jour du bureau
        if (row.userName) {
          deskNode = {
            ...deskNode,
            assignedPerson: row.userName,
            ...(deskNode.seats && deskNode.seats.length > 0
              ? {
                  seats: deskNode.seats.map((seat, sIdx) =>
                    sIdx === 0 ? { ...seat, fullName: row.userName } : seat
                  ),
                }
              : {}),
          };
          nodeMap.set(deskNode.id.toLowerCase(), deskNode);
          nodeNameMap.set(deskNode.name.toLowerCase(), deskNode);
        }
      } else {
        // Le bureau n'existe pas encore sur le plan : création d'un bureau non positionné
        if (!createdDesksMap.has(lowerDeskId)) {
          const newDesk: NodeDisplay = {
            id: `unpositioned-desk-${row.deskId}`,
            type: "DESK",
            name: row.deskId.startsWith("Bureau") ? row.deskId : `Bureau ${row.deskId}`,
            xMm: -99999, // Coordonnée spéciale d'élément non positionné
            yMm: -99999,
            widthMm: 1600,
            heightMm: 800,
            subType: "DESK_SOLO",
            chairPosition: "BOTTOM",
            description: "Bureau importé depuis CSV (non positionné)",
            siteId: defaultSiteId,
            ...(row.userName
              ? {
                  assignedPerson: row.userName,
                  seats: [
                    {
                      seatIndex: 0,
                      seatLabel: "Place Unique",
                      fullName: row.userName,
                    },
                  ],
                }
              : {}),
          };
          createdDesksMap.set(lowerDeskId, newDesk);
          unpositionedNodes.push(newDesk);
        }
        attachedDeskId = createdDesksMap.get(lowerDeskId)!.id;
      }
    }

    // 3. Recherche de la prise existante sur le plan
    const lowerOutletId = row.outletId.toLowerCase();
    const existingOutlet = nodeMap.get(lowerOutletId) || nodeNameMap.get(lowerOutletId);

    if (existingOutlet && existingOutlet.type === "WALL_OUTLET") {
      matchedOutletsCount++;
      const updatedOutlet: NodeDisplay = {
        ...existingOutlet,
        isPatched: true,
        connectedRackId: targetRackId,
        ...(row.switchPort ? { connectedSwitchPort: row.switchPort } : {}),
        ...(row.vlanId !== undefined ? { vlanId: row.vlanId } : {}),
        ...(row.ipAddress ? { ipAddress: row.ipAddress } : {}),
        ...(row.macAddress ? { macAddress: row.macAddress } : {}),
        ...(row.userName ? { assignedPerson: row.userName } : {}),
        ...(attachedDeskId ? { attachedToDeskId: attachedDeskId } : {}),
        pingStatus: "ONLINE",
      };
      nodeMap.set(existingOutlet.id.toLowerCase(), updatedOutlet);
      nodeNameMap.set(existingOutlet.name.toLowerCase(), updatedOutlet);
    } else {
      // La prise n'existe pas encore sur le plan : création d'une prise non positionnée
      const newOutlet: NodeDisplay = {
        id: `unpositioned-outlet-${row.outletId}`,
        type: "WALL_OUTLET",
        name: row.outletId.startsWith("Prise") ? row.outletId : `Prise ${row.outletId}`,
        xMm: -99999,
        yMm: -99999,
        portId: `port-unpositioned-${row.outletId}`,
        outletRole: row.vlanId === 30 ? "VOIP" : "DATA",
        isPatched: true,
        connectedRackId: targetRackId,
        siteId: defaultSiteId,
        ...(row.switchPort ? { connectedSwitchPort: row.switchPort } : {}),
        ...(row.vlanId !== undefined ? { vlanId: row.vlanId } : {}),
        ...(row.ipAddress ? { ipAddress: row.ipAddress } : {}),
        ...(row.macAddress ? { macAddress: row.macAddress } : {}),
        ...(row.userName ? { assignedPerson: row.userName } : {}),
        ...(attachedDeskId ? { attachedToDeskId: attachedDeskId } : {}),
        pingStatus: "ONLINE",
      };
      unpositionedNodes.push(newOutlet);
    }
  });

  // Reconstitution finale des nœuds du plateau
  updatedNodes = updatedNodes.map((n) => nodeMap.get(n.id.toLowerCase()) ?? n);

  return {
    updatedNodes,
    unpositionedNodes,
    matchedOutletsCount,
    matchedDesksCount,
    newUnpositionedCount: unpositionedNodes.length,
  };
}
