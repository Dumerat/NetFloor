export interface DirectoryUser {
  id: string;
  fullName: string;
  jobTitle: string;
  department: string;
  email: string;
  phone?: string;
  avatarColor?: string;
}

export const ENTERPRISE_DIRECTORY: DirectoryUser[] = [];

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
