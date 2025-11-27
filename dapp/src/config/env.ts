/**
 * Environment configuration
 * Centralized access to environment variables
 * Vite exposes env vars via import.meta.env
 */

export const BRIDGED_WUSDC_COIN_TYPE =
  '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN';

export const env = {
  // Mode
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,

  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',

  // Blockchain Configuration
  // Aptos contract address (required for Aptos chain)
  aptosModuleAddress: import.meta.env.VITE_APTOS_MODULE_ADDRESS || '0x1',
  aptosUsdcAddress: import.meta.env.VITE_APTOS_USDC_ADDRESS || '',

  // Sui contract configuration (optional - only needed for Sui chain)
  suiPackageId: import.meta.env.VITE_SUI_PACKAGE_ID || '',
  suiTreasuryId: import.meta.env.VITE_SUI_TREASURY_ID || '',
  suiRoleRegistryId: import.meta.env.VITE_SUI_ROLE_REGISTRY_ID || '',
  suiOracleRegistryId: import.meta.env.VITE_SUI_ORACLE_REGISTRY_ID || '',
  suiUsdcCoinType: import.meta.env.VITE_SUI_USDC_COIN_TYPE || '',

  // Network configuration
  aptosNetwork: (import.meta.env.VITE_APTOS_NETWORK || 'testnet') as 'devnet' | 'testnet' | 'mainnet',
  suiNetwork: (import.meta.env.VITE_SUI_NETWORK || 'testnet') as 'devnet' | 'testnet' | 'mainnet',

  // Active chains (comma-separated: 'aptos', 'sui', or 'aptos,sui')
  activeChains: (import.meta.env.VITE_ACTIVE_CHAINS || 'aptos').split(',').map(c => c.trim()),

  // Feature flags
  enablePushNotifications: import.meta.env.VITE_ENABLE_PUSH_NOTIFICATIONS === 'true',
  enableBiometricAuth: import.meta.env.VITE_ENABLE_BIOMETRIC_AUTH === 'true',
  enableServiceWorker: import.meta.env.VITE_ENABLE_SERVICE_WORKER === 'true',

  // Logging
  logLevel: import.meta.env.VITE_LOG_LEVEL || (import.meta.env.DEV ? 'DEBUG' : 'INFO'),
} as const;

/**
 * Validate required environment variables
 * Call this at app startup to fail fast if configuration is missing
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check active chains
  const activeChains = env.activeChains;

  if (activeChains.includes('aptos')) {
    // Aptos configuration required
    if (env.aptosModuleAddress === '0x1') {
      warnings.push('VITE_APTOS_MODULE_ADDRESS (using placeholder 0x1)');
    }
  }

  if (activeChains.includes('sui')) {
    // Sui configuration required
    if (!env.suiPackageId) {
      missing.push('VITE_SUI_PACKAGE_ID (required for Sui chain)');
    }
    if (!env.suiRoleRegistryId) {
      missing.push('VITE_SUI_ROLE_REGISTRY_ID (required for Sui access control)');
    }
    if (!env.suiOracleRegistryId) {
      missing.push('VITE_SUI_ORACLE_REGISTRY_ID (required for Sui oracle verification)');
    }
    if (!env.suiUsdcCoinType) {
      missing.push('VITE_SUI_USDC_COIN_TYPE (required for Sui native USDC)');
    } else if (env.suiUsdcCoinType === BRIDGED_WUSDC_COIN_TYPE) {
      missing.push('VITE_SUI_USDC_COIN_TYPE must point to native Circle USDC (bridged wUSDC is unsupported)');
    }
  }

  // Production validation is strict
  if (env.isProduction) {
    if (missing.length > 0 || warnings.length > 0) {
      throw new Error(
        `Missing or invalid required environment variables:\n` +
        `${[...missing, ...warnings].join('\n')}\n\n` +
        `Please configure all required variables in your .env file.\n` +
        `Active chains: ${activeChains.join(', ')}`
      );
    }
  }

  // Development warnings
  if (warnings.length > 0) {
    console.warn(
      `⚠️  Using placeholder environment variables:\n${warnings.join('\n')}\n` +
      `This is OK for development but will fail in production.`
    );
  }

  if (missing.length > 0) {
    console.error(
      `❌ Missing required environment variables:\n${missing.join('\n')}\n` +
      `Some features may not work correctly.`
    );
  }
}

// Backward compatibility helper (DEPRECATED - to be removed)
// @deprecated Use env.aptosModuleAddress instead
export const getContractAddress = () => {
  console.warn('getContractAddress() is deprecated. Use env.aptosModuleAddress instead.');
  return env.aptosModuleAddress;
};

export default env;
