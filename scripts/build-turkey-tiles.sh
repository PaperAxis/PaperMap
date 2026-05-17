#!/usr/bin/env bash
# Turkiye vektor harita tile'larini uretir (planetiler, OpenStreetMap verisi).
# VDS'te proje kokunde calistirin:  ./scripts/build-turkey-tiles.sh
#
# Cikti: tiles/turkey.mbtiles  (tileserver-gl bunu sunar)
# Gereksinim: Docker. Ilk calistirma birkac dakika surer (~birkac yuz MB indirir).
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p tiles

echo "==> Turkiye haritasi uretiliyor (planetiler)..."
docker run --rm \
  -v "$(pwd)/tiles:/data" \
  ghcr.io/onthegomap/planetiler:latest \
  --download --area=turkey \
  --output=/data/turkey.mbtiles --force

echo
echo "==> Tamamlandi: tiles/turkey.mbtiles"
echo "==> Tile sunucusunu baslatin/yenileyin:"
echo "      docker compose up -d tiles"
