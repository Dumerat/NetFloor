export type CableStrokePattern = "SOLID" | "DASHED" | "DOTTED";
export type CableThickness = "FINE" | "NORMAL" | "THICK";

export interface VlanStyle {
  vlanId: number;
  vlanName: string;
  color: string;
  strokePattern: CableStrokePattern;
  thickness: CableThickness;
}

export const PRESET_VLAN_COLORS = [
  { name: "Bleu France (Data)", hex: "#3b82f6" },
  { name: "Violet Télécom (VoIP)", hex: "#a855f7" },
  { name: "Ambre Chaud (Print)", hex: "#f59e0b" },
  { name: "Indigo Azur (Wi-Fi)", hex: "#6366f1" },
  { name: "Émeraude (Infra/Serveurs)", hex: "#10b981" },
  { name: "Rose Corail (Trunk/Cœur)", hex: "#f43f5e" },
  { name: "Cyan Océan (DMZ/Sécu)", hex: "#06b6d4" },
  { name: "Orange Fluide (IoT)", hex: "#f97316" },
  { name: "Blanc Pur (Gaine)", hex: "#f8fafc" },
];

export const DEFAULT_VLAN_STYLES: Record<number, VlanStyle> = {
  20: {
    vlanId: 20,
    vlanName: "VLAN 20 (Data PC)",
    color: "#3b82f6",
    strokePattern: "SOLID",
    thickness: "NORMAL",
  },
  30: {
    vlanId: 30,
    vlanName: "VLAN 30 (VoIP)",
    color: "#a855f7",
    strokePattern: "DASHED",
    thickness: "NORMAL",
  },
  40: {
    vlanId: 40,
    vlanName: "VLAN 40 (Print)",
    color: "#f59e0b",
    strokePattern: "DOTTED",
    thickness: "FINE",
  },
  50: {
    vlanId: 50,
    vlanName: "VLAN 50 (Wi-Fi Infra)",
    color: "#6366f1",
    strokePattern: "SOLID",
    thickness: "THICK",
  },
  10: {
    vlanId: 10,
    vlanName: "VLAN 10 (Serveurs ESXi)",
    color: "#10b981",
    strokePattern: "SOLID",
    thickness: "NORMAL",
  },
  99: {
    vlanId: 99,
    vlanName: "VLAN 99 (Trunk Inter-Switch)",
    color: "#f43f5e",
    strokePattern: "SOLID",
    thickness: "THICK",
  },
  1: {
    vlanId: 1,
    vlanName: "VLAN 1 (Management)",
    color: "#14b8a6",
    strokePattern: "SOLID",
    thickness: "FINE",
  },
};

const STORAGE_KEY = "netfloor_vlan_styles_v1";

export function loadStoredVlanStyles(): Record<number, VlanStyle> {
  if (typeof window === "undefined") return DEFAULT_VLAN_STYLES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VLAN_STYLES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_VLAN_STYLES, ...parsed };
  } catch {
    return DEFAULT_VLAN_STYLES;
  }
}

export function saveStoredVlanStyles(styles: Record<number, VlanStyle>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(styles));
  } catch (err) {
    console.error("Erreur de sauvegarde des styles VLAN dans le localStorage", err);
  }
}

/**
 * Convertit un style VLAN abstrait en propriétés concrètes Konva (couleur, épaisseur, tirets)
 */
export function getKonvaStrokeConfig(style?: VlanStyle, isHighlighted?: boolean) {
  const color = isHighlighted ? "#38bdf8" : (style?.color ?? "#3b82f6");

  let baseWidth = 14;
  if (style?.thickness === "FINE") baseWidth = 8;
  else if (style?.thickness === "THICK") baseWidth = 22;

  const strokeWidth = isHighlighted ? baseWidth + 6 : baseWidth;

  let dash: number[] | undefined = undefined;
  if (style?.strokePattern === "DASHED") {
    // Tirets espacés nets proportionnels : longueur = 2.6x épaisseur, intervalle = 2.8x épaisseur
    dash = [Math.round(strokeWidth * 2.6), Math.round(strokeWidth * 2.8)];
  } else if (style?.strokePattern === "DOTTED") {
    // VRAIS POINTS CIRCULAIRES : avec lineCap="round", un trait de longueur 1 forme un cercle parfait
    // Espacement proportionnel pour éviter la fusion des points même en forte épaisseur
    dash = [1, Math.round(strokeWidth * 2.4)];
  }

  return { strokeColor: color, strokeWidth, dash };
}
