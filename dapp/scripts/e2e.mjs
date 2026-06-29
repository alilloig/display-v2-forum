// e2e.mjs — JSON-RPC assertion helper for the Display V2 E2E (E-001).
//
// Usage:  node e2e.mjs <HERO_ID> <phase>      phase ∈ { set, unset }
//
// This is the "teaching thesis" check: it reads a Hero object back from
// localnet with BOTH the resolved Display (showDisplay) AND the raw on-chain
// struct (showContent) and asserts the two views independently.
//
//   - phase "set":   the Display templates are applied; the RESOLVED display
//                    must render the expected interpolated strings, and the RAW
//                    struct fields must still equal the values minted.
//   - phase "unset": the "description" template was removed; it must DISAPPEAR
//                    from the resolved display, yet the RAW struct fields must be
//                    byte-for-byte IDENTICAL to the "set" phase — proving the
//                    on-chain object never changed; only the off-chain render did.
//
// Exit code is 0 only if every assertion passes, 1 otherwise. No deps — plain
// fetch against the localnet JSON-RPC endpoint.

const RPC_URL = "http://127.0.0.1:9000";

// These are the exact values e2e.sh mints (Hero "Aragorn"). They are the
// ground truth both phases assert against. Note: power/level come back as
// STRINGS over JSON-RPC even though they are u64 on-chain.
const EXPECTED_RAW = {
  name: "Aragorn",
  image_url: "https://example.com/aragorn.png",
  species: "Human",
  power: "95",
  level: "12",
};

// The rendered (interpolated) display after `set name/image_url/description`.
const EXPECTED_DISPLAY_AFTER_SET = {
  name: "Aragorn",
  image_url: "https://example.com/aragorn.png",
  description: "A level 12 Human with 95 power.",
};

// ── tiny assertion harness: accumulate failures, exit at the end ────────────
let failures = 0;
function pass(label) {
  console.log(`PASS: ${label}`);
}
function fail(label, expected, got) {
  failures += 1;
  console.log(
    `FAIL: ${label} — expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`,
  );
}
function assertEqual(label, got, expected) {
  if (got === expected) pass(`${label} == ${JSON.stringify(expected)}`);
  else fail(label, expected, got);
}
// Order-insensitive deep equality: JSON-RPC returns object keys in on-chain
// insertion order, which is NOT the order we declare expectations in. We
// canonicalize by recursively sorting object keys before comparing, so the
// assertion checks VALUES + KEY SET, not serialization order. Arrays keep
// their order (callers sort arrays explicitly when order is irrelevant).
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.keys(v)
      .sort()
      .reduce((acc, k) => {
        acc[k] = canonical(v[k]);
        return acc;
      }, {});
  }
  return v;
}
function assertDeepEqual(label, got, expected) {
  if (JSON.stringify(canonical(got)) === JSON.stringify(canonical(expected))) {
    pass(`${label} deep-equals ${JSON.stringify(expected)}`);
  } else {
    fail(label, expected, got);
  }
}

async function getObject(heroId) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sui_getObject",
      params: [heroId, { showDisplay: true, showContent: true }],
    }),
  }).then((r) => r.json());
  return res?.result?.data;
}

async function main() {
  const [heroId, phase] = process.argv.slice(2);
  if (!heroId || !phase) {
    console.log("FAIL: usage — node e2e.mjs <HERO_ID> <phase:set|unset>");
    process.exit(1);
  }
  if (phase !== "set" && phase !== "unset") {
    console.log(`FAIL: unknown phase "${phase}" (expected set|unset)`);
    process.exit(1);
  }

  const data = await getObject(heroId);
  if (!data) {
    console.log(`FAIL: sui_getObject returned no data for ${heroId}`);
    process.exit(1);
  }

  const display = data.display ?? {};
  const resolved = display.data; // rendered template output { name, image_url, ... }
  const raw = data.content?.fields; // raw struct { id, name, image_url, species, power, level }

  if (!raw) {
    console.log("FAIL: content.fields missing — cannot check raw struct");
    process.exit(1);
  }

  // ── RAW struct assertions (both phases) — the object must be unchanged ────
  // power/level arrive as strings over JSON-RPC; compare as strings.
  assertEqual("content.fields.name", raw.name, EXPECTED_RAW.name);
  assertEqual("content.fields.image_url", raw.image_url, EXPECTED_RAW.image_url);
  assertEqual("content.fields.species", raw.species, EXPECTED_RAW.species);
  assertEqual("content.fields.power", String(raw.power), EXPECTED_RAW.power);
  assertEqual("content.fields.level", String(raw.level), EXPECTED_RAW.level);

  if (phase === "set") {
    // All template tokens must have resolved cleanly.
    assertEqual("display.error", display.error ?? null, null);
    // The resolved display must render exactly the interpolated strings.
    assertDeepEqual(
      "display.data (after set)",
      resolved,
      EXPECTED_DISPLAY_AFTER_SET,
    );
  } else {
    // After unset description: the resolved display keys must be exactly
    // [image_url, name] (sorted) and must NOT contain "description".
    if (!resolved) {
      console.log("FAIL: display.data missing after unset");
      failures += 1;
    } else {
      const keys = Object.keys(resolved).sort();
      assertDeepEqual("display.data keys (after unset)", keys, [
        "image_url",
        "name",
      ]);
      if ("description" in resolved) {
        fail("display.data has no 'description'", "absent", resolved.description);
      } else {
        pass("display.data has no 'description'");
      }
    }
  }

  if (failures > 0) {
    console.log(`\n${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll assertions passed.");
  process.exit(0);
}

main().catch((err) => {
  console.log(`FAIL: e2e.mjs threw — ${err?.message ?? err}`);
  process.exit(1);
});
