/**
 * Tests unitaires — src/data/directory.ts
 * Couvre : ENTERPRISE_DIRECTORY, DEMO_DIRECTORY, interface DirectoryUser,
 * persistance locale, ajout/suppression custom et synchronisation AD
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ENTERPRISE_DIRECTORY,
  DEMO_DIRECTORY,
  loadEnterpriseDirectory,
  saveEnterpriseDirectory,
  addCustomDirectoryUser,
  removeCustomDirectoryUser,
  syncAdUsersToDirectory,
  clearEnterpriseDirectory,
  clearSyncedAdUsersFromDirectory,
  unlinkAdAccountsFromNodes,
  DIRECTORY_STORAGE_KEY,
} from "./directory";

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

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

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

describe("Gestion de l'annuaire d'entreprise (Local & Custom & AD)", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(DIRECTORY_STORAGE_KEY);
    }
  });

  it("charge une liste vide si rien n'est stocké", () => {
    const users = loadEnterpriseDirectory();
    expect(users).toEqual([]);
  });

  it("sauvegarde et recharge des utilisateurs dans le stockage", () => {
    const sample = [
      {
        id: "usr-custom-1",
        fullName: "Jean Dupont",
        jobTitle: "Consultant Externe",
        department: "Prestation",
        email: "j.dupont@ext.com",
        source: "CUSTOM" as const,
      },
    ];
    saveEnterpriseDirectory(sample);
    expect(loadEnterpriseDirectory()).toEqual(sample);
  });

  it("ajoute un utilisateur personnalisé avec ID et couleur générés", () => {
    const added = addCustomDirectoryUser({
      fullName: "Marie Curie",
      jobTitle: "Chercheuse",
      department: "R&D",
      email: "m.curie@lab.com",
    });
    expect(added.id).toBeTruthy();
    expect(added.source).toBe("CUSTOM");
    expect(added.avatarColor).toMatch(/^bg-[a-z]+-\d+$/);

    const list = loadEnterpriseDirectory();
    expect(list).toHaveLength(1);
    expect(list[0]!.fullName).toBe("Marie Curie");
  });

  it("supprime un utilisateur personnalisé par ID", () => {
    const user1 = addCustomDirectoryUser({
      fullName: "User 1",
      jobTitle: "Dev",
      department: "IT",
      email: "u1@test.com",
    });
    const user2 = addCustomDirectoryUser({
      fullName: "User 2",
      jobTitle: "RH",
      department: "RH",
      email: "u2@test.com",
    });
    expect(loadEnterpriseDirectory()).toHaveLength(2);

    removeCustomDirectoryUser(user1.id);
    const after = loadEnterpriseDirectory();
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(user2.id);
  });

  it("synchronise les utilisateurs Active Directory tout en préservant les utilisateurs Custom", () => {
    addCustomDirectoryUser({
      fullName: "Prestataire Externe",
      jobTitle: "Auditeur",
      department: "Audit",
      email: "auditeur@externe.fr",
    });

    const adUsers = [
      {
        id: "ad-001",
        sAMAccountName: "thomas.bernard",
        fullName: "Thomas Bernard",
        jobTitle: "Ingénieur Réseau",
        department: "DSI",
        email: "t.bernard@corp.local",
        office: "Bureau 302",
        netFloorRole: "DSI",
      },
      {
        id: "ad-002",
        sAMAccountName: "sophie.martin",
        fullName: "Sophie Martin",
        jobTitle: "Gestionnaire Paie",
        department: "RH",
        email: "s.martin@corp.local",
        office: "Bureau 101",
        netFloorRole: "RH",
      },
    ];

    const merged = syncAdUsersToDirectory(adUsers);
    expect(merged).toHaveLength(3); // 1 custom + 2 AD
    expect(merged.some((u) => u.source === "CUSTOM" && u.fullName === "Prestataire Externe")).toBe(
      true
    );
    expect(merged.some((u) => u.source === "AD" && u.fullName === "Thomas Bernard")).toBe(true);
    expect(merged.some((u) => u.source === "AD" && u.fullName === "Sophie Martin")).toBe(true);
  });

  it("clearSyncedAdUsersFromDirectory supprime les comptes AD et garde les custom", () => {
    addCustomDirectoryUser({
      fullName: "Prestataire Externe",
      jobTitle: "Auditeur",
      department: "Audit",
      email: "auditeur@externe.fr",
    });
    syncAdUsersToDirectory([{ id: "ad-001", fullName: "Thomas Bernard", source: "AD" }]);
    expect(loadEnterpriseDirectory()).toHaveLength(2);

    const filtered = clearSyncedAdUsersFromDirectory();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.fullName).toBe("Prestataire Externe");
  });

  it("clearEnterpriseDirectory vide tout le répertoire", () => {
    addCustomDirectoryUser({
      fullName: "User 1",
      jobTitle: "Job",
      department: "Dep",
      email: "u1@test.com",
    });
    expect(loadEnterpriseDirectory()).toHaveLength(1);
    clearEnterpriseDirectory();
    expect(loadEnterpriseDirectory()).toHaveLength(0);
  });
});

describe("unlinkAdAccountsFromNodes", () => {
  it("délie les comptes AD spécifiés des bureaux, sièges et ports", () => {
    const mockNodes = [
      {
        id: "desk-1",
        assignedPerson: "Thomas Bernard",
        assignedUserId: "ad-001",
        department: "DSI",
        seats: [
          { seatIndex: 0, fullName: "Thomas Bernard", userId: "ad-001", department: "DSI" },
          {
            seatIndex: 1,
            fullName: "Prestataire Externe",
            userId: "custom-1",
            department: "Audit",
          },
        ],
        stackedPorts: [
          { portIndex: 0, assignedPerson: "Thomas Bernard", assignedUserId: "ad-001" },
        ],
      },
      {
        id: "desk-2",
        assignedPerson: "Prestataire Externe",
        assignedUserId: "custom-1",
        department: "Audit",
      },
    ];

    const targetIds = new Set(["ad-001"]);
    const targetNames = new Set(["thomas bernard"]);

    const unlinked = unlinkAdAccountsFromNodes(mockNodes, targetIds, targetNames);

    // desk-1 doit être délié
    expect(unlinked[0]?.assignedPerson).toBeUndefined();
    expect(unlinked[0]?.assignedUserId).toBeUndefined();
    expect(unlinked[0]?.seats?.[0]?.fullName).toBeUndefined();
    expect(unlinked[0]?.seats?.[1]?.fullName).toBe("Prestataire Externe");
    expect(unlinked[0]?.stackedPorts?.[0]?.assignedPerson).toBeUndefined();

    // desk-2 doit être préservé
    expect(unlinked[1]?.assignedPerson).toBe("Prestataire Externe");
  });
});
