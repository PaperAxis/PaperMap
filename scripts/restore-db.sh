#!/bin/sh
# PaperMap veritabanini bir yedekten geri yukler.
# DIKKAT: mevcut veritabani icerigi yedektekiyle degistirilir.
# Kullanim: scripts/restore-db.sh <yedek-dosyasi.sql.gz>
set -e

cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env

FILE="$1"
if [ -z "$FILE" ]; then
  echo "Kullanim: scripts/restore-db.sh <yedek-dosyasi.sql.gz>"
  exit 1
fi
if [ ! -f "$FILE" ]; then
  echo "Dosya bulunamadi: $FILE"
  exit 1
fi

DB="${POSTGRES_DB:-papermap}"
echo "UYARI: '$DB' veritabaninin mevcut icerigi '$FILE' ile degistirilecek."
printf "Devam etmek icin 'yes' yazin: "
read ans
[ "$ans" = "yes" ] || { echo "Iptal edildi."; exit 1; }

gunzip -c "$FILE" | docker compose exec -T db psql -U "${POSTGRES_USER:-papermap}" "$DB"
echo "Geri yukleme tamamlandi."
