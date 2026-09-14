# Architecture production & staging NetFloor

## 1) Réseau, reverse proxy et contrainte SNMP

### Caddy en frontal
- `caddy` est le seul service exposé (`80/443`) sur `frontend-net`.
- TLS automatique, compression `zstd/gzip`, support WebSocket transparent via `reverse_proxy`.
- `app` (Next.js) reste privé sur `backend-net`.

### Isolation SNMP recommandée
- **Par défaut** : garder `app` en réseau Docker bridge (`backend-net` + `storage-net`) pour limiter la surface d’attaque.
- **Pour accès LAN/VLAN clients SNMP** : préférer un **worker SNMP dédié** (service séparé), avec:
  - soit des routes réseau dédiées/NAT depuis un bridge,
  - soit `network_mode: host` uniquement pour ce worker (jamais pour le frontal web).
- La séparation worker SNMP / frontend permet de cloisonner les privilèges réseau tout en conservant l’application web isolée.

## 2) Évolution stockage plans/assets vers S3

### Cible
- Conserver PostgreSQL pour métadonnées métiers.
- Stocker les fichiers lourds (plans HD, SVG, exports DWG) sur S3-compatible (`MinIO` en auto-hébergé, S3 managé en cloud).

### Pattern recommandé
1. Le client demande un upload à une Route Handler Next.js (authz + validation MIME/taille).
2. Le serveur génère une URL pré-signée PUT avec clé objet normalisée.
3. Le client envoie directement le fichier vers S3/MinIO.
4. Le serveur enregistre ensuite les métadonnées (clé, checksum, version, site/floor) en base.
5. Les lectures passent via URL pré-signée GET courte durée.

## 3) Migrations Drizzle en CI/CD et au démarrage

### Au démarrage conteneur
- Service one-shot `migrate` (target Docker `migrator`) exécuté avant `app`.
- `app` dépend de `migrate` avec `service_completed_successfully`.
- Garantit un schéma à jour avant exposition HTTP.

### En CI/CD
- Étape dédiée avant déploiement applicatif:
  - build image
  - démarrage PostgreSQL de release
  - `pnpm db:migrate`
  - déploiement `app` uniquement si migration OK
- Rollback: restaurer backup + redéployer image précédente.

## 4) Sauvegardes & résilience PostgreSQL

### Automatisation proposée
- Service `postgres-backup` lance `pg_dump` planifié via cron.
- Dump compressé (`gzip`) puis chiffré (`gpg AES256`).
- Rotation locale (`BACKUP_RETENTION_DAYS`) + export objet S3 (`mc cp`).

### Politique minimale
- Fréquence: toutes les 6h (ajuster via `BACKUP_CRON`).
- Rétention: 14 jours minimum.
- Test de restauration obligatoire en staging (au moins hebdomadaire).

## 5) Fichiers livrés

- `/home/runner/work/NetFloor/NetFloor/docker-compose.prod.yml`
- `/home/runner/work/NetFloor/NetFloor/Dockerfile`
- `/home/runner/work/NetFloor/NetFloor/docker/caddy/Caddyfile`
- `/home/runner/work/NetFloor/NetFloor/docker/minio/init-bucket.sh`
- `/home/runner/work/NetFloor/NetFloor/docker/postgres/backup.sh`
- `/home/runner/work/NetFloor/NetFloor/.env.prod.example`

## 6) Démarrage

```bash
cp .env.prod.example .env.prod
# éditer les secrets

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```
