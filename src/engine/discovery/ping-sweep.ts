import net from "net";
import dns from "dns";
import { exec } from "child_process";
import { promisify } from "util";
import { RawHostProbe } from "./types";
import { lookupOui, normalizeMac } from "./oui-database";

const execAsync = promisify(exec);

/**
 * Développe une plage CIDR (ex: "192.168.1.0/24") en liste d'adresses IP.
 */
export function expandCidr(cidr: string): string[] {
  const trimmed = cidr.trim();
  if (!trimmed.includes("/")) {
    return [trimmed === "localhost" ? "127.0.0.1" : trimmed];
  }

  const [ipPart, maskPart] = trimmed.split("/");
  const prefix = Number.parseInt(maskPart ?? "32", 10);
  const parts = ipPart?.split(".").map(Number);

  if (!parts || parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return [trimmed.split("/")[0] ?? "127.0.0.1"];
  }

  if (prefix === 32) return [ipPart!];

  const ipInt = (parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const networkInt = (ipInt & mask) >>> 0;
  const broadcastInt = (networkInt | ~mask) >>> 0;

  const count = broadcastInt - networkInt - 1;
  // Limiter pour la sécurité à un /22 (1022 hôtes max par scan)
  const maxScan = Math.min(count, 1022);

  const ips: string[] = [];
  for (let i = 1; i <= maxScan; i++) {
    const current = networkInt + i;
    const p1 = (current >>> 24) & 255;
    const p2 = (current >>> 16) & 255;
    const p3 = (current >>> 8) & 255;
    const p4 = current & 255;
    ips.push(`${p1}.${p2}.${p3}.${p4}`);
  }

  return ips;
}

/**
 * Sonde rapide TCP multi-ports pour vérifier la réactivité d'un hôte (sans privilèges root).
 */
export async function probeTcpHost(
  ip: string,
  ports = [80, 443, 22, 135, 445, 161, 8080],
  timeoutMs = 400
): Promise<{ isAlive: boolean; openPorts: number[]; latencyMs: number }> {
  const startTime = Date.now();
  const openPorts: number[] = [];

  const probePort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });

      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });

      socket.once("error", (err: any) => {
        socket.destroy();
        // Sur Windows/Linux, ECONNREFUSED signifie que la machine a répondu au SYN par un RST !
        // Donc l'hôte est 100% vivant sur le réseau L3 même si le port est fermé !
        if (err.code === "ECONNREFUSED") {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      socket.connect(port, ip);
    });
  };

  // Sonde les ports les plus fréquents en parallèle
  const results = await Promise.all(ports.map((p) => probePort(p)));
  results.forEach((isOpen, idx) => {
    if (isOpen) openPorts.push(ports[idx]!);
  });

  const latencyMs = Date.now() - startTime;
  return {
    isAlive: openPorts.length > 0 || results.some(Boolean),
    openPorts,
    latencyMs,
  };
}

/**
 * Sonde ICMP native système (ping OS).
 * Fonctionne sans privilèges root et met automatiquement à jour le cache ARP du système.
 */
export async function probeIcmpHost(ip: string, timeoutMs = 350): Promise<boolean> {
  if (!ip || ip === "0.0.0.0") return false;

  try {
    const isWindows = process.platform === "win32";
    const cmd = isWindows
      ? `ping -n 1 -w ${timeoutMs} ${ip}`
      : `ping -c 1 -W ${Math.max(1, Math.ceil(timeoutMs / 1000))} ${ip}`;

    const { stdout } = await execAsync(cmd, { timeout: timeoutMs + 600 });
    const lower = stdout.toLowerCase();
    return isWindows
      ? lower.includes("ttl=") || lower.includes("temps=") || lower.includes("temps<")
      : lower.includes("bytes from") || lower.includes("1 received");
  } catch {
    return false;
  }
}

/**
 * Récupère le cache ARP du système d'exploitation pour mapper IP <-> MAC locales.
 */
