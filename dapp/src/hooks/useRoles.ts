import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

import { useSDK } from '../contexts/SDKContext';
import type { MoveTransactionPayload } from '../types/aptos';
import { isValidAptosAddress, isValidSuiAddress } from '../utils/validation';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useChain, type Chain } from '../contexts/ChainContext';
import env from '../config/env';
import type { WalletAuthContext } from '../services/api/client';
import { buildAuthHeaders } from '../services/api/client';

const API_BASE = env.apiUrl.replace(/\/$/, '');

const buildUrl = (path: string) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;


// Simple headers for admin API calls that don't require wallet signing
function buildAdminHeaders(chain: string, address: string, opts?: { json?: boolean }): Record<string, string> {
  const headers: Record<string, string> = {
    'x-wallet-address': address,
    'x-wallet-chain': chain,
  };
  if (opts?.json !== false) headers['Content-Type'] = 'application/json';
  return headers;
}

export enum RoleId {
  Admin = 0,
  MarketCreator = 1,
  Resolver = 2,
  OracleManager = 3,
  Pauser = 4,
}

interface RoleState {
  loading: boolean;
  hasRole: boolean;
  error: string | null;
}

export interface UserRolesResult {
  roles: string[];
  lastSynced: Date | null;
  synced: boolean;
}

export const ROLE_CANONICAL_BY_ID: Record<RoleId, string> = {
  [RoleId.Admin]: 'ROLE_ADMIN',
  [RoleId.MarketCreator]: 'ROLE_MARKET_CREATOR',
  [RoleId.Resolver]: 'ROLE_RESOLVER',
  [RoleId.OracleManager]: 'ROLE_ORACLE_MANAGER',
  [RoleId.Pauser]: 'ROLE_PAUSER',
};

export const ROLE_LABEL_BY_CANONICAL: Record<string, string> = {
  ROLE_ADMIN: 'Admin',
  ROLE_MARKET_CREATOR: 'Market Creator',
  ROLE_RESOLVER: 'Resolver',
  ROLE_ORACLE_MANAGER: 'Oracle Manager',
  ROLE_PAUSER: 'Pauser',
};

const DEV_ROLE_ALLOWLIST = new Set([
  '0x8b81f3e0f7d2a23f89d133b580ed2822dead1de23e627f48b2efe0aa602b9467',
  '0x99b343076f69086476524bdc410f34284581424eb20679155c34f3e90cfd596f',
]);

const parseUserRolesResponse = (data: any): UserRolesResult => {
  const roles = Array.isArray(data?.roles) ? data.roles.map((role: any) => String(role)) : [];

  const lastSyncedRaw = data?.lastRoleSync ?? data?.syncedAt ?? null;
  const parsedDate = lastSyncedRaw ? new Date(lastSyncedRaw) : null;
  const lastSynced = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

  return {
    roles,
    lastSynced,
    synced: Boolean(data?.onChainRolesSynced ?? data?.syncedAt),
  };
};

const validateAddressForChain = (address: string, chain: Chain) => {
  if (chain === 'aptos') {
    if (!isValidAptosAddress(address)) {
      throw new Error('Invalid Aptos address');
    }
    return;
  }

  if (chain === 'sui') {
    if (!isValidSuiAddress(address)) {
      throw new Error('Invalid Sui address');
    }
    return;
  }

  throw new Error(`Role management is not supported on ${chain} yet`);
};

