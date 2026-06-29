// Step 2 — one-click publish. Sends the schema + connected wallet address to the local
// bridge, which builds + test-publishes the bespoke contract, creates the Display, and
// transfers the DisplayCap to the wallet. Stores the result in DeploymentContext.
import { useEffect, useState } from 'react';
import { validateSchema } from '../schema';
import type { Schema } from '../schema';
import { bridgeHealth, publishSchema } from '../bridge';
import { useDeployment } from '../DeploymentContext';
import { useSigner } from '../SignerContext';

interface Props {
  schema: Schema;
  onPublished: () => void;
}

export function PublishStep({ schema, onPublished }: Props) {
  const { address } = useSigner();
  const { deployment, setDeployment } = useDeployment();
  const [bridgeUp, setBridgeUp] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void bridgeHealth().then((ok) => alive && setBridgeUp(ok));
    return () => { alive = false; };
  }, []);

  const schemaErrors = validateSchema(schema);
  const canPublish = !!address && bridgeUp === true && schemaErrors.length === 0 && !busy;

  async function handlePublish() {
    if (!address) return;
    setBusy(true);
    setError('');
    try {
      const result = await publishSchema(schema, address);
      setDeployment(result);
      onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>2. Publish your contract</h2>
      <p style={{ color: '#666', fontSize: '0.85rem' }}>
        The local bridge generates the Move module, builds it, publishes it to localnet,
        creates the shared <code>Display</code>, and transfers the <code>DisplayCap</code> to
        your connected wallet so you can edit the Display in step 4.
      </p>

      {bridgeUp === false && (
        <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>
          Bridge not reachable on <code>127.0.0.1:8787</code>. Start it with <code>pnpm play</code> (runs the bridge + dev server).
        </p>
      )}
      {!address && <p style={{ color: '#999', fontSize: '0.85rem' }}>Connect a wallet (or switch the signer to "Dev key") first — the DisplayCap will be sent to that address.</p>}
      {schemaErrors.length > 0 && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>Fix the schema errors in step 1 before publishing.</p>}

      <button
        type="button"
        onClick={() => void handlePublish()}
        disabled={!canPublish}
        style={{
          padding: '8px 18px', background: canPublish ? '#4f46e5' : '#bbb', color: '#fff',
          border: 'none', borderRadius: 6, fontWeight: 600, cursor: canPublish ? 'pointer' : 'not-allowed',
        }}
      >
        {busy ? 'Publishing… (build + publish can take ~20s)' : 'Publish contract'}
      </button>

      {error && (
        <pre style={{ marginTop: '1rem', color: '#dc2626', fontSize: '0.8rem', whiteSpace: 'pre-wrap', background: '#fff5f5', padding: 10, borderRadius: 6 }}>
          {error}
        </pre>
      )}

      {deployment && (
        <div style={{ marginTop: '1rem', fontSize: '0.82rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
          <strong style={{ color: '#16a34a' }}>Published!</strong>
          <table style={{ marginTop: 6, borderCollapse: 'collapse' }}>
            <tbody>
              {([
                ['Package', deployment.packageId],
                ['Display', deployment.displayId],
                ['DisplayCap', deployment.displayCapId],
              ] as const).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: '1px 10px 1px 0', color: '#555' }}>{k}</td>
                  <td style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: '6px 0 0', color: '#555' }}>Continue to <strong>Mint</strong> →</p>
        </div>
      )}
    </section>
  );
}
