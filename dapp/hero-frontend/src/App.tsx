// Hero Forge — connect → mint a Hero → forge & attach items (dynamic object fields) →
// watch the Hero's Display projection change while its on-chain fields stay fixed. The
// code lab below shows the Display V1→V2 code behind whatever the dapp is doing now.
import { useState } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { NETWORK } from './deployment';
import { HeroStage } from './components/HeroStage';
import { Armory } from './components/Armory';
import { CodeLab } from './components/CodeLab';
import { useOwnedHero, signAndExecute, buildMintHeroTx, buildEquipTx, buildUnequipTx } from './chain';
import { spriteFor } from './sprites';
import type { Slot } from './items';
import type { AppState } from './snippets';

export function App() {
  const client = useCurrentClient();
  const address = useCurrentAccount()?.address ?? null;
  const [pending, setPending] = useState<Slot | 'mint' | null>(null);
  const [error, setError] = useState('');

  const { data: hero, isLoading, refetch } = useOwnedHero(address);

  async function run(action: Slot | 'mint', tx: () => Transaction) {
    setPending(action);
    setError('');
    try {
      const r = await signAndExecute(tx());
      if (!r.ok) {
        setError(r.error ?? 'Transaction failed');
        return;
      }
      // Re-read only once the fullnode has indexed the transaction, otherwise
      // listOwnedObjects/listDynamicFields can return the pre-tx snapshot.
      await client.core.waitForTransaction({ digest: r.digest! });
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }

  const onMint = () => run('mint', buildMintHeroTx);
  const onEquip = (slot: Slot) => { if (hero) void run(slot, () => buildEquipTx(hero.heroId, slot)); };
  const onUnequip = (slot: Slot) => { if (hero) void run(slot, () => buildUnequipTx(hero.heroId, slot)); };

  // The code lab is driven by what is actually on chain, not by an internal step
  // counter: wallet presence, Hero presence, and whether any item is attached.
  const state: AppState = !address
    ? 'preconnect'
    : !hero
      ? 'noHero'
      : hero.equipped.size > 0
        ? 'equipped'
        : 'minted';

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', fontFamily: 'system-ui, sans-serif', color: '#111' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>⚔️ Hero Forge</h1>
          <p style={{ margin: '2px 0 0', color: '#666', fontSize: '0.85rem' }}>
            Display V2 × dynamic object fields — a mutable projection over an immutable Hero.
            <span style={{ marginLeft: 8, padding: '1px 8px', background: '#eef2ff', color: '#4f46e5', borderRadius: 999, fontSize: '0.72rem' }}>{NETWORK}</span>
          </p>
        </div>
        <ConnectButton />
      </header>

      {error && (
        <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: '0.82rem', marginBottom: 12, wordBreak: 'break-all' }}>
          {error}
        </div>
      )}

      <main style={{ marginTop: 16 }}>
        {!address ? (
          <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: 12, color: '#6b7280' }}>
            Connect a devnet wallet to begin.
          </div>
        ) : isLoading ? (
          <p style={{ color: '#6b7280' }}>Loading your hero…</p>
        ) : !hero ? (
          <div style={{ padding: '2rem', textAlign: 'center', border: '1px solid #e5e7eb', borderRadius: 12 }}>
            <img src={spriteFor(new Set())} alt="hero" style={{ width: 140, imageRendering: 'pixelated', borderRadius: 8 }} />
            <p style={{ color: '#4b5563', margin: '10px 0 14px' }}>You don't have a Hero yet. Forge one to begin.</p>
            <button
              type="button"
              onClick={() => void onMint()}
              disabled={pending !== null}
              style={{ padding: '9px 22px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: pending ? 'wait' : 'pointer' }}
            >
              {pending === 'mint' ? 'Minting…' : 'Mint Hero'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <HeroStage hero={hero} />
            <div>
              <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>Armory</h2>
              <Armory equipped={hero.equipped} busySlot={pending !== 'mint' ? pending : null} onEquip={onEquip} onUnequip={onUnequip} disabled={pending !== null} />
            </div>
          </div>
        )}
      </main>

      <CodeLab state={state} />
    </div>
  );
}
