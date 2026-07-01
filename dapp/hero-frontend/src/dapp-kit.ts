import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { NETWORK } from './deployment';

// SDK 2.0 recommended transport: gRPC (JSON-RPC is deprecated). The default
// GrpcWebFetchTransport speaks gRPC-web over fetch, so it works in the browser.
// The target network comes from the generated deployment.ts, so the client
// always talks to the network the package was actually published on.
const URLS: Record<string, string> = {
  devnet: 'https://fullnode.devnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  localnet: 'http://127.0.0.1:9000',
};

export const dAppKit = createDAppKit({
  networks: [NETWORK],
  defaultNetwork: NETWORK,
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: URLS[network] }),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
