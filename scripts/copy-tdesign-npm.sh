#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/miniprogram/node_modules/tdesign-miniprogram/miniprogram_dist"
DEST="$ROOT/miniprogram/miniprogram_npm/tdesign-miniprogram"
if [[ ! -d "$SRC" ]]; then
  echo "先执行: npm install --prefix miniprogram --omit=dev"
  exit 1
fi
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/." "$DEST"
echo "已复制 TDesign 到 miniprogram/miniprogram_npm"
