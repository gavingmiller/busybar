#!/usr/bin/env bash
# Install this repo's launchd job into ~/Library/LaunchAgents.
# The repo copy is the source of truth: edit launchd/*.plist here, then run
# this script. Idempotent: copies only when the file differs and reloads
# only then (or when the job isn't loaded yet).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
UID_N="$(id -u)"
mkdir -p "$AGENTS" "$HOME/Library/Logs/busybar"

for src in "$HERE"/com.busybar.*.plist; do
  name="$(basename "$src")"
  label="${name%.plist}"
  dst="$AGENTS/$name"
  if ! cmp -s "$src" "$dst" 2>/dev/null; then
    cp -p "$src" "$dst"
    echo "plist  → $name"
    launchctl bootout "gui/$UID_N/$label" 2>/dev/null || true
    launchctl bootstrap "gui/$UID_N" "$dst"
    echo "reload → $label"
  elif ! launchctl print "gui/$UID_N/$label" >/dev/null 2>&1; then
    launchctl bootstrap "gui/$UID_N" "$dst"
    echo "load   → $label"
  else
    echo "ok     → $label (unchanged, loaded)"
  fi
done
