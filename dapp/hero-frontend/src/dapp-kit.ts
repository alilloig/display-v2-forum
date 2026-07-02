import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { NETWORK } from './deployment';

// gRPC only — JSON-RPC is deprecated. The default GrpcWebFetchTransport speaks
// gRPC-web over fetch, so this works straight from the browser. The network comes
// from the generated deployment.ts, so retargeting the publish script retargets
// the client with it.
export const dAppKit = createDAppKit({
  networks: [NETWORK],
  defaultNetwork: NETWORK,
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: `https://fullnode.${network}.sui.io:443` }),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
