#!/usr/bin/env bash
set -euo pipefail

# publish-devnet.sh — publish hero_forge to devnet and generate deployment.ts.
# Prerequisites: sui CLI with a devnet env and a funded active address, jq.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK=devnet

ACTIVE_ENV=$(sui client active-env 2>/dev/null || true)
if [ "${ACTIVE_ENV}" != "${NETWORK}" ]; then
    echo "Active env is '${ACTIVE_ENV}', expected '${NETWORK}'." >&2
    echo "Run: sui client switch --env ${NETWORK}" >&2
    exit 1
fi

source "${SCRIPT_DIR}/publish-common.sh"
