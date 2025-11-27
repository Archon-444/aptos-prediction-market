/// Multi-Oracle Consensus System
///
/// This module prevents oracle manipulation attacks like the $7M Polymarket UMA incident
/// by requiring consensus from multiple independent oracle sources before market resolution.
///
/// Key Features:
/// - No single oracle can control outcomes
/// - Weighted consensus mechanism
/// - Configurable thresholds
/// - Reputation-based oracle scoring
/// - Slashing for malicious oracles
/// - Transparent vote auditing
module prediction_market::multi_oracle {
    use std::signer;
    use std::vector;
    use std::string::{Self, String};
    use aptos_framework::timestamp;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;
    use aptos_std::table::{Self, Table};
    use aptos_std::smart_table::{Self, SmartTable};

    /// Errors
    const E_NOT_ADMIN: u64 = 1;
    const E_ORACLE_NOT_REGISTERED: u64 = 2;
    const E_ORACLE_ALREADY_REGISTERED: u64 = 3;
    const E_INSUFFICIENT_STAKE: u64 = 4;
    const E_ALREADY_SUBMITTED: u64 = 5;
    const E_SUBMISSION_PERIOD_ENDED: u64 = 6;
    const E_CONSENSUS_NOT_REACHED: u64 = 7;
    const E_INVALID_OUTCOME: u64 = 8;
    const E_ORACLE_SUSPENDED: u64 = 9;
    const E_MARKET_NOT_FOUND: u64 = 10;
    const E_ALREADY_RESOLVED: u64 = 11;

    /// Constants
    const MIN_ORACLE_STAKE: u64 = 10_000_000_000; // 100 APT minimum stake (increased from 1 APT to prevent Sybil attacks)
    const SUBMISSION_PERIOD: u64 = 86400; // 24 hours in seconds
    const MIN_CONSENSUS_PERCENTAGE: u64 = 66; // 66% weighted consensus required
    const MAX_ORACLES_PER_MARKET: u64 = 10;
    const SLASH_PERCENTAGE: u64 = 20; // 20% stake slashed for wrong votes

    /// Oracle status
    const ORACLE_STATUS_ACTIVE: u8 = 1;
    const ORACLE_STATUS_SUSPENDED: u8 = 2;
    const ORACLE_STATUS_SLASHED: u8 = 3;

    /// Oracle registration information
    struct OracleInfo has store, drop, copy {
        oracle_address: address,
        name: String,
        reputation_score: u64, // 0-1000, affects voting weight
        total_resolutions: u64,
        correct_resolutions: u64,
        stake_amount: u64,
        status: u8,
        registered_at: u64,
    }

    /// Oracle submission for a specific market
    struct OracleSubmission has store, drop, copy {
        oracle_address: address,
        outcome: u64,
        confidence: u64, // 0-100 percentage
        evidence_hash: vector<u8>, // Hash of supporting evidence
        submitted_at: u64,
    }

    /// Market resolution data
    struct MarketResolution has store {
        market_id: u64,
        submissions: vector<OracleSubmission>,
        submission_deadline: u64,
        resolved: bool,
        final_outcome: u64,
        total_weight_submitted: u64,
    }

    /// Oracle registry - stores all registered oracles
    struct OracleRegistry has key {
        oracles: Table<address, OracleInfo>,
        oracle_addresses: vector<address>,
        admin: address,
        total_oracles: u64,
    }

    /// Market resolutions storage
    struct MarketResolutions has key {
        resolutions: Table<u64, MarketResolution>,
        oracle_stakes: Table<address, Coin<AptosCoin>>,
    }

    /// Events
    struct OracleRegisteredEvent has drop, store {
        oracle_address: address,
        name: String,
        stake_amount: u64,
        timestamp: u64,
    }

    struct OracleSubmissionEvent has drop, store {
        market_id: u64,
        oracle_address: address,
        outcome: u64,
        confidence: u64,
        timestamp: u64,
    }

    struct MarketResolvedEvent has drop, store {
        market_id: u64,
        final_outcome: u64,
        total_submissions: u64,
        consensus_weight: u64,
        timestamp: u64,
    }

    struct OracleSlashedEvent has drop, store {
        oracle_address: address,
        market_id: u64,
        slash_amount: u64,
        reason: String,
        timestamp: u64,
    }

    struct EventStore has key {
        oracle_registered_events: EventHandle<OracleRegisteredEvent>,
        oracle_submission_events: EventHandle<OracleSubmissionEvent>,
        market_resolved_events: EventHandle<MarketResolvedEvent>,
        oracle_slashed_events: EventHandle<OracleSlashedEvent>,
    }

