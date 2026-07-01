# Display V2 vs V1: What Changed

## What Object Display is (unchanged across versions)

Object Display is Sui's **template engine for off-chain representation** of on-chain objects. It defines how objects appear in wallets, explorers, and marketplaces — without storing presentation data inside each object. A Display holds named template strings for a type `T`; templates use `{field_name}` syntax to reference struct fields, which Sui substitutes with actual values at query time.

The **standard properties** are the same in both versions:

| Property | Purpose |
|----------|---------|
| `name` | Object name shown to users |
| `description` | Human-readable description |
| `image_url` | Visual representation (URL or blob) |
| `link` | Application link |
| `thumbnail_url` | Smaller preview image |
| `project_url` | Associated website |
| `creator` | Creator attribution |

Everything else — how you *create* a Display, how it's *stored*, how indexers *find* it, and what the templates can *express* — changed in V2. This document is organized around those deltas.

---

## The differences at a glance

| Dimension | Display V1 (`sui::display`) | Display V2 (`sui::display_registry`) |
|-----------|-----------------------------|--------------------------------------|
| **Authorization** | `Publisher` object required | `Publisher` **or** `internal::Permit` (no Publisher needed) |
| **Where you create it** | Inside `init()` | Separate `entry` function (registry is shared, can't be received in `init`) |
| **Discovery / indexing** | Scan `DisplayCreated` / `VersionUpdated` event history | Deterministic derived-object lookup off `DisplayRegistry` at `0xd` |
| **Cardinality** | Any number of `Display<T>` per type | Exactly **one** per type, enforced |
| **Object model** | One owned `Display<T>` object | Shared `Display<T>` + owned `DisplayCap<T>` |
| **Type constraint** | `T: key` required | Any `T` (constraint relaxed) |
| **Versioning** | None | Versioned template language |
| **Field API** | Bulk `new_with_fields(keys, values)` + `update_version()` | Individual `set` / `unset` / `clear` |
| **Templating** | Top-level + nested `{field}` paths | + indexing, dynamic-field loads (`->`/`=>`/`~>`), transforms (`:json` etc.), fallbacks |
| **RPC** | JSON-RPC + GraphQL (both deprecating) | JSON-RPC + GraphQL + **gRPC** (gRPC is new in V2) |

The rest of the document walks each row, V1 on the left, V2 on the right — the first nine as numbered **Differences**, and the RPC row in the reference appendix.

---

## Why V2 exists

The V2 redesign was driven by four fundamental problems the Sui engineering team identified in V1. They map directly onto the differences below:

1. **Publisher dependency** — a package published without claiming `Publisher` in `init()` could *never* create a Display. → fixed by the `Permit` path.
2. **Multiple displays per type** — V1 allowed any number of `Display<T>`; the last event emitted by any of them won, creating ambiguity. → fixed by one-per-type enforcement.
3. **Event-based indexing** — discovery required scanning `DisplayCreated` / `VersionUpdated` event history, which didn't scale with Sui's move toward gRPC/GraphQL. → fixed by the registry.
4. **No versioning** — with a richer template engine coming, there was no way to version templates. → fixed by built-in versioning.

---

## Difference 1 — Authorization & creation

| | V1 | V2 |
|---|---|---|
| Proof of type ownership | `Publisher` object (mandatory) | `Publisher` **or** `internal::Permit` |
| Failure mode | No Publisher claimed in `init()` → Display impossible, forever | `Permit` proves ownership through the module system — no object required |

V1 had exactly one path. V2 has two, and the second removes the hard dependency:

```move
// V1 — Publisher is the only key
let display = display::new_with_fields<Hero>(&publisher, keys, values, ctx);
```

```move
// V2, path A — familiar Publisher pattern
let (display, cap) = display_registry::new_with_publisher<Hero>(registry, publisher, ctx);

// V2, path B — Permit path, no Publisher needed (illustrative)
let permit = internal::permit<MyType>();
let (display, cap) = registry.new(permit, ctx);
```

The `Permit` path removes the hard Publisher dependency: it proves type ownership through the module system, so a package that never claimed a `Publisher` can still get a Display. Note that `internal::Permit<T>` is an **internal capability**, not part of the stable public API — in practice most developers create displays via `new_with_publisher`. The path shown here is illustrative of *why* the Publisher dependency is gone, not the everyday API.

---

## Difference 2 — Where you create it

| | V1 | V2 |
|---|---|---|
| Location | Inside `init()` | A separate `entry` function |
| Reason | Publisher is created in `init()`, so Display could be too | `DisplayRegistry` is a **shared** object and cannot be received in `init()` |

This is a direct consequence of the registry being shared. `init()` runs at publish time with no access to shared objects, so Display creation must move to a later transaction that takes the registry as an argument. See the [full side-by-side code](#the-full-code-side-by-side) below.

---

## Difference 3 — Discovery & indexing

| | V1 | V2 |
|---|---|---|
| How indexers find the active Display | Scan historical `DisplayCreated` / `VersionUpdated` emissions | Deterministic derived-object lookup off `DisplayRegistry` at `0xd` |
| Scalability | Fragile; poor fit for gRPC/GraphQL | Simple query for a computable object ID on a known address |

V2 introduces `DisplayRegistry`, a **shared system object** living at the well-known address `0xd` (similar to how `Clock` lives at `0x6`). It is the derivation root for every type's Display:

```
DisplayRegistry (0xd)          ← singleton; its UID is the derivation root
   │
   │  Display<T> id = derive(DisplayRegistry.uid, DisplayKey<T>)
   ▼
Display<Hero>   ← derived object, ID computable offline
Display<Capy>   ← derived object
Display<NFT>    ← derived object
```

Each `Display<T>` is a **derived object** whose ID is computed deterministically from the registry's UID and a `DisplayKey<T>` marker (a `phantom`-typed struct). **Why this matters:** any client can compute a type's Display address *offline* and fetch it directly — no scanning event history, no special indexing, and no `update_version()` call to trigger discovery (see Difference 8).

---

## Difference 4 — Cardinality

| | V1 | V2 |
|---|---|---|
| Displays per type | Any number | Exactly **one**, enforced by the registry |
| Consequence | Ambiguous — "last event wins" across all Display objects | Unambiguous — the registry entry *is* the Display |

An on-chain analysis before migration found **no cases** of multiple Display objects per type in practice, confirming the design decision cost nothing real and removed a foot-gun.

---

## Difference 5 — Object model

| | V1 | V2 |
|---|---|---|
| Objects produced | One `Display<T>` | `Display<T>` **+** `DisplayCap<T>` |
| `Display<T>` ownership | Owned (transferred to creator) | **Shared** |
| Who can read fields | The owner | Anyone (it's shared) |
| Who can modify fields | The owner | Only the `DisplayCap<T>` holder |

| Object | Type | Ownership | Purpose |
|--------|------|-----------|---------|
| `Display<T>` | `display_registry::Display<T>` | **Shared** | Holds template fields. Indexers read from this. |
| `DisplayCap<T>` | `display_registry::DisplayCap<T>` | **Owned** (transferred to creator) | Authorizes field modifications. |

The read/write split is the point: the Display is publicly readable but cannot be accidentally transferred, frozen, or destroyed, and only the cap holder can mutate it. V1 conflated read and write authority into a single owned object.

---

## Difference 6 — Type constraint

| | V1 | V2 |
|---|---|---|
| Bound on `T` | `T: key` required | Any `T` |

V1 restricted Display to types with the `key` ability. V2 relaxes this — Display can now describe any type, not just top-level on-chain objects.

---

## Difference 7 — Versioning

| | V1 | V2 |
|---|---|---|
| Template-language versioning | None | Built-in |

V1 had no mechanism to evolve the template language. V2 versions it, which is what makes the richer templating in Difference 9 possible without breaking existing displays.

---

## Difference 8 — Field API

| | V1 | V2 |
|---|---|---|
| Setting fields | `add(k, v)` / `add_multiple` / `edit`, or bulk `new_with_fields(keys, values)` | Individual: `display.set(&cap, key, value)` |
| Removing fields | `display.remove(key)` | `display.unset(&cap, key)` / `display.clear(&cap)` |
| Triggering indexing | Manual `display.update_version()` | Automatic — registry handles it |
| Authorization for edits | Owns the Display | Holds the `DisplayCap<T>` |

```move
// V1 — bulk set, then manually bump the version to emit the indexing event
let mut display = display::new_with_fields<Hero>(&publisher, keys, values, ctx);
display.update_version();
```

```move
// V2 — set fields one at a time; no update_version() needed
display.set(&cap, b"name".to_string(), b"{name}".to_string());
display.unset(&cap, b"old_field".to_string()); // remove one
display.clear(&cap);                            // remove all
```

All V2 modifications require the `DisplayCap<T>` for authorization.

---

## Difference 9 — Templating: the engine changes

This is the headline capability upgrade. Both versions read top-level fields and nested dot paths; V1 stops there. V2 templates are full **format strings** — literal text mixed with `{...}` expressions — and each expression has the shape:

```
{ chain | alternate | ... : transform }
```

The `chain` walks the object; each `| alternate` is a fallback tried in order; the trailing `: transform` controls how the resolved value is rendered.

| Capability | V1 | V2 |
|-----------|----|----|
| Top-level `{field}` interpolation | ✅ | ✅ |
| Nested dot paths (`{inner.value}`, `{url.url.bytes}`) | ✅ | ✅ |
| Positional access (`{pos.0}`, `{tuple.0.1}`) | ❌ | ✅ |
| Vector / array indexing (typed index) | ❌ | ✅ `{items[0u64]}` |
| `VecMap` / set key lookup | ❌ | ✅ `{scores[6u32]}` |
| Dynamic field load | ❌ | ✅ `->` (`{parent->['key']}`, 1 load) |
| Dynamic object field load | ❌ | ✅ `=>` (`{parent=>['key'].x}`, 2 loads) |
| Derived object load | ❌ | ✅ `~>` (`{registry~>[$self]}`, 1 load) |
| `Option` auto-unwrap (`None` → null) | ❌ | ✅ |
| Enum variant-aware field access | ❌ | ✅ |
| Default / fallback values | ❌ | ✅ `{name \| 'Unknown'}` |
| Output transforms | ❌ | ✅ `:hex` `:base64` `:bcs` `:json` `:ts` `:url` |

**Roots.** `{name}` is implicit `$self` — i.e. `{name}` == `{$self.name}`; you can also write `$self` explicitly.

```jsonc
// V1 template — top-level + nested dot paths only
{
  "name": "{name}",
  "image_url": "https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blob_id}",
  "description": "{name} - A true Hero of the Sui ecosystem!"
}
```

```jsonc
// V2 template — indexing, loads, transforms, fallbacks
{
  "name": "{name}",                            // implicit $self root
  "power": "{stats.attack}",                   // nested dot path (also valid in V1)
  "top_item": "{items[0u64]}",                 // vector index — typed index required
  "score": "{scores[6u32]}",                   // VecMap lookup by key
  "rank": "{traits->['rank']}",                // dynamic field load (->), 1 object load
  "guild": "{registry~>[$self]}",              // derived object load (~>)
  "loadout": "{items:json}",                   // JSON transform
  "image_url": "{image | 'https://ex/default.png'}"  // fallback when the field is unset
}
```

**Transforms** (the `: transform` suffix): `:str` (default), `:hex`, `:base64(url,nopad)`, `:bcs`, `:json`, `:timestamp`/`:ts` (ISO-8601 from Unix ms), `:url` (percent-encode). As of `mainnet-v1.70.2` the engine implicitly applies `:json` to fields the default `:str` transform can't render.

**Limits.** A template is bounded by `max_depth` 32, `max_nodes` 32,768, and `max_loads` 8 (each `->` costs 1, `=>` costs 2). Exceeding them raises `TooDeep` / `TooBig` / `TooManyLoads`; a bad transform raises `TransformInvalid`. Design templates so a missing optional field degrades to `null`/fallback rather than nulling the whole string.

**No collection-level object type.** V2 has no dedicated "collection" type. The idiomatic pattern is to give the collection/registry object its own `Display<Collection>` and have each item's template cross-load shared metadata via `->` / `=>` / `~>`, instead of baking duplicated strings into every object (a common V1 gas hack).

---

## The full code, side by side

### V1 — everything in `init()`

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

### V2 — separate entry function

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

Reading top to bottom, every difference above shows up in this diff: `init()` shrinks to just the Publisher claim (Diff 2); creation moves into `create_display` taking the shared `registry` (Diff 2/3); the call returns `(Display, DisplayCap)` (Diff 5); fields are set individually (Diff 8); there's no `update_version()` (Diff 3/8); and the Display is **shared** while the cap is **transferred** (Diff 5).

---

## TypeScript / PTB

In V1, Display creation happened automatically inside `init()` at publish time, so there was typically no client-side Display code. In V2 you drive creation through a programmable transaction block (PTB):

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

// 2. Set fields individually (no bulk setter)
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

Key points, all echoing the differences above:
- `DisplayRegistry` is at the well-known address `0xd`
- `typeArguments` must match the exact type from your package
- Fields are set one at a time (Diff 8 — no bulk setter)
- Display must be shared, cap transferred (Diff 5)

---

## Reference appendix

These sections cover the *transition* mechanics between the two versions, not format differences.

### Migration

**Automatic system migration.** When Display V2 launched, all existing V1 Display objects on mainnet were **automatically migrated** via a system snapshot ("nothing broke for end users," per the Sui Foundation's 3 Apr 2026 blog). Most projects required no action. The pre-migration on-chain analysis found:

- No cases of multiple Display objects per type (confirming Diff 4)
- No on-chain Display dependencies (confirming backward compatibility is safe to drop)
- Some projects wrap Publisher + Display in manager objects

**Phased migration strategy:**

| Phase | Action |
|-------|--------|
| 1. System migration | Automatic snapshot converts all V1 displays to V2 |
| 2. Claim DisplayCap | Holders burn old V1 Display to claim V2 `DisplayCap` |
| 3. Disable V1 | `sui::display::new` becomes non-callable (July 31, 2026) |
| 4. Second sweep | Catches projects published between Phase 1 and Phase 3 |

**Claiming a `DisplayCap` for a migrated display:**
- **If you have the Publisher:** use it to claim a `DisplayCap` for the migrated V2 Display
- **If you have the old V1 Display:** burn it to claim the new `DisplayCap`

**For new packages:** just use `sui::display_registry` instead of `sui::display`. Nothing to migrate.

**Storage-model caveat:**
- **Frozen** V1 displays: auto-migrated by the system
- **Shared** V1 displays: these were vulnerable by design (anyone with `&mut Display<T>` could modify them). Migration handles them, but their previous exposure remains a consideration.

### RPC support

| Interface | V1 Display | V2 Display |
|-----------|-----------|-----------|
| JSON-RPC (`showDisplay`) | Supported until July 2026 deprecation | Supported (primary lookup) |
| GraphQL | Supported (deprecated after migration period) | Supported (primary) |
| gRPC | Not supported | **Supported** |

V2 is the primary lookup path for all new infrastructure; V1 support is maintained during the transition but will be removed.

### Timeline

| Date | Event |
|------|-------|
| 25 March 2026 | Display V2 ships in `mainnet-v1.68.1` (protocol v118, release #23710). `DisplayRegistry` created at `0xd`. |
| 25 March 2026 | System snapshot migrates all existing V1 displays automatically (announced in the 3 Apr 2026 blog). |
| July 2026 | JSON-RPC support deprecated (same timeline as the V1 sunset below). |
| **July 31, 2026** | **`sui::display::new` becomes non-callable.** V1 Display creation disabled. |
| Post-July 2026 | Second migration sweep for in-between projects. V1 GraphQL support deprecated. |

**What you need to do:**
- **New packages:** use `sui::display_registry` for all Display creation
- **Existing packages with owned V1 Display:** claim your `DisplayCap` via Publisher or by burning the old Display
- **Existing packages wrapping Display:** unwrap the Display so it can be exchanged for the new type. Do not wrap Display objects.

### Resources

- [Display V2: How Sui Objects Present Themselves to the World](https://blog.sui.io/display-v2-mainnet/) — launch blog post
- [Sui Object Display Documentation](https://docs.sui.io/standards/display) — official docs
- [Display Preview Editor](https://mystenlabs.github.io/display-preview) — interactive tool for constructing and previewing templates
- [PR #25242](https://github.com/MystenLabs/sui/pull/25242) — GraphQL integration and nested template support
- [The Move Book: Display](https://move-book.com/programmability/display) — Move Book reference
