// All chain I/O in one place: reading the connected wallet's Hero (raw content + resolved
// Display + which items are attached), and building the mint / equip / unequip transactions.
import { useQuery } from '@tanstack/react-query';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID } from './deployment';
import { ITEMS, HERO_BASE, type Slot } from './items';

const HERO_TYPE = `${PACKAGE_ID}::hero::Hero`;

// Minimal structural views over the loosely-typed SDK 2.0 client responses.
interface ReadClient {
  getOwnedObjects: (a: {
    owner: string;
    filter: { StructType: string };
    options: { showContent: boolean; showDisplay: boolean };
  }) => Promise<{ data: Array<{ data?: RawObj }> }>;
  getDynamicFields: (a: { parentId: string }) => Promise<{ data: Array<{ name: { value: unknown }; objectType: string }> }>;
}
interface RawObj {
  objectId?: string;
  content?: { fields?: Record<string, unknown> };
  display?: { data?: Record<string, string> | null; error?: string | null };
}

export interface HeroView {
  heroId: string;
  fields: Record<string, unknown>;
  display: Record<string, string>;
  displayError: string | null;
  equipped: Set<Slot>;
}

export function useOwnedHero(address: string | null) {
  const client = useCurrentClient() as unknown as ReadClient;

  return useQuery<HeroView | null>({
    queryKey: ['owned-hero', address],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return null;
      const owned = await client.getOwnedObjects({
        owner: address,
        filter: { StructType: HERO_TYPE },
        options: { showContent: true, showDisplay: true },
      });
      const first = owned.data.find((o) => o.data?.objectId)?.data;
      if (!first?.objectId) return null;

      // Which slots are filled: read the Hero's dynamic object fields.
      const dofs = await client.getDynamicFields({ parentId: first.objectId });
      const equipped = new Set<Slot>();
      for (const f of dofs.data) {
        const key = String(f.name.value);
        if (key === 'sword' || key === 'shield' || key === 'armor') equipped.add(key);
      }

      return {
        heroId: first.objectId,
        fields: first.content?.fields ?? {},
        display: first.display?.data ?? {},
        displayError: first.display?.error ?? null,
        equipped,
      };
    },
  });
}

/** PTB: mint a Hero with the fixed base stats and transfer it to the caller. */
export function buildMintHeroTx(): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::hero::mint_hero`,
    arguments: [
      tx.pure.string(HERO_BASE.name),
      tx.pure.string(HERO_BASE.imageUrl),
      tx.pure.u64(BigInt(HERO_BASE.baseAttack)),
      tx.pure.u64(BigInt(HERO_BASE.baseDefense)),
    ],
  });
  return tx;
}

/** PTB: mint the item for `slot` and attach it to `heroId` as a dynamic object field. */
export function buildEquipTx(heroId: string, slot: Slot): Transaction {
  const item = ITEMS[slot];
  const tx = new Transaction();
  const common = [
    tx.object(heroId),
    tx.pure.string(item.name),
    tx.pure.string(item.sprite),
  ];
  // Armor carries two stats; sword/shield one — mirroring the Move signatures.
  if (slot === 'armor') {
    tx.moveCall({
      target: `${PACKAGE_ID}::hero::mint_and_equip_${slot}`,
      // (hero, name, image_url, attack, defense, summary, ctx)
      arguments: [...common, tx.pure.u64(BigInt(item.attack)), tx.pure.u64(BigInt(item.defense)), tx.pure.string(item.summary)],
    });
  } else {
    const stat = slot === 'sword' ? item.attack : item.defense;
    tx.moveCall({
      target: `${PACKAGE_ID}::hero::mint_and_equip_${slot}`,
      // (hero, name, image_url, attack|defense, summary, ctx)
      arguments: [...common, tx.pure.u64(BigInt(stat)), tx.pure.string(item.summary)],
    });
  }
  return tx;
}

/** PTB: detach the item in `slot`, returning it to the caller. */
export function buildUnequipTx(heroId: string, slot: Slot): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${PACKAGE_ID}::hero::unequip_${slot}`, arguments: [tx.object(heroId)] });
  return tx;
}
