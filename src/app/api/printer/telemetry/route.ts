import { NextRequest, NextResponse } from "next/server";
import snmp from "net-snmp";
import net from "net";

function snmpGetPromise(session: any, oids: string[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    session.get(oids, (err: any, varbinds: any[]) => {
      if (err) reject(err);
      else resolve(varbinds || []);
    });
  });
}

function snmpSubtreePromise(session: any, rootOid: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    session.subtree(
      rootOid,
      (varbinds: any[]) => {
        for (const vb of varbinds) {
          if (!snmp.isVarbindError(vb)) {
            results.push(vb);
          }
        }
      },
      (err: any) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
}

/**
 * Teste la connectivité TCP sur un port donné (ex: 631 pour IPP, 9100 pour RAW JetDirect)
 */
function testTcpPort(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    try {
      socket.connect(port, host);
    } catch {
      resolve(false);
    }
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ip = searchParams.get("ip")?.trim();
  const community = searchParams.get("community")?.trim() || "public";

  if (!ip) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Veuillez renseigner l'adresse IP de l'imprimante pour interroger le périphérique réel.",
      },
      { status: 400 }
    );
  }

  // 1. Tenter l'interrogation SNMP (Printer MIB RFC 3805 & MIB-II)
  let snmpSession: any = null;
  let snmpSuccess = false;
  let model: string | undefined = undefined;
  let totalPages: number | undefined = undefined;
  let tonerBlack: number | undefined = undefined;
  let tonerCyan: number | undefined = undefined;
  let tonerMagenta: number | undefined = undefined;
  let tonerYellow: number | undefined = undefined;
  let paperTrayStatus: "OK" | "LOW" | "EMPTY" | "JAM" = "OK";
  let detectedProtocol: "IPP_IPPS" | "RAW_9100" = "IPP_IPPS";

  try {
    snmpSession = snmp.createSession(ip, community, {
      port: 161,
      version: snmp.Version2c,
      timeout: 2000,
      retries: 1,
    });

    // OIDs MIB Système & Printer MIB de base
    const baseOids = [
      "1.3.6.1.2.1.1.1.0", // sysDescr
      "1.3.6.1.2.1.1.5.0", // sysName
      "1.3.6.1.2.1.43.5.1.1.16.1", // prtGeneralPrinterName
      "1.3.6.1.2.1.43.10.2.1.4.1.1", // prtMarkerLifeCount (pages)
    ];

    const baseVbs = await snmpGetPromise(snmpSession, baseOids).catch(() => []);

    if (baseVbs && baseVbs.length > 0) {
      const sysDescr = baseVbs[0]?.value?.toString()?.trim();
      const sysName = baseVbs[1]?.value?.toString()?.trim();
      const prtName = baseVbs[2]?.value?.toString()?.trim();
      const pageCountRaw = baseVbs[3]?.value;

      if (prtName) {
        model = prtName;
      } else if (sysDescr) {
        // Souvent le sysDescr contient le nom exact du modèle de l'imprimante
        model = sysDescr.split("\n")[0]?.split(",")[0]?.trim();
      } else if (sysName) {
        model = sysName;
      }

      if (typeof pageCountRaw === "number" && pageCountRaw > 0) {
        totalPages = pageCountRaw;
      }

      if (model || totalPages !== undefined) {
        snmpSuccess = true;
      }
    }

    // Interroger les cartouches de toner via le sous-arbre prtMarkerSupplies (1.3.6.1.2.1.43.11.1.1)
    if (snmpSuccess) {
      const suppliesVbs = await snmpSubtreePromise(snmpSession, "1.3.6.1.2.1.43.11.1.1").catch(
        () => []
      );

      if (suppliesVbs && suppliesVbs.length > 0) {
        // Rassembler par index de cartouche
        // OIDs: .6 = Description, .8 = MaxCapacity, .9 = Level
        const descriptions: Record<string, string> = {};
        const maxCapacities: Record<string, number> = {};
        const currentLevels: Record<string, number> = {};

        for (const vb of suppliesVbs) {
          const oid = vb.oid;
          if (oid.includes(".1.3.6.1.2.1.43.11.1.1.6.")) {
            const idx = oid.split(".").pop()!;
            descriptions[idx] = vb.value?.toString()?.toLowerCase() || "";
          } else if (oid.includes(".1.3.6.1.2.1.43.11.1.1.8.")) {
            const idx = oid.split(".").pop()!;
            maxCapacities[idx] = Number(vb.value) || 0;
          } else if (oid.includes(".1.3.6.1.2.1.43.11.1.1.9.")) {
            const idx = oid.split(".").pop()!;
            currentLevels[idx] = Number(vb.value) || 0;
          }
        }

        for (const idx of Object.keys(descriptions)) {
          const desc = descriptions[idx]!;
          const max = maxCapacities[idx] ?? 0;
          const cur = currentLevels[idx] ?? 0;

          if (max > 0 && cur >= 0) {
            const percent = Math.min(100, Math.max(0, Math.round((cur / max) * 100)));
            if (desc.includes("black") || desc.includes("noir")) {
              tonerBlack = percent;
            } else if (desc.includes("cyan")) {
              tonerCyan = percent;
            } else if (desc.includes("magenta")) {
              tonerMagenta = percent;
            } else if (desc.includes("yellow") || desc.includes("jaune")) {
              tonerYellow = percent;
            }
          }
        }
      }

      // Interroger l'état des bacs papier via prtInputStatus (1.3.6.1.2.1.43.8.1.1.11)
      const inputStatusVbs = await snmpSubtreePromise(snmpSession, "1.3.6.1.2.1.43.8.1.1.11").catch(
        () => []
      );
      for (const vb of inputStatusVbs) {
        const val = Number(vb.value);
        // RFC 3805 PrtInputStatusTC : bit flags
        if (val === 0) paperTrayStatus = "OK";
        else if (val === 8 || val === 9) paperTrayStatus = "EMPTY";
        else if (val === 4) paperTrayStatus = "LOW";
        else if (val === 2) paperTrayStatus = "JAM";
      }
    }
  } catch {
    // Échec de la session SNMP
  } finally {
    if (snmpSession) {
      try {
        snmpSession.close();
      } catch {}
    }
  }

  // 2. Si SNMP n'a pas répondu, vérifier si les ports IPP (631) ou RAW JetDirect (9100) sont ouverts
  const isIppOpen = await testTcpPort(ip, 631, 1500);
  const isRawOpen = !isIppOpen ? await testTcpPort(ip, 9100, 1500) : false;

  if (isIppOpen) {
    detectedProtocol = "IPP_IPPS";
  } else if (isRawOpen) {
    detectedProtocol = "RAW_9100";
  }

  // 3. Synthèse : Si aucun protocole n'a répondu, renvoyer une erreur explicite SANS INVENTER DE DONNÉES
  if (!snmpSuccess && !isIppOpen && !isRawOpen) {
    return NextResponse.json(
      {
        success: false,
        error: `Impossible de joindre l'imprimante à l'adresse ${ip}. Vérifiez qu'elle est allumée et accessible sur le réseau (ports SNMP 161 ou IPP 631 / RAW 9100).`,
      },
      { status: 502 }
    );
  }

  // Si on a détecté le port IPP/RAW mais sans SNMP (SNMP désactivé sur l'imprimante)
  if (!snmpSuccess) {
    return NextResponse.json({
      success: true,
      protocol: detectedProtocol,
      paperTrayStatus: "OK",
      message: `Périphérique détecté sur le port ${detectedProtocol === "IPP_IPPS" ? "IPP 631" : "RAW 9100"}. SNMP est désactivé ou filtré sur l'imprimante (les jauges précises de toner requièrent SNMP v2c communauté '${community}').`,
    });
  }

  return NextResponse.json({
    success: true,
    protocol: detectedProtocol,
    printerModel: model,
    totalPagesPrinted: totalPages,
    tonerBlack,
    tonerCyan,
    tonerMagenta,
    tonerYellow,
    paperTrayStatus,
  });
}
