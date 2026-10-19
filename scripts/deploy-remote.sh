#!/usr/bin/env bash
# Runs ON the server; uploaded and invoked by scripts/deploy-studio.ps1.
#   deploy-remote.sh deploy   <archive.tgz> <web-root>
#   deploy-remote.sh rollback <web-root>
# Swaps the web root in place: <root>.next is prepared and checked first, the
# previous release is kept as <root>.prev, and old hashed assets are carried over
# so browsers with an open tab can still lazy-load their old chunks.
set -euo pipefail

action="${1:?usage: deploy-remote.sh deploy <archive> <root> | rollback <root>}"

case "$action" in
  deploy)
    archive="${2:?archive path required}"
    root="${3:?web root required}"
    root="${root%/}"
    next="${root}.next"
    prev="${root}.prev"

    rm -rf "$next"
    mkdir -p "$next"
    tar -xzf "$archive" -C "$next"
    [ -f "$next/index.html" ] || { echo "ERROR: archive has no index.html, nothing changed" >&2; rm -rf "$next"; exit 1; }

    if [ -d "$root/assets" ]; then
      mkdir -p "$next/assets"
      # carry over old files that the new release does not replace (portable; cp -n differs by coreutils version)
      (cd "$root/assets" && find . -type f | while IFS= read -r f; do
        [ -e "$next/assets/$f" ] || cp -a --parents "$f" "$next/assets/"
      done)
      find "$next/assets" -type f -mtime +14 -delete
    fi

    chown -R www-data:www-data "$next"
    chmod -R go-w "$next"

    rm -rf "$prev"
    if [ -d "$root" ]; then mv "$root" "$prev"; fi
    mv "$next" "$root"
    rm -f "$archive"
    echo "deployed to $root (previous release kept in $prev)"
    ;;
  rollback)
    root="${2:?web root required}"
    root="${root%/}"
    prev="${root}.prev"
    [ -d "$prev" ] || { echo "ERROR: no previous release at $prev" >&2; exit 1; }
    tmp="${root}.rolled"
    rm -rf "$tmp"
    mv "$root" "$tmp"
    mv "$prev" "$root"
    mv "$tmp" "$prev"
    echo "rolled back $root (the release you replaced is now in $prev)"
    ;;
  *)
    echo "ERROR: unknown action: $action" >&2
    exit 2
    ;;
esac
