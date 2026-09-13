import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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

    // Appel direct au handler POST de /api/topology pour persister en base
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const topologyUrl = `${protocol}://${host}/api/topology`;

    const saveRes = await fetch(topologyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        floor: configData.floor,
        racks: configData.racks,
        nodes: configData.nodes,
        zones: configData.zones,
        sites: configData.site ? [configData.site] : configData.sites,
        customPivots: configData.customPivots || {},
      }),
    });

    const result = await saveRes.json();
    return NextResponse.json({
      success: true,
      importedConfig: configData,
      saveResult: result,
    });
  } catch (err: unknown) {
    console.error("Erreur lors de l import de topologie :", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
