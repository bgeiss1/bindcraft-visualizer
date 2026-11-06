#!/bin/bash
# Installs the BindCraft2 Visualizer next to the other MIP 662 sites.
# Run it from the folder this archive unpacked into:   bash install.sh
set -euo pipefail
DEST="${1:-$HOME/Desktop/Code/MIP662_practice_tool/bindcraft-visualizer}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -d "$DEST" ]; then
  STAMP="$(date +%Y%m%d-%H%M%S)"
  echo "A site is already there. Backing it up to ${DEST}_backup_$STAMP"
  cp -R "$DEST" "${DEST}_backup_$STAMP"
  # Keep the text and the target registry the dashboard has saved.
  for keep in data/text.json data/targets.json; do
    if [ -f "$DEST/$keep" ]; then
      echo "Keeping your $keep (the new one is at $keep.new)"
      cp "$HERE/$keep" "$HERE/$keep.new"
      cp "$DEST/$keep" "$HERE/$keep"
    fi
  done
fi

mkdir -p "$DEST"
# Copy everything except any captured data already on disk at the destination.
rsync -a --exclude 'data/3evg_*' --exclude 'data/ajil15' --exclude 'data/hpdl1' \
      --exclude 'data/backups' "$HERE"/ "$DEST"/
echo
echo "Installed to $DEST"
echo "Start it with:   cd $DEST && node serve.mjs"
echo "Then open:       http://localhost:8003/  (dashboard: /admin.html)"
