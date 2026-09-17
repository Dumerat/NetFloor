# 🛸 NETFLOOR ARCHITECT — DOSSIER DE TRANSMISSION TECHNIQUE POUR L'AGENT ANTIGRAVITY

> **Objectif de ce document** : Permettre à n'importe quelle instance d'Antigravity (ou développeur) sur une nouvelle machine de reprendre le projet instantanément avec 100% du contexte, des règles architecturales, de l'état d'avancement et des pièges à éviter.

---

## 1. 📋 Identité & Rôle du Projet

- **Nom du Projet** : `NetFloor Architect`
- **Type d'application** : Plateforme logicielle SIG/BIM 2D temps réel spécialisée dans la cartographie d'infrastructure réseau, le brassage informatique, l'inventaire matériel et la gestion des postes de travail.
- **Stack Technologique Clé** :
  - **Framework** : Next.js 16 (App Router, Server Components + Client Components).
  - **Moteur Graphique 2D** : React-Konva 19 / Konva 10 (moteur spatial 2D sur HTML5 Canvas, rendu matériel GPU).
  - **Gestion d'état** : Zustand 5 (`useCameraStore.ts` pour la caméra/viewport 2D et snapping).
  - **Base de données & ORM** : PostgreSQL, Drizzle ORM, PGLite pour les tests in-memory, requêtes CTE récursives pour le traçage physique des circuits.
  - **Styling & UI** : Tailwind CSS v4, Lucide React icons.
  - **Typage** : TypeScript 5 avec `exactOptionalPropertyTypes: true` et `strict: true`.

---

## 2. 🏗️ Architecture Technique & Organisation des Fichiers

```
NetFloor/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── trace/route.ts          # API de traçage CTE récursif (port -> câble -> patch -> switch)
│   │   ├── layout.tsx
│   │   └── page.tsx                    # Écran principal : Canvas + Barres latérales + Modales
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── FloorCanvas.tsx         # Stage Konva principal, gestion du pan/zoom GPU et des calques
│   │   │   ├── GridLayer.tsx           # Grille métrique dynamique (repères 500mm / 1m / 5m)
│   │   │   ├── ZoneLayer.tsx           # Délimitations visuelles des zones & services (RH, DSI, R&D...)
│   │   │   ├── CableLayer.tsx          # Câblage orthogonal 90°, faisceaux rubans, pivots ajustables
│   │   │   └── EquipmentLayer.tsx      # Mobilier (Solo/Bench/Meeting), Baies 19", Prises RJ45, Wi-Fi, Caméras
│   │   └── ui/
│   │       ├── CircuitInspector.tsx    # Panneau d'inspection latéral droit (Équipements, Prises, Baies, Zones)
│   │       ├── EquipmentPalette.tsx    # Barre latérale gauche extensible (Ajout, Topo, Inven, DSI)
│   │       ├── InventoryPanel.tsx      # Inventaire complet (Utilisateurs, Bureaux, Ports, Équipements, Baies)
│   │       ├── NetworkTopologyPanel.tsx # Arborescence hiérarchique réseau (Baies -> Switchs -> Ports -> Terminaux)
│   │       ├── FloorDimensionsModal.tsx# Modale de configuration métrique du plan (mètres/mm)
│   │       ├── SettingsModal.tsx       # Paramètres DSI (AD/LDAP, SNMP, IPAM)
│   │       ├── VlanStyleCustomizer.tsx # Nuancier & motifs de câbles par VLAN
│   │       └── CsvImportModal.tsx      # Ingestion CSV en masse
│   ├── engine/
│   │   └── spatial/
│   │       ├── matrix.ts               # Transformations matricielles WorldToScreen / ScreenToWorld
│   │       ├── snapping.ts             # Algorithmes de magnétisme (grille, accostage mobilier, connecteurs)
│   │       ├── useCameraStore.ts       # Store Zustand de la caméra (panX, panY, scale, zoom-to-pointer)
│   │       └── tests/spatial.test.ts   # Banc de tests mathématiques du moteur spatial
│   ├── data/
│   │   ├── directory.ts                # Annuaire d'entreprise (Utilisateurs, départements, rôles, téléphones)
│   │   ├── vlanStyles.ts               # Configuration visuelle des VLANs (20 Data, 30 VoIP, 40 Print, 50 Wi-Fi...)
│   │   └── settingsStore.ts            # Paramètres SNMP / Télémétrie
│   └── types/
│       └── zones.ts                    # Modèle de données FloorZone et zones de services par défaut
├── AGENTS.md                           # Règles d'agent imposées par Next.js dev
└── package.json
```

