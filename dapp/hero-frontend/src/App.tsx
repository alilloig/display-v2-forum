// Hero Forge — connect → mint a Hero → forge & attach items (dynamic object fields) →
// watch the Hero's Display projection change while its on-chain fields stay fixed. The
// bottom panel narrates the Display V1→V2 difference behind each step.
import { useState } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { NETWORK, PACKAGE_ID } from './deployment';
import { HeroStage } from './components/HeroStage';
import { Armory } from './components/Armory';
import { LessonPanel } from './components/LessonPanel';
import { useOwnedHero, useSignAndExecute, buildMintHeroTx, buildEquipTx, buildUnequipTx } from './chain';
import { spriteFor } from './sprites';
import type { Slot } from './items';
import { deriveCycle, type CycleAction } from './lessons';
import { alertBanner, primaryButton } from './styles';

export function App() {
  const address = useCurrentAccount()?.address ?? null;
  const signAndExecute = useSignAndExecute();
  const client = useCurrentClient();
  const [lastAction, setLastAction] = useState<CycleAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [busySlot, setBusySlot] = useState<Slot | null>(null);
  const [error, setError] = useState('');

  const { data: hero, isLoading, refetch } = useOwnedHero(address);

  async function run(tx: () => Transaction, action: CycleAction): Promise<void> {
    setError('');
    try {
      const r = await signAndExecute(tx());
      if (!r.ok) { setError(r.error ?? 'Transaction failed'); return; }
      setLastAction(action);
      // Wait until the fullnode has indexed the transaction before re-reading,
      // otherwise listOwnedObjects/listDynamicFields can return the pre-tx snapshot.
      if (r.digest) await client.core.waitForTransaction({ digest: r.digest });
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onMint() {
    setBusy(true);
    try { await run(buildMintHeroTx, 'mint'); } finally { setBusy(false); }
  }
  async function onEquip(slot: Slot) {
    if (!hero) return;
    setBusySlot(slot);
    try { await run(() => buildEquipTx(hero.heroId, slot), 'equip'); } finally { setBusySlot(null); }
  }
  async function onUnequip(slot: Slot) {
    if (!hero) return;
    setBusySlot(slot);
    try { await run(() => buildUnequipTx(hero.heroId, slot), 'unequip'); } finally { setBusySlot(null); }
  }

  const { phase, pos } = deriveCycle({
    connected: !!address,
    hasHero: !!hero,
    equipped: hero?.equipped.size ?? 0,
    lastAction,
  });

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
        <div style={alertBanner}>
          No deployment found. Run <code>pnpm publish:devnet</code> (from <code>hero-frontend/</code>) to publish the package and generate <code>deployment.ts</code>.
        </div>
      )}

      {error && (
        <div style={{ ...alertBanner, marginBottom: 12, wordBreak: 'break-all' }}>
          {error}
        </div>
      )}

      <main style={{ marginTop: 16 }}>
        {!address ? (
          <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: 12, color: '#6b7280' }}>
            Connect a wallet to begin — the dapp runs against {NETWORK}, so any Sui wallet on {NETWORK} works.
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
              style={{ ...primaryButton, padding: '9px 22px', borderRadius: 8, fontSize: '0.95rem', cursor: busy ? 'wait' : 'pointer' }}
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

      <LessonPanel phase={phase} pos={pos} />
    </div>
  );
}
