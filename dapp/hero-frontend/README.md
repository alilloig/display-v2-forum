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
`learning/display-v2-guide.md`), highlighting the one each step demonstrates. See
`src/lessons.ts`.

> **Transport note:** the guide says JSON-RPC can't resolve load operators — but on
> `sui 1.69.2` localnet, `showDisplay` **does** resolve `=>`, so this dapp's live
> projection works over plain JSON-RPC today. gRPC / GraphQL are still the recommended
> SDK 2.0 clients (JSON-RPC is deprecated), which is how the transport lesson is framed.

## Run it (localnet)

```bash
# 1. Local Sui network (idempotent) — from the repo:
bash dapp/scripts/start-localnet.sh

# 2. Publish the fixed hero_forge package + create the 4 Displays, write deployment.ts:
cd dapp/hero-frontend
pnpm install
pnpm publish:localnet

# 3. Dev server (port 5175):
pnpm dev
```

Open `http://localhost:5175`. Use the **Dev key** signer (funded from the faucet) for
hands-free localnet signing, or connect a wallet. Mint a Hero, then forge items and watch
the Display projection and composite sprite update.

## Layout

| Path | What |
|---|---|
| `../hero-move/` | The fixed `hero_forge::hero` Move package (Hero + item structs, equip/unequip via DOFs, `create_displays`). |
| `../hero-scripts/publish-localnet.sh` | Build + `test-publish` + `create_displays` + write `src/deployment.ts`. |
| `src/chain.ts` | Reads the owned Hero (content + resolved Display + attached DOFs) and builds mint/equip/unequip PTBs. |
| `src/items.ts` | The fixed catalog (stats + `summary` strings that the Display projects). |
| `src/sprites.ts` | Deterministic equipped-set → composite sprite (8 pre-rendered PNGs in `public/sprites/`). |
| `src/lessons.ts` | The 9 V1→V2 differences + transport note. |
| `src/components/` | `HeroStage`, `Armory`, `LessonPanel`, `SignerBar`. |

## Testnet

The core showcase runs on localnet. For a public deploy, switch `src/dapp-kit.ts` to a
testnet client (gRPC via `@mysten/sui/grpc` is the SDK 2.0 recommendation), host the
sprites on Walrus, and add a testnet publish path. See the Move package and
`publish-localnet.sh` as the template.
