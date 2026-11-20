#!/usr/bin/env bash
# Kalici Android imza anahtarini openssl ile uretir ve GitHub Actions secret'larina
# dogrudan yazar. Parola ve anahtar ekrana basilmaz, kopyala-yapistir gerekmez.
#
#   scripts/setup-android-keystore.sh [yedek-klasoru]   # varsayilan: ~/.papermap-keystore
#
# Gerekenler: openssl, gh (gh auth login yapilmis, depoda admin yetkisi).
#
# ONEMLI: Yedek klasorundeki papermap.p12 ve password dosyasini guvenli bir yerde
# (parola yoneticisi, sifreli disk) saklayin. GitHub secret'lari geri okunamaz;
# bu anahtar kaybolursa kurulu uygulamalar bir daha guncellenemez.

set -euo pipefail

repo="${PAPERMAP_REPO:-PaperAxis/PaperMap}"
backup="${1:-$HOME/.papermap-keystore}"
alias_name="papermap"

command -v openssl >/dev/null || { echo "openssl yok." >&2; exit 1; }
command -v gh >/dev/null || { echo "gh yok: https://cli.github.com" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Once: gh auth login" >&2; exit 1; }

if [ -e "$backup/papermap.p12" ]; then
  echo "$backup/papermap.p12 zaten var — mevcut anahtarin uzerine yazilmaz." >&2
  echo "Ayni anahtari yeniden yuklemek icin: PAPERMAP_REUSE=1 $0 $backup" >&2
  [ "${PAPERMAP_REUSE:-0}" = 1 ] || exit 1
else
  umask 077
  mkdir -p "$backup"
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT

  openssl rand -base64 33 | tr -d '\n/+=' | head -c 40 > "$backup/password"
  openssl req -x509 -newkey rsa:4096 -sha256 -nodes -days 10000 \
    -subj "/CN=PaperMap/O=PaperAxis/C=TR" \
    -keyout "$work/key.pem" -out "$work/cert.pem" 2>/dev/null
  # Java/apksigner uyumlu PKCS12 (AES + SHA-256); alias = friendlyName.
  openssl pkcs12 -export -name "$alias_name" \
    -inkey "$work/key.pem" -in "$work/cert.pem" \
    -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256 \
    -passout "file:$backup/password" -out "$backup/papermap.p12"
  chmod 600 "$backup/password" "$backup/papermap.p12"
fi

# Dogrulama: dosya parolayla acilabiliyor mu (icerik basilmaz).
openssl pkcs12 -in "$backup/papermap.p12" -passin "file:$backup/password" -noout \
  || { echo "Keystore dogrulanamadi." >&2; exit 1; }

# Secret'lar stdin'den verilir; komut satirinda ya da ekranda gorunmez.
base64 < "$backup/papermap.p12" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64 -R "$repo"
gh secret set ANDROID_KEYSTORE_PASSWORD -R "$repo" < "$backup/password"
gh secret set ANDROID_KEY_PASSWORD -R "$repo" < "$backup/password"
printf '%s' "$alias_name" | gh secret set ANDROID_KEY_ALIAS -R "$repo"

echo "Secret'lar yuklendi: $repo (ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD)"
echo "Yedek: $backup  — bu klasoru guvenli bir yere tasiyin."
