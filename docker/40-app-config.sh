#!/bin/sh
# Runs from the nginx image entrypoint (/docker-entrypoint.d) on every container start.
# One image serves both deployments; compose picks the role:
#   NAV_SCOPE=catalog|studio  — trims menu and routes (empty = everything)
#   APP_MODE=admin|studio     — skips the /generation probe (empty = probe the API)
set -eu
clean() { printf '%s' "${1:-}" | tr -cd 'a-z'; }
cat > /usr/share/nginx/html/app-config.js <<CONFIG
window.__APP_CONFIG__ = { navScope: "$(clean "${NAV_SCOPE:-}")", appMode: "$(clean "${APP_MODE:-}")" };
CONFIG
echo "app-config: navScope=$(clean "${NAV_SCOPE:-}") appMode=$(clean "${APP_MODE:-}")"
