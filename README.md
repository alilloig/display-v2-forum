# Display V2 — Forum Materials

Learning material, presentation slides, and a showcase dapp for Sui's new Display standard (Display V2), built on the `DisplayRegistry` system object at `0xd`.

## Contents

### [Hero Forge Dapp](dapp/)

A devnet dapp that teaches Display V2 through a game narrative: mint a Hero whose struct fields never change, forge and equip Sword/Shield/Armor items as **dynamic object fields**, and watch the Hero's Display projection update live via the V2 `=>` load operator — without ever touching the Hero object.

- `dapp/hero-move/` — the `hero_forge::hero` Move package (Hero + items, DOF equip/unequip, `create_displays`)
- `dapp/hero-frontend/` — React + Vite frontend on SDK 2.0 (`@mysten/dapp-kit-react`, gRPC-only)
- `dapp/hero-scripts/` — devnet publish script (package + 4 Displays in one PTB)

A built-in code lab shows the snippets for all nine canonical V1→V2 differences, keyed to the app's current state. **Live at [alilloig.github.io/display-v2-forum](https://alilloig.github.io/display-v2-forum/)** — see [`dapp/README.md`](dapp/README.md) to deploy and run locally.

### [Slide Deck](<slides/Display v2 Forum.html>)

A 5-minute lightning talk as a single self-contained HTML file — open it directly in a browser. Covers:
- What Object Display is and why V2 was needed
- V1 vs V2 architecture and code comparison
- New API: `Display<T>` (shared) + `DisplayCap<T>` (owned)
- Migration path for existing projects (~4,500 auto-migrated)
- Timeline: V1 sunset July 31, 2026

### [Learning Guide](learning/display-v2-guide.md)

A V1→V2 differences narrative with deeper coverage:
- The nine differences at a glance (authorization, creation, discovery, cardinality, …)
- Full V1 vs V2 code comparison (Move + TypeScript SDK)
- V2 API surface (`new_with_publisher`, `set`, `unset`, `clear`, `share`)
- `internal::Permit` vs `Publisher` creation paths
- Phased migration strategy and on-chain analysis
- Advanced templating: nested fields, JSON formatting, dynamic field references
- RPC support timeline (JSON-RPC, GraphQL, gRPC)

A fact-check report against source code and live networks accompanies it: [`learning/display-v2-guide-factcheck.html`](learning/display-v2-guide-factcheck.html).

## References

- [Display V2 Blog Post](https://blog.sui.io/display-v2-mainnet/)
- [Sui Object Display Docs](https://docs.sui.io/standards/display)
- [Display Preview Editor](https://mystenlabs.github.io/display-preview)
- [PR #25242 — GraphQL + nested templates](https://github.com/MystenLabs/sui/pull/25242)
