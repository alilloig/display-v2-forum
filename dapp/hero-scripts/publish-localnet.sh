#!/usr/bin/env bash
set -euo pipefail

# publish-localnet.sh — publish hero_forge to a local validator and generate
# deployment.ts. Prerequisites: sui CLI, jq, localnet running on 127.0.0.1:9000.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK=localnet

LOCALNET_RPC="http://127.0.0.1:9000"
FAUCET_URL="http://127.0.0.1:9123/gas"

ACTIVE_ENV=$(sui client active-env 2>/dev/null || true)
if [ "${ACTIVE_ENV}" != "${NETWORK}" ]; then
    echo "Switching to localnet environment..."
    sui client new-env --alias localnet --rpc "${LOCALNET_RPC}" 2>/dev/null || true
    sui client switch --env localnet
fi

# Localnet addresses start empty — top up from the local faucet.
ACTIVE_ADDR=$(sui client active-address)
curl -s -X POST "${FAUCET_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"FixedAmountRequest\":{\"recipient\":\"${ACTIVE_ADDR}\"}}" \
    | jq -r '.transferredGasObjects[0].id // "faucet responded (check balance)"'

source "${SCRIPT_DIR}/publish-common.sh"
