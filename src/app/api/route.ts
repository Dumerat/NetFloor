import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "netfloor-architect",
    version: "0.2.2",
    timestamp: new Date().toISOString(),
    endpoints: {
      topology: "/api/topology",
      trace: "/api/trace",
      snmp: "/api/snmp/discover",
      cablingImport: "/api/cabling/import",
      adTest: "/api/auth/ad-test",
      integrationsTest: "/api/integrations/test",
    },
  });
}
