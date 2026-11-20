#!/usr/bin/env bash
# PaperMap'i sunucudaki kalici klasore kurar ve konteynerleri yeniden derler.
# Self-hosted runner'in calisma klasoru her iste silinebilir; sunucu oradan degil,
# buradan calisir.
#
#   scripts/deploy.sh [hedef]        # varsayilan: /opt/PaperMap
#
# - Hedef bir git klonuysa (.git varsa) origin'den cekilip dagitilan commit'e
#   'git reset --hard' yapilir; boylece klasor GitHub ile hep ayni kalir.
#   Degilse eski yontemle izlenen dosyalar kopyalanir.
# - Her iki yolda da .env, tiles/, fcm/, backups/ gibi depoda olmayan
#   (ignore edilen) dosyalara dokunulmaz.
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

# Commit being deployed: the one the runner checked out (GITHUB_SHA in CI).
sha="${DEPLOY_SHA:-$(git -C "$root" rev-parse HEAD)}"

if [ -d "$target/.git" ]; then
  # Update the install folder through git so its history matches GitHub.
  git -C "$target" fetch --prune origin
  git -C "$target" fetch origin "$sha"
  if [ -n "$(git -C "$target" status --porcelain --untracked-files=no)" ] \
     || ! git -C "$target" merge-base --is-ancestor HEAD "$sha"; then
    backup_ref="refs/deploy-backup/$(date +%Y%m%d-%H%M%S)"
    git -C "$target" stash push --quiet --message "deploy $sha" || true
    git -C "$target" update-ref "$backup_ref" HEAD
    echo "::warning::$target icinde yerel degisiklik/commit vardi; $backup_ref ve git stash'e yedeklendi."
  fi
  branch="$(git -C "$target" symbolic-ref --short -q HEAD || echo main)"
  git -C "$target" checkout --quiet -B "$branch" "$sha"
  git -C "$target" reset --hard --quiet "$sha"
  git -C "$target" rev-parse --short HEAD > "$target/REVISION"
else
  echo "::warning::$target bir git klonu degil; dosyalar kopyalanarak kuruluyor."
  staging="$(mktemp -d)"
  trap 'rm -rf "$staging"' EXIT
  git -C "$root" archive --format=tar "$sha" | tar -x -C "$staging"
  git -C "$root" rev-parse --short "$sha" > "$staging/REVISION"
  # Overwrite tracked files only (no deletes: .env, tiles/, fcm/, backups/ stay).
  cp -a "$staging"/. "$target"/
fi
echo "Kuruldu: $target ($(cat "$target/REVISION"))"

if [ ! -f "$target/tiles/turkey.mbtiles" ]; then
  echo "::warning::tiles/turkey.mbtiles yok — harita kutucuklari sunulmaz. Sunucuda bir kez: ./scripts/build-turkey-tiles.sh"
fi

cd "$target"
docker compose up -d --build --remove-orphans --wait --wait-timeout 300
docker compose ps
docker image prune -f >/dev/null || true
echo "PaperMap guncellendi: $(cat REVISION)"
