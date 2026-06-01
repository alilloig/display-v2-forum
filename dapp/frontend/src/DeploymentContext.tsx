// Holds the live deployment (package id, Display/cap ids, published schema) in React
// state, populated by the Publish step. The app reads ids from here rather than a static
// deployment.ts import, so a fresh publish updates the running app with no reload.
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Deployment } from './bridge';

interface DeploymentCtx {
  deployment: Deployment | null;
  setDeployment: (d: Deployment | null) => void;
}

const Ctx = createContext<DeploymentCtx | null>(null);

export function DeploymentProvider({ children }: { children: ReactNode }) {
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  return <Ctx.Provider value={{ deployment, setDeployment }}>{children}</Ctx.Provider>;
}

export function useDeployment(): DeploymentCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDeployment must be used within a DeploymentProvider');
  return ctx;
}
