/**
 * NetFloor Architect - Moteur de Génération d'Îlots Matriciels en Masse
 * Produit instantanément des open-spaces entiers avec mobilier, sièges,
 * boîtiers RJ45 (Data + VoIP) solidaires et magnétisme de grille.
 */

import {
  NodeDisplay,
  NodeSubType,
  getDefaultSeatLabels,
  DeskSeatOccupant,
  StackedPortItem,
} from "@/components/canvas/EquipmentLayer";
import { FloorZone } from "@/types/zones";
import { GridConfig } from "./types";
import { snapToGrid } from "./snapping";

export interface BatchSpawnParams {
  /** Type de bureau : Bench 2 postes face-à-face ou Îlot Quad 4 postes */
  deskType: "bench_2" | "quad_4";
  /** Nombre de rangées */
  rows: number;
  /** Nombre de colonnes */
  columns: number;
  /** Espacement X en mètres entre les bords des bureaux */
  spacingXMeters: number;
  /** Espacement Y en mètres entre les bords des bureaux */
  spacingYMeters: number;
  /** Zone de rattachement spatiale optionnelle */
  zoneId?: string | undefined;
  /** Baie de raccordement réseau par défaut */
  defaultRackId?: string | undefined;
  /** Numérotation de départ des bureaux (ex: 501) */
  startDeskNumber?: number | undefined;
  /** Coordonnée d'origine manuelle optionnelle */
  originX?: number | undefined;
  originY?: number | undefined;
  /** Identifiant du site de rattachement */
  siteId?: string | undefined;
  /** Nombre de prises/ports RJ45 par poste : 1 ou 2 (défaut: 2) */
  outletsPerSeat?: 1 | 2 | undefined;
  /** Mode de connectique : "pack" (Bloc RJ45 compact anti-spam) ou "individual" (prises séparées) */
  outletMode?: "pack" | "individual" | undefined;
}

export interface BatchSpawnResult {
  desks: NodeDisplay[];
  outlets: NodeDisplay[];
  totalSeats: number;
  totalOutlets: number;
  outletMode?: "pack" | "individual" | undefined;
}

const DEFAULT_GRID_CONFIG: GridConfig = {
  stepMm: 500,
  enabled: true,
  snapRadiusMm: 35,
};

/**
 * Génère une matrice complète de bureaux et de prises solidaires
 */
