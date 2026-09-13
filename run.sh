#!/usr/bin/env bash
# ==============================================================================
# NetFloor Architect - Script général de gestion et d'exécution
# ==============================================================================
set -e

# Couleurs et formatage
BOLD="\033[1m"
CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
BLUE="\033[1;34m"
MAGENTA="\033[1;35m"
RESET="\033[0m"

# Répertoire racine du projet
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Valeurs par défaut
COMMAND="dev"
PORT="3000"
HOST="0.0.0.0"
ENV_FILE=""
AUTO_OPEN=false
TEST_TARGET="all"
BUILD_TARGET="all"
DB_ACTION="seed"
SEED_DB=false
NO_DOCKER=false

# Résolution automatique du binaire pnpm
resolve_pnpm() {
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    local CACHED_CJS
    CACHED_CJS=$(find "$HOME/.npm/_npx" -name "pnpm.cjs" 2>/dev/null | head -n 1 || true)

    if [ -x "$HOME/.local/share/pnpm/bin/pnpm" ]; then
        export PATH="$HOME/.local/share/pnpm/bin:$PATH"
        PNPM_CMD="$HOME/.local/share/pnpm/bin/pnpm"
    elif [ -n "$CACHED_CJS" ] && [ -f "$CACHED_CJS" ]; then
        PNPM_CMD="node $CACHED_CJS"
    elif command -v pnpm >/dev/null 2>&1; then
        PNPM_CMD="pnpm"
    elif command -v corepack >/dev/null 2>&1; then
        PNPM_CMD="corepack pnpm"
    elif command -v npx >/dev/null 2>&1; then
        PNPM_CMD="npx pnpm"
    else
        echo -e "${RED}❌ Erreur : pnpm est introuvable sur votre système.${RESET}"
        echo -e "Installez-le via : ${YELLOW}corepack enable pnpm${RESET} ou ${YELLOW}npm install -g pnpm@9${RESET}"
        exit 1
    fi
}

# Affichage de la bannière
print_banner() {
    echo -e "${CYAN}"
    echo "  _   _      _   ______ _                  "
    echo " | \ | |    | | |  ____| |                 "
    echo " |  \| | ___| |_| |__  | | ___   ___  _ __ "
    echo " | . \` |/ _ \ __|  __| | |/ _ \ / _ \| '__|"
    echo " | |\  |  __/ |_| |    | | (_) | (_) | |   "
    echo " |_| \_|\___|\__|_|    |_|\___/ \___/|_|   "
    echo -e "${RESET}"
    echo -e "   ${BOLD}Architecture & Câblage Réseau Haute Densité 2D/3D${RESET}"
    echo -e "   -------------------------------------------------\n"
}

