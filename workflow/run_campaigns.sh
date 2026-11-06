#!/bin/bash
# Runs the visualizer's campaigns on the GPU server and keeps every screen output.
# Run it on the server, with BindCraft2 installed:
#
#   bash run_campaigns.sh ~/bc2-visualizer-runs
#
# It does not change anything inside the BindCraft2 clone.
set -euo pipefail
RUNS="${1:-$HOME/bc2-visualizer-runs}"
BC2="${BC2:-$HOME/bindcraft2/BindCraft2}"
mkdir -p "$RUNS"/{structures,logs,refusals,settings}
cd "$RUNS"

# shellcheck disable=SC1091
source "$BC2/.venv/bin/activate"

for name in 3evg_apo 3evg_holo; do
  if [ ! -f "settings/$name.json" ]; then
    echo "settings/$name.json is missing. Write it first (see the site's README)." >&2
    exit 1
  fi
  echo "=== $name"
  date
  # tee keeps the screen output exactly as a student would see it, which is what the
  # run page prints.
  bindcraft design "settings/$name.json" 2>&1 | tee "logs/$name.log"
  date
done
