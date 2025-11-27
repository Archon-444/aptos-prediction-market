module prediction_market::buyback {
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::timestamp;
    use std::signer;
    use std::option::{Self, Option};

    /// Buyback configuration and state
    struct BuybackConfig has key {
        /// DEX router address for token swaps (Liquidswap/PancakeSwap)
        dex_router: address,
        /// Maximum slippage tolerance in basis points (500 = 5%)
        slippage_tolerance: u64,
        /// Price drop threshold for circuit breaker (5000 = 50%)
        price_drop_threshold: u64,
        /// Last recorded DAO token price (in USDC, with 8 decimals)
        last_price: Option<u64>,
        /// Interval for price updates (in seconds)
        price_update_interval: u64,
        /// Last price update timestamp
        last_price_update: u64,
        /// Address of staking rewards pool
        staking_rewards_pool: address,
        /// Address for burning tokens
        burn_address: address,
        /// Minimum buyback amount in USDC
        min_buyback_amount: u64,
        /// Maximum buyback amount per transaction (for large buybacks)
        max_buyback_amount: u64,
        /// Event handle for buyback executions
        buyback_events: EventHandle<BuybackExecutedEvent>,
        /// Event handle for price updates
        price_events: EventHandle<PriceUpdateEvent>,
        /// Emergency pause flag
        paused: bool,
    }

    /// Event emitted when a buyback is executed
    struct BuybackExecutedEvent has drop, store {
        usdc_spent: u64,
        dao_purchased: u64,
        dao_burned: u64,
        dao_to_staking: u64,
        price_at_execution: u64,
        timestamp: u64,
    }

    /// Event emitted when price is updated
    struct PriceUpdateEvent has drop, store {
        old_price: u64,
        new_price: u64,
        price_change_pct: u64, // in basis points
        timestamp: u64,
    }

    /// Error codes
    const E_INVALID_SLIPPAGE: u64 = 1;
    const E_PRICE_DROP_CIRCUIT_BREAKER: u64 = 2;
    const E_NO_DAO_PURCHASED: u64 = 3;
    const E_NO_USDC: u64 = 4;
    const E_ALREADY_PAUSED: u64 = 5;
    const E_NOT_PAUSED: u64 = 6;
    const E_INVALID_ADDRESS: u64 = 7;
    const E_PRICE_UPDATE_INTERVAL_NOT_MET: u64 = 8;
    const E_NOT_INITIALIZED: u64 = 9;
    const E_ALREADY_INITIALIZED: u64 = 10;
    const E_AMOUNT_TOO_SMALL: u64 = 11;
    const E_AMOUNT_TOO_LARGE: u64 = 12;

    /// Constants
    const BASIS_POINTS: u64 = 10000;
    const DEFAULT_PRICE_UPDATE_INTERVAL: u64 = 3600; // 1 hour
    const DEFAULT_MIN_BUYBACK: u64 = 100_000000; // $100 USDC (8 decimals)
    const DEFAULT_MAX_BUYBACK: u64 = 10000_000000; // $10,000 USDC (8 decimals)

    /// Initialize the buyback mechanism
    public entry fun initialize(
        admin: &signer,
        dex_router: address,
        slippage_tolerance: u64,
        price_drop_threshold: u64,
        staking_rewards_pool: address,
        burn_address: address
    ) {
        let admin_addr = signer::address_of(admin);

        // Validate inputs
        assert!(!exists<BuybackConfig>(admin_addr), E_ALREADY_INITIALIZED);
        assert!(slippage_tolerance <= BASIS_POINTS, E_INVALID_SLIPPAGE);
        assert!(
            dex_router != @0x0 && staking_rewards_pool != @0x0 && burn_address != @0x0,
            E_INVALID_ADDRESS
        );

        // Create buyback config
        move_to(admin, BuybackConfig {
            dex_router,
            slippage_tolerance,
            price_drop_threshold,
            last_price: option::none(),
            price_update_interval: DEFAULT_PRICE_UPDATE_INTERVAL,
            last_price_update: 0,
            staking_rewards_pool,
            burn_address,
            min_buyback_amount: DEFAULT_MIN_BUYBACK,
            max_buyback_amount: DEFAULT_MAX_BUYBACK,
            buyback_events: account::new_event_handle<BuybackExecutedEvent>(admin),
            price_events: account::new_event_handle<PriceUpdateEvent>(admin),
            paused: false,
        });
    }

    /// Execute a buyback with USDC from the treasury
    /// This is the core function that:
    /// 1. Checks circuit breakers
    /// 2. Swaps USDC for DAO tokens on DEX
    /// 3. Burns 50% of purchased tokens
    /// 4. Sends 50% to staking rewards
    public entry fun execute_buyback(
        admin: &signer,
        usdc_amount: u64
    ) acquires BuybackConfig {
        let admin_addr = signer::address_of(admin);
        assert!(exists<BuybackConfig>(admin_addr), E_NOT_INITIALIZED);

        let config = borrow_global_mut<BuybackConfig>(admin_addr);

        // Safety checks
        assert!(!config.paused, E_ALREADY_PAUSED);
        assert!(usdc_amount > 0, E_NO_USDC);
        assert!(usdc_amount >= config.min_buyback_amount, E_AMOUNT_TOO_SMALL);
        assert!(usdc_amount <= config.max_buyback_amount, E_AMOUNT_TOO_LARGE);

        // Check price drop circuit breaker
        check_and_update_price(admin_addr);

        // Get current DAO price from oracle
        let current_price = get_dao_price_from_oracle(config.dex_router);

        // Calculate expected DAO tokens (with slippage protection)
        let expected_dao = calculate_expected_dao(usdc_amount, current_price);
        let min_dao = apply_slippage_tolerance(expected_dao, config.slippage_tolerance);

        // Execute DEX swap (placeholder - needs actual DEX integration)
        let dao_purchased = execute_dex_swap(
            config.dex_router,
            usdc_amount,
            min_dao
        );

        assert!(dao_purchased > 0, E_NO_DAO_PURCHASED);

        // Split tokens: 50% burn, 50% staking
        let burn_amount = dao_purchased / 2;
        let staking_amount = dao_purchased - burn_amount;

        // Execute burn (send to burn address)
        // Note: In production, this would transfer tokens to burn_address
        // burn_dao_tokens(config.burn_address, burn_amount);

        // Send to staking rewards pool
        // Note: In production, this would transfer tokens to staking pool
        // transfer_to_staking(config.staking_rewards_pool, staking_amount);

        // Emit buyback event
        event::emit_event(
            &mut config.buyback_events,
            BuybackExecutedEvent {
                usdc_spent: usdc_amount,
                dao_purchased,
                dao_burned: burn_amount,
                dao_to_staking: staking_amount,
                price_at_execution: current_price,
                timestamp: timestamp::now_seconds(),
            }
        );
    }

    /// Check for price drop and trigger circuit breaker if needed
    fun check_and_update_price(config_addr: address) acquires BuybackConfig {
        let config = borrow_global_mut<BuybackConfig>(config_addr);
        let now = timestamp::now_seconds();

        // Only update if interval has passed
        if (now - config.last_price_update < config.price_update_interval) {
            return
        };

        // Get current price from oracle
        let current_price = get_dao_price_from_oracle(config.dex_router);

        // Check if we have a previous price to compare
        if (option::is_some(&config.last_price)) {
            let last_price = *option::borrow(&config.last_price);

            // Calculate price change percentage (in basis points)
            let price_change_pct = if (current_price < last_price) {
                ((last_price - current_price) * BASIS_POINTS) / last_price
            } else {
                0
            };

            // Emit price update event
            event::emit_event(
                &mut config.price_events,
                PriceUpdateEvent {
                    old_price: last_price,
                    new_price: current_price,
                    price_change_pct,
                    timestamp: now,
                }
            );

            // Trigger circuit breaker if price dropped too much
            if (price_change_pct > config.price_drop_threshold) {
                config.paused = true;
                // In production, emit emergency event and notify governance
            };
        };

        // Update last price and timestamp
        if (option::is_some(&config.last_price)) {
            *option::borrow_mut(&mut config.last_price) = current_price;
        } else {
            option::fill(&mut config.last_price, current_price);
        };
        config.last_price_update = now;
    }

    /// Get DAO token price from oracle (placeholder)
    /// In production, integrate with Pyth, Switchboard, or other oracle
    fun get_dao_price_from_oracle(_dex_router: address): u64 {
        // Placeholder: Return mock price (1 DAO = 10 USDC with 8 decimals)
        // In production, fetch from oracle:
        // - Pyth Network for real-time prices
        // - Switchboard for Aptos-native oracle
        // - DEX TWAP for decentralized price feed
        1000000000 // $10.00 with 8 decimals
    }

    /// Calculate expected DAO tokens for given USDC amount
    fun calculate_expected_dao(usdc_amount: u64, price: u64): u64 {
        // Price is in USDC per DAO with 8 decimals
        // expected_dao = usdc_amount / price
        (usdc_amount * 100000000) / price
    }

    /// Apply slippage tolerance to get minimum acceptable amount
    fun apply_slippage_tolerance(amount: u64, slippage_bps: u64): u64 {
        amount - ((amount * slippage_bps) / BASIS_POINTS)
    }

    /// Execute DEX swap (placeholder - needs actual integration)
    /// Integrates with Liquidswap or PancakeSwap on Aptos
    fun execute_dex_swap(
        _dex_router: address,
        usdc_amount: u64,
        _min_dao: u64
    ): u64 {
        // Placeholder: Mock swap execution
        // In production, call DEX router contract:
        //
        // Example for Liquidswap:
        // liquidswap::router::swap_exact_input<USDC, DAO>(
        //     usdc_amount,
        //     min_dao,
        //     path
        // );
        //
        // Returns actual DAO tokens received

        // Mock: Assume 1 USDC = 0.1 DAO
        usdc_amount / 10
    }

    // ======================== ADMIN FUNCTIONS ========================

    /// Pause buyback mechanism (emergency)
    public entry fun pause(admin: &signer) acquires BuybackConfig {
        let admin_addr = signer::address_of(admin);
        assert!(exists<BuybackConfig>(admin_addr), E_NOT_INITIALIZED);

        let config = borrow_global_mut<BuybackConfig>(admin_addr);
        assert!(!config.paused, E_ALREADY_PAUSED);

        config.paused = true;
    }

    /// Unpause buyback mechanism
    public entry fun unpause(admin: &signer) acquires BuybackConfig {
        let admin_addr = signer::address_of(admin);
        assert!(exists<BuybackConfig>(admin_addr), E_NOT_INITIALIZED);

        let config = borrow_global_mut<BuybackConfig>(admin_addr);
        assert!(config.paused, E_NOT_PAUSED);

        config.paused = false;
    }

    /// Update slippage tolerance (governance function)
    public entry fun update_slippage_tolerance(
        admin: &signer,
        new_slippage: u64
    ) acquires BuybackConfig {
        let admin_addr = signer::address_of(admin);
        assert!(exists<BuybackConfig>(admin_addr), E_NOT_INITIALIZED);
        assert!(new_slippage <= BASIS_POINTS, E_INVALID_SLIPPAGE);

        let config = borrow_global_mut<BuybackConfig>(admin_addr);
        config.slippage_tolerance = new_slippage;
    }

    /// Update price drop threshold (governance function)
    public entry fun update_price_drop_threshold(
        admin: &signer,
        new_threshold: u64
    ) acquires BuybackConfig {
        let admin_addr = signer::address_of(admin);
        assert!(exists<BuybackConfig>(admin_addr), E_NOT_INITIALIZED);

        let config = borrow_global_mut<BuybackConfig>(admin_addr);
        config.price_drop_threshold = new_threshold;
    }

    /// Update min/max buyback amounts (governance function)
    public entry fun update_buyback_limits(
        admin: &signer,
        min_amount: u64,
        max_amount: u64
    ) acquires BuybackConfig {
        let admin_addr = signer::address_of(admin);
        assert!(exists<BuybackConfig>(admin_addr), E_NOT_INITIALIZED);

        let config = borrow_global_mut<BuybackConfig>(admin_addr);
        config.min_buyback_amount = min_amount;
        config.max_buyback_amount = max_amount;
    }

    // ======================== VIEW FUNCTIONS ========================

    #[view]
    public fun get_dex_router(config_addr: address): address acquires BuybackConfig {
        assert!(exists<BuybackConfig>(config_addr), E_NOT_INITIALIZED);
        borrow_global<BuybackConfig>(config_addr).dex_router
    }

    #[view]
    public fun get_slippage_tolerance(config_addr: address): u64 acquires BuybackConfig {
        assert!(exists<BuybackConfig>(config_addr), E_NOT_INITIALIZED);
        borrow_global<BuybackConfig>(config_addr).slippage_tolerance
    }

    #[view]
    public fun get_price_drop_threshold(config_addr: address): u64 acquires BuybackConfig {
        assert!(exists<BuybackConfig>(config_addr), E_NOT_INITIALIZED);
        borrow_global<BuybackConfig>(config_addr).price_drop_threshold
    }

    #[view]
    public fun get_last_price(config_addr: address): Option<u64> acquires BuybackConfig {
        assert!(exists<BuybackConfig>(config_addr), E_NOT_INITIALIZED);
        *&borrow_global<BuybackConfig>(config_addr).last_price
    }

    #[view]
    public fun is_paused(config_addr: address): bool acquires BuybackConfig {
        assert!(exists<BuybackConfig>(config_addr), E_NOT_INITIALIZED);
        borrow_global<BuybackConfig>(config_addr).paused
    }

    #[view]
    public fun get_buyback_limits(config_addr: address): (u64, u64) acquires BuybackConfig {
        assert!(exists<BuybackConfig>(config_addr), E_NOT_INITIALIZED);
        let config = borrow_global<BuybackConfig>(config_addr);
        (config.min_buyback_amount, config.max_buyback_amount)
    }

    // ======================== TESTS ========================

    #[test(admin = @prediction_market)]
    public fun test_initialize_success(admin: &signer) {
        initialize(admin, @0x123, 500, 5000, @0x456, @0x789);

        let admin_addr = signer::address_of(admin);
        assert!(get_slippage_tolerance(admin_addr) == 500, 0);
        assert!(get_price_drop_threshold(admin_addr) == 5000, 0);
        assert!(!is_paused(admin_addr), 0);
    }

    #[test(admin = @prediction_market)]
    #[expected_failure(abort_code = E_INVALID_SLIPPAGE)]
    public fun test_invalid_slippage(admin: &signer) {
        initialize(admin, @0x123, 15000, 5000, @0x456, @0x789); // 150% slippage
    }
}
