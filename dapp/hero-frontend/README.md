# Hero Forge — Display V2 × Dynamic Object Fields

A second, sibling dapp to the Metadata-Views Playground. Where the playground teaches
"a Display template is a mutable projection over immutable fields" with a generic schema
designer, **Hero Forge** teaches the same idea through a game narrative and showcases the
headline V2 capability the playground doesn't: **Display templates that load data live
from dynamic object fields (DOFs) attached to an object.**

## The idea

1. **Mint a Hero** — `base_attack` / `base_defense` are fixed at mint and *never* mutated.
2. **Forge & equip** up to one **Sword**, **Shield**, **Armor**. Each is its own object,
   attached to the Hero as a **dynamic object field** (`sword` / `shield` / `armor` keys).
3. The Hero's `Display<Hero>` template — set **once** at deploy — has an `inventory` field:

   ```
   {$self=>['sword'].summary | ''}{$self=>['shield'].summary | ''}{$self=>['armor'].summary | ''}
   ```

   The `=>` operator loads each attached DOF child (2 loads each; 6 total, within the
   8-load budget) and projects its `summary`. Equip an item and the resolved Display
   changes — **the Hero object is never touched.** That is the whole point.

The effective Attack/Defense total is summed **client-side** (Display templates can't do
arithmetic); the on-chain-verifiable part is the live `inventory` projection.

## The nine differences

The bottom panel narrates all nine canonical Display V1→V2 differences (source:
`learning/display-v2-guide.md`) across a 9-step app cycle (connect → mint → equip ×3 →
unequip ×3); at each step only the cards that step demonstrates are shown. See
`src/lessons.ts` for the phase → differences mapping.

> **Transport note:** the guide says JSON-RPC can't resolve load operators — but on
> `sui 1.69.2` localnet, `showDisplay` **does** resolve `=>`, so this dapp's live
> projection works over plain JSON-RPC today. gRPC / GraphQL are still the recommended
> SDK 2.0 clients (JSON-RPC is deprecated), which is how the transport lesson is framed.

## Run it (devnet)

```bash
# 1. Point the sui CLI at devnet with a funded active address, then publish the
#    hero_forge package + create the 4 Displays, writing src/deployment.ts:
cd dapp/hero-frontend
pnpm install
pnpm publish:devnet

# 2. Dev server (port 5175):
pnpm dev
```

Open `http://localhost:5175` and connect a Sui wallet set to devnet (fund it from the
devnet faucet: `sui client faucet --address <addr>`). Signing is wallet-only. Mint a
Hero, then forge items and watch the Display projection and composite sprite update.

For offline development, `pnpm publish:localnet` runs the same flow against a local
validator; the frontend follows whichever network `deployment.ts` records (the gRPC
client config in `src/dapp-kit.ts` derives from it).

## Layout

| Path | What |
|---|---|
| `../hero-move/` | The fixed `hero_forge::hero` Move package (Hero + item structs, equip/unequip via DOFs, `create_displays`). |
| `../hero-scripts/publish-common.sh` | Shared publish core: build + `test-publish` + `create_displays` + write `src/deployment.ts`. |
| `../hero-scripts/publish-devnet.sh` / `publish-localnet.sh` | Thin per-network wrappers around the common core. |
| `src/chain.ts` | Reads the owned Hero (content + resolved Display + attached DOFs) via the Core API, builds mint/equip/unequip PTBs, and normalizes wallet signing. |
| `src/items.ts` | The fixed catalog (stats + `summary` strings that the Display projects). |
| `src/sprites.ts` | Deterministic equipped-set → composite sprite (8 pre-rendered PNGs in `public/sprites/`). |
| `src/lessons.ts` | The 9 V1→V2 differences + transport note, the 9-step cycle mapping, and `deriveCycle`. |
| `src/components/` | `HeroStage`, `Armory`, `LessonPanel`. |

## Testnet

The definitive contracts will live on testnet. When that lands: publish with
`sui client publish` (persistent deployments are recorded in `Published.toml`, unlike
the ephemeral devnet/localnet `test-publish` flow), add a `publish-testnet.sh` wrapper,
and host the sprites on Walrus. The frontend needs no code change — `deployment.ts`
drives the network.
