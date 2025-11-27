/// Role-Based Access Control (RBAC) module
/// Provides granular permission management for admin functions
module prediction_market::access_control {
    use std::signer;
    use std::error;
    use std::vector;
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;

    // Error codes
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_ROLE_NOT_FOUND: u64 = 2;
    const E_ALREADY_HAS_ROLE: u64 = 3;
    const E_NOT_INITIALIZED: u64 = 4;
    const E_ALREADY_INITIALIZED: u64 = 5;
    const E_CANNOT_REVOKE_OWN_ADMIN: u64 = 6;
    const E_INVALID_ROLE: u64 = 7;

    // Role constants
    const ROLE_ADMIN: u8 = 0;           // Full control
    const ROLE_MARKET_CREATOR: u8 = 1;  // Can create markets
    const ROLE_RESOLVER: u8 = 2;        // Can resolve markets
    const ROLE_ORACLE_MANAGER: u8 = 3;  // Can manage oracles
    const ROLE_PAUSER: u8 = 4;          // Can pause system in emergencies

    /// User role assignment
    struct UserRoles has store, drop {
        address: address,
        roles: vector<u8>,
        granted_at: u64,
        granted_by: address,
    }

    /// Global access control registry
    struct AccessRegistry has key {
        owner: address,
        user_roles: SmartTable<address, UserRoles>,
        paused: bool,
        role_grant_events: EventHandle<RoleGrantEvent>,
        role_revoke_events: EventHandle<RoleRevokeEvent>,
    }

    /// Events
    struct RoleGrantEvent has drop, store {
        user: address,
        role: u8,
        granted_by: address,
        timestamp: u64,
    }

    struct RoleRevokeEvent has drop, store {
        user: address,
        role: u8,
        revoked_by: address,
        timestamp: u64,
    }

