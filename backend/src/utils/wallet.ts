import { env } from '../config/env.js';

const SIGNING_PREFIX = 'MoveMarket::';
const seenNonces = new Map<string, number>();
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

interface VerifyWalletSignatureParams {
  signature: string;
  message: string;
  address: string;
  timestamp: string;
  nonce: string;
  publicKey: string;
}

const cleanupExpiredNonces = () => {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }
  for (const [key, timestamp] of seenNonces.entries()) {
    if (now - timestamp > env.SIGNATURE_TTL_MS) {
      seenNonces.delete(key);
    }
  }
  lastCleanup = now;
};

export const verifyWalletSignature = async ({
  signature,
  message,
  address,
  timestamp: timestampHeader,
  nonce,
  publicKey,
}: VerifyWalletSignatureParams) => {
  try {
    if (!signature || !message || !address || !timestampHeader || !nonce || !publicKey) {
      return false;
    }

    // Verify the message structure matches expected format
    const expectedMessage = `${SIGNING_PREFIX}${nonce}::${timestampHeader}`;
    if (message !== expectedMessage) {
      return false;
    }

    // Validate timestamp
    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp)) {
      return false;
    }

    const age = Date.now() - timestamp;
    if (age < 0 || age > env.SIGNATURE_TTL_MS) {
      return false;
    }

    // Check for nonce replay
    cleanupExpiredNonces();
    const cacheKey = `${address}:${nonce}`;
    if (seenNonces.has(cacheKey)) {
      console.warn('[wallet.ts] Nonce replay detected:', cacheKey);
      return false;
    }

    // M1: Implement Aptos Ed25519 signature verification
    const { Ed25519PublicKey, Ed25519Signature, AccountAddress } = await import('@aptos-labs/ts-sdk');

    try {
      const normalizedSignature = signature.startsWith('0x') ? signature : `0x${signature}`;
      const normalizedPublicKey = publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`;
      const messageBytes = new TextEncoder().encode(message);

      const sig = new Ed25519Signature(normalizedSignature);
      const pk = new Ed25519PublicKey(normalizedPublicKey);

      const verified = pk.verifySignature({ message: messageBytes, signature: sig });
      if (!verified) {
        return false;
      }

      const derivedAddress = pk.authKey().derivedAddress().toString();
      const normalizedAddress = AccountAddress.fromString(address).toString();
      if (derivedAddress.toLowerCase() !== normalizedAddress.toLowerCase()) {
        console.warn('[wallet.ts] Public key does not match provided address', {
          derivedAddress,
          normalizedAddress,
        });
        return false;
      }
    } catch (error) {
      console.error('[wallet.ts] Signature verification failed:', error);
      return false;
    }

    seenNonces.set(cacheKey, Date.now());
    return true;
  } catch (error) {
    return false;
  }
};
