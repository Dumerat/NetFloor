/**
 * NetFloor Architect - Stockage Local & IndexedDB pour Gestion Multi-Plans et Multi-Sites
 * Permet de sauvegarder localement dans le navigateur des images de plans volumineuses (PNG, JPG, SVG)
 * avec leurs métadonnées, associées à des sites géographiques distincts.
 */

export interface FloorSite {
  id: string; // ex: 'site-principal', 'site-2'
  name: string; // ex: 'Site Principal', 'Site 2'
  code?: string | undefined; // ex: 'PARIS-HQ', 'LYON-01'
  address?: string | undefined; // ex: '12 Rue de la Paix, Paris'
  description?: string | undefined;
  surfaceM2?: number | undefined;
  color?: string | undefined; // ex: '#3b82f6', '#10b981'
  createdAtIso: string;
  updatedAtIso: string;
}

export interface StoredBackgroundPlan {
  id: string; // UUID unique : 'plan_1726000000_abc123'
  name: string;
  imageData: string; // Data URL base64 ou blob URL
  opacity: number; // 0.10 à 1.00
  isLocked: boolean;
  xMm: number;
  yMm: number;
  scale: number; // Ratio d'échelle du plan (mm par pixel d'image)
  widthMm?: number | undefined; // Largeur réelle en mm (ex: 60000)
  heightMm?: number | undefined; // Hauteur réelle en mm (ex: 35000)
  siteId?: string | undefined; // ID du site de rattachement (ex: 'site-principal')
  siteOrFloorGroup?: string | undefined; // ex: "RDC", "Étage 1", "Bâtiment A"
  visible: boolean;
  updatedAtIso: string;
}

const DB_NAME = "netfloor_plan_storage_v2";
const DB_VERSION = 2;
const STORE_PLANS = "background_plans";
const STORE_SITES = "floor_sites";

export const DEFAULT_SITE_ID = "site-principal";
export const DEFAULT_SITE: FloorSite = {
  id: DEFAULT_SITE_ID,
  name: "Site Principal",
  code: "SITE-01",
  address: "",
  description: "",
  surfaceM2: 0,
  color: "#3b82f6",
  createdAtIso: "2026-01-01T00:00:00.000Z",
  updatedAtIso: "2026-01-01T00:00:00.000Z",
};

