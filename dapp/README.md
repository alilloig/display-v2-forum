# Display V2 Showcase — dapp

An interactive showcase that proves the Display V2 thesis:

> An object's on-chain struct fields NEVER change.
> Only the Display template changes — and the resolved render updates accordingly.

---

## End-to-End Run Guide

### Prerequisites

- Sui CLI installed and on PATH.
- Node.js 20+ and pnpm 9+.
- Slush (or another wallet browser extension) configured with the localnet.

### Step 1 — Start the local Sui network

```bash
bash dapp/scripts/start-localnet.sh
```

Waits until the node is ready on `http://127.0.0.1:9000`.

### Step 2 — Publish the Move package and create the Display

```bash
bash dapp/scripts/publish.sh
```

This script:
- Builds and publishes the `display_showcase` Move package.
- Calls `create_display` to register `Display<Hero>` in the shared registry.
- Writes `dapp/frontend/src/deployment.ts` with the live object IDs.

The script is **idempotent** — running it a second time republishes from scratch and
overwrites `deployment.ts` with the new IDs.

### Step 3 — Install frontend dependencies and start the dev server

```bash
cd dapp/frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser.

### Slush wallet caveat

Slush defaults to Sui mainnet. To use it against localnet:

1. Open Slush settings → Networks → Add custom network.
2. Name: `localnet`, RPC URL: `http://127.0.0.1:9000`.
3. Switch to the `localnet` network before connecting.

---

## Running the E2E Gate (E-001)

```bash
bash dapp/scripts/e2e.sh
```

This headless script:
1. Runs `publish.sh` (idempotent re-publish).
2. Mints a Hero named "Aragorn" with known fields.
3. Sets `name`, `image_url`, and `description` templates on `Display<Hero>` via the `DisplayCap`.
4. Asserts the resolved `display.data` matches the expected rendered strings.
5. Asserts `content.fields` (raw struct data) is byte-for-byte unchanged.
6. Unsets the `description` template.
7. Asserts `description` is absent from `display.data`, while `content.fields` is still unchanged.

Exits 0 on full success (`E-001 PASS`), non-zero on any failure.

This proves the Display V2 thesis programmatically: object unchanged, template changed,
rendered output updated.

---

## E-002 Manual Browser Checklist

The following steps are best verified by a human in the browser (not automated).

### Setup

1. `bash dapp/scripts/start-localnet.sh` — localnet running.
2. `bash dapp/scripts/publish.sh` — package published, `deployment.ts` written.
3. `cd dapp/frontend && pnpm install && pnpm dev` — frontend on `http://localhost:5173`.

### Checklist

- [ ] **(1) Cap gate — wrong wallet.**
  Connect a wallet that does **NOT** own the `DisplayCap` (e.g. a fresh Slush
  account with no activity).
  Confirm the Display Editor section shows:
  > "Connect the deployer wallet (DisplayCap owner) to edit the Display."
  The slot table and Apply button must NOT be visible.

- [ ] **(2) Connect the deployer wallet.**
  Switch Slush to the wallet that ran `publish.sh` (the active `sui client` address
  at publish time — it received the `DisplayCap`).
  Confirm the Display Editor section now shows all 7 drop-target rows:
  `name`, `description`, `image_url`, `link`, `thumbnail_url`, `project_url`, `creator`.

- [ ] **(3) Mint a Hero.**
  Fill in the Mint a Hero form (any name, image URL, species, power, level).
  Click "Mint Hero" and approve the transaction in Slush.
  Confirm the new Hero appears in "My Heroes" with:
  - Left column: raw struct fields (name, image_url, species, power, level).
  - Right column: "No display fields set yet." (Display templates are empty at this point).

- [ ] **(4) Confirm Display Editor shows all 7 targets.**
  Verify the 7 droppable rows are present and the 5 token chips
  (`{name}`, `{image_url}`, `{species}`, `{power}`, `{level}`) are visible above.

- [ ] **(5) Build and apply Display templates.**
  - Drag `{name}` into the `name` slot. The slot's text input should show `{name}`.
  - Drag `{species}` into the `description` slot, then type
    ` with ` (literal), then drag `{power}` and ` power. Level ` and `{level}`.
    (Or just type directly: `{species} with {power} power. Level {level}`.)
  - Click **Apply**. Slush should prompt for ONE transaction (all set calls batched).
  - Approve. Confirm the status line shows "Applied! Digest: 0x…".

- [ ] **(6) Observe before→after in the Hero preview panel.**
  - Paste the Hero's object id into the "Hero object id" field in the editor.
  - Click Refresh.
  - Left column (Raw struct fields): unchanged — same values as at mint time.
  - Right column (Resolved display): now shows `name` and `description` rendered
    with the Hero's actual field values substituted.
  - This visually proves the core Display V2 thesis.
