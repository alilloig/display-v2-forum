#!/usr/bin/env bash
set -euo pipefail

# e2e.sh — authoritative localnet E2E for Display V2 (E-001).
#
# The teaching thesis, proven end-to-end against a live local Sui network:
#   the on-chain Hero object NEVER changes; only the Display<Hero> template
#   changes, and the off-chain RESOLVED render updates accordingly.
#
# Flow (assumes localnet is already up on 127.0.0.1:9000):
#   1. Run publish.sh (idempotent) — republish, create_display, write deployment.ts.
#   2. Source PACKAGE_ID / DISPLAY_ID / DISPLAY_CAP_ID from deployment.ts.
#   3. Mint a Hero "Aragorn" with known fields; capture its object id.
#   4. set name / image_url / description templates on the shared Display via the cap.
#   5. node e2e.mjs <HERO_ID> set    — assert rendered display + raw fields.
#   6. unset the description template.
#   7. node e2e.mjs <HERO_ID> unset  — assert description vanished, raw fields unchanged.
#
# Exits non-zero on ANY failure (set -e covers the sui calls; e2e.mjs exit
# codes are propagated explicitly).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOYMENT_TS="${REPO_ROOT}/dapp/frontend/src/deployment.ts"

GAS_BUDGET=50000000

# ── 1. Publish (idempotent) ──────────────────────────────────────────────────
echo "=========================================================="
echo "[1/7] Publishing package + create_display (publish.sh)..."
echo "=========================================================="
bash "${REPO_ROOT}/dapp/scripts/publish.sh"

# ── 2. Source the ids written by publish.sh ──────────────────────────────────
echo ""
echo "=========================================================="
echo "[2/7] Sourcing identifiers from deployment.ts..."
echo "=========================================================="
# deployment.ts lines look like:  export const PACKAGE_ID = "0x..";
# Pull the quoted value for each id we need.
parse_id() {
  # $1 = export const name
  grep -E "export const $1 = " "${DEPLOYMENT_TS}" | sed -E 's/.*"([^"]+)".*/\1/'
}
PACKAGE_ID="$(parse_id PACKAGE_ID)"
DISPLAY_ID="$(parse_id DISPLAY_ID)"
DISPLAY_CAP_ID="$(parse_id DISPLAY_CAP_ID)"
HERO_TYPE="${PACKAGE_ID}::hero::Hero"

echo "PACKAGE_ID:     ${PACKAGE_ID}"
echo "DISPLAY_ID:     ${DISPLAY_ID}"
echo "DISPLAY_CAP_ID: ${DISPLAY_CAP_ID}"
echo "HERO_TYPE:      ${HERO_TYPE}"

# ── 3. Mint a Hero with known fields ─────────────────────────────────────────
echo ""
echo "=========================================================="
echo "[3/7] Minting Hero \"Aragorn\"..."
echo "=========================================================="
MINT_OUTPUT=$(sui client call \
  --package "${PACKAGE_ID}" --module hero --function mint \
  --args "Aragorn" "https://example.com/aragorn.png" "Human" 95 12 \
  --gas-budget "${GAS_BUDGET}" --json)

# The Hero is the created object whose objectType ends in ::hero::Hero.
HERO_ID=$(echo "${MINT_OUTPUT}" | \
  jq -r '.objectChanges[] | select(.type == "created" and (.objectType | endswith("::hero::Hero"))) | .objectId')

if [ -z "${HERO_ID}" ] || [ "${HERO_ID}" = "null" ]; then
  echo "FAIL: could not capture minted Hero object id"
  exit 1
fi
echo "HERO_ID: ${HERO_ID}"

# ── 4. set name / image_url / description templates via the DisplayCap ───────
echo ""
echo "=========================================================="
echo "[4/7] Setting Display templates (name, image_url, description)..."
echo "=========================================================="
set_field() {
  # $1 = field key   $2 = template value
  echo "  set ${1} = ${2}"
  sui client call \
    --package 0x2 --module display_registry --function set \
    --type-args "${HERO_TYPE}" \
    --args "${DISPLAY_ID}" "${DISPLAY_CAP_ID}" "$1" "$2" \
    --gas-budget "${GAS_BUDGET}" --json > /dev/null
}
set_field "name" "{name}"
set_field "image_url" "{image_url}"
set_field "description" "A level {level} {species} with {power} power."

# ── 5. Assert the rendered display + raw fields (phase: set) ─────────────────
echo ""
echo "=========================================================="
echo "[5/7] Asserting resolved display + raw fields (phase: set)..."
echo "=========================================================="
node "${SCRIPT_DIR}/e2e.mjs" "${HERO_ID}" set
echo "PASS: set-phase assertions"

# ── 6. unset the description template via the DisplayCap ─────────────────────
echo ""
echo "=========================================================="
echo "[6/7] Unsetting the 'description' Display template..."
echo "=========================================================="
sui client call \
  --package 0x2 --module display_registry --function unset \
  --type-args "${HERO_TYPE}" \
  --args "${DISPLAY_ID}" "${DISPLAY_CAP_ID}" "description" \
  --gas-budget "${GAS_BUDGET}" --json > /dev/null

# ── 7. Assert description vanished, raw fields unchanged (phase: unset) ───────
echo ""
echo "=========================================================="
echo "[7/7] Asserting description gone + raw fields unchanged (phase: unset)..."
echo "=========================================================="
node "${SCRIPT_DIR}/e2e.mjs" "${HERO_ID}" unset
echo "PASS: unset-phase assertions"

echo ""
echo "=========================================================="
echo "E-001 PASS — display render changed; Hero object unchanged."
echo "=========================================================="
