#!/bin/sh
set -eu

BACKUP_DIR="/backups"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${POSTGRES_DB}_${TS}.sql.gz.gpg"
TMP_FILE="/tmp/${POSTGRES_DB}_${TS}.sql.gz"

mkdir -p "$BACKUP_DIR"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h postgres \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-privileges \
| gzip > "$TMP_FILE"

gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" \
  -o "$BACKUP_DIR/$FILE" "$TMP_FILE"

rm -f "$TMP_FILE"

find "$BACKUP_DIR" -type f -name '*.gpg' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete

if [ "${S3_BACKUP_ENABLED:-false}" = "true" ]; then
  mc alias set s3 "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
  mc cp "$BACKUP_DIR/$FILE" "s3/$S3_BACKUP_BUCKET/postgres/$FILE"
fi
