#!/usr/bin/env bash
# One-shot helper to push the Telegram bot token into GitHub Actions secrets.
# Reads the value from the existing local env file — does NOT print it, does NOT commit it.
#
# Prereqs: `gh auth login` done; repo already created & pushed (see README final steps).
# Usage:
#   bash scripts/set-secrets.sh
#
# Override defaults via env if needed:
#   ENV_FILE=/path/to/.env.local REPO=owner/name bash scripts/set-secrets.sh

set -euo pipefail

ENV_FILE="${ENV_FILE:-/c/Users/САша/Desktop/lc-research-bot/.env.local}"
REPO="${REPO:-dolginov1973-ux/lifechange-crypto-publisher}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  echo "Set ENV_FILE=... to point at the file containing TELEGRAM_BOT_TOKEN." >&2
  exit 1
fi

# Extract the token value WITHOUT echoing it.
TOKEN="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | head -n1 | cut -d'=' -f2- | tr -d '\r\n')"

if [ -z "${TOKEN:-}" ]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN not found in $ENV_FILE" >&2
  exit 1
fi

echo "Setting TELEGRAM_BOT_TOKEN secret on $REPO (value hidden)..."
printf '%s' "$TOKEN" | gh secret set TELEGRAM_BOT_TOKEN --repo "$REPO" --body -
echo "Done. TELEGRAM_BOT_TOKEN is set."

# Optional community link:
if [ -n "${COMMUNITY_LINK:-}" ]; then
  echo "Setting COMMUNITY_LINK secret on $REPO..."
  printf '%s' "$COMMUNITY_LINK" | gh secret set COMMUNITY_LINK --repo "$REPO" --body -
  echo "Done. COMMUNITY_LINK is set."
else
  echo "COMMUNITY_LINK not provided (env var empty). Skipping — CTA community lines will be omitted until you set it."
  echo "To set later:  gh secret set COMMUNITY_LINK --repo $REPO   (then paste the link)"
fi
