# ==============================================================================
# NetFloor Architect - Makefile d'automatisation
# ==============================================================================

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

# Résolution automatique du gestionnaire pnpm (PATH ou ~/.local/share/pnpm/bin)
PNPM_BIN := $(shell which pnpm 2>/dev/null || echo "$$HOME/.local/share/pnpm/bin/pnpm")
PNPM := export PATH="$$HOME/.local/share/pnpm/bin:$$PATH" && $(PNPM_BIN)

# Options configurables
PORT ?= 3000
HOST ?= 0.0.0.0

# Couleurs pour le terminal
CYAN    := \033[1;36m
GREEN   := \033[1;32m
YELLOW  := \033[1;33m
RED     := \033[1;31m
RESET   := \033[0m

.PHONY: help install dev build build-next start lint lint-fix format format-check \
        type-check test test-coverage test-spatial test-ingestion test-pglite test-all \
        db-generate db-push db-migrate db-seed clean

##@ 📖 Aide & Informations
help: ## Affiche l'aide détaillée et les commandes disponibles
	@echo -e "$(CYAN)====================================================================$(RESET)"
	@echo -e "$(CYAN)  🏢 NetFloor Architect - Makefile de développement & CI$(RESET)"
	@echo -e "$(CYAN)====================================================================$(RESET)"
	@echo -e "Utilisation : $(GREEN)make$(RESET) $(YELLOW)<cible>$(RESET) [PORT=3000] [HOST=0.0.0.0]\n"
	@awk 'BEGIN {FS = ":.*##"; printf "Commandes disponibles :\n"} \
		/^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2 } \
		/^##@/ { printf "\n$(YELLOW)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""

##@ 📦 Installation & Dépendances
install: ## Installe les dépendances avec pnpm
	@echo -e "$(CYAN)📦 Installation des dépendances avec pnpm...$(RESET)"
	@$(PNPM) install

##@ 🚀 Développement & Exécution
dev: ## Démarre le serveur de développement Next.js (PORT=3000 par défaut)
	@echo -e "$(CYAN)🚀 Démarrage du serveur Next.js en mode DEV sur http://$(HOST):$(PORT)...$(RESET)"
	@$(PNPM) dev -p $(PORT) -H $(HOST)

build: ## Type-checking strict TypeScript
	@echo -e "$(CYAN)🔨 Validation des types TypeScript...$(RESET)"
	@$(PNPM) build

build-next: ## Compile l'application Next.js pour la production
	@echo -e "$(CYAN)📦 Compilation Next.js de production...$(RESET)"
	@$(PNPM) build:next

start: ## Démarre l'application compilée en production
	@echo -e "$(CYAN)🌐 Démarrage du serveur de production sur http://$(HOST):$(PORT)...$(RESET)"
	@$(PNPM) start -p $(PORT) -H $(HOST)

##@ 🔍 Qualité de code & Linters
lint: ## Exécute ESLint sur le code source
	@echo -e "$(CYAN)🔍 Analyse du code source avec ESLint...$(RESET)"
	@$(PNPM) lint

lint-fix: ## Corrige automatiquement les erreurs ESLint
	@echo -e "$(CYAN)✨ Correction automatique ESLint...$(RESET)"
	@$(PNPM) lint:fix

format: ## Formate le code avec Prettier
	@echo -e "$(CYAN)🎨 Formatage du code avec Prettier...$(RESET)"
	@$(PNPM) format

format-check: ## Vérifie le formatage sans modifier les fichiers
	@echo -e "$(CYAN)🎨 Vérification du formatage Prettier...$(RESET)"
	@$(PNPM) format:check

type-check: ## Exécute la vérification de type TypeScript (tsc --noEmit)
	@echo -e "$(CYAN)🔎 Contrôle strict TypeScript (tsc --noEmit)...$(RESET)"
	@$(PNPM) type-check

##@ 🧪 Tests & Couverture
test: test-coverage ## Raccourci pour lancer les tests avec couverture LCOV

test-coverage: ## Exécute Vitest avec génération du rapport LCOV dans coverage/
	@echo -e "$(CYAN)🧪 Exécution des tests unitaires et couverture LCOV (Vitest)...$(RESET)"
	@$(PNPM) test:coverage

test-spatial: ## Exécute le banc d'essai mathématique du moteur spatial 2D
	@echo -e "$(CYAN)📐 Exécution du banc d'essai spatial 2D (16 tests géométriques)...$(RESET)"
	@$(PNPM) test:spatial

test-ingestion: ## Exécute le banc d'essai d'ingestion de masse (800+ liens)
	@echo -e "$(CYAN)🏭 Exécution du banc d'essai d'ingestion de carnet de câblage...$(RESET)"
	@$(PNPM) test:ingestion

test-pglite: ## Exécute le banc d'essai embarqué PostgreSQL 16 WASM & CTE récursive
	@echo -e "$(CYAN)🐘 Exécution du banc d'essai PostgreSQL 16 PGlite WASM...$(RESET)"
	@$(PNPM) test:pglite

test-all: ## Exécute l'intégralité des bancs d'essais du projet
	@echo -e "$(CYAN)🏁 Lancement complet de tous les bancs d'essais NetFloor...$(RESET)"
	@$(MAKE) type-check
	@$(MAKE) lint
	@$(MAKE) test-spatial
	@$(MAKE) test-ingestion
	@$(MAKE) test-pglite
	@$(MAKE) test-coverage
	@echo -e "$(GREEN)🎉 Tous les tests et contrôles sont validés avec succès !$(RESET)"

##@ 🗄️ Base de données & Drizzle ORM
db-generate: ## Génère les migrations Drizzle SQL à partir du schéma
	@echo -e "$(CYAN)🗄️ Génération des migrations Drizzle...$(RESET)"
	@$(PNPM) db:generate

db-push: ## Pousse les changements de schéma directement vers la base de données
	@echo -e "$(CYAN)🗄️ Drizzle schema push...$(RESET)"
	@$(PNPM) db:push

db-migrate: ## Applique les migrations Drizzle SQL
	@echo -e "$(CYAN)🗄️ Application des migrations Drizzle...$(RESET)"
	@$(PNPM) db:migrate

db-seed: ## Peuplement de la base de données avec le jeu de données de référence
	@echo -e "$(CYAN)🌱 Peuplement initial de la base de données (seed)...$(RESET)"
	@$(PNPM) db:seed

##@ 🧹 Maintenance & Nettoyage
clean: ## Supprime les caches et artéfacts de compilation (.next, coverage, dist)
	@echo -e "$(YELLOW)🧹 Nettoyage des dossiers générés...$(RESET)"
	@rm -rf .next dist coverage *.tsbuildinfo
	@echo -e "$(GREEN)✅ Nettoyage terminé.$(RESET)"

