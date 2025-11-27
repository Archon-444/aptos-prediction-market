/// Oracle module for automated market resolution
/// Supports multiple oracle sources with fallback to manual resolution
module prediction_market::oracle {
    use std::signer;
    use std::error;
    use std::vector;
    use std::string::String;
    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object::Object;
    use aptos_framework::primary_fungible_store;
    use aptos_std::table::{Self, Table};
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_std::option;
    use aptos_std::ed25519;
    use aptos_std::bcs;
    use prediction_market::collateral_vault;
    use prediction_market::pyth_reader;

    friend prediction_market::market_manager;

    // Error codes
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_ORACLE_NOT_FOUND: u64 = 2;
    const E_MARKET_NOT_REGISTERED: u64 = 3;
    const E_ALREADY_RESOLVED: u64 = 4;
    const E_INVALID_ORACLE_DATA: u64 = 5;
    const E_NOT_INITIALIZED: u64 = 6;
    const E_ALREADY_INITIALIZED: u64 = 7;
    const E_CONSENSUS_NOT_REACHED: u64 = 8;
    const E_ORACLE_DATA_OUT_OF_RANGE: u64 = 9;
    const E_DUPLICATE_ORACLE_VOTE: u64 = 10;
    const E_INSUFFICIENT_STAKE: u64 = 11;
    const E_ORACLE_SLASHED: u64 = 12;
    const E_OVERFLOW: u64 = 13;
    const E_INVALID_SIGNATURE: u64 = 14;
    const E_INVALID_NONCE: u64 = 15;
    const E_PUBLIC_KEY_NOT_REGISTERED: u64 = 16;
    const E_RELAY_NOT_AUTHORIZED: u64 = 17;
    const E_PYTH_NOT_CONFIGURED: u64 = 18;
    const E_PRICE_NOT_FRESH: u64 = 19;
    const E_INVALID_THRESHOLD: u64 = 20;

    /// Oracle types
    const ORACLE_TYPE_MANUAL: u8 = 0;      // Manual resolution only
    const ORACLE_TYPE_PYTH: u8 = 1;        // Pyth Network price feeds
    const ORACLE_TYPE_CUSTOM: u8 = 2;      // Custom on-chain oracle
    const ORACLE_TYPE_API: u8 = 3;         // Off-chain API (requires relayer)

    /// Resolution strategy per market
    const RESOLUTION_STRATEGY_PYTH_ONLY: u8 = 0;
    const RESOLUTION_STRATEGY_PYTH_WITH_OPTIMISTIC: u8 = 1;
    const RESOLUTION_STRATEGY_OPTIMISTIC_ONLY: u8 = 2;

    /// Reputation and slashing constants
    const INITIAL_REPUTATION: u64 = 100;
    const MIN_STAKE_REQUIRED: u64 = 10000000000; // 10,000 USDC (increased from 100 to prevent Sybil attacks)
    const MAX_STAKE_ALLOWED: u64 = 10000000000000; // 10M USDC (whale protection)
    const SLASH_PERCENTAGE: u64 = 20; // 20% slash for incorrect votes
    const REPUTATION_REWARD: u64 = 10; // Reputation reward for correct votes
    const REPUTATION_PENALTY: u64 = 15; // Reputation penalty for incorrect votes
    const PERCENTAGE_DENOMINATOR: u64 = 100; // Denominator for percentage calculations

    /// Consensus timeout constants
    const DEFAULT_CONSENSUS_TIMEOUT: u64 = 86400; // 24 hours in seconds
    const MAX_CONSENSUS_TIMEOUT: u64 = 604800; // 7 days in seconds

    /// Max oracles to prevent unbounded loops
    const MAX_ORACLES_PER_MARKET: u64 = 20;
    const PYTH_MAX_AGE_SECONDS: u64 = 300;

    /// Oracle reputation and stake tracking
    struct OracleReputation has store, drop {
        oracle_address: address,
        reputation_score: u64,
        total_votes: u64,
        correct_votes: u64,
        staked_amount: u64,
        is_active: bool,
        public_key: vector<u8>,  // Ed25519 public key for signature verification
        nonce: u64,              // Prevents replay attacks
    }

    /// Oracle source configuration
    struct OracleSource has store, copy, drop {
        oracle_type: u8,
        oracle_address: address,
        data_key: String,          // Price feed ID, data identifier, etc.
    }

    /// Oracle vote for consensus
    struct OracleVote has store, copy, drop {
        oracle_address: address,
        outcome_value: u8,
        timestamp: u64,
    }

