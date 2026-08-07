#!/usr/bin/env bash
#
# One-command deploy for a VPS.
#
#   ./deploy-vps.sh
#
# Pulls the latest code, installs exactly what the lockfile specifies, runs the
# full test suite, and only then swaps the built site into place. If anything
# fails, the currently-served site is left untouched.
#
# First-time setup on a fresh box is in README.md under "Deploying to a VPS".

set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/var/www/taxsums}"
BRANCH="${BRANCH:-main}"

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mFAILED:\033[0m %s\n' "$1" >&2; exit 1; }

cd "$(dirname "$0")"

say "Fetching latest from origin/$BRANCH"
git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git reset --hard --quiet "origin/$BRANCH"
echo "    now at $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

say "Installing dependencies from the lockfile"
npm ci --no-audit --no-fund

# The whole point of the test suite is that a wrong tax rate never reaches the
# public. Build and test BEFORE touching what is currently being served.
say "Building and running the full test suite"
npm run verify || fail "build or tests failed — the live site was not touched"

say "Publishing to $WEB_ROOT"
mkdir -p "$WEB_ROOT"
# Stage into a sibling directory, then swap. Visitors never see a half-copied
# site, and rolling back is just moving the previous directory back.
STAGING="$WEB_ROOT/.dist-new"
PREVIOUS="$WEB_ROOT/.dist-previous"
rm -rf "$STAGING"
cp -r dist "$STAGING"

if [ -d "$WEB_ROOT/dist" ]; then
	rm -rf "$PREVIOUS"
	mv "$WEB_ROOT/dist" "$PREVIOUS"
fi
mv "$STAGING" "$WEB_ROOT/dist"

say "Done — $(find "$WEB_ROOT/dist" -name '*.html' | wc -l | tr -d ' ') pages live"
echo "    Previous build kept at $PREVIOUS (move it back to roll back)"
