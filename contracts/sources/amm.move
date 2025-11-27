/// AMM (Automated Market Maker) with LMSR pricing
/// Provides dynamic odds based on bet distribution
module prediction_market::amm {
    use std::error;
    use std::vector;
    use aptos_std::math64;

    friend prediction_market::betting;

    // Error codes
    const E_INVALID_OUTCOME: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 2;
    const E_OVERFLOW: u64 = 3;
    const E_DIVISION_BY_ZERO: u64 = 4;

    // Fixed-point precision (6 decimals like USDC)
    const PRECISION: u64 = 1000000;  // 1e6
    const MAX_OUTCOMES: u64 = 10;

    // ==================== Core LMSR Functions ====================

    /// Calculate dynamic odds using simplified LMSR
    /// Returns basis points (10000 = 100%)
    public(friend) fun calculate_odds(
        outcome_stakes: &vector<u64>,
        outcome_index: u8,
    ): u64 {
        let num_outcomes = vector::length(outcome_stakes);
        assert!(num_outcomes <= MAX_OUTCOMES, error::invalid_argument(E_INVALID_OUTCOME));
        assert!((outcome_index as u64) < num_outcomes, error::invalid_argument(E_INVALID_OUTCOME));

        let total_stakes = calculate_total_stakes(outcome_stakes);

        // If no stakes, return equal probability
        if (total_stakes == 0) {
            return 10000 / num_outcomes
        };

        let outcome_stake = *vector::borrow(outcome_stakes, (outcome_index as u64));

        // Simple odds calculation: (outcome_stake / total_stakes) * 10000
        // Add 1 to avoid division by zero
        if (outcome_stake == 0) {
            return 100  // Minimum 1% odds
        };

        let odds = safe_mul_div(outcome_stake, 10000, total_stakes);

        // Ensure odds are between 1% and 99%
        if (odds < 100) {
            100
        } else if (odds > 9900) {
            9900
        } else {
            odds
        }
    }

    /// Calculate cost to buy shares using LMSR
    /// For simplicity, uses linear pricing with liquidity depth
    public(friend) fun calculate_buy_cost(
        outcome_stakes: &vector<u64>,
        outcome_index: u8,
        amount: u64,
        liquidity_param: u64,  // b parameter for market depth
    ): u64 {
        assert!(amount > 0, error::invalid_argument(E_INVALID_AMOUNT));
        assert!((outcome_index as u64) < vector::length(outcome_stakes), error::invalid_argument(E_INVALID_OUTCOME));

        let current_stake = *vector::borrow(outcome_stakes, (outcome_index as u64));
        let total_stakes = calculate_total_stakes(outcome_stakes);

        // Simplified LMSR cost: base_cost + impact_cost
        // Base cost = amount * current_price
        let current_odds = calculate_odds(outcome_stakes, outcome_index);
        let base_cost = safe_mul_div(amount, current_odds, 10000);

        // Impact cost based on market depth (liquidity_param)
        // Higher liquidity = lower price impact
        let impact_factor = safe_mul_div(amount, PRECISION, liquidity_param + PRECISION);
        let impact_cost = safe_mul_div(base_cost, impact_factor, PRECISION);

        base_cost + impact_cost
    }

    /// Calculate payout for winning bet using dynamic odds
    public(friend) fun calculate_payout_dynamic(
        stake: u64,
        outcome_stakes: &vector<u64>,
        winning_outcome: u8,
    ): u64 {
        let total_stakes = calculate_total_stakes(outcome_stakes);

        if (total_stakes == 0) {
            return stake
        };

        let winning_stake = *vector::borrow(outcome_stakes, (winning_outcome as u64));

        if (winning_stake == 0) {
            return stake
        };

        // Payout = (stake * total_pool) / winning_pool
        safe_mul_div(stake, total_stakes, winning_stake)
    }

    // ==================== Helper Functions ====================

    /// Safe multiplication and division to prevent overflow
    fun safe_mul_div(a: u64, b: u64, c: u64): u64 {
        assert!(c > 0, error::invalid_argument(E_DIVISION_BY_ZERO));

        // Use u128 to prevent overflow
        let result = ((a as u128) * (b as u128)) / (c as u128);

        // Check if result fits in u64
        assert!(result <= (18446744073709551615 as u128), error::invalid_argument(E_OVERFLOW));

        (result as u64)
    }

    /// Calculate total stakes across all outcomes
    fun calculate_total_stakes(stakes: &vector<u64>): u64 {
        let total = 0u64;
        let i = 0;
        let len = vector::length(stakes);

        while (i < len) {
            let stake = *vector::borrow(stakes, i);
            // Safe addition
            let (new_total, overflow) = overflowing_add(total, stake);
            assert!(!overflow, error::invalid_argument(E_OVERFLOW));
            total = new_total;
            i = i + 1;
        };

        total
    }

    /// Helper for checked addition
    fun overflowing_add(a: u64, b: u64): (u64, bool) {
        let sum = a + b;
        if (sum < a) {
            (sum, true)  // Overflow occurred
        } else {
            (sum, false) // No overflow
        }
    }

    // ==================== Public Helper Functions ====================

    /// Get implied odds for all outcomes
    public(friend) fun get_all_odds(outcome_stakes: &vector<u64>): vector<u64> {
        let odds_vec = vector::empty<u64>();
        let i = 0;
        let len = vector::length(outcome_stakes);

        while (i < len) {
            let odds = calculate_odds(outcome_stakes, (i as u8));
            vector::push_back(&mut odds_vec, odds);
            i = i + 1;
        };

        odds_vec
    }
}
