/**
 * Role Verification Service (M2)
 *
 * This service verifies user roles against the on-chain RBAC (Role-Based Access Control) system.
 * It caches roles to reduce blockchain queries and provides a consistent interface for role checks.
 *
 * Features:
 * - On-chain role verification
 * - Role caching with TTL
 * - Automatic cache invalidation
 * - Support for all 5 roles: Admin, MarketCreator, Resolver, Oracle, Pauser
 */

import { Aptos, AptosConfig, InputViewFunctionData, Network } from '@aptos-labs/ts-sdk';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../database/prismaClient.js';
import { canonicalizeRoles } from '../utils/roleNormalization.js';

const formatLog = (message: string, data?: Record<string, unknown>) =>
  data ? { ...data, msg: message } : { msg: message };

const logInfo = (message: string, data?: Record<string, unknown>) =>
  logger.info(formatLog(message, data));
const logDebug = (message: string, data?: Record<string, unknown>) =>
  logger.debug(formatLog(message, data));
const logWarn = (message: string, data?: Record<string, unknown>) =>
  logger.warn(formatLog(message, data));
const logError = (message: string, data?: Record<string, unknown>) =>
  logger.error(formatLog(message, data));

/**
 * Role types matching the smart contract RBAC system
 */
export enum Role {
  Admin = 'Admin',
  MarketCreator = 'MarketCreator',
  Resolver = 'Resolver',
  Oracle = 'Oracle',
  Pauser = 'Pauser',
}

/**
 * Role cache entry
 */
interface RoleCacheEntry {
  roles: Role[];
  timestamp: number;
}

export class RoleVerificationService {
  private aptos: Aptos;
  private moduleAddress: string;
  private cache: Map<string, RoleCacheEntry> = new Map();
  private cacheTTL: number; // milliseconds

  constructor(cacheTTL: number = 300000) {
    // 5 minutes default
    const config = new AptosConfig({
      network: env.APTOS_NETWORK as Network,
    });
    this.aptos = new Aptos(config);
    this.moduleAddress = env.APTOS_MODULE_ADDRESS;
    this.cacheTTL = cacheTTL;

    logInfo('[RoleVerification] Initialized', {
      moduleAddress: this.moduleAddress,
      cacheTTL,
    });
  }

