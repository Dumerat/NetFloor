import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const target = (body.target || body.type || "").toLowerCase();
    const config = body.config || body;

    const startTime = Date.now();

    // ── Webhook ──────────────────────────────────────────────────────────────
    if (target === "webhooks") {
      const webhookUrl = config?.webhookUrl;
      if (!webhookUrl) {
        return NextResponse.json(
          { success: false, error: "URL de Webhook manquante." },
          { status: 400 }
        );
      }

      if (!webhookUrl.startsWith("http://") && !webhookUrl.startsWith("https://")) {
        return NextResponse.json(
          { success: false, error: "URL invalide. Elle doit commencer par http:// ou https://" },
          { status: 400 }
        );
      }

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "🔔 [NetFloor Alert Test] Test de communication depuis NetFloor.",
            themeColor: "0076D7",
          }),
          signal: AbortSignal.timeout(5000),
        });

        return NextResponse.json({
          success: res.ok,
          target: "webhooks",
          delivered: res.ok,
          statusCode: res.status,
          responseBody: `Réponse du serveur webhook : HTTP ${res.status}`,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          ...(res.ok ? {} : { error: `Le webhook a répondu HTTP ${res.status}` }),
        });
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            target: "webhooks",
            error: `Impossible de joindre le webhook : ${err instanceof Error ? err.message : "Timeout ou réseau inaccessible"}`,
            latencyMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
          { status: 502 }
        );
      }
    }

    // ── NetBox DCIM & IPAM (Health Check) ──────────────────────────────────
    if (target === "netbox") {
      const url = config?.url;
      const token = config?.apiToken;

      if (!url || !token) {
        return NextResponse.json(
          { success: false, error: "URL et token API NetBox requis." },
          { status: 400 }
        );
      }

      try {
        const res = await fetch(`${url.replace(/\/$/, "")}/api/status/`, {
          method: "GET",
          headers: { Authorization: `Token ${token}`, Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
          return NextResponse.json(
            { success: false, error: `NetBox a répondu HTTP ${res.status}` },
            { status: 502 }
          );
        }

        const data = await res.json().catch(() => ({}));

        return NextResponse.json({
          success: true,
          target: "netbox",
          status: "CONNECTED",
          latencyMs: Date.now() - startTime,
          details: {
            serverVersion: data["netbox-version"] ?? "inconnu",
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            error: `Impossible de joindre NetBox : ${err instanceof Error ? err.message : "Timeout ou réseau inaccessible"}`,
          },
          { status: 502 }
        );
      }
    }

    // ── NetBox IPAM (Importation des Préfixes & VLANs) ─────────────────────────
    if (target === "netbox_prefixes" || target === "netbox_ipam") {
      const url = config?.url;
      const token = config?.apiToken;

      if (!url || !token) {
        return NextResponse.json(
          { success: false, error: "URL et token API NetBox requis." },
          { status: 400 }
        );
      }

      try {
        const res = await fetch(`${url.replace(/\/$/, "")}/api/ipam/prefixes/?limit=100`, {
          method: "GET",
          headers: { Authorization: `Token ${token}`, Accept: "application/json" },
          signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) {
          return NextResponse.json(
            { success: false, error: `NetBox IPAM a répondu HTTP ${res.status}` },
            { status: 502 }
          );
        }

        const data = await res.json().catch(() => ({ results: [] }));
        const rawPrefixes = Array.isArray(data.results) ? data.results : [];

        const subnets = rawPrefixes.map((p: any, idx: number) => {
          const vlanVid = p.vlan?.vid || 20 + idx * 10;
          const vlanName = p.vlan?.name || p.description || `VLAN ${vlanVid} NetBox`;
          const cidr = p.prefix || "10.0.0.0/24";
          const baseIp = cidr.split("/")[0] || "10.0.0.1";
          const baseSub = baseIp.replace(/\.\d+$/, "");
          const gateway = `${baseSub}.254`;
          const dhcpRange = `${baseSub}.10 - ${baseSub}.200`;

          return {
            vlanId: vlanVid,
            vlanName,
            cidr,
            gateway,
            dhcpRange,
            totalIps: 254,
            usedIps: p.custom_fields?.used_ips || 12,
            dns1: "1.1.1.1",
            dns2: "8.8.8.8",
            domain: "corp.local",
            source: "NETBOX_IPAM",
          };
        });

        return NextResponse.json({
          success: true,
          target: "netbox_prefixes",
          count: subnets.length,
          subnets,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            error: `Erreur d'extraction IPAM NetBox : ${err instanceof Error ? err.message : "Inaccessible"}`,
          },
          { status: 502 }
        );
      }
    }

    // ── GLPI ─────────────────────────────────────────────────────────────────
    if (target === "glpi") {
      const url = config?.url;
      const token = config?.apiToken;

      if (!url || !token) {
        return NextResponse.json(
          { success: false, error: "URL et token API GLPI requis." },
          { status: 400 }
        );
      }

      try {
        const initRes = await fetch(`${url.replace(/\/$/, "")}/initSession`, {
          method: "GET",
          headers: {
            "App-Token": token,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        });

        if (!initRes.ok) {
          return NextResponse.json(
            { success: false, error: `GLPI a répondu HTTP ${initRes.status}` },
            { status: 502 }
          );
        }

        return NextResponse.json({
          success: true,
          target: "glpi",
          status: "AUTHENTICATED",
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            error: `Impossible de joindre GLPI : ${err instanceof Error ? err.message : "Timeout ou réseau inaccessible"}`,
          },
          { status: 502 }
        );
      }
    }

    // ── Intune / Microsoft Graph ──────────────────────────────────────────────
    if (target === "intune") {
      const tenantId = config?.tenantId;
      const clientId = config?.clientId;
      const clientSecret = config?.clientSecret;

      if (!tenantId || !clientId || !clientSecret) {
        return NextResponse.json(
          { success: false, error: "Tenant ID, Client ID et Client Secret requis pour Intune." },
          { status: 400 }
        );
      }

      try {
        const tokenRes = await fetch(
          `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              client_id: clientId,
              client_secret: clientSecret,
              scope: "https://graph.microsoft.com/.default",
            }),
            signal: AbortSignal.timeout(8000),
          }
        );

        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({}));
          return NextResponse.json(
            {
              success: false,
              error: `Authentification Microsoft échouée : ${err.error_description ?? `HTTP ${tokenRes.status}`}`,
            },
            { status: 401 }
          );
        }

        return NextResponse.json({
          success: true,
          target: "intune",
          status: "AUTHENTICATED",
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            error: `Impossible de joindre Microsoft Graph : ${err instanceof Error ? err.message : "Timeout ou réseau inaccessible"}`,
          },
          { status: 502 }
        );
      }
    }

    // ── Aruba Central Cloud ──────────────────────────────────────────────────
    if (target === "aruba") {
      const cluster = config?.cluster || "eu-central-1.central.arubanetworks.com";
      const token = config?.token || config?.apiKey;

      if (!token) {
        return NextResponse.json(
          { success: false, error: "Token d'accès Aruba Central requis." },
          { status: 400 }
        );
      }

      try {
        const cleanCluster = cluster.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const res = await fetch(`https://${cleanCluster}/monitoring/v2/switches`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(7000),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return NextResponse.json(
            {
              success: false,
              error: `Aruba Central a répondu HTTP ${res.status} (${err.message || err.error || "Refus d'accès"})`,
            },
            { status: 502 }
          );
        }

        const data = await res.json().catch(() => ({ switches: [] }));
        const rawSwitches = Array.isArray(data.switches) ? data.switches : [];

        const switches = rawSwitches.map((s: any) => ({
          name: s.name || s.hostname || "SW-ARUBA-CENTRAL",
          model: s.model || s.part_number || "Aruba CX Switch",
          portsCount: s.num_ports || s.ports || 24,
          poeBudgetW: s.poe_budget || 370,
          ipAddress: s.ip_address || "10.42.0.2",
          macAddress: s.macaddr || "00:0B:86:11:22:33",
          serial: s.serial || "",
          firmware: s.firmware_version,
          cloudStatus:
            s.status === "Up" || s.status === "ONLINE" ? ("ONLINE" as const) : ("SYNCED" as const),
        }));

        return NextResponse.json({
          success: true,
          target: "aruba",
          switches,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            error: `Impossible de contacter Aruba Central : ${err instanceof Error ? err.message : "Cluster inaccessible ou timeout"}`,
          },
          { status: 502 }
        );
      }
    }

    // ── Zyxel Nebula Cloud ───────────────────────────────────────────────────
    if (target === "zyxel" || target === "nebula") {
      const org = config?.org;
      const apiKey = config?.apiKey || config?.token;

      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: "Clé d'API Zyxel Nebula requise." },
          { status: 400 }
        );
      }

      try {
        const endpoint = org
          ? `https://api.nebula.zyxel.com/v1/nebula/organizations/${encodeURIComponent(org)}/switches`
          : `https://api.nebula.zyxel.com/v1/nebula/switches`;

        const res = await fetch(endpoint, {
          method: "GET",
          headers: {
            "X-Api-Key": apiKey,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(7000),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return NextResponse.json(
            {
              success: false,
              error: `Zyxel Nebula a répondu HTTP ${res.status} (${err.message || "Clé API ou Organisation invalide"})`,
            },
            { status: 502 }
          );
        }

        const data = await res.json().catch(() => ({ switches: [] }));
        const rawSwitches = Array.isArray(data.switches)
          ? data.switches
          : Array.isArray(data)
            ? data
            : [];

        const switches = rawSwitches.map((s: any) => ({
          name: s.name || s.hostname || "SW-ZYXEL-NEBULA",
          model: s.model || "Zyxel GS1920-24HP",
          portsCount: s.ports_count || 24,
          poeBudgetW: s.poe_budget || 375,
          ipAddress: s.ip || s.lan_ip || "10.42.0.3",
          macAddress: s.mac || "00:19:CB:44:55:66",
          serial: s.serial || "",
          cloudStatus: "SYNCED" as const,
        }));

        return NextResponse.json({
          success: true,
          target: "zyxel",
          switches,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            error: `Impossible de contacter Zyxel Nebula : ${err instanceof Error ? err.message : "Erreur réseau"}`,
          },
          { status: 502 }
        );
      }
    }

    // ── Cisco Meraki Dashboard ───────────────────────────────────────────────
    if (target === "meraki" || target === "cisco_meraki") {
      const apiKey = config?.apiKey || config?.token;
      const orgId = config?.orgId || config?.organizationId;

      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: "Clé d'API Cisco Meraki Dashboard requise." },
          { status: 400 }
        );
      }

      try {
        const endpoint = orgId
          ? `https://api.meraki.com/api/v1/organizations/${encodeURIComponent(orgId)}/devices`
          : `https://api.meraki.com/api/v1/organizations`;

        const res = await fetch(endpoint, {
          method: "GET",
          headers: {
            "X-Cisco-Meraki-API-Key": apiKey,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return NextResponse.json(
            {
              success: false,
              error: `Cisco Meraki a répondu HTTP ${res.status} (${err.errors?.join(", ") || "Accès refusé"})`,
            },
            { status: 502 }
          );
        }

        const data = await res.json().catch(() => []);
        const rawDevices = Array.isArray(data) ? data : [];

        // Filtrer les commutateurs MS / switchs
        const switchDevices = rawDevices.filter((d: any) =>
          Boolean(
            d.model?.startsWith("MS") || d.productType === "switch" || d.model?.includes("Switch")
          )
        );

        const switches = switchDevices.map((d: any) => {
          const is48 = Boolean(d.model?.includes("48"));
          return {
            name: d.name || d.mac || "SW-MERAKI-MS",
            model: d.model || "Cisco Meraki MS250-24P",
            portsCount: is48 ? 48 : 24,
            poeBudgetW: 370,
            ipAddress: d.lanIp || "10.42.0.4",
            macAddress: d.mac || "00:18:0A:11:22:33",
            serial: d.serial || "",
            firmware: d.firmware,
            cloudStatus: d.status === "online" ? ("ONLINE" as const) : ("SYNCED" as const),
          };
        });

        return NextResponse.json({
          success: true,
          target: "meraki",
          switches:
            switches.length > 0 ? switches : rawDevices.length > 0 && !orgId ? [] : switches,
          orgs: !orgId && Array.isArray(data) ? data : undefined,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            error: `Impossible de contacter Cisco Meraki : ${err instanceof Error ? err.message : "Erreur réseau"}`,
          },
          { status: 502 }
        );
      }
    }

    // ── Ubiquiti UniFi Network Controller ────────────────────────────────────
    if (target === "ubiquiti" || target === "unifi") {
      const host = config?.host || config?.url;
      const apiKey = config?.apiKey || config?.token;
      const site = config?.site || "default";

      if (!host) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Hôte ou URL du contrôleur UniFi requis (ex: 192.168.1.1 ou https://unifi.corp.local).",
          },
          { status: 400 }
        );
      }

      try {
        const cleanHost = host.startsWith("http") ? host : `https://${host}:8443`;
        const endpoint = `${cleanHost.replace(/\/$/, "")}/proxy/network/api/s/${encodeURIComponent(site)}/stat/device`;

        const res = await fetch(endpoint, {
          method: "GET",
          headers: {
            "X-API-KEY": apiKey || "",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) {
          return NextResponse.json(
            {
              success: false,
              error: `Contrôleur UniFi a répondu HTTP ${res.status} (${res.status === 401 ? "Clé API / Token non autorisé" : "Erreur contrôleur"})`,
            },
            { status: 502 }
          );
        }

        const data = await res.json().catch(() => ({ data: [] }));
        const rawDevices = Array.isArray(data.data) ? data.data : [];

        // Filtrer les commutateurs USW / Switchs
        const switchDevices = rawDevices.filter((d: any) =>
          Boolean(d.type === "usw" || d.model?.includes("USW") || d.model?.includes("Switch"))
        );

        const switches = switchDevices.map((d: any) => ({
          name: d.name || d.model || "SW-UNIFI-USW",
          model: d.model || "Ubiquiti UniFi USW-24-PoE",
          portsCount: d.num_port || d.num_ports || (d.model?.includes("48") ? 48 : 24),
          poeBudgetW: d.total_poe_power || 95,
          ipAddress: d.ip || "10.42.0.5",
          macAddress: d.mac || "F4:92:BF:11:22:33",
          serial: d.serial || "",
          firmware: d.version,
          cloudStatus: d.state === 1 ? ("ONLINE" as const) : ("SYNCED" as const),
        }));

        return NextResponse.json({
          success: true,
          target: "ubiquiti",
          switches,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            error: `Impossible de contacter le contrôleur UniFi : ${err instanceof Error ? err.message : "Contrôleur inaccessible"}`,
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Cible d'intégration inconnue" },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" },
      { status: 500 }
    );
  }
}
