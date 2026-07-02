// Hero Forge — connect → mint a Hero → forge & attach items (dynamic object fields) →
// watch the Hero's Display projection change while its on-chain fields stay fixed. The
// code lab below shows the Display V1→V2 code behind whatever the dapp is doing now.
import { useState } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { NETWORK, PACKAGE_ID } from './deployment';
import { HeroStage } from './components/HeroStage';
import { Armory } from './components/Armory';
import { CodeLab } from './components/CodeLab';
import { useOwnedHero, buildMintHeroTx, buildEquipTx, buildUnequipTx } from './chain';
import { spriteFor } from './sprites';
import type { Slot } from './items';
import type { AppState } from './snippets';

// Raw shape of the discriminated union the wallet signing path returns
// (see SDK 2.0 wallet-builders).
interface RawTx { digest: string; effects?: { status?: { success?: boolean; error?: string | null } } }
interface RawResult {
  Transaction?: RawTx;
  FailedTransaction?: { status?: { error?: { message?: string } | string | null }; effects?: { status?: { error?: string | null } } };
}

export function App() {
  const dAppKit = useDAppKit();
  const address = useCurrentAccount()?.address ?? null;
  const [busy, setBusy] = useState(false);
  const [busySlot, setBusySlot] = useState<Slot | null>(null);
  const [error, setError] = useState('');

  const { data: hero, isLoading, refetch } = useOwnedHero(address);

  async function run(tx: () => Transaction) {
    setError('');
    try {
      const raw = (await dAppKit.signAndExecuteTransaction({
        transaction: tx(),
      })) as unknown as RawResult;
      if (raw.FailedTransaction) {
        const err = raw.FailedTransaction.status?.error;
        const msg = typeof err === 'string' ? err : err?.message;
        setError(msg ?? raw.FailedTransaction.effects?.status?.error ?? 'Transaction failed');
        return false;
      }
      const t = raw.Transaction;
      if (t?.effects?.status && t.effects.status.success === false) {
        setError(t.effects.status.error ?? 'Transaction failed');
        return false;
      }
      // Give the fullnode a moment to index the new object state before re-reading,
      // otherwise listOwnedObjects/listDynamicFields can return the pre-tx snapshot.
      await new Promise((res) => setTimeout(res, 800));
      await refetch();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function onMint() {
    setBusy(true);
    try { await run(buildMintHeroTx); } finally { setBusy(false); }
  }
  async function onEquip(slot: Slot) {
    if (!hero) return;
    setBusySlot(slot);
    try { await run(() => buildEquipTx(hero.heroId, slot)); } finally { setBusySlot(null); }
  }
  async function onUnequip(slot: Slot) {
    if (!hero) return;
    setBusySlot(slot);
    try { await run(() => buildUnequipTx(hero.heroId, slot)); } finally { setBusySlot(null); }
  }

  // The code lab is driven by what is actually on chain, not by an internal step
  // counter: wallet presence, Hero presence, and whether any item is attached.
  const state: AppState = !address
    ? 'preconnect'
    : !hero
      ? 'noHero'
      : hero.equipped.size > 0
        ? 'equipped'
        : 'minted';

  const deployed = PACKAGE_ID && !PACKAGE_ID.startsWith('0x0000');

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

      {!deployed && (
        <div style={{ padding: 12, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: '0.85rem' }}>
          No deployment found. Run <code>pnpm publish:devnet</code> (from <code>hero-frontend/</code>) to publish the package and generate <code>deployment.ts</code>.
        </div>
      )}

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
              onClick={onMint}
              disabled={busy}
              style={{ padding: '9px 22px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: busy ? 'wait' : 'pointer' }}
            >
              {busy ? 'Minting…' : 'Mint Hero'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <HeroStage hero={hero} />
            <div>
              <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>Armory</h2>
              <Armory equipped={hero.equipped} busySlot={busySlot} onEquip={onEquip} onUnequip={onUnequip} disabled={busy || busySlot !== null} />
            </div>
          </div>
        )}
      </main>

      <CodeLab state={state} />
    </div>
  );
}
