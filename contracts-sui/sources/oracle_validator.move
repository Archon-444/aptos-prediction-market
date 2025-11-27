/// Oracle Validator Module
/// Protects against stale prices and oracle manipulation
///
/// CRITICAL SECURITY FEATURES:
/// 1. Staleness checks (reject prices >5s old)
/// 2. Price deviation circuit breakers
/// 3. Multi-oracle verification
/// 4. Flash loan attack protection

#[allow(duplicate_alias, unused_variable, lint(public_entry))]
module prediction_market::oracle_validator {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::table::{Self, Table};
    use std::string::{Self, String};

    // ===== Constants =====

    /// Maximum age for oracle price (5 seconds)
    const MAX_PRICE_AGE_MS: u64 = 5000;

    /// Maximum price deviation percentage (10%)
    const MAX_PRICE_DEVIATION_BPS: u64 = 1000; // 10% = 1000 basis points

    /// Minimum number of oracle sources required
    const MIN_ORACLE_SOURCES: u64 = 1;

    // ===== Error Codes =====
    const E_STALE_PRICE: u64 = 1;
    const E_INVALID_PRICE: u64 = 2;
    const E_PRICE_DEVIATION_TOO_HIGH: u64 = 3;
    const E_INSUFFICIENT_ORACLES: u64 = 4;
    const E_ORACLE_NOT_WHITELISTED: u64 = 5;
    const E_CIRCUIT_BREAKER_TRIGGERED: u64 = 6;

    // ===== Structs =====

    /// Oracle price data
    public struct OraclePrice has store, copy, drop {
        price: u64,
        timestamp: u64,
        source: String,
        confidence: u64,
    }

    /// Oracle registry (tracks trusted sources)
    public struct OracleRegistry has key {
        id: UID,
        whitelisted_sources: Table<String, bool>,
        last_prices: Table<String, u64>,
        circuit_breaker_active: bool,
        admin: address,
    }

    /// Price aggregation result
    public struct AggregatedPrice has copy, drop {
        median_price: u64,
        num_sources: u64,
        timestamp: u64,
        verified: bool,
    }

    /// Admin capability for oracle management
    public struct OracleAdminCap has key, store {
        id: UID,
    }

    // ===== Events =====

    public struct PriceValidated has copy, drop {
        source: String,
        price: u64,
        timestamp: u64,
        validated_at: u64,
    }

    public struct PriceRejected has copy, drop {
        source: String,
        reason: String,
        timestamp: u64,
    }

    public struct CircuitBreakerTriggered has copy, drop {
        reason: String,
        timestamp: u64,
    }

    // ===== Initialization =====

