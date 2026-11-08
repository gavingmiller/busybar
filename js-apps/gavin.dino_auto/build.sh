#!/usr/bin/env bash
# Builds dist/gavin.dino_auto.tgz from the upstream Dino Run release plus patch.py.
# Usage: ./build.sh [--install]   (install stages + installs on the bar over USB)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
VERSION="${DINO_RUN_VERSION:-1.0.0}"
BAR="${BUSYBAR_BASE_URL:-http://10.0.4.20}"
mkdir -p build dist
tgz="build/community.dino_run-$VERSION.tgz"
[ -f "$tgz" ] || gh release download "v$VERSION" -R alexseminoisok/busybar-dino-run -p "community.dino_run-$VERSION.tgz" -O "$tgz"
rm -rf build/src build/out && mkdir -p build/src build/out
tar xzf "$tgz" -C build/src
python3 -I patch.py build/src build/out
tar czf dist/gavin.dino_auto.tgz -C build/out gavin.dino_auto
echo "built dist/gavin.dino_auto.tgz"
if [ "${1:-}" = "--install" ]; then
  # Quit whatever JS app is running first: staging over the running copy of
  # this app removed it instead of replacing it (seen on fw 1.3.1). 409 = nothing running.
  curl -s -o /dev/null -X POST "$BAR/api/apps/quit"
  staged=$(curl -sS -X POST -H 'Content-Type: application/octet-stream' --data-binary @dist/gavin.dino_auto.tgz "$BAR/api/apps/stage")
  key=$(printf '%s' "$staged" | python3 -I -c 'import json,sys; d=json.load(sys.stdin); print(d.get("install_key") or sys.exit("stage failed: " + json.dumps(d)))')
  curl -sS -X POST "$BAR/api/apps/install?install_key=$key" && echo " installed gavin.dino_auto"
fi
