#!/usr/bin/env bash
# Mobil uygulama surumunu ve Release etiketini belirler; GITHUB_OUTPUT'a
# "version" ve "tag" olarak yazar.
#
#   app-version.sh <varsayilan-ana.ara> [--latest-tag]
#
# - "vX.Y.Z" etiketiyle tetiklenen calisma: surum etiketten alinir (v3.0.0 -> 3.0.0).
#   Etiket bu bicimde degilse is akisi durur.
# - INPUT_VERSION dolu (elle calistirmada "version" girdisi): surum odur; X.Y.Z
#   bicimi ve v<surum> etiketinin henuz olmamasi denetlenir (etiketi Release
#   adimi atar).
# - Etiketsiz calisma: <ana.ara>.<calistirma no>. --latest-tag verilirse ana.ara
#   en son vX.Y.Z etiketinden alinir (v3.0.0 -> 3.0.<no>); boylece elle yapilan
#   yayinlar etiketli surumun gerisine dusmez (PaperUpdates geri gitmeyi reddeder).
#   Bunun icin checkout'ta etiketler cekilmis olmali (fetch-depth: 0).
# Kullanan: .github/workflows/native-release.yml
set -euo pipefail

FALLBACK="${1:?varsayilan ana.ara surum gerekli, or. 2.0}"
USE_LATEST="${2:-}"
RUN="${GITHUB_RUN_NUMBER:?}"
SEMVER='^[0-9]+\.[0-9]+\.[0-9]+$'

INPUT_VERSION="${INPUT_VERSION:-}"
INPUT_VERSION="${INPUT_VERSION#v}"

if [[ "${GITHUB_REF:-}" != refs/tags/* && -n "$INPUT_VERSION" ]]; then
  if ! [[ "$INPUT_VERSION" =~ $SEMVER ]]; then
    echo "::error::Sürüm X.Y.Z biçiminde olmalı (ör. 3.0.0), gelen: $INPUT_VERSION"
    exit 1
  fi
  if [ -n "$(git tag -l "v$INPUT_VERSION")" ]; then
    echo "::error::v$INPUT_VERSION etiketi zaten var; o sürüm yeniden yayınlanmaz."
    exit 1
  fi
  VERSION="$INPUT_VERSION"
  TAG="v$VERSION"
elif [[ "${GITHUB_REF:-}" == refs/tags/v* ]]; then
  VERSION="${GITHUB_REF_NAME#v}"
  if ! [[ "$VERSION" =~ $SEMVER ]]; then
    echo "::error::Sürüm etiketi vX.Y.Z biçiminde olmalı (ör. v3.0.0), gelen: $GITHUB_REF_NAME"
    exit 1
  fi
  TAG="$GITHUB_REF_NAME"
else
  MAJOR_MINOR="$FALLBACK"
  if [ "$USE_LATEST" = "--latest-tag" ]; then
    LATEST=$(git tag -l 'v[0-9]*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || true)
    if [ -n "$LATEST" ]; then MAJOR_MINOR=$(echo "${LATEST#v}" | cut -d. -f1,2); fi
  fi
  VERSION="$MAJOR_MINOR.$RUN"
  TAG="native-$RUN"
fi

echo "version=$VERSION" >> "$GITHUB_OUTPUT"
echo "tag=$TAG" >> "$GITHUB_OUTPUT"
echo "Uygulama sürümü: $VERSION, Release etiketi: $TAG"
