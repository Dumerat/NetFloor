# NetFloor Architect — raccourcis vers le point d'entrée unique ./run.sh

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

PORT ?= 3000
HOST ?= 0.0.0.0
RUN := ./run.sh

.PHONY: help install dev start build lint lint-fix format format-check type-check \
	test test-coverage test-spatial test-ingestion test-pglite test-all ci clean \
	db-up db-down db-reset db-generate db-push db-migrate db-seed \
	docker-up docker-down docker-status docker-logs docker-restart \
	prod-up prod-down prod-status prod-logs prod-restart

help: ## Affiche l'aide de l'interface de gestion unifiée
	@$(RUN) --help

install: ## Installe les dépendances verrouillées
	@pnpm install

dev: ## Démarre Next.js et PostgreSQL de développement
	@$(RUN) dev --port $(PORT) --host $(HOST)

start: ## Démarre Next.js compilé hors Docker avec PostgreSQL de développement
	@$(RUN) start --port $(PORT) --host $(HOST)

build: ## Vérifie les types puis compile Next.js
	@$(RUN) build

lint: ## Exécute ESLint
	@$(RUN) lint

lint-fix: ## Corrige automatiquement ESLint
	@pnpm lint:fix

format: ## Applique Prettier
	@$(RUN) format

format-check: ## Vérifie Prettier sans modifier les fichiers
	@pnpm format:check

type-check: ## Vérifie TypeScript
	@$(RUN) type-check

test: test-coverage ## Lance Vitest avec couverture

test-coverage: ## Lance Vitest et produit coverage/lcov.info
	@$(RUN) test --test-type coverage

test-spatial: ## Lance les tests du moteur spatial
	@$(RUN) test --test-type spatial

test-ingestion: ## Lance les tests d'ingestion
	@$(RUN) test --test-type ingestion

test-pglite: ## Lance les tests PGlite
	@$(RUN) test --test-type pglite

test-all: ## Lance l'ensemble des tests et contrôles associés
	@$(RUN) test --test-type all

ci: ## Reproduit localement la CI GitHub
	@$(RUN) ci

db-up: ## Démarre PostgreSQL de développement
	@$(RUN) docker up --profile dev

db-down: ## Arrête PostgreSQL de développement
	@$(RUN) docker down --profile dev

db-reset: ## Réinitialise le schéma PostgreSQL de développement
	@$(RUN) db --db-action reset

db-generate: ## Génère une migration Drizzle
	@$(RUN) db --db-action generate

db-push: ## Synchronise le schéma Drizzle
	@$(RUN) db --db-action push

db-migrate: ## Applique les migrations Drizzle
	@$(RUN) db --db-action migrate

db-seed: ## Injecte les données de référence
	@$(RUN) db --db-action seed

docker-up: ## Démarre les services Docker de développement
	@$(RUN) docker up --profile dev

docker-down: ## Arrête les services Docker de développement
	@$(RUN) docker down --profile dev

docker-status: ## Affiche l'état Docker de développement
	@$(RUN) docker status --profile dev

docker-logs: ## Affiche les journaux Docker de développement
	@$(RUN) docker logs --profile dev

docker-restart: ## Redémarre les services Docker de développement
	@$(RUN) docker restart --profile dev

prod-up: ## Construit et démarre la stack production complète
	@$(RUN) prod up --build

prod-down: ## Arrête la stack production complète
	@$(RUN) prod down

prod-status: ## Affiche l'état de la stack production
	@$(RUN) prod status

prod-logs: ## Affiche les journaux de la stack production
	@$(RUN) prod logs

prod-restart: ## Redémarre la stack production
	@$(RUN) prod restart

clean: ## Supprime les artéfacts de build locaux
	@$(RUN) clean
