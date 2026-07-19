#!/usr/bin/env bash
# Turkiye vektor harita tile'larini uretir (planetiler, OpenStreetMap verisi).
# VDS'te proje kokunde calistirin:  ./scripts/build-turkey-tiles.sh
#
# Cikti: tiles/turkey.mbtiles  (tileserver-gl bunu sunar)
# Gereksinim: Docker.
#
# DETAY / KALITE:
#   Varsayilan maxzoom 15'tir (planetiler'in kendi varsayilani 14). z15; bina,
#   POI ve sokak geometrisini cok daha detayli saklar; MapLibre bunlari z16+
#   icin buyuterek (overzoom) kesintisiz gosterir. Bedeli: mbtiles ~2-3x buyur
#   ve uretim daha uzun surer. Disk/sure kisitliysa dusurun:
#       TILE_MAXZOOM=14 ./scripts/build-turkey-tiles.sh --force
#   Bu degeri degistirirseniz web/src/lib/mapStyle.js icindeki kaynak
#   "maxzoom" degerini de esitleyin.
#
# Harita zaten varsa yeniden URETILMEZ. Guncel OSM verisiyle yenilemek icin:
#   ./scripts/build-turkey-tiles.sh --force
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p tiles

# En detayli varsayilan: z15. mapStyle.js kaynak maxzoom'u ile ayni olmali.
TILE_MAXZOOM="${TILE_MAXZOOM:-15}"

FORCE="${1:-}"
if [ -f tiles/turkey.mbtiles ] && [ "$FORCE" != "--force" ] && [ "$FORCE" != "-f" ]; then
  echo "tiles/turkey.mbtiles zaten mevcut — yeniden uretilmedi."
  echo "Guncel OSM verisiyle yenilemek icin:  ./scripts/build-turkey-tiles.sh --force"
  exit 0
fi

echo "==> Turkiye haritasi uretiliyor (planetiler, maxzoom=${TILE_MAXZOOM})."
echo "    Detay seviyesine gore birkac dakika ile yarim saat surebilir..."
docker run --rm \
  -v "$(pwd)/tiles:/data" \
  ghcr.io/onthegomap/planetiler:latest \
  --download --area=turkey \
  --minzoom=0 --maxzoom="${TILE_MAXZOOM}" \
  --output=/data/turkey.mbtiles --force

echo
echo "==> Tamamlandi: tiles/turkey.mbtiles (maxzoom=${TILE_MAXZOOM})"
echo "==> Tile sunucusunu yenileyin:  docker compose restart tiles"
