module prediction_market::betting {
    use std::signer;
    use std::error;
    use std::vector;
    use aptos_std::table::{Self, Table};
    use prediction_market::market_manager;
    use prediction_market::collateral_vault;
    use prediction_market::fpmm;  // Switched from amm_lmsr to FPMM (constant product: x×y=k)
    use prediction_market::access_control;
    use prediction_market::commit_reveal;

    // Errors
    const E_MARKET_NOT_ACTIVE: u64 = 1;
    const E_INVALID_OUTCOME: u64 = 2;
    const E_INVALID_AMOUNT: u64 = 3;
    const E_MARKET_NOT_RESOLVED: u64 = 4;
    const E_NOT_INITIALIZED: u64 = 5;
    const E_MIN_BET_NOT_MET: u64 = 6;
    const E_MAX_BET_EXCEEDED: u64 = 7;
    const E_REENTRANCY: u64 = 8;
    const E_ZERO_POOL: u64 = 9;
    const E_OVERFLOW: u64 = 10;
    const E_COMMIT_PHASE_ACTIVE: u64 = 11;
    const E_NOT_REVEAL_PHASE: u64 = 12;
    const E_POOLS_ALREADY_INITIALIZED: u64 = 13;
    const E_NOT_AUTHORIZED: u64 = 14;

    // Constants
    const MIN_BET_AMOUNT: u64 = 1000000; // 1 USDC (6 decimals)
    const MAX_BET_AMOUNT: u64 = 2000_000000; // 2,000 USDC (safe with b=10k)

    /// Per-user reentrancy lock resource (atomic mutex pattern)
    /// This prevents the race condition in the old Table-based approach
    struct ReentrancyLock has key {
        locked: bool,
        market_id: u64,
    }

    /// On-chain storage for market-specific FPMM pools
    struct MarketPools has key {
        pools: Table<u64, fpmm::Pool>,
    }

    /// Configuration store
    struct BettingConfig has key {
        vault_address: address,
        min_bet: u64,
        max_bet: u64,
        liquidity_parameter: u64, // Initial liquidity for FPMM pool (scaled by 1e6)
    }