    /// Initialize the oracle system
    public entry fun initialize(admin: &signer) {
        let admin_address = signer::address_of(admin);

        move_to(admin, OracleRegistry {
            oracles: table::new(),
            oracle_addresses: vector::empty(),
            admin: admin_address,
            total_oracles: 0,
        });

        move_to(admin, MarketResolutions {
            resolutions: table::new(),
            oracle_stakes: table::new(),
        });

        move_to(admin, EventStore {
            oracle_registered_events: account::new_event_handle<OracleRegisteredEvent>(admin),
            oracle_submission_events: account::new_event_handle<OracleSubmissionEvent>(admin),
            market_resolved_events: account::new_event_handle<MarketResolvedEvent>(admin),
            oracle_slashed_events: account::new_event_handle<OracleSlashedEvent>(admin),
        });
    }

    /// Register a new oracle with stake
    public entry fun register_oracle(
        oracle: &signer,
        admin_address: address,
        name: String,
        stake_amount: u64,
    ) acquires OracleRegistry, MarketResolutions, EventStore {
        let oracle_address = signer::address_of(oracle);

        assert!(stake_amount >= MIN_ORACLE_STAKE, E_INSUFFICIENT_STAKE);

        let registry = borrow_global_mut<OracleRegistry>(admin_address);
        assert!(!table::contains(&registry.oracles, oracle_address), E_ORACLE_ALREADY_REGISTERED);

        // Transfer stake
        let stake = coin::withdraw<AptosCoin>(oracle, stake_amount);
        let resolutions = borrow_global_mut<MarketResolutions>(admin_address);
        table::add(&mut resolutions.oracle_stakes, oracle_address, stake);

        // Register oracle
        let oracle_info = OracleInfo {
            oracle_address,
            name,
            reputation_score: 500, // Start with neutral reputation
            total_resolutions: 0,
            correct_resolutions: 0,
            stake_amount,
            status: ORACLE_STATUS_ACTIVE,
            registered_at: timestamp::now_seconds(),
        };

        table::add(&mut registry.oracles, oracle_address, oracle_info);
        vector::push_back(&mut registry.oracle_addresses, oracle_address);
        registry.total_oracles = registry.total_oracles + 1;

        // Emit event
        let event_store = borrow_global_mut<EventStore>(admin_address);
        event::emit_event(&mut event_store.oracle_registered_events, OracleRegisteredEvent {
            oracle_address,
            name,
            stake_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Submit oracle data for market resolution
    public entry fun submit_resolution(
        oracle: &signer,
        admin_address: address,
        market_id: u64,
        outcome: u64,
        confidence: u64,
        evidence_hash: vector<u8>,
    ) acquires OracleRegistry, MarketResolutions, EventStore {
        let oracle_address = signer::address_of(oracle);

        // Verify oracle is registered and active
        let registry = borrow_global<OracleRegistry>(admin_address);
        assert!(table::contains(&registry.oracles, oracle_address), E_ORACLE_NOT_REGISTERED);

        let oracle_info = table::borrow(&registry.oracles, oracle_address);
        assert!(oracle_info.status == ORACLE_STATUS_ACTIVE, E_ORACLE_SUSPENDED);

        let resolutions = borrow_global_mut<MarketResolutions>(admin_address);

        // Create market resolution if it doesn't exist
        if (!table::contains(&resolutions.resolutions, market_id)) {
            let resolution = MarketResolution {
                market_id,
                submissions: vector::empty(),
                submission_deadline: timestamp::now_seconds() + SUBMISSION_PERIOD,
                resolved: false,
                final_outcome: 0,
                total_weight_submitted: 0,
            };
            table::add(&mut resolutions.resolutions, market_id, resolution);
        };

        let resolution = table::borrow_mut(&mut resolutions.resolutions, market_id);
        assert!(!resolution.resolved, E_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() <= resolution.submission_deadline, E_SUBMISSION_PERIOD_ENDED);

        // Check if oracle already submitted
        let i = 0;
        let len = vector::length(&resolution.submissions);
        while (i < len) {
            let submission = vector::borrow(&resolution.submissions, i);
            assert!(submission.oracle_address != oracle_address, E_ALREADY_SUBMITTED);
            i = i + 1;
        };

        // Add submission
        let submission = OracleSubmission {
            oracle_address,
            outcome,
            confidence,
            evidence_hash,
            submitted_at: timestamp::now_seconds(),
        };

        vector::push_back(&mut resolution.submissions, submission);

        // Calculate voting weight (stake * reputation * confidence) with overflow check
        let weight = calculate_oracle_weight(oracle_info, confidence);
        let (new_total_weight, overflow_weight) = checked_add(resolution.total_weight_submitted, weight);
        assert!(!overflow_weight, E_OVERFLOW);
        resolution.total_weight_submitted = new_total_weight;

        // Emit event
        let event_store = borrow_global_mut<EventStore>(admin_address);
        event::emit_event(&mut event_store.oracle_submission_events, OracleSubmissionEvent {
            market_id,
            oracle_address,
            outcome,
            confidence,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Finalize market resolution with consensus check
    public entry fun finalize_resolution(
        admin: &signer,
        market_id: u64,
    ) acquires OracleRegistry, MarketResolutions, EventStore {
        let admin_address = signer::address_of(admin);
        let registry = borrow_global_mut<OracleRegistry>(admin_address);
        assert!(registry.admin == admin_address, E_NOT_ADMIN);

        // First, extract data we need from resolutions
        let (consensus_outcome, consensus_weight, total_weight, total_submissions, submissions_copy) = {
            let resolutions = borrow_global_mut<MarketResolutions>(admin_address);
            assert!(table::contains(&resolutions.resolutions, market_id), E_MARKET_NOT_FOUND);

            let resolution = table::borrow_mut(&mut resolutions.resolutions, market_id);
            assert!(!resolution.resolved, E_ALREADY_RESOLVED);
            assert!(timestamp::now_seconds() > resolution.submission_deadline, E_SUBMISSION_PERIOD_ENDED);

            // Calculate consensus
            let (outcome, weight, total) = calculate_consensus(
                &resolution.submissions,
                registry
            );

            assert!(total > 0, E_CONSENSUS_NOT_REACHED);

            // Verify consensus threshold met (66% weighted majority)
            let consensus_percentage = (weight * 100) / total;
            assert!(consensus_percentage >= MIN_CONSENSUS_PERCENTAGE, E_CONSENSUS_NOT_REACHED);

            // Store values before modifying
            let total_subs = vector::length(&resolution.submissions);
            let subs_copy = *&resolution.submissions;

            resolution.resolved = true;
            resolution.final_outcome = outcome;

            (outcome, weight, total, total_subs, subs_copy)
        };

        // Update oracle reputations and slash incorrect oracles
        {
            let resolutions = borrow_global_mut<MarketResolutions>(admin_address);
            update_oracle_reputations(
                admin_address,
                market_id,
                consensus_outcome,
                &submissions_copy,
                registry,
                resolutions
            );
        };

        // Emit event
        let event_store = borrow_global_mut<EventStore>(admin_address);
        event::emit_event(&mut event_store.market_resolved_events, MarketResolvedEvent {
            market_id,
            final_outcome: consensus_outcome,
            total_submissions,
            consensus_weight,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Calculate oracle voting weight based on stake, reputation, and confidence
    /// Uses u128 for intermediate calculations to prevent overflow
    fun calculate_oracle_weight(oracle_info: &OracleInfo, confidence: u64): u64 {
        // Weight = (stake / MIN_STAKE) * (reputation / 500) * (confidence / 100)
        let stake_factor = (oracle_info.stake_amount as u128) / (MIN_ORACLE_STAKE as u128);
        let reputation_factor = oracle_info.reputation_score as u128; // 0-1000
        let confidence_factor = confidence as u128; // 0-100

        // Normalize: (stake_factor * reputation_factor * confidence_factor) / 50000
        // Use u128 to prevent overflow
        let weight_u128 = (stake_factor * reputation_factor * confidence_factor) / 50000u128;

        // Check result fits in u64
        assert!(weight_u128 <= (18446744073709551615u128), E_OVERFLOW);

        (weight_u128 as u64)
    }

    const E_OVERFLOW: u64 = 100;

    /// Calculate consensus outcome from submissions
    fun calculate_consensus(
        submissions: &vector<OracleSubmission>,
        registry: &OracleRegistry,
    ): (u64, u64, u64) {
        let outcome_weights = smart_table::new<u64, u64>();
        let total_weight: u64 = 0;

        let i = 0;
        let len = vector::length(submissions);

        while (i < len) {
            let submission = vector::borrow(submissions, i);
            let oracle_info = table::borrow(&registry.oracles, submission.oracle_address);
            let weight = calculate_oracle_weight(oracle_info, submission.confidence);

            if (smart_table::contains(&outcome_weights, submission.outcome)) {
                let current_weight = *smart_table::borrow(&outcome_weights, submission.outcome);
                smart_table::upsert(&mut outcome_weights, submission.outcome, current_weight + weight);
            } else {
                smart_table::add(&mut outcome_weights, submission.outcome, weight);
            };

            total_weight = total_weight + weight;
            i = i + 1;
        };

        // Find outcome with highest weight
        let max_weight: u64 = 0;
        let consensus_outcome: u64 = 0;

        i = 0;
        while (i < len) {
            let submission = vector::borrow(submissions, i);
            let outcome = submission.outcome;
            if (smart_table::contains(&outcome_weights, submission.outcome)) {
                let weight = *smart_table::borrow(&outcome_weights, outcome);
                if (weight > max_weight) {
                    max_weight = weight;
                    consensus_outcome = outcome;
                };
            };
            i = i + 1;
        };

        // Explicitly destroy the SmartTable since u64 has drop ability
        smart_table::destroy(outcome_weights);

        (consensus_outcome, max_weight, total_weight)
    }

    /// Update oracle reputations based on accuracy
    fun update_oracle_reputations(
        admin_address: address,
        market_id: u64,
        correct_outcome: u64,
        submissions: &vector<OracleSubmission>,
        registry: &mut OracleRegistry,
        resolutions: &mut MarketResolutions,
    ) acquires EventStore {
        let i = 0;
        let len = vector::length(submissions);

        while (i < len) {
            let submission = vector::borrow(submissions, i);
            let oracle_info = table::borrow_mut(&mut registry.oracles, submission.oracle_address);

            oracle_info.total_resolutions = oracle_info.total_resolutions + 1;

            if (submission.outcome == correct_outcome) {
                // Correct prediction - increase reputation
                oracle_info.correct_resolutions = oracle_info.correct_resolutions + 1;
                if (oracle_info.reputation_score < 1000) {
                    oracle_info.reputation_score = oracle_info.reputation_score + 10;
                    if (oracle_info.reputation_score > 1000) {
                        oracle_info.reputation_score = 1000;
                    };
                };
            } else {
                // Incorrect prediction - slash stake and decrease reputation
                let slash_amount = (oracle_info.stake_amount * SLASH_PERCENTAGE) / 100;

                if (table::contains(&resolutions.oracle_stakes, submission.oracle_address)) {
                    let stake = table::borrow_mut(&mut resolutions.oracle_stakes, submission.oracle_address);
                    let slashed_coins = coin::extract(stake, slash_amount);
                    // Transfer slashed amount to admin for redistribution
                    coin::deposit(admin_address, slashed_coins);
                };

                // Prevent underflow: ensure slash_amount doesn't exceed stake
                if (slash_amount > oracle_info.stake_amount) {
                    slash_amount = oracle_info.stake_amount;
                };
                oracle_info.stake_amount = oracle_info.stake_amount - slash_amount;

                if (oracle_info.reputation_score > 50) {
                    oracle_info.reputation_score = oracle_info.reputation_score - 50;
                };

                // Emit slash event
                let event_store = borrow_global_mut<EventStore>(admin_address);
                event::emit_event(&mut event_store.oracle_slashed_events, OracleSlashedEvent {
                    oracle_address: submission.oracle_address,
                    market_id,
                    slash_amount,
                    reason: string::utf8(b"Incorrect outcome submission"),
                    timestamp: timestamp::now_seconds(),
                });
            };

            i = i + 1;
        };
    }

    /// View functions

    #[view]
    public fun get_oracle_info(admin_address: address, oracle_address: address): (String, u64, u64, u64, u64, u8) acquires OracleRegistry {
        let registry = borrow_global<OracleRegistry>(admin_address);
        assert!(table::contains(&registry.oracles, oracle_address), E_ORACLE_NOT_REGISTERED);

        let info = table::borrow(&registry.oracles, oracle_address);
        (info.name, info.reputation_score, info.total_resolutions, info.correct_resolutions, info.stake_amount, info.status)
    }

    #[view]
    public fun get_market_resolution_status(admin_address: address, market_id: u64): (bool, u64, u64, u64) acquires MarketResolutions {
        let resolutions = borrow_global<MarketResolutions>(admin_address);

        if (!table::contains(&resolutions.resolutions, market_id)) {
            return (false, 0, 0, 0)
        };

        let resolution = table::borrow(&resolutions.resolutions, market_id);
        (resolution.resolved, resolution.final_outcome, vector::length(&resolution.submissions), resolution.submission_deadline)
    }

    #[view]
    public fun get_total_oracles(admin_address: address): u64 acquires OracleRegistry {
        let registry = borrow_global<OracleRegistry>(admin_address);
        registry.total_oracles
    }

    #[view]
    public fun calculate_accuracy_rate(admin_address: address, oracle_address: address): u64 acquires OracleRegistry {
        let registry = borrow_global<OracleRegistry>(admin_address);
        assert!(table::contains(&registry.oracles, oracle_address), E_ORACLE_NOT_REGISTERED);

        let info = table::borrow(&registry.oracles, oracle_address);
        if (info.total_resolutions == 0) {
            return 0
        };

        (info.correct_resolutions * 100) / info.total_resolutions
    }

    // Helper function for overflow checking
    fun checked_add(a: u64, b: u64): (u64, bool) {
        let sum = a + b;
        if (sum < a) {
            (sum, true)  // Overflow occurred
        } else {
            (sum, false) // No overflow
        }
    }
}
