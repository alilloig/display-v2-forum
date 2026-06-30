# Display V2: The New Display Standard for Sui

## What is Object Display?

Object Display is Sui's **template engine for off-chain representation** of on-chain objects. It lets you define how objects appear in wallets, explorers, and marketplaces — without storing presentation data inside each object.

A `Display<T>` object holds named template strings for a type `T`. Templates use `{field_name}` syntax to reference struct fields, which Sui substitutes with actual values at query time.

> **Where resolution happens:** on-chain, a Display stores only the *template strings* (a `VecMap<String, String>`). The actual substitution — reading the object's fields and filling in the template — is done **off-chain** by the indexer / RPC / GraphQL layer, in **both V1 and V2**. That's why the "richer template engine" is fundamentally a client-side change, and why its behaviour (below) lives in the RPC response, not in the Move module.

**Standard properties:**

| Property | Purpose |
|----------|---------|
| `name` | Object name shown to users |
| `description` | Human-readable description |
| `image_url` | Visual representation (URL or blob) |
| `link` | Application link |
| `thumbnail_url` | Smaller preview image |
| `project_url` | Associated website |
| `creator` | Creator attribution |

**Example template:**
```json
{
  "name": "{name}",
  "image_url": "https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blob_id}",
  "description": "{name} - A true Hero of the Sui ecosystem!"
}
```

When a wallet queries a `Hero` object with `name: "Alice"` and `blob_id: "abc123"`, Sui resolves the templates into concrete values.

---

## Why V2?

The original Display (V1) had four fundamental problems identified by the Sui engineering team:

### 1. Publisher dependency

Display V1 requires a `Publisher` object to operate. If a package was published without claiming the Publisher in `init()`, developers could **never** create Display objects for their types.

### 2. Multiple displays per type

V1 allowed creating **any number** of `Display<T>` objects for the same type. This made no sense — which one should wallets use? The last event emitted by any Display object was treated as active, creating ambiguity.

### 3. Event-based indexing

Display V1 relied on event emissions (`DisplayCreated` on creation, `VersionUpdated` on a manual version bump) for indexers to discover the active Display for a type. The framework source itself says you'd find a display by *"looking for the first event with `Display<T>`."* This approach:
- Required scanning historical events to find the correct Display
- Didn't scale with Sui's evolution toward gRPC and GraphQL infrastructure
- Made indexing fragile and hard to maintain — and was even incomplete: in V1, field `add`/`edit`/`remove` do **not** bump the version or emit an event (a `TODO` in the source), so the event stream didn't fully reflect field changes

### 4. No versioning

With a V2 template engine on the way (supporting richer syntax), there was no mechanism to version Display templates or evolve the system.

---

## Design Goals

From the engineering design document, Display V2 aims to:

1. **Fix indexing** — replace event scanning with a deterministic registry lookup
2. **One per type** — enforce exactly one Display per type
3. **Use `internal::Permit`** — support type-based access without Publisher
4. **Add versioning** — support template language updates
5. **Snapshot migration** — migrate all existing displays automatically
6. **Relax type constraint** — remove the `T: key` requirement (any `T` works)
7. **Deprecate V1** — mark previous functions and Display type as deprecated

---

## Architecture

### DisplayRegistry — the central system object

Display V2 introduces `DisplayRegistry`, a **shared system object** living at the well-known address `0xd` (similar to how `Clock` lives at `0x6`).

```
DisplayRegistry (0xd)  ── id: UID
   └── derived_object::claim(&registry.id, DisplayKey<T>())
         → Display<Hero>   (address derived from registry UID + type)
         → Display<Capy>
         → Display<NFT>
```

Each `Display<T>` is a **derived object**: its address is computed deterministically from the registry's `UID` plus a `DisplayKey<T>` phantom key (`derived_object::claim`). Because the derivation is one-to-one with the type, there is exactly **one** `Display<T>` per type and its ID can be computed offline — no scanning required. (Earlier drafts described this as a `Bag` keyed by `TypeName`; the live mechanism is `derived_object`, not a `Bag`.)

**Why this matters for indexers:** Instead of scanning historical events, clients can compute the deterministic Display ID for any type and look it up directly on a known address (`0xd`). No special indexing required.

### Two objects per Display

V2 produces two objects instead of one:

| Object | Type | Ownership | Purpose |
|--------|------|-----------|---------|
| `Display<T>` | `display_registry::Display<T>` | **Shared** | Holds template fields. Indexers read from this. |
| `DisplayCap<T>` | `display_registry::DisplayCap<T>` | **Owned** (transferred to creator) | Authorizes field modifications. |

