module prediction_market::treasury {
    use aptos_framework::account;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::timestamp;
    use std::string::{Self, String};
    use std::signer;

    /// Treasury resource that holds USDC revenue and manages buyback allocations
    struct Treasury has key {
        /// USDC balance accumulated from platform fees
        usdc_balance: u64,
        /// Percentage allocated to buybacks (default: 25%)
        buyback_percentage: u64,
        /// Percentage allocated to team/operations (default: 15%)
        team_percentage: u64,
        /// Address of the buyback contract
        buyback_contract: address,
        /// Timestamp of last buyback execution
        last_buyback_timestamp: u64,
        /// Buyback interval in seconds (default: 30 days)
        buyback_interval: u64,
        /// Event handle for buyback events
        buyback_events: EventHandle<BuybackEvent>,
        /// Event handle for revenue events
        revenue_events: EventHandle<RevenueEvent>,
        /// Emergency pause flag
        paused: bool,
    }

    /// Event emitted when a buyback is executed
    struct BuybackEvent has drop, store {
        amount_usdc: u64,
        timestamp: u64,
    }

    /// Event emitted when revenue is recorded
    struct RevenueEvent has drop, store {
        amount_usdc: u64,
        revenue_type: String,
        timestamp: u64,
    }

    /// Error codes
    const E_INVALID_PERCENTAGE: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 2;
    const E_NO_USDC: u64 = 3;
    const E_BUYBACK_INTERVAL_NOT_MET: u64 = 4;
    const E_ALREADY_PAUSED: u64 = 5;
    const E_NOT_PAUSED: u64 = 6;
    const E_ZERO_ADDRESS: u64 = 7;
    const E_NOT_INITIALIZED: u64 = 8;
    const E_ALREADY_INITIALIZED: u64 = 9;
    const E_UNAUTHORIZED: u64 = 10;

    /// Initialize the treasury with buyback and team percentages
    public entry fun initialize(
        admin: &signer,
        buyback_percentage: u64,
        team_percentage: u64,
        buyback_contract: address
    ) {
        let admin_addr = signer::address_of(admin);

        // Validate inputs
        assert!(!exists<Treasury>(admin_addr), E_ALREADY_INITIALIZED);
        assert!(buyback_percentage + team_percentage <= 100, E_INVALID_PERCENTAGE);
        assert!(buyback_contract != @0x0, E_ZERO_ADDRESS);

        // Create treasury resource
        move_to(admin, Treasury {
            usdc_balance: 0,
            buyback_percentage,
            team_percentage,
            buyback_contract,
            last_buyback_timestamp: 0,
            buyback_interval: 30 * 24 * 60 * 60, // 30 days in seconds
            buyback_events: account::new_event_handle<BuybackEvent>(admin),
            revenue_events: account::new_event_handle<RevenueEvent>(admin),
            paused: false,
        });
    }

    /// Record revenue from prediction market operations
    /// This should be called by the prediction market contracts
    public fun record_revenue(
        treasury_addr: address,
        amount: u64,
        revenue_type: String
    ) acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        let treasury = borrow_global_mut<Treasury>(treasury_addr);

        // Add to balance
        treasury.usdc_balance = treasury.usdc_balance + amount;

