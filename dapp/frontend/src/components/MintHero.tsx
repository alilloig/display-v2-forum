import { useState } from 'react';
import type { FormEvent } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useDAppKit, useCurrentAccount } from '@mysten/dapp-kit-react';
import { PACKAGE_ID } from '../deployment';

interface MintHeroProps {
  onMinted?: () => void;
}

export function MintHero({ onMinted }: MintHeroProps) {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [species, setSpecies] = useState('');
  const [power, setPower] = useState('100');
  const [level, setLevel] = useState('1');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const isConnected = account !== null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isConnected) return;

    // power/level map to Move u64. BigInt() throws on decimals/non-digits, which
    // would otherwise surface as a cryptic error, so validate them as whole
    // non-negative numbers up front.
    if (!/^\d+$/.test(power) || !/^\d+$/.test(level)) {
      setStatus('Error: power and level must be whole, non-negative numbers');
      return;
    }

    setBusy(true);
    setStatus('Minting…');

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::hero::mint`,
        arguments: [
          tx.pure.string(name),
          tx.pure.string(imageUrl),
          tx.pure.string(species),
          tx.pure.u64(BigInt(power)),
          tx.pure.u64(BigInt(level)),
        ],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      if (result.FailedTransaction) {
        // Surface the on-chain failure reason so the user can act on it
        const errMsg = result.FailedTransaction.status.error?.message ?? 'Transaction failed';
        setStatus(`Error: ${errMsg}`);
      } else {
        setStatus(`Minted! Digest: ${result.Transaction.digest}`);
        // Reset the form and notify the parent to refetch the hero list
        setName('');
        setImageUrl('');
        setSpecies('');
        setPower('100');
        setLevel('1');
        onMinted?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>Mint a Hero</h2>
      <form onSubmit={(e) => { void handleSubmit(e); }}>
        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
          <label>
            Name{' '}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Image URL{' '}
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required />
          </label>
          <label>
            Species{' '}
            <input value={species} onChange={(e) => setSpecies(e.target.value)} required />
          </label>
          <label>
            Power{' '}
            <input type="number" value={power} min="0" step="1" onChange={(e) => setPower(e.target.value)} required />
          </label>
          <label>
            Level{' '}
            <input type="number" value={level} min="1" step="1" onChange={(e) => setLevel(e.target.value)} required />
          </label>
        </div>
        <button type="submit" disabled={!isConnected || busy}>
          {busy ? 'Minting…' : 'Mint Hero'}
        </button>
        {!isConnected && <span style={{ marginLeft: '0.5rem', color: '#999' }}>Connect wallet to mint</span>}
      </form>
      {status && <p style={{ marginTop: '0.5rem', color: status.startsWith('Error') ? 'red' : 'green' }}>{status}</p>}
    </section>
  );
}