    /// Initialize betting system (can only be called once)
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);

        assert!(admin_addr == @prediction_market, error::permission_denied(E_NOT_INITIALIZED));
        assert!(!exists<BettingConfig>(@prediction_market), error::already_exists(E_NOT_INITIALIZED));
        assert!(!exists<MarketPools>(@prediction_market), error::already_exists(E_POOLS_ALREADY_INITIALIZED));

        let vault_address = collateral_vault::get_vault_address();

        move_to(admin, BettingConfig {
            vault_address,
            min_bet: MIN_BET_AMOUNT,
            max_bet: MAX_BET_AMOUNT,
            liquidity_parameter: 10000_000000, // 10,000 USDC default - supports up to 2,000 USDC bets
        });

        move_to(admin, MarketPools {
            pools: table::new(),
        });
    }

    /// Update minimum and maximum bet amounts (admin only)
    public entry fun update_bet_limits(
        admin: &signer,
        new_min_bet: u64,
        new_max_bet: u64,
    ) acquires BettingConfig {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @prediction_market, error::permission_denied(E_NOT_INITIALIZED));
        assert!(exists<BettingConfig>(@prediction_market), error::not_found(E_NOT_INITIALIZED));

        let config = borrow_global_mut<BettingConfig>(@prediction_market);

        // Sanity checks
        assert!(new_min_bet > 0, error::invalid_argument(E_INVALID_AMOUNT));
        assert!(new_max_bet > new_min_bet, error::invalid_argument(E_INVALID_AMOUNT));

        config.min_bet = new_min_bet;
        config.max_bet = new_max_bet;
    }

    /// Update FPMM initial liquidity parameter (admin only)
    public entry fun update_liquidity_parameter(
        admin: &signer,
        new_liquidity: u64,
    ) acquires BettingConfig {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @prediction_market, error::permission_denied(E_NOT_INITIALIZED));
        assert!(exists<BettingConfig>(@prediction_market), error::not_found(E_NOT_INITIALIZED));

        let config = borrow_global_mut<BettingConfig>(@prediction_market);

        // Sanity check: liquidity parameter should be reasonable (between 1 and 1M USDC)
        assert!(new_liquidity >= 1_000000, error::invalid_argument(E_INVALID_AMOUNT)); // Min 1 USDC
        assert!(new_liquidity <= 1000000_000000, error::invalid_argument(E_INVALID_AMOUNT)); // Max 1M USDC

        config.liquidity_parameter = new_liquidity;
    }

    /// Place a bet on a market using USDC with commit-reveal protection
    /// Phase 1: Commit (call commit_bet in commit_reveal module)
    /// Phase 2: Reveal (call this function with reveal data)
    public entry fun place_bet_with_reveal(
        user: &signer,
        market_id: u64,
        outcome: u8,
        amount: u64,
        nonce: vector<u8>,
    ) acquires BettingConfig, ReentrancyLock, MarketPools {
        // Check system is not paused
        access_control::require_not_paused();

        // SECURITY: Verify we're in reveal phase and validate commitment
        assert!(!commit_reveal::is_commit_phase(market_id), error::invalid_state(E_COMMIT_PHASE_ACTIVE));
        assert!(commit_reveal::is_reveal_phase(market_id), error::invalid_state(E_NOT_REVEAL_PHASE));

        let user_addr = signer::address_of(user);

        // Reveal and validate the commitment
        let (revealed_outcome, revealed_amount) = commit_reveal::reveal_bet(
            user_addr,
            market_id,
            outcome,
            amount,
            nonce
        );

        // Verify revealed values match provided values
        assert!(revealed_outcome == outcome, error::invalid_argument(E_INVALID_AMOUNT));
        assert!(revealed_amount == amount, error::invalid_argument(E_INVALID_AMOUNT));

        // Now execute the bet with anti-front-running protection
        place_bet_internal(user, market_id, outcome, amount);
    }

    /// Legacy function - direct bet without commit-reveal (less secure)
    /// Use place_bet_with_reveal for front-running protection
    public entry fun place_bet(
        user: &signer,
        market_id: u64,
        outcome: u8,
        amount: u64,
    ) acquires BettingConfig, ReentrancyLock, MarketPools {
        place_bet_internal(user, market_id, outcome, amount);
    }

    /// Atomically acquire reentrancy lock (prevents race conditions)
    /// Must be called with user signer to create lock resource on first use
    fun acquire_lock(user: &signer, market_id: u64) acquires ReentrancyLock {
        let user_addr = signer::address_of(user);

        // Create unique lock resource for this user if it doesn't exist
        if (!exists<ReentrancyLock>(user_addr)) {
            // First-time user - create lock resource unlocked
            move_to(user, ReentrancyLock {
                locked: false,
                market_id: 0,
            });
        };

        let lock = borrow_global_mut<ReentrancyLock>(user_addr);

        // ATOMIC CHECK-AND-SET: Single borrow_global_mut operation ensures atomicity
        // If another transaction tries to acquire, it will fail here
        assert!(!lock.locked, error::invalid_state(E_REENTRANCY));
        lock.locked = true;
        lock.market_id = market_id;
    }

    /// Release reentrancy lock
    fun release_lock(user: &signer) acquires ReentrancyLock {
        let user_addr = signer::address_of(user);
        let lock = borrow_global_mut<ReentrancyLock>(user_addr);
        lock.locked = false;
        lock.market_id = 0;
    }

    /// Internal bet placement logic (called after commit-reveal or directly)
    fun place_bet_internal(
        user: &signer,
        market_id: u64,
        outcome: u8,
        amount: u64,
    ) acquires BettingConfig, ReentrancyLock, MarketPools {
        // Check system is not paused
        access_control::require_not_paused();

        assert!(exists<BettingConfig>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let config = borrow_global<BettingConfig>(@prediction_market);

        // ATOMIC REENTRANCY PROTECTION: Single global_mut operation prevents race
        acquire_lock(user, market_id);

        // Validate amount
        assert!(amount >= config.min_bet, error::invalid_argument(E_MIN_BET_NOT_MET));
        assert!(amount <= config.max_bet, error::invalid_argument(E_MAX_BET_EXCEEDED));
        assert!(amount > 0, error::invalid_argument(E_INVALID_AMOUNT));

        // Validate market is active
        assert!(market_manager::is_market_active(market_id), error::invalid_state(E_MARKET_NOT_ACTIVE));

        // Get market details to validate outcome
        let (_, outcomes, _, _, _, _, _, _, _, _) = market_manager::get_market_full(market_id);
        let num_outcomes = vector::length(&outcomes);
        assert!(num_outcomes == 2, error::invalid_argument(E_INVALID_OUTCOME));
        assert!((outcome as u64) < num_outcomes, error::invalid_argument(E_INVALID_OUTCOME));

        // Initialize pool on first bet if needed
        let pools = borrow_global_mut<MarketPools>(@prediction_market);
        if (!table::contains(&pools.pools, market_id)) {
            let initial_pool = fpmm::create_pool(config.liquidity_parameter);
            table::add(&mut pools.pools, market_id, initial_pool);
        };
        let pool = table::borrow_mut(&mut pools.pools, market_id);

        // Apply FPMM trade and obtain resulting share quantity
        let shares = fpmm::buy_with_cost(pool, outcome, amount);
        assert!(shares > 0, error::invalid_argument(E_ZERO_POOL));

        // Deposit USDC into vault and track position
        let vault_addr = config.vault_address;
        collateral_vault::deposit(
            user,
            market_id,
            outcome,
            amount,
            shares,
            num_outcomes,
            vault_addr,
        );

        // Keep on-chain market totals in sync with vault stakes
        market_manager::update_market_stakes(
            market_id,
            outcome,
            amount,
        );

        // Lock the collateral in vault
        collateral_vault::lock_collateral(
            market_id,
            amount,
            vault_addr,
        );

        // Release lock
        release_lock(user);
    }

    /// Claim winnings after market resolution
    public entry fun claim_winnings(
        user: &signer,
        market_id: u64,
    ) acquires BettingConfig, ReentrancyLock {
        assert!(exists<BettingConfig>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let config = borrow_global<BettingConfig>(@prediction_market);

        // ATOMIC REENTRANCY PROTECTION
        acquire_lock(user, market_id);

        // Check market is resolved
        let (resolved, winning_outcome) = market_manager::get_market_resolution(market_id);
        assert!(resolved, error::invalid_state(E_MARKET_NOT_RESOLVED));

        // Claim from vault
        collateral_vault::claim_winnings(
            user,
            market_id,
            winning_outcome,
            config.vault_address,
        );

        // Release lock
        release_lock(user);
    }

    /// After market is resolved, unlock the collateral (called by resolver)
    public entry fun unlock_market_collateral(
        resolver: &signer,
        market_id: u64,
    ) acquires BettingConfig {
        assert!(exists<BettingConfig>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let config = borrow_global<BettingConfig>(@prediction_market);
        let resolver_addr = signer::address_of(resolver);
        let is_admin = access_control::has_role(resolver_addr, access_control::role_admin());
        let is_resolver = access_control::has_role(resolver_addr, access_control::role_resolver());
        assert!(is_admin || is_resolver, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Verify market is resolved
        let (resolved, _) = market_manager::get_market_resolution(market_id);
        assert!(resolved, error::invalid_state(E_MARKET_NOT_RESOLVED));
        
        // Unlock collateral
        collateral_vault::unlock_collateral(
            market_id,
            config.vault_address,
        );
    }

    // View functions
    #[view]
    public fun calculate_payout(
        market_id: u64,
        stake: u64,
        outcome: u8,
    ): u64 acquires BettingConfig, MarketPools {
        assert!(exists<BettingConfig>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let config = borrow_global<BettingConfig>(@prediction_market);
        let pools = borrow_global<MarketPools>(@prediction_market);

        if (!table::contains(&pools.pools, market_id)) {
            let preview_pool = fpmm::create_pool(config.liquidity_parameter);
            return fpmm::preview_buy(&preview_pool, outcome, stake)
        };

        let pool = table::borrow(&pools.pools, market_id);
        fpmm::preview_buy(pool, outcome, stake)
    }

    #[view]
    public fun get_odds(market_id: u64): vector<u64> acquires MarketPools {
        let pools = borrow_global<MarketPools>(@prediction_market);

        if (table::contains(&pools.pools, market_id)) {
            let pool = table::borrow(&pools.pools, market_id);
            let (yes_price, no_price) = fpmm::get_all_prices(pool);
            let odds = vector::empty<u64>();
            vector::push_back(&mut odds, yes_price);
            vector::push_back(&mut odds, no_price);
            return odds
        };

        let odds = vector::empty<u64>();
        vector::push_back(&mut odds, 5000); // 50%
        vector::push_back(&mut odds, 5000); // 50%
        odds
    }

    /// Get dynamic odds using FPMM (constant product) for a specific outcome
    #[view]
    public fun get_odds_for_outcome(market_id: u64, outcome: u8): u64 acquires MarketPools {
        let pools = borrow_global<MarketPools>(@prediction_market);

        if (table::contains(&pools.pools, market_id)) {
            let pool = table::borrow(&pools.pools, market_id);
            return fpmm::get_price(pool, outcome)
        };

        5000
    }

    /// Calculate dynamic payout (proportional to pool)
    #[view]
    public fun calculate_payout_dynamic(
        market_id: u64,
        stake: u64,
        outcome: u8,
    ): u64 acquires BettingConfig, MarketPools {
        calculate_payout(market_id, stake, outcome)
    }

    #[view]
    public fun get_vault_address(): address acquires BettingConfig {
        assert!(exists<BettingConfig>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let config = borrow_global<BettingConfig>(@prediction_market);
        config.vault_address
    }

    #[view]
    public fun get_liquidity_parameter(): u64 acquires BettingConfig {
        assert!(exists<BettingConfig>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let config = borrow_global<BettingConfig>(@prediction_market);
        config.liquidity_parameter
    }
}
