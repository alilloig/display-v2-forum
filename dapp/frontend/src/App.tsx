import { useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { MintHero } from './components/MintHero';
import { MyHeroes } from './components/MyHeroes';
import { DisplayEditor } from './components/DisplayEditor';

export function App() {
  const account = useCurrentAccount();
  // refetchTrigger increments after a successful mint to tell MyHeroes to refetch
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Display V2 Showcase</h1>
        <ConnectButton />
      </header>

      {account ? (
        <p style={{ color: '#555' }}>Connected: {account.address}</p>
      ) : (
        <p style={{ color: '#999' }}>Connect your wallet to mint and view Heroes.</p>
      )}

      <MintHero onMinted={() => setRefetchTrigger((n) => n + 1)} />
      <MyHeroes refetchTrigger={refetchTrigger} />
      <DisplayEditor />
    </div>
  );
}
