export interface DirectoryUser {
  id: string;
  fullName: string;
  jobTitle: string;
  department: string;
  email: string;
  phone?: string;
  office?: string;
  sAMAccountName?: string;
  netFloorRole?: "DSI" | "RH" | "Collaborateur" | "Maintenance" | string;
  avatarColor?: string;
  source?: "AD" | "CUSTOM" | "SAML" | "MANUAL";
  createdAtIso?: string;
}

export const ENTERPRISE_DIRECTORY: DirectoryUser[] = [];

export const DIRECTORY_STORAGE_KEY = "netfloor_enterprise_directory";

export function getAvatarColor(seed: string): string {
  const colors = [
    "bg-blue-600",
    "bg-purple-600",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-cyan-600",
    "bg-rose-600",
    "bg-indigo-600",
    "bg-teal-600",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
}

export function loadEnterpriseDirectory(): DirectoryUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEnterpriseDirectory(users: DirectoryUser[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DIRECTORY_STORAGE_KEY, JSON.stringify(users));
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("netfloor_directory_updated", { detail: users }));
    }
  } catch (err) {
    console.warn("Failed to save enterprise directory to localStorage", err);
  }
}

export function addCustomDirectoryUser(
  user: Omit<DirectoryUser, "id"> & { id?: string }
): DirectoryUser {
  const current = loadEnterpriseDirectory();
  const id = user.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newUser: DirectoryUser = {
    ...user,
    id,
    source: "CUSTOM",
    avatarColor: user.avatarColor || getAvatarColor(user.department || user.fullName),
    createdAtIso: new Date().toISOString(),
  };
  const updated = [newUser, ...current.filter((u) => u.id !== id)];
  saveEnterpriseDirectory(updated);
  return newUser;
}

export function removeCustomDirectoryUser(userId: string): void {
  const current = loadEnterpriseDirectory();
  const updated = current.filter((u) => u.id !== userId);
  saveEnterpriseDirectory(updated);
}

export function syncAdUsersToDirectory(adUsers: any[]): DirectoryUser[] {
  const current = loadEnterpriseDirectory();
  // Conserver les utilisateurs ajoutés manuellement hors-domaine
  const customUsers = current.filter((u) => u.source === "CUSTOM");

  // Transformer les utilisateurs AD
  const newAdUsers: DirectoryUser[] = adUsers.map((u, idx) => ({
    id: u.id || u.sAMAccountName || `ad-${idx + 1}`,
    fullName: u.fullName || u.sAMAccountName || "Utilisateur AD",
    jobTitle: u.jobTitle || "Collaborateur",
    department: u.department || "Non renseigné",
    email: u.email || "",
    phone: u.phone || "",
    office: u.office || "-",
    sAMAccountName: u.sAMAccountName || u.id,
    netFloorRole: u.netFloorRole || "Collaborateur",
    avatarColor: getAvatarColor(u.department || u.fullName),
    source: "AD",
    createdAtIso: new Date().toISOString(),
  }));

  // Combiner les utilisateurs Custom et les utilisateurs AD
  const merged = [...customUsers, ...newAdUsers];
  saveEnterpriseDirectory(merged);
  return merged;
}

/**
 * Supprime l'intégralité de l'annuaire d'entreprise dans le localStorage
 */
export function clearEnterpriseDirectory(): void {
  ENTERPRISE_DIRECTORY.length = 0;
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DIRECTORY_STORAGE_KEY);
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("netfloor_directory_updated", { detail: [] }));
    }
  } catch (err) {
    console.warn("Failed to clear enterprise directory from localStorage", err);
  }
}

/**
 * Supprime uniquement les comptes synchronisés depuis Active Directory (source === 'AD')
 * tout en conservant les utilisateurs manuels / hors domaine (source === 'CUSTOM')
 */
export function clearSyncedAdUsersFromDirectory(): DirectoryUser[] {
  const current = loadEnterpriseDirectory();
  const filtered = current.filter((u) => u.source !== "AD");
  saveEnterpriseDirectory(filtered);
  return filtered;
}

/**
 * Délie tous les comptes Active Directory associés aux bureaux, sièges et ports RJ45
 */
export function unlinkAdAccountsFromNodes<
  T extends {
    assignedPerson?: string | undefined;
    assignedUserId?: string | undefined;
    department?: string | undefined;
    seats?: any[] | undefined;
    stackedPorts?: any[] | undefined;
  },