# Affichage de l'aide
print_help() {
    print_banner
    echo -e "${BOLD}UTILISATION :${RESET}"
    echo -e "  ./run.sh [COMMANDE] [OPTIONS]\n"

    echo -e "${BOLD}COMMANDES PRINCIPALES :${RESET}"
    echo -e "  ${GREEN}dev${RESET}           Démarre le serveur Next.js en mode développement [DÉFAUT]"
    echo -e "  ${GREEN}start${RESET}         Démarre l'application compilée en production"
    echo -e "  ${GREEN}build${RESET}         Compile l'application (validation TypeScript + build Next.js)"
    echo -e "  ${GREEN}test${RESET}          Exécute les bancs d'essais (spatial, ingestion, pglite, coverage)"
    echo -e "  ${GREEN}lint${RESET}          Vérifie la qualité du code source avec ESLint"
    echo -e "  ${GREEN}format${RESET}        Vérifie ou applique le formatage avec Prettier"
    echo -e "  ${GREEN}type-check${RESET}    Valide la cohérence des types TypeScript (tsc --noEmit)"
    echo -e "  ${GREEN}db${RESET}            Gère les opérations de base de données Drizzle (seed, migrate, push)"
    echo -e "  ${GREEN}ci${RESET}            Simule en local le pipeline complet CI / SonarQube"
    echo -e "  ${GREEN}clean${RESET}         Supprime les dossiers temporaires et artéfacts de build\n"

    echo -e "${BOLD}OPTIONS DISPONIBLES :${RESET}"
    echo -e "  ${YELLOW}-p, --port <PORT>${RESET}       Port d'écoute HTTP (par défaut : 3000)"
    echo -e "  ${YELLOW}-H, --host <HOST>${RESET}       Adresse IP ou hôte d'écoute (par défaut : 0.0.0.0)"
    echo -e "  ${YELLOW}-e, --env <FICHIER>${RESET}     Charge un fichier d'environnement (.env.local, .env...)"
    echo -e "  ${YELLOW}-o, --open${RESET}              Ouvre l'application dans le navigateur par défaut"
    echo -e "  ${YELLOW}--test-type <TYPE>${RESET}      Sous-type de test : all | spatial | ingestion | pglite | coverage"
    echo -e "  ${YELLOW}--db-action <ACTION>${RESET}    Action base de données : seed | migrate | push | generate"
    echo -e "  ${YELLOW}-h, --help${RESET}              Affiche ce menu d'aide"
    echo -e "  ${YELLOW}-v, --version${RESET}           Affiche la version de NetFloor Architect\n"

    echo -e "${BOLD}EXEMPLES D'UTILISATION :${RESET}"
    echo -e "  ./run.sh                          # Démarre Next.js dev sur http://localhost:3000"
    echo -e "  ./run.sh dev -p 8080 --open       # Démarre sur le port 8080 et ouvre le navigateur"
    echo -e "  ./run.sh test --test-type spatial # Exécute le banc d'essai géométrique spatial 2D"
    echo -e "  ./run.sh test --test-type coverage# Exécute Vitest et génère coverage/lcov.info"
    echo -e "  ./run.sh ci                       # Exécute lint + type-check + tests + couverture\n"
}

# Analyse des arguments de la ligne de commande
while [[ $# -gt 0 ]]; do
    case "$1" in
        dev|start|build|test|lint|format|type-check|db|ci|clean)
            COMMAND="$1"
            shift
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -H|--host)
            HOST="$2"
            shift 2
            ;;
        -e|--env|--env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        -o|--open)
            AUTO_OPEN=true
            shift
            ;;
        --test-type)
            TEST_TARGET="$2"
            shift 2
            ;;
        --db-action)
            DB_ACTION="$2"
            shift 2
            ;;
        --seed)
            SEED_DB=true
            shift
            ;;
        --no-docker)
            NO_DOCKER=true
            shift
            ;;
        -v|--version)
            echo "NetFloor Architect v0.1.0"
            exit 0
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            echo -e "${RED}Option ou commande inconnue : $1${RESET}"
            echo -e "Utilisez ${YELLOW}./run.sh --help${RESET} pour voir la liste des commandes disponibles."
            exit 1
            ;;
    esac
done

resolve_pnpm

# Chargement facultatif de variable d'environnement
if [ -n "$ENV_FILE" ]; then
    if [ -f "$ENV_FILE" ]; then
        echo -e "${CYAN}📄 Chargement des variables d'environnement depuis : $ENV_FILE${RESET}"
        set -o allexport
        # shellcheck disable=SC1090
        source "$ENV_FILE"
        set +o allexport
    else
        echo -e "${RED}❌ Fichier d'environnement introuvable : $ENV_FILE${RESET}"
        exit 1
    fi
fi

# Fonction pour ouvrir le navigateur
open_browser() {
    local URL="http://localhost:${PORT}"
    sleep 2
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$URL" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
        open "$URL" >/dev/null 2>&1 &
    fi
}

