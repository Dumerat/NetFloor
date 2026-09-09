/**
 * NetFloor Architect - Parseur CSV robuste
 * Supporte délimiteurs virgule/point-virgule, guillemets échappés, et normalisation multilingue des en-têtes.
 */

export interface ParsedRawRow {
  readonly rowNumber: number; // 1-based index (ligne 1 = premier enregistrement après l'en-tête)
  readonly data: Record<string, string>;
}

const HEADER_ALIASES: Record<string, string> = {
  // Prise murale
  outlet_name: "outletName",
  prise_murale: "outletName",
  prise: "outletName",
  outlet: "outletName",

  outlet_port: "outletPort",
  port_prise: "outletPort",
  port_outlet: "outletPort",

  // Bureau
  desk_number: "deskNumber",
  bureau: "deskNumber",
  desk: "deskNumber",

  // Étage
  floor_name: "floorName",
  etage: "floorName",
  floor: "floorName",

  // Baie
  rack_name: "rackName",
  baie: "rackName",
  rack: "rackName",

  // Patch Panel
  patch_panel_name: "patchPanelName",
  patch_panel: "patchPanelName",
  bandeau: "patchPanelName",
  panneau: "patchPanelName",

  patch_panel_port: "patchPanelPort",
  port_patch: "patchPanelPort",
  port_bandeau: "patchPanelPort",

  // Câble
  cable_category: "cableCategory",
  categorie: "cableCategory",
  category: "cableCategory",

  cable_length_m: "cableLengthM",
  longueur_m: "cableLengthM",
  longueur: "cableLengthM",

  // Switch
  switch_name: "switchName",
  switch: "switchName",
  commutateur: "switchName",

  switch_port: "switchPort",
  port_switch: "switchPort",

  // VLAN
  vlan_vid: "vlanVid",
  vid: "vlanVid",
  vlan: "vlanVid",

  vlan_name: "vlanName",
  nom_vlan: "vlanName",
};

/**
 * Détecte le délimiteur le plus probable (, ou ; ou \t)
 */
function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (semicolons > commas && semicolons > tabs) return ";";
  if (tabs > commas && tabs > semicolons) return "\t";
  return ",";
}

/**
 * Sépare une ligne CSV en respectant les guillemets.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Sauter le guillemet échappé
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse un contenu CSV brut en une liste d'enregistrements mappés avec numéro de ligne.
 */
export function parseCsvContent(rawCsv: string): ParsedRawRow[] {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0];
  if (!headerLine) return [];

  const delimiter = detectDelimiter(headerLine);
  const rawHeaders = splitCsvLine(headerLine, delimiter).map((h) =>
    h.toLowerCase().replace(/[\s\-_]+/g, "_")
  );

  const mappedHeaders = rawHeaders.map((raw) => HEADER_ALIASES[raw] ?? raw);

  const parsedRows: ParsedRawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = splitCsvLine(line, delimiter);
    const record: Record<string, string> = {};

    mappedHeaders.forEach((header, index) => {
      const val = values[index];
      if (header && val !== undefined) {
        record[header] = val;
      }
    });

    parsedRows.push({
      rowNumber: i + 1, // Ligne physique dans le fichier (en-tête = ligne 1)
      data: record,
    });
  }

  return parsedRows;
}
