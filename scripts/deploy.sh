#!/usr/bin/env bash
# PaperMap'i sunucudaki kalici klasore kurar ve konteynerleri yeniden derler.
# Self-hosted runner'in calisma klasoru her iste silinebilir; sunucu oradan degil,
# buradan calisir.
#
#   scripts/deploy.sh [hedef]        # varsayilan: /opt/PaperMap
#
# - Yalnizca git'te izlenen dosyalar kopyalanir. Hedefteki .env, tiles/, fcm/,
#   backups/ gibi depoda olmayan dosyalara dokunulmaz.
# - docker compose hedef klasorde calisir; proje adi (ve dolayisiyla papermap_db
#   veritabani birimi) mevcut kurulumla ayni kalir.
# - Konteynerler saglikli olana kadar beklenir; olmazsa betik hata ile biter.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${1:-/opt/PaperMap}"

case "$target" in
  /?*/?*) ;;
  *) echo "Hedef en az iki seviyeli mutlak bir yol olmali: $target" >&2; exit 1 ;;
esac

if [ ! -d "$target" ] || [ ! -w "$target" ]; then
  echo "$target yok ya da yazilamiyor. Sunucuda bir kez:" >&2
  echo "  sudo install -d -o $(id -un) -g $(id -gn) -m 0755 $target" >&2
  exit 1
fi

# .env yoksa durulur: bos ayarla kalkan bir server JWT_SECRET'siz acilmaz,
# daha kotusu bos bir veritabani parolasiyla yeni kurulum yapilabilir.
if [ ! -f "$target/.env" ]; then
  echo "$target/.env yok. Once README'deki 'VDS'te Yayina Alma' adimlarini uygulayin." >&2
  exit 1
fi

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
git -C "$root" archive --format=tar HEAD | tar -x -C "$staging"
git -C "$root" rev-parse --short HEAD > "$staging/REVISION"

# Izlenen dosyalari ustune yaz (silme yok: .env, tiles/, fcm/, backups/ korunur).
cp -a "$staging"/. "$target"/
echo "Kuruldu: $target ($(cat "$target/REVISION"))"

if [ ! -f "$target/tiles/turkey.mbtiles" ]; then
  echo "::warning::tiles/turkey.mbtiles yok — harita kutucuklari sunulmaz. Sunucuda bir kez: ./scripts/build-turkey-tiles.sh"
fi

cd "$target"
docker compose up -d --build --remove-orphans --wait --wait-timeout 300
docker compose ps
docker image prune -f >/dev/null || true
echo "PaperMap guncellendi: $(cat REVISION)"
