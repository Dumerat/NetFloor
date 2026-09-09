/**
 * NetFloor Architect - Ingestion & Contrats de Câblage
 * Types pour le parsing, la validation d'intégrité et l'import de masse.
 */

export type IngestionSeverity = "FATAL" | "WARNING";

export interface IngestionError {
  /** Numéro de ligne dans le fichier CSV (index 1-based, excluant l'en-tête) */
  readonly row: number;
  /** Nom de la colonne ou entité concernée */
  readonly field: string;
  /** Code d'erreur normalisé */
  readonly code: string;
  /** Message d'explication détaillé pour l'administrateur */
  readonly message: string;
  /** Gravité de l'anomalie */
  readonly severity: IngestionSeverity;
}

export interface IngestionSummary {
  readonly totalRows: number;
  readonly validRows: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly distinctFloors: number;
  readonly distinctRacks: number;
  readonly distinctPatchPanels: number;
  readonly distinctSwitches: number;
  readonly distinctVlans: number;
}

export interface DryRunResult<T> {
  readonly isValid: boolean;
  readonly errors: readonly IngestionError[];
  readonly summary: IngestionSummary;
  readonly validRecords: readonly T[];
}

export interface ImportResult {
  readonly success: boolean;
  readonly insertedCounts: {
    readonly floors: number;
    readonly racks: number;
    readonly nodes: number;
    readonly ports: number;
    readonly cables: number;
    readonly vlans: number;
  };
  readonly errors?: readonly IngestionError[];
}
