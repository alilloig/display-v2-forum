import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

export const dAppKit = createDAppKit({
  networks: ['localnet'],
  defaultNetwork: 'localnet',
  createClient: (network) =>
    new SuiJsonRpcClient({ network, url: 'http://127.0.0.1:9000' }),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
