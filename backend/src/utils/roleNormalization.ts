const ROLE_ALIAS_MAP: Record<string, string> = {
  ROLE_ADMIN: 'ROLE_ADMIN',
  ADMIN: 'ROLE_ADMIN',
  ADMINISTRATOR: 'ROLE_ADMIN',
  ROLE_MARKET_CREATOR: 'ROLE_MARKET_CREATOR',
  MARKET_CREATOR: 'ROLE_MARKET_CREATOR',
  MARKETCREATOR: 'ROLE_MARKET_CREATOR',
  CREATOR: 'ROLE_MARKET_CREATOR',
  ROLE_RESOLVER: 'ROLE_RESOLVER',
  RESOLVER: 'ROLE_RESOLVER',
  ROLE_ORACLE_MANAGER: 'ROLE_ORACLE_MANAGER',
  ORACLE_MANAGER: 'ROLE_ORACLE_MANAGER',
  ORACLEMANAGER: 'ROLE_ORACLE_MANAGER',
  ORACLE: 'ROLE_ORACLE_MANAGER',
  ROLE_ORACLE: 'ROLE_ORACLE_MANAGER',
  ROLE_PAUSER: 'ROLE_PAUSER',
  PAUSER: 'ROLE_PAUSER',
};

const normalizeRoleKey = (role: string) =>
  role
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();

export const canonicalizeRole = (role: string): string | null => {
  if (!role) {
    return null;
  }

  const normalized = normalizeRoleKey(role);
  if (!normalized) {
    return null;
  }

  if (ROLE_ALIAS_MAP[normalized]) {
    return ROLE_ALIAS_MAP[normalized];
  }

  if (normalized.startsWith('ROLE_')) {
    const alias = normalized.slice(5);
    if (ROLE_ALIAS_MAP[alias]) {
      return ROLE_ALIAS_MAP[alias];
    }
  }

  return null;
};

export const canonicalizeRoles = (roles: Iterable<string>): string[] => {
  const deduped = new Set<string>();
  for (const role of roles) {
    const canonical = canonicalizeRole(role);
    if (canonical) {
      deduped.add(canonical);
    }
  }
  return Array.from(deduped);
};
