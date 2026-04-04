#!/bin/sh
set -eu

LOCKFILE_HASH="$(sha256sum package-lock.json | cut -d ' ' -f 1)"
STAMP_FILE="node_modules/.package-lock.sha256"

if [ ! -d node_modules ] || [ ! -f "$STAMP_FILE" ] || [ "$(cat "$STAMP_FILE")" != "$LOCKFILE_HASH" ]; then
  mkdir -p node_modules
  find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  npm ci --no-fund --no-audit
  mkdir -p node_modules
  printf '%s' "$LOCKFILE_HASH" > "$STAMP_FILE"
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec sh
