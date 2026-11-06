#!/usr/bin/env bash
# Copies the student pages into a folder for GitHub Pages. Leaves out the text dashboard
# (admin.html, js/admin.js), the local server, the tests, the capture scripts and every backup.
#   bash tools/build_pages.sh _site            (NOINDEX=1 asks search engines not to list it)
set -euo pipefail
out=${1:-_site}
cd "$(dirname "$0")/.."
rm -rf "$out" && mkdir -p "$out/data" "$out/js"

for f in *.html; do [ "$f" = admin.html ] || cp "$f" "$out/"; done
cp -R css vendor "$out/"
cp -R js/pages "$out/js/"
for f in js/*.js; do [ "$f" = js/admin.js ] || cp "$f" "$out/js/"; done
cp data/*.json "$out/data/"

# The captured campaigns, whichever ones are registered. Each key in data/campaigns.json
# names a folder of structures, frames and metrics beside it. A campaign that has not been
# captured has no folder, and the pages already say so.
for C in $(python3 -c "
import json
d = json.load(open('data/campaigns.json'))
print(' '.join(d.get('order') or d.keys()))
"); do
  [ -d "data/$C" ] && cp -R "data/$C" "$out/data/"
done

if [ "${NOINDEX:-}" = 1 ]; then
  perl -pi -e 's#<head>#<head>\n<meta name="robots" content="noindex, nofollow">#' "$out"/*.html
fi
touch "$out/.nojekyll"
echo "built $out: $(find "$out" -type f | wc -l | tr -d ' ') files, $(du -sh "$out" | cut -f1)"
