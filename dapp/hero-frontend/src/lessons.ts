// The teaching layer. Each lesson is one of the 9 canonical Display V1→V2 differences
// (from learning/display-v2-guide.md) plus the transport note, with a side-by-side
// v1/v2 snippet. The dapp cycle is 9 steps (connect → meet the forge → mint →
// equip ×3 → unequip ×3); FLOW maps each phase of that cycle to the differences it
// showcases, and the panel shows ONLY those cards — the rest stay hidden.

export type Kind = 'move' | 'sdk';

export interface Lesson {
  n: number | 'T';
  title: string;
  kind: Kind;
  v1: string;
  v2: string;
  note: string;
}

export const LESSONS: Lesson[] = [
  {
    n: 1,
    title: 'Authorization & creation',
    kind: 'move',
    v1: `// V1 — Publisher object is mandatory
let d = display::new_with_fields<Hero>(
  &publisher, keys, values, ctx,
);`,
    v2: `// V2 — Publisher OR module-level Permit
let (d, cap) =
  display_registry::new_with_publisher<Hero>(
    registry, publisher, ctx,
  );`,
    note: 'V2 accepts a Publisher or an internal Permit; ownership can be proven through the module system.',
  },
  {
    n: 2,
    title: 'Where you create it',
    kind: 'move',
    v1: `// V1 — Display built inside init()
fun init(otw: HERO, ctx: &mut TxContext) {
  let d = display::new<Hero>(&pub, ctx);
}`,
    v2: `// V2 — separate entry; registry is SHARED
public fun create_displays(
  registry: &mut DisplayRegistry, /* 0xd */
  publisher: &mut Publisher, ctx: &mut TxContext,
) { /* ... */ }`,
    note: 'The DisplayRegistry is a shared object and cannot be received in init(), so creation moves to its own call.',
  },
  {
    n: 3,
    title: 'Discovery & indexing',
    kind: 'sdk',
    v1: `// V1 — scan historical events
client.queryEvents({
  query: { MoveEventType: '..::DisplayCreated' },
});`,
    v2: `// V2 — deterministic derived object at 0xd
// id = derive(DisplayRegistry, DisplayKey<Hero>)
client.core.getObject({ objectId: heroId,
  options: { showDisplay: true } });`,
    note: 'The active Display lives at a derived address computable offline from the registry at 0xd — no event scanning.',
  },
  {
    n: 4,
    title: 'Cardinality',
    kind: 'move',
    v1: `// V1 — any number of Display<Hero> objects
// "last VersionUpdated event wins" (ambiguous)`,
    v2: `// V2 — exactly ONE per type, registry-enforced
// a second create_displays<Hero>() aborts`,
    note: 'The registry entry IS the Display, so there is exactly one per type — unambiguous.',
  },
  {
    n: 5,
    title: 'Object model: Display + Cap',
    kind: 'move',
    v1: `// V1 — one owned Display<Hero>
transfer::public_transfer(display, sender);
// owner reads AND writes`,
    v2: `// V2 — shared Display + a separate Cap
display_registry::share(display);        // anyone reads
transfer::public_transfer(cap, sender);  // cap holder writes`,
    note: 'Read/write split: the Display is publicly readable but only the DisplayCap<Hero> holder can mutate it.',
  },
  {
    n: 6,
    title: 'Type constraint relaxed',
    kind: 'move',
    v1: `// V1 — T must be a key-able object
public fun new<T: key>(...): Display<T>`,
    v2: `// V2 — any T (phantom, no key bound)
public fun new_with_publisher<T>(...):
  (Display<T>, DisplayCap<T>)`,
    note: 'V2 can describe any type, not only top-level on-chain objects.',
  },
  {
    n: 7,
    title: 'No per-object version field',
    kind: 'move',
    v1: `// V1 — bump version to re-emit an event
display.update_version(); // version: u16`,
    v2: `// V2 — no version field at all
// { id, fields, cap_id } — nothing to bump`,
    note: 'Discovery by derived address means there is no version to bump for indexers to notice.',
  },
  {
    n: 8,
    title: 'Field API',
    kind: 'move',
    v1: `// V1 — bulk setter + manual reindex
display.add_multiple(keys, values);
display.update_version();`,
    v2: `// V2 — individual, cap-gated ops
display.set(&cap, b"inventory".to_string(), tmpl);
display.unset(&cap, key);  display.clear(&cap);`,
    note: 'Fields are edited individually and gated by the DisplayCap; no manual reindex step exists.',
  },
  {
    n: 9,
    title: 'Templating engine (the headline)',
    kind: 'move',
    v1: `// V1 — only {field} / {nested.field}
("name", "{name}")`,
    v2: `// V2 — load data from attached DOFs, live
("inventory",
 "{$self=>['sword'].summary | ''}\\
  {$self=>['shield'].summary | ''}\\
  {$self=>['armor'].summary | ''}")`,
    note: 'The `=>` operator loads a dynamic object field (2 loads; budget 8) and `| \'\'` supplies a fallback. The Hero is never mutated — attach an item and the projection changes.',
  },
  {
    n: 'T',
    title: 'Transport: JSON-RPC → gRPC / GraphQL',
    kind: 'sdk',
    v1: `// V1 stack — JSON-RPC (being deprecated, Jul 2026)
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
const client = new SuiJsonRpcClient({ url });`,
    v2: `// V2 stack — SDK 2.0 recommends gRPC (+ GraphQL)
import { SuiGrpcClient } from '@mysten/sui/grpc';
const client = new SuiGrpcClient({ network, transport });`,
    note: 'SDK 2.0 recommends SuiGrpcClient (with SuiGraphQLClient for complex queries); JSON-RPC is deprecated. Note: on sui 1.69.2 localnet, JSON-RPC showDisplay DOES resolve load operators — so this dapp\'s live projection works on either transport.',
  },
];