const useRoleCheck = (role: RoleId): RoleState => {
  const { address, connected, publicKey, signMessage, chain } = useUnifiedWallet();
  const { activeChain } = useChain();
  const [state, setState] = useState<RoleState>({
    loading: Boolean(address),
    hasRole: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!address || !connected) {
        setState({ loading: false, hasRole: false, error: null });
        return;
      }

      if (!publicKey || !signMessage) {
        setState({
          loading: false,
          hasRole: false,
          error: 'Wallet does not support message signing',
        });
        return;
      }

      if (import.meta.env.DEV && DEV_ROLE_ALLOWLIST.has(address.toLowerCase())) {
        setState({ loading: false, hasRole: true, error: null });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const auth: WalletAuthContext = {
          address,
          publicKey,
          chain: chain ?? activeChain,
          signMessage,
        };

        const response = await fetch(buildUrl(`/roles/${address}`), {
          headers: await buildAuthHeaders(auth),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch roles: ${response.statusText}`);
        }

        const data = await response.json();
        const userRoles: string[] = Array.isArray(data.roles) ? data.roles : [];
        const roleName = ROLE_CANONICAL_BY_ID[role];
        const hasRole = userRoles.includes(roleName);

        if (!cancelled) {
          setState({ loading: false, hasRole, error: null });
        }
      } catch (error: any) {
        console.error('[useRoleCheck] Failed to fetch role status:', error);
        if (!cancelled) {
          setState({
            loading: false,
            hasRole: false,
            error: error?.message ?? 'Unknown error',
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [address, connected, activeChain, role, publicKey, signMessage, chain]);

  return state;
};

export const useHasMarketCreatorRole = () => useRoleCheck(RoleId.MarketCreator);

export const useIsAdmin = () => useRoleCheck(RoleId.Admin);

export const useRoleManagement = () => {
  const sdk = useSDK();
  const { activeChain } = useChain();
  const unifiedWallet = useUnifiedWallet();
  const { account, signAndSubmitTransaction } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const moduleAddress = useMemo(() => {
    return typeof (sdk as any)?.getModuleAddress === 'function'
      ? (sdk as any).getModuleAddress()
      : (sdk as any)?.moduleAddress;
  }, [sdk]);

  const actorAddress = unifiedWallet.address;

  const syncRoles = useCallback(
    async (targetAddress: string, chainOverride?: Chain): Promise<UserRolesResult> => {
      const chain = chainOverride ?? activeChain;
      const trimmedAddress = targetAddress.trim();

      if (!actorAddress) {
        throw new Error('Connect an admin wallet before syncing roles');
      }

      validateAddressForChain(trimmedAddress, chain);

      const response = await fetch(buildUrl('/roles/sync'), {
        method: 'POST',
        headers: buildAdminHeaders(chain, actorAddress),
        body: JSON.stringify({
          walletAddress: trimmedAddress,
          chain,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync roles: ${response.statusText}`);
      }

      const data = await response.json();
      return parseUserRolesResponse(data);
    },
    [actorAddress, activeChain]
  );

  const getUserRoles = useCallback(
    async (targetAddress: string, options?: { sync?: boolean }): Promise<UserRolesResult> => {
      const trimmedAddress = targetAddress.trim();
      const chain = activeChain;

      validateAddressForChain(trimmedAddress, chain);

      if (!actorAddress) {
        throw new Error('Connect an admin wallet before fetching roles');
      }

      if (options?.sync) {
        await syncRoles(trimmedAddress, chain);
      }

      const response = await fetch(buildUrl(`/roles/${trimmedAddress}`), {
        headers: buildAdminHeaders(chain, actorAddress, { json: false }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch roles: ${response.statusText}`);
      }

      const data = await response.json();
      return parseUserRolesResponse(data);
    },
    [actorAddress, activeChain, syncRoles]
  );

  const executeAptosRoleTransaction = useCallback(
    async (targetAddress: string, role: RoleId, action: 'grant' | 'revoke') => {
      if (!account || !signAndSubmitTransaction) {
        throw new Error('Wallet not connected');
      }

      if (!moduleAddress) {
        throw new Error('Module address is not configured');
      }

      if (!isValidAptosAddress(targetAddress)) {
        throw new Error('Invalid Aptos address');
      }

      const payload: MoveTransactionPayload = {
        function: `${moduleAddress}::access_control::${action === 'grant' ? 'grant_role' : 'revoke_role'}`,
        functionArguments: [targetAddress, role],
        typeArguments: [],
      };

      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: payload as any,
      });

      return response.hash;
    },
    [account, moduleAddress, signAndSubmitTransaction]
  );

  const runRoleMutation = useCallback(
    async (targetAddress: string, role: RoleId, action: 'grant' | 'revoke'): Promise<string | null> => {
      setIsProcessing(true);
      setError(null);

      const trimmedAddress = targetAddress.trim();
      const canonicalRole = ROLE_CANONICAL_BY_ID[role];

      try {
        if (!actorAddress) {
          throw new Error('Connect an admin wallet before managing roles');
        }

        if (activeChain === 'aptos') {
          const hash = await executeAptosRoleTransaction(trimmedAddress, role, action);

          await fetch(buildUrl(`/roles/${action}`), {
            method: 'POST',
            headers: buildAdminHeaders('aptos', actorAddress),
            body: JSON.stringify({
              walletAddress: trimmedAddress,
              role: canonicalRole,
              transactionHash: hash,
              chain: 'aptos',
            }),
          }).catch((recordError) => {
            console.warn('[useRoleManagement] Failed to record Aptos role change:', recordError);
          });

          await syncRoles(trimmedAddress, 'aptos');
          return hash;
        }

        // Sui path delegates to backend signer (admin cap)
        await fetch(buildUrl(`/roles/${action}`), {
          method: 'POST',
          headers: buildAdminHeaders('sui', actorAddress),
          body: JSON.stringify({
            walletAddress: trimmedAddress,
            role: canonicalRole,
            chain: 'sui',
          }),
        });

        await syncRoles(trimmedAddress, 'sui');
        return null;
      } catch (err: any) {
        const wrapped = err instanceof Error ? err : new Error(err?.message ?? 'Role operation failed');
        setError(wrapped);
        throw wrapped;
      } finally {
        setIsProcessing(false);
      }
    },
    [actorAddress, activeChain, executeAptosRoleTransaction, syncRoles]
  );

  const grantRole = useCallback(
    (targetAddress: string, role: RoleId) => runRoleMutation(targetAddress, role, 'grant'),
    [runRoleMutation]
  );

  const revokeRole = useCallback(
    (targetAddress: string, role: RoleId) => runRoleMutation(targetAddress, role, 'revoke'),
    [runRoleMutation]
  );

  return {
    grantRole,
    revokeRole,
    getUserRoles,
    syncRoles,
    isProcessing,
    error,
  };
};
