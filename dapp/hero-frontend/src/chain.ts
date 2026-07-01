// All chain I/O in one place: reading the connected wallet's Hero (raw content + resolved
// Display + which items are attached), and building the mint / equip / unequip transactions.
// Reads go through the transport-agnostic Core API (`client.core.*`), so they work the same
// over the gRPC client this dapp uses as over any other SDK 2.0 client.
import { useQuery } from '@tanstack/react-query';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID } from './deployment';
import { ITEMS, HERO_BASE, type Slot } from './items';

const HERO_TYPE = `${PACKAGE_ID}::hero::Hero`;

export interface HeroView {
  heroId: string;
  fields: Record<string, unknown>;
  display: Record<string, string>;
  displayError: string | null;
  equipped: Set<Slot>;
}

export function useOwnedHero(address: string | null) {
  const client = useCurrentClient();

  return useQuery<HeroView | null>({
    queryKey: ['owned-hero', address],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return null;
      const owned = await client.core.listOwnedObjects({
        owner: address,
        type: HERO_TYPE,
        include: { json: true, display: true },
      });
      // Deterministic pick when a wallet owns more than one Hero (reachable via double-mint):
      // sort by objectId so the same Hero renders across reads.
      const first = [...owned.objects].sort((a, b) => a.objectId.localeCompare(b.objectId))[0];
      if (!first) return null;

      // Which slots are filled: read the Hero's dynamic object fields. Core API returns
      // BCS-encoded field names; the keys here are Move Strings.
      const dofs = await client.core.listDynamicFields({ parentId: first.objectId });
      const equipped = new Set<Slot>();
      for (const f of dofs.dynamicFields) {
        if (!f.name.type.endsWith('::string::String')) continue;
        const key = bcs.string().parse(f.name.bcs);
        if (key === 'sword' || key === 'shield' || key === 'armor') equipped.add(key);
      }

      const display = (first.display?.output ?? {}) as Record<string, string>;
      const errors = first.display?.errors ?? null;
      return {
        heroId: first.objectId,
        fields: (first.json ?? {}) as Record<string, unknown>,
        display,
        displayError: errors
          ? Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join('; ')
          : null,
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
