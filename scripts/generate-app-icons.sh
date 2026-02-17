#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ICON="${1:-$ROOT_DIR/src/renderer/assets/hydropower-logo.png}"
TMP_DIR="$ROOT_DIR/.tmp/icon-build"
ICONSET_DIR="$TMP_DIR/icon.iconset"
WIN_DIR="$TMP_DIR/windows"

if [ ! -f "$SOURCE_ICON" ]; then
  echo "Source icon not found: $SOURCE_ICON" >&2
  exit 1
fi

rm -rf "$TMP_DIR"
mkdir -p "$ICONSET_DIR" "$WIN_DIR"

# Base PNG used by Linux and some tooling.
sips -z 512 512 "$SOURCE_ICON" --out "$ROOT_DIR/icon.png" >/dev/null

# macOS iconset for iconutil -> .icns
sips -z 16 16 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET_DIR" -o "$ROOT_DIR/icon.icns"

# Windows .ico from multiple resolutions.
sips -z 16 16 "$SOURCE_ICON" --out "$WIN_DIR/16.png" >/dev/null
sips -z 24 24 "$SOURCE_ICON" --out "$WIN_DIR/24.png" >/dev/null
sips -z 32 32 "$SOURCE_ICON" --out "$WIN_DIR/32.png" >/dev/null
sips -z 48 48 "$SOURCE_ICON" --out "$WIN_DIR/48.png" >/dev/null
sips -z 64 64 "$SOURCE_ICON" --out "$WIN_DIR/64.png" >/dev/null
sips -z 128 128 "$SOURCE_ICON" --out "$WIN_DIR/128.png" >/dev/null
sips -z 256 256 "$SOURCE_ICON" --out "$WIN_DIR/256.png" >/dev/null
npx --yes png-to-ico \
  "$WIN_DIR/16.png" \
  "$WIN_DIR/24.png" \
  "$WIN_DIR/32.png" \
  "$WIN_DIR/48.png" \
  "$WIN_DIR/64.png" \
  "$WIN_DIR/128.png" \
  "$WIN_DIR/256.png" \
  > "$ROOT_DIR/icon.ico"

rm -rf "$TMP_DIR"
echo "Generated: $ROOT_DIR/icon.png, $ROOT_DIR/icon.icns, $ROOT_DIR/icon.ico"
