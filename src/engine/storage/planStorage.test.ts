/**
 * Tests unitaires de la persistance des plans et sites.
 * fake-indexeddb reproduit l'API navigateur sans dépendre d'un navigateur réel.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllSites,
  DEFAULT_SITE,
  DEFAULT_SITE_ID,
  deleteBackgroundPlan,
  deleteSite,
  generatePlanId,
  generateSiteId,
  loadAllBackgroundPlans,
  loadAllSites,
  loadBackgroundPlan,
  saveBackgroundPlan,
  saveSite,
  type FloorSite,
} from "./planStorage";

const SITES_KEY = "netfloor_sites_v1";

const localStorageMock = (() => {
  let values: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => values[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete values[key];
    }),
    reset: () => {
      values = {};
    },
  };
})();

Object.defineProperty(globalThis, "window", { value: globalThis, writable: true });
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

const plan = {
  name: "RDC",
  imageData: "data:image/png;base64,AA==",
  opacity: 0.8,
  isLocked: false,
  xMm: 10,
  yMm: 20,
  scale: 5,
  visible: true,
};

const site: FloorSite = {
  id: "site-lyon",
  name: "Lyon",
  code: "LYO-01",
  createdAtIso: "2026-01-01T00:00:00.000Z",
  updatedAtIso: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  localStorageMock.reset();
  vi.clearAllMocks();
});

describe("valeurs et identifiants par défaut", () => {
  it("fournit un site principal générique", () => {
    expect(DEFAULT_SITE).toMatchObject({
      id: DEFAULT_SITE_ID,
      name: "Site Principal",
      code: "SITE-01",
      address: "",
      description: "",
      surfaceM2: 0,
    });
  });

  it("génère des identifiants de plan et de site distincts", () => {
    expect(generatePlanId()).toMatch(/^plan_\d+_[a-z0-9]+$/);
    expect(generateSiteId()).toMatch(/^site_\d+_[a-z0-9]+$/);
  });
});

describe("fonds de plan IndexedDB", () => {
  it("sauvegarde, charge et met à jour un plan", async () => {
    const generatedId = await saveBackgroundPlan(plan);
    const stored = await loadBackgroundPlan(generatedId);

    expect(stored).toMatchObject({ ...plan, id: generatedId, siteId: DEFAULT_SITE_ID });
    expect(stored?.updatedAtIso).toBeTruthy();

    await saveBackgroundPlan({
      ...plan,
      id: generatedId,
      name: "RDC mis à jour",
      siteId: "site-lyon",
    });
    await expect(loadBackgroundPlan(generatedId)).resolves.toMatchObject({
      name: "RDC mis à jour",
      siteId: "site-lyon",
    });
  });

  it("liste les plans et retourne null pour un identifiant inconnu", async () => {
    const firstId = await saveBackgroundPlan(plan);
    const secondId = await saveBackgroundPlan({ ...plan, id: "plan-etage-1", name: "Étage 1" });

    await expect(loadAllBackgroundPlans()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstId }),
        expect.objectContaining({ id: secondId }),
      ])
    );
    await expect(loadBackgroundPlan("inconnu")).resolves.toBeNull();
  });

  it("supprime un plan ou tous les plans", async () => {
    const firstId = await saveBackgroundPlan(plan);
    const secondId = await saveBackgroundPlan({ ...plan, id: "plan-etage-1" });

    await deleteBackgroundPlan(firstId);
    await expect(loadBackgroundPlan(firstId)).resolves.toBeNull();
    await expect(loadBackgroundPlan(secondId)).resolves.not.toBeNull();

    await deleteBackgroundPlan();
    await expect(loadAllBackgroundPlans()).resolves.toEqual([]);
  });
});

describe("sites IndexedDB et miroir localStorage", () => {
  it("initialise et persiste le site principal", async () => {
    await expect(loadAllSites()).resolves.toEqual([DEFAULT_SITE]);
    await expect(loadAllSites()).resolves.toEqual([DEFAULT_SITE]);
  });

  it("ajoute et met à jour un site dans IndexedDB et localStorage", async () => {
    await loadAllSites();
    await saveSite(site);

    await expect(loadAllSites()).resolves.toEqual(expect.arrayContaining([DEFAULT_SITE, site]));
    expect(JSON.parse(localStorageMock.getItem(SITES_KEY)!)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: site.id })])
    );

    const updatedSite = { ...site, name: "Lyon Part-Dieu" };
    await saveSite(updatedSite);
    await expect(loadAllSites()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining(updatedSite)])
    );
  });

  it("supprime un site de tous les stockages", async () => {
    await loadAllSites();
    await saveSite(site);
    await deleteSite(site.id);

    await expect(loadAllSites()).resolves.toEqual([DEFAULT_SITE]);
    expect(JSON.parse(localStorageMock.getItem(SITES_KEY)!)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: site.id })])
    );
  });

  it("efface tous les sites, y compris le site principal", async () => {
    await loadAllSites();
    await saveSite(site);
    await clearAllSites();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(SITES_KEY);
    await expect(loadAllSites()).resolves.toEqual([DEFAULT_SITE]);
  });

  it("utilise le miroir localStorage si IndexedDB est indisponible", async () => {
    globalThis.indexedDB = undefined as unknown as IDBFactory;
    localStorageMock.setItem(SITES_KEY, JSON.stringify([site]));

    await expect(loadAllSites()).resolves.toEqual([site]);
  });
});
