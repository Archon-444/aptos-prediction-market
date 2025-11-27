module prediction_market::market_manager {
    use std::signer;
    use std::vector;
    use std::string::{Self, String};
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};
    use prediction_market::oracle;
    use prediction_market::access_control;
    friend prediction_market::betting;
    
    /// Error codes
    const ERROR_NOT_AUTHORIZED: u64 = 1;
    const ERROR_MARKET_NOT_FOUND: u64 = 2;
    const ERROR_MARKET_NOT_EXPIRED: u64 = 3;
    const ERROR_INVALID_OUTCOME: u64 = 4;
    const ERROR_ALREADY_RESOLVED: u64 = 5;
    const ERROR_ALREADY_INITIALIZED: u64 = 6;
    const ERROR_NOT_INITIALIZED: u64 = 7;
    const ERROR_MARKET_STILL_ACTIVE: u64 = 8;
    const ERROR_INVALID_DURATION: u64 = 9;
    const ERROR_EMPTY_QUESTION: u64 = 10;
    const ERROR_INVALID_OUTCOMES: u64 = 11;
    const ERROR_TOO_MANY_OUTCOMES: u64 = 12;
    const ERROR_OVERFLOW: u64 = 13;

    /// Constants
    const MAX_OUTCOMES: u64 = 10; // Limit outcomes to prevent DoS
    // SECURITY: Enhanced input validation constants
    const MAX_QUESTION_LENGTH: u64 = 500; // Maximum characters for question
    const MAX_OUTCOME_LENGTH: u64 = 100; // Maximum characters per outcome
    const MIN_DURATION_HOURS: u64 = 1; // Minimum 1 hour
    const MAX_DURATION_HOURS: u64 = 8760; // Maximum 1 year (365 days)
    
    /// Market struct representing a prediction market
    struct Market has store, drop {
        id: u64,
        question: String,
        outcomes: vector<String>,
        outcome_stakes: vector<u64>,  // Track stakes per outcome
        end_time: u64,
        resolution_time: u64,
        resolved: bool,
        winning_outcome: u8,
        total_stakes: u64,
        creator: address,
        created_at: u64,
    }
    
    /// Global store for all markets using Table for efficient lookups
    struct MarketStore has key {
        markets: Table<u64, Market>,
        next_market_id: u64,
        admin: address,
    }
    
    /// Event emitted when a market is created
    #[event]
    struct MarketCreatedEvent has drop, store {
        market_id: u64,
        creator: address,
        question: String,
        outcomes: vector<String>,
        end_time: u64,
        created_at: u64,
    }
    
    /// Event emitted when a market is resolved
    #[event]
    struct MarketResolvedEvent has drop, store {
        market_id: u64,
        winning_outcome: u8,
        resolution_time: u64,
        total_stakes: u64,
    }
    
    /// Initialize the market store and RBAC system
    /// Must be called once by the module publisher
    /// Can only be called by the account at @prediction_market
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);

        // Ensure called by the correct account
        assert!(account_addr == @prediction_market, ERROR_NOT_AUTHORIZED);

        // Prevent double initialization
        assert!(!exists<MarketStore>(@prediction_market), ERROR_ALREADY_INITIALIZED);

        // Initialize RBAC system first
        access_control::initialize(account);

        let store = MarketStore {
            markets: table::new(),
            next_market_id: 0,
            admin: account_addr,  // Use actual account address instead of @admin
        };
        move_to(account, store);
    }
    
    /// Create a new prediction market
    /// Checks pause status and optionally MARKET_CREATOR role
    public entry fun create_market(
        creator: &signer,
        question: vector<u8>,
        outcomes: vector<vector<u8>>,
        duration_hours: u64,
    ) acquires MarketStore {
        // Check system is not paused
        access_control::require_not_paused();

        // SECURITY: Enhanced input validation
        assert!(vector::length(&question) > 0, ERROR_EMPTY_QUESTION);
        assert!(vector::length(&question) <= MAX_QUESTION_LENGTH, ERROR_EMPTY_QUESTION);
        let outcomes_len = vector::length(&outcomes);
        assert!(outcomes_len == 2, ERROR_INVALID_OUTCOMES);
        assert!(outcomes_len <= MAX_OUTCOMES, ERROR_TOO_MANY_OUTCOMES); // Prevent DoS
        assert!(duration_hours >= MIN_DURATION_HOURS, ERROR_INVALID_DURATION);
        assert!(duration_hours <= MAX_DURATION_HOURS, ERROR_INVALID_DURATION); // Max 1 year

        // SECURITY: Validate each outcome string length
        let outcome_idx = 0;
        let outcome_len = vector::length(&outcomes);
        while (outcome_idx < outcome_len) {
            let outcome_bytes = vector::borrow(&outcomes, outcome_idx);
            assert!(vector::length(outcome_bytes) > 0, ERROR_INVALID_OUTCOMES);
            assert!(vector::length(outcome_bytes) <= MAX_OUTCOME_LENGTH, ERROR_INVALID_OUTCOMES);
            outcome_idx = outcome_idx + 1;
        };

        // Ensure MarketStore is initialized
        assert!(exists<MarketStore>(@prediction_market), ERROR_NOT_INITIALIZED);
        
        let creator_addr = signer::address_of(creator);

        let is_admin = access_control::is_admin(creator_addr);
        let can_create = access_control::can_create_markets(creator_addr);
        assert!(is_admin || can_create, ERROR_NOT_AUTHORIZED);

        let store = borrow_global_mut<MarketStore>(@prediction_market);
        
        let market_id = store.next_market_id;
        let current_time = timestamp::now_seconds();

        // Check overflow in duration calculation: duration_hours * 3600
        let (seconds, overflow1) = checked_mul(duration_hours, 3600);
        assert!(!overflow1, std::error::out_of_range(ERROR_OVERFLOW));

        // Check overflow in end_time calculation: current_time + seconds
        let (end_time, overflow2) = checked_add(current_time, seconds);
        assert!(!overflow2, std::error::out_of_range(ERROR_OVERFLOW));
        
        // Convert byte vectors to Strings
        let question_str = string::utf8(question);
        let outcomes_str = vector::empty<String>();
        let outcome_stakes = vector::empty<u64>();
        
        let i = 0;
        while (i < outcomes_len) {
            vector::push_back(&mut outcomes_str, string::utf8(*vector::borrow(&outcomes, i)));
            vector::push_back(&mut outcome_stakes, 0);  // Initialize stakes to 0
            i = i + 1;
        };
        
        let market = Market {
            id: market_id,
            question: question_str,
            outcomes: outcomes_str,
            outcome_stakes,
            end_time,
            resolution_time: 0,
            resolved: false,
            winning_outcome: 0,
            total_stakes: 0,
            creator: creator_addr,
            created_at: current_time,
        };
        
        table::add(&mut store.markets, market_id, market);
        store.next_market_id = market_id + 1;
        
        event::emit(MarketCreatedEvent {
            market_id,
            creator: creator_addr,
            question: question_str,
            outcomes: outcomes_str,
            end_time,
            created_at: current_time,
        });
    }
    
    /// Resolve a market with the winning outcome
    /// Uses RBAC for authorization and optionally oracle consensus
    /// Can only be called by users with RESOLVER role after market expiration
    public entry fun resolve_market(
        resolver: &signer,
        market_id: u64,
        winning_outcome: u8,
    ) acquires MarketStore {
        assert!(exists<MarketStore>(@prediction_market), ERROR_NOT_INITIALIZED);

        let resolver_addr = signer::address_of(resolver);

        // Check system is not paused
        access_control::require_not_paused();

        // Attempt automatic Pyth-based resolution if data is available
        let (_, _) = oracle::try_pyth_resolution(market_id);

        // Check if oracle has already resolved this market
        let oracle_resolved = oracle::is_market_resolved(market_id);

        if (oracle_resolved) {
            // If oracle resolved, verify the winning_outcome matches oracle consensus
            let (_, oracle_outcome) = oracle::get_oracle_resolution(market_id);
            assert!(
                winning_outcome == oracle_outcome,
                ERROR_INVALID_OUTCOME // Oracle consensus must match provided outcome
            );
        } else {
            // Manual resolution requires RESOLVER role or being the market creator
            let store_ref = borrow_global<MarketStore>(@prediction_market);
            let market_ref = table::borrow(&store_ref.markets, market_id);
            let is_creator = (resolver_addr == market_ref.creator);
            let has_resolver_role = access_control::has_role(resolver_addr, access_control::role_resolver());

            assert!(
                is_creator || has_resolver_role,
                ERROR_NOT_AUTHORIZED
            );
        };

        let store = borrow_global_mut<MarketStore>(@prediction_market);

        // Check if market exists
        assert!(table::contains(&store.markets, market_id), ERROR_MARKET_NOT_FOUND);

        let market = table::borrow_mut(&mut store.markets, market_id);

        // Validate market can be resolved
        let current_time = timestamp::now_seconds();
        assert!(current_time >= market.end_time, ERROR_MARKET_NOT_EXPIRED);
        assert!(!market.resolved, ERROR_ALREADY_RESOLVED);
        assert!((winning_outcome as u64) < vector::length(&market.outcomes), ERROR_INVALID_OUTCOME);

        // Update market state
        market.resolved = true;
        market.winning_outcome = winning_outcome;
        market.resolution_time = current_time;

        event::emit(MarketResolvedEvent {
            market_id,
            winning_outcome,
            resolution_time: current_time,
            total_stakes: market.total_stakes,
        });
    }
    
    /// Update stake amounts for a market (called by betting module)
    /// Friend function - only callable by betting module
    public(friend) fun update_market_stakes(
        market_id: u64,
        outcome_index: u8,
        stake_amount: u64,
    ) acquires MarketStore {
        let store = borrow_global_mut<MarketStore>(@prediction_market);
        assert!(table::contains(&store.markets, market_id), ERROR_MARKET_NOT_FOUND);
        
        let market = table::borrow_mut(&mut store.markets, market_id);
        
        // Update outcome-specific and total stakes
        let outcome_stakes = vector::borrow_mut(&mut market.outcome_stakes, (outcome_index as u64));
        *outcome_stakes = *outcome_stakes + stake_amount;
        market.total_stakes = market.total_stakes + stake_amount;
    }
    
    // ==================== View Functions ====================
    
    /// Get the total number of markets
    #[view]
    public fun get_market_count(): u64 acquires MarketStore {
        if (!exists<MarketStore>(@prediction_market)) {
            return 0
        };
        let store = borrow_global<MarketStore>(@prediction_market);
        store.next_market_id
    }
    
    /// Check if a market exists
    #[view]
    public fun market_exists(market_id: u64): bool acquires MarketStore {
        if (!exists<MarketStore>(@prediction_market)) {
            return false
        };
        let store = borrow_global<MarketStore>(@prediction_market);
        table::contains(&store.markets, market_id)
    }
    
    /// Check if a market is currently active (not expired and not resolved)
    #[view]
    public fun is_market_active(market_id: u64): bool acquires MarketStore {
        assert!(exists<MarketStore>(@prediction_market), ERROR_NOT_INITIALIZED);
        let store = borrow_global<MarketStore>(@prediction_market);
        
        if (!table::contains(&store.markets, market_id)) {
            return false
        };
        
        let market = table::borrow(&store.markets, market_id);
        let current_time = timestamp::now_seconds();
        
        !market.resolved && current_time < market.end_time
    }
    
    /// Get full market details
    #[view]
    public fun get_market_full(market_id: u64): (
        String,           // question
        vector<String>,   // outcomes
        vector<u64>,      // outcome_stakes
        u64,              // end_time
        bool,             // resolved
        u8,               // winning_outcome
        u64,              // total_stakes
        address,          // creator
        u64,              // created_at
        u64               // resolution_time
    ) acquires MarketStore {
        assert!(exists<MarketStore>(@prediction_market), ERROR_NOT_INITIALIZED);
        let store = borrow_global<MarketStore>(@prediction_market);
        assert!(table::contains(&store.markets, market_id), ERROR_MARKET_NOT_FOUND);
        
        let market = table::borrow(&store.markets, market_id);
        
        (
            market.question,
            market.outcomes,
            market.outcome_stakes,
            market.end_time,
            market.resolved,
            market.winning_outcome,
            market.total_stakes,
            market.creator,
            market.created_at,
            market.resolution_time
        )
    }
    
    /// Get basic market info (for listing)
    #[view]
    public fun get_market_basic(market_id: u64): (String, u64, bool) acquires MarketStore {
        assert!(exists<MarketStore>(@prediction_market), ERROR_NOT_INITIALIZED);
        let store = borrow_global<MarketStore>(@prediction_market);
        assert!(table::contains(&store.markets, market_id), ERROR_MARKET_NOT_FOUND);
        
        let market = table::borrow(&store.markets, market_id);
        (market.question, market.end_time, market.resolved)
    }
    
    /// Get market outcome stakes
    #[view]
    public fun get_market_stakes(market_id: u64): (vector<u64>, u64) acquires MarketStore {
        assert!(exists<MarketStore>(@prediction_market), ERROR_NOT_INITIALIZED);
        let store = borrow_global<MarketStore>(@prediction_market);
        assert!(table::contains(&store.markets, market_id), ERROR_MARKET_NOT_FOUND);
        
        let market = table::borrow(&store.markets, market_id);
        (market.outcome_stakes, market.total_stakes)
    }
    
    /// Check if market is resolved and get winning outcome
    #[view]
    public fun get_market_resolution(market_id: u64): (bool, u8) acquires MarketStore {
        assert!(exists<MarketStore>(@prediction_market), ERROR_NOT_INITIALIZED);
        let store = borrow_global<MarketStore>(@prediction_market);
        assert!(table::contains(&store.markets, market_id), ERROR_MARKET_NOT_FOUND);
        
        let market = table::borrow(&store.markets, market_id);
        (market.resolved, market.winning_outcome)
    }
    
    // ==================== Helper Functions ====================

    /// Checked multiplication to detect overflow
    fun checked_mul(a: u64, b: u64): (u64, bool) {
        if (a == 0 || b == 0) {
            return (0, false)
        };
        let result = a * b;
        // Check for overflow: if result / a != b, overflow occurred
        if (result / a != b) {
            (result, true) // Overflow occurred
        } else {
            (result, false) // No overflow
        }
    }

    /// Checked addition to detect overflow
    fun checked_add(a: u64, b: u64): (u64, bool) {
        let sum = a + b;
        if (sum < a) {
            (sum, true)  // Overflow occurred
        } else {
            (sum, false) // No overflow
        }
    }

    // ==================== Test Helpers ====================

    #[test_only]
    public fun get_admin(): address acquires MarketStore {
        let store = borrow_global<MarketStore>(@prediction_market);
        store.admin
    }
}
