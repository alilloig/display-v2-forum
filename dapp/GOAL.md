# Goal — State-driven code snippets for Hero Forge

This document is the authoritative intent for reworking how Hero Forge displays its
teaching code snippets. Any implementation (rebuild, restore-and-modify, or fresh
frontend) must satisfy it.

## Background

The previous frontend (deleted at HEAD, recoverable from git history at `HEAD~1`,
`dapp/hero-frontend/`) rendered **all nine** Display V1→V2 differences at once in a
bottom `LessonPanel` — dense side-by-side V1/V2 cards, re-sorted and highlighted by an
internal "step" concept, under headers like *"How this step differs: Display V1 → V2"*.
That design did not capture the intent. This rework replaces it.

## The goal

The code snippets shown are driven by the **app's current visible state**, not by a
lesson sequence. At any moment the user sees only the few snippets relevant to what the
dapp is doing right now, and by playing through the whole flow they encounter **all nine
canonical V1→V2 differences** from [`learning/display-v2-guide.md`](../learning/display-v2-guide.md).

Snippets are the star: concise, immediately readable, each labeled with the
difference it showcases (stated once — never repeated in surrounding chrome) and linked
to the matching section of the guide. Everything else — headers, phase banners,
explanatory chrome — is stripped to a light visual separation between the **dapp area**
and the **code lab area**.

## The four states

| # | State | User sees in the dapp area |
|---|-------|----------------------------|
| 1 | Wallet not connected | Connect prompt |
| 2 | Wallet connected, no hero | Mint action |
| 3 | Hero minted, nothing equipped | Hero + armory |
| 4 | Hero equipped with ≥1 item | Hero with live Display projection changing |

> Assumption (flag if wrong): the raw prompt listed "wallet connected, hero not minted
> yet, hero minted, hero equipped". The first two collapse into the same moment, so the
> four states above include a pre-connect state to keep four distinct, user-visible
> states. If instead nothing should show before connecting, states 2–4 absorb the
> coverage and state 1 shows no snippets.

Default (not explicit in the raw prompt, but consistent with its ethos): snippets
**replace** each other on state change rather than accumulating across states.

## Coverage: the nine differences

Across the four states combined, every difference below appears in **at least one**
snippet. A difference may span more than one snippet, a snippet may showcase more than
one difference where that is natural, and distribution across states may be uneven —
what matters is total coverage and that every snippet states which difference(s) it
showcases. Default preference: one difference per snippet, for clarity.

| Difference | Guide section |
|---|---|
| 1 — Authorization & creation | [guide §Difference 1](../learning/display-v2-guide.md#difference-1--authorization--creation) |
| 2 — Where you create it | [guide §Difference 2](../learning/display-v2-guide.md#difference-2--where-you-create-it) |
| 3 — Discovery & indexing | [guide §Difference 3](../learning/display-v2-guide.md#difference-3--discovery--indexing) |
| 4 — Cardinality | [guide §Difference 4](../learning/display-v2-guide.md#difference-4--cardinality) |
| 5 — Object model | [guide §Difference 5](../learning/display-v2-guide.md#difference-5--object-model) |
| 6 — Type constraint | [guide §Difference 6](../learning/display-v2-guide.md#difference-6--type-constraint) |
| 7 — The per-object version field | [guide §Difference 7](../learning/display-v2-guide.md#difference-7--the-per-object-version-field) |
| 8 — Field API | [guide §Difference 8](../learning/display-v2-guide.md#difference-8--field-api) |
| 9 — Templating: the engine changes | [guide §Difference 9](../learning/display-v2-guide.md#difference-9--templating-the-engine-changes) |

The guide's TypeScript/PTB transport note is **not** one of the nine; it may appear as
an extra snippet if it earns its place, but it is not required.

A suggested (non-binding) state mapping, purely as a starting point:

- **State 1 (pre-connect):** 3 (discovery at `0xd`), 5 (shared Display anyone can read)
- **State 2 (connected, no hero):** 1, 2, 6 — the deploy-time creation story behind the mint button
- **State 3 (hero minted):** 3 or 7, 8 — reading the hero's resolved Display
- **State 4 (equipped):** 9 (the `=>` load operator, live), 4 — the payoff

## Per-snippet requirements

Each snippet card contains:

1. **A compact difference label** — canonical form `Difference N — <guide title>`. Stated
   once; never repeated in surrounding headers or captions.
2. **A concise code excerpt** — trimmed to the minimum that illustrates the difference;
   never a full-file dump. A V1-vs-V2 comparison is allowed *when it aids comprehension
   for that difference*, but it must stay readable (stacked V1/V2 is fine; cramped
   side-by-side is not).
3. **A link to the guide section** (anchors above) — verify the anchor slugs against the
   actual renderer serving the MD; adjust if the guide is served differently (e.g.
   GitHub vs local viewer).

No prose explaining *why* the snippet is currently visible ("because you are in X
state") — relevance is implicit.

## Layout requirements

- At **every** viewport width, at most **one** difference snippet per row — a
  single-column snippet stack at all breakpoints. Never a side-by-side snippet grid.
- **Light separation** between dapp area and code lab area (a rule, spacing, or subtle
  background shift). At most one lightweight label for the code lab area as a whole.
- **No** visible "step"/"phase" headers or banners — internal flow concepts carry no
  learning value and must not surface in the UI.
- **No** stacked or redundant titles: nothing that restates the current state, repeats
  the difference a snippet already declares, or announces what the panel is about to do.

## Anti-goals (must NOT)

- Render all nine differences at once in any state.
- Organize the display around a 9-step / phase progression.
- Show two or more difference snippets on the same row at any resolution.
- Reintroduce header stacks ("How this step differs…", per-state banners, etc.).
- Accumulate snippets from previous states.

## Acceptance criteria

1. The code lab area's content is selected by the four app states above, not by an
   internal step counter; no state renders all nine differences at once.
2. Playing connect → mint → equip surfaces all nine differences at least once.
3. Every snippet carries a canonical difference label (stated once) and a working link
   to the matching guide section.
4. Every snippet is a concise excerpt readable without horizontal scrolling at common
   widths (mobile ~375px through desktop), and at no viewport width do two difference
   snippets share a row.
5. The UI surfaces no "step"/"phase" headers and no redundant titles; the dapp/code-lab
   boundary is visually light, with at most one label for the code lab as a whole.