This separation means:
- Anyone can **read** Display fields (it's shared)
- Only the `DisplayCap` holder can **modify** fields
- The Display cannot be accidentally transferred, frozen, or destroyed

---

## V1 vs V2: Code Comparison

### Display V1 — everything in `init()`

```move
module display::hero;

use std::string::String;
use sui::display;
use sui::package;

public struct HERO has drop {}

public struct Hero has key, store {
    id: UID,
    name: String,
    blob_id: String,
}

fun init(otw: HERO, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);

    let keys = vector[
        b"name".to_string(),
        b"image_url".to_string(),
        b"description".to_string(),
    ];
    let values = vector[
        b"{name}".to_string(),
        b"https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blob_id}".to_string(),
        b"{name} - A true Hero of the Sui ecosystem!".to_string(),
    ];

    let mut display = display::new_with_fields<Hero>(
        &publisher, keys, values, ctx,
    );

    display.update_version();

    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(display, ctx.sender());
}
```

**Key characteristics:**
- Display created in `init()` alongside Publisher
- Bulk field setting via `new_with_fields(keys, values)`
- Must call `update_version()` to emit the indexing event
- Both Publisher and Display transferred as owned objects

### Display V2 — separate entry function

```move
module display::hero;

use std::string::String;
use sui::display_registry::{Self, DisplayRegistry};
use sui::package::{Self, Publisher};

public struct HERO has drop {}

public struct Hero has key, store {
    id: UID,
    name: String,
    blob_id: String,
}

fun init(otw: HERO, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    transfer::public_transfer(publisher, ctx.sender());
}

entry fun create_display(
    registry: &mut DisplayRegistry,
    publisher: &mut Publisher,
    ctx: &mut TxContext,
) {
    let (mut display, cap) = display_registry::new_with_publisher<Hero>(
        registry, publisher, ctx,
    );

    display.set(&cap, b"name".to_string(), b"{name}".to_string());
    display.set(
        &cap,
        b"image_url".to_string(),
        b"https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blob_id}".to_string(),
    );
    display.set(
        &cap,
        b"description".to_string(),
        b"{name} - A true Hero of the Sui ecosystem!".to_string(),
    );

    display.share();
    transfer::public_transfer(cap, ctx.sender());
}
```

**Key differences:**
- `init()` only claims Publisher — no Display creation
- Display created in a **separate entry function** because `DisplayRegistry` is a shared object (can't be received in `init()`)
- Returns a tuple: `(Display<T>, DisplayCap<T>)`
- Fields set individually with `display.set(&cap, key, value)`
- No `update_version()` needed — registry handles indexing
- Display is **shared**, DisplayCap is **transferred**

---

## V2 API Surface

### Creation

Two paths to create a Display:

**1. With Publisher (familiar pattern):**
```move
let (display, cap) = display_registry::new_with_publisher<Hero>(
    registry, publisher, ctx,
);
```

**2. With internal::Permit (no Publisher needed):**
```move
let permit = internal::permit<MyType>();
let (display, cap) = registry.new(permit, ctx);
```

The `Permit` pattern is an **alternative** creation path: it proves type ownership through the module system without requiring a `Publisher` object. (Both `new_with_publisher` and the `Permit`-based `new` exist in the framework source; the docs don't designate either as canonical, so pick the one that fits your package — use `new_with_publisher` if you already claim a `Publisher`.)

### Field management

```move
// Set a field (idempotent — adds or updates)
display.set(&cap, b"name".to_string(), b"{name}".to_string());

// Remove a specific field
display.unset(&cap, b"old_field".to_string());

// Clear all fields
display.clear(&cap);
```

All modifications require the `DisplayCap<T>` for authorization.

### Lifecycle

```move
// Share the Display (makes it readable by indexers)
display.share();

// Transfer the cap to retain modification rights
transfer::public_transfer(cap, ctx.sender());
```

---

## TypeScript SDK

Display V2 works through programmable transaction blocks (PTBs). Here's how to create a Display off-chain:

```typescript
import { Transaction } from "@mysten/sui/transactions";

const tx = new Transaction();

// 1. Create Display via the registry
let [display, cap] = tx.moveCall({
    target: '0x2::display_registry::new_with_publisher',
    arguments: [
        tx.object('0xd'), // DisplayRegistry (shared system object)
        tx.object(PUBLISHER_ID),
    ],
    typeArguments: [`${PACKAGE_ID}::hero::Hero`],
});

// 2. Set fields individually
const keys = ["name", "image_url", "description"];
const values = [
    "{name}",
    "https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blob_id}",
    "{name} - A true Hero of the Sui ecosystem!",
];

for (let i = 0; i < keys.length; i++) {
    tx.moveCall({
        target: '0x2::display_registry::set',
        arguments: [
            display,
            cap,
            tx.pure.string(keys[i]),
            tx.pure.string(values[i]),
        ],
        typeArguments: [`${PACKAGE_ID}::hero::Hero`],
    });
}

// 3. Share the Display, transfer the cap
tx.moveCall({
    target: '0x2::display_registry::share',
    arguments: [display],
    typeArguments: [`${PACKAGE_ID}::hero::Hero`],
});

tx.transferObjects([cap], tx.pure.address(MY_ADDRESS));
```

Key points:
- `DisplayRegistry` is at the well-known address `0xd`
- `typeArguments` must match the exact type from your package
- Fields are set one at a time (no bulk setter)
- Display must be shared, Cap transferred

---

## Migration

### Automatic system migration

When Display V2 launched, all existing V1 Display objects on mainnet were **automatically migrated** via a system snapshot ("Existing V1 displays were migrated to V2 in a system snapshot migration" — official docs). Most projects required no action. *(The specific count sometimes quoted as "~4,500" is not stated in the primary sources — treat the exact figure as unverified.)*

An on-chain analysis found:
- No cases of multiple Display objects per type (confirming the design decision)
- No on-chain Display dependencies (confirming backward compatibility is safe to drop)
- Some projects wrap Publisher + Display in manager objects

### Phased migration strategy

| Phase | Action |
|-------|--------|
| 1. System migration | Automatic snapshot converts all V1 displays to V2 |
| 2. Claim DisplayCap | Holders burn old V1 Display to claim V2 DisplayCap |
| 3. Disable V1 | `sui::display::new` becomes non-callable (July 31, 2026) |
| 4. Second sweep* | Catches projects published between Phase 1 and Phase 3 |

\* The "second sweep" is described in the design materials but not confirmed in the primary launch docs — treat as a stated plan rather than a documented guarantee.

### How to claim a DisplayCap for a migrated display

If your V1 Display was auto-migrated and you need to modify it:

- **If you have the Publisher:** Use it to claim a `DisplayCap` for the migrated V2 Display
- **If you have the old V1 Display:** Burn it to claim the new `DisplayCap`

### For new packages

Simply use `sui::display_registry` instead of `sui::display`. There's nothing to migrate.

### Storage model caveat

- **Frozen** V1 displays: auto-migrated by the system
- **Shared** V1 displays: these were vulnerable by design (anyone with `&mut Display<T>` could modify them). Migration handles them, but their previous exposure remains a consideration.

---

## RPC Support

| Interface | V1 Display | V2 Display |
|-----------|-----------|-----------|
| JSON-RPC (`showDisplay`) | Supported until Q2 2026 deprecation | Supported (primary lookup) |
| GraphQL | Supported (will be deprecated after migration period) | Supported (primary) |
| gRPC | Not supported | Supported |

V2 is the primary lookup path for all new infrastructure. V1 support is maintained during the transition but will be removed.

> **Verification note:** Only the **JSON-RPC** row is confirmed against a primary source — release notes PR #25360: when `showDisplay` is set, the RPC reads a `Display<T>` from the registry and *"takes precedence over any Display v1 formats."* The **GraphQL** and **gRPC** rows reflect the launch materials but the exact per-interface schema/behaviour was **not independently verified** here; treat them as directional.

---

## Timeline

| Date | Event |
|------|-------|
| April 2026 | Display V2 launches with Sui v1.68. `DisplayRegistry` system object created at `0xd`. |
| April 2026 | System snapshot migrates all ~4,500 V1 displays automatically. |
| Q2 2026 | JSON-RPC deprecated entirely. |
| **July 31, 2026** | **`sui::display::new` becomes non-callable.** V1 Display creation disabled. |
| Post-July 2026 | Second migration sweep for in-between projects. V1 GraphQL support deprecated. |

> **Dates are confirmed as *announced*, not as executed.** The v1.68.1 / protocol 118 launch (PR #23710 created the `0xd` system object) is confirmed in the release notes; the **July 31, 2026** `sui::display::new` cutoff is a forward-looking deprecation from the launch blog and could slip.

### What you need to do

- **New packages:** Use `sui::display_registry` for all Display creation
- **Existing packages with owned V1 Display:** Claim your `DisplayCap` via Publisher or by burning the old Display
- **Existing packages wrapping Display:** Unwrap the Display object so it can be exchanged for the new type. Do not wrap Display objects.

---

## Templates: what's V1, what's actually new in V2

> **Common misconception (corrected):** dotted-path access into **inlined nested structs** — `{stats.strength}`, `{a.b.c}` — is **not new in V2.** It already worked in V1. The Move Book documents the V1 syntax verbatim: *"the path is a dot-separated list of field names, starting from the root object in case of nested fields,"* with the V1 example `{metadata.description}`. What V2 genuinely adds is reaching **beyond the object** — following references / dynamic fields to *separate* objects, and traversing collections.

### Already in V1 — inlined nested-struct paths

A `store` struct embedded **by value** inside the object is reachable by a dot-path. This is a V1 capability that V2 keeps:

```
"{stats.strength}"          → field of an inlined nested struct
"{nested.l2.l3.deep}"       → multiple levels deep (verified ≥4 levels)
```

*Verified on localnet (Sui 1.x, `display_registry`): `{nested.l2.l3.deep}` resolves through four levels with no depth limit observed.*

### Genuinely new in V2 — reach beyond the object

Per the launch blog, V1 templates *"couldn't reference collections, dynamic fields, or related objects."* V2 can:

- **Dynamic fields & related objects** — load a dynamic field attached to the object, or follow a reference to a *separate* on-chain object and read its fields. *(This is the real "nested objects" feature. The exact template syntax for following a reference is not documented in the sources reviewed and was not reproduced empirically — confirm against the V2 template-syntax docs before relying on a specific form.)*

### Value transforms — `{field:transform}`

A field can be post-processed with a transform suffix. The **complete set** of valid transforms (observed directly from the resolver's own parser error) is:

```
base64 · bcs · hex · json · str · ts · url
```

`:json` is the most useful — it serializes a struct or collection that can't render as a bare scalar:

```
"{stats:json}"   → {"strength":"99","defense":"80"}   (struct → JSON; integers become JSON strings)
"{nums:json}"    → ["10","20","30"]                    (vector → JSON array)
```

> There is **no `:default` transform** — the earlier "default values" claim is unsupported. A template referencing a missing field resolves to `null` (see below), not a fallback string.

### How leaf values stringify (verified empirically)

| Field type | Renders as |
|---|---|
| `String` | the string |
| `u8` / `u64` / `u128` | decimal digits (`"7"`, full `u128` value) |
| `bool` | `"true"` / `"false"` |
| `address` / `{id}` (UID) | full `0x`-prefixed 64-hex |
| `vector<u8>` | decoded as a UTF-8/ASCII **string** (`[0x41,0x42,0x43]` → `"ABC"`) |
| `Option<T>::some(v)` | the inner value (`"99"`) |
| `vector<u64>` (non-`u8`) | **error** — not directly renderable; use `:json` |
| a bare struct (no `:json`) | **error** — not directly renderable; use `:json` |

`{vec[i]}` **index access is not supported** (parse error) — "collection traversal" is via `:json` on the whole collection, not element indexing, in this build.

### Missing fields vs invalid expressions (two distinct behaviours)

The V2 RPC returns a Display as `{ data, error }`:

- **Missing field** — `{does_not_exist}` or `{nested.nope}` → the key appears in `data` with value **`null`**.
- **Invalid expression** — an unrenderable type or bad syntax → the key is **omitted from `data` entirely**, and a message is appended to `display.error` (`{ code: "displayError", error: "<all failures, semicolon-joined>" }`).

This is exactly the `display.error` surface the showcase dapp renders, and it's what makes a typo'd template visible rather than silently blank.

---

## Resources

- [Display V2: How Sui Objects Present Themselves to the World](https://blog.sui.io/display-v2-mainnet/) — launch blog post
- [Sui Object Display Documentation](https://docs.sui.io/standards/display) — official docs
- [Display Preview Editor](https://mystenlabs.github.io/display-preview) — interactive tool for constructing and previewing templates
- [PR #25242](https://github.com/MystenLabs/sui/pull/25242) — GraphQL integration and nested template support
- [The Move Book: Display](https://move-book.com/programmability/display) — Move Book reference