    /// Market oracle registration with multi-oracle support
    struct MarketOracle has store, drop {
        market_id: u64,
        oracle_sources: vector<OracleSource>,  // Multiple oracle sources
        oracle_votes: vector<OracleVote>,      // Votes from different oracles
        resolution_value: u8,                  // Winning outcome index
        resolved: bool,
        resolution_timestamp: u64,
        can_manual_resolve: bool,              // Allow manual fallback
        required_consensus: u64,               // Number of oracles needed for consensus (e.g., 2 of 3)
        max_outcomes: u8,                      // For validation
        consensus_deadline: u64,               // Timestamp when consensus voting ends
        voting_started_at: u64,                // Timestamp when first vote was cast
        resolution_source: u8,
        resolution_strategy: u8,               // Which flow resolved the market
        pyth_threshold: u128,
        pyth_threshold_negative: bool,
        pyth_threshold_exponent: u64,
        pyth_threshold_exponent_negative: bool,
        pyth_outcome_above: u8,
        pyth_outcome_below: u8,
        pyth_configured: bool,
    }

    /// Global oracle registry
    struct OracleRegistry has key {
        admin: address,
        market_oracles: SmartTable<u64, MarketOracle>,  // market_id -> MarketOracle
        oracle_reputations: Table<address, OracleReputation>, // oracle_address -> reputation
        oracle_resolve_events: EventHandle<OracleResolveEvent>,
        oracle_slash_events: EventHandle<OracleSlashEvent>,
        staked_total: u64,
        vault_address: address,
        signer_cap: SignerCapability,
        metadata: Object<Metadata>,
        authorized_relayers: Table<address, bool>,
    }

    /// Events
    struct OracleResolveEvent has drop, store {
        market_id: u64,
        resolution_value: u8,
        oracle_type: u8,
        timestamp: u64,
    }

    struct OracleSlashEvent has drop, store {
        oracle_address: address,
        market_id: u64,
        slashed_amount: u64,
        reputation_loss: u64,
        timestamp: u64,
    }

