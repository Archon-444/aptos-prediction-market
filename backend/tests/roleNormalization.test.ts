import { describe, expect, it } from 'vitest';

import { canonicalizeRole, canonicalizeRoles } from '../src/utils/roleNormalization.js';

describe('role normalization', () => {
  it('canonicalizes individual roles with and without prefix', () => {
    expect(canonicalizeRole('Admin')).toBe('ROLE_ADMIN');
    expect(canonicalizeRole('ROLE_ADMIN')).toBe('ROLE_ADMIN');
    expect(canonicalizeRole('market_creator')).toBe('ROLE_MARKET_CREATOR');
    expect(canonicalizeRole('Oracle')).toBe('ROLE_ORACLE_MANAGER');
    expect(canonicalizeRole('pauser')).toBe('ROLE_PAUSER');
  });

  it('deduplicates and normalizes role arrays', () => {
    const result = canonicalizeRoles(['Admin', 'ROLE_RESOLVER', 'oracle-manager', 'admin']);
    expect(result).toEqual(['ROLE_ADMIN', 'ROLE_RESOLVER', 'ROLE_ORACLE_MANAGER']);
  });

  it('drops unknown roles gracefully', () => {
    const result = canonicalizeRoles(['UnknownRole', '  ', 'Resolver']);
    expect(result).toEqual(['ROLE_RESOLVER']);
  });
});