        // Emit revenue event
        event::emit_event(
            &mut treasury.revenue_events,
            RevenueEvent {
                amount_usdc: amount,
                revenue_type,
                timestamp: timestamp::now_seconds()
            }
        );
    }

    /// Trigger a buyback using accumulated USDC
    /// Can be called manually or automated via cron job
    public entry fun trigger_buyback(admin: &signer) acquires Treasury {
        let admin_addr = signer::address_of(admin);
        assert!(exists<Treasury>(admin_addr), E_NOT_INITIALIZED);

        let treasury = borrow_global_mut<Treasury>(admin_addr);
        assert!(!treasury.paused, E_ALREADY_PAUSED);

        let now = timestamp::now_seconds();

        // Check if buyback interval has elapsed
        assert!(
            treasury.last_buyback_timestamp == 0 ||
            now - treasury.last_buyback_timestamp >= treasury.buyback_interval,
            E_BUYBACK_INTERVAL_NOT_MET
        );

        // Calculate buyback amount
        let buyback_amount = (treasury.usdc_balance * treasury.buyback_percentage) / 100;
        assert!(buyback_amount > 0, E_NO_USDC);

        // Deduct from balance
        treasury.usdc_balance = treasury.usdc_balance - buyback_amount;

        // Update last buyback timestamp
        treasury.last_buyback_timestamp = now;

        // Emit buyback event
        event::emit_event(
            &mut treasury.buyback_events,
            BuybackEvent {
                amount_usdc: buyback_amount,
                timestamp: now,
            }
        );

        // NOTE: Actual buyback execution will be handled by the buyback contract
        // This would involve transferring USDC to the buyback contract
        // and calling its execute_buyback function
    }

    /// Pause the treasury (emergency stop)
    public entry fun pause(admin: &signer) acquires Treasury {
        let admin_addr = signer::address_of(admin);
        assert!(exists<Treasury>(admin_addr), E_NOT_INITIALIZED);

        let treasury = borrow_global_mut<Treasury>(admin_addr);
        assert!(!treasury.paused, E_ALREADY_PAUSED);

        treasury.paused = true;
    }

    /// Unpause the treasury
    public entry fun unpause(admin: &signer) acquires Treasury {
        let admin_addr = signer::address_of(admin);
        assert!(exists<Treasury>(admin_addr), E_NOT_INITIALIZED);

        let treasury = borrow_global_mut<Treasury>(admin_addr);
        assert!(treasury.paused, E_NOT_PAUSED);

        treasury.paused = false;
    }

    /// Update buyback percentage (governance function)
    public entry fun update_buyback_percentage(
        admin: &signer,
        new_percentage: u64
    ) acquires Treasury {
        let admin_addr = signer::address_of(admin);
        assert!(exists<Treasury>(admin_addr), E_NOT_INITIALIZED);

        let treasury = borrow_global_mut<Treasury>(admin_addr);
        assert!(new_percentage + treasury.team_percentage <= 100, E_INVALID_PERCENTAGE);

        treasury.buyback_percentage = new_percentage;
    }

    /// Update team percentage (governance function)
    public entry fun update_team_percentage(
        admin: &signer,
        new_percentage: u64
    ) acquires Treasury {
        let admin_addr = signer::address_of(admin);
        assert!(exists<Treasury>(admin_addr), E_NOT_INITIALIZED);

        let treasury = borrow_global_mut<Treasury>(admin_addr);
        assert!(treasury.buyback_percentage + new_percentage <= 100, E_INVALID_PERCENTAGE);

        treasury.team_percentage = new_percentage;
    }

    /// Update buyback interval (governance function)
    public entry fun update_buyback_interval(
        admin: &signer,
        new_interval: u64
    ) acquires Treasury {
        let admin_addr = signer::address_of(admin);
        assert!(exists<Treasury>(admin_addr), E_NOT_INITIALIZED);

        let treasury = borrow_global_mut<Treasury>(admin_addr);
        treasury.buyback_interval = new_interval;
    }

    // ======================== VIEW FUNCTIONS ========================

    #[view]
    public fun get_usdc_balance(treasury_addr: address): u64 acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        borrow_global<Treasury>(treasury_addr).usdc_balance
    }

    #[view]
    public fun get_buyback_percentage(treasury_addr: address): u64 acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        borrow_global<Treasury>(treasury_addr).buyback_percentage
    }

    #[view]
    public fun get_team_percentage(treasury_addr: address): u64 acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        borrow_global<Treasury>(treasury_addr).team_percentage
    }

    #[view]
    public fun get_buyback_contract(treasury_addr: address): address acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        borrow_global<Treasury>(treasury_addr).buyback_contract
    }

    #[view]
    public fun get_last_buyback_timestamp(treasury_addr: address): u64 acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        borrow_global<Treasury>(treasury_addr).last_buyback_timestamp
    }

    #[view]
    public fun get_buyback_interval(treasury_addr: address): u64 acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        borrow_global<Treasury>(treasury_addr).buyback_interval
    }

    #[view]
    public fun is_paused(treasury_addr: address): bool acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        borrow_global<Treasury>(treasury_addr).paused
    }

    #[view]
    public fun calculate_next_buyback_amount(treasury_addr: address): u64 acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        let treasury = borrow_global<Treasury>(treasury_addr);
        (treasury.usdc_balance * treasury.buyback_percentage) / 100
    }

    #[view]
    public fun can_trigger_buyback(treasury_addr: address): bool acquires Treasury {
        assert!(exists<Treasury>(treasury_addr), E_NOT_INITIALIZED);
        let treasury = borrow_global<Treasury>(treasury_addr);

        if (treasury.paused) {
            return false
        };

        let now = timestamp::now_seconds();
        let interval_met = treasury.last_buyback_timestamp == 0 ||
                          now - treasury.last_buyback_timestamp >= treasury.buyback_interval;

        let has_balance = treasury.usdc_balance > 0;

        interval_met && has_balance
    }

    // ======================== TESTS ========================

    #[test_only]
    public fun test_init(admin: &signer) {
        initialize(admin, 25, 15, @0x123);
    }

    #[test(admin = @prediction_market)]
    public fun test_initialize_success(admin: &signer) {
        initialize(admin, 25, 15, @0x123);

        let admin_addr = signer::address_of(admin);
        assert!(get_buyback_percentage(admin_addr) == 25, 0);
        assert!(get_team_percentage(admin_addr) == 15, 0);
        assert!(!is_paused(admin_addr), 0);
    }

    #[test(admin = @prediction_market)]
    #[expected_failure(abort_code = E_INVALID_PERCENTAGE)]
    public fun test_initialize_invalid_percentage(admin: &signer) {
        initialize(admin, 60, 50, @0x123); // 110% total
    }
}