>(nodes: T[], targetUserIds?: Set<string>, targetUserNames?: Set<string>): T[] {
  return nodes.map((node) => {
    let changed = false;
    let newAssignedPerson = node.assignedPerson;
    let newAssignedUserId = node.assignedUserId;
    let newDepartment = node.department;

    const isMatch = (userId?: string, name?: string) => {
      if (!targetUserIds && !targetUserNames) {
        return Boolean(userId || (name && name !== "Poste vacant / Flex"));
      }
      if (userId && targetUserIds?.has(userId)) return true;
      if (name) {
        const cleanName = name
          .replace(/\s*\(.*\)/, "")
          .toLowerCase()
          .trim();
        if (targetUserNames?.has(cleanName)) return true;
        if (targetUserIds?.has(cleanName)) return true;
      }
      return false;
    };

    if (isMatch(node.assignedUserId, node.assignedPerson)) {
      newAssignedPerson = undefined;
      newAssignedUserId = undefined;
      newDepartment = undefined;
      changed = true;
    }

    let newSeats = node.seats;
    if (node.seats && node.seats.length > 0) {
      newSeats = node.seats.map((seat: any) => {
        if (isMatch(seat.userId, seat.fullName)) {
          changed = true;
          return {
            ...seat,
            userId: undefined,
            fullName: undefined,
            department: undefined,
          };
        }
        return seat;
      });
    }

    let newStackedPorts = node.stackedPorts;
    if (node.stackedPorts && node.stackedPorts.length > 0) {
      newStackedPorts = node.stackedPorts.map((port: any) => {
        if (isMatch(port.assignedUserId, port.assignedPerson)) {
          changed = true;
          return {
            ...port,
            assignedUserId: undefined,
            assignedPerson: undefined,
          };
        }
        return port;
      });
    }

    if (!changed) return node;

    return {
      ...node,
      assignedPerson: newAssignedPerson,
      assignedUserId: newAssignedUserId,
      department: newDepartment,
      seats: newSeats,
      stackedPorts: newStackedPorts,
    };
  });
}

export const DEMO_DIRECTORY: DirectoryUser[] = [
  {
    id: "usr-001",
    fullName: "Alexandre Martin",
    jobTitle: "Tech Lead Fullstack",
    department: "Tech Lab",
    email: "alexandre.martin@company.com",
    phone: "+33 1 42 68 01 01",
    avatarColor: "bg-blue-600",
  },
  {
    id: "usr-002",
    fullName: "Sarah Benali",
    jobTitle: "Responsable Recrutement & RH",
    department: "Ressources Humaines",
    email: "sarah.benali@company.com",
    phone: "+33 1 42 68 01 02",
    avatarColor: "bg-purple-600",
  },
  {
    id: "usr-003",
    fullName: "Thomas Dubois",
    jobTitle: "Administrateur Réseaux & Sécurité",
    department: "DSI / Infrastructure",
    email: "thomas.dubois@company.com",
    phone: "+33 1 42 68 01 03",
    avatarColor: "bg-amber-600",
  },
  {
    id: "usr-004",
    fullName: "Julie Moreau",
    jobTitle: "Office Manager & Logistique",
    department: "Moyens Généraux / RH",
    email: "julie.moreau@company.com",
    phone: "+33 1 42 68 01 04",
    avatarColor: "bg-emerald-600",
  },
  {
    id: "usr-005",
    fullName: "Emma Petit",
    jobTitle: "Ingénieure Frontend UI/UX",
    department: "Tech Lab",
    email: "emma.petit@company.com",
    phone: "+33 1 42 68 01 05",
    avatarColor: "bg-cyan-600",
  },
  {
    id: "usr-006",
    fullName: "Marc Lefebvre",
    jobTitle: "Directeur Financier",
    department: "Direction Financière",
    email: "marc.lefebvre@company.com",
    phone: "+33 1 42 68 01 06",
    avatarColor: "bg-indigo-600",
  },
  {
    id: "usr-007",
    fullName: "Antoine Roux",
    jobTitle: "Technicien Support & Câblage",
    department: "Maintenance & IT",
    email: "antoine.roux@company.com",
    phone: "+33 1 42 68 01 07",
    avatarColor: "bg-rose-600",
  },
  {
    id: "usr-008",
    fullName: "Léa Bernard",
    jobTitle: "Juriste d'Entreprise & DPO",
    department: "Direction Juridique",
    email: "lea.bernard@company.com",
    phone: "+33 1 42 68 01 08",
    avatarColor: "bg-teal-600",
  },
  {
    id: "usr-009",
    fullName: "Maxime Girard",
    jobTitle: "DevOps & Cloud Architect",
    department: "Tech Lab",
    email: "maxime.girard@company.com",
    phone: "+33 1 42 68 01 09",
    avatarColor: "bg-blue-700",
  },
  {
    id: "usr-010",
    fullName: "Chloé Rousseau",
    jobTitle: "Chargée de Communication",
    department: "Ressources Humaines",
    email: "chloe.rousseau@company.com",
    phone: "+33 1 42 68 01 10",
    avatarColor: "bg-pink-600",
  },
];
