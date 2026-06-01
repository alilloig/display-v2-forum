# Display V2 Metadata-Views Playground

An interactive, localnet-only playground for Sui's **Display V2** (`sui::display_registry`).
You **design** an NFT's traits, **publish** a bespoke contract with one click, **mint**, then
**drag/compose** those fields into the Display and watch the rendered "metadata view" change.

> The thesis it teaches: an object's on-chain struct fields never change. A **metadata view**
> (the Display template) is a *mutable projection* over those *immutable* fields.

## The 4 steps

1. **Design traits** — build the NFT's schema (flat `string`/`u64`/`bool` fields + nested
   groups), with a live preview of the generated Move struct.
2. **Publish** — one click. A local bridge generates the Move module, builds it,
   `test-publish`es it to localnet, creates the shared `Display`, and transfers the
   `DisplayCap` to your connected wallet.
3. **Mint** — a form generated from your schema; wallet-signed.
4. **Display playground** — drag your field tokens (flat `{field}` and nested `{group.field}`)
   into the 7 standard Display properties, compose literal text + tokens, **Apply** (one
   `set`/`unset` PTB via the cap), and watch the resolved render change **before → after**
   while the raw struct fields stay fixed.

## Prerequisites

- Sui CLI on PATH (built/tested with **1.69.2**).
- Node.js 20+ and pnpm.
- A wallet extension (Slush) with **localnet** added (see caveat below).

## Run it

```bash
# 1. Local Sui network (idempotent; skips if 9000 is already up)
bash dapp/scripts/start-localnet.sh

# 2. Install + run the bridge AND the dev server together
cd dapp/frontend
pnpm install
pnpm play          # starts the publish bridge (:8787) + Vite (:5173)
```

Open `http://localhost:5173`, connect Slush (on localnet), and walk the 4 steps. Each
"Publish" regenerates `dapp/move/sources/hero.move` from your design and republishes — no
manual CLI steps.

### The publish bridge

`pnpm play` runs `dapp/scripts/bridge.mjs`, a tiny **localhost-only** Node server. A browser
can't run the Sui CLI, so the bridge does the build + `test-publish` + `create_display` +
cap-transfer on `POST /publish`. It is a local dev tool: it binds `127.0.0.1` only, and every
identifier/type in your schema is validated against a strict allowlist before any Move is
generated (see `dapp/frontend/src/schema.js`), so the generated module is structurally fixed.

### Signing: Dev key (recommended for localnet) vs wallet

The header has a **Signer** toggle:

- **Dev key** (recommended for localnet) — a local Ed25519 keypair held in the browser,
  funded from the localnet faucet with one click. It signs `mint` / `set` / `unset` directly
  with no wallet popups, which makes the whole wizard hands-free (and automatable). Use this
  for local development and end-to-end testing.
- **Wallet** — a browser wallet via `ConnectButton`. Note: the hosted **Slush web/zkLogin
  wallet cannot sign localnet transactions** (it submits through its own mainnet/testnet
  backend). To use a real wallet on localnet you need one that supports a local keypair + a
  custom `http://127.0.0.1:9000` RPC. The wallet path is most useful when the dapp targets a
  public network.

Whichever signer is active when you Publish receives the `DisplayCap`, so it (and only it) can
edit the Display in step 4.

## CLI path + automated tests (no browser)

The Move package + scripts also work entirely from the CLI on the **default sample schema**:

```bash
bash dapp/scripts/publish.sh          # build + test-publish + create_display → deployment.ts
node --test dapp/scripts/codegen.test.mjs   # codegen → `sui move build` for many schemas
node dapp/scripts/bridge.smoke.mjs    # publish the default schema via the bridge, assert cap transfer
bash dapp/scripts/e2e.sh              # E-001: prove object-unchanged / template-changed / render-updated
```

`e2e.sh` exits `E-001 PASS` on success. It mints a Hero, sets `name`/`image_url`/`description`
templates, asserts the resolved `display.data` matches the expected rendered strings and that
`content.fields` is byte-for-byte unchanged, then unsets `description` and re-asserts.

## Manual playground checklist (browser + wallet)

With `start-localnet.sh` + `pnpm play` running. Pick a **Signer** in the header first —
**Dev key** (click "Fund from faucet") gives a popup-free run; **Wallet** needs a
localnet-capable wallet (see the signing note above). Then:

- [ ] **Step 1 — Design.** Add/edit fields, add a nested group (e.g. `stats` with
      `strength: u64`, `defense: u64`). The "Generated Move" panel updates live and the
      schema validates (errors shown inline for bad names).
- [ ] **Step 2 — Publish.** Connect Slush first. Click **Publish contract**; on success the
      package/Display/cap ids appear and you advance to Mint. (If the bridge is down you'll be
      told to run `pnpm play`.)
- [ ] **Step 3 — Mint.** The form shows one input per designed field (incl. nested as
      `group.field`); decimals are rejected for `u64`. Approve in Slush; the new object appears
      in "My …s" with raw fields on the left and "No display fields set yet" on the right.
- [ ] **Step 4 — Display.** The editor is visible only to the cap-owning wallet. Drag tokens
      (incl. `{stats.strength}`) into the 7 props, compose a string like
      `STR {stats.strength} / DEF {stats.defense}`, **Apply** (one Slush prompt). Paste a minted
      object id into the Before→After panel and Refresh: the **raw struct fields are unchanged**
      while the **resolved display** goes from before → after. That's the metadata-view thesis.

## Notes

- `frontend/src/deployment.ts` (CLI path) and `move/.localnet-publication.json` are generated
  and gitignored. The frontend itself reads live ids from React context (the publish response),
  not `deployment.ts`.
- `--force-regenesis` (in `start-localnet.sh`) wipes chain state on each fresh start —
  re-publish afterward. The committed `hero.move` is the default sample; the bridge regenerates
  it per design (use step 1's "Reset to sample" to restore the default schema).