  /**
   * Check if a wallet has a specific role
   */
  async hasRole(walletAddress: string, role: Role): Promise<boolean> {
    try {
      const roles = await this.getRoles(walletAddress);
      const hasRole = roles.includes(role);

      logDebug('[RoleVerification] Role check', {
        wallet: walletAddress,
        role,
        hasRole,
      });

      return hasRole;
    } catch (error) {
      logError('[RoleVerification] Failed to check role', {
        wallet: walletAddress,
        role,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get all roles for a wallet
   * Uses cache if available and not expired
   */
  async getRoles(walletAddress: string): Promise<Role[]> {
    // Check cache
    const cached = this.cache.get(walletAddress);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logDebug('[RoleVerification] Cache hit', { wallet: walletAddress });
      return cached.roles;
    }

    // Fetch from blockchain
    logDebug('[RoleVerification] Fetching roles from blockchain', {
      wallet: walletAddress,
    });

    const roles = await this.fetchRolesFromChain(walletAddress);

    // Update cache
    this.cache.set(walletAddress, {
      roles,
      timestamp: Date.now(),
    });

    // Update database
    await this.syncRolesToDatabase(walletAddress, roles);

    return roles;
  }

  /**
   * Fetch roles from the blockchain using view functions
   */
  private async fetchRolesFromChain(walletAddress: string): Promise<Role[]> {
    const roles: Role[] = [];

    try {
      // Check each role using the access_control view functions
      for (const role of Object.values(Role)) {
        const hasRole = await this.checkRoleOnChain(walletAddress, role);
        if (hasRole) {
          roles.push(role);
        }
      }

      logInfo('[RoleVerification] Fetched roles from chain', {
        wallet: walletAddress,
        roles,
      });

      return roles;
    } catch (error) {
      logError('[RoleVerification] Failed to fetch roles from chain', {
        wallet: walletAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check a specific role on-chain using view function
   */
  private async checkRoleOnChain(walletAddress: string, role: Role): Promise<boolean> {
    try {
      // Map role to view function
      const viewFunction = this.getRoleViewFunction(role);

      const payload: InputViewFunctionData = {
        function: `${this.moduleAddress}::access_control::${viewFunction}`,
        functionArguments: [walletAddress],
      };

      const result = await this.aptos.view({ payload });

      // Result is [boolean]
      return result[0] === true;
    } catch (error) {
      // If the view function fails, assume the role is not granted
      logDebug('[RoleVerification] Role check failed (assuming false)', {
        wallet: walletAddress,
        role,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Map role to smart contract view function name
   */
  private getRoleViewFunction(role: Role): string {
    const functionMap: Record<Role, string> = {
      [Role.Admin]: 'is_admin',
      [Role.MarketCreator]: 'can_create_markets',
      [Role.Resolver]: 'can_resolve_markets',
      [Role.Oracle]: 'can_set_oracle',
      [Role.Pauser]: 'can_pause',
    };

    return functionMap[role];
  }

  /**
   * Sync roles to database
   */
  private async syncRolesToDatabase(walletAddress: string, roles: Role[]): Promise<void> {
    try {
      const normalizedRoles = canonicalizeRoles(roles.map((r) => r.toString()));

      await prisma.user.upsert({
        where: { walletAddress },
        update: {
          roles: { set: normalizedRoles },
          onChainRolesSynced: true,
          lastRoleSync: new Date(),
        },
        create: {
          walletAddress,
          roles: normalizedRoles,
          onChainRolesSynced: true,
          lastRoleSync: new Date(),
        },
      });

      logDebug('[RoleVerification] Synced roles to database', {
        wallet: walletAddress,
        roles: normalizedRoles,
      });
    } catch (error) {
      logError('[RoleVerification] Failed to sync roles to database', {
        wallet: walletAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Invalidate cache for a specific wallet
   * Useful when roles are granted/revoked
   */
  invalidateCache(walletAddress: string): void {
    this.cache.delete(walletAddress);
    logDebug('[RoleVerification] Cache invalidated', { wallet: walletAddress });
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
    logInfo('[RoleVerification] Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL,
    };
  }

  /**
   * Check if wallet is an admin
   */
  async isAdmin(walletAddress: string): Promise<boolean> {
    return this.hasRole(walletAddress, Role.Admin);
  }

  /**
   * Check if wallet can create markets
   */
  async canCreateMarkets(walletAddress: string): Promise<boolean> {
    return this.hasRole(walletAddress, Role.MarketCreator);
  }

  /**
   * Check if wallet can resolve markets
   */
  async canResolveMarkets(walletAddress: string): Promise<boolean> {
    return this.hasRole(walletAddress, Role.Resolver);
  }

  /**
   * Check if wallet can set oracle
   */
  async canSetOracle(walletAddress: string): Promise<boolean> {
    return this.hasRole(walletAddress, Role.Oracle);
  }

  /**
   * Check if wallet can pause system
   */
  async canPause(walletAddress: string): Promise<boolean> {
    return this.hasRole(walletAddress, Role.Pauser);
  }
}

/**
 * Global role verification service instance
 */
let globalRoleService: RoleVerificationService | null = null;

/**
 * Get or create the global role verification service
 */
export function getRoleVerificationService(): RoleVerificationService {
  if (!globalRoleService) {
    const cacheTTL = parseInt(process.env.ROLE_CACHE_TTL ?? '300000', 10);
    globalRoleService = new RoleVerificationService(cacheTTL);
  }
  return globalRoleService;
}

/**
 * Convenience functions for role checks
 */
export async function verifyRole(walletAddress: string, role: Role): Promise<boolean> {
  const service = getRoleVerificationService();
  return service.hasRole(walletAddress, role);
}

export async function verifyAdmin(walletAddress: string): Promise<boolean> {
  const service = getRoleVerificationService();
  return service.isAdmin(walletAddress);
}

export async function verifyMarketCreator(walletAddress: string): Promise<boolean> {
  const service = getRoleVerificationService();
  return service.canCreateMarkets(walletAddress);
}

export async function verifyResolver(walletAddress: string): Promise<boolean> {
  const service = getRoleVerificationService();
  return service.canResolveMarkets(walletAddress);
}
