// Shared schema + Move codegen — the single source of truth imported by BOTH the
// browser (live "Generated Move" preview, mint-arg ordering, display tokens) and the
// local bridge (publish-time validation + codegen). Plain ESM JS so Node and Vite can
// both import it; TS types live in schema.d.ts.

/** Supported trait field types and their Move type. */
export const MOVE_TYPE = { string: 'String', u64: 'u64', bool: 'bool' };
export const FIELD_TYPES = ['string', 'u64', 'bool'];

// Move keywords / framework names we must not let a user pick as an identifier.
const RESERVED = new Set([
  'id', 'module', 'struct', 'fun', 'public', 'entry', 'use', 'has', 'key', 'store',
  'copy', 'drop', 'let', 'mut', 'if', 'else', 'while', 'loop', 'return', 'abort',
  'const', 'native', 'as', 'true', 'false', 'address', 'signer', 'vector', 'phantom',
  'move', 'self', 'friend', 'script', 'spec',
]);

const FIELD_RE = /^[a-z][a-z0-9_]*$/;
const TYPE_RE = /^[A-Z][A-Za-z0-9]*$/;

/** The default sample schema — matches the committed sample hero.move. */
export const DEFAULT_SCHEMA = {
  typeName: 'Hero',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'image_url', type: 'string' },
    { name: 'species', type: 'string' },
    { name: 'power', type: 'u64' },
    { name: 'level', type: 'u64' },
  ],
  groups: [],
};

