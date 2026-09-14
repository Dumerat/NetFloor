/**
 * Tests unitaires — src/engine/storage/planStorage.ts
 * Couvre : generatePlanId, generateSiteId, DEFAULT_SITE, DEFAULT_SITE_ID
 * Note : les fonctions IndexedDB (openPlanDb, save/load/delete) nécessitent
 *        un environnement browser et sont couvertes via les tests d'intégration.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_SITE, DEFAULT_SITE_ID, generatePlanId, generateSiteId } from "./planStorage";

// ── DEFAULT_SITE ─────────────────────────────────────────────────────────────
describe("DEFAULT_SITE", () => {
  it("a l'ID site-principal", () => {
    expect(DEFAULT_SITE.id).toBe("site-principal");
    expect(DEFAULT_SITE.id).toBe(DEFAULT_SITE_ID);
  });

  it("a un nom et un code génériques (pas de données réelles)", () => {
    expect(DEFAULT_SITE.name).toBe("Site Principal");
    expect(DEFAULT_SITE.code).toBe("SITE-01");
  });

  it("n'a pas d'adresse ou description pré-remplie", () => {
    expect(DEFAULT_SITE.address).toBe("");
    expect(DEFAULT_SITE.description).toBe("");
    expect(DEFAULT_SITE.surfaceM2).toBe(0);
  });

  it("a une couleur bleue par défaut", () => {
    expect(DEFAULT_SITE.color).toBe("#3b82f6");
  });

  it("a des timestamps ISO valides", () => {
    expect(() => new Date(DEFAULT_SITE.createdAtIso)).not.toThrow();
    expect(() => new Date(DEFAULT_SITE.updatedAtIso)).not.toThrow();
  });
});

// ── generatePlanId ────────────────────────────────────────────────────────────
describe("generatePlanId", () => {
  it("génère un ID qui commence par 'plan_'", () => {
    const id = generatePlanId();
    expect(id).toMatch(/^plan_\d+_[a-z0-9]+$/);
  });

  it("génère des IDs uniques à chaque appel", () => {
    const ids = Array.from({ length: 100 }, () => generatePlanId());
    expect(new Set(ids).size).toBe(100);
  });

  it("contient un timestamp numérique", () => {
    const before = Date.now();
    const id = generatePlanId();
    const after = Date.now();
    const ts = parseInt(id.split("_")[1]!);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ── generateSiteId ────────────────────────────────────────────────────────────
describe("generateSiteId", () => {
  it("génère un ID qui commence par 'site_'", () => {
    const id = generateSiteId();
    expect(id).toMatch(/^site_\d+_[a-z0-9]+$/);
  });

  it("génère des IDs uniques à chaque appel", () => {
    const ids = Array.from({ length: 100 }, () => generateSiteId());
    expect(new Set(ids).size).toBe(100);
  });

  it("contient un timestamp numérique", () => {
    const before = Date.now();
    const id = generateSiteId();
    const after = Date.now();
    const ts = parseInt(id.split("_")[1]!);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ── DEFAULT_SITE_ID ───────────────────────────────────────────────────────────
describe("DEFAULT_SITE_ID", () => {
  it("est 'site-principal'", () => {
    expect(DEFAULT_SITE_ID).toBe("site-principal");
  });
});
