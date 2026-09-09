import { NextResponse } from "next/server";
import { MOCK_DISCOVERED_DEVICES, DeviceTelemetry } from "@/data/settingsStore";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const subnet = body.subnet || "10.42.0.0/20";
    const community = body.community || "public";
    const version = body.version || "v2c";

    // Simuler un scan SNMP réseau
    const discoveredDevices: DeviceTelemetry[] = MOCK_DISCOVERED_DEVICES.map((dev) => {
      // Variations légères pour un effet dynamique réaliste
      const cpuJitter = Math.floor(Math.random() * 6) - 3;
      const memJitter = Math.floor(Math.random() * 4) - 2;
      return {
        ...dev,
        cpuLoadPercent: Math.max(5, Math.min(99, dev.cpuLoadPercent + cpuJitter)),
        memoryUsagePercent: Math.max(10, Math.min(95, dev.memoryUsagePercent + memJitter)),
      };
    });

    const summary = {
      total: discoveredDevices.length,
      online: discoveredDevices.filter((d) => d.status === "ONLINE").length,
      warning: discoveredDevices.filter((d) => d.status === "WARNING").length,
      offline: discoveredDevices.filter((d) => d.status === "OFFLINE").length,
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      subnet,
      version,
      community: community.replace(/./g, "*"),
      devices: discoveredDevices,
      summary,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Erreur lors du scan SNMP",
      },
      { status: 500 }
    );
  }
}