---

## 3. ⚠️ Règles Critiques & Pièges TypeScript / Windows

> [!IMPORTANT]
> **1. Règle `exactOptionalPropertyTypes: true` dans `tsconfig.json`**
> Si une propriété d'interface est optionnelle (ex: `department?: string;`), TypeScript **interdit formellement** de lui assigner explicitement `undefined` ou une variable pouvant être `undefined`.
> 👉 **Solution obligatoire** : Toujours typer `prop?: string | undefined;` ou utiliser la déstructuration conditionnelle : `...(val ? { prop: val } : {})`.

> [!WARNING]
> **2. Règle Next.js dans `AGENTS.md`**
> Le bloc situé dans `AGENTS.md` est généré automatiquement par `next dev`. Ne jamais supprimer ce fichier ni tenter d'en effacer le bloc, sous peine de créer un diff git perpétuel.

> [!CAUTION]
> **3. Commandes Shell sous Windows / PowerShell**
> L'OS utilisateur est **Windows** avec **PowerShell**. Les commandes multilignes avec des guillemets imbriqués, des caractères spéciaux (`&`, `m²`, `📐`, etc.) ou de longues chaînes échouent souvent avec des erreurs d'analyse syntaxique PowerShell (`AmpersandNotAllowed`, `UnexpectedToken`).
> 👉 **Règle** : Toujours utiliser `write_to_file` pour créer des scripts scratch Python (`.system_generated` ou `scratch/`) et les exécuter avec `python path/to/script.py` pour modifier des fichiers volumineux de manière sûre et sans corruption d'encodage UTF-8.

> [!TIP]
> **4. Performance Konva (60 FPS constants)**
> - Ne jamais utiliser `shadowBlur` ou `shadowColor` sur des éléments Konva à grande échelle (`ZoneLayer`, `GridLayer`) : Konva effectue un flou gaussien par convolution CPU/GPU très lourd qui fait chuter les FPS à moins de 15 FPS.
> - Toujours placer `listening={false}` sur les éléments purement graphiques (grille, cartouches non interactifs, textes décoratifs) pour éliminer l'overhead du canvas de hit-detection.

---

## 4. 🚀 Fonctionnalités Clés Implémentées & État Actuel

1. **Plan de Base & Caméra Spatiale** :
   - Dimensions personnalisables en mètres ou mm via `FloorDimensionsModal` et bouton `📐 Largeur × Longueur` dans le header.
   - Recadrage automatique `fitFloor()` sur n'importe quelle taille de bâtiment.
   - Grille métrique intelligente s'adaptant au zoom (1m, 2m, 5m).
   - Pan natif Konva à 60 FPS et Zoom centré sur le curseur (`zoom-to-pointer`).

2. **Délimitation Visuelle de Zones de Services (`ZoneLayer`)** :
   - Délimite les pôles d'activité (Pôle R&D, Local Technique DSI, Direction RH...).
   - **Protection anti-déplacement involontaire** : La zone n'intercepte aucun clic tant qu'on ne clique pas explicitement sur son cartouche d'en-tête. Elle n'est déplaçable que si elle est sélectionnée et non verrouillée (`isLocked`).
   - Clic dans le vide = désélection globale (`onDeselectAll`) pour reprendre le pan immédiatement.
   - Inspecteur dédié : modification des dimensions, couleur, code service, opacité et recensement automatique des équipements géométriquement contenus dans la zone.

