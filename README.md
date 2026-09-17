# 🏢 NetFloor Architect

> **Plateforme de Modélisation Spatiale & Gestion d'Infrastructure de Câblage Réseau Haute Densité**  
> *Canvas interactif 2D/3D temps réel (60 FPS), calculs métriques au millimètre, routage automatique orthogonal et traçage physique/logique de bout en bout via PostgreSQL 16 (CTE récursive).*

---

![Next.js 16](https://img.shields.io/badge/Next.js-16.3.4-black?style=flat-square&logo=next.js)
![React 19](https://img.shields.io/badge/React-19.2.8-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9_Strict-blue?style=flat-square&logo=typescript)
![Docker](https://img.shields.io/badge/Docker-100%25_Conteneuris%C3%A9-2496ED?style=flat-square&logo=docker)
![Konva Canvas](https://img.shields.io/badge/Canvas-Konva_60FPS-0D9488?style=flat-square)
![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16_CTE-336791?style=flat-square&logo=postgresql)
![Vitest](https://img.shields.io/badge/Tests-66_Pass%C3%A9s-729B1B?style=flat-square&logo=vitest)

---

## ⚡ Lancement Immédiat (100% Conteneurisé — ZÉRO Prérequis)

Si votre objectif est **uniquement de lancer et tester le projet entier**, vous n'avez besoin **ni de Node.js, ni de pnpm, ni de Git** sur votre machine.

### **Seul Docker Desktop est requis !**

```bash
# 1. Lancez la stack complète conteneurisée :
docker compose up

# 2. Ouvrez votre navigateur sur :
# http://localhost:3000
```

> **Que se passe-t-il automatiquement en coulisse ?**
> 1. Docker démarre le conteneur `netfloor-postgres` (PostgreSQL 16).
> 2. Le script SQL initial `drizzle/0000_conscious_naoko.sql` est automatiquement exécuté au premier démarrage via `/docker-entrypoint-initdb.d/` pour initialiser l'ensemble des tables.
> 3. Dès que la base est prête (`pg_isready`), le conteneur `netfloor-app` démarre le serveur web Next.js standalone.
> 4. L'application est immédiatement opérationnelle sur le port 3000.

---

## 🛠️ Deux Façons de Lancer le Projet

Selon votre besoin, choisissez le mode approprié :

| Mode | Prérequis | Commande | Usage |
|---|---|---|---|
| **🐳 Mode 1 : 100% Conteneurisé** | Docker uniquement | `docker compose up` | Démonstration, test rapide, utilisation immédiate |
| **💻 Mode 2 : Développement Local** | Node.js `>= 20`, pnpm `>= 9` | `./run.sh dev` ou `.\run.ps1 dev` | Édition du code, rechargement à chaud (Hot-Reload) |

---

## 🌟 Fonctionnalités Clés

- **Canvas Haute Performance (60 FPS Constant)** : Moteur Konva découplé avec gestion fine des calques (Grille, Zones, Câbles, Équipements). Aucun lag lors du pan/zoom grâce au binding GPU natif et Zustand.
- **Moteur Spatial Métrique au Millimètre** : Snapping métrique (500mm), alignement dynamique (Smart Guides), attraction magnétique sur connecteurs, et invariance absolue du zoom au curseur.
- **Routage Automatique & Rubanage Orthogonal** : Détection des cheminements optimaux à 90° vers les baies de brassage, gestion du rubanage multi-câbles (6mm d'écart par conducteur) et anti-collision stricte sur les ports de switch.
- **Arborescence Complète d'Équipements** :
  - **Baies & Racks** : 42U, 24U, 18U avec châssis, bandeaux passe-câbles, PDU, patch panels Cat6A et commutateurs Aruba/Cisco.
  - **Bureaux & Mobilier** : Bureaux individuels, benchs doubles/quadruples, tables de réunion visio, blocs de prises RJ45, boîtes de sol.
  - **Périphériques Réseau** : Prises RJ45 simples et empilées, téléphones IP avec assignation VLAN/VoIP, traceurs, imprimantes réseau, caméras IP, bornes Wi-Fi AP.
  - **Zones de Service** : Délimitation visuelle et verrouillable par couleur (Lab R&D, DSI NOC, Direction, etc.) avec cartouches d'identification.
- **Annuaire d'Entreprise Intégré** : Gestion des collaborateurs, postes assignés, affectation d'IP statique/DHCP et liaisons téléphoniques directes.
- **Traçage Relationnel Récursif (CTE)** : Résolution instantanée du cheminement complet depuis une prise utilisateur jusqu'au port de switch et VLAN associé (`Hop 0: Prise` ➜ `Hop 1: Câble horizontal` ➜ `Hop 2: Patch Panel` ➜ `Hop 3: Cordon de brassage` ➜ `Hop 4: Switch`).
- **Ingestion & Audit de Masse** : Analyse d'intégrité et importation transactionnelle de carnets de câblage d'entreprise (>800 liaisons traitées en <100ms avec détection d'anomalies et doublons).
- **Architecture Hybride Déconnectable** : Fonctionnement complet avec PostgreSQL 16 sous Docker ou en mode autonome embarqué via PGlite (WASM) et IndexedDB local.

---

## 💻 Mode 2 : Développement Local (Hot-Reload)

Si vous souhaitez modifier le code source et bénéficier du rechargement à chaud :

### 1. Prérequis Développeur
- **Node.js** `>= 20.x` *(recommandé 22+)*
- **pnpm** `>= 9.x` *(installation : `corepack enable pnpm` ou `npm i -g pnpm@9`)*
- **Docker** *(facultatif : si absent, le projet bascule automatiquement sur la base embarquée PGlite)*

### 2. Installation des Dépendances
```bash
pnpm install
cp .env.example .env
```

### 3. Lancement du Serveur de Développement
Le script unifié gère tout (démarrage automatique de PostgreSQL, migrations DDL et lancement de Next.js) :

#### Linux / macOS / Git Bash :
```bash
./run.sh dev
# Avec injection du carnet d'exemple et ouverture automatique du navigateur :
./run.sh dev --seed --open
```

#### Windows (PowerShell) :
```powershell
.\run.ps1 dev
# Avec injection du carnet d'exemple et ouverture automatique du navigateur :
.\run.ps1 dev -Seed -Open
```

---

## 📖 Commandes Disponibles via le Script (`run.sh` / `run.ps1`)

| Commande | Linux / macOS / Git Bash | Windows (PowerShell) | Description |
|---|---|---|---|
| **docker up** | `./run.sh docker up` | `.\run.ps1 docker` | Lance l'intégralité de la stack en conteneurs Docker (Postgres + App) |
| **dev** | `./run.sh dev` | `.\run.ps1 dev` | Mode dev local : Postgres Docker + Next.js hot-reload |
| **dev avec seed** | `./run.sh dev --seed` | `.\run.ps1 dev -Seed` | Lance le projet avec injection du carnet d'exemple en base |
| **start** | `./run.sh start` | `.\run.ps1 start` | Démarre l'application compilée de production hors Docker |
| **build** | `./run.sh build` | `.\run.ps1 build` | Contrôle TypeScript (`tsc --noEmit`) + compilation Next.js |
| **type-check** | `./run.sh type-check` | `.\run.ps1 type-check` | Validation stricte des types TypeScript |
| **lint** | `./run.sh lint` | `.\run.ps1 lint` | Analyse statique du code source avec ESLint |
| **format** | `./run.sh format` | `.\run.ps1 format` | Formatage automatique avec Prettier |
| **test:spatial** | `./run.sh test --test-type spatial` | `.\run.ps1 test -TestType spatial` | Exécute les 16 bancs d'essais géométriques 2D |
| **test:ingestion**| `./run.sh test --test-type ingestion`| `.\run.ps1 test -TestType ingestion`| Teste l'audit et l'import de 800+ liaisons |
| **test:pglite** | `./run.sh test --test-type pglite` | `.\run.ps1 test -TestType pglite` | Valide la CTE récursive sur PostgreSQL WASM |
| **test (tous)** | `./run.sh test` | `.\run.ps1 test` | Exécute tous les bancs d'essais et la suite Vitest (66 tests) |
| **ci** | `./run.sh ci` | `.\run.ps1 ci` | Simule en local le pipeline CI complet (format, lint, tsc, tests, audit) |
| **db seed** | `./run.sh db --db-action seed` | `.\run.ps1 db -DbAction seed` | Injecte la topologie d'entreprise de référence |
| **db reset** | `./run.sh db --db-action reset` | `.\run.ps1 db -DbAction reset` | Réinitialise et recrée le schéma PostgreSQL |
| **clean** | `./run.sh clean` | `.\run.ps1 clean` | Supprime `.next`, `dist`, `coverage` et artéfacts de compilation |

---

## 🧪 Bancs d'Essais & Validation Qualité

Le projet intègre une suite de 66 tests automatisés :

```bash
# Lancement de l'intégralité des tests :
pnpm test

# Ou via le script unifié :
./run.sh test
# Ou sous Windows :
.\run.ps1 test
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
   - Validation d'un carnet de 800 liaisons d'entreprise en <75 ms.
   - Insertion transactionnelle atomique dans PostgreSQL.
3. **Moteur SQL / CTE Récursive (`test:pglite`)** :
   - Exécution de la CTE récursive de traçage bout en bout sur moteur PostgreSQL 16 WASM.
   - Validation exacte du nombre de sauts, des longueurs physiques et du VLAN résolu.

---

## 🏗️ Architecture du Projet

```text
NetFloor/
├── src/
│   ├── app/                      # Next.js App Router (page.tsx, layout, routes /api/*)
│   ├── components/
│   │   ├── canvas/               # Rendu Konva (FloorCanvas, EquipmentLayer, CableLayer, ZoneLayer...)
│   │   └── ui/                   # Panneaux (EquipmentPalette, CircuitInspector, InventoryPanel...)
│   ├── db/                       # Schéma PostgreSQL Drizzle & client hybride (Postgres/PGlite)
│   ├── engine/
│   │   ├── spatial/              # Moteur géométrique 2D & calculs métriques
│   │   ├── ingestion/            # Moteur d'import et audit matriciel CSV
│   │   └── storage/              # Persistance locale (IndexedDB / Zustand)
│   └── data/                     # Annuaire collaborateurs, VLANs et équipements initiaux
├── docs/                         # Documentation technique, passation IA & guides de déploiement
│   ├── ANTIGRAVITY_HANDOVER.md   # Dossier d'architecture complet pour l'agent Antigravity
│   └── DEPLOYMENT_PRODUCTION.md  # Guide de mise en production haute disponibilité
├── drizzle/                      # Migrations SQL versionnées (DDL)
├── docker/                       # Configurations Caddy, MinIO et conteneurs
├── Dockerfile                    # Image multi-stage de l'application (Next.js standalone)
├── docker-compose.yml            # Stack conteneurisée complète (PostgreSQL 16 + Next.js App)
├── run.sh                        # Script d'exécution unifié (Linux / macOS / Git Bash)
├── run.ps1                       # Script d'exécution unifié (Windows PowerShell)
├── Makefile                      # Raccourcis de commandes pour développeurs
└── README.md                     # Documentation générale d'accueil et prise en main
```

---

## 📄 Licence

Ce projet est la propriété de l'équipe NetFloor Architect. Tous droits réservés.
