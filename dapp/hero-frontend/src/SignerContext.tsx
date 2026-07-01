// Abstracts "who signs" behind one interface so the wizard works with either a browser
// wallet OR a local dev keypair. The dev-key path exists because a hosted wallet (Slush
// web/zkLogin) can't transact against a private localnet; a faucet-funded Ed25519 key can,
// and it enables hands-free / automated end-to-end testing.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Transaction } from '@mysten/sui/transactions';
import { useDAppKit, useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';

export type SignerMode = 'wallet' | 'devkey';

/** Normalized result so callers don't care which path signed. */
export interface SignResult {
  ok: boolean;
  digest?: string;
  error?: string;
}

interface SignerCtx {
  mode: SignerMode;
  setMode: (m: SignerMode) => void;
  /** Active address (connected wallet, or the dev keypair) — null if wallet mode with no wallet. */
  address: string | null;
  signAndExecute: (tx: Transaction) => Promise<SignResult>;
  devAddress: string;
  fundDevKey: () => Promise<void>;
}

const GAS_BUDGET = 100_000_000n; // explicit so the client skips simulateTransaction (unsupported on localnet)
const LS_KEY = 'displayv2_devkey_secret';
const FAUCET_URL = 'http://127.0.0.1:9123/gas';

// Raw shapes of the discriminated union both signing paths return (see SDK 2.0 wallet-builders).
interface RawTx { digest: string; effects?: { status?: { success?: boolean; error?: string | null } } }
interface RawResult {
  Transaction?: RawTx;
  FailedTransaction?: { status?: { error?: { message?: string } | string | null }; effects?: { status?: { error?: string | null } } };
}

function loadOrCreateKeypair(): Ed25519Keypair {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    try { return Ed25519Keypair.fromSecretKey(saved); } catch { /* fall through to regenerate */ }
  }
  const kp = Ed25519Keypair.generate();
  localStorage.setItem(LS_KEY, kp.getSecretKey());
  return kp;
}

const Ctx = createContext<SignerCtx | null>(null);

export function SignerProvider({ children }: { children: ReactNode }) {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const [mode, setMode] = useState<SignerMode>('wallet');

  const keypair = useMemo(() => loadOrCreateKeypair(), []);
  const devAddress = useMemo(() => keypair.getPublicKey().toSuiAddress(), [keypair]);

  const address = mode === 'wallet' ? account?.address ?? null : devAddress;

  const signAndExecute = useCallback(
    async (tx: Transaction): Promise<SignResult> => {
      tx.setGasBudget(GAS_BUDGET);
      const raw = (mode === 'wallet'
        ? await dAppKit.signAndExecuteTransaction({ transaction: tx })
        : await (keypair as unknown as {
            signAndExecuteTransaction: (a: { transaction: Transaction; client: unknown }) => Promise<RawResult>;
          }).signAndExecuteTransaction({ transaction: tx, client })) as unknown as RawResult;

      if (raw.FailedTransaction) {
        const err = raw.FailedTransaction.status?.error;
        const msg = typeof err === 'string' ? err : err?.message;
        return { ok: false, error: msg ?? raw.FailedTransaction.effects?.status?.error ?? 'Transaction failed' };
      }
      const t = raw.Transaction!;
      if (t.effects?.status && t.effects.status.success === false) {
        return { ok: false, error: t.effects.status.error ?? 'Transaction failed' };
      }
      return { ok: true, digest: t.digest };
    },
    [mode, dAppKit, keypair, client],
  );

  const fundDevKey = useCallback(async () => {
    await fetch(FAUCET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ FixedAmountRequest: { recipient: devAddress } }),
    });
  }, [devAddress]);

  return (
    <Ctx.Provider value={{ mode, setMode, address, signAndExecute, devAddress, fundDevKey }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSigner(): SignerCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSigner must be used within a SignerProvider');
  return ctx;
}
