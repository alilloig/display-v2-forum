// The teaching layer (see ../GOAL.md). The code lab shows only the snippets relevant
// to the dapp's current state; across the four states, all nine canonical Display
// V1→V2 differences from learning/display-v2-guide.md are covered. One snippet
// showcases exactly one difference; a difference may reappear in a later state when a
// different facet of it becomes relevant.

export type AppState = 'preconnect' | 'noHero' | 'minted' | 'equipped';

export type Kind = 'move' | 'sdk';

export interface Snippet {
  diff: number; // 1–9, the canonical difference this snippet showcases
  kind: Kind;
  code: string;
}

const GUIDE_URL =
  'https://github.com/alilloig/display-v2-forum/blob/main/learning/display-v2-guide.md';

// Titles + GitHub anchor slugs of the guide's `## Difference N — …` headings.
export const DIFFS: Record<number, { title: string; anchor: string }> = {
  1: { title: 'Authorization & creation', anchor: 'difference-1--authorization--creation' },
  2: { title: 'Where you create it', anchor: 'difference-2--where-you-create-it' },
  3: { title: 'Discovery & indexing', anchor: 'difference-3--discovery--indexing' },
  4: { title: 'Cardinality', anchor: 'difference-4--cardinality' },
  5: { title: 'Object model', anchor: 'difference-5--object-model' },
  6: { title: 'Type constraint', anchor: 'difference-6--type-constraint' },
  7: { title: 'The per-object version field', anchor: 'difference-7--the-per-object-version-field' },
  8: { title: 'Field API', anchor: 'difference-8--field-api' },
  9: { title: 'Templating: the engine changes', anchor: 'difference-9--templating-the-engine-changes' },
};

export function guideLink(diff: number): string {
  return `${GUIDE_URL}#${DIFFS[diff].anchor}`;
}

export const SNIPPETS: Record<AppState, Snippet[]> = {
  // Before connecting: the reads this app is about to run.
  preconnect: [
    {
      diff: 3,
      kind: 'sdk',
      code: `// V1: replay ..::display::DisplayCreated events to find a Display.
// V2: the Display lives at an address derived from the registry at
// 0xd — one gRPC read resolves it, nothing to scan.
const owned = await client.core.listOwnedObjects({
  owner: address,
  type: \`\${PACKAGE_ID}::hero::Hero\`,
  include: { json: true, display: true },
});`,
    },
    {
      diff: 5,
      kind: 'move',
      code: `// V1: one owned Display<Hero> — its owner reads AND writes.
// V2: the Display is shared, so anyone (this app included) can
// resolve it; only the DisplayCap<Hero> holder can edit it.
display_registry::share(hero_display);
transfer::public_transfer(hero_cap, ctx.sender());`,
    },
  ],

  // Connected, no Hero yet: the deploy-time code that put a Display<Hero>
  // on chain before any Hero existed.
  noHero: [
    {
      diff: 1,
      kind: 'move',
      code: `// V1: display::new_with_fields<Hero>(&publisher, ..) — Publisher only.
// V2: a Publisher still works, or a module-level Permit instead.
let (mut hero_display, hero_cap) =
    display_registry::new_with_publisher<Hero>(registry, publisher, ctx);`,
    },
    {
      diff: 2,
      kind: 'move',
      code: `// V1: the Display was built inside init().
// V2: the registry is a SHARED object and init() can't receive shared
// objects — creation moves to its own function, called after publish.
public fun create_displays(
    registry: &mut DisplayRegistry, // the singleton at 0xd
    publisher: &mut Publisher,
    ctx: &mut TxContext,
) { /* ... */ }`,
    },
    {
      diff: 6,
      kind: 'move',
      code: `// V1: public fun new<T: key>(..) — only key-able objects.
// V2: no bound on T — any type can carry a Display.
public fun new_with_publisher<T>(..): (Display<T>, DisplayCap<T>)`,
    },
  ],

  // Hero minted: the resolved Display on screen came from cap-gated,
  // individually-set fields.
  minted: [
    {
      diff: 8,
      kind: 'move',
      code: `// V1: bulk display.add_multiple(keys, values), then reindex.
// V2: fields are set one by one, each edit gated by the cap.
hero_display.set(&hero_cap, b"name".to_string(), b"{name}".to_string());
hero_display.set(&hero_cap, b"attack".to_string(),
    b"{base_attack}".to_string());`,
    },
    {
      diff: 7,
      kind: 'move',
      code: `// V1: display.update_version() bumped \`version: u16\` so indexers
// would re-read the template.
// V2: the struct is { id, fields, cap_id } — no version field.
// What you see here is always the current template, no bump needed.`,
    },
  ],

  // Items equipped: the payoff — the projection follows the attached
  // dynamic object fields while the Hero stays untouched.
  equipped: [
    {
      diff: 9,
      kind: 'move',
      code: `// V1 templates: {field} / {nested.field} only.
// V2: \`=>\` loads an attached dynamic object field, \`| ''\` is the
// fallback. Equip an item and this projection changes — the Hero
// object itself is never mutated.
hero_display.set(&hero_cap, b"inventory".to_string(),
    b"{$self=>['sword'].summary | ''}\\
      {$self=>['shield'].summary | ''}\\
      {$self=>['armor'].summary | ''}".to_string());`,
    },
    {
      diff: 4,
      kind: 'move',
      code: `// V1: any number of Display<Hero> objects could exist — indexers
// obeyed "last VersionUpdated event wins".
// V2: the registry entry IS the Display, one per type — so the
// inventory you see is THE projection, not one of several.
display_registry::new_with_publisher<Hero>(registry, publisher, ctx);
// ^ aborts if <Hero> is already registered`,
    },
  ],
};
