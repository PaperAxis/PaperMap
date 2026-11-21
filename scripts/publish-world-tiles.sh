#!/usr/bin/env bash
# Tum dunya vektor haritasini (OpenFreeMap, OpenMapTiles semasi — web/src/lib/
# mapStyle.js ile ayni) tek bir PMTiles dosyasi olarak statik bir hosting'e
# kurar: https://tiles.paperaxis.com/planet.pmtiles + /fonts.
#
# Hosting'de sunucu programi gerekmez: harita dosyadan yalniz gereken kutucugu
# HTTP Range ile okur. Betik ayrica fontlari ve .htaccess'i (CORS, Range icin
# sikistirmanin kapatilmasi, onbellek) kurar.
#
# IKI KULLANIM:
#  1) Onerilen — VDS'te donustur, hosting'e yukle (rsync/SSH):
#       TARGET=kullanici@sunucu:tiles.paperaxis.com ./scripts/publish-world-tiles.sh
#     MBTiles -> PMTiles donusumu birkac GB RAM ve uzun sure CPU ister; paylasimli
#     hosting'ler (CloudLinux) boyle surecleri sinirlar/oldurur. VDS'ten hosting'e
#     SSH anahtariyla parolasiz baglanti kurulu olmali (ssh-copy-id).
#  2) Dogrudan hosting'de (SSH ile; kaynak sinirlari yetiyorsa):
#       TARGET_DIR=~/tiles.paperaxis.com ./scripts/publish-world-tiles.sh
#     Uzun surer; oturum kopmasin diye:  nohup ./publish-world-tiles.sh > tiles.log 2>&1 &
#
# DISK: ~85 GB indirme + ~85 GB PMTiles (gecici olarak ikisi birden).
#
# AYARLAR (ortam degiskeni):
#   MBTILES_URL     OpenFreeMap planet .mbtiles adresi. Bos ise
#                   https://btrfs.openfreemap.com/files.txt icinden en yenisi bulunur.
#   WORK_DIR        Indirme/donusum klasoru (varsayilan ~/papermap-tiles-build)
#   KEEP_MBTILES=1  Donusumden sonra .mbtiles silinmesin
#   PMTILES_VERSION go-pmtiles surumu (varsayilan 1.31.2)
#   SKIP_FONTS=1    Fontlari yeniden kurma
#
# GUNCELLEME: OpenFreeMap haftalik yeni veri yayinlar; betigi yeniden calistirmak
# haritayi gunceller. Yeni dosya hazir olunca eskisinin yerine tek adimda tasinir
# (yarim dosya hic sunulmaz).
set -euo pipefail

PMTILES_VERSION="${PMTILES_VERSION:-1.31.2}"
FONTS_URL="https://github.com/openmaptiles/fonts/releases/download/v2.0/v2.0.zip"
WORK_DIR="${WORK_DIR:-$HOME/papermap-tiles-build}"
TARGET="${TARGET:-}"
TARGET_DIR="${TARGET_DIR:-$HOME/tiles.paperaxis.com}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nHATA: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null || die "curl gerekli."
command -v unzip >/dev/null || command -v python3 >/dev/null || die "unzip ya da python3 gerekli."
if [ -n "$TARGET" ]; then
  command -v rsync >/dev/null || die "Uzak yukleme icin rsync gerekli."
  case "$TARGET" in *:*) ;; *) die "TARGET kullanici@sunucu:klasor biciminde olmali." ;; esac
fi

mkdir -p "$WORK_DIR/tmp"
cd "$WORK_DIR"

# --- Disk kontrolu (paylasimli hosting'de "sinirsiz" kota df'de gorunmeyebilir) ---
AVAIL_GB=$(df -Pk "$WORK_DIR" | awk 'NR==2 {print int($4/1024/1024)}')
if [ "${AVAIL_GB:-0}" -lt 200 ]; then
  echo "UYARI: $WORK_DIR icin bos alan ~${AVAIL_GB} GB gorunuyor; ~170 GB gerekir."
  echo "       Kota df'de gorunmuyorsa sorun olmayabilir. Devam ediliyor (iptal: Ctrl+C)."
  sleep 5
fi

# --- pmtiles araci ---
PMTILES="$WORK_DIR/pmtiles"
if [ ! -x "$PMTILES" ]; then
  log "go-pmtiles $PMTILES_VERSION indiriliyor"
  case "$(uname -m)" in
    x86_64|amd64) ARCH=x86_64 ;;
    aarch64|arm64) ARCH=arm64 ;;
    *) die "Desteklenmeyen islemci: $(uname -m)" ;;
  esac
  curl -fL --retry 5 -o pmtiles.tgz \
    "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_${ARCH}.tar.gz"
  tar xzf pmtiles.tgz pmtiles
  rm -f pmtiles.tgz
  chmod +x "$PMTILES"
fi

# --- OpenFreeMap planet adresi ---
if [ -z "${MBTILES_URL:-}" ]; then
  log "En yeni OpenFreeMap planet surumu araniyor"
  REL=$(curl -fsS --retry 3 https://btrfs.openfreemap.com/files.txt 2>/dev/null \
    | grep -E '^areas/planet/[^/]+/tiles\.mbtiles$' | sort | tail -1 || true)
  [ -n "$REL" ] || die "Planet .mbtiles bulunamadi. Adresi https://btrfs.openfreemap.com/files.txt
