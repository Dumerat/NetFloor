import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { saveTopologyPayload } from "../route";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let configData = body;

    // Si le body demande le mode "demo", charger examples/demo-config.json
    if (body.type === "demo" || !body.floor) {
      const demoPath = path.resolve("examples/demo-config.json");
      if (fs.existsSync(demoPath)) {
        const raw = fs.readFileSync(demoPath, "utf-8");
        configData = JSON.parse(raw);
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "Le fichier de démonstration examples/demo-config.json est introuvable.",
          },
          { status: 404 }
        );
      }
    }

    // Persistance directe en BDD sans intermédiaire réseau
    const saveResult = await saveTopologyPayload({
      floor: configData.floor,
      racks: configData.racks,
      nodes: configData.nodes,
      zones: configData.zones,
      sites: configData.site ? [configData.site] : configData.sites,
      customPivots: configData.customPivots || {},
    });

    return NextResponse.json({
      success: true,
      importedConfig: configData,
      saveResult,
    });
  } catch (err: unknown) {
    console.error("Erreur lors de l import de topologie :", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
