# Display V2 — Forum Materials

Learning material and presentation slides for Sui's new Display standard (Display V2), built on the `DisplayRegistry` system object.

## Contents

### [Slide Deck](slides/display-v2.md)

A 5-minute lightning talk (~9 slides) covering:
- What Object Display is and why V2 was needed
- V1 vs V2 architecture and code comparison
- New API: `Display<T>` (shared) + `DisplayCap<T>` (owned)
- Migration path for existing projects (~4,500 auto-migrated)
- Timeline: V1 sunset July 31, 2026

Render with [Marp](https://marp.app/):

```bash
marp slides/display-v2.md --html
marp slides/display-v2.md --html --pdf
```

### [Learning Guide](learning/display-v2-guide.md)

Companion document with deeper coverage:
- Full V1 vs V2 code comparison (Move + TypeScript SDK)
- V2 API surface (`new_with_publisher`, `set`, `unset`, `clear`, `share`)
- `internal::Permit` vs `Publisher` creation paths
- Phased migration strategy and on-chain analysis
- Advanced templating: nested fields, JSON formatting, dynamic field references
- RPC support timeline (JSON-RPC, GraphQL, gRPC)

## References

- [Display V2 Blog Post](https://blog.sui.io/display-v2-mainnet/)
- [Sui Object Display Docs](https://docs.sui.io/standards/display)
- [Display Preview Editor](https://mystenlabs.github.io/display-preview)
- [PR #25242 — GraphQL + nested templates](https://github.com/MystenLabs/sui/pull/25242)
