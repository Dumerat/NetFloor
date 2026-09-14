/**
 * Tests unitaires — src/data/vlanStyles.ts
 * Couvre : DEFAULT_VLAN_STYLES, DEMO_VLAN_STYLES, loadStoredVlanStyles,
 *          saveStoredVlanStyles, getKonvaStrokeConfig
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_VLAN_STYLES,
  DEMO_VLAN_STYLES,
  PRESET_VLAN_COLORS,
  loadStoredVlanStyles,
  saveStoredVlanStyles,
  getKonvaStrokeConfig,
  type VlanStyle,
} from "./vlanStyles";

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

const STORAGE_KEY = "netfloor_vlan_styles_v1";

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ── Constantes ───────────────────────────────────────────────────────────────
describe("DEFAULT_VLAN_STYLES", () => {
  it("est vide par défaut (aucun VLAN préconfiguré)", () => {
    expect(Object.keys(DEFAULT_VLAN_STYLES)).toHaveLength(0);
  });
});

describe("DEMO_VLAN_STYLES", () => {
  it("contient 7 styles VLAN de démonstration", () => {
    expect(Object.keys(DEMO_VLAN_STYLES)).toHaveLength(7);
  });

  it("chaque style a les champs obligatoires", () => {
    for (const style of Object.values(DEMO_VLAN_STYLES)) {
      expect(style.vlanId).toBeGreaterThan(0);
      expect(style.vlanName).toBeTruthy();
      expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(["SOLID", "DASHED", "DOTTED"]).toContain(style.strokePattern);
      expect(["FINE", "NORMAL", "THICK"]).toContain(style.thickness);
    }
  });

  it("VLAN 20 est Data PC en bleu SOLID NORMAL", () => {
    expect(DEMO_VLAN_STYLES[20]?.vlanName).toBe("VLAN 20 (Data PC)");
    expect(DEMO_VLAN_STYLES[20]?.color).toBe("#3b82f6");
    expect(DEMO_VLAN_STYLES[20]?.strokePattern).toBe("SOLID");
    expect(DEMO_VLAN_STYLES[20]?.thickness).toBe("NORMAL");
  });

  it("VLAN 30 est VoIP en violet DASHED", () => {
    expect(DEMO_VLAN_STYLES[30]?.strokePattern).toBe("DASHED");
  });

  it("VLAN 40 est Print en DOTTED FINE", () => {
    expect(DEMO_VLAN_STYLES[40]?.strokePattern).toBe("DOTTED");
    expect(DEMO_VLAN_STYLES[40]?.thickness).toBe("FINE");
  });
});

describe("PRESET_VLAN_COLORS", () => {
  it("contient 9 couleurs prédéfinies", () => {
    expect(PRESET_VLAN_COLORS).toHaveLength(9);
  });

  it("chaque couleur est un hex valide", () => {
    for (const c of PRESET_VLAN_COLORS) {
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.name).toBeTruthy();
    }
  });
});

// ── loadStoredVlanStyles ─────────────────────────────────────────────────────
describe("loadStoredVlanStyles", () => {
  it("retourne DEFAULT_VLAN_STYLES (vide) quand localStorage est vide", () => {
    const result = loadStoredVlanStyles();
    expect(result).toEqual(DEFAULT_VLAN_STYLES);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("fusionne les styles localStorage avec DEFAULT_VLAN_STYLES", () => {
    const stored = {
      99: {
        vlanId: 99,
        vlanName: "Trunk",
        color: "#f43f5e",
        strokePattern: "SOLID",
        thickness: "THICK",
      },
    };
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(stored));
    const result = loadStoredVlanStyles();
    expect(result[99]?.vlanName).toBe("Trunk");
  });

  it("retourne DEFAULT_VLAN_STYLES si le JSON est invalide", () => {
    localStorageMock.getItem.mockReturnValueOnce("{ invalide {{{");
    const result = loadStoredVlanStyles();
    expect(result).toEqual(DEFAULT_VLAN_STYLES);
  });

  it("retourne DEFAULT_VLAN_STYLES si window est undefined", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error test purpose
    globalThis.window = undefined;
    const result = loadStoredVlanStyles();
    expect(result).toEqual(DEFAULT_VLAN_STYLES);
    globalThis.window = originalWindow;
  });
});

// ── saveStoredVlanStyles ─────────────────────────────────────────────────────
describe("saveStoredVlanStyles", () => {
  it("sérialise et sauvegarde les styles dans localStorage", () => {
    saveStoredVlanStyles(DEMO_VLAN_STYLES);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(DEMO_VLAN_STYLES)
    );
  });

  it("ne fait rien si window est undefined", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error test purpose
    globalThis.window = undefined;
    saveStoredVlanStyles(DEMO_VLAN_STYLES);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    globalThis.window = originalWindow;
  });

  it("sauvegarde un objet vide sans erreur", () => {
    expect(() => saveStoredVlanStyles({})).not.toThrow();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, "{}");
  });
});

// ── getKonvaStrokeConfig ─────────────────────────────────────────────────────
describe("getKonvaStrokeConfig", () => {
  it("sans style ni highlight → bleu par défaut, width 14, pas de dash", () => {
    const { strokeColor, strokeWidth, dash } = getKonvaStrokeConfig();
    expect(strokeColor).toBe("#3b82f6");
    expect(strokeWidth).toBe(14);
    expect(dash).toBeUndefined();
  });

  it("avec isHighlighted → couleur highlight #38bdf8 et width+6", () => {
    const { strokeColor, strokeWidth } = getKonvaStrokeConfig(undefined, true);
    expect(strokeColor).toBe("#38bdf8");
    expect(strokeWidth).toBe(20); // 14 + 6
  });

  it("thickness FINE → baseWidth 8", () => {
    const style: VlanStyle = {
      vlanId: 40,
      vlanName: "Print",
      color: "#f59e0b",
      strokePattern: "SOLID",
      thickness: "FINE",
    };
    const { strokeWidth } = getKonvaStrokeConfig(style);
    expect(strokeWidth).toBe(8);
  });

  it("thickness THICK → baseWidth 22", () => {
    const style: VlanStyle = {
      vlanId: 50,
      vlanName: "WiFi",
      color: "#6366f1",
      strokePattern: "SOLID",
      thickness: "THICK",
    };
    const { strokeWidth } = getKonvaStrokeConfig(style);
    expect(strokeWidth).toBe(22);
  });

  it("thickness NORMAL → baseWidth 14", () => {
    const style: VlanStyle = {
      vlanId: 20,
      vlanName: "Data",
      color: "#3b82f6",
      strokePattern: "SOLID",
      thickness: "NORMAL",
    };
    const { strokeWidth } = getKonvaStrokeConfig(style);
    expect(strokeWidth).toBe(14);
  });

  it("strokePattern DASHED → dash array avec 2 valeurs", () => {
    const style: VlanStyle = {
      vlanId: 30,
      vlanName: "VoIP",
      color: "#a855f7",
      strokePattern: "DASHED",
      thickness: "NORMAL",
    };
    const { dash } = getKonvaStrokeConfig(style);
    expect(Array.isArray(dash)).toBe(true);
    expect(dash).toHaveLength(2);
    // longueur = round(14 * 2.6) = 36, intervalle = round(14 * 2.8) = 39
    expect(dash![0]).toBe(Math.round(14 * 2.6));
    expect(dash![1]).toBe(Math.round(14 * 2.8));
  });

  it("strokePattern DOTTED → dash array [1, round(width*2.4)]", () => {
    const style: VlanStyle = {
      vlanId: 40,
      vlanName: "Print",
      color: "#f59e0b",
      strokePattern: "DOTTED",
      thickness: "FINE",
    };
    const { strokeWidth, dash } = getKonvaStrokeConfig(style);
    expect(strokeWidth).toBe(8);
    expect(Array.isArray(dash)).toBe(true);
    expect(dash![0]).toBe(1);
    expect(dash![1]).toBe(Math.round(8 * 2.4));
  });

  it("strokePattern SOLID → dash undefined", () => {
    const style: VlanStyle = {
      vlanId: 20,
      vlanName: "Data",
      color: "#3b82f6",
      strokePattern: "SOLID",
      thickness: "NORMAL",
    };
    const { dash } = getKonvaStrokeConfig(style);
    expect(dash).toBeUndefined();
  });

  it("highlight avec style THICK → strokeWidth = 22 + 6 = 28", () => {
    const style: VlanStyle = {
      vlanId: 50,
      vlanName: "WiFi",
      color: "#6366f1",
      strokePattern: "SOLID",
      thickness: "THICK",
    };
    const { strokeWidth, strokeColor } = getKonvaStrokeConfig(style, true);
    expect(strokeWidth).toBe(28);
    expect(strokeColor).toBe("#38bdf8");
  });

  it("utilise la couleur du style quand non highlighted", () => {
    const style: VlanStyle = {
      vlanId: 99,
      vlanName: "Trunk",
      color: "#f43f5e",
      strokePattern: "SOLID",
      thickness: "THICK",
    };
    const { strokeColor } = getKonvaStrokeConfig(style, false);
    expect(strokeColor).toBe("#f43f5e");
  });
});