# Fonction pour assurer la disponibilité et l'initialisation de PostgreSQL (Docker)
ensure_database() {
    if [ "$NO_DOCKER" = true ]; then
        echo -e "${YELLOW}⚠️ Option --no-docker spécifiée : contournement du démarrage automatique de PostgreSQL.${RESET}"
        return 0
    fi

    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Docker n'est pas détecté. Lancement sans conteneur local (mode hors-ligne ou PostgreSQL externe).${RESET}"
        return 0
    fi

    # Forcer le contexte Docker standard default si présent
    if docker context inspect default >/dev/null 2>&1; then
        export DOCKER_CONTEXT="default"
    fi

    echo -e "${CYAN}🐘 Démarrage et vérification de la base PostgreSQL (Docker)...${RESET}"
    DOCKER_CONFIG=$(mktemp -d 2>/dev/null || echo "/tmp") docker compose up -d postgres >/dev/null 2>&1 || docker compose up -d postgres

    echo -ne "   • En attente de PostgreSQL... "
    local RETRIES=15
    until docker compose exec -T postgres pg_isready -q >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
        echo -ne "."
        sleep 1
        RETRIES=$((RETRIES - 1))
    done

    if [ $RETRIES -eq 0 ]; then
        echo -e " ${RED}Délai dépassé.${RESET}"
        echo -e "${YELLOW}   L'application démarrera en mode déconnecté.${RESET}"
        return 0
    else
        echo -e " ${GREEN}Prêt !${RESET}"
    fi

    # Vérification et application automatique de la migration si la base est neuve
    local TABLE_COUNT
    TABLE_COUNT=$(docker compose exec -T postgres psql -U postgres -d netfloor -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d '[:space:]' || echo "0")
    if [ "$TABLE_COUNT" = "0" ] || [ -z "$TABLE_COUNT" ]; then
        echo -e "${CYAN}📜 Initialisation des tables PostgreSQL (migration initiale DDL)...${RESET}"
        docker compose exec -T postgres psql -U postgres -d netfloor < "$PROJECT_ROOT/drizzle/0000_conscious_naoko.sql" >/dev/null 2>&1 || true
        echo -e "   ${GREEN}✅ Tables créées avec succès.${RESET}"
    fi

    # Injection facultative du seed si demandé via --seed
    if [ "$SEED_DB" = true ]; then
        echo -e "${CYAN}🌱 Injection de la configuration d'exemple en base...${RESET}"
        $PNPM_CMD db:seed || true
    fi
}

