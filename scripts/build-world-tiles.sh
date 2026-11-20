#!/usr/bin/env bash
# Tum dunya vektor haritasini uretir ve Turkiye'nin en ince detayli
# tile'larini ustune birlestirir (planetiler, OpenMapTiles semasi).
# VDS'te proje kokunde calistirin:  ./scripts/build-world-tiles.sh
#
# Cikti: tiles/papermap.mbtiles
#   - Dunya: z0..WORLD_MAXZOOM (varsayilan 14 = OpenMapTiles tam detay:
#     her yerde sokak, bina, POI).
#   - Turkiye: tiles/turkey.mbtiles'taki tum tile'lar (build-turkey-tiles.sh,
#     z16'ya kadar en ince detay). Cakisan tile'larda Turkiye'ninki kullanilir.
#
# Gereksinimler ve maliyet (WORLD_MAXZOOM=14):
#   - Docker, sqlite3
#   - ~85 GB planet.osm.pbf indirmesi (tiles/sources/planet.osm.pbf)
#   - Disk: uretim sirasinda ~300 GB bos alan; cikti ~90-100 GB
#   - RAM: 64 GB+ (varsayilan 96 GB Java heap), sure: guclu sunucuda 3-5 saat
#   Daha hafif bir dunya icin:  WORLD_MAXZOOM=10 ./scripts/build-world-tiles.sh
#   (Yurt disinda o zoom'un otesinde harita bos kalir.)
#   Not: stil kaynagi Turkiye'nin maxzoom'unu (16) kullanir; yurt disinda
#   WORLD_MAXZOOM'un ustundeki zoom'larda tile bulunmaz.
#
# Turkiye tile'lari yoksa once onlar uretilir. Tamamlaninca tileserver'i
# papermap.mbtiles'a cevirmek icin docker-compose.yml'deki tiles servisinin
# --file degerini /data/papermap.mbtiles yapip "docker compose up -d tiles"
# calistirin; web/src/lib/mapStyle.js SOURCE_MAXZOOM Turkiye'ninkiyle ayni kalir.
#
# Zaten varsa yeniden URETILMEZ; yenilemek icin:  --force
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p tiles

WORLD_MAXZOOM="${WORLD_MAXZOOM:-14}"
PLANETILER_XMX="${PLANETILER_XMX:-96g}"
FORCE="${1:-}"

command -v sqlite3 >/dev/null || { echo "HATA: sqlite3 gerekli (apt install sqlite3)." >&2; exit 1; }

if [ -f tiles/papermap.mbtiles ] && [ "$FORCE" != "--force" ] && [ "$FORCE" != "-f" ]; then
  echo "tiles/papermap.mbtiles zaten mevcut — yeniden uretilmedi. Yenilemek icin: --force"
  exit 0
fi

free_gb=$(df -BG --output=avail tiles | tail -1 | tr -dc 0-9)
need_gb=$(( WORLD_MAXZOOM >= 13 ? 300 : 150 ))
if [ "$free_gb" -lt "$need_gb" ]; then
  echo "HATA: tiles/ altinda ${free_gb} GB bos; en az ${need_gb} GB gerekli." >&2
  exit 1
fi

if [ ! -f tiles/turkey.mbtiles ]; then
  echo "==> Turkiye tile'lari yok, once onlar uretiliyor."
  ./scripts/build-turkey-tiles.sh
fi

echo "==> Dunya haritasi uretiliyor (planetiler, maxzoom=${WORLD_MAXZOOM})."
rm -f tiles/world.new.mbtiles
docker run --rm \
  -e JAVA_TOOL_OPTIONS="-Xmx${PLANETILER_XMX}" \
  -v "$(pwd)/tiles:/data" \
  ghcr.io/onthegomap/planetiler:latest \
  --download --area=planet \
  --minzoom=0 --maxzoom="${WORLD_MAXZOOM}" \
  --languages=tr,en \
  --nodemap_type=array --storage=mmap \
  --output=/data/world.new.mbtiles --force

echo "==> Turkiye tile'lari dunyanin ustune birlestiriliyor."
# planetiler mbtiles'i tekillestirilmis semayla yazar (tiles_shallow + tiles_data,
# "tiles" bir view). Turkiye'nin tile'lari ayni semaya kopyalanir; cakisan
# (zoom,x,y) satirlarinda Turkiye'ninki kalir. tile_data_id cakismasin diye
# Turkiye'nin id'leri dunyanin en buyuk id'sinin ustune kaydirilir.
sqlite3 tiles/world.new.mbtiles <<'SQL'
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;
ATTACH DATABASE 'tiles/turkey.mbtiles' AS tr;
CREATE TEMP TABLE off AS SELECT COALESCE(MAX(tile_data_id), 0) AS n FROM main.tiles_data;
INSERT INTO main.tiles_data (tile_data_id, tile_data)
  SELECT tile_data_id + (SELECT n FROM off), tile_data FROM tr.tiles_data;
INSERT OR REPLACE INTO main.tiles_shallow (zoom_level, tile_column, tile_row, tile_data_id)
  SELECT zoom_level, tile_column, tile_row, tile_data_id + (SELECT n FROM off) FROM tr.tiles_shallow;
UPDATE main.metadata SET value = (SELECT value FROM tr.metadata WHERE name = 'maxzoom')
  WHERE name = 'maxzoom';
UPDATE main.metadata SET value = '35.0,39.0,5' WHERE name = 'center';
UPDATE main.metadata SET value = 'PaperMap (dunya + Turkiye detay)' WHERE name = 'name';
DETACH DATABASE tr;
SQL

mv -f tiles/world.new.mbtiles tiles/papermap.mbtiles
echo
echo "==> Tamamlandi: tiles/papermap.mbtiles ($(du -h tiles/papermap.mbtiles | cut -f1))"
echo "    Sunmak icin docker-compose.yml tiles servisinde --file /data/papermap.mbtiles yapip:"
echo "    docker compose up -d tiles"
