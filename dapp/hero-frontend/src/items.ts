// The fixed game catalog. These values are the source of truth the frontend passes to
// `mint_and_equip_*`, and they must stay consistent with what the Hero Display projects:
// each item's `summary` is exactly the string that appears in the resolved `inventory`.

export type Slot = 'sword' | 'shield' | 'armor';

export const SLOTS: Slot[] = ['sword', 'shield', 'armor'];

export interface ItemDef {
  slot: Slot;
  name: string;
  attack: number; // contribution to Attack
  defense: number; // contribution to Defense
  summary: string; // projected verbatim into the Hero's `inventory` Display field
  sprite: string; // per-item art (public/sprites)
}

export const HERO_BASE = {
  name: 'Aragorn',
  baseAttack: 10,
  baseDefense: 10,
  // On-chain image_url stays fixed to the base sprite — immutability. The rendered
  // composite (below) is a frontend projection of the equipped set.
  imageUrl: '/sprites/hero.png',
};

export const ITEMS: Record<Slot, ItemDef> = {
  sword: {
    slot: 'sword',
    name: 'Iron Sword',
    attack: 6,
    defense: 0,
    summary: '[Iron Sword +6 ATK] ',
    sprite: '/sprites/hero_sword.png',
  },
  shield: {
    slot: 'shield',
    name: 'Oak Shield',
    attack: 0,
    defense: 8,
    summary: '[Oak Shield +8 DEF] ',
    sprite: '/sprites/hero_shield.png',
  },
  armor: {
    slot: 'armor',
    name: 'Plate Armor',
    attack: 2,
    defense: 5,
    summary: '[Plate Armor +5 DEF +2 ATK] ',
    sprite: '/sprites/hero_armor.png',
  },
};

/** Effective stats = immutable base + contributions of the currently-equipped items.
 *  Display templates can't do arithmetic, so this sum is computed client-side; the
 *  on-chain-verifiable part is the live `inventory` projection over attached DOFs. */
export function effectiveStats(equipped: Set<Slot>) {
  let attack = HERO_BASE.baseAttack;
  let defense = HERO_BASE.baseDefense;
  for (const slot of equipped) {
    attack += ITEMS[slot].attack;
    defense += ITEMS[slot].defense;
  }
  return { attack, defense };
}