3. **Câblage Physique Réseau Avancé (`CableLayer`)** :
   - Tracés orthogonaux stricts à 90° sans angles diagonaux ni coudes orphelins.
   - Poignée de pivot Konva déplaçable librement pour chaque câble ou faisceau.
   - **Regroupement en faisceau (ribbon bundle)** pour les blocs de prises multi-ports : les câbles partent ensemble parallèlement avec un écart régulier et se séparent automatiquement au pivot s'ils vont vers des baies différentes.
   - Traçage automatique récursif SQL CTE via `/api/trace`.
   - Couleurs et motifs pleins/pointillés éditables par VLAN via `VlanStyleCustomizer`.

4. **Mobilier & Prises Solidaires (`EquipmentLayer`)** :
   - Bureaux Solo, Bench Double (2 personnes) et Îlot Quad (4 personnes) avec sièges, écrans et occupants nommés.
   - Déplacement solidaire : lorsqu'un bureau bouge, toutes ses prises réseau et blocs de prises RJ45 rattachés se déplacent synchroniquement sans latence.
   - Détection bord-à-bord (magnétisme d'accostage entre bureaux).
   - Prises murales et boîtes de sol avec adresses IP, MAC, VLAN, statut ping et ports de switch assignés.

5. **Multi-Baies & Topologie de Démonstration** :
   - **3 Baies actives et interconnectées** :
     - `rack-01` (BAIE-PRINCIPALE-RDC, 42U) : Local technique cœur de réseau.
     - `rack-02` (BAIE-SECONDAIRE-EST, 18U) : Répartiteur intermédiaire aile Est.
     - `rack-03` (BAIE-OUEST-R&D, 24U) : Répartiteur Tech Lab & banc de test.
   - Chaque baie dispose de ses modules indépendants générés par `createDefaultRackDevices` (Switch Aruba CX, Panneau Cat6A, PDU).
   - Inspection du rack avec visualisation interactive des ports de switchs (SwitchPortVisualizer).

6. **Barre Latérale Gauche & Inventaire Complet (`EquipmentPalette` & `InventoryPanel`)** :
   - **Barre étroite (56px / `w-14`)** : Boutons d'accès direct `AJOUT`, `TOPO`, `INVEN`, `PARAMÈTRES DSI`.
   - **Catalogue d'ajout** : Mobilier, Prises, Baies, Wi-Fi, Caméras, Imprimantes avec glisser-déposer sur le canevas (rendu en icône réelle lors du drag).
   - **Panneau Topologie** : Arborescence DSI complète hiérarchique.
   - **Panneau Inventaire** avec 5 onglets dédiés :
     - **Utilisateurs** : Liste complète avec bureau assigné, poste, prises associées, IP du PC et IP du téléphone VoIP. Glisser-déposer possible d'un utilisateur sur un bureau du canevas pour l'assigner instantanément.
     - **Bureaux** : Liste des meubles avec badges de la zone de service parente.
     - **Ports** : Recensement de toutes les prises RJ45 et leurs états de brassage.
     - **Équipements** : Filtrage par sous-catégories (Imprimantes, Bornes Wi-Fi, Caméras IP...).
     - **Infrastructure** : Baies 19" et leurs commutateurs.

---

## 5. 🛠️ Commandes de Vérification Immédiate

À exécuter sur la nouvelle machine après `git clone` et `npm install` :

```bash
# 1. Vérification stricte TypeScript (doit retourner 0 erreur)
npx tsc --noEmit

# 2. Banc de tests mathématiques du moteur spatial 2D (8/8 tests au vert)
npm run test:spatial

# 3. Lancement du serveur de développement Next.js
npm run dev
```

---

## 6. 📌 Ce qu'il reste en tête de liste pour la suite

- Si l'utilisateur demande d'exporter le plan : possibilité d'ajouter un export SVG/PDF haute résolution du calque Konva.
- Si l'utilisateur souhaite importer un fichier DXF/DWG ou SVG de fond de plan architectural : le composant de calque d'arrière-plan peut accueillir un calque de fond vectoriel calé à l'échelle.
- Synchronisation en base de données de toutes les modifications faites à la volée sur le canevas (actuellement persistées dans le state React / stores).

---
*Document généré par Antigravity — Prêt pour une transition sans perte de contexte sur tout nouvel environnement.*
