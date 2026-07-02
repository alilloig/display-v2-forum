import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

// gRPC only — JSON-RPC is deprecated. The default GrpcWebFetchTransport speaks
// gRPC-web over fetch, so this works straight from the browser.
export const dAppKit = createDAppKit({
  networks: ['devnet'],
  defaultNetwork: 'devnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: 'https://fullnode.devnet.sui.io:443' }),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
