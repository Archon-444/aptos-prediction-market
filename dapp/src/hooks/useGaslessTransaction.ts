/**
 * Gasless Transaction Hook
 *
 * Uses wagmi's useSendCalls with Coinbase CDP Paymaster for gasless transactions.
 * Falls back to regular writeContractAsync for wallets that don't support EIP-5792.
 *
 * How it works:
 * - Coinbase Smart Wallet supports EIP-5792 wallet_sendCalls with paymasterService
 * - When cdpPaymasterUrl is configured and the wallet supports it, transactions are gasless
 * - For MetaMask/other wallets, falls back to normal (user pays gas)
 */

import { useCallback, useState } from 'react';
import { useSendCalls } from 'wagmi';
import { useAccount, useWriteContract } from 'wagmi';
import { type Abi, encodeFunctionData } from 'viem';
import { env } from '../config/env';

interface GaslessWriteParams {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
}

interface GaslessResult {
  writeGasless: (params: GaslessWriteParams) => Promise<string>;
  isGaslessSupported: boolean;
  isPending: boolean;
}

export function useGaslessTransaction(): GaslessResult {
  const { connector } = useAccount();
  const { sendCallsAsync } = useSendCalls();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);

  // Coinbase Smart Wallet supports EIP-5792 capabilities
  const isCoinbaseSmartWallet = connector?.id === 'coinbaseWalletSDK';
  const hasPaymasterUrl = !!env.cdpPaymasterUrl;
  const isGaslessSupported = isCoinbaseSmartWallet && hasPaymasterUrl;

  const writeGasless = useCallback(async (params: GaslessWriteParams): Promise<string> => {
    setIsPending(true);

    try {
      if (isGaslessSupported) {
        // Use EIP-5792 sendCalls with paymaster sponsorship
        const data = encodeFunctionData({
          abi: params.abi,
          functionName: params.functionName,
          args: params.args as any,
        });

        const result = await sendCallsAsync({
          calls: [{
            to: params.address,
            data,
            value: params.value ?? 0n,
          }],
          capabilities: {
            paymasterService: {
              url: env.cdpPaymasterUrl,
            },
          },
        } as any);

        // sendCallsAsync returns { id: string } — the call bundle ID
        return typeof result === 'string' ? result : (result as any).id ?? String(result);
      }

      // Fallback: regular writeContract (user pays gas)
      const hash = await writeContractAsync({
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args as any,
        value: params.value,
      } as any);

      return hash;
    } finally {
      setIsPending(false);
    }
  }, [isGaslessSupported, sendCallsAsync, writeContractAsync]);

  return { writeGasless, isGaslessSupported, isPending };
}
