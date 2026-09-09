import { ParsedRawRow } from "./parser";
import { CablingRowSchema, CablingRow } from "./schemas";
import { IngestionError, IngestionSummary, DryRunResult } from "./types";

/**
 * Validateur d'intégrité topologique et de contrats Zod
 * Exécute un contrôle statique complet avant toute tentative d'écriture en base.
 */
export function validateCablingLedger(rawRows: readonly ParsedRawRow[]): DryRunResult<CablingRow> {
  const errors: IngestionError[] = [];
  const validRecords: CablingRow[] = [];

  // Registres de détection de collisions
  // Clé: `floor:outlet:port` -> { row: number }
  const outletRegistry = new Map<string, number>();

  // Clé: `rack:patchPanel:port` -> { row: number }
  const patchPanelRegistry = new Map<string, number>();

  // Clé: `switch:port` -> { row: number, vlanVid: number }
  const switchPortRegistry = new Map<string, { row: number; vlanVid: number }>();

  // Statistiques pour le résumé
  const distinctFloors = new Set<string>();
  const distinctRacks = new Set<string>();
  const distinctPatchPanels = new Set<string>();
  const distinctSwitches = new Set<string>();
  const distinctVlans = new Set<number>();

  for (const raw of rawRows) {
    // 1. Validation syntaxique Zod par ligne
    const parseResult = CablingRowSchema.safeParse(raw.data);

    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        errors.push({
          row: raw.rowNumber,
          field: issue.path.join(".") || "ligne",
          code: "SCHEMA_VALIDATION_ERROR",
          message: issue.message,
          severity: "FATAL",
        });
      }
      continue;
    }

    const row = parseResult.data;

    // 2. Vérification topologique : Unicité de la prise murale
    const outletKey = `${row.floorName}::${row.outletName}::${row.outletPort}`.toLowerCase();
    const existingOutletRow = outletRegistry.get(outletKey);
    if (existingOutletRow !== undefined) {
      errors.push({
        row: raw.rowNumber,
        field: "outletName",
        code: "DUPLICATE_OUTLET_PORT",
        message: `La prise '${row.outletName}' [Port: ${row.outletPort}] est déjà allouée à la ligne ${existingOutletRow}.`,
        severity: "FATAL",
      });
    } else {
      outletRegistry.set(outletKey, raw.rowNumber);
    }

    // 3. Vérification topologique : Unicité du port de patch panel
    const patchKey = `${row.rackName}::${row.patchPanelName}::${row.patchPanelPort}`.toLowerCase();
    const existingPatchRow = patchPanelRegistry.get(patchKey);
    if (existingPatchRow !== undefined) {
      errors.push({
        row: raw.rowNumber,
        field: "patchPanelPort",
        code: "DOUBLE_BOOKED_PATCH_PORT",
        message: `Le port de brassage '${row.patchPanelName}' [Port: ${row.patchPanelPort}] est déjà câblé à la ligne ${existingPatchRow}.`,
        severity: "FATAL",
      });
    } else {
      patchPanelRegistry.set(patchKey, raw.rowNumber);
    }

    // 4. Vérification topologique : Conflit de port switch & incohérence de VLAN
    const switchKey = `${row.switchName}::${row.switchPort}`.toLowerCase();
    const existingSwitchEntry = switchPortRegistry.get(switchKey);
    if (existingSwitchEntry !== undefined) {
      errors.push({
        row: raw.rowNumber,
        field: "switchPort",
        code: "DOUBLE_BOOKED_SWITCH_PORT",
        message: `Le port de switch '${row.switchName}' [Port: ${row.switchPort}] est déjà alloué à la ligne ${existingSwitchEntry.row}.`,
        severity: "FATAL",
      });

      if (existingSwitchEntry.vlanVid !== row.vlanVid) {
        errors.push({
          row: raw.rowNumber,
          field: "vlanVid",
          code: "VLAN_CONFLICT_ON_SWITCH_PORT",
          message: `Incohérence VLAN sur '${row.switchName}' [${row.switchPort}] : affecté au VLAN ${row.vlanVid} ici, mais au VLAN ${existingSwitchEntry.vlanVid} à la ligne ${existingSwitchEntry.row}.`,
          severity: "FATAL",
        });
      }
    } else {
      switchPortRegistry.set(switchKey, { row: raw.rowNumber, vlanVid: row.vlanVid });
    }

    // Si aucune erreur sur cette ligne, comptabilisation
    distinctFloors.add(row.floorName);
    distinctRacks.add(`${row.floorName}::${row.rackName}`);
    distinctPatchPanels.add(`${row.rackName}::${row.patchPanelName}`);
    distinctSwitches.add(`${row.rackName}::${row.switchName}`);
    distinctVlans.add(row.vlanVid);

    validRecords.push(row);
  }

  const fatalCount = errors.filter((e) => e.severity === "FATAL").length;
  const warningCount = errors.filter((e) => e.severity === "WARNING").length;

  const summary: IngestionSummary = {
    totalRows: rawRows.length,
    validRows: fatalCount === 0 ? validRecords.length : 0,
    errorCount: fatalCount,
    warningCount,
    distinctFloors: distinctFloors.size,
    distinctRacks: distinctRacks.size,
    distinctPatchPanels: distinctPatchPanels.size,
    distinctSwitches: distinctSwitches.size,
    distinctVlans: distinctVlans.size,
  };

  return {
    isValid: fatalCount === 0,
    errors,
    summary,
    validRecords: fatalCount === 0 ? validRecords : [],
  };
}
