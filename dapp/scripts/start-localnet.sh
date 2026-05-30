#!/usr/bin/env bash
set -euo pipefail

# start-localnet.sh — bring up a local Sui network (idempotent).
# If port 9000 is already accepting connections, exit without restarting.

if curl -s --connect-timeout 2 http://127.0.0.1:9000 > /dev/null 2>&1; then
    echo "Localnet already running on 127.0.0.1:9000 — nothing to do."
    exit 0
fi

echo "Starting Sui localnet..."
# --force-regenesis wipes ALL prior chain state on every fresh start. After a
# restart, your published package + minted Heroes are gone — re-run publish.sh
# (which regenerates deployment.ts) before using the frontend again.
sui start --with-faucet --force-regenesis
