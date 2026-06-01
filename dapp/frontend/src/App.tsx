import { useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { DEFAULT_SCHEMA } from './schema';
import type { Schema } from './schema';
import { useDeployment } from './DeploymentContext';
import { Stepper } from './components/Stepper';
import { TraitDesigner } from './components/TraitDesigner';
import { PublishStep } from './components/PublishStep';
import { MintHero } from './components/MintHero';
import { MyHeroes } from './components/MyHeroes';
import { DisplayEditor } from './components/DisplayEditor';

const STEPS = ['Design traits', 'Publish', 'Mint', 'Display playground'];

export function App() {
  const account = useCurrentAccount();
  const { deployment } = useDeployment();
  const [step, setStep] = useState(0);
  const [schema, setSchema] = useState<Schema>(() => structuredClone(DEFAULT_SCHEMA));
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Step gating: Publish needs a wallet; Mint/Display need a published deployment.
  const canGoTo = (i: number) => {
    if (i === 1) return !!account;
    if (i === 2 || i === 3) return !!deployment;
    return true;
  };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '1rem', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Display V2 Playground</h1>
          <p style={{ margin: '2px 0 0', color: '#777', fontSize: '0.85rem' }}>
            Design an NFT's traits → publish → mint → compose a metadata view over them.
          </p>
        </div>
        <ConnectButton />
      </header>

      <Stepper steps={STEPS} current={step} canGoTo={canGoTo} onSelect={setStep} />

      <div style={{ border: '1px solid #eee', borderRadius: 10, padding: '1.25rem' }}>
        {step === 0 && <TraitDesigner schema={schema} onChange={setSchema} />}
        {step === 1 && <PublishStep schema={schema} onPublished={() => setStep(2)} />}
        {step === 2 && (
          <>
            <MintHero onMinted={() => setRefetchTrigger((n) => n + 1)} />
            <div style={{ marginTop: '1.5rem' }}>
              <MyHeroes refetchTrigger={refetchTrigger} />
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <DisplayEditor />
            <div style={{ marginTop: '1.5rem' }}>
              <MyHeroes refetchTrigger={refetchTrigger} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