    /// Initialize oracle system
    public entry fun initialize(admin: &signer, seed: vector<u8>) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @prediction_market, error::permission_denied(E_NOT_AUTHORIZED));
        assert!(!exists<OracleRegistry>(@prediction_market), error::already_exists(E_ALREADY_INITIALIZED));

        let metadata = collateral_vault::get_metadata_object();
        let (_, oracle_cap) = account::create_resource_account(admin, seed);
        let vault_address = account::get_signer_capability_address(&oracle_cap);
        primary_fungible_store::ensure_primary_store_exists(vault_address, metadata);

        move_to(admin, OracleRegistry {
            admin: admin_addr,
            market_oracles: smart_table::new(),
            oracle_reputations: table::new<address, OracleReputation>(),
            oracle_resolve_events: account::new_event_handle<OracleResolveEvent>(admin),
            oracle_slash_events: account::new_event_handle<OracleSlashEvent>(admin),
            staked_total: 0,
            vault_address,
            signer_cap: oracle_cap,
            metadata,
            authorized_relayers: table::new<address, bool>(),
        });
    }

    /// Register oracle with initial stake (USDC) and public key
    public entry fun register_oracle(
        oracle: &signer,
        stake_amount: u64,
        public_key: vector<u8>,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);

        let oracle_addr = signer::address_of(oracle);

        // Validate stake amount (min and max for whale protection)
        assert!(stake_amount >= MIN_STAKE_REQUIRED, error::invalid_argument(E_INSUFFICIENT_STAKE));
        assert!(stake_amount <= MAX_STAKE_ALLOWED, error::invalid_argument(E_INVALID_ORACLE_DATA));

        // Validate public key length (Ed25519 public keys are 32 bytes)
        assert!(vector::length(&public_key) == 32, error::invalid_argument(E_INVALID_ORACLE_DATA));

        // CRITICAL: Transfer stake from oracle to registry vault
        primary_fungible_store::ensure_primary_store_exists(oracle_addr, registry.metadata);
        primary_fungible_store::transfer(oracle, registry.metadata, registry.vault_address, stake_amount);

        let (new_total, overflow) = overflowing_add(registry.staked_total, stake_amount);
        assert!(!overflow, error::out_of_range(E_OVERFLOW));
        registry.staked_total = new_total;

        // Create or update oracle reputation
        if (table::contains(&registry.oracle_reputations, oracle_addr)) {
            let reputation = table::borrow_mut(&mut registry.oracle_reputations, oracle_addr);
            reputation.staked_amount = reputation.staked_amount + stake_amount;
            reputation.is_active = true;
        } else {
            let new_reputation = OracleReputation {
                oracle_address: oracle_addr,
                reputation_score: INITIAL_REPUTATION,
                total_votes: 0,
                correct_votes: 0,
                staked_amount: stake_amount,
                is_active: true,
                public_key,
                nonce: 0,
            };
            table::add(&mut registry.oracle_reputations, oracle_addr, new_reputation);
        };
    }

    /// Withdraw stake (only if oracle is inactive or exceeds minimum)
    public entry fun withdraw_stake(
        oracle: &signer,
        amount: u64,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);

        let oracle_addr = signer::address_of(oracle);
        assert!(table::contains(&registry.oracle_reputations, oracle_addr), error::not_found(E_ORACLE_NOT_FOUND));

        let reputation = table::borrow_mut(&mut registry.oracle_reputations, oracle_addr);
        assert!(reputation.staked_amount >= amount, error::invalid_argument(E_INSUFFICIENT_STAKE));

        // Update stake trackers
        reputation.staked_amount = reputation.staked_amount - amount;
        if (reputation.staked_amount < MIN_STAKE_REQUIRED) {
            reputation.is_active = false;
        };

        let vault_balance = primary_fungible_store::balance(registry.vault_address, registry.metadata);
        assert!(vault_balance >= amount, error::invalid_argument(E_INSUFFICIENT_STAKE));

        let (new_total, underflow) = overflowing_sub(registry.staked_total, amount);
        assert!(!underflow, error::invalid_argument(E_INSUFFICIENT_STAKE));
        registry.staked_total = new_total;

        let vault_signer = account::create_signer_with_capability(&registry.signer_cap);
        primary_fungible_store::transfer(&vault_signer, registry.metadata, oracle_addr, amount);
    }

    /// Authorize a relayer to submit Pyth price updates
    public entry fun register_pyth_relayer(
        admin: &signer,
        relayer: address,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == registry.admin, error::permission_denied(E_NOT_AUTHORIZED));

        if (table::contains(&registry.authorized_relayers, relayer)) {
            *table::borrow_mut(&mut registry.authorized_relayers, relayer) = true;
        } else {
            table::add(&mut registry.authorized_relayers, relayer, true);
        };
    }

    /// Remove an authorized Pyth relayer
    public entry fun remove_pyth_relayer(
        admin: &signer,
        relayer: address,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == registry.admin, error::permission_denied(E_NOT_AUTHORIZED));

        if (table::contains(&registry.authorized_relayers, relayer)) {
            table::remove(&mut registry.authorized_relayers, relayer);
        };
    }

    /// Configure feed metadata for a market by delegating to the reader module
    public entry fun configure_pyth_feed(
        admin: &signer,
        market_id: u64,
        feed_id: vector<u8>,
        staleness_threshold_secs: u64,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == registry.admin, error::permission_denied(E_NOT_AUTHORIZED));
        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));

        pyth_reader::register_feed(admin, market_id, feed_id, staleness_threshold_secs);
    }

    /// Remove feed metadata and reset cached state
    public entry fun clear_pyth_feed(
        admin: &signer,
        market_id: u64,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == registry.admin, error::permission_denied(E_NOT_AUTHORIZED));
        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));

        {
            let market_oracle = smart_table::borrow_mut(&mut registry.market_oracles, market_id);
            market_oracle.pyth_configured = false;
        };

        pyth_reader::unregister_feed(admin, market_id);
    }

    /// Update the configured resolution strategy for a market
    public entry fun set_resolution_strategy(
        admin: &signer,
        market_id: u64,
        strategy: u8,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == registry.admin, error::permission_denied(E_NOT_AUTHORIZED));
        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));

        assert!(
            strategy == RESOLUTION_STRATEGY_PYTH_ONLY ||
            strategy == RESOLUTION_STRATEGY_PYTH_WITH_OPTIMISTIC ||
            strategy == RESOLUTION_STRATEGY_OPTIMISTIC_ONLY,
            error::invalid_argument(E_INVALID_ORACLE_DATA)
        );

        let market_oracle = smart_table::borrow_mut(&mut registry.market_oracles, market_id);
        market_oracle.resolution_strategy = strategy;
    }

    /// Configure Pyth threshold mapping for a market
    public entry fun configure_pyth_market(
        admin: &signer,
        market_id: u64,
        threshold_price: u128,
        threshold_price_negative: bool,
        threshold_exponent: u64,
        threshold_exponent_negative: bool,
        outcome_above: u8,
        outcome_below: u8,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == registry.admin, error::permission_denied(E_NOT_AUTHORIZED));
        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));

        let market_oracle = smart_table::borrow_mut(&mut registry.market_oracles, market_id);
        assert!((outcome_above as u64) < (market_oracle.max_outcomes as u64), error::invalid_argument(E_INVALID_THRESHOLD));
        assert!((outcome_below as u64) < (market_oracle.max_outcomes as u64), error::invalid_argument(E_INVALID_THRESHOLD));

        market_oracle.pyth_threshold = threshold_price;
        market_oracle.pyth_threshold_negative = threshold_price_negative;
        market_oracle.pyth_threshold_exponent = threshold_exponent;
        market_oracle.pyth_threshold_exponent_negative = threshold_exponent_negative;
        market_oracle.pyth_outcome_above = outcome_above;
        market_oracle.pyth_outcome_below = outcome_below;
        market_oracle.pyth_configured = true;
    }

    /// Submit a verified Pyth price snapshot via the reader cache
    public entry fun submit_pyth_price(
        relayer: &signer,
        market_id: u64,
        price: u128,
        price_negative: bool,
        confidence: u64,
        expo: u64,
        expo_negative: bool,
        publish_time: u64,
        vaa_hash: vector<u8>,
        resolution_hint: option::Option<u8>,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);
        let relayer_addr = signer::address_of(relayer);
        assert!(table::contains(&registry.authorized_relayers, relayer_addr), error::permission_denied(E_RELAY_NOT_AUTHORIZED));
        let authorized = *table::borrow(&registry.authorized_relayers, relayer_addr);
        assert!(authorized, error::permission_denied(E_RELAY_NOT_AUTHORIZED));
        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));

        {
            let market_oracle = smart_table::borrow(&registry.market_oracles, market_id);
            assert!(market_oracle.pyth_configured, error::invalid_state(E_PYTH_NOT_CONFIGURED));
            assert!(!market_oracle.resolved, error::invalid_state(E_ALREADY_RESOLVED));
        };

        pyth_reader::submit_price_update(
            relayer,
            market_id,
            price,
            price_negative,
            confidence,
            expo,
            expo_negative,
            publish_time,
            vaa_hash,
            resolution_hint,
        );
    }

    /// Register a market with multiple oracle sources
    public(friend) fun register_market_oracle_multi(
        market_id: u64,
        oracle_sources: vector<OracleSource>,
        required_consensus: u64,
        max_outcomes: u8,
        can_manual_resolve: bool,
    ) acquires OracleRegistry {
        register_market_oracle_multi_with_timeout(
            market_id,
            oracle_sources,
            required_consensus,
            max_outcomes,
            can_manual_resolve,
            DEFAULT_CONSENSUS_TIMEOUT
        )
    }

    public(friend) fun try_pyth_resolution(
        market_id: u64,
    ): (bool, u8) acquires OracleRegistry {
        if (!exists<OracleRegistry>(@prediction_market)) {
            return (false, 0)
        };

        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);
        if (!smart_table::contains(&registry.market_oracles, market_id)) {
            return (false, 0)
        };

        let market_oracle = smart_table::borrow_mut(&mut registry.market_oracles, market_id);
        if (market_oracle.resolved) {
            return (true, market_oracle.resolution_value)
        };

        if (!market_oracle.pyth_configured) {
            return (false, 0)
        };

        if (!pyth_reader::has_price_snapshot(market_id)) {
            return (false, 0)
        };

        let (price_value, price_negative, price_exponent, price_exponent_negative, publish_time) =
            pyth_reader::get_snapshot_data(market_id);

        let staleness_threshold = pyth_reader::get_staleness_threshold(market_id);

        let now = timestamp::now_seconds();
        let elapsed = if (now > publish_time) {
            now - publish_time
        } else {
            0
        };

        if (elapsed > PYTH_MAX_AGE_SECONDS || elapsed > staleness_threshold) {
            return (false, 0)
        };

        assert!((market_oracle.pyth_outcome_above as u64) < (market_oracle.max_outcomes as u64), error::invalid_argument(E_INVALID_THRESHOLD));
        assert!((market_oracle.pyth_outcome_below as u64) < (market_oracle.max_outcomes as u64), error::invalid_argument(E_INVALID_THRESHOLD));

        if (
            price_exponent != market_oracle.pyth_threshold_exponent ||
            price_exponent_negative != market_oracle.pyth_threshold_exponent_negative
        ) {
            return (false, 0)
        };

        let price_is_ge = signed_ge(
            price_value,
            price_negative,
            market_oracle.pyth_threshold,
            market_oracle.pyth_threshold_negative,
        );

        let resolved_outcome = if (price_is_ge) {
            market_oracle.pyth_outcome_above
        } else {
            market_oracle.pyth_outcome_below
        };

        market_oracle.resolved = true;
        market_oracle.resolution_value = resolved_outcome;
        market_oracle.resolution_timestamp = now;
        market_oracle.resolution_source = ORACLE_TYPE_PYTH;

        event::emit_event(&mut registry.oracle_resolve_events, OracleResolveEvent {
            market_id,
            resolution_value: resolved_outcome,
            oracle_type: ORACLE_TYPE_PYTH,
            timestamp: now,
        });

        (true, resolved_outcome)
    }

    /// Register a market with multiple oracle sources and custom timeout
    public(friend) fun register_market_oracle_multi_with_timeout(
        market_id: u64,
        oracle_sources: vector<OracleSource>,
        required_consensus: u64,
        max_outcomes: u8,
        can_manual_resolve: bool,
        consensus_timeout: u64,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);

        // Validate consensus requirement
        let num_oracles = vector::length(&oracle_sources);
        assert!(required_consensus > 0 && required_consensus <= num_oracles, error::invalid_argument(E_INVALID_ORACLE_DATA));

        // Validate timeout
        assert!(consensus_timeout > 0 && consensus_timeout <= MAX_CONSENSUS_TIMEOUT, error::invalid_argument(E_INVALID_ORACLE_DATA));

        let market_oracle = MarketOracle {
            market_id,
            oracle_sources,
            oracle_votes: vector::empty<OracleVote>(),
            resolution_value: 0,
            resolved: false,
            resolution_timestamp: 0,
            can_manual_resolve,
            required_consensus,
            max_outcomes,
            consensus_deadline: 0, // Set when first vote is cast
            voting_started_at: 0,
            resolution_source: ORACLE_TYPE_MANUAL,
            resolution_strategy: RESOLUTION_STRATEGY_PYTH_WITH_OPTIMISTIC,
            pyth_threshold: 0,
            pyth_threshold_negative: false,
            pyth_threshold_exponent: 0,
            pyth_threshold_exponent_negative: false,
            pyth_outcome_above: 0,
            pyth_outcome_below: 0,
            pyth_configured: false,
        };

        smart_table::upsert(&mut registry.market_oracles, market_id, market_oracle);
    }

    /// Register a market with a single oracle source (backward compatibility)
    public(friend) fun register_market_oracle(
        market_id: u64,
        oracle_type: u8,
        oracle_address: address,
        data_key: String,
        can_manual_resolve: bool,
    ) acquires OracleRegistry {
        let oracle_source = OracleSource {
            oracle_type,
            oracle_address,
            data_key,
        };

        let oracle_sources = vector::empty<OracleSource>();
        vector::push_back(&mut oracle_sources, oracle_source);

        register_market_oracle_multi(market_id, oracle_sources, 1, 2, can_manual_resolve);
    }

    /// Submit oracle vote with signature verification (multi-oracle consensus)
    public entry fun submit_oracle_vote(
        oracle: &signer,
        market_id: u64,
        outcome_value: u8,
        nonce: u64,
        signature: vector<u8>,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);

        let oracle_addr = signer::address_of(oracle);

        // Check oracle reputation and stake
        assert!(table::contains(&registry.oracle_reputations, oracle_addr), error::not_found(E_ORACLE_NOT_FOUND));
        let reputation = table::borrow_mut(&mut registry.oracle_reputations, oracle_addr);
        assert!(reputation.is_active, error::permission_denied(E_ORACLE_SLASHED));
        assert!(reputation.staked_amount >= MIN_STAKE_REQUIRED, error::invalid_argument(E_INSUFFICIENT_STAKE));

        // SECURITY: Verify signature to prevent oracle impersonation
        assert!(vector::length(&reputation.public_key) == 32, error::invalid_state(E_PUBLIC_KEY_NOT_REGISTERED));
        assert!(nonce == reputation.nonce, error::invalid_argument(E_INVALID_NONCE));

        // Create message to sign: market_id || outcome_value || nonce
        let message = vector::empty<u8>();
        vector::append(&mut message, bcs::to_bytes(&market_id));
        vector::append(&mut message, bcs::to_bytes(&outcome_value));
        vector::append(&mut message, bcs::to_bytes(&nonce));

        // Verify Ed25519 signature
        let public_key_obj = ed25519::new_unvalidated_public_key_from_bytes(reputation.public_key);
        let signature_obj = ed25519::new_signature_from_bytes(signature);
        assert!(
            ed25519::signature_verify_strict(&signature_obj, &public_key_obj, message),
            error::invalid_argument(E_INVALID_SIGNATURE)
        );

        // Increment nonce to prevent replay attacks
        reputation.nonce = reputation.nonce + 1;

        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));
        let market_oracle = smart_table::borrow_mut(&mut registry.market_oracles, market_id);

        assert!(!market_oracle.resolved, error::invalid_state(E_ALREADY_RESOLVED));

        // Validate outcome is within range
        assert!((outcome_value as u64) < (market_oracle.max_outcomes as u64), error::invalid_argument(E_ORACLE_DATA_OUT_OF_RANGE));

        // Check if oracle is authorized
        let is_authorized = is_oracle_authorized(&market_oracle.oracle_sources, oracle_addr);
        assert!(is_authorized, error::permission_denied(E_NOT_AUTHORIZED));

        // Check for duplicate vote
        let has_voted = has_oracle_voted(&market_oracle.oracle_votes, oracle_addr);
        assert!(!has_voted, error::invalid_state(E_DUPLICATE_ORACLE_VOTE));

        let now = timestamp::now_seconds();

        // Initialize consensus deadline on first vote
        if (market_oracle.voting_started_at == 0) {
            market_oracle.voting_started_at = now;
            market_oracle.consensus_deadline = now + DEFAULT_CONSENSUS_TIMEOUT;
        } else {
            // Check if consensus deadline has passed
            assert!(now <= market_oracle.consensus_deadline, error::invalid_state(E_CONSENSUS_NOT_REACHED));
        };

        // Add vote
        let vote = OracleVote {
            oracle_address: oracle_addr,
            outcome_value,
            timestamp: now,
        };
        vector::push_back(&mut market_oracle.oracle_votes, vote);

        // Increment total votes for oracle with overflow check
        let reputation_mut = table::borrow_mut(&mut registry.oracle_reputations, oracle_addr);
        let (new_total_votes, overflow_votes) = checked_add(reputation_mut.total_votes, 1);
        assert!(!overflow_votes, error::out_of_range(E_OVERFLOW));
        reputation_mut.total_votes = new_total_votes;

        // Check for consensus
        let (has_consensus, consensus_value) = check_consensus(&market_oracle.oracle_votes, market_oracle.required_consensus);
        if (has_consensus) {
            // Resolve market automatically
            market_oracle.resolved = true;
            market_oracle.resolution_value = consensus_value;
            market_oracle.resolution_timestamp = timestamp::now_seconds();
            market_oracle.resolution_source = ORACLE_TYPE_CUSTOM;

            // Process rewards and slashing
            process_oracle_rewards_and_slashing(
                &mut registry.oracle_reputations,
                &mut registry.oracle_slash_events,
                &market_oracle.oracle_votes,
                consensus_value,
                market_id
            );

            // Emit event
            event::emit_event(&mut registry.oracle_resolve_events, OracleResolveEvent {
                market_id,
                resolution_value: consensus_value,
                oracle_type: ORACLE_TYPE_CUSTOM, // Multi-oracle consensus
                timestamp: market_oracle.resolution_timestamp,
            });
        };
    }

    /// Resolve market automatically via oracle (legacy single oracle)
    public entry fun resolve_market_auto(
        resolver: &signer,
        market_id: u64,
        resolution_value: u8,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);

        // Only admin or authorized oracle relayer can call this
        let resolver_addr = signer::address_of(resolver);
        assert!(resolver_addr == registry.admin, error::permission_denied(E_NOT_AUTHORIZED));

        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));
        let market_oracle = smart_table::borrow_mut(&mut registry.market_oracles, market_id);

        assert!(!market_oracle.resolved, error::invalid_state(E_ALREADY_RESOLVED));

        // Validate outcome
        assert!((resolution_value as u64) < (market_oracle.max_outcomes as u64), error::invalid_argument(E_ORACLE_DATA_OUT_OF_RANGE));

        // Update resolution
        market_oracle.resolved = true;
        market_oracle.resolution_value = resolution_value;
        market_oracle.resolution_timestamp = timestamp::now_seconds();

        // Emit event
        let oracle_type = if (vector::length(&market_oracle.oracle_sources) > 0) {
            vector::borrow(&market_oracle.oracle_sources, 0).oracle_type
        } else {
            ORACLE_TYPE_MANUAL
        };
        market_oracle.resolution_source = oracle_type;

        event::emit_event(&mut registry.oracle_resolve_events, OracleResolveEvent {
            market_id,
            resolution_value,
            oracle_type,
            timestamp: market_oracle.resolution_timestamp,
        });
    }

    /// Manual resolution fallback (when oracle fails or consensus timeout)
    public entry fun resolve_market_manual(
        resolver: &signer,
        market_id: u64,
        resolution_value: u8,
    ) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global_mut<OracleRegistry>(@prediction_market);

        let resolver_addr = signer::address_of(resolver);
        assert!(resolver_addr == registry.admin, error::permission_denied(E_NOT_AUTHORIZED));

        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));
        let market_oracle = smart_table::borrow_mut(&mut registry.market_oracles, market_id);

        assert!(!market_oracle.resolved, error::invalid_state(E_ALREADY_RESOLVED));

        // Allow manual resolution if either:
        // 1. Manual resolution is enabled
        // 2. Consensus deadline has passed without reaching consensus
        let now = timestamp::now_seconds();
        let timeout_passed = market_oracle.voting_started_at > 0 && now > market_oracle.consensus_deadline;
        assert!(market_oracle.can_manual_resolve || timeout_passed, error::permission_denied(E_NOT_AUTHORIZED));

        // Update resolution
        market_oracle.resolved = true;
        market_oracle.resolution_value = resolution_value;
        market_oracle.resolution_timestamp = timestamp::now_seconds();

        // Emit event with MANUAL type
        event::emit_event(&mut registry.oracle_resolve_events, OracleResolveEvent {
            market_id,
            resolution_value,
            oracle_type: ORACLE_TYPE_MANUAL,
            timestamp: market_oracle.resolution_timestamp,
        });
    }

    // ==================== View Functions ====================

    /// Check if market has oracle resolution
    #[view]
    public fun is_market_resolved(market_id: u64): bool acquires OracleRegistry {
        if (!exists<OracleRegistry>(@prediction_market)) {
            return false
        };
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        if (!smart_table::contains(&registry.market_oracles, market_id)) {
            return false
        };

        let market_oracle = smart_table::borrow(&registry.market_oracles, market_id);
        market_oracle.resolved
    }

    /// Get oracle resolution for a market
    #[view]
    public fun get_oracle_resolution(market_id: u64): (bool, u8) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));
        let market_oracle = smart_table::borrow(&registry.market_oracles, market_id);

        (market_oracle.resolved, market_oracle.resolution_value)
    }

    /// Get oracle type for a market
    #[view]
    public fun get_oracle_type(market_id: u64): u8 acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));
        let market_oracle = smart_table::borrow(&registry.market_oracles, market_id);

        if (vector::length(&market_oracle.oracle_sources) > 0) {
            vector::borrow(&market_oracle.oracle_sources, 0).oracle_type
        } else {
            ORACLE_TYPE_MANUAL
        }
    }

    #[view]
    public fun get_resolution_source(market_id: u64): u8 acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));
        let market_oracle = smart_table::borrow(&registry.market_oracles, market_id);

        market_oracle.resolution_source
    }

    #[view]
    public fun get_resolution_strategy(market_id: u64): u8 acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));
        let market_oracle = smart_table::borrow(&registry.market_oracles, market_id);

        market_oracle.resolution_strategy
    }

    #[view]
    public fun get_pyth_price(market_id: u64): (bool, u128, bool, u64, u64, bool, u64, u64) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));
        let market_oracle = smart_table::borrow(&registry.market_oracles, market_id);

        if (!market_oracle.pyth_configured) {
            return (false, 0, false, 0, 0, false, 0, 0)
        };

        if (!pyth_reader::has_price_snapshot(market_id)) {
            return (false, 0, false, 0, 0, false, 0, 0)
        };

        let (price, price_negative, confidence, expo, expo_negative, publish_time, received_at) =
            pyth_reader::get_full_snapshot_data(market_id);

        (true, price, price_negative, confidence, expo, expo_negative, publish_time, received_at)
    }

    // ==================== Helper Functions ====================

    fun signed_ge(
        left_mag: u128,
        left_negative: bool,
        right_mag: u128,
        right_negative: bool,
    ): bool {
        if (left_negative && !right_negative) {
            return false
        };
        if (!left_negative && right_negative) {
            return true
        };
        if (left_negative) {
            return left_mag <= right_mag
        };
        left_mag >= right_mag
    }

    /// Check if an oracle address is authorized
    fun is_oracle_authorized(oracle_sources: &vector<OracleSource>, oracle_addr: address): bool {
        let i = 0;
        let len = vector::length(oracle_sources);
        while (i < len) {
            let source = vector::borrow(oracle_sources, i);
            if (source.oracle_address == oracle_addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Check if an oracle has already voted
    fun has_oracle_voted(votes: &vector<OracleVote>, oracle_addr: address): bool {
        let i = 0;
        let len = vector::length(votes);
        while (i < len) {
            let vote = vector::borrow(votes, i);
            if (vote.oracle_address == oracle_addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Check if consensus is reached and return the consensus value
    fun check_consensus(votes: &vector<OracleVote>, required_consensus: u64): (bool, u8) {
        let num_votes = vector::length(votes);
        if (num_votes < required_consensus) {
            return (false, 0)
        };

        // Count votes for each outcome
        let i = 0;
        let max_outcome = 0u8;

        // Find the maximum outcome value to size our count vector
        while (i < num_votes) {
            let vote = vector::borrow(votes, i);
            if (vote.outcome_value > max_outcome) {
                max_outcome = vote.outcome_value;
            };
            i = i + 1;
        };

        // Create vote count vector
        let outcome_counts = vector::empty<u64>();
        let j = 0;
        while (j <= (max_outcome as u64)) {
            vector::push_back(&mut outcome_counts, 0);
            j = j + 1;
        };

        // Count votes
        i = 0;
        while (i < num_votes) {
            let vote = vector::borrow(votes, i);
            let count_ref = vector::borrow_mut(&mut outcome_counts, (vote.outcome_value as u64));
            *count_ref = *count_ref + 1;
            i = i + 1;
        };

        // Find outcome with most votes
        let max_count = 0u64;
        let consensus_outcome = 0u8;
        i = 0;
        while (i < vector::length(&outcome_counts)) {
            let count = *vector::borrow(&outcome_counts, i);
            if (count > max_count) {
                max_count = count;
                consensus_outcome = (i as u8);
            };
            i = i + 1;
        };

        // Check if consensus is reached
        if (max_count >= required_consensus) {
            (true, consensus_outcome)
        } else {
            (false, 0)
        }
    }

    /// Process rewards for correct votes and slash incorrect votes
    fun process_oracle_rewards_and_slashing(
        oracle_reputations: &mut Table<address, OracleReputation>,
        slash_events: &mut EventHandle<OracleSlashEvent>,
        votes: &vector<OracleVote>,
        winning_outcome: u8,
        market_id: u64,
    ) {
        let i = 0;
        let len = vector::length(votes);

        // Enforce max iteration limit to prevent gas exhaustion
        assert!(len <= MAX_ORACLES_PER_MARKET, error::invalid_argument(E_INVALID_ORACLE_DATA));

        while (i < len) {
            let vote = vector::borrow(votes, i);
            let oracle_addr = vote.oracle_address;

            if (table::contains(oracle_reputations, oracle_addr)) {
                let reputation = table::borrow_mut(oracle_reputations, oracle_addr);

                if (vote.outcome_value == winning_outcome) {
                    // Correct vote - reward oracle with checked arithmetic
                    let (new_correct_votes, overflow1) = checked_add(reputation.correct_votes, 1);
                    assert!(!overflow1, error::out_of_range(E_OVERFLOW));
                    reputation.correct_votes = new_correct_votes;

                    let (new_reputation, overflow2) = checked_add(reputation.reputation_score, REPUTATION_REWARD);
                    assert!(!overflow2, error::out_of_range(E_OVERFLOW));
                    reputation.reputation_score = new_reputation;
                } else {
                    // Incorrect vote - slash oracle with checked arithmetic
                    // Validate SLASH_PERCENTAGE to prevent division by zero
                    assert!(SLASH_PERCENTAGE > 0 && SLASH_PERCENTAGE <= PERCENTAGE_DENOMINATOR,
                            error::invalid_argument(E_INVALID_ORACLE_DATA));

                    // Calculate slash amount with overflow protection
                    let (slash_product, overflow) = checked_mul(reputation.staked_amount, SLASH_PERCENTAGE);
                    assert!(!overflow, error::out_of_range(E_OVERFLOW));

                    let slash_amount = slash_product / PERCENTAGE_DENOMINATOR;

                    // Subtract slash amount with underflow protection
                    let (new_stake, underflow) = checked_sub(reputation.staked_amount, slash_amount);
                    assert!(!underflow, error::invalid_state(E_INSUFFICIENT_STAKE));
                    reputation.staked_amount = new_stake;

                    // Reduce reputation with underflow protection
                    if (reputation.reputation_score >= REPUTATION_PENALTY) {
                        reputation.reputation_score = reputation.reputation_score - REPUTATION_PENALTY;
                    } else {
                        reputation.reputation_score = 0;
                    };

                    // Deactivate if stake falls below minimum
                    if (reputation.staked_amount < MIN_STAKE_REQUIRED) {
                        reputation.is_active = false;
                    };

                    // Emit slash event
                    event::emit_event(slash_events, OracleSlashEvent {
                        oracle_address: oracle_addr,
                        market_id,
                        slashed_amount: slash_amount,
                        reputation_loss: REPUTATION_PENALTY,
                        timestamp: timestamp::now_seconds(),
                    });
                };
            };

            i = i + 1;
        };
    }

    // ==================== Helper Functions for Checked Arithmetic ====================

    fun overflowing_add(a: u64, b: u64): (u64, bool) {
        let sum = a + b;
        if (sum < a) {
            (sum, true)
        } else {
            (sum, false)
        }
    }

    fun overflowing_sub(a: u64, b: u64): (u64, bool) {
        if (a < b) {
            (0, true)
        } else {
            (a - b, false)
        }
    }

    /// Checked addition - returns (result, overflow_occurred)
    fun checked_add(a: u64, b: u64): (u64, bool) {
        let max_u64: u64 = 18446744073709551615; // 2^64 - 1
        if (a > max_u64 - b) {
            (a + b, true) // Overflow occurred
        } else {
            (a + b, false) // No overflow
        }
    }

    /// Checked subtraction - returns (result, underflow_occurred)
    fun checked_sub(a: u64, b: u64): (u64, bool) {
        if (a < b) {
            (0, true) // Underflow occurred
        } else {
            (a - b, false) // No underflow
        }
    }

    /// Checked multiplication - returns (result, overflow_occurred)
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

    // ==================== View Functions for Reputation ====================

    #[view]
    public fun get_oracle_reputation(oracle_address: address): (u64, u64, u64, u64, bool) acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        if (!table::contains(&registry.oracle_reputations, oracle_address)) {
            return (0, 0, 0, 0, false)
        };

        let reputation = table::borrow(&registry.oracle_reputations, oracle_address);
        (
            reputation.reputation_score,
            reputation.total_votes,
            reputation.correct_votes,
            reputation.staked_amount,
            reputation.is_active
        )
    }

    #[view]
    public fun get_oracle_accuracy(oracle_address: address): u64 acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        if (!table::contains(&registry.oracle_reputations, oracle_address)) {
            return 0
        };

        let reputation = table::borrow(&registry.oracle_reputations, oracle_address);
        if (reputation.total_votes == 0) {
            return 0
        };

        // Return accuracy as percentage (0-100)
        (reputation.correct_votes * 100) / reputation.total_votes
    }

    #[view]
    public fun has_consensus_timed_out(market_id: u64): bool acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        if (!smart_table::contains(&registry.market_oracles, market_id)) {
            return false
        };

        let market_oracle = smart_table::borrow(&registry.market_oracles, market_id);

        // Not started yet or already resolved
        if (market_oracle.voting_started_at == 0 || market_oracle.resolved) {
            return false
        };

        let now = timestamp::now_seconds();
        now > market_oracle.consensus_deadline
    }

    #[view]
    public fun get_consensus_deadline(market_id: u64): u64 acquires OracleRegistry {
        assert!(exists<OracleRegistry>(@prediction_market), error::not_found(E_NOT_INITIALIZED));
        let registry = borrow_global<OracleRegistry>(@prediction_market);

        assert!(smart_table::contains(&registry.market_oracles, market_id), error::not_found(E_MARKET_NOT_REGISTERED));
        let market_oracle = smart_table::borrow(&registry.market_oracles, market_id);

        market_oracle.consensus_deadline
    }
}
