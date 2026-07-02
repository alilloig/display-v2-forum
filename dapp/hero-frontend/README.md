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

The code lab under the dapp shows the snippets relevant to the app's current state
(wallet not connected → no hero → minted → equipped); across the four states all nine
canonical Display V1→V2 differences (source: `../../learning/display-v2-guide.md`) are
covered, and each snippet links to its section of the guide. See `src/snippets.ts` and
`../GOAL.md`.

> **Transport note:** the frontend is gRPC-only (`SuiGrpcClient` via the SDK 2.0 core
> API) — JSON-RPC is deprecated. Devnet's fullnode resolves the `=>` load operators in
> the Display response, so the live projection arrives already interpolated.

## Run it (devnet)

```bash
# 1. Publish the hero_forge package + create the 4 Displays, write deployment.ts
#    (needs a devnet-funded CLI address; the script hits the faucet if low):
cd dapp/hero-frontend
pnpm install
pnpm publish:devnet

# 2. Dev server (port 5175):
pnpm dev
```

Open `http://localhost:5175` and connect a devnet wallet. Mint a Hero, then forge items
and watch the Display projection and composite sprite update.

## Layout

| Path | What |
|---|---|
| `../hero-move/` | The fixed `hero_forge::hero` Move package (Hero + item structs, equip/unequip via DOFs, `create_displays`). |
| `../hero-scripts/publish-devnet.sh` | Build + publish to devnet + `create_displays` + write `src/deployment.ts`. |
| `src/chain.ts` | Reads the owned Hero (content + resolved Display + attached DOFs) and builds mint/equip/unequip PTBs. |
| `src/items.ts` | The fixed catalog (stats + `summary` strings that the Display projects). |
| `src/sprites.ts` | Deterministic equipped-set → composite sprite (8 pre-rendered PNGs in `public/sprites/`). |
| `src/snippets.ts` | The state → snippets map covering the 9 V1→V2 differences. |
| `src/components/` | `HeroStage`, `Armory`, `CodeLab`. |

## Beyond devnet

Devnet is wiped periodically — re-run `pnpm publish:devnet` after a wipe (it refreshes
the chain id pinned in `../hero-move/Move.toml`). For a longer-lived deploy, point
`src/dapp-kit.ts` and the publish script at testnet and host the sprites on Walrus.
