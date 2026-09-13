export interface FloorZone {
  id: string;
  name: string;
  serviceCode?: string | undefined;
  department?: string | undefined;
  color: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  opacity?: number | undefined;
  isLocked?: boolean | undefined;
  description?: string | undefined;
  siteId?: string | undefined;
}

export const DEFAULT_ZONES: FloorZone[] = [
  {
    id: "zone-tech-lab",
    name: "Pôle Tech Lab & R&D",
    serviceCode: "TECH",
    department: "Tech Lab",
    color: "#0284c7",
    xMm: 21000,
    yMm: 10000,
    widthMm: 20000,
    heightMm: 14000,
    opacity: 0.12,
    description: "Espace ouvert dédié aux équipes ingénierie logicielle, R&D et bancs essais.",
    siteId: "site-principal",
  },
  {
    id: "zone-dsi-noc",
    name: "Local Technique & Baie DSI",
    serviceCode: "DSI",
    department: "Infrastructure IT",
    color: "#7c3aed",
    xMm: 8000,
    yMm: 10000,
    widthMm: 10000,
    heightMm: 12000,
    opacity: 0.16,
    description:
      "Local sécurisé climatisé abritant les répartiteurs étage, commutateurs cœur et arrivée fibre.",
    siteId: "site-principal",
  },
  {
    id: "zone-rh-direction",
    name: "Direction & Ressources Humaines",
    serviceCode: "RH",
    department: "Ressources Humaines",
    color: "#059669",
    xMm: 43000,
    yMm: 10000,
    widthMm: 14000,
    heightMm: 14000,
    opacity: 0.12,
    description: "Bureaux de direction et pôle de gestion des ressources humaines.",
    siteId: "site-principal",
  },
];
