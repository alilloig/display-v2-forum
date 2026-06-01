# Display V2 Metadata-Views Playground — Design

> Evolves the Display V2 showcase dapp (PR #1) into a guided **playground**:
> design an NFT's traits → one-click publish a bespoke contract → mint → drag/compose
> those fields into the Display and watch the rendered view change. The teaching
> goal is to show, end to end, **what an NFT "metadata view" is at its core**: a
> mutable template/projection over an object's immutable on-chain struct fields.

- **Date:** 2026-06-01
- **Base:** branch `feat/displayv2-showcase-dapp` (PR #1), Sui 1.69.2 localnet, SDK 2.0 (`@mysten/dapp-kit-react` 2.0.3, `@mysten/sui` 2.17.0), Vite + React 19 + TS.
- **Scope:** localnet-only, lesson-grade. No mainnet/testnet deploy, no auth beyond DisplayCap gating.

## Locked decisions (brainstorm, 2026-06-01)

1. **Trait realization = codegen + local publish bridge.** The UI designs a real bespoke Move struct; a tiny local Node bridge runs `sui move build` + `test-publish` and returns the new package id. Display reads the actual struct fields the user designed.
2. **Field types:** `string` (Move `String`), `u64`, `bool`, plus **nested groups** (a nested struct, to showcase V2 nested templating `{group.field}`).
3. **Signing model:** the bridge does build + `test-publish` + `create_display` (CLI identity), then **transfers the `DisplayCap` to the connected wallet address**. Mint and Display `set`/`unset` stay wallet-signed via dapp-kit. Cap-gating on the connected wallet is preserved.
4. **Flow:** a 4-step stepper playground (Design → Publish → Mint → Display playground).

## Teaching arc

Define the data schema → see it is immutable on-chain → define a *view* (Display template) over it → watch the rendered view change while the object's `content.fields` never change. Nested groups + multi-token/literal template composition demonstrate Display V2's template engine.

---

## 1. Flow (UI)

A single page with a 4-step stepper header and a persistent wallet `ConnectButton`:

1. **Design traits** — `TraitDesigner`: build the schema (NFT type name, flat fields, nested groups) with a live read-only "Generated Move" panel.
2. **Publish** — `PublishStep`: one click → `POST /publish` (bridge) with the schema + connected wallet address → shows compiler/publish status, the new package id, and the generated source. Requires a connected wallet (to receive the cap).
3. **Mint** — `MintHero` (schema-driven): inputs generated from the schema → wallet-signed `mint`.
4. **Display playground** — `DisplayEditor` (schema-driven): drag schema tokens (flat `{field}` + nested `{group.field}`) into the 7 standard Display props, compose literal text + multiple tokens per slot, Apply = one wallet-signed `set`/`unset` PTB via the cap, then show **raw `content.fields` (unchanged) vs resolved `display.data` (before → after)**.

The stepper allows navigating back. Steps 2–4 are gated on having a connected wallet; steps 3–4 are gated on a successful publish (deployment present in context).

## 2. Schema model + Trait designer (Step 1)

`dapp/frontend/src/schema.ts`:

```ts
export type FieldType = 'string' | 'u64' | 'bool';
export interface Field { name: string; type: FieldType; }
export interface Group { name: string; fields: Field[]; }   // → nested Move struct
export interface Schema { typeName: string; fields: Field[]; groups: Group[]; }
```

- `TraitDesigner.tsx`: add/remove flat fields (name + type dropdown), add/remove nested groups (group name + its fields), edit the NFT `typeName`. Sensible default schema preloaded (the committed sample: `Hero { name, image_url, species: string; power, level: u64 }`).
- **Validation** (instant in the UI for feedback; the bridge re-validates authoritatively):
  - field/group names match `^[a-z][a-z0-9_]*$` (snake_case Move idents), unique within their scope, not Move reserved words, not `id`.
  - `typeName` matches `^[A-Z][A-Za-z0-9]*$`.
  - ≥1 field total; group names distinct from field names.
- Live "Generated Move" code panel fetched from the bridge `POST /preview` (single codegen source of truth — see §3). Debounced.

## 3. Codegen + local bridge (Step 2)

`dapp/scripts/bridge.mjs` — **zero-dependency** Node built-in `http` server on **`:8787`**. Started via `pnpm bridge`; `pnpm play` runs the bridge and vite dev server together (via `concurrently`, the only new devDep, or a tiny inline spawner to stay zero-dep — implementer's choice, prefer no new dep). CORS: allow `http://localhost:5173`.

Endpoints:
- `GET /health` → `{ ok: true }`.
- `POST /preview` `{ schema }` → `{ source }` — runs codegen only, returns the generated `hero.move` text. Used by the designer's live preview.
- `POST /publish` `{ schema, ownerAddress }` → on success `{ packageId, displayId, displayCapId, publisherId, registryId, schema }`; on failure HTTP 400 `{ stage, error }` (e.g. `stage: "build"` with the compiler output).
  1. Validate `schema` (same rules as §2; reject on violation with 400).
  2. Codegen → write `dapp/move/sources/hero.move`.
  3. `sui move build --build-env testnet` — compile gate; on non-zero, return 400 with captured output.
  4. `rm -f` the pubfile; `sui client test-publish --build-env testnet --pubfile-path <move>/.localnet-publication.json --gas-budget … --json` → parse `packageId`, `publisherId`.
  5. `sui client ptb`/`call` `create_display` → parse `displayId`, `displayCapId`.
  6. `sui client transfer --to <ownerAddress> --object-id <displayCapId>` (cap → connected wallet).
  7. Write `dapp/frontend/src/deployment.ts` (for the CLI/E2E path) and return the JSON.

**Codegen rules** (module name stays `display_showcase::hero` so paths/scripts are stable):
- `#[allow(lint(self_transfer))] module display_showcase::hero;`
- `use std::string::String; use sui::display_registry::{Self, DisplayRegistry}; use sui::package::{Self, Publisher};`
- OTW: `public struct HERO has drop {}`.
- One `public struct <PascalGroup> has store, copy, drop { <fields> }` per nested group (PascalCase derived from the snake group name; copy/drop keep mint construction simple).
- `public struct <TypeName> has key, store { id: UID, <flat fields>, <group_name: PascalGroup> }`.
- `fun init(otw, ctx)` → `package::claim` → transfer Publisher to sender.
- `public fun mint(<flat params>, <one param per nested field>, ctx)` → construct nested structs, then the main struct, `public_transfer` to sender. Param order: flat fields (declaration order), then nested fields (group order, then field order). Type mapping: string→`String`, u64→`u64`, bool→`bool`.
- `public fun create_display(registry: &mut DisplayRegistry, publisher: &mut Publisher, ctx)` → `new_with_publisher` → `share` → transfer cap to sender (bridge transfers it onward in step 6).
- Idents are validated before codegen, so generated source cannot contain arbitrary text.

The committed `hero.move` is the **default sample**; the bridge overwrites it on publish. A **"Reset to sample"** UI action posts the default schema (and/or `git checkout` is documented). `dapp/move/.localnet-publication.json` and `deployment.ts` remain gitignored.

**Safety note:** the bridge executes the sui CLI against UI-generated Move source on the user's machine. Acceptable for a *local* teaching tool because (a) it binds localhost only, (b) every identifier and type is validated against a strict allowlist before codegen, so the generated module is structurally fixed. Documented in the README.

## 4. Schema-driven Mint + Display (Steps 3–4)

- **`DeploymentContext`** (`dapp/frontend/src/DeploymentContext.tsx`): React context holding `{ packageId, displayId, displayCapId, publisherId, registryId, schema } | null`, set by `PublishStep` from the `/publish` response. The app reads deployment from context, NOT the static `deployment.ts` import — so a fresh publish updates the live app with no reload. `deployment.ts` is retained only for the CLI/E2E path.
- **`MintHero.tsx`** (rewrite, schema-driven): render an input per schema field — string→text, u64→number with `step="1"` + integer guard, bool→checkbox, nested→a labeled group of inputs. Build the `mint` PTB with `tx.pure.string/u64/bool` args in the exact codegen param order. Wallet-signed via `useDAppKit().signAndExecuteTransaction`.
- **`DisplayEditor.tsx`** (adapt): token chips generated from the schema — flat `{field}` and nested `{group.field}`. The existing `@dnd-kit` board, 7 Display-prop slots, literal+multi-token composition, single `set`/`unset` PTB via the cap, cap-gating on the connected wallet, and the before→after resolved-render panel are kept; only the token source becomes schema-derived.
- **`MyHeroes.tsx`**: already generic (`content.fields` vs `display.data`, surfaces `display.error`) — point it at the package id from context; otherwise unchanged.

## 5. Architecture / components

```
dapp/
  scripts/
    bridge.mjs            # NEW — zero-dep http bridge: /health /preview /publish (codegen + sui CLI)
    publish.sh            # kept (CLI/E2E path, default sample schema)
    start-localnet.sh     # kept
    e2e.sh / e2e.mjs      # kept (default sample schema; CLI-path E-001)
  move/
    sources/hero.move     # default sample; regenerated by the bridge on publish
  frontend/src/
    schema.ts             # NEW — Schema types + ident validation + default sample schema
    DeploymentContext.tsx # NEW — runtime deployment + schema
    bridge.ts             # NEW — typed fetch client for the bridge (/preview, /publish, /health)
    components/
      TraitDesigner.tsx   # NEW — Step 1
      PublishStep.tsx     # NEW — Step 2
      MintHero.tsx        # REWRITE — schema-driven
      DisplayEditor.tsx   # ADAPT — schema-derived tokens
      MyHeroes.tsx        # minor (package id from context)
      Stepper.tsx         # NEW — step nav
    App.tsx               # REWRITE — stepper composition + DeploymentProvider
  README.md               # REWRITE — `pnpm play` flow, bridge, Slush caveat, wizard checklist
```

Data flow: TraitDesigner → Schema (state) → `/preview` (live Move) → PublishStep `/publish` → DeploymentContext → MintHero (mint PTB) / DisplayEditor (set/unset PTB) → on-chain → re-query (`showContent` + `showDisplay`) → raw-vs-resolved render.

## 6. Testing

- **Bridge codegen tests** (node test, run by the bridge or a `pnpm test:codegen`): feed several schemas (all flat types, multiple nested groups, edge idents) through codegen → assert `sui move build --build-env testnet` exits 0; assert invalid schemas are rejected by validation.
- **Frontend**: `tsc -b && vite build` exits 0 (typecheck + build gate, as in C2/C3).
- **Bridge smoke** (node): `POST /publish` a sample schema + a test address → assert response has a `packageId` and that the `DisplayCap` is owned by the given address (JSON-RPC `getObject`).
- **CLI E2E** (`e2e.sh`/`e2e.mjs`, unchanged): still proves the thesis on the default sample schema.
- **Manual wizard checklist** in the README (design → publish → mint → drag/compose → before→after).

## 7. Build phases (one spec, two-phase plan)

- **P1 — bridge + codegen + schema:** `schema.ts` (types + validation + sample), `bridge.mjs` (`/health`, `/preview`, `/publish` incl. codegen, build gate, test-publish, create_display, cap transfer, deployment.ts write), codegen tests, bridge smoke test. Gate: codegen tests pass; `POST /publish` a sample yields a working bespoke package with the cap on the given address.
- **P2 — 4-step UI:** `DeploymentContext`, `bridge.ts`, `Stepper`, `TraitDesigner` (+ live preview), `PublishStep`, schema-driven `MintHero`, schema-derived `DisplayEditor`, `MyHeroes` tweak, `App` rewrite, README. Gate: `tsc + vite build` green; manual wizard checklist passes against a running localnet + bridge.

## 7a. Feasibility risk to verify first (P1)

Flat `{field}` template resolution is **verified live** on this localnet (Sui 1.69.2):
setting `name`/`image_url`/`description` templates rendered correctly and `display.error`
was null. **Nested `{group.field}` resolution is NOT yet verified live.** Display V2's
nested templating is documented but post-cutoff; the first concrete P1 step must publish a
package with a nested group, set a `{group.field}` template, and confirm `display.data`
resolves it (and `display.error` is null). If nested templating does not resolve on the
pinned toolchain, fall back to **flat fields + bool/u64/string only** (drop the nested-group
type) and note it — the playground still teaches the core thesis. This check gates whether
the nested-group designer feature ships.

## 8. Out of scope

- Non-localnet networks; persistent multi-design management (one active design at a time; republish overwrites).
- Authentication beyond DisplayCap gating; production hardening of the bridge (it is a localhost dev tool).
- Vector/Map/address field types and dynamic-field traits (only string/u64/bool/nested-group this iteration).
- Generated per-design unit tests in Move (the `sui move build` compile gate + bridge smoke + CLI E2E cover correctness).
