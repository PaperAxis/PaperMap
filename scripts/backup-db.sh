#!/bin/sh
# PaperMap veritabani yedegi alir — sIkIstIrIlmIs SQL dump.
# Kullanim: scripts/backup-db.sh [yedek-dizini]   (varsayilan: ./backups)
# Cron ornegi (her gece 03:00):
#   0 3 * * * cd /opt/PaperMap && scripts/backup-db.sh >> backups/backup.log 2>&1
set -e

cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env

BACKUP_DIR="${1:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/papermap-$STAMP.sql.gz"

docker compose exec -T db pg_dump -U "${POSTGRES_USER:-papermap}" "${POSTGRES_DB:-papermap}" \
  | gzip > "$OUT"

echo "Yedek alindi: $OUT"

# 30 gunden eski yedekleri temizle
find "$BACKUP_DIR" -name 'papermap-*.sql.gz' -mtime +30 -delete 2>/dev/null || true
