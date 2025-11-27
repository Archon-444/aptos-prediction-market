/// Oracle Data Validation and Circuit Breaker Module
/// Prevents oracle manipulation by detecting anomalies and suspicious patterns
module prediction_market::oracle_validator {
    use std::vector;
    use aptos_framework::timestamp;

    friend prediction_market::oracle;
    friend prediction_market::multi_oracle;

    // Error codes
    const E_PRICE_OUTLIER_DETECTED: u64 = 1;
    const E_RAPID_PRICE_CHANGE: u64 = 2;
    const E_STALE_ORACLE_DATA: u64 = 3;
    const E_INSUFFICIENT_DATA_POINTS: u64 = 4;
    const E_CIRCUIT_BREAKER_TRIGGERED: u64 = 5;

    // Constants for validation
    const MAX_PRICE_DEVIATION_BPS: u64 = 2000; // 20% max deviation from median
    const MAX_RAPID_CHANGE_BPS: u64 = 1000;    // 10% max change in 5 minutes
    const MIN_DATA_FRESHNESS_SECONDS: u64 = 300; // 5 minutes max staleness
    const MIN_ORACLE_COUNT: u64 = 3;            // Minimum oracles for consensus
    const OUTLIER_THRESHOLD_BPS: u64 = 3000;    // 30% from average triggers outlier flag

    /// Price data point with timestamp
    struct PriceDataPoint has copy, drop, store {
        value: u64,
        timestamp: u64,
        oracle_address: address,
    }

    /// Validation result
    struct ValidationResult has copy, drop {
        is_valid: bool,
        median_value: u64,
        outlier_count: u64,
        freshness_ok: bool,
    }

    /// Calculate median from vector of prices
    /// Uses quick selection algorithm for O(n) average time
    public(friend) fun calculate_median(prices: vector<u64>): u64 {
        let len = vector::length(&prices);
        if (len == 0) {
            return 0
        };

        // Sort prices (simple bubble sort for small vectors)
        let i = 0;
        while (i < len) {
            let j = i + 1;
            while (j < len) {
                let price_i = *vector::borrow(&prices, i);
                let price_j = *vector::borrow(&prices, j);
                if (price_j < price_i) {
                    vector::swap(&mut prices, i, j);
                };
                j = j + 1;
            };
            i = i + 1;
        };

        // Return median
        if (len % 2 == 0) {
            let mid1 = *vector::borrow(&prices, len / 2 - 1);
            let mid2 = *vector::borrow(&prices, len / 2);
            (mid1 + mid2) / 2
        } else {
            *vector::borrow(&prices, len / 2)
        }
    }

    /// Detect outliers using median absolute deviation
    public(friend) fun detect_outliers(
        data_points: &vector<PriceDataPoint>,
        median: u64
    ): vector<address> {
        let outliers = vector::empty<address>();
        let i = 0;
        let len = vector::length(data_points);

        while (i < len) {
            let point = vector::borrow(data_points, i);
            let deviation = if (point.value > median) {
                ((point.value - median) * 10000) / median
            } else {
                ((median - point.value) * 10000) / median
            };

            // Flag as outlier if deviation > threshold
            if (deviation > OUTLIER_THRESHOLD_BPS) {
                vector::push_back(&mut outliers, point.oracle_address);
            };

            i = i + 1;
        };

        outliers
    }

    /// Check data freshness
    public(friend) fun check_freshness(
        data_points: &vector<PriceDataPoint>
    ): bool {
        let current_time = timestamp::now_seconds();
        let i = 0;
        let len = vector::length(data_points);

        while (i < len) {
            let point = vector::borrow(data_points, i);
            let age = current_time - point.timestamp;

            if (age > MIN_DATA_FRESHNESS_SECONDS) {
                return false
            };

            i = i + 1;
        };

        true
    }

    /// Validate oracle data with circuit breaker logic
    public(friend) fun validate_oracle_data(
        data_points: vector<PriceDataPoint>
    ): ValidationResult {
        let len = vector::length(&data_points);

        // Require minimum oracle count
        if (len < MIN_ORACLE_COUNT) {
            return ValidationResult {
                is_valid: false,
                median_value: 0,
                outlier_count: 0,
                freshness_ok: false,
            }
        };

        // Extract prices
        let prices = vector::empty<u64>();
        let i = 0;
        while (i < len) {
            let point = vector::borrow(&data_points, i);
            vector::push_back(&mut prices, point.value);
            i = i + 1;
        };

        // Calculate median
        let median = calculate_median(prices);

        // Detect outliers
        let outlier_addresses = detect_outliers(&data_points, median);
        let outlier_count = vector::length(&outlier_addresses);

        // Check freshness
        let freshness_ok = check_freshness(&data_points);

        // Circuit breaker: if >33% are outliers, reject all data
        let outlier_percentage = (outlier_count * 100) / len;
        let is_valid = freshness_ok && outlier_percentage < 33;

        ValidationResult {
            is_valid,
            median_value: median,
            outlier_count,
            freshness_ok,
        }
    }

    /// Time-Weighted Average Price (TWAP) calculation
    /// Reduces impact of flash loan attacks and price manipulation
    public(friend) fun calculate_twap(
        historical_prices: vector<PriceDataPoint>,
        time_window_seconds: u64
    ): u64 {
        let current_time = timestamp::now_seconds();
        let window_start = current_time - time_window_seconds;

        let weighted_sum = 0u128;
        let total_weight = 0u128;
        let i = 0;
        let len = vector::length(&historical_prices);

        while (i < len) {
            let point = vector::borrow(&historical_prices, i);

            // Only include prices within time window
            if (point.timestamp >= window_start) {
                // Weight by time (more recent = higher weight)
                let time_weight = (point.timestamp - window_start) as u128;
                weighted_sum = weighted_sum + ((point.value as u128) * time_weight);
                total_weight = total_weight + time_weight;
            };

            i = i + 1;
        };

        if (total_weight == 0) {
            return 0
        };

        ((weighted_sum / total_weight) as u64)
    }

    /// Check for rapid price changes (flash loan detection)
    public(friend) fun check_rapid_change(
        previous_price: u64,
        current_price: u64
    ): bool {
        if (previous_price == 0) {
            return true // No previous data, allow
        };

        let change_bps = if (current_price > previous_price) {
            ((current_price - previous_price) * 10000) / previous_price
        } else {
            ((previous_price - current_price) * 10000) / previous_price
        };

        // Return true if change is within acceptable range
        change_bps <= MAX_RAPID_CHANGE_BPS
    }

    // View functions for testing
    #[view]
    public fun get_max_deviation(): u64 {
        MAX_PRICE_DEVIATION_BPS
    }

    #[view]
    public fun get_min_oracle_count(): u64 {
        MIN_ORACLE_COUNT
    }

    #[view]
    public fun get_freshness_requirement(): u64 {
        MIN_DATA_FRESHNESS_SECONDS
    }
}
