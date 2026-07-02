// Deterministic lookup: the set of equipped items → the one pre-rendered composite
// sprite for that combination (8 sprites = every subset of {sword, shield, armor}).
// No runtime compositing; the artists rendered each combination in a matched pose.
// Paths are BASE_URL-relative so the app also works under a sub-path (GitHub Pages).
import type { Slot } from './items';

export function asset(path: string): string {
  return import.meta.env.BASE_URL + path;
}

const COMBO_TO_SPRITE: Record<string, string> = {
  '': 'sprites/hero.png',
  'sword': 'sprites/hero_sword.png',
  'shield': 'sprites/hero_shield.png',
  'armor': 'sprites/hero_armor.png',
  'shield,sword': 'sprites/hero_sword_shield.png',
  'armor,sword': 'sprites/hero_armor_sword.png',
  'armor,shield': 'sprites/hero_armor_shield.png',
  'armor,shield,sword': 'sprites/hero_full_equip.png',
};

/** Canonical key = equipped slots sorted alphabetically, comma-joined. */
export function spriteFor(equipped: Set<Slot>): string {
  const key = [...equipped].sort().join(',');
  return asset(COMBO_TO_SPRITE[key] ?? 'sprites/hero.png');
}
