---
marp: true
paginate: true
footer: "Sui"
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* === BASE — DARK THEME (default) === */
section {
  background: #000000;
  color: #8B8B8B;
  font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 22px;
  font-weight: 400;
  line-height: 1.5;
  padding: 60px;
  width: 1280px;
  height: 720px;
  position: relative;
}

section h1 { color: #FFFFFF; font-size: 42px; font-weight: 700; line-height: 1.15; margin: 0 0 16px 0; letter-spacing: -0.02em; }
section h2 { color: #FFFFFF; font-size: 32px; font-weight: 600; line-height: 1.25; margin: 0 0 12px 0; }
section h3 { color: #FFFFFF; font-size: 24px; font-weight: 600; line-height: 1.3; margin: 0 0 8px 0; }
section h4 { color: #8B8B8B; font-size: 20px; font-weight: 500; line-height: 1.4; margin: 0 0 8px 0; }
section p { margin: 0 0 12px 0; }
section strong { color: #FFFFFF; font-weight: 600; }
section em { color: #4DA2FF; font-style: normal; }
section a { color: #4DA2FF; text-decoration: none; }
section code { background: #1A1A1A; color: #4DA2FF; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
section pre { background: #0A0A0A; border: 1px solid #3A3A3A; border-radius: 8px; padding: 20px; margin: 12px 0; }
section pre code { background: transparent; padding: 0; }
section ul, section ol { margin: 0 0 12px 0; padding-left: 24px; }
section li { margin-bottom: 6px; }
section li::marker { color: #4DA2FF; }
section blockquote { border-left: 3px solid #4DA2FF; padding-left: 16px; margin: 12px 0; color: #AAAAAA; }
section table { width: 100%; border-collapse: collapse; margin: 12px 0; }
section th { color: #FFFFFF; background: #000000; font-weight: 600; text-align: left; padding: 10px 16px; border-bottom: 2px solid #4DA2FF; }
section td { padding: 8px 16px; border-bottom: 1px solid #1A1A1A; background: #000000; }
section hr { border: none; border-top: 1px dashed #3A3A3A; margin: 24px 0; }

/* Pagination */
section::after { color: #FFFFFF; font-size: 12px; font-weight: 600; background: #4DA2FF; border-radius: 2px; padding: 2px 8px; }

/* Footer & Header */
section footer { color: #8B8B8B; font-size: 14px; position: absolute; bottom: 24px; left: 60px; }
section footer::before { content: ''; display: inline-block; width: 14px; height: 18px; background: url("data:image/svg+xml,%3Csvg width='300' height='384' viewBox='0 0 300 384' fill='none' xmlns='http://www.w3.org/2000/svg'%3E %3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M240.057 159.914C255.698 179.553 265.052 204.39 265.052 231.407C265.052 258.424 255.414 284.019 239.362 303.768L237.971 305.475L237.608 303.31C237.292 301.477 236.929 299.613 236.502 297.749C228.46 262.421 202.265 232.134 159.148 207.597C130.029 191.071 113.361 171.195 108.985 148.586C106.157 133.972 108.258 119.294 112.318 106.717C116.379 94.1569 122.414 83.6187 127.549 77.2831L144.328 56.7754C147.267 53.1731 152.781 53.1731 155.719 56.7754L240.073 159.914H240.057ZM266.584 139.422L154.155 1.96703C152.007-0.655678 147.993-0.655678 145.845 1.96703L33.4316 139.422L33.0683 139.881C12.3868 165.555 0 198.181 0 233.698C0 316.408 67.1635 383.461 150 383.461C232.837 383.461 300 316.408 300 233.698C300 198.181 287.613 165.555 266.932 139.896L266.568 139.438L266.584 139.422ZM60.3381 159.472L70.3866 147.164L70.6868 149.439C70.9237 151.24 71.2239 153.041 71.5715 154.858C78.0809 189.001 101.322 217.456 140.173 239.496C173.952 258.724 193.622 280.828 199.278 305.064C201.648 315.176 202.059 325.129 201.032 333.835L200.969 334.372L200.479 334.609C185.233 342.05 168.09 346.237 149.984 346.237C86.4546 346.237 34.9484 294.826 34.9484 231.391C34.9484 204.153 44.4439 179.142 60.3065 159.44L60.3381 159.472Z' fill='%234DA2FF'/%3E %3C/svg%3E") no-repeat center/contain; margin-right: 5px; vertical-align: middle; }
section header { color: #4DA2FF; font-size: 14px; font-weight: 500; position: absolute; top: 24px; right: 60px; }

/* === GRID SYSTEM === */
section .grid { display: grid; gap: 24px; width: 100%; height: auto; }
section .col { display: flex; flex-direction: column; border-top: 1px dashed #3A3A3A; padding-top: 16px; }
section .col h3 { margin-bottom: 8px; }
section .col p { font-size: 18px; margin: 0; }

/* Category label */
section .category { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #8B8B8B; font-family: 'Inter', monospace; margin-bottom: 8px; }
section .category::before { content: ''; display: inline-block; width: 8px; height: 8px; background: #4DA2FF; flex-shrink: 0; }

/* Stats */
section .stat { color: #FFFFFF; font-size: 48px; font-weight: 700; line-height: 1; margin-bottom: 4px; }
section .stat-label { color: #8B8B8B; font-size: 16px; }

/* Cards */
section .card { background: #0A0A0A; border: 1px solid #1A1A1A; border-radius: 8px; padding: 16px 20px; margin-bottom: 8px; }
section .card h4 { color: #FFFFFF; margin: 0 0 4px 0; }
section .card p { margin: 0; font-size: 16px; }

/* === LAYOUT: lead === */
section.lead { display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 80px; }
section.lead h1 { font-size: 64px; font-weight: 700; margin-bottom: 16px; letter-spacing: -0.03em; }
section.lead p { font-size: 24px; color: #8B8B8B; max-width: 70%; }

/* === COLUMN LAYOUTS === */
section.cols-4 .grid { grid-template-columns: repeat(4, 1fr); margin-top: 24px; }
section.cols-3 .grid { grid-template-columns: repeat(3, 1fr); margin-top: 24px; }
section.cols-2-center { text-align: center; }
section.cols-2-center h1 { text-align: center; width: 100%; }
section.cols-2-center .grid { grid-template-columns: repeat(2, 1fr); margin-top: 24px; text-align: left; }

/* === SPLIT/LIST LAYOUTS === */
section.split-right { display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; text-align: left; }
section.split-right h1, section.split-right p, section.split-right ul { max-width: 55%; }

/* Utility */
section .no-border { border-top: none !important; padding-top: 0 !important; }
section .accent { color: #4DA2FF; }
section .badge { display: inline-block; background: rgba(77,162,255,0.15); color: #4DA2FF; padding: 4px 12px; border-radius: 16px; font-size: 14px; font-weight: 500; }
</style>

<!-- _class: lead -->
<!-- _paginate: false -->

# Display V2

How Sui objects present themselves to wallets, explorers, and marketplaces — rebuilt from the ground up

---

# Display is how Sui objects present themselves to the world

A **template engine** for off-chain representation of on-chain objects.

Templates use `{field_name}` syntax — Sui substitutes actual values at query time.

```json
{
  "name": "{name}",
  "image_url": "https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blob_id}",
  "description": "{name} - A true Hero of the Sui ecosystem!"
}
```

No presentation data stored inside each object. One `Display<T>` defines rendering for **all** instances of type `T`.

---

<!-- _class: cols-3 -->

# V1's event-based design created three unsustainable problems

<div class="grid">
<div class="col">

<span class="category">INDEXING</span>

### Event scanning

Indexers had to scan historical `DisplayVersionUpdatedEvent` emissions to find the active Display. Fragile, didn't scale with gRPC/GraphQL.

</div>
<div class="col">

<span class="category">AMBIGUITY</span>

### Multiple per type

V1 allowed **any number** of Display objects for the same type. Which one should wallets use? The last event wins — ambiguous.

</div>
<div class="col">

<span class="category">LIMITATIONS</span>

### Limited templates

Only top-level scalar fields. No access to nested structs, collections, dynamic fields, or default values.

</div>
</div>

---

<!-- _class: cols-3 -->

# V2 replaces events with a deterministic registry at a fixed address

<div class="grid">
<div class="col">

<span class="category">REGISTRY</span>

### DisplayRegistry (0xd)

A shared system object — like `Clock` at `0x6`. Clients compute Display IDs deterministically. No event scanning.

</div>
<div class="col">

<span class="category">UNIQUENESS</span>

### One per type

Exactly one `Display<T>` enforced by the registry. No ambiguity — consistent rendering across all apps.

</div>
<div class="col">

<span class="category">TEMPLATES</span>

### Richer templates

Nested field access (`{bar.baz.val}`), collection traversal, dynamic field references, JSON formatting, default values.

</div>
</div>

---

<!-- _class: cols-2-center -->

# The code change is small — a separate entry function replaces init

<div class="grid">
<div class="col">

<span class="category">DISPLAY V1</span>

### Everything in init()

```move
fun init(otw: HERO, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    let keys = vector[b"name".to_string(), ...];
    let values = vector[b"{name}".to_string(), ...];

    let mut display =
        display::new_with_fields<Hero>(
            &publisher, keys, values, ctx,
        );
    display.update_version();

    transfer::public_transfer(publisher, ...);
    transfer::public_transfer(display, ...);
}
```

</div>
<div class="col">

<span class="category">DISPLAY V2</span>

### Separate entry function

```move
fun init(otw: HERO, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    transfer::public_transfer(publisher, ...);
}

entry fun create_display(
    registry: &mut DisplayRegistry,
    publisher: &mut Publisher,
    ctx: &mut TxContext,
) {
    let (mut display, cap) =
        display_registry::new_with_publisher<Hero>(
            registry, publisher, ctx,
        );
    display.set(&cap, b"name".to_string(),
        b"{name}".to_string());
    // ... more set() calls
    display.share();
    transfer::public_transfer(cap, ...);
}
```

</div>
</div>

---

# Display becomes shared and gets a capability guard

V2 produces **two objects** instead of one:

| Object | Ownership | Purpose |
|--------|-----------|---------|
| `Display<T>` | **Shared** | Holds template fields — indexers read from this |
| `DisplayCap<T>` | **Owned** | Authorizes modifications via `set()`, `unset()`, `clear()` |

**API pattern:**

```move
display.set(&cap, b"name".to_string(), b"{name}".to_string());   // set field
display.unset(&cap, b"old_field".to_string());                    // remove field
display.share();                                                   // finalize
transfer::public_transfer(cap, ctx.sender());                      // keep the cap
```

No more `update_version()` — the registry handles indexing automatically.

---

# All 4,500 existing displays were auto-migrated with zero disruption

A system snapshot converted every V1 Display on mainnet when V2 launched. **Most projects required no action.**

| Phase | What happens |
|-------|-------------|
| System migration | Automatic snapshot converts all V1 → V2 |
| Claim DisplayCap | Burn old V1 Display **or** use Publisher to claim cap |
| Disable V1 | `sui::display::new` becomes non-callable |
| Second sweep | Catches projects published between Phase 1 and Phase 3 |

**To modify a migrated display:** claim `DisplayCap<T>` via your Publisher, or burn the old V1 Display object.

**For new packages:** use `sui::display_registry` directly. Nothing to migrate.

---

# `sui::display::new` stops working July 31 — switch to display_registry now

| Date | Event |
|------|-------|
| **April 2026** | Display V2 live with Sui v1.68. Registry at `0xd`. Auto-migration complete. |
| **Q2 2026** | JSON-RPC deprecated entirely |
| **July 31, 2026** | **`sui::display::new` non-callable** — V1 creation disabled |
| **Post-July** | Second migration sweep. V1 GraphQL support deprecated. |

**What you need to do:**

- **New packages** — use `sui::display_registry` for all Display creation
- **Existing with owned V1 Display** — claim your `DisplayCap` via Publisher
- **Wrapping Display in a manager?** — unwrap it so it can be exchanged

---

<!-- _class: split-right -->

# Resources

- [Display V2 Blog Post](https://blog.sui.io/display-v2-mainnet/)
- [Object Display Docs](https://docs.sui.io/standards/display)
- [Display Preview Editor](https://mystenlabs.github.io/display-preview)
- [The Move Book: Display](https://move-book.com/programmability/display)
