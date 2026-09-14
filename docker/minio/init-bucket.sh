#!/bin/sh
set -eu

MC_HOST="http://minio:9000"

until mc alias set local "$MC_HOST" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  sleep 2
done

mc mb --ignore-existing "local/$S3_BUCKET"
mc anonymous set private "local/$S3_BUCKET"