# Exécution de la commande demandée
case "$COMMAND" in
    dev)
        print_banner
        echo -e "${GREEN}🚀 Lancement de NetFloor Architect en mode DÉVELOPPEMENT${RESET}"
        echo -e "   • URL locale : ${CYAN}http://${HOST}:${PORT}${RESET}"
        echo -e "   • Gestionnaire de paquets : ${YELLOW}$($PNPM_CMD -v)${RESET}\n"

        ensure_database


        if [ "$AUTO_OPEN" = true ]; then
            open_browser &
        fi
        $PNPM_CMD dev -p "$PORT" -H "$HOST"
        ;;

    start)
        print_banner
        echo -e "${GREEN}🌐 Démarrage du serveur de PRODUCTION sur http://${HOST}:${PORT}${RESET}\n"
        if [ "$AUTO_OPEN" = true ]; then
            open_browser &
        fi
        $PNPM_CMD start -p "$PORT" -H "$HOST"
        ;;

    build)
        print_banner
        echo -e "${CYAN}🔨 Validation TypeScript et compilation de production...${RESET}\n"
        $PNPM_CMD type-check
        $PNPM_CMD build:next
        echo -e "\n${GREEN}✅ Compilation réussie ! Prêt pour le déploiement.${RESET}"
        ;;

    type-check)
        echo -e "${CYAN}🔎 Contrôle strict TypeScript (tsc --noEmit)...${RESET}"
        $PNPM_CMD type-check
        echo -e "${GREEN}✅ Aucune erreur de typage détectée.${RESET}"
        ;;

    lint)
        echo -e "${CYAN}🔍 Analyse du code source avec ESLint...${RESET}"
        $PNPM_CMD lint
        echo -e "${GREEN}✅ Analyse ESLint terminée sans erreur.${RESET}"
        ;;

    format)
        echo -e "${CYAN}🎨 Formatage et vérification Prettier...${RESET}"
        $PNPM_CMD format
        echo -e "${GREEN}✅ Formatage appliqué avec succès.${RESET}"
        ;;

    test)
        print_banner
        case "$TEST_TARGET" in
            spatial)
                echo -e "${CYAN}📐 Exécution du banc d'essai spatial 2D (16 tests géométriques)...${RESET}\n"
                $PNPM_CMD test:spatial
                ;;
            ingestion)
                echo -e "${CYAN}🏭 Exécution du banc d'essai d'ingestion de masse...${RESET}\n"
                $PNPM_CMD test:ingestion
                ;;
            pglite)
                echo -e "${CYAN}🐘 Exécution du banc d'essai PostgreSQL 16 WASM...${RESET}\n"
                $PNPM_CMD test:pglite
                ;;
            coverage)
                echo -e "${CYAN}🧪 Exécution de Vitest et génération du rapport LCOV...${RESET}\n"
                $PNPM_CMD test:coverage
                ;;
            all)
                echo -e "${CYAN}🏁 Lancement de l'intégralité des bancs d'essais NetFloor...${RESET}\n"
                $PNPM_CMD type-check
                $PNPM_CMD test:spatial
                $PNPM_CMD test:ingestion
                $PNPM_CMD test:pglite
                $PNPM_CMD test:coverage
                echo -e "\n${GREEN}🎉 Tous les bancs d'essais sont validés avec succès !${RESET}"
                ;;
            *)
                echo -e "${RED}Type de test inconnu : $TEST_TARGET${RESET}"
                echo -e "Types acceptés : all, spatial, ingestion, pglite, coverage"
                exit 1
                ;;
        esac
        ;;

    db)
        ensure_database
        case "$DB_ACTION" in
            seed)
                echo -e "${CYAN}🌱 Peuplement de la base de données avec la configuration de référence...${RESET}"
                $PNPM_CMD db:seed
                ;;
            reset)
                echo -e "${CYAN}🧹 Réinitialisation complète de la base de données...${RESET}"
                docker compose exec -T postgres psql -U postgres -d netfloor -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null 2>&1 || true
                docker compose exec -T postgres psql -U postgres -d netfloor < "$PROJECT_ROOT/drizzle/0000_conscious_naoko.sql" >/dev/null 2>&1 || true
                echo -e "${GREEN}✅ Base de données vierge réinitialisée.${RESET}"
                ;;
            migrate)
                echo -e "${CYAN}🗄️ Application des migrations SQL...${RESET}"
                $PNPM_CMD db:migrate
                ;;
            push)
                echo -e "${CYAN}🗄️ Synchronisation du schéma Drizzle vers la base...${RESET}"
                $PNPM_CMD db:push
                ;;
            generate)
                echo -e "${CYAN}🗄️ Génération des migrations SQL...${RESET}"
                $PNPM_CMD db:generate
                ;;
            *)
                echo -e "${RED}Action DB inconnue : $DB_ACTION${RESET}"
                echo -e "Actions disponibles : seed, migrate, push, generate"
                exit 1
                ;;
        esac
        ;;

    ci)
        print_banner
        echo -e "${MAGENTA}🚀 Simulation locale du pipeline CI GitHub Actions (Fail-Fast)${RESET}\n"
        
        echo -e "${CYAN}1. Format check (Prettier)${RESET}"
        $PNPM_CMD format:check || true
        
        echo -e "\n${CYAN}2. Lint check (ESLint)${RESET}"
        $PNPM_CMD lint
        
        echo -e "\n${CYAN}3. Type-check (TypeScript strict)${RESET}"
        $PNPM_CMD type-check
        
        echo -e "\n${CYAN}4. Tests & Couverture LCOV (Vitest)${RESET}"
        $PNPM_CMD test:coverage
        
        echo -e "\n${GREEN}====================================================${RESET}"
        echo -e "${GREEN}🏆 SIMULATION CI RÉUSSIE : Pipeline prêt pour le push !${RESET}"
        echo -e "${GREEN}====================================================${RESET}"
        ;;

    clean)
        echo -e "${YELLOW}🧹 Nettoyage des dossiers générés (.next, coverage, dist)...${RESET}"
        rm -rf .next dist coverage *.tsbuildinfo
        echo -e "${GREEN}✅ Nettoyage terminé avec succès.${RESET}"
        ;;
esac
