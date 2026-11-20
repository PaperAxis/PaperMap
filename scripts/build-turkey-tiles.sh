#!/usr/bin/env bash
# Turkiye vektor harita tile'larini en ince detayla uretir
# (planetiler, OpenMapTiles semasi, OpenStreetMap verisi).
# VDS'te proje kokunde calistirin:  ./scripts/build-turkey-tiles.sh
#
# Cikti: tiles/turkey.mbtiles  (tileserver-gl bunu sunar)
# Gereksinim: Docker. Bu ayarlarla ~16 GB RAM ve birkac GB disk yeter.
#
# DETAY / KALITE (varsayilanlar en detayli ayardir):
#   - maxzoom 16: planetiler'in destekledigi en yuksek zoom. Bina, POI, patika
#     ve sokak geometrisi tam cozunurlukte saklanir; z17+ MapLibre'de buyutulur.
#   - Basitlestirme ve en kucuk oge esigi en aza cekilir: kucuk binalar, kisa
#     yollar ve dar alanlar atilmaz.
#   - z13'te tum patikalar, z13 bina birlestirmesi kapali, kucuk yol adlari ve
#     yerel yol numaralari acik.
#   - Etiket dilleri yalniz Turkce ve Ingilizce (dosya boyutunu dusurur; stil
#     "name" alanini kullanir).
#   Disk/sure kisitliysa zoom'u dusurun:
#       TILE_MAXZOOM=15 ./scripts/build-turkey-tiles.sh --force
#   TILE_MAXZOOM'u degistirirseniz web/src/lib/mapStyle.js icindeki
#   SOURCE_MAXZOOM'u esitleyip "node apps/scripts/export-map-styles.mjs" calistirin.
#
# Harita zaten varsa yeniden URETILMEZ. Guncel OSM verisiyle yenilemek icin:
#   ./scripts/build-turkey-tiles.sh --force
# Uretim gecici dosyaya yapilir; bitince eskisinin yerine tasinir ve tile
# sunucusu yeniden baslatilir, uretim boyunca harita kesintisiz sunulur.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p tiles

# mapStyle.js SOURCE_MAXZOOM ile ayni olmali.
TILE_MAXZOOM="${TILE_MAXZOOM:-16}"
# Planetiler'a ayrilan bellek (RAM'i bol sunucuda gecici veri RAM'de tutulur).
PLANETILER_XMX="${PLANETILER_XMX:-32g}"

FORCE="${1:-}"
if [ -f tiles/turkey.mbtiles ] && [ "$FORCE" != "--force" ] && [ "$FORCE" != "-f" ]; then
  echo "tiles/turkey.mbtiles zaten mevcut — yeniden uretilmedi."
  echo "Guncel OSM verisiyle yenilemek icin:  ./scripts/build-turkey-tiles.sh --force"
  exit 0
fi

echo "==> Turkiye haritasi uretiliyor (planetiler, maxzoom=${TILE_MAXZOOM}, en ince detay)."
echo "    Birkac dakika ile yarim saat surebilir..."
rm -f tiles/turkey.new.mbtiles
docker run --rm \
  -e JAVA_TOOL_OPTIONS="-Xmx${PLANETILER_XMX}" \
  -v "$(pwd)/tiles:/data" \
  ghcr.io/onthegomap/planetiler:latest \
  --download --area=turkey \
  --minzoom=0 --maxzoom="${TILE_MAXZOOM}" --render_maxzoom="${TILE_MAXZOOM}" \
  --simplify_tolerance_at_max_zoom=0 \
  --min_feature_size_at_max_zoom=0 \
  --simplify_tolerance=0.05 \
  --min_feature_size=0.5 \
  --transportation_z13_paths=true \
  --building_merge_z13=false \
  --transportation_name_size_for_shield=true \
  --transportation_name_minor_refs=true \
  --languages=tr,en \
  --storage=ram \
  --output=/data/turkey.new.mbtiles --force

mv -f tiles/turkey.new.mbtiles tiles/turkey.mbtiles
echo
echo "==> Tamamlandi: tiles/turkey.mbtiles ($(du -h tiles/turkey.mbtiles | cut -f1), maxzoom=${TILE_MAXZOOM})"
if docker compose ps --services --status running 2>/dev/null | grep -qx tiles; then
  docker compose restart tiles
  echo "==> Tile sunucusu yeniden baslatildi."
else
  echo "==> Tile sunucusunu baslatin:  docker compose up -d tiles"
fi
