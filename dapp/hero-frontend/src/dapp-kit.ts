import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

// SDK 2.0 recommended transport: gRPC (JSON-RPC is deprecated). The default
// GrpcWebFetchTransport speaks gRPC-web over fetch, so it works in the browser.
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
