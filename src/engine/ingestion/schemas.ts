import { z } from "zod";

export const CableCategoryZodEnum = z.enum([
  "CAT5E",
  "CAT6",
  "CAT6A",
  "CAT7",
  "SM_FIBER_OS2",
  "MM_FIBER_OM4",
  "DAC",
]);

export type CableCategoryType = z.infer<typeof CableCategoryZodEnum>;

/**
 * Schéma Zod strict pour valider et coercer une ligne du carnet de câblage.
 */
export const CablingRowSchema = z
  .object({
    outletName: z.string().trim().min(1, "Le nom de la prise murale est requis"),
    outletPort: z.string().trim().min(1).default("RJ45-1"),
    deskNumber: z.string().trim().optional(),
    floorName: z.string().trim().min(1, "L'étage est requis"),
    rackName: z.string().trim().min(1, "La baie cible est requise"),
    patchPanelName: z.string().trim().min(1, "Le nom du bandeau de brassage est requis"),
    patchPanelPort: z.string().trim().min(1, "Le port du bandeau est requis"),
    cableCategory: z
      .string()
      .trim()
      .toUpperCase()
      .transform((val) => (val === "" ? "CAT6A" : val))
      .pipe(CableCategoryZodEnum),
    cableLengthM: z
      .union([z.string(), z.number()])
      .transform((val) => {
        if (typeof val === "number") return val;
        const parsed = parseFloat(val.replace(",", "."));
        return isNaN(parsed) ? 25.0 : parsed;
      })
      .pipe(z.number().nonnegative("La longueur de câble ne peut être négative").default(25.0)),
    switchName: z.string().trim().min(1, "Le commutateur est requis"),
    switchPort: z.string().trim().min(1, "Le port du commutateur est requis"),
    vlanVid: z
      .union([z.string(), z.number()])
      .transform((val) => (typeof val === "number" ? val : parseInt(val, 10)))
      .pipe(
        z
          .number()
          .int("Le VLAN VID doit être un entier")
          .min(1, "Le VLAN VID doit être >= 1")
          .max(4094, "Le VLAN VID doit être <= 4094")
      ),
    vlanName: z.string().trim().optional(),
  })
  .transform((row) => ({
    ...row,
    // Conversion automatique de mètres en entiers millimétriques
    lengthMm: Math.round(row.cableLengthM * 1000),
    resolvedVlanName: row.vlanName && row.vlanName.length > 0 ? row.vlanName : `VLAN_${row.vlanVid}`,
  }));

export type CablingRow = z.infer<typeof CablingRowSchema>;
