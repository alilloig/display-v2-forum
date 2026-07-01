// The teaching layer. Each lesson is one of the 9 canonical Display V1→V2 differences
// (from learning/display-v2-guide.md) plus the transport note, with a side-by-side
// v1/v2 snippet. `flow` maps a step in the dapp to the difference it most vividly shows,
// so the panel can highlight the relevant card as the user progresses.

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

/** Which difference each app step showcases most directly. */
export const FLOW: Record<string, (number | 'T')[]> = {
  connect: ['T', 3],
  mintHero: [1, 2, 5, 6],
  equip: [9, 8],
  unequip: [9],
  discover: [3, 4, 7],
};
