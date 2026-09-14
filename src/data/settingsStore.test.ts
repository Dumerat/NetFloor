/**
 * Tests unitaires — src/data/settingsStore.ts
 * Couvre : loadStoredSettings, saveStoredSettings, resetStoredSettings
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  INITIAL_SETTINGS,
  DEMO_SETTINGS,
  MOCK_DISCOVERED_DEVICES,
  DEMO_DISCOVERED_DEVICES,
  loadStoredSettings,
  saveStoredSettings,
  resetStoredSettings,
  LAB_ACTIVE_DIRECTORY_CONFIG,
  LAB_SNMP_CONFIG,
} from "./settingsStore";

// ── Mock localStorage ──────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, "window", { value: globalThis, writable: true });
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

const STORAGE_KEY = "netfloor_dsi_enterprise_settings";

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ── INITIAL_SETTINGS ────────────────────────────────────────────────────────
describe("INITIAL_SETTINGS", () => {
  it("SSO est déconnecté par défaut", () => {
    expect(INITIAL_SETTINGS.sso.status).toBe("DISCONNECTED");
    expect(INITIAL_SETTINGS.sso.syncEnabled).toBe(false);
    expect(INITIAL_SETTINGS.sso.tenantId).toBe("");
  });

  it("subnets est vide par défaut", () => {
    expect(INITIAL_SETTINGS.subnets).toEqual([]);
  });

  it("toutes les intégrations sont désactivées", () => {
    expect(INITIAL_SETTINGS.integrations.netbox.enabled).toBe(false);
    expect(INITIAL_SETTINGS.integrations.glpi.enabled).toBe(false);
    expect(INITIAL_SETTINGS.integrations.intune.enabled).toBe(false);
    expect(INITIAL_SETTINGS.integrations.webhooks.enabled).toBe(false);
  });

  it("SNMP utilise v2c avec communauté public", () => {
    expect(INITIAL_SETTINGS.snmp.version).toBe("v2c");
    expect(INITIAL_SETTINGS.snmp.community).toBe("public");
  });
});

// ── LAB configs ─────────────────────────────────────────────────────────────
describe("LAB_ACTIVE_DIRECTORY_CONFIG", () => {
  it("pointe sur localhost avec LDAP non chiffré", () => {
    expect(LAB_ACTIVE_DIRECTORY_CONFIG.serverHost).toBe("127.0.0.1");
    expect(LAB_ACTIVE_DIRECTORY_CONFIG.port).toBe(389);
    expect(LAB_ACTIVE_DIRECTORY_CONFIG.encryption).toBe("NONE");
  });
});

describe("LAB_SNMP_CONFIG", () => {
  it("cible localhost en subnet /32", () => {
    expect(LAB_SNMP_CONFIG.targetSubnet).toBe("127.0.0.1/32");
    expect(LAB_SNMP_CONFIG.version).toBe("v2c");
  });
});

// ── DEMO_SETTINGS ───────────────────────────────────────────────────────────
describe("DEMO_SETTINGS", () => {
  it("SSO est connecté dans les données démo", () => {
    expect(DEMO_SETTINGS.sso.status).toBe("CONNECTED");
    expect(DEMO_SETTINGS.sso.syncEnabled).toBe(true);
  });

  it("contient 5 sous-réseaux VLAN de démonstration", () => {
    expect(DEMO_SETTINGS.subnets.length).toBe(5);
    expect(DEMO_SETTINGS.subnets[0].vlanId).toBe(1);
  });

  it("toutes les intégrations sont activées en démo", () => {
    expect(DEMO_SETTINGS.integrations.netbox.enabled).toBe(true);
    expect(DEMO_SETTINGS.integrations.glpi.enabled).toBe(true);
    expect(DEMO_SETTINGS.integrations.intune.enabled).toBe(true);
    expect(DEMO_SETTINGS.integrations.webhooks.enabled).toBe(true);
  });
});

// ── MOCK / DEMO discovered devices ──────────────────────────────────────────
describe("MOCK_DISCOVERED_DEVICES", () => {
  it("est vide par défaut", () => {
    expect(MOCK_DISCOVERED_DEVICES).toEqual([]);
  });
});

describe("DEMO_DISCOVERED_DEVICES", () => {
  it("contient 6 équipements de démonstration", () => {
    expect(DEMO_DISCOVERED_DEVICES.length).toBe(6);
  });

  it("chaque équipement a les champs obligatoires", () => {
    for (const dev of DEMO_DISCOVERED_DEVICES) {
      expect(dev.id).toBeTruthy();
      expect(dev.name).toBeTruthy();
      expect(dev.ip).toBeTruthy();
      expect(dev.status).toMatch(/^(ONLINE|WARNING|OFFLINE)$/);
    }
  });
});

// ── loadStoredSettings ───────────────────────────────────────────────────────
describe("loadStoredSettings", () => {
  it("retourne INITIAL_SETTINGS quand localStorage est vide", () => {
    const result = loadStoredSettings();
    expect(result.sso.status).toBe("DISCONNECTED");
    expect(result.subnets).toEqual([]);
  });

  it("fusionne les données localStorage avec INITIAL_SETTINGS", () => {
    const partial = {
      sso: { status: "CONNECTED", corporateDomain: "test.com" },
      subnets: [
        {
          vlanId: 42,
          vlanName: "TEST",
          cidr: "192.168.1.0/24",
          gateway: "192.168.1.1",
          dhcpRange: "",
          usedIps: 0,
          totalIps: 254,
        },
      ],
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(partial));
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(partial));

    const result = loadStoredSettings();
    expect(result.sso.corporateDomain).toBe("test.com");
    expect(result.subnets.length).toBe(1);
    expect(result.subnets[0].vlanId).toBe(42);
  });

  it("retourne INITIAL_SETTINGS si le JSON est invalide", () => {
    localStorageMock.getItem.mockReturnValueOnce("{ invalide json {{{");
    const result = loadStoredSettings();
    expect(result.sso.status).toBe("DISCONNECTED");
  });

  it("préserve activeDirectory imbriqué lors de la fusion", () => {
    const partial = {
      sso: {
        activeDirectory: { serverHost: "dc01.test.local", port: 636 },
      },
    };
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(partial));
    const result = loadStoredSettings();
    expect(result.sso.activeDirectory.serverHost).toBe("dc01.test.local");
    expect(result.sso.activeDirectory.port).toBe(636);
    // Les champs non fournis héritent de INITIAL_SETTINGS
    expect(result.sso.activeDirectory.encryption).toBe("NONE");
  });

  it("utilise INITIAL_SETTINGS.subnets si subnets parsés est vide", () => {
    const partial = { subnets: [] };
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(partial));
    const result = loadStoredSettings();
    expect(result.subnets).toEqual(INITIAL_SETTINGS.subnets);
  });

  it("préserve snmp lors de la fusion", () => {
    const partial = { snmp: { community: "private", version: "v3" } };
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(partial));
    const result = loadStoredSettings();
    expect(result.snmp.community).toBe("private");
    expect(result.snmp.version).toBe("v3");
    // Les autres champs restent
    expect(result.snmp.pollIntervalSeconds).toBe(60);
  });
});

// ── saveStoredSettings ───────────────────────────────────────────────────────
describe("saveStoredSettings", () => {
  it("sérialise et sauvegarde les paramètres dans localStorage", () => {
    saveStoredSettings(INITIAL_SETTINGS);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(INITIAL_SETTINGS)
    );
  });

  it("ne fait rien si window est undefined", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error test purpose
    globalThis.window = undefined;
    saveStoredSettings(INITIAL_SETTINGS);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    globalThis.window = originalWindow;
  });
});

// ── resetStoredSettings ──────────────────────────────────────────────────────
describe("resetStoredSettings", () => {
  it("supprime la clé localStorage et retourne INITIAL_SETTINGS", () => {
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(DEMO_SETTINGS));
    const result = resetStoredSettings();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(result.sso.status).toBe("DISCONNECTED");
    expect(result.subnets).toEqual([]);
  });

  it("retourne INITIAL_SETTINGS même si window est undefined", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error test purpose
    globalThis.window = undefined;
    const result = resetStoredSettings();
    expect(result.sso.status).toBe("DISCONNECTED");
    globalThis.window = originalWindow;
  });
});
