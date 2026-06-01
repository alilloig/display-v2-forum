import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { dAppKit } from './dapp-kit';
import { DeploymentProvider } from './DeploymentContext';
import { App } from './App';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <DeploymentProvider>
          <App />
        </DeploymentProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