/** snake_or_lower -> PascalCase, for nested struct type names. */
export function pascal(name) {
  return String(name)
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/**
 * Validate a schema. Returns an array of human-readable error strings (empty = valid).
 * This is the authority used by the bridge before codegen; the UI mirrors it for feedback.
 */
export function validateSchema(schema) {
  const errors = [];
  if (!schema || typeof schema !== 'object') return ['schema must be an object'];

  if (!TYPE_RE.test(schema.typeName || '')) {
    errors.push(`type name "${schema.typeName}" must be PascalCase (e.g. "Hero")`);
  }

  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const groups = Array.isArray(schema.groups) ? schema.groups : [];

  const totalFields = fields.length + groups.reduce((n, g) => n + (g.fields?.length || 0), 0);
  if (totalFields === 0) errors.push('add at least one field');

  // Top-level names: flat fields + group names share the struct's field namespace.
  const topNames = new Set();
  const checkName = (name, where) => {
    if (!FIELD_RE.test(name || '')) errors.push(`${where} name "${name}" must be snake_case (^[a-z][a-z0-9_]*$)`);
    else if (RESERVED.has(name)) errors.push(`${where} name "${name}" is a reserved word`);
  };

  for (const f of fields) {
    checkName(f.name, 'field');
    if (!FIELD_TYPES.includes(f.type)) errors.push(`field "${f.name}" has unknown type "${f.type}"`);
    if (topNames.has(f.name)) errors.push(`duplicate name "${f.name}"`);
    topNames.add(f.name);
  }

  for (const g of groups) {
    checkName(g.name, 'group');
    if (topNames.has(g.name)) errors.push(`duplicate name "${g.name}" (group clashes with a field/group)`);
    topNames.add(g.name);
    const inner = new Set();
    if (!g.fields || g.fields.length === 0) errors.push(`group "${g.name}" needs at least one field`);
    for (const f of g.fields || []) {
      checkName(f.name, `group "${g.name}" field`);
      if (!FIELD_TYPES.includes(f.type)) errors.push(`group "${g.name}" field "${f.name}" has unknown type "${f.type}"`);
      if (inner.has(f.name)) errors.push(`duplicate field "${f.name}" in group "${g.name}"`);
      inner.add(f.name);
    }
  }
  return errors;
}

/**
 * The ordered mint parameter list — the SINGLE source of truth for the order in which
 * `mint` takes arguments. Codegen emits the Move signature in this order; the frontend
 * builds the PTB args in this order. Each entry also carries the display `token`.
 *   flat fields first (declaration order), then nested fields (group order, field order).
 */
export function mintParams(schema) {
  const out = [];
  for (const f of schema.fields || []) {
    out.push({ paramName: f.name, moveType: MOVE_TYPE[f.type], fieldType: f.type, kind: 'flat', field: f.name, token: `{${f.name}}` });
  }
  for (const g of schema.groups || []) {
    for (const f of g.fields || []) {
      out.push({
        paramName: `${g.name}_${f.name}`,
        moveType: MOVE_TYPE[f.type],
        fieldType: f.type,
        kind: 'nested',
        group: g.name,
        field: f.name,
        token: `{${g.name}.${f.name}}`,
      });
    }
  }
  return out;
}

/** The draggable Display tokens for a schema (flat `{field}` + nested `{group.field}`). */
export function displayTokens(schema) {
  return mintParams(schema).map((p) => p.token);
}

/** Generate the complete `display_showcase::hero` Move source for a schema. */
export function generateHeroMove(schema) {
  const errs = validateSchema(schema);
  if (errs.length) throw new Error('invalid schema:\n- ' + errs.join('\n- '));

  const { typeName, fields, groups } = schema;
  const params = mintParams(schema);
  const usesString = params.some((p) => p.fieldType === 'string');

  const imports = [
    usesString ? 'use std::string::String;' : null,
    'use sui::display_registry::{Self, DisplayRegistry};',
    'use sui::package::{Self, Publisher};',
  ].filter(Boolean).join('\n');

  // Nested group structs.
  const groupStructs = groups.map((g) => {
    const body = g.fields.map((f) => `    ${f.name}: ${MOVE_TYPE[f.type]},`).join('\n');
    return `public struct ${pascal(g.name)} has store, copy, drop {\n${body}\n}`;
  }).join('\n\n');

  // Main struct fields: flat then nested groups (field name = group name, type = Pascal).
  const mainFields = [
    '    id: UID,',
    ...fields.map((f) => `    ${f.name}: ${MOVE_TYPE[f.type]},`),
    ...groups.map((g) => `    ${g.name}: ${pascal(g.name)},`),
  ].join('\n');

  // mint signature.
  const mintSig = params.map((p) => `    ${p.paramName}: ${p.moveType},`).join('\n');

  // mint body: build each nested struct, then the main struct.
  const groupInits = groups.map((g) => {
    const assigns = g.fields.map((f) => `${f.name}: ${g.name}_${f.name}`).join(', ');
    return `    let ${g.name} = ${pascal(g.name)} { ${assigns} };`;
  }).join('\n');
  const structAssigns = [
    'id: object::new(ctx)',
    ...fields.map((f) => f.name),
    ...groups.map((g) => g.name),
  ].join(', ');

  return `#[allow(lint(self_transfer))]
module display_showcase::hero;

${imports}

/// One-time witness — consumed in \`init\` to claim the Publisher.
public struct HERO has drop {}
${groupStructs ? '\n' + groupStructs + '\n' : ''}
/// A mintable NFT. Its struct fields never change on-chain; the Display template
/// alone controls the off-chain rendered representation (the "metadata view").
public struct ${typeName} has key, store {
${mainFields}
}

/// Claim Publisher on deploy; transfer to the deployer for use in \`create_display\`.
fun init(otw: HERO, ctx: &mut TxContext) {
    transfer::public_transfer(package::claim(otw, ctx), ctx.sender());
}

/// Anyone can mint. The new object is transferred to the caller.
public fun mint(
${mintSig}
    ctx: &mut TxContext,
) {
${groupInits ? groupInits + '\n' : ''}    transfer::public_transfer(${typeName} { ${structAssigns} }, ctx.sender());
}

/// One-time setup: create an empty shared Display<${typeName}> and keep the cap.
/// Separate from \`init\` because DisplayRegistry is a shared object.
public fun create_display(
    registry: &mut DisplayRegistry,
    publisher: &mut Publisher,
    ctx: &mut TxContext,
) {
    let (display, cap) = display_registry::new_with_publisher<${typeName}>(registry, publisher, ctx);
    display_registry::share(display);
    transfer::public_transfer(cap, ctx.sender());
}
`;
}
