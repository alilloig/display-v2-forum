// Toggle between signing with a browser wallet and a local dev keypair. The dev key is
// a faucet-funded devnet key for hands-free testing — no wallet popups.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import { useSigner } from '../SignerContext';

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function SignerBar() {
  const { mode, setMode, devAddress, fundDevKey } = useSigner();
  const client = useCurrentClient();
  const [funding, setFunding] = useState(false);

  const { data: balance, refetch } = useQuery({
    queryKey: ['dev-balance', devAddress],
    queryFn: async () => {
      const res = await client.core.getBalance({ owner: devAddress });
      return res.balance.balance;
    },
    enabled: mode === 'devkey',
    refetchInterval: mode === 'devkey' ? 4000 : false,
  });

  async function handleFund() {
    setFunding(true);
    try {
      await fundDevKey();
      await new Promise((r) => setTimeout(r, 1500));
      await refetch();
    } finally {
      setFunding(false);
    }
  }

  const tab = (m: 'wallet' | 'devkey', label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      style={{
        padding: '3px 12px', fontSize: '0.8rem', borderRadius: 6, cursor: 'pointer',
        border: mode === m ? '2px solid #4f46e5' : '1px solid #ccc',
        background: mode === m ? '#eef2ff' : '#fff', fontWeight: mode === m ? 700 : 500,
      }}
    >
      {label}
    </button>
  );

  const sui = balance ? (Number(balance) / 1e9).toFixed(2) : '0';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
      <span style={{ color: '#777' }}>Signer:</span>
      {tab('wallet', 'Wallet')}
      {tab('devkey', 'Dev key')}
      {mode === 'devkey' && (
        <>
          <span style={{ fontFamily: 'monospace', color: '#555' }} title={devAddress}>{short(devAddress)}</span>
          <span style={{ color: '#555' }}>{sui} SUI</span>
          <button type="button" onClick={() => void handleFund()} disabled={funding} style={{ fontSize: '0.78rem', padding: '2px 10px', borderRadius: 6, cursor: 'pointer' }}>
            {funding ? 'Funding…' : 'Fund from faucet'}
          </button>
          <span style={{ color: '#999' }}>local key — automated signing, no wallet popups</span>
        </>
      )}
    </div>
  );
}