export function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function generateSiteId(): string {
  return `site_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function openPlanDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB non disponible dans cet environnement"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PLANS)) {
        db.createObjectStore(STORE_PLANS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SITES)) {
        db.createObjectStore(STORE_SITES, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// 1. GESTION DES FONDS DE PLANS D'ÉTAGES (IndexedDB)
// ============================================================================

/**
 * Sauvegarde ou met à jour un fond de plan dans IndexedDB.
 * Génère automatiquement un ID unique si non spécifié pour garantir 0 écrasement.
 */
export async function saveBackgroundPlan(
  plan: Omit<StoredBackgroundPlan, "id" | "updatedAtIso"> & { id?: string | undefined }
): Promise<string> {
  try {
    const db = await openPlanDb();
    const tx = db.transaction(STORE_PLANS, "readwrite");
    const store = tx.objectStore(STORE_PLANS);

    const planId = plan.id && plan.id.trim() !== "" ? plan.id : generatePlanId();

    const record: StoredBackgroundPlan = {
      ...plan,
      id: planId,
      siteId: plan.siteId ?? DEFAULT_SITE_ID,
      updatedAtIso: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    db.close();
    return planId;
  } catch (err) {
    console.warn("NetFloor: Impossible de sauvegarder le fond de plan dans IndexedDB", err);
    return plan.id ?? generatePlanId();
  }
}

/**
 * Charge un fond de plan spécifique par son ID
 */
export async function loadBackgroundPlan(planId: string): Promise<StoredBackgroundPlan | null> {
  try {
    const db = await openPlanDb();
    const tx = db.transaction(STORE_PLANS, "readonly");
    const store = tx.objectStore(STORE_PLANS);

    const record = await new Promise<StoredBackgroundPlan | undefined>((resolve, reject) => {
      const req = store.get(planId);
      req.onsuccess = () => resolve(req.result as StoredBackgroundPlan | undefined);
      req.onerror = () => reject(req.error);
    });

    db.close();
    return record ?? null;
  } catch (err) {
    console.warn("NetFloor: Erreur lors de la lecture du fond de plan dans IndexedDB", err);
    return null;
  }
}

/**
 * Charge l'ensemble des fonds de plans enregistrés
 */
export async function loadAllBackgroundPlans(): Promise<StoredBackgroundPlan[]> {
  try {
    const db = await openPlanDb();
    const tx = db.transaction(STORE_PLANS, "readonly");
    const store = tx.objectStore(STORE_PLANS);

    const records = await new Promise<StoredBackgroundPlan[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as StoredBackgroundPlan[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    db.close();
    return records;
  } catch (err) {
    console.warn("NetFloor: Erreur lors de la lecture des fonds de plans dans IndexedDB", err);
    return [];
  }
}

/**
 * Supprime un fond de plan spécifique d'IndexedDB
 */
export async function deleteBackgroundPlan(planId?: string): Promise<void> {
  try {
    const db = await openPlanDb();
    const tx = db.transaction(STORE_PLANS, "readwrite");
    const store = tx.objectStore(STORE_PLANS);

    await new Promise<void>((resolve, reject) => {
      const req = planId ? store.delete(planId) : store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    db.close();
  } catch (err) {
    console.warn("NetFloor: Erreur lors de la suppression du fond de plan dans IndexedDB", err);
  }
}

/**
 * Supprime l'intégralité des fonds de plans enregistrés (IndexedDB)
 */
export async function clearAllBackgroundPlans(): Promise<void> {
  return deleteBackgroundPlan();
}

// ============================================================================
// 2. GESTION DES SITES GÉOGRAPHIQUES ET CAMPUS (IndexedDB + Fallback)
// ============================================================================

const LOCALSTORAGE_SITES_KEY = "netfloor_sites_v1";

/**
 * Charge l'ensemble des sites enregistrés (avec Site Principal par défaut)
 */
export async function loadAllSites(): Promise<FloorSite[]> {
  try {
    const db = await openPlanDb();
    const tx = db.transaction(STORE_SITES, "readonly");
    const store = tx.objectStore(STORE_SITES);

    const records = await new Promise<FloorSite[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as FloorSite[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    db.close();

    if (records.length > 0) {
      return records;
    }
  } catch {
    // Fallback localStorage si IndexedDB n'est pas encore prêt
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_SITES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
  }

  // Initialisation avec le site principal par défaut
  await saveSite(DEFAULT_SITE);
  return [DEFAULT_SITE];
}

/**
 * Enregistre ou met à jour un site
 */
export async function saveSite(site: FloorSite): Promise<void> {
  // 1. Sauvegarde IndexedDB
  try {
    const db = await openPlanDb();
    const tx = db.transaction(STORE_SITES, "readwrite");
    const store = tx.objectStore(STORE_SITES);

    await new Promise<void>((resolve, reject) => {
      const req = store.put(site);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    db.close();
  } catch {}

  // 2. Miroir localStorage pour synchronisation immédiate et tolérance aux pannes
  if (typeof window !== "undefined") {
    try {
      const all = await loadAllSites().catch(() => [DEFAULT_SITE]);
      const updated = all.some((s) => s.id === site.id)
        ? all.map((s) => (s.id === site.id ? site : s))
        : [...all, site];
      localStorage.setItem(LOCALSTORAGE_SITES_KEY, JSON.stringify(updated));
    } catch {}
  }
}

/**
 * Supprime un site
 */
export async function deleteSite(siteId: string): Promise<void> {
  try {
    const db = await openPlanDb();
    const tx = db.transaction(STORE_SITES, "readwrite");
    const store = tx.objectStore(STORE_SITES);

    await new Promise<void>((resolve, reject) => {
      const req = store.delete(siteId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    db.close();
  } catch {}

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_SITES_KEY);
      if (raw) {
        const parsed: FloorSite[] = JSON.parse(raw);
        const filtered = parsed.filter((s) => s.id !== siteId);
        localStorage.setItem(LOCALSTORAGE_SITES_KEY, JSON.stringify(filtered));
      }
    } catch {}
  }
}

/**
 * Supprime l'intégralité des sites enregistrés (pour remise à zéro complète)
 */
export async function clearAllSites(): Promise<void> {
  try {
    const db = await openPlanDb();
    const tx = db.transaction(STORE_SITES, "readwrite");
    const store = tx.objectStore(STORE_SITES);

    await new Promise<void>((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    db.close();
  } catch {}

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(LOCALSTORAGE_SITES_KEY);
    } catch {}
  }
}
