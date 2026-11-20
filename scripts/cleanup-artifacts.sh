#!/usr/bin/env bash
# GitHub Actions artifact kotasini bosaltir: bir hesabin/organizasyonun TUM depolarinda,
# her artifact adinin yalnizca en yenisini tutar, gerisini siler. Suresi dolmus kayitlar
# zaten kotaya sayilmaz, atlanir.
#
#   scripts/cleanup-artifacts.sh                 # kuru calistirma: ne silinecegini ve boyutunu gosterir
#   scripts/cleanup-artifacts.sh --apply         # gercekten siler
#   OWNER=captainendis scripts/cleanup-artifacts.sh --apply
#   KEEP=0 scripts/cleanup-artifacts.sh --apply  # en yenisi dahil hepsini sil
#
# Gerekenler: gh (gh auth login; depolarda yazma yetkisi), jq.
# Not: GitHub kota kullanimini 6-12 saatte bir yeniden hesaplar; bosalan yer hemen gorunmeyebilir.

set -euo pipefail

owner="${OWNER:-PaperAxis}"
keep="${KEEP:-1}"
apply=false
[ "${1:-}" = "--apply" ] && apply=true

command -v gh >/dev/null || { echo "gh yok: https://cli.github.com" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq yok." >&2; exit 1; }

repos=$(gh repo list "$owner" --limit 1000 --json nameWithOwner -q '.[].nameWithOwner')
total_bytes=0
total_count=0

for repo in $repos; do
  # Suresi dolmamis artifact'ler, yeniden eskiye; her adin ilk $keep kaydi tutulur.
  victims=$(gh api --paginate "repos/$repo/actions/artifacts?per_page=100" \
              -q '.artifacts[] | select(.expired | not) | [.id, .name, .size_in_bytes, .created_at] | @tsv' \
            | sort -t $'\t' -k4,4r \
            | awk -F'\t' -v keep="$keep" '{ seen[$2]++; if (seen[$2] > keep) print }')
  [ -n "$victims" ] || continue

  while IFS=$'\t' read -r id name size created; do
    total_bytes=$((total_bytes + size))
    total_count=$((total_count + 1))
    printf '%s  %-30s %8.1f MB  %s\n' "$repo" "$name" "$(echo "$size / 1048576" | bc -l)" "${created%%T*}"
    if $apply; then
      gh api -X DELETE "repos/$repo/actions/artifacts/$id" >/dev/null
    fi
  done <<< "$victims"
done

mb=$(echo "$total_bytes / 1048576" | bc -l)
if $apply; then
  printf '\nSilindi: %d artifact, %.1f MB (%s)\n' "$total_count" "$mb" "$owner"
else
  printf '\nSilinecek: %d artifact, %.1f MB (%s). Silmek icin: %s --apply\n' "$total_count" "$mb" "$owner" "$0"
fi
