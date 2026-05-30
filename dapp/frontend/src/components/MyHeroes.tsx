import { useQuery } from '@tanstack/react-query';
import { useCurrentClient, useCurrentAccount } from '@mysten/dapp-kit-react';
import { PACKAGE_ID } from '../deployment';

// The teaching point of this component:
// Each Hero is fetched with both showContent (raw on-chain struct fields) and
// showDisplay (resolved template output from the shared Display<Hero>).
// Displaying them side-by-side makes it viscerally clear that the object never
// changes — only the Display template changes, and the rendered output updates.

interface MyHeroesProps {
  // Increment this to trigger a refetch (e.g. after a successful mint).
  refetchTrigger: number;
}

export function MyHeroes({ refetchTrigger }: MyHeroesProps) {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const owner = account?.address;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-heroes', owner, refetchTrigger],
    queryFn: async () => {
      if (!owner) return [];

      // getOwnedObjects is the JSON-RPC method on SuiJsonRpcClient.
      // showContent  → raw Move struct fields (what is stored on-chain, immutable)
      // showDisplay  → resolved Display template output (changes when templates change)
      // showType     → object type string for filtering confirmation
      const res = await (client as unknown as {
        getOwnedObjects: (args: {
          owner: string;
          filter: { StructType: string };
          options: { showContent: boolean; showDisplay: boolean; showType: boolean };
        }) => Promise<{ data: unknown[] }>;
      }).getOwnedObjects({
        owner,
        filter: { StructType: `${PACKAGE_ID}::hero::Hero` },
        options: { showContent: true, showDisplay: true, showType: true },
      });

      return res.data;
    },
    enabled: !!owner,
  });

  // Refetch when refetchTrigger changes (called by parent after a mint)
  // useQuery already re-runs when queryKey changes (refetchTrigger is part of the key),
  // so no explicit useEffect needed.

  if (!owner) {
    return (
      <section style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
        <h2>My Heroes</h2>
        <p style={{ color: '#999' }}>Connect your wallet to see your Heroes.</p>
      </section>
    );
  }

  return (
    <section style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>My Heroes</h2>

      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>Error: {String(error)}</p>}

      {data && data.length === 0 && (
        <p style={{ color: '#999' }}>No Heroes minted yet.</p>
      )}

      {data && data.map((item, idx) => {
        // item is a SuiObjectResponse from the JSON-RPC API
        const obj = item as Record<string, unknown>;
        const objData = obj['data'] as Record<string, unknown> | undefined;
        if (!objData) return null;

        // RAW struct fields — what is permanently stored on the Hero object
        const content = objData['content'] as Record<string, unknown> | undefined;
        const fields = (content?.['fields'] ?? {}) as Record<string, unknown>;

        // RESOLVED display — the rendered template output (driven by Display<Hero>)
        const display = objData['display'] as Record<string, unknown> | undefined;
        const displayData = (display?.['data'] ?? {}) as Record<string, unknown> | null;
        // The RPC sets `error` (and leaves data null) when a template references a
        // field that cannot be resolved — surface it so bad templates are visible.
        const displayError = display?.['error'] as string | null | undefined;

        const objectId = (objData['objectId'] ?? objData['id']) as string | undefined;

        return (
          <div key={objectId ?? idx} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1.5rem',
            padding: '0.75rem',
            background: '#f9f9f9',
            borderRadius: 6,
          }}>
            {/* ---- RAW ON-CHAIN FIELDS ---- */}
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#333' }}>
                Raw struct fields <span style={{ color: '#aaa', fontWeight: 400 }}>(on-chain, never changes)</span>
              </h3>
              <table style={{ fontSize: '0.85rem', borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {Object.entries(fields).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '2px 8px 2px 0', color: '#666', whiteSpace: 'nowrap' }}>{k}</td>
                      <td style={{ padding: '2px 0', wordBreak: 'break-all' }}>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---- RESOLVED DISPLAY ---- */}
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#333' }}>
                Resolved display <span style={{ color: '#aaa', fontWeight: 400 }}>(from Display template)</span>
              </h3>
              {displayData && Object.keys(displayData).length > 0 ? (
                <table style={{ fontSize: '0.85rem', borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    {Object.entries(displayData).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ padding: '2px 8px 2px 0', color: '#666', whiteSpace: 'nowrap' }}>{k}</td>
                        <td style={{ padding: '2px 0', wordBreak: 'break-all' }}>{String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#bbb', fontSize: '0.85rem' }}>
                  No display fields set yet. Use the Display editor to add templates.
                </p>
              )}
              {displayError && (
                <p style={{ color: 'red', fontSize: '0.8rem', marginTop: 4 }}>
                  Display error: {displayError}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {data && data.length > 0 && (
        <button onClick={() => void refetch()} style={{ fontSize: '0.85rem' }}>
          Refresh
        </button>
      )}
    </section>
  );
}