export function generateBatchDesks(
  params: BatchSpawnParams,
  zones: FloorZone[] = [],
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG
): BatchSpawnResult {
  const {
    deskType,
    rows,
    columns,
    spacingXMeters,
    spacingYMeters,
    zoneId,
    defaultRackId = "rack-01",
    startDeskNumber = 701,
    originX,
    originY,
  } = params;

  const isQuad = deskType === "quad_4";
  const subType: NodeSubType = isQuad ? "BENCH_QUAD" : "BENCH_DOUBLE";
  const deskWidthMm = isQuad ? 3200 : 1600;
  const deskHeightMm = 1600;
  const seatsPerDesk = isQuad ? 4 : 2;

  const spacingXMm = Math.round(Math.max(0.5, spacingXMeters) * 1000);
  const spacingYMm = Math.round(Math.max(0.5, spacingYMeters) * 1000);

  // Détermination de l'origine spatiale
  let startX = 10000;
  let startY = 10000;
  let targetDepartment = "Pôle Collaboratif";

  if (originX !== undefined && originY !== undefined) {
    startX = originX;
    startY = originY;
  } else if (zoneId) {
    const targetZone = zones.find((z) => z.id === zoneId);
    if (targetZone) {
      startX = targetZone.xMm + 1500;
      startY = targetZone.yMm + 1500;
      targetDepartment = targetZone.name;
    }
  }

  const desks: NodeDisplay[] = [];
  const outlets: NodeDisplay[] = [];
  let currentNum = startDeskNumber;
  const timestamp = Date.now();

  const outletsPerSeat = params.outletsPerSeat ?? 2;
  const outletMode = params.outletMode ?? "individual";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const rawX = startX + c * (deskWidthMm + spacingXMm);
      const rawY = startY + r * (deskHeightMm + spacingYMm);

      // Alignement automatique sur la grille métrique
      const snapped = snapToGrid({ x: rawX, y: rawY }, gridConfig).point;

      const deskId = `batch-desk-${timestamp}-${r}-${c}`;
      const deskName = `Bureau ${currentNum}`;
      const defaultSeatLabels = getDefaultSeatLabels(subType);

      const seats: DeskSeatOccupant[] = Array.from({ length: seatsPerDesk }, (_, seatIdx) => ({
        seatIndex: seatIdx,
        seatLabel: defaultSeatLabels[seatIdx] ?? `Place ${seatIdx + 1}`,
        department: targetDepartment,
      }));

      const deskNode: NodeDisplay = {
        id: deskId,
        type: "DESK",
        name: deskName,
        xMm: snapped.x,
        yMm: snapped.y,
        widthMm: deskWidthMm,
        heightMm: deskHeightMm,
        subType,
        department: targetDepartment,
        description: isQuad
          ? "Îlot central 4 postes généré par matrice avec cloisonnettes acoustiques."
          : "Bench 2 postes face-à-face généré par matrice.",
        chairPosition: "BOTTOM",
        seats,
        siteId: params.siteId,
      };

      desks.push(deskNode);

      // Connectique réseau : Mode Pack centralisé (Bloc RJ45) ou Prises individuelles
      if (outletMode === "pack") {
        // Mode Pack : 1 seul boîtier central compact par mobilier (évite le spam visuel)
        const totalPorts = seatsPerDesk * outletsPerSeat;
        const initialPorts: StackedPortItem[] = [];

        for (let seatIdx = 0; seatIdx < seatsPerDesk; seatIdx++) {
          for (let pIdx = 0; pIdx < outletsPerSeat; pIdx++) {
            const portIdx = seatIdx * outletsPerSeat + pIdx;
            const portLabel =
              outletsPerSeat === 1
                ? `P${seatIdx + 1} (Pl.${seatIdx + 1})`
                : `P${portIdx + 1} (Pl.${seatIdx + 1}-${pIdx === 0 ? "A" : "B"})`;

            initialPorts.push({
              portIndex: portIdx,
              portLabel,
              outletRole: "DATA", // Cuivre passif : le profil est déterminé lors du raccordement au switch
              vlanId: undefined,
              attachedSeatIndex: seatIdx,
              attachedToDeskId: deskId,
              isPatched: false,
              connectedRackId: defaultRackId,
            });
          }
        }

        const socketBlock: NodeDisplay = {
          id: `outlet-${deskId}-pack`,
          type: "WALL_OUTLET",
          subType: "SOCKET_BLOCK",
          name: `Bloc RJ45 ${currentNum}`,
          xMm: snapped.x + Math.round(deskWidthMm / 2),
          yMm: snapped.y + Math.round(deskHeightMm / 2),
          attachedToDeskId: deskId,
          portCount: totalPorts,
          stackedPorts: initialPorts,
          outletRole: "DATA",
          siteId: params.siteId,
          connectedRackId: defaultRackId,
        };

        outlets.push(socketBlock);
      } else {
        // Mode Prises Individuelles séparées
        seats.forEach((_seat, seatIdx) => {
          let baseRelX = 800;
          let baseRelY = 200;

          if (isQuad) {
            if (seatIdx === 0) {
              baseRelX = 800;
              baseRelY = 200;
            } else if (seatIdx === 1) {
              baseRelX = 2400;
              baseRelY = 200;
            } else if (seatIdx === 2) {
              baseRelX = 800;
              baseRelY = 1400;
            } else {
              baseRelX = 2400;
              baseRelY = 1400;
            }
          } else {
            // Bench double
            if (seatIdx === 0) {
              baseRelX = 800;
              baseRelY = 200;
            } else {
              baseRelX = 800;
              baseRelY = 1400;
            }
          }

          if (outletsPerSeat === 1) {
            // 1 prise par place
            const outletId = `outlet-${deskId}-s${seatIdx}`;
            const singleOutlet: NodeDisplay = {
              id: outletId,
              type: "WALL_OUTLET",
              name: `Prise ${currentNum}-${seatIdx + 1}`,
              xMm: snapped.x + baseRelX,
              yMm: snapped.y + baseRelY,
              portId: `port-${timestamp}-${r}-${c}-${seatIdx}`,
              attachedToDeskId: deskId,
              attachedSeatIndex: seatIdx,
              outletRole: "DATA", // Cuivre passif
              vlanId: undefined,
              connectedRackId: defaultRackId,
              isPatched: false,
              pingStatus: "OFFLINE",
              siteId: params.siteId,
            };
            outlets.push(singleOutlet);
          } else {
            // 2 prises par place
            const dataOutletId = `outlet-${deskId}-s${seatIdx}-data`;
            const voipOutletId = `outlet-${deskId}-s${seatIdx}-voip`;

            const dataOutlet: NodeDisplay = {
              id: dataOutletId,
              type: "WALL_OUTLET",
              name: `Prise ${currentNum}-${seatIdx + 1}-A`,
              xMm: snapped.x + baseRelX - 60,
              yMm: snapped.y + baseRelY,
              portId: `port-${timestamp}-${r}-${c}-${seatIdx}-a`,
              attachedToDeskId: deskId,
              attachedSeatIndex: seatIdx,
              outletRole: "DATA",
              vlanId: undefined,
              connectedRackId: defaultRackId,
              isPatched: false,
              pingStatus: "OFFLINE",
              siteId: params.siteId,
            };

            const voipOutlet: NodeDisplay = {
              id: voipOutletId,
              type: "WALL_OUTLET",
              name: `Prise ${currentNum}-${seatIdx + 1}-B`,
              xMm: snapped.x + baseRelX + 60,
              yMm: snapped.y + baseRelY,
              portId: `port-${timestamp}-${r}-${c}-${seatIdx}-b`,
              attachedToDeskId: deskId,
              attachedSeatIndex: seatIdx,
              outletRole: "DATA",
              vlanId: undefined,
              connectedRackId: defaultRackId,
              isPatched: false,
              pingStatus: "OFFLINE",
              siteId: params.siteId,
            };

            outlets.push(dataOutlet, voipOutlet);
          }
        });
      }

      currentNum++;
    }
  }

  const totalPortsCount = outlets.reduce((acc, o) => acc + (o.stackedPorts?.length ?? 1), 0);

  return {
    desks,
    outlets,
    totalSeats: desks.length * seatsPerDesk,
    totalOutlets: totalPortsCount,
    outletMode,
  };
}