    /// Initialize access control system
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @prediction_market, error::permission_denied(E_NOT_AUTHORIZED));
        assert!(!exists<AccessRegistry>(@prediction_market), error::already_exists(E_ALREADY_INITIALIZED));

        let user_roles = smart_table::new<address, UserRoles>();

        // Grant admin all roles
        let admin_role_vec = vector::empty<u8>();
        vector::push_back(&mut admin_role_vec, ROLE_ADMIN);
        vector::push_back(&mut admin_role_vec, ROLE_MARKET_CREATOR);
        vector::push_back(&mut admin_role_vec, ROLE_RESOLVER);
        vector::push_back(&mut admin_role_vec, ROLE_ORACLE_MANAGER);
        vector::push_back(&mut admin_role_vec, ROLE_PAUSER);

        smart_table::add(&mut user_roles, admin_addr, UserRoles {
            address: admin_addr,
            roles: admin_role_vec,
            granted_at: aptos_framework::timestamp::now_seconds(),
            granted_by: admin_addr,
        });

        move_to(admin, AccessRegistry {
            owner: admin_addr,
            user_roles,
            paused: false,
            role_grant_events: account::new_event_handle<RoleGrantEvent>(admin),
            role_revoke_events: account::new_event_handle<RoleRevokeEvent>(admin),
        });
    }

    /// Grant a role to a user (admin only)
    public entry fun grant_role(
        admin: &signer,
        user: address,
        role: u8,
    ) acquires AccessRegistry {
        assert!(exists<AccessRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<AccessRegistry>(@prediction_market);

        let admin_addr = signer::address_of(admin);

        // Only admin can grant roles
        assert!(has_role_internal(&registry.user_roles, admin_addr, ROLE_ADMIN), error::permission_denied(E_NOT_AUTHORIZED));

        // Validate role
        assert!(role <= ROLE_PAUSER, error::invalid_argument(E_INVALID_ROLE));

        let current_time = aptos_framework::timestamp::now_seconds();

        // If user doesn't have any roles, create new entry
        if (!smart_table::contains(&registry.user_roles, user)) {
            let roles = vector::empty<u8>();
            vector::push_back(&mut roles, role);

            smart_table::add(&mut registry.user_roles, user, UserRoles {
                address: user,
                roles,
                granted_at: current_time,
                granted_by: admin_addr,
            });
        } else {
            // User exists, add role if they don't have it
            let user_roles = smart_table::borrow_mut(&mut registry.user_roles, user);

            // Check if already has role
            let i = 0;
            let has_role = false;
            while (i < vector::length(&user_roles.roles)) {
                if (*vector::borrow(&user_roles.roles, i) == role) {
                    has_role = true;
                    break
                };
                i = i + 1;
            };

            assert!(!has_role, error::already_exists(E_ALREADY_HAS_ROLE));
            vector::push_back(&mut user_roles.roles, role);
        };

        // Emit event
        event::emit_event(&mut registry.role_grant_events, RoleGrantEvent {
            user,
            role,
            granted_by: admin_addr,
            timestamp: current_time,
        });
    }

    /// Revoke a role from a user (admin only)
    public entry fun revoke_role(
        admin: &signer,
        user: address,
        role: u8,
    ) acquires AccessRegistry {
        assert!(exists<AccessRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<AccessRegistry>(@prediction_market);

        let admin_addr = signer::address_of(admin);

        // Only admin can revoke roles
        assert!(has_role_internal(&registry.user_roles, admin_addr, ROLE_ADMIN), error::permission_denied(E_NOT_AUTHORIZED));

        // SECURITY: Prevent admin from revoking their own admin role
        if (user == admin_addr && role == ROLE_ADMIN) {
            assert!(false, error::permission_denied(E_CANNOT_REVOKE_OWN_ADMIN));
        };

        // SECURITY: Prevent revoking admin role from other admins unless you're the owner
        // This prevents a single admin from seizing complete control
        if (role == ROLE_ADMIN && user != admin_addr) {
            assert!(admin_addr == registry.owner, error::permission_denied(E_NOT_AUTHORIZED));
        };

        assert!(smart_table::contains(&registry.user_roles, user), error::not_found(E_ROLE_NOT_FOUND));

        let user_roles = smart_table::borrow_mut(&mut registry.user_roles, user);

        // Find and remove role
        let i = 0;
        let found = false;
        let role_index = 0;
        while (i < vector::length(&user_roles.roles)) {
            if (*vector::borrow(&user_roles.roles, i) == role) {
                found = true;
                role_index = i;
                break
            };
            i = i + 1;
        };

        assert!(found, error::not_found(E_ROLE_NOT_FOUND));
        vector::remove(&mut user_roles.roles, role_index);

        // Emit event
        event::emit_event(&mut registry.role_revoke_events, RoleRevokeEvent {
            user,
            role,
            revoked_by: admin_addr,
            timestamp: aptos_framework::timestamp::now_seconds(),
        });
    }

    /// Pause the system (pauser role required)
    public entry fun pause(pauser: &signer) acquires AccessRegistry {
        assert!(exists<AccessRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<AccessRegistry>(@prediction_market);

        let pauser_addr = signer::address_of(pauser);
        assert!(has_role_internal(&registry.user_roles, pauser_addr, ROLE_PAUSER), error::permission_denied(E_NOT_AUTHORIZED));

        registry.paused = true;
    }

    /// Unpause the system (admin only)
    public entry fun unpause(admin: &signer) acquires AccessRegistry {
        assert!(exists<AccessRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<AccessRegistry>(@prediction_market);

        let admin_addr = signer::address_of(admin);
        assert!(has_role_internal(&registry.user_roles, admin_addr, ROLE_ADMIN), error::permission_denied(E_NOT_AUTHORIZED));

        registry.paused = false;
    }

    // ==================== Public View Functions ====================

    /// Check if user has a specific role
    #[view]
    public fun has_role(user: address, role: u8): bool acquires AccessRegistry {
        if (!exists<AccessRegistry>(@prediction_market)) {
            return false
        };
        let registry = borrow_global<AccessRegistry>(@prediction_market);
        has_role_internal(&registry.user_roles, user, role)
    }

    /// Check if user is admin
    #[view]
    public fun is_admin(user: address): bool acquires AccessRegistry {
        has_role(user, ROLE_ADMIN)
    }

    /// Check if user can create markets
    #[view]
    public fun can_create_markets(user: address): bool acquires AccessRegistry {
        has_role(user, ROLE_MARKET_CREATOR) || has_role(user, ROLE_ADMIN)
    }

    /// Check if user can resolve markets
    #[view]
    public fun can_resolve_markets(user: address): bool acquires AccessRegistry {
        has_role(user, ROLE_RESOLVER) || has_role(user, ROLE_ADMIN)
    }

    /// Check if user can manage oracles
    #[view]
    public fun can_manage_oracles(user: address): bool acquires AccessRegistry {
        has_role(user, ROLE_ORACLE_MANAGER) || has_role(user, ROLE_ADMIN)
    }

    /// Check if system is paused
    #[view]
    public fun is_paused(): bool acquires AccessRegistry {
        if (!exists<AccessRegistry>(@prediction_market)) {
            return false
        };
        let registry = borrow_global<AccessRegistry>(@prediction_market);
        registry.paused
    }

    /// Get user's roles
    #[view]
    public fun get_user_roles(user: address): vector<u8> acquires AccessRegistry {
        if (!exists<AccessRegistry>(@prediction_market)) {
            return vector::empty<u8>()
        };
        let registry = borrow_global<AccessRegistry>(@prediction_market);

        if (!smart_table::contains(&registry.user_roles, user)) {
            return vector::empty<u8>()
        };

        let user_roles = smart_table::borrow(&registry.user_roles, user);
        user_roles.roles
    }

    // ==================== Internal Helper Functions ====================

    /// Internal function to check if user has role
    fun has_role_internal(user_roles_table: &SmartTable<address, UserRoles>, user: address, role: u8): bool {
        if (!smart_table::contains(user_roles_table, user)) {
            return false
        };

        let user_roles = smart_table::borrow(user_roles_table, user);
        let i = 0;
        while (i < vector::length(&user_roles.roles)) {
            if (*vector::borrow(&user_roles.roles, i) == role) {
                return true
            };
            i = i + 1;
        };
        false
    }

    // ==================== Public Helper Functions for Other Modules ====================

    /// Assert user has role (for use by other modules)
    public fun require_role(user: address, role: u8) acquires AccessRegistry {
        assert!(has_role(user, role), error::permission_denied(E_NOT_AUTHORIZED));
    }

    /// Assert user is admin (for use by other modules)
    public fun require_admin(user: address) acquires AccessRegistry {
        assert!(is_admin(user), error::permission_denied(E_NOT_AUTHORIZED));
    }

    /// Assert system is not paused (for use by other modules)
    public fun require_not_paused() acquires AccessRegistry {
        assert!(!is_paused(), error::invalid_state(E_NOT_AUTHORIZED));
    }

    // ==================== Role Constants (for external use) ====================

    public fun role_admin(): u8 { ROLE_ADMIN }
    public fun role_market_creator(): u8 { ROLE_MARKET_CREATOR }
    public fun role_resolver(): u8 { ROLE_RESOLVER }
    public fun role_oracle_manager(): u8 { ROLE_ORACLE_MANAGER }
    public fun role_pauser(): u8 { ROLE_PAUSER }
}
