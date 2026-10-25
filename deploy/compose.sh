#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
exec docker compose --env-file .env.production -f compose.production.yml "$@"