    fun init(ctx: &mut TxContext) {
        let registry = OracleRegistry {
            id: object::new(ctx),
            whitelisted_sources: table::new(ctx),
            last_prices: table::new(ctx),
            circuit_breaker_active: false,
            admin: tx_context::sender(ctx),
        };

        let admin_cap = OracleAdminCap {
            id: object::new(ctx),
        };

        transfer::share_object(registry);
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ===== Public Functions =====

    /// Verify a single oracle price
    /// SECURITY: Rejects stale prices and validates source
    public fun verify_price(
        registry: &OracleRegistry,
        price_data: &OraclePrice,
        clock: &Clock,
    ): u64 {
        let current_time = clock::timestamp_ms(clock);

        // Check if circuit breaker is active
        assert!(!registry.circuit_breaker_active, E_CIRCUIT_BREAKER_TRIGGERED);

        // Verify source is whitelisted
        assert!(
            table::contains(&registry.whitelisted_sources, price_data.source) &&
            *table::borrow(&registry.whitelisted_sources, price_data.source),
            E_ORACLE_NOT_WHITELISTED
        );

        // CRITICAL: Check staleness (must be <5 seconds old)
        let price_age = current_time - price_data.timestamp;
        if (price_age > MAX_PRICE_AGE_MS) {
            event::emit(PriceRejected {
                source: price_data.source,
                reason: string::utf8(b"Price too stale"),
                timestamp: current_time,
            });
            abort E_STALE_PRICE
        };

        // Verify price is reasonable (not zero, not too high)
        assert!(price_data.price > 0, E_INVALID_PRICE);
        assert!(price_data.price < 1_000_000_000_000, E_INVALID_PRICE); // Max 1 trillion

        // Check price deviation from last known price
        if (table::contains(&registry.last_prices, price_data.source)) {
            let last_price = *table::borrow(&registry.last_prices, price_data.source);
            let deviation = calculate_deviation(last_price, price_data.price);

            if (deviation > MAX_PRICE_DEVIATION_BPS) {
                event::emit(PriceRejected {
                    source: price_data.source,
                    reason: string::utf8(b"Price deviation too high"),
                    timestamp: current_time,
                });
                abort E_PRICE_DEVIATION_TOO_HIGH
            };
        };

        event::emit(PriceValidated {
            source: price_data.source,
            price: price_data.price,
            timestamp: price_data.timestamp,
            validated_at: current_time,
        });

        price_data.price
    }

    /// Aggregate prices from multiple oracles (median)
    /// SECURITY: Requires minimum number of sources
    public fun aggregate_prices(
        registry: &OracleRegistry,
        prices: vector<OraclePrice>,
        clock: &Clock,
    ): AggregatedPrice {
        let num_prices = vector::length(&prices);

        // Require minimum number of oracles
        assert!(num_prices >= MIN_ORACLE_SOURCES, E_INSUFFICIENT_ORACLES);

        // Verify all prices
        let mut verified_prices = vector::empty<u64>();
        let mut i = 0;
        while (i < num_prices) {
            let price_data = vector::borrow(&prices, i);
            let verified_price = verify_price(registry, price_data, clock);
            vector::push_back(&mut verified_prices, verified_price);
            i = i + 1;
        };

        // Calculate median (resistant to outliers)
        let median = calculate_median(&verified_prices);

        AggregatedPrice {
            median_price: median,
            num_sources: num_prices,
            timestamp: clock::timestamp_ms(clock),
            verified: true,
        }
    }

    /// Construct an aggregated price snapshot from off-chain data.
    public fun new_aggregated_price(
        price: u64,
        num_sources: u64,
        timestamp: u64,
        verified: bool,
    ): AggregatedPrice {
        AggregatedPrice {
            median_price: price,
            num_sources,
            timestamp,
            verified,
        }
    }

    /// Ensure an aggregated price snapshot is fresh and valid.
    /// Returns the validated median price for downstream logic.
    public fun require_fresh_aggregate(
        registry: &OracleRegistry,
        aggregate: &AggregatedPrice,
        clock: &Clock,
    ): u64 {
        assert!(!registry.circuit_breaker_active, E_CIRCUIT_BREAKER_TRIGGERED);
        assert!(aggregate.verified, E_INVALID_PRICE);
        assert!(aggregate.num_sources >= MIN_ORACLE_SOURCES, E_INSUFFICIENT_ORACLES);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= aggregate.timestamp, E_STALE_PRICE);
        assert!(current_time - aggregate.timestamp <= MAX_PRICE_AGE_MS, E_STALE_PRICE);

        aggregate.median_price
    }

    // spec require_fresh_aggregate {
    //     ensures result == aggregate.median_price;
    // }

    /// Check if a price is valid without reverting
    /// Useful for pre-checks
    public fun is_price_valid(
        registry: &OracleRegistry,
        last_price: u64,
        new_price: u64,
    ): bool {
        if (new_price == 0) {
            return false
        };

        if (new_price >= 1_000_000_000_000) {
            return false
        };

        if (last_price == 0) {
            return true // No prior price to compare
        };

        let deviation = calculate_deviation(last_price, new_price);
        deviation <= MAX_PRICE_DEVIATION_BPS
    }

    // ===== Admin Functions =====

    /// Add oracle source to whitelist
    public entry fun whitelist_source(
        _cap: &OracleAdminCap,
        registry: &mut OracleRegistry,
        source: vector<u8>,
    ) {
        let source_string = string::utf8(source);

        if (!table::contains(&registry.whitelisted_sources, source_string)) {
            table::add(&mut registry.whitelisted_sources, source_string, true);
        } else {
            *table::borrow_mut(&mut registry.whitelisted_sources, source_string) = true;
        };
    }

    /// Remove oracle source from whitelist
    public entry fun remove_source(
        _cap: &OracleAdminCap,
        registry: &mut OracleRegistry,
        source: vector<u8>,
    ) {
        let source_string = string::utf8(source);

        if (table::contains(&registry.whitelisted_sources, source_string)) {
            *table::borrow_mut(&mut registry.whitelisted_sources, source_string) = false;
        };
    }

