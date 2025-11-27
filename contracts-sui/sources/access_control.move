#[allow(duplicate_alias, unused_const, lint(public_entry))]
module prediction_market::access_control {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;

    // ===== Error Codes =====
    const E_NOT_ADMIN: u64 = 1;
    const E_INVALID_ROLE: u64 = 2;
    const E_ALREADY_HAS_ROLE: u64 = 3;
    const E_DOES_NOT_HAVE_ROLE: u64 = 4;

    // ===== Role Constants =====
    const ROLE_ADMIN: u8 = 0;
    const ROLE_MARKET_CREATOR: u8 = 1;
    const ROLE_RESOLVER: u8 = 2;
    const ROLE_ORACLE_MANAGER: u8 = 3;
    const ROLE_PAUSER: u8 = 4;

    // ===== Structs =====

    /// Admin capability - only the deployer gets this
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Role registry - shared object that tracks all roles
    public struct RoleRegistry has key {
        id: UID,
        // Maps: address -> role -> bool
        roles: Table<address, vector<u8>>,
    }

    // ===== Events =====

    public struct RoleGranted has copy, drop {
        wallet: address,
        role: u8,
        granted_by: address,
    }

    public struct RoleRevoked has copy, drop {
        wallet: address,
        role: u8,
        revoked_by: address,
    }

    // ===== Initialization =====

    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };

        // Create role registry
        let mut registry = RoleRegistry {
            id: object::new(ctx),
            roles: table::new(ctx),
        };

        // Grant admin all roles
        let deployer = tx_context::sender(ctx);
        let admin_roles = vector[
            ROLE_ADMIN,
            ROLE_MARKET_CREATOR,
            ROLE_RESOLVER,
            ROLE_ORACLE_MANAGER,
            ROLE_PAUSER,
        ];
        table::add(&mut registry.roles, deployer, admin_roles);

        // Transfer admin cap to deployer
        transfer::transfer(admin_cap, deployer);

        // Share registry
        transfer::share_object(registry);
    }

    // ===== Public Entry Functions =====

    /// Grant a role to a wallet (admin only)
    public entry fun grant_role(
        _cap: &AdminCap,
        registry: &mut RoleRegistry,
        wallet: address,
        role: u8,
        ctx: &mut TxContext
    ) {
        assert!(is_valid_role(role), E_INVALID_ROLE);

        if (!table::contains(&registry.roles, wallet)) {
            table::add(&mut registry.roles, wallet, vector::empty<u8>());
        };

        let roles = table::borrow_mut(&mut registry.roles, wallet);

        // Check if already has role
        if (!vector::contains(roles, &role)) {
            vector::push_back(roles, role);

            event::emit(RoleGranted {
                wallet,
                role,
                granted_by: tx_context::sender(ctx),
            });
        };
    }

    /// Revoke a role from a wallet (admin only)
    public entry fun revoke_role(
        _cap: &AdminCap,
        registry: &mut RoleRegistry,
        wallet: address,
        role: u8,
        ctx: &mut TxContext
    ) {
        assert!(is_valid_role(role), E_INVALID_ROLE);
        assert!(table::contains(&registry.roles, wallet), E_DOES_NOT_HAVE_ROLE);

        let roles = table::borrow_mut(&mut registry.roles, wallet);

        let (found, index) = vector::index_of(roles, &role);
        if (found) {
            vector::remove(roles, index);

            event::emit(RoleRevoked {
                wallet,
                role,
                revoked_by: tx_context::sender(ctx),
            });
        };
    }

    // ===== View Functions =====

    /// Check if a wallet has a specific role
    public fun has_role(registry: &RoleRegistry, wallet: address, role: u8): bool {
        if (!table::contains(&registry.roles, wallet)) {
            return false
        };

        let roles = table::borrow(&registry.roles, wallet);
        vector::contains(roles, &role)
    }

    /// Check if a wallet is an admin
    public fun is_admin(registry: &RoleRegistry, wallet: address): bool {
        has_role(registry, wallet, ROLE_ADMIN)
    }

    /// Check if a wallet can create markets
    public fun can_create_market(registry: &RoleRegistry, wallet: address): bool {
        has_role(registry, wallet, ROLE_MARKET_CREATOR) || is_admin(registry, wallet)
    }

    /// Check if a wallet can resolve markets
    public fun can_resolve_market(registry: &RoleRegistry, wallet: address): bool {
        has_role(registry, wallet, ROLE_RESOLVER) || is_admin(registry, wallet)
    }

    /// Check if a wallet can manage oracles
    public fun can_manage_oracle(registry: &RoleRegistry, wallet: address): bool {
        has_role(registry, wallet, ROLE_ORACLE_MANAGER) || is_admin(registry, wallet)
    }

    /// Check if a wallet can pause markets
    public fun can_pause(registry: &RoleRegistry, wallet: address): bool {
        has_role(registry, wallet, ROLE_PAUSER) || is_admin(registry, wallet)
    }

    // ===== Internal Functions =====

    fun is_valid_role(role: u8): bool {
        role == ROLE_ADMIN ||
        role == ROLE_MARKET_CREATOR ||
        role == ROLE_RESOLVER ||
        role == ROLE_ORACLE_MANAGER ||
        role == ROLE_PAUSER
    }

    // ===== Test Functions =====
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun destroy_admin_cap_for_testing(cap: AdminCap) {
        let AdminCap { id } = cap;
        object::delete(id);
    }
}
