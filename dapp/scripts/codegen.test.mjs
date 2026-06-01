// Codegen tests: feed schemas through generateHeroMove() and assert the emitted Move
// compiles (`sui move build --build-env testnet`); assert invalid schemas are rejected.
//
// Run: node --test dapp/scripts/codegen.test.mjs   (from the repo/worktree root)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateHeroMove, validateSchema, DEFAULT_SCHEMA } from '../frontend/src/schema.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const MOVE_TOML = `[package]
name = "display_showcase"
edition = "2024"

[addresses]
display_showcase = "0x0"
`;

/** Write a generated package to a temp dir and run `sui move build --build-env testnet`. */
function buildSchema(schema) {
  const dir = mkdtempSync(join(tmpdir(), 'codegen-'));
  try {
    mkdirSync(join(dir, 'sources'), { recursive: true });
    writeFileSync(join(dir, 'Move.toml'), MOVE_TOML);
    writeFileSync(join(dir, 'sources', 'hero.move'), generateHeroMove(schema));
    execFileSync('sui', ['move', 'build', '--build-env', 'testnet'], {
      cwd: dir,
      stdio: 'pipe',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('default sample schema compiles', () => {
  buildSchema(DEFAULT_SCHEMA);
});

test('all flat types compile', () => {
  buildSchema({
    typeName: 'Gadget',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'score', type: 'u64' },
      { name: 'shiny', type: 'bool' },
    ],
    groups: [],
  });
});

test('nested groups compile (incl. same field name across groups)', () => {
  buildSchema({
    typeName: 'Creature',
    fields: [{ name: 'name', type: 'string' }],
    groups: [
      { name: 'stats', fields: [{ name: 'strength', type: 'u64' }, { name: 'defense', type: 'u64' }] },
      { name: 'meta', fields: [{ name: 'strength', type: 'u64' }, { name: 'legendary', type: 'bool' }] },
    ],
  });
});

test('schema with no string field compiles (no unused String import)', () => {
  buildSchema({
    typeName: 'Counter',
    fields: [{ name: 'count', type: 'u64' }, { name: 'active', type: 'bool' }],
    groups: [],
  });
});

test('validateSchema rejects bad identifiers, reserved words, empties, dupes', () => {
  assert.ok(validateSchema({ typeName: 'hero', fields: [{ name: 'x', type: 'u64' }], groups: [] }).length, 'lowercase typeName');
  assert.ok(validateSchema({ typeName: 'Hero', fields: [{ name: 'Name', type: 'string' }], groups: [] }).length, 'PascalCase field');
  assert.ok(validateSchema({ typeName: 'Hero', fields: [{ name: 'id', type: 'u64' }], groups: [] }).length, 'reserved id');
  assert.ok(validateSchema({ typeName: 'Hero', fields: [], groups: [] }).length, 'no fields');
  assert.ok(validateSchema({ typeName: 'Hero', fields: [{ name: 'a', type: 'u64' }, { name: 'a', type: 'bool' }], groups: [] }).length, 'dup field');
  assert.ok(validateSchema({ typeName: 'Hero', fields: [{ name: 'q', type: 'u128' }], groups: [] }).length, 'bad type');
  assert.equal(validateSchema(DEFAULT_SCHEMA).length, 0, 'default schema is valid');
});

void HERE;
