/**
 * Tests unitaires — src/data/directory.ts
 * Couvre : ENTERPRISE_DIRECTORY, DEMO_DIRECTORY, interface DirectoryUser
 */
import { describe, it, expect } from "vitest";
import { ENTERPRISE_DIRECTORY, DEMO_DIRECTORY } from "./directory";

describe("ENTERPRISE_DIRECTORY", () => {
  it("est vide par défaut", () => {
    expect(ENTERPRISE_DIRECTORY).toEqual([]);
  });
});

describe("DEMO_DIRECTORY", () => {
  it("contient 10 utilisateurs de démonstration", () => {
    expect(DEMO_DIRECTORY).toHaveLength(10);
  });

  it("chaque utilisateur a les champs obligatoires", () => {
    for (const user of DEMO_DIRECTORY) {
      expect(user.id).toBeTruthy();
      expect(user.fullName).toBeTruthy();
      expect(user.jobTitle).toBeTruthy();
      expect(user.department).toBeTruthy();
      expect(user.email).toMatch(/@company\.com$/);
    }
  });

  it("les IDs sont uniques", () => {
    const ids = DEMO_DIRECTORY.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("les emails sont uniques", () => {
    const emails = DEMO_DIRECTORY.map((u) => u.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("les avatarColor sont au format Tailwind bg-*", () => {
    for (const user of DEMO_DIRECTORY) {
      if (user.avatarColor) {
        expect(user.avatarColor).toMatch(/^bg-[a-z]+-\d+$/);
      }
    }
  });
});
