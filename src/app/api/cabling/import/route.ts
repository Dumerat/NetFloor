import { NextRequest, NextResponse } from "next/server";
import { parseCsvContent } from "@/engine/ingestion/parser";
import { validateCablingLedger } from "@/engine/ingestion/validator";
import { importCablingLedger } from "@/engine/ingestion/importer";
import { db } from "@/db/index";
import { z } from "zod";

const ImportPayloadSchema = z.object({
  csvContent: z.string().min(1, "Le contenu CSV est requis"),
  dryRunOnly: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { csvContent, dryRunOnly } = ImportPayloadSchema.parse(body);

    const parsedRows = parseCsvContent(csvContent);
    const dryRun = validateCablingLedger(parsedRows);

    if (dryRunOnly || !dryRun.isValid) {
      return NextResponse.json({
        success: dryRun.isValid,
        dryRun,
      });
    }

    // Exécution transactionnelle de l'import
    const importResult = await importCablingLedger(db, dryRun.validRecords);

    return NextResponse.json({
      success: true,
      dryRun,
      importResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors du traitement du carnet";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
