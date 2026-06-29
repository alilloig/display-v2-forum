// Bridge smoke test (needs a running localnet): start the bridge, POST /publish the
// default schema to a known address, assert a package was published and the DisplayCap
// landed on that address. Exits non-zero on failure.
//
// Run: node dapp/scripts/bridge.smoke.mjs

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SCHEMA } from '../frontend/src/schema.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, 'bridge.mjs');
const BASE = 'http://127.0.0.1:8787';
const RPC = 'http://127.0.0.1:9000';
const OWNER = '0xfa48ce61314393474915fa05cb757810a6b8aab1c3c11b4b1d265b4cdccd9bed';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHealth(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('bridge did not become healthy');
}

async function ownerOf(id) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sui_getObject', params: [id, { showOwner: true }] }),
  }).then((x) => x.json());
  return r.result?.data?.owner?.AddressOwner;
}

const bridge = spawn('node', [BRIDGE], { stdio: 'inherit' });
let code = 1;
try {
  await waitHealth();
  const res = await fetch(`${BASE}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schema: DEFAULT_SCHEMA, ownerAddress: OWNER }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`publish failed [${body.stage}]: ${body.error}`);
  if (!body.packageId) throw new Error('no packageId in response');
  if (!body.displayCapId) throw new Error('no displayCapId in response');

  const owner = await ownerOf(body.displayCapId);
  if (owner !== OWNER) throw new Error(`cap owner ${owner} !== expected ${OWNER}`);

  console.log(`SMOKE PASS — package ${body.packageId}; DisplayCap ${body.displayCapId} owned by ${OWNER}`);
  code = 0;
} catch (e) {
  console.error('SMOKE FAIL —', e.message);
} finally {
  bridge.kill('SIGTERM');
  await sleep(200);
  process.exit(code);
}