export async function getSystemArpTable(): Promise<Map<string, string>> {
  const arpMap = new Map<string, string>();
  try {
    const isWindows = process.platform === "win32";
    const command = isWindows ? "arp -a" : "arp -n";
    const { stdout } = await execAsync(command, { timeout: 3000 });

    const lines = stdout.split("\n");
    for (const line of lines) {
      // Regex pour capturer IPv4 et MAC standard (XX-XX-XX-XX-XX-XX ou XX:XX:XX:XX:XX:XX)
      const match = line.match(
        /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\s+([0-9a-fA-F:-]{17})/
      );
      if (match && match[1] && match[2]) {
        const ip = match[1];
        const mac = normalizeMac(match[2]);
        // Ignorer les adresses broadcast ou multicast (FF-FF-FF-FF-FF-FF, 224.0.0.x)
        if (mac !== "FF:FF:FF:FF:FF:FF" && !ip.startsWith("224.") && !ip.startsWith("239.")) {
          arpMap.set(ip, mac);
        }
      }
    }
  } catch {
    // Si la commande arp échoue ou n'est pas disponible dans l'environnement, retour de la map vide
  }
  return arpMap;
}

/**
 * Résolution DNS inverse pour déduire le nom d'hôte d'une machine.
 */
export async function resolveReverseDns(ip: string): Promise<string | undefined> {
  try {
    const hostnames = await dns.promises.reverse(ip);
    if (hostnames && hostnames.length > 0) {
      return hostnames[0];
    }
  } catch {
    // Pas d'entrée PTR configurée sur le DNS
  }
  return undefined;
}

/**
 * Exécute la Passe 1 : Balayage CIDR & Résolution L3 / Hôtes actifs.
 */
export async function executePingSweep(
  cidr: string,
  options: {
    timeoutMs?: number;
    concurrency?: number;
    onProgress?: (scanned: number, total: number) => void;
  } = {}
): Promise<RawHostProbe[]> {
  const targetIps = expandCidr(cidr);
  const timeoutMs = options.timeoutMs ?? 350;
  const concurrency = options.concurrency ?? 32;

  // 1. Lire la table ARP système
  const arpTable = await getSystemArpTable();

  const results: RawHostProbe[] = [];
  let scannedCount = 0;

  // 2. Traitement par lots (concurrence bornée)
  for (let i = 0; i < targetIps.length; i += concurrency) {
    const batch = targetIps.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (ip) => {
        // Vérifier si l'hôte est déjà présent dans la table ARP
        const knownMac = arpTable.get(ip);
        const tcpProbe = await probeTcpHost(ip, [80, 443, 22, 135, 445, 161], timeoutMs);

        let isAlive = tcpProbe.isAlive || Boolean(knownMac);
        if (!isAlive) {
          const icmpAlive = await probeIcmpHost(ip, timeoutMs);
          if (icmpAlive) {
            isAlive = true;
          }
        }
        if (!isAlive) return null;

        // Si l'hôte est vivant mais sans MAC encore apprise, re-vérifier la table ARP après son émission TCP/ICMP
        let mac = knownMac;
        if (!mac) {
          const freshArp = await getSystemArpTable();
          mac = freshArp.get(ip);
        }

        const hostname = await resolveReverseDns(ip);
        const { vendor } = mac ? lookupOui(mac) : { vendor: undefined };

        return {
          ip,
          mac: mac ? normalizeMac(mac) : undefined,
          hostname,
          isAlive: true,
          responseTimeMs: tcpProbe.latencyMs,
          openPorts: tcpProbe.openPorts,
          vendor,
          source: knownMac ? ("ARP_LOCAL" as const) : ("TCP_PROBE" as const),
        };
      })
    );

    for (const r of batchResults) {
      if (r) results.push(r);
    }

    scannedCount += batch.length;
    options.onProgress?.(scannedCount, targetIps.length);
  }

  // Si une cible unique a été spécifiée explicitement (ex: /32 ou IP unique) et n'a pas répondu en TCP
  // (fréquent sur des commutateurs durcis où seul SNMP UDP 161 est ouvert), on la conserve pour la passe SNMP.
  if (targetIps.length === 1 && results.length === 0) {
    const singleIp = targetIps[0]!;
    const freshArp = await getSystemArpTable();
    const mac = freshArp.get(singleIp);
    const hostname = await resolveReverseDns(singleIp);
    const { vendor } = mac ? lookupOui(mac) : { vendor: undefined };

    results.push({
      ip: singleIp,
      mac: mac ? normalizeMac(mac) : undefined,
      hostname,
      isAlive: true,
      responseTimeMs: 0,
      openPorts: [161],
      vendor,
      source: "TCP_PROBE",
    });
  }

  return results;
}
