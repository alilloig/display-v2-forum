// Typed client for the local publish bridge (dapp/scripts/bridge.mjs).
import type { Schema } from './schema';

const BRIDGE_URL = 'http://127.0.0.1:8787';

export interface Deployment {
  packageId: string;
  publisherId: string;
  displayId: string;
  displayCapId: string;
  registryId: string;
  schema: Schema;
}

/** True if the local bridge is up. Used to nudge the user to run `pnpm play`. */
export async function bridgeHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ask the bridge to generate + build + publish the schema, create the Display, and
 * transfer the DisplayCap to `ownerAddress`. Throws with the failing stage on error.
 */
export async function publishSchema(schema: Schema, ownerAddress: string): Promise<Deployment> {
  const res = await fetch(`${BRIDGE_URL}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schema, ownerAddress }),
  });
  const body = (await res.json()) as Deployment | { stage: string; error: string };
  if (!res.ok) {
    const e = body as { stage: string; error: string };
    throw new Error(`publish failed at "${e.stage}": ${e.error}`);
  }
  return body as Deployment;
}
