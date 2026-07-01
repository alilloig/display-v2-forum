// Thin signing facade over the connected wallet. The dapp targets public networks
// (devnet today, testnet for the definitive deployment), so users sign with their own
// wallet — there is no local dev-key path anymore.
import { createContext, useCallback, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import { useDAppKit, useCurrentAccount } from '@mysten/dapp-kit-react';

/** Normalized result so callers don't deal with the TransactionResult union. */
export interface SignResult {
  ok: boolean;
  digest?: string;
  error?: string;
}

interface SignerCtx {
  /** Connected wallet address — null when no wallet is connected. */
  address: string | null;
  signAndExecute: (tx: Transaction) => Promise<SignResult>;
}

const Ctx = createContext<SignerCtx | null>(null);

export function SignerProvider({ children }: { children: ReactNode }) {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const address = account?.address ?? null;

  const signAndExecute = useCallback(
    async (tx: Transaction): Promise<SignResult> => {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.FailedTransaction) {
        return { ok: false, error: result.FailedTransaction.status.error?.message ?? 'Transaction failed' };
      }
      return { ok: true, digest: result.Transaction.digest };
    },
    [dAppKit],
  );

  return <Ctx.Provider value={{ address, signAndExecute }}>{children}</Ctx.Provider>;
}

export function useSigner(): SignerCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSigner must be used within a SignerProvider');
  return ctx;
}