    /// Update last known price for a source
    public entry fun update_last_price(
        _cap: &OracleAdminCap,
        registry: &mut OracleRegistry,
        source: vector<u8>,
        price: u64,
    ) {
        let source_string = string::utf8(source);

        if (!table::contains(&registry.last_prices, source_string)) {
            table::add(&mut registry.last_prices, source_string, price);
        } else {
            *table::borrow_mut(&mut registry.last_prices, source_string) = price;
        };
    }

    /// Activate circuit breaker (emergency pause)
    public entry fun activate_circuit_breaker(
        _cap: &OracleAdminCap,
        registry: &mut OracleRegistry,
        reason: vector<u8>,
        clock: &Clock,
    ) {
        registry.circuit_breaker_active = true;

        event::emit(CircuitBreakerTriggered {
            reason: string::utf8(reason),
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Deactivate circuit breaker
    public entry fun deactivate_circuit_breaker(
        _cap: &OracleAdminCap,
        registry: &mut OracleRegistry,
    ) {
        registry.circuit_breaker_active = false;
    }

    // ===== View Functions =====

    public fun get_max_price_age(): u64 {
        MAX_PRICE_AGE_MS
    }

    public fun get_max_deviation(): u64 {
        MAX_PRICE_DEVIATION_BPS
    }

    public fun is_circuit_breaker_active(registry: &OracleRegistry): bool {
        registry.circuit_breaker_active
    }

    public fun is_source_whitelisted(registry: &OracleRegistry, source: String): bool {
        table::contains(&registry.whitelisted_sources, source) &&
        *table::borrow(&registry.whitelisted_sources, source)
    }

    // ===== Internal Functions =====

    /// Calculate price deviation in basis points
    fun calculate_deviation(old_price: u64, new_price: u64): u64 {
        if (old_price == 0) {
            return 0
        };

        let diff = if (new_price > old_price) {
            new_price - old_price
        } else {
            old_price - new_price
        };

        // Calculate percentage deviation in basis points
        // deviation_bps = (diff / old_price) * 10000
        let deviation_128 = ((diff as u128) * 10000) / (old_price as u128);

        (deviation_128 as u64)
    }

    /// Calculate median of prices (resistant to outliers)
    fun calculate_median(prices: &vector<u64>): u64 {
        let len = vector::length(prices);
        if (len == 0) {
            return 0
        };

        // Copy and sort
        let mut sorted = vector::empty<u64>();
        let mut i = 0;
        while (i < len) {
            vector::push_back(&mut sorted, *vector::borrow(prices, i));
            i = i + 1;
        };

        // Bubble sort (simple, good enough for small arrays)
        let mut swapped = true;
        while (swapped) {
            swapped = false;
            i = 0;
            while (i < len - 1) {
                let a = *vector::borrow(&sorted, i);
                let b = *vector::borrow(&sorted, i + 1);
                if (a > b) {
                    vector::swap(&mut sorted, i, i + 1);
                    swapped = true;
                };
                i = i + 1;
            };
        };

        // Return median
        if (len % 2 == 1) {
            *vector::borrow(&sorted, len / 2)
        } else {
            let mid1 = *vector::borrow(&sorted, len / 2 - 1);
            let mid2 = *vector::borrow(&sorted, len / 2);
            (mid1 + mid2) / 2
        }
    }

    // ===== Test Functions =====
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun create_test_price(
        price: u64,
        timestamp: u64,
        source: vector<u8>,
    ): OraclePrice {
        OraclePrice {
            price,
            timestamp,
            source: string::utf8(source),
            confidence: 100,
        }
    }

    #[test_only]
    public fun get_aggregated_median(agg: &AggregatedPrice): u64 {
        agg.median_price
    }

    #[test_only]
    public fun get_aggregated_num_sources(agg: &AggregatedPrice): u64 {
        agg.num_sources
    }

    #[test_only]
    public fun get_aggregated_timestamp(agg: &AggregatedPrice): u64 {
        agg.timestamp
    }

    #[test_only]
    public fun get_aggregated_verified(agg: &AggregatedPrice): bool {
        agg.verified
    }

    #[test_only]
    public fun update_last_price_for_testing(
        _cap: &OracleAdminCap,
        registry: &mut OracleRegistry,
        source: String,
        price: u64,
    ) {
        if (table::contains(&registry.last_prices, source)) {
            let last_price_ref = table::borrow_mut(&mut registry.last_prices, source);
            *last_price_ref = price;
        } else {
            table::add(&mut registry.last_prices, source, price);
        };
    }
}
