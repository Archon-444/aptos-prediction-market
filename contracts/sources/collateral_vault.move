module prediction_market::collateral_vault {
    use std::signer;
    use std::error;
    use std::vector;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object::{Self as object, Object};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};

    // Friend modules that can interact with the vault
    friend prediction_market::betting;
    
    // Errors
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_INSUFFICIENT_BALANCE: u64 = 3;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_UNAUTHORIZED: u64 = 5;
    const E_MARKET_NOT_FOUND: u64 = 6;
    const E_ALREADY_CLAIMED: u64 = 7;
    const E_MARKET_NOT_RESOLVED: u64 = 8;
    const E_NO_WINNINGS: u64 = 9;
    const E_REENTRANCY: u64 = 10;
    const E_OVERFLOW: u64 = 11;

    /// Main vault storing all USDC collateral
    struct Vault has key {
        metadata: Object<Metadata>,
        signer_cap: SignerCapability,
        total_locked: u64,
        total_available: u64,
        admin: address,
        deposit_events: EventHandle<DepositEvent>,
        withdraw_events: EventHandle<WithdrawEvent>,
        lock_events: EventHandle<LockEvent>,
        unlock_events: EventHandle<UnlockEvent>,
        reentrancy_guard: bool,  // Reentrancy protection
    }

    /// Per-market collateral tracking
    struct MarketCollateral has key {
        collateral: Table<u64, MarketData>,  // market_id -> MarketData
    }

    struct MarketData has store {
        outcome_stakes: vector<u64>,  // Total cost per outcome
        outcome_shares: vector<u64>,  // Total shares minted per outcome
        locked_amount: u64,
        is_settled: bool,
    }

    struct VaultInfo has key {
        address: address,
    }

    /// User position tracking
    struct UserPositions has key {
        positions: Table<u64, Position>,  // market_id -> Position
    }

    struct Position has store {
        outcome: u8,
        stake: u64,
        shares: u64,
        claimed: bool,
    }

    // Events
    struct DepositEvent has drop, store {
        user: address,
        market_id: u64,
        amount: u64,
        shares: u64,
        timestamp: u64,
    }

    struct WithdrawEvent has drop, store {
        user: address,
        market_id: u64,
        amount: u64,
        timestamp: u64,
    }

    struct LockEvent has drop, store {
        market_id: u64,
        amount: u64,
        timestamp: u64,
    }

    struct UnlockEvent has drop, store {
        market_id: u64,
        amount: u64,
        timestamp: u64,
    }

    /// Initialize the vault (call once on deployment)
    public entry fun initialize(
        admin: &signer,
        seed: vector<u8>,
        metadata_address: address,
    ) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @prediction_market, error::permission_denied(E_UNAUTHORIZED));

        let (_, vault_cap) = account::create_resource_account(admin, seed);
        let vault_addr = account::get_signer_capability_address(&vault_cap);
        assert!(!exists<Vault>(vault_addr), error::already_exists(E_ALREADY_INITIALIZED));
        assert!(!exists<VaultInfo>(admin_addr), error::already_exists(E_ALREADY_INITIALIZED));

        let metadata_obj = object::address_to_object<Metadata>(metadata_address);
        primary_fungible_store::ensure_primary_store_exists(vault_addr, metadata_obj);

        let vault_signer = account::create_signer_with_capability(&vault_cap);

        move_to(&vault_signer, Vault {
            metadata: metadata_obj,
            signer_cap: vault_cap,
            total_locked: 0,
            total_available: 0,
            admin: admin_addr,
            deposit_events: account::new_event_handle<DepositEvent>(&vault_signer),
            withdraw_events: account::new_event_handle<WithdrawEvent>(&vault_signer),
            lock_events: account::new_event_handle<LockEvent>(&vault_signer),
            unlock_events: account::new_event_handle<UnlockEvent>(&vault_signer),
            reentrancy_guard: false,
        });

        move_to(&vault_signer, MarketCollateral {
            collateral: table::new(),
        });

        move_to(admin, VaultInfo { address: vault_addr });
    }

    /// Deposit USDC when placing a bet (called by betting module)
    public(friend) fun deposit(
        user: &signer,
        market_id: u64,
        outcome: u8,
        amount: u64,
        shares: u64,
        num_outcomes: u64,
        vault_addr: address,
    ) acquires Vault, MarketCollateral, UserPositions {
        assert!(amount > 0, error::invalid_argument(E_INVALID_AMOUNT));
        assert!(shares > 0, error::invalid_argument(E_INVALID_AMOUNT));
        assert!(exists<Vault>(vault_addr), error::not_found(E_NOT_INITIALIZED));

        // Reentrancy guard
        let vault = borrow_global_mut<Vault>(vault_addr);
        assert!(!vault.reentrancy_guard, error::invalid_state(E_REENTRANCY));
        vault.reentrancy_guard = true;

        let user_addr = signer::address_of(user);

        let metadata = vault.metadata;
        let stored_vault_addr = account::get_signer_capability_address(&vault.signer_cap);
        assert!(stored_vault_addr == vault_addr, error::permission_denied(E_UNAUTHORIZED));

        // Ensure stores exist before transfer
        primary_fungible_store::ensure_primary_store_exists(user_addr, metadata);
        primary_fungible_store::ensure_primary_store_exists(vault_addr, metadata);

        // Transfer funds from user to vault primary store
        primary_fungible_store::transfer(user, metadata, vault_addr, amount);

        let (new_available, overflow) = overflowing_add(vault.total_available, amount);
        assert!(!overflow, error::out_of_range(E_INVALID_AMOUNT));
        vault.total_available = new_available;
        
        // Update market collateral
        let market_collateral = borrow_global_mut<MarketCollateral>(vault_addr);
        if (!table::contains(&market_collateral.collateral, market_id)) {
            let outcome_stakes = vector::empty<u64>();
            let outcome_shares = vector::empty<u64>();
            let i = 0;
            while (i < num_outcomes) {
                vector::push_back(&mut outcome_stakes, 0);
                vector::push_back(&mut outcome_shares, 0);
                i = i + 1;
            };
            
            table::add(&mut market_collateral.collateral, market_id, MarketData {
                outcome_stakes,
                outcome_shares,
                locked_amount: 0,
                is_settled: false,
            });
        };
        
        let market_data = table::borrow_mut(&mut market_collateral.collateral, market_id);
        let stake = vector::borrow_mut(&mut market_data.outcome_stakes, (outcome as u64));
        let (new_stake, overflow) = overflowing_add(*stake, amount);
        assert!(!overflow, error::out_of_range(E_OVERFLOW));
        *stake = new_stake;
        let share_entry = vector::borrow_mut(&mut market_data.outcome_shares, (outcome as u64));
        let (new_shares, share_overflow) = overflowing_add(*share_entry, shares);
        assert!(!share_overflow, error::out_of_range(E_OVERFLOW));
        *share_entry = new_shares;
        
        // Initialize user positions if needed
        if (!exists<UserPositions>(user_addr)) {
            move_to(user, UserPositions {
                positions: table::new(),
            });
        };
        
        // Track or update user position
        let user_positions = borrow_global_mut<UserPositions>(user_addr);
        if (table::contains(&user_positions.positions, market_id)) {
            let position = table::borrow_mut(&mut user_positions.positions, market_id);
            // Only allow betting on same outcome
            assert!(position.outcome == outcome, error::invalid_argument(E_INVALID_AMOUNT));
            let (new_stake_pos, overflow_pos) = overflowing_add(position.stake, amount);
            assert!(!overflow_pos, error::out_of_range(E_OVERFLOW));
            position.stake = new_stake_pos;
            let (new_share_pos, overflow_share) = overflowing_add(position.shares, shares);
            assert!(!overflow_share, error::out_of_range(E_OVERFLOW));
            position.shares = new_share_pos;
        } else {
            table::add(&mut user_positions.positions, market_id, Position {
                outcome,
                stake: amount,
                shares,
                claimed: false,
            });
        };
        
        // Emit event
        event::emit_event(&mut vault.deposit_events, DepositEvent {
            user: user_addr,
            market_id,
            amount,
            shares,
            timestamp: timestamp::now_seconds(),
        });

        // Release reentrancy guard
        vault.reentrancy_guard = false;
    }

    /// Lock collateral when market is active
    public(friend) fun lock_collateral(
        market_id: u64,
        amount: u64,
        vault_addr: address,
    ) acquires Vault, MarketCollateral {
        let vault = borrow_global_mut<Vault>(vault_addr);
        assert!(!vault.reentrancy_guard, error::invalid_state(E_REENTRANCY));
        vault.reentrancy_guard = true;

        let stored_vault_addr = account::get_signer_capability_address(&vault.signer_cap);
        assert!(stored_vault_addr == vault_addr, error::permission_denied(E_UNAUTHORIZED));

        assert!(vault.total_available >= amount, error::invalid_state(E_INSUFFICIENT_BALANCE));

        // Overflow check for locked amount
        let (new_locked, overflow) = overflowing_add(vault.total_locked, amount);
        assert!(!overflow, error::out_of_range(E_INVALID_AMOUNT));
        vault.total_locked = new_locked;
        vault.total_available = vault.total_available - amount;

        let market_collateral = borrow_global_mut<MarketCollateral>(vault_addr);
        let market_data = table::borrow_mut(&mut market_collateral.collateral, market_id);

        let (new_market_locked, overflow2) = overflowing_add(market_data.locked_amount, amount);
        assert!(!overflow2, error::out_of_range(E_INVALID_AMOUNT));
        market_data.locked_amount = new_market_locked;

        event::emit_event(&mut vault.lock_events, LockEvent {
            market_id,
            amount,
            timestamp: timestamp::now_seconds(),
        });

        vault.reentrancy_guard = false;
    }

    /// Unlock collateral when market resolves
    public(friend) fun unlock_collateral(
        market_id: u64,
        vault_addr: address,
    ) acquires Vault, MarketCollateral {
        let vault = borrow_global_mut<Vault>(vault_addr);
        assert!(!vault.reentrancy_guard, error::invalid_state(E_REENTRANCY));
        vault.reentrancy_guard = true;

        let market_collateral = borrow_global_mut<MarketCollateral>(vault_addr);
        assert!(table::contains(&market_collateral.collateral, market_id), error::not_found(E_MARKET_NOT_FOUND));

        let market_data = table::borrow_mut(&mut market_collateral.collateral, market_id);
        let total_pool = calculate_total_stakes(&market_data.outcome_stakes);

        assert!(vault.total_locked >= total_pool, error::invalid_state(E_INSUFFICIENT_BALANCE));
        vault.total_locked = vault.total_locked - total_pool;

        let (new_available, overflow) = overflowing_add(vault.total_available, total_pool);
        assert!(!overflow, error::out_of_range(E_INVALID_AMOUNT));
        vault.total_available = new_available;
        market_data.is_settled = true;

        event::emit_event(&mut vault.unlock_events, UnlockEvent {
            market_id,
            amount: total_pool,
            timestamp: timestamp::now_seconds(),
        });

        vault.reentrancy_guard = false;
    }

    /// Claim winnings after market resolution
    public entry fun claim_winnings(
        user: &signer,
        market_id: u64,
        winning_outcome: u8,
        vault_addr: address,
    ) acquires Vault, MarketCollateral, UserPositions {
        // Reentrancy guard
        let vault = borrow_global_mut<Vault>(vault_addr);
        assert!(!vault.reentrancy_guard, error::invalid_state(E_REENTRANCY));
        vault.reentrancy_guard = true;

        let user_addr = signer::address_of(user);

        assert!(exists<UserPositions>(user_addr), error::not_found(E_NO_WINNINGS));

        let user_positions = borrow_global_mut<UserPositions>(user_addr);
        assert!(table::contains(&user_positions.positions, market_id), error::not_found(E_NO_WINNINGS));

        let position = table::borrow_mut(&mut user_positions.positions, market_id);
        assert!(!position.claimed, error::already_exists(E_ALREADY_CLAIMED));
        assert!(position.outcome == winning_outcome, error::permission_denied(E_NO_WINNINGS));

        let market_collateral = borrow_global_mut<MarketCollateral>(vault_addr);
        assert!(table::contains(&market_collateral.collateral, market_id), error::not_found(E_MARKET_NOT_FOUND));

        let market_data = table::borrow_mut(&mut market_collateral.collateral, market_id);
        assert!(market_data.is_settled, error::invalid_state(E_MARKET_NOT_RESOLVED));

        let total_pool = calculate_total_stakes(&market_data.outcome_stakes);
        let winning_pool = *vector::borrow(&market_data.outcome_stakes, (winning_outcome as u64));
        assert!(winning_pool > 0, error::invalid_state(E_NO_WINNINGS));

        let payout_u128 = ((position.stake as u128) * (total_pool as u128)) / (winning_pool as u128);
        let payout = payout_u128 as u64;
        assert!(payout > 0, error::invalid_state(E_NO_WINNINGS));
        assert!(payout <= vault.total_available, error::invalid_state(E_INSUFFICIENT_BALANCE));

        let metadata = vault.metadata;
        let vault_addr_stored = account::get_signer_capability_address(&vault.signer_cap);
        assert!(vault_addr_stored == vault_addr, error::permission_denied(E_UNAUTHORIZED));

        let vault_balance = primary_fungible_store::balance(vault_addr, metadata);
        assert!(vault_balance >= payout, error::invalid_state(E_INSUFFICIENT_BALANCE));

        position.claimed = true;
        position.stake = 0;
        position.shares = 0;

        let vault_signer = account::create_signer_with_capability(&vault.signer_cap);
        primary_fungible_store::transfer(&vault_signer, metadata, user_addr, payout);

        vault.total_available = vault.total_available - payout;

        if (!vector::is_empty(&market_data.outcome_shares)) {
            let winning_shares_ref = vector::borrow_mut(&mut market_data.outcome_shares, (winning_outcome as u64));
            if (*winning_shares_ref >= payout) {
                *winning_shares_ref = *winning_shares_ref - payout;
            } else {
                *winning_shares_ref = 0;
            };
        };

        event::emit_event(&mut vault.withdraw_events, WithdrawEvent {
            user: user_addr,
            market_id,
            amount: payout,
            timestamp: timestamp::now_seconds(),
        });

        // Release reentrancy guard
        vault.reentrancy_guard = false;
    }

    // Helper functions
    fun calculate_total_stakes(stakes: &vector<u64>): u64 {
        let total = 0u64;
        let i = 0;
        let len = vector::length(stakes);
        while (i < len) {
            let stake = *vector::borrow(stakes, i);
            // Use checked addition to prevent overflow
            let (new_total, overflow) = overflowing_add(total, stake);
            assert!(!overflow, error::out_of_range(E_OVERFLOW));
            total = new_total;
            i = i + 1;
        };
        total
    }

    /// Helper for checked addition to detect overflow
    fun overflowing_add(a: u64, b: u64): (u64, bool) {
        let sum = a + b;
        if (sum < a) {
            (sum, true)  // Overflow occurred
        } else {
            (sum, false) // No overflow
        }
    }

    // View functions
    #[view]
    public fun get_vault_balance(vault_addr: address): u64 acquires Vault {
        if (!exists<Vault>(vault_addr)) {
            return 0
        };
        let vault = borrow_global<Vault>(vault_addr);
        primary_fungible_store::balance(vault_addr, vault.metadata)
    }

    #[view]
    public fun get_vault_address(): address acquires VaultInfo {
        borrow_global<VaultInfo>(@prediction_market).address
    }

    #[view]
    public fun get_metadata_object(): Object<Metadata> acquires Vault, VaultInfo {
        let vault_addr = borrow_global<VaultInfo>(@prediction_market).address;
        borrow_global<Vault>(vault_addr).metadata
    }

    #[view]
    public fun get_market_stakes(vault_addr: address, market_id: u64): vector<u64> acquires MarketCollateral {
        if (!exists<MarketCollateral>(vault_addr)) {
            return vector::empty<u64>()
        };
        let market_collateral = borrow_global<MarketCollateral>(vault_addr);
        if (!table::contains(&market_collateral.collateral, market_id)) {
            return vector::empty<u64>()
        };
        let market_data = table::borrow(&market_collateral.collateral, market_id);
        market_data.outcome_stakes
    }

    #[view]
    public fun get_user_position(user_addr: address, market_id: u64): (u8, u64, u64, bool) acquires UserPositions {
        if (!exists<UserPositions>(user_addr)) {
            return (0, 0, 0, false)
        };
        let user_positions = borrow_global<UserPositions>(user_addr);
        if (!table::contains(&user_positions.positions, market_id)) {
            return (0, 0, 0, false)
        };
        let position = table::borrow(&user_positions.positions, market_id);
        (position.outcome, position.stake, position.shares, position.claimed)
    }

    #[view]
    public fun has_position(user_addr: address, market_id: u64): bool acquires UserPositions {
        if (!exists<UserPositions>(user_addr)) {
            return false
        };
        let user_positions = borrow_global<UserPositions>(user_addr);
        table::contains(&user_positions.positions, market_id)
    }
}
