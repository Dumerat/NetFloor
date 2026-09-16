# 🏢 NetFloor Architect

> **Plateforme de Modélisation Spatiale & Gestion d'Infrastructure de Câblage Réseau Haute Densité**  
> *Canvas interactif 2D/3D temps réel (60 FPS), calculs métriques au millimètre, routage automatique orthogonal et traçage physique/logique de bout en bout via PostgreSQL 16 (CTE récursive).*

---

![Next.js 16](https://img.shields.io/badge/Next.js-16.3.4-black?style=flat-square&logo=next.js)
![React 19](https://img.shields.io/badge/React-19.2.8-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9_Strict-blue?style=flat-square&logo=typescript)
![Konva Canvas](https://img.shields.io/badge/Canvas-Konva_60FPS-0D9488?style=flat-square)
![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16_CTE-336791?style=flat-square&logo=postgresql)
![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle_0.45-C5F74F?style=flat-square)
![Vitest](https://img.shields.io/badge/Tests-66_Passés-729B1B?style=flat-square&logo=vitest)

---

## 🌟 Fonctionnalités Clés

- **Canvas Haute Performance (60 FPS Constant)** : Moteur Konva découplé avec gestion fine des layers (Grille, Zones, Câbles, Équipements). Aucun lag lors du pan/zoom grâce au binding GPU natif et Zustand.
- **Moteur Spatial Métrique au Millimètre** : Snapping métrique (500mm), alignement dynamique (Smart Guides), attraction magnétique sur connecteurs, et invariance absolue du zoom au curseur.
- **Routage Automatique & Rubanage Orthogonal** : Détection des cheminements optimaux à 90° vers les baies de brassage, gestion du rubanage multi-câbles (6mm d'écart par conducteur) et anti-collision stricte sur les ports de switch.
- **Arborescence Complète d'Équipements** :
  - **Baies & Racks** : 42U, 24U, 18U avec châssis, bandeaux passe-câbles, PDU, patch panels Cat6A et commutateurs Aruba/Cisco.
  - **Bureaux & Mobilier** : Bureaux individuels, benchs doubles/quadruples, tables de réunion visio, colonnettes, boîtes de sol.
  - **Périphériques Réseau** : Prises RJ45 simples et empilées, téléphones IP avec assignation VLAN/VoIP, traceurs, imprimantes réseau, caméras IP, bornes Wi-Fi AP.
  - **Zones de Service** : Délimitation visuelle et verrouillable par couleur (Lab R&D, DSI NOC, Direction, etc.) avec cartouches d'identification.
- **Annuaire d'Entreprise Intégré** : Gestion des collaborateurs, postes assignés, affectation d'IP statique/DHCP et liaisons téléphoniques directes.
- **Traçage Relationnel Récursif (CTE)** : Résolution instantanée du cheminement complet depuis une prise utilisateur jusqu'au port de switch et VLAN associé (`Hop 0: Prise` ➜ `Hop 1: Câble horizontal` ➜ `Hop 2: Patch Panel` ➜ `Hop 3: Cordon de brassage` ➜ `Hop 4: Switch`).
- **Ingestion & Audit de Masse** : Analyse d'intégrité et importation transactionnelle de carnets de câblage d'entreprise (>800 liaisons traitées en <100ms avec détection d'anomalies et doublons).
- **Architecture Hybride Déconnectable** : Fonctionnement complet avec PostgreSQL 16 sous Docker ou en mode autonome embarqué via PGlite (WASM) et IndexedDB local.

---

## 📋 Prérequis

Avant de lancer le projet, assurez-vous d'avoir installé sur votre machine :

| Outil | Version Minimale | Remarque |
|---|---|---|
| **Node.js** | `>= 20.x` *(recommandé 22+)* | Exécution Next.js et scripts TypeScript |
| **pnpm** | `>= 9.x` *(recommandé 9.15.5)* | Gestionnaire de paquets ultra-rapide |
| **Git** | Dernière version | Versioning du code (fournit aussi Git Bash sous Windows) |
| **Docker & Docker Compose** | Optionnel | Requis pour lancer PostgreSQL localement sous Docker |

> 💡 **Installation de pnpm** si non présent :
> ```bash
> corepack enable pnpm
> # ou
> npm install -g pnpm@9
> ```

---

## 🚀 Démarrage Rapide

### 1. Cloner le dépôt

```bash
git clone https://github.com/Dumerat/NetFloor.git
cd NetFloor
```

### 2. Installer les dépendances

```bash
pnpm install
```

### 3. Configurer l'environnement

Un fichier `.env` est déjà fourni par défaut. Vous pouvez le dupliquer depuis `.env.example` si nécessaire :

```bash
cp .env.example .env
```

Contenu par défaut de `.env` :
```env
DATABASE_URL=postgres://postgres:postgrespassword@localhost:5432/netfloor
NODE_ENV=development
```

---

## 🎛️ Lancement Entier via le Script Unique

NetFloor Architect dispose d'un **script unifié d'orchestration** qui prend en charge l'intégralité du cycle de vie du projet :
- Démarrage automatique de PostgreSQL sous Docker (si disponible).
- Attente active de disponibilité de la base (`pg_isready`).
- Application automatique de la migration DDL (`drizzle/0000_conscious_naoko.sql`) si la base est vierge.
- Injection optionnelle du jeu de données de référence (`--seed`).
- Repli transparent en mode autonome si Docker n'est pas actif.
- Lancement du serveur Next.js avec ouverture facultative du navigateur (`--open`).

### Exécution du script selon votre système d'exploitation :

#### 🐧 Linux / macOS / Git Bash :
```bash
./run.sh dev
# ou simplement :
./run.sh
```

#### 🪟 Windows (PowerShell) :
```powershell
.un.ps1 dev
# ou simplement :
.un.ps1
```

#### ⚡ Via Makefile (Linux/macOS) :
```bash
make dev
```

---

## 📖 Commandes Disponibles via le Script

Le script unique (`run.sh` / `run.ps1`) expose l'ensemble des commandes d'administration :

| Commande | Exemple Linux / Mac | Exemple Windows PowerShell | Description |
|---|---|---|---|
| **dev** | `./run.sh dev` | `.un.ps1 dev` | Lance PostgreSQL (Docker) + migrations + Next.js en développement |
| **dev avec seed** | `./run.sh dev --seed` | `.un.ps1 dev -Seed` | Lance le projet avec injection du carnet de câblage d'exemple |
| **dev sur autre port** | `./run.sh dev -p 8080 -o` | `.un.ps1 dev -p 8080 -o` | Lance sur le port 8080 et ouvre automatiquement le navigateur |
| **start** | `./run.sh start` | `.un.ps1 start` | Démarre l'application compilée de production hors Docker |
| **build** | `./run.sh build` | `.un.ps1 build` | Validation stricte des types TypeScript + compilation Next.js |
| **type-check** | `./run.sh type-check` | `.un.ps1 type-check` | Exécute `tsc --noEmit` sans erreur |
| **lint** | `./run.sh lint` | `.un.ps1 lint` | Analyse statique du code source avec ESLint |
| **format** | `./run.sh format` | `.un.ps1 format` | Applique le formatage automatique Prettier |
| **test:spatial** | `./run.sh test --test-type spatial` | `.un.ps1 test -TestType spatial` | Exécute les 16 bancs d'essais géométriques 2D |
| **test:ingestion**| `./run.sh test --test-type ingestion`| `.un.ps1 test -TestType ingestion`| Teste l'audit et l'import de 800+ liaisons |
| **test:pglite** | `./run.sh test --test-type pglite` | `.un.ps1 test -TestType pglite` | Valide la CTE récursive sur PostgreSQL WASM |
| **test (tous)** | `./run.sh test` | `.un.ps1 test` | Exécute tous les bancs d'essais et la suite Vitest |
| **ci** | `./run.sh ci` | `.un.ps1 ci` | Simule en local le pipeline CI complet (format, lint, tsc, tests, audit) |
| **db seed** | `./run.sh db --db-action seed` | `.un.ps1 db -DbAction seed` | Injecte la topologie d'entreprise de référence |
| **db reset** | `./run.sh db --db-action reset` | `.un.ps1 db -DbAction reset` | Réinitialise et recrée le schéma PostgreSQL |
| **db migrate** | `./run.sh db --db-action migrate` | `.un.ps1 db -DbAction migrate` | Applique les migrations Drizzle |
| **docker up** | `./run.sh docker up` | `.un.ps1 docker` | Démarre le conteneur PostgreSQL seul |
| **prod** | `./run.sh prod up --build` | `.un.ps1 prod` | Déploie la stack complète de production (Caddy, App, Postgres, MinIO) |
| **clean** | `./run.sh clean` | `.un.ps1 clean` | Supprime `.next`, `dist`, `coverage` et artéfacts de compilation |

---

## 🧪 Bancs d'Essais & Validation Qualité

Le projet intègre une suite complète de tests unitaires, spatiaux et relationnels :

```bash
# Lancement de l'intégralité des 66 tests :
pnpm test

# Ou via le script unifié :
./run.sh test --test-type all
```

### Détail des bancs d'essais :
1. **Moteur Spatial 2D (`test:spatial`)** :
   - Inversibilité absolue écran ⟷ monde (`ScreenToWorld` / `WorldToScreen`).
   - Invariance stricte du curseur lors du zoom molette.
   - Cadrage automatique de l'étage (`fitToBounds`).
   - Snapping métrique (500mm), Smart Guides et docking magnétique de connecteurs.
   - Câblage orthogonal 90° avec espacement ruban.
   - Anti-collision stricte 1:1 sur les ports de commutateur.
   - Dézoom macro 0.0002 certifié jusqu'à 5 km de campus multi-bâtiments.
2. **Ingestion & Intégrité (`test:ingestion`)** :
   - Détection de 5 types d'anomalies (doublons de ports, conflits de VLAN, dépassement de VID).
   - Génération et validation d'un carnet de 800 liaisons d'entreprise en <75 ms.
   - Insertion transactionnelle atomique dans PostgreSQL.
3. **Moteur SQL / CTE Récursive (`test:pglite`)** :
   - Exécution de la CTE récursive de traçage bout en bout sur moteur PostgreSQL 16 WASM.
   - Validation exacte du nombre de sauts, des longueurs physiques et du VLAN résolu.

---

## 🏗️ Architecture du Projet

```text
NetFloor/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Page principale & orchestrateur d'état de l'application
│   │   ├── layout.tsx            # Layout racine & polices
│   │   └── api/                  # Endpoints REST (traçage, topologie, ingestion, SNMP)
│   ├── components/
│   │   ├── canvas/               # Rendu Canvas interactif (React-Konva)
│   │   │   ├── FloorCanvas.tsx   # Conteneur Stage & gestionnaire de caméra
│   │   │   ├── EquipmentLayer.tsx# Baies, bureaux, prises RJ45, téléphones, imprimantes
│   │   │   ├── CableLayer.tsx    # Câblage orthogonal, faisceaux & poignées de pivot
│   │   │   ├── ZoneLayer.tsx     # Zones délimitées & cartouches de service
│   │   │   └── GridLayer.tsx     # Grille métrique vectorielle 60 FPS
│   │   └── ui/                   # Panneaux de contrôle & inspecteurs
│   │       ├── EquipmentPalette.tsx # Palette de composants glisser-déposer
│   │       ├── CircuitInspector.tsx # Fiche technique de l'équipement ou de la zone
│   │       ├── InventoryPanel.tsx   # Inventaire des ports, utilisateurs et relais
│   │       └── PlanDimensionsModal.tsx # Réglage métrique du plan et des zones
│   ├── db/                       # Base de données PostgreSQL & Drizzle ORM
│   │   ├── schema.ts             # Schéma relationnel (floors, racks, nodes, ports, cables...)
│   │   ├── seed.ts               # Données de référence entreprise
│   │   └── index.ts              # Client DB avec fallback automatique PGlite
│   ├── engine/
│   │   ├── spatial/              # Moteur géométrique 2D & snapping métrique
│   │   ├── ingestion/            # Moteur d'import et audit matriciel CSV
│   │   └── storage/              # Persistance locale (IndexedDB / store Zustand)
│   ├── types/                    # Déclarations TypeScript strictes
│   └── data/                     # Annuaire collaborateurs, VLANs et équipements initiaux
├── drizzle/                      # Migrations SQL versionnées (DDL)
├── docker/                       # Configurations Caddy, MinIO et conteneurs
├── run.sh                        # Script d'exécution unifié (Linux / macOS / Git Bash)
├── run.ps1                       # Script d'exécution unifié (Windows PowerShell)
├── Makefile                      # Raccourcis de commandes pour développeurs
├── docker-compose.yml            # Stack de développement (PostgreSQL 16)
├── docker-compose.prod.yml       # Stack de production complète
├── ANTIGRAVITY_HANDOVER.md       # Dossier technique complet pour passation machine / IA
└── package.json                  # Dépendances et scripts pnpm
```

---

## 🔒 Règles de Contribution & Bonnes Pratiques

- **TypeScript Strict** : `exactOptionalPropertyTypes` est activé. Ne jamais assigner explicitement `undefined` à une propriété optionnelle (utiliser la déstructuration conditionnelle).
- **Règle Konva 60 FPS** : Ne jamais ajouter de `shadowBlur` ou d'effets de flou lourd sur les éléments du Canvas grand format (`ZoneLayer`, `GridLayer`). Privilégier `shadowForStrokeEnabled={false}` et `listening={false}` sur les éléments non interactifs.
- **Tests Obligatoires** : Tout nouvel équipement ou comportement géométrique doit être couvert par les bancs d'essais `pnpm test`.
- **Validation CI Locale** : Avant tout push ou commit important, exécutez `./run.sh ci` (ou `.un.ps1 ci`).

---

## 📄 Licence

Ce projet est la propriété de l'équipe NetFloor Architect. Tous droits réservés.
