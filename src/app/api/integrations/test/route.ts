import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { target, config } = body;

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

    // ── NetBox ───────────────────────────────────────────────────────────────
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
        const res = await fetch(`${url.replace(/\/$/, "")}/status/`, {
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
        // Tentative d'obtention du token OAuth2 client_credentials
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