/** The phases of the dapp cycle. Each phase shows ONLY its differences. */
export type Phase = 'connect' | 'noHero' | 'minted' | 'equip' | 'unequip';

/**
 * Phase → differences showcased. Together the five phases cover all nine
 * differences plus the transport note:
 *  - connect: how the app talks to the chain (SDK 2.0 gRPC).
 *  - noHero:  before minting, the panel explains how this dapp's Displays were
 *             claimed and created at deploy time (and how fields are set).
 *  - minted:  one freshly-minted Hero → the object model around it: exactly one
 *             shared Display<Hero> (+ cap) governs every Hero, for any T.
 *  - equip:   the headline — the template projects attached DOFs live, and the
 *             app re-reads the resolved projection through the SDK.
 *  - unequip: same live projection, plus: nothing was bumped — no version field.
 * Equip/unequip repeat across cycle steps 4-6 / 7-9 on purpose: changing item
 * combinations showcases the same difference (templating + retrieval).
 */
export const FLOW: Record<Phase, (number | 'T')[]> = {
  connect: ['T'],
  noHero: [1, 2, 8],
  minted: [4, 5, 6],
  equip: [9, 3],
  unequip: [9, 7],
};

export type CycleAction = 'mint' | 'equip' | 'unequip';

/**
 * Where the user is in the 9-step cycle: 1 connect · 2 the forge (no hero) ·
 * 3 mint · 4-6 equip (position tracks how many items are attached) · 7-9
 * unequip (ditto, counting down). Derived from chain state + the last action,
 * so a page reload lands on the right step.
 */
export function deriveCycle(args: {
  connected: boolean;
  hasHero: boolean;
  equipped: number;
  lastAction: CycleAction | null;
}): { phase: Phase; pos: number } {
  const { connected, hasHero, equipped, lastAction } = args;
  if (!connected) return { phase: 'connect', pos: 1 };
  if (!hasHero) return { phase: 'noHero', pos: 2 };
  if (lastAction === 'unequip') return { phase: 'unequip', pos: 9 - equipped };
  if (equipped === 0) return { phase: 'minted', pos: 3 };
  return { phase: 'equip', pos: 3 + equipped };
}

/** Labels for the 9 steps of the cycle (index = step - 1). */
export const CYCLE_STEPS = [
  'Connect',
  'The Forge',
  'Mint Hero',
  'Equip I',
  'Equip II',
  'Equip III',
  'Unequip I',
  'Unequip II',
  'Unequip III',
] as const;
