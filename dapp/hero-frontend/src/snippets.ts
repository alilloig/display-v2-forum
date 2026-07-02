// The teaching layer (see ../GOAL.md). The code lab shows only the snippets relevant
// to the dapp's current state; across the four states, all nine canonical Display
// V1→V2 differences from learning/display-v2-guide.md are covered. Each snippet pairs
// real V1 code (the way it was actually written against sui::display) with the V2
// equivalent, rendered as side-by-side cards. One snippet showcases exactly one
// difference; a difference may reappear in a later state when a different facet of it
// becomes relevant.

export type AppState = 'preconnect' | 'noHero' | 'minted' | 'equipped';

export type Kind = 'move' | 'sdk';

export interface Snippet {
  diff: number; // 1–9, the canonical difference this snippet showcases
  kind: Kind;
  v1: string;
  v2: string;
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
      v1: `// Scan history for the type's DisplayCreated
// event, then fetch that Display object.
const { data } = await client.queryEvents({
  query: {
    MoveEventType:
      \`0x2::display::DisplayCreated<\${PKG}::hero::Hero>\`,
  },
});
const displayId = data.at(-1)?.parsedJson?.id;`,
      v2: `// The Display lives at an address derived from
// the registry at 0xd — one read, nothing to scan.
const owned = await client.core.listOwnedObjects({
  owner: address,
  type: \`\${PKG}::hero::Hero\`,
  include: { json: true, display: true },
});`,
    },
    {
      diff: 5,
      kind: 'move',
      v1: `// One owned object: claim it with the
// Publisher, and whoever OWNS it
// manages it.
let mut hero_display =
    display::new<Hero>(&publisher, ctx);
transfer::public_transfer(
    hero_display, ctx.sender(),
);
// later, as the owner:
hero_display.add(key, value);`,
      v2: `// Read/write split: the Display is
// shared — anyone resolves it; every
// edit presents the DisplayCap.
display_registry::share(hero_display);
transfer::public_transfer(
    hero_cap, ctx.sender(),
);
// later, from any tx holding the cap:
hero_display.set(&hero_cap, key, value);`,
    },
  ],

  // Connected, no Hero yet: the deploy-time code that put a Display<Hero>
  // on chain before any Hero existed.
  noHero: [
    {
      diff: 1,
      kind: 'move',
      v1: `// The Publisher is the only key that
// can create a Display.
let mut hero_display =
    display::new_with_fields<Hero>(
        &publisher, keys, values, ctx,
    );`,
      v2: `// A Publisher still works, or a
// module-level Permit instead.
let (mut hero_display, hero_cap) =
    display_registry::new_with_publisher<Hero>(
        registry, publisher, ctx,
    );`,
    },
    {
      diff: 2,
      kind: 'move',
      v1: `// Built inside init() at publish time.
fun init(otw: HERO, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    let mut hero_display =
        display::new<Hero>(&publisher, ctx);
    // ...set fields, transfer to sender...
}`,
      v2: `// The registry is SHARED and init() can't
// receive shared objects — creation moves to
// its own function, called after publish.
public fun create_displays(
    registry: &mut DisplayRegistry, // 0xd
    publisher: &mut Publisher,
    ctx: &mut TxContext,
) { /* ... */ }`,
    },
    {
      diff: 6,
      kind: 'move',
      v1: `// T must have \`key\` — only top-level
// objects get a Display.
public fun new<T: key>(
    pub: &Publisher, ctx: &mut TxContext,
): Display<T>`,
      v2: `// No bound on T — any type can
// carry a Display.
public fun new_with_publisher<T>(..):
    (Display<T>, DisplayCap<T>)`,
    },
  ],

  // Hero minted: the resolved Display on screen came from cap-gated,
  // individually-set fields.
  minted: [
    {
      diff: 8,
      kind: 'move',
      v1: `// Bulk-set every field, then bump
// version to reindex.
hero_display.add_multiple(
    vector[b"name".to_string(),
           b"attack".to_string()],
    vector[b"{name}".to_string(),
           b"{base_attack}".to_string()],
);
hero_display.update_version();`,
      v2: `// Fields are set one by one, each
// edit gated by the cap.
hero_display.set(&hero_cap,
    b"name".to_string(),
    b"{name}".to_string());
hero_display.set(&hero_cap,
    b"attack".to_string(),
    b"{base_attack}".to_string());`,
    },
    {
      diff: 7,
      kind: 'move',
      v1: `// Display<Hero> carries \`version: u16\`;
// bumping it re-emits VersionUpdated so
// indexers re-read the template.
hero_display.update_version(); // 1 -> 2`,
      v2: `// The struct is { id, fields, cap_id }
// — no version field. What you see is
// always the current template.
// (nothing to call)`,
    },
  ],

  // Items equipped: the payoff — the projection follows the attached
  // dynamic object fields while the Hero stays untouched.
  equipped: [
    {
      diff: 9,
      kind: 'move',
      v1: `// Only {field} and {nested.field} dot
// paths — whatever is baked into the
// Hero struct is all you can show.
hero_display.add(
    b"inventory".to_string(),
    b"{equipment.summary}".to_string(),
);`,
      v2: `// \`=>\` loads an attached dynamic object
// field, \`| ''\` is the fallback. Equip an
// item and this projection changes — the
// Hero itself is never mutated.
hero_display.set(&hero_cap,
    b"inventory".to_string(),
    b"{$self=>['sword'].summary | ''}\\
      {$self=>['shield'].summary | ''}\\
      {$self=>['armor'].summary | ''}"
        .to_string());`,
    },
    {
      diff: 4,
      kind: 'move',
      v1: `// Nothing stops a second (or third)
// Display<Hero> — indexers just take
// whichever emitted VersionUpdated last.
let another =
    display::new<Hero>(&publisher, ctx);`,
      v2: `// The registry entry IS the Display,
// one per type — the inventory you see
// is THE projection, not one of several.
display_registry::new_with_publisher<Hero>(
    registry, publisher, ctx,
); // aborts if <Hero> already registered`,
    },
  ],
};