icinden bulup MBTILES_URL=... ile verin (ornek: https://btrfs.openfreemap.com/areas/planet/<surum>/tiles.mbtiles)."
  MBTILES_URL="https://btrfs.openfreemap.com/$REL"
fi
echo "Kaynak: $MBTILES_URL"

# --- Indirme (yarida kalirsa kaldigi yerden devam eder) ---
log "Planet MBTiles indiriliyor (~85 GB; kesilirse betigi yeniden calistirin, devam eder)"
curl -fL --retry 20 --retry-delay 10 -C - -o planet.mbtiles "$MBTILES_URL"

# --- Donusum ---
log "MBTiles -> PMTiles donusturuluyor (uzun surer)"
rm -f planet.new.pmtiles
"$PMTILES" convert planet.mbtiles planet.new.pmtiles --tmpdir="$WORK_DIR/tmp"
"$PMTILES" show planet.new.pmtiles | head -20
[ "${KEEP_MBTILES:-0}" = "1" ] || rm -f planet.mbtiles
rm -rf "$WORK_DIR/tmp"

# --- Fontlar ---
FONT_DIR="$WORK_DIR/fonts"
if [ "${SKIP_FONTS:-0}" != "1" ]; then
  log "Fontlar hazirlaniyor (Noto Sans Regular/Bold/Italic)"
  rm -rf "$FONT_DIR" fonts.zip
  curl -fL --retry 5 -o fonts.zip "$FONTS_URL"
  mkdir -p "$FONT_DIR"
  if command -v unzip >/dev/null; then
    unzip -q -o fonts.zip 'Noto Sans Regular/*' 'Noto Sans Bold/*' 'Noto Sans Italic/*' -d "$FONT_DIR"
  else
    python3 -I - "$WORK_DIR/fonts.zip" "$FONT_DIR" <<'PY'
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
for n in z.namelist():
    if n.split('/')[0] in ('Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic'):
        z.extract(n, sys.argv[2])
PY
  fi
  rm -f fonts.zip
  [ -f "$FONT_DIR/Noto Sans Regular/0-255.pbf" ] || die "Font paketi beklenen bicimde degil."
fi

cp "$SCRIPT_DIR/tiles-htaccess" "$WORK_DIR/.htaccess"

# --- Yayin: yeni dosya hazir olunca tek adimda eskisinin yerine gecer ---
if [ -n "$TARGET" ]; then
  HOST="${TARGET%%:*}"
  DIR="${TARGET#*:}"
  log "Hosting'e yukleniyor: $TARGET"
  ssh "$HOST" "mkdir -p '$DIR'"
  rsync -a --partial --info=progress2 planet.new.pmtiles "$HOST:$DIR/planet.new.pmtiles"
  [ "${SKIP_FONTS:-0}" = "1" ] || rsync -a --delete "$FONT_DIR/" "$HOST:$DIR/fonts/"
  rsync -a "$WORK_DIR/.htaccess" "$HOST:$DIR/.htaccess"
  ssh "$HOST" "mv -f '$DIR/planet.new.pmtiles' '$DIR/planet.pmtiles'"
  rm -f planet.new.pmtiles
else
  log "Yayin klasorune tasiniyor: $TARGET_DIR"
  mkdir -p "$TARGET_DIR"
  if [ "${SKIP_FONTS:-0}" != "1" ]; then
    rm -rf "$TARGET_DIR/fonts.new"
    cp -r "$FONT_DIR" "$TARGET_DIR/fonts.new"
    rm -rf "$TARGET_DIR/fonts.old"
    [ -d "$TARGET_DIR/fonts" ] && mv "$TARGET_DIR/fonts" "$TARGET_DIR/fonts.old"
    mv "$TARGET_DIR/fonts.new" "$TARGET_DIR/fonts"
    rm -rf "$TARGET_DIR/fonts.old"
  fi
  cp "$WORK_DIR/.htaccess" "$TARGET_DIR/.htaccess"
  # Ayni dosya sisteminde mv atomiktir; farkliysa once yanina kopyalanir.
  if ! mv -f planet.new.pmtiles "$TARGET_DIR/planet.pmtiles" 2>/dev/null; then
    cp planet.new.pmtiles "$TARGET_DIR/planet.new.pmtiles"
    mv -f "$TARGET_DIR/planet.new.pmtiles" "$TARGET_DIR/planet.pmtiles"
    rm -f planet.new.pmtiles
  fi
fi

cat <<EOF

==> Tamamlandi.
Kontrol (206 Partial Content ve Access-Control-Allow-Origin gormelisiniz):
  curl -sI -H 'Range: bytes=0-126' https://tiles.paperaxis.com/planet.pmtiles
  curl -sI 'https://tiles.paperaxis.com/fonts/Noto%20Sans%20Regular/0-255.pbf'
Ilk kurulumdan sonra .env'e ekleyin ve web'i yeniden derleyin:
  VITE_TILES_PMTILES=https://tiles.paperaxis.com/planet.pmtiles
EOF
