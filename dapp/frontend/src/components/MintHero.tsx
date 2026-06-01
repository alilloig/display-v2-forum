// Step 3 — mint. Inputs are generated from the published schema; arguments are built in
// the exact order mintParams() defines (the same order codegen emits the Move signature).
import { useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useDAppKit, useCurrentAccount } from '@mysten/dapp-kit-react';
import { mintParams } from '../schema';
import { useDeployment } from '../DeploymentContext';

interface MintHeroProps {
  onMinted?: () => void;
}

export function MintHero({ onMinted }: MintHeroProps) {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const { deployment } = useDeployment();

  const params = deployment ? mintParams(deployment.schema) : [];
  // value map keyed by paramName: strings/numbers as string, bool as boolean
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  if (!deployment) return null;
  const isConnected = account !== null;
  const val = (k: string, fallback: string | boolean) => (k in values ? values[k] : fallback);

  async function handleSubmit() {
    if (!isConnected || !deployment) return;

    // u64 inputs must be whole non-negative numbers (BigInt throws otherwise).
    for (const p of params) {
      if (p.fieldType === 'u64' && !/^\d+$/.test(String(val(p.paramName, '')))) {
        setStatus(`Error: "${p.field}" must be a whole, non-negative number`);
        return;
      }
    }

    setBusy(true);
    setStatus('Minting…');
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${deployment.packageId}::hero::mint`,
        arguments: params.map((p) => {
          const v = val(p.paramName, p.fieldType === 'bool' ? false : '');
          if (p.fieldType === 'string') return tx.pure.string(String(v));
          if (p.fieldType === 'u64') return tx.pure.u64(BigInt(String(v)));
          return tx.pure.bool(Boolean(v));
        }),
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.FailedTransaction) {
        setStatus(`Error: ${result.FailedTransaction.status.error?.message ?? 'Transaction failed'}`);
      } else {
        setStatus(`Minted! Digest: ${result.Transaction.digest}`);
        setValues({});
        onMinted?.();
      }
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>3. Mint a {deployment.schema.typeName}</h2>
      <p style={{ color: '#666', fontSize: '0.85rem' }}>One input per field you designed. These values are stored on-chain, immutably.</p>

      <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}>
        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem', maxWidth: 480 }}>
          {params.map((p) => (
            <label key={p.paramName} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
              <span style={{ width: 160, color: '#555', fontFamily: 'monospace' }}>
                {p.kind === 'nested' ? `${p.group}.${p.field}` : p.field}
                <span style={{ color: '#aaa' }}> : {p.fieldType}</span>
              </span>
              {p.fieldType === 'bool' ? (
                <input
                  type="checkbox"
                  checked={Boolean(val(p.paramName, false))}
                  onChange={(e) => setValues((s) => ({ ...s, [p.paramName]: e.target.checked }))}
                />
              ) : (
                <input
                  type={p.fieldType === 'u64' ? 'number' : 'text'}
                  min={p.fieldType === 'u64' ? '0' : undefined}
                  step={p.fieldType === 'u64' ? '1' : undefined}
                  value={String(val(p.paramName, ''))}
                  onChange={(e) => setValues((s) => ({ ...s, [p.paramName]: e.target.value }))}
                  required
                  style={{ flex: 1, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}
                />
              )}
            </label>
          ))}
        </div>
        <button type="submit" disabled={!isConnected || busy} style={{ padding: '6px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Minting…' : `Mint ${deployment.schema.typeName}`}
        </button>
        {!isConnected && <span style={{ marginLeft: '0.5rem', color: '#999' }}>Connect wallet to mint</span>}
      </form>
      {status && <p style={{ marginTop: '0.5rem', color: status.startsWith('Error') ? 'red' : 'green', fontSize: '0.85rem', wordBreak: 'break-all' }}>{status}</p>}
    </section>
  );
}
