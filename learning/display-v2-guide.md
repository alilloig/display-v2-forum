# Display V2: The New Display Standard for Sui

## What is Object Display?

Object Display is Sui's **template engine for off-chain representation** of on-chain objects. It lets you define how objects appear in wallets, explorers, and marketplaces — without storing presentation data inside each object.

A `Display<T>` object holds named template strings for a type `T`. Templates use `{field_name}` syntax to reference struct fields, which Sui substitutes with actual values at query time.

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

Display V1 relied on `DisplayVersionUpdatedEvent` emissions for indexers to discover the active Display for a type. This approach:
- Required scanning historical events to find the correct Display
- Didn't scale with Sui's evolution toward gRPC and GraphQL infrastructure
- Made indexing fragile and hard to maintain

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
DisplayRegistry (0xd)
├── data: Bag
│   ├── TypeName<Hero>    → Display<Hero> fields
│   ├── TypeName<Capy>    → Display<Capy> fields
│   └── TypeName<NFT>     → Display<NFT> fields
```

The registry uses a `Bag` for storage, which allows the data format (both keys and values) to evolve in the future. Display data is stored as dynamic fields keyed by type name.

**Why this matters for indexers:** Instead of scanning historical events, clients can compute the deterministic Display ID for any type by looking it up in the live object set — a simple dynamic field query on a known address. No special indexing required.

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

The `Permit` pattern is the preferred long-term approach — it proves type ownership through the module system without requiring a Publisher object.

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

When Display V2 launched, all ~4,500 existing V1 Display objects on mainnet were **automatically migrated** via a system snapshot. Most projects required no action.

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
| 4. Second sweep | Catches projects published between Phase 1 and Phase 3 |

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

---

## Timeline

| Date | Event |
|------|-------|
| April 2026 | Display V2 launches with Sui v1.68. `DisplayRegistry` system object created at `0xd`. |
| April 2026 | System snapshot migrates all ~4,500 V1 displays automatically. |
| Q2 2026 | JSON-RPC deprecated entirely. |
| **July 31, 2026** | **`sui::display::new` becomes non-callable.** V1 Display creation disabled. |
| Post-July 2026 | Second migration sweep for in-between projects. V1 GraphQL support deprecated. |

### What you need to do

- **New packages:** Use `sui::display_registry` for all Display creation
- **Existing packages with owned V1 Display:** Claim your `DisplayCap` via Publisher or by burning the old Display
- **Existing packages wrapping Display:** Unwrap the Display object so it can be exchanged for the new type. Do not wrap Display objects.

---

## Advanced: Richer Templates

V2's template engine supports capabilities beyond simple field interpolation:

### Nested field access

```
"{bar.val}"           → access a field on a nested struct
"{bar.baz.val}"       → access multiple levels deep
"{bar.baz.qux.quy.val}" → arbitrary nesting depth
```

### JSON formatting

```
"{bar.baz.qux:json}"  → serialize the value as JSON
```

### Collection traversal

Access individual elements within vectors, sets, and maps — no longer limited to top-level scalar fields.

### Dynamic field references

Load dynamic fields and related on-chain objects for complex display descriptions.

### Default values

Provide fallback content when fields are missing or unset, so displays degrade gracefully.

---

## Resources

- [Display V2: How Sui Objects Present Themselves to the World](https://blog.sui.io/display-v2-mainnet/) — launch blog post
- [Sui Object Display Documentation](https://docs.sui.io/standards/display) — official docs
- [Display Preview Editor](https://mystenlabs.github.io/display-preview) — interactive tool for constructing and previewing templates
- [PR #25242](https://github.com/MystenLabs/sui/pull/25242) — GraphQL integration and nested template support
- [The Move Book: Display](https://move-book.com/programmability/display) — Move Book reference
