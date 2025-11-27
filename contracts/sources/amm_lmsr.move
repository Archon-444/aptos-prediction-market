/// True LMSR (Logarithmic Market Scoring Rule) AMM Implementation
/// Implements C(q) = b * ln(Σ exp(q_i/b)) with fixed-point arithmetic
module prediction_market::amm_lmsr {
    use std::error;
    use std::vector;

    friend prediction_market::betting;

    #[test_only]
    friend prediction_market::lmsr_validation_tests;

    // Error codes
    const E_INVALID_OUTCOME: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 2;
    const E_OVERFLOW: u64 = 3;
    const E_DIVISION_BY_ZERO: u64 = 4;
    const E_UNDERFLOW: u64 = 5;
    const E_INSUFFICIENT_SHARES: u64 = 6;

    // Fixed-point precision (8 decimals for higher accuracy)
    // SECURITY: Increased from 1e6 to 1e8 for better precision in LMSR calculations
    const PRECISION: u64 = 100000000;  // 1e8
    const MAX_OUTCOMES: u64 = 10;

    // Scaling factors for ln approximations
    const SCALE_LN: u64 = 10000;      // Scale down for ln calculation
    const LN_2: u64 = 69314718;       // ln(2) * 10^8 precomputed (updated for new precision)

    // Maximum iterations for Taylor series
    const MAX_TAYLOR_ITERATIONS: u64 = 20;

    // Convergence threshold: if term is smaller than this, we've converged
    // SECURITY: Added to ensure Taylor series convergence accuracy
    const CONVERGENCE_THRESHOLD: u64 = 100;  // 1e-6 in our precision system

    // ==================== Fixed-Point Math Functions ====================

    /// Fixed-point exponential: exp(x) using Taylor series
    /// x is scaled by PRECISION (10^8)
    /// Returns exp(x) scaled by PRECISION
    /// SECURITY: Enhanced with convergence checking for accuracy
    fun fixed_exp(x: u64): u64 {
        let term = PRECISION;
        let result = PRECISION;
        let i = 1u64;

        let term_acc = term;
        let result_acc = result;
        let i_acc = i;

        while (i_acc < MAX_TAYLOR_ITERATIONS) {
            let term_u128 = (term_acc as u128) * (x as u128);
            let denom = (PRECISION as u128) * (i_acc as u128);
            if (denom == 0) {
                break
            };

            let next_term_u128 = term_u128 / denom;
            if (next_term_u128 == 0 || next_term_u128 < (CONVERGENCE_THRESHOLD as u128)) {
                break
            };

            if (next_term_u128 > 18446744073709551615u128) {
                return 18446744073709551615u64
            };

            term_acc = next_term_u128 as u64;
            let (new_result, overflow2) = checked_add(result_acc, term_acc);
            if (overflow2) {
                return 18446744073709551615u64
            };
            result_acc = new_result;
            i_acc = i_acc + 1;
        };

        result_acc
    }

    /// Fixed-point natural logarithm: ln(x) using Taylor series
    /// x is scaled by PRECISION (10^8)
    /// Returns ln(x) scaled by PRECISION
    /// SECURITY: Enhanced with convergence checking for accuracy
    fun fixed_ln(x: u64): u64 {
        assert!(x > 0, error::invalid_argument(E_INVALID_AMOUNT));

        // Reduce x to range [1, 2) by dividing by 2 repeatedly
        let shift = 0u64;
        let x_prime = x;

        while (x_prime > 2 * PRECISION) {
            x_prime = x_prime / 2;
            shift = shift + 1;
        };

        // Calculate ln(x') where x' is in [1, 2)
        // ln(1 + y) ≈ y - y^2/2 + y^3/3 - y^4/4 + ...
        // where y = (x' - 1)

        if (x_prime <= PRECISION) {
            return shift * LN_2
        };

        let y = ((x_prime - PRECISION) * SCALE_LN) / PRECISION;

        let term = y;
        let result = y;
        let i = 2u64;
        let sign = false; // Alternates: subtract for even terms

        while (i < MAX_TAYLOR_ITERATIONS) {
            let (new_term, overflow) = checked_mul(term, y);
            if (overflow) {
                break
            };
            term = new_term / (i * SCALE_LN);

            // SECURITY: Check for convergence threshold
            if (term < CONVERGENCE_THRESHOLD) {
                break
            };

            if (sign) {
                let (new_result, overflow2) = checked_add(result, term);
                if (overflow2) {
                    break
                };
                result = new_result;
            } else {
                if (result >= term) {
                    result = result - term;
                };
            };

            sign = !sign;
            i = i + 1;
        };

        // Scale back and add ln(2) * shift
        let ln_result = result / SCALE_LN;
        let (final_result, overflow4) = checked_add(ln_result, shift * LN_2);
        assert!(!overflow4, error::out_of_range(E_OVERFLOW));

        final_result
    }

    // ==================== LMSR Core Functions ====================

    public(friend) fun calculate_cost_raw(
        q: &vector<u64>,
        b: u64,
    ): u64 {
        assert!(b > 0, error::invalid_argument(E_DIVISION_BY_ZERO));
        assert!(vector::length(q) <= MAX_OUTCOMES, error::invalid_argument(E_INVALID_OUTCOME));

        let sum_exp = 0u64;
        let i = 0;
        let len = vector::length(q);

        while (i < len) {
            let qi = *vector::borrow(q, i);

            // Calculate qi / b (scaled)
            let qi_over_b = (qi * PRECISION) / b;

            // Calculate exp(qi/b)
            let exp_val = fixed_exp(qi_over_b);

            // Add to sum
            let (new_sum, overflow) = checked_add(sum_exp, exp_val);
            assert!(!overflow, error::out_of_range(E_OVERFLOW));
            sum_exp = new_sum;

            i = i + 1;
        };

        // Calculate b * ln(sum_exp)
        let ln_sum = fixed_ln(sum_exp);
        let (cost, overflow2) = checked_mul(b, ln_sum);
        assert!(!overflow2, error::out_of_range(E_OVERFLOW));

        cost
    }

    /// Calculate LMSR cost function: C(q) = b * ln(Σ exp(q_i/b))
    /// q: vector of share quantities (scaled by PRECISION)
    /// b: liquidity parameter (scaled by PRECISION)
    /// Returns: cost (scaled by PRECISION)
    public(friend) fun calculate_cost(
        q: &vector<u64>,
        b: u64,
    ): u64 {
        ceil_div(calculate_cost_raw(q, b), PRECISION)
    }

    /// Calculate price to buy shares using LMSR
    /// Returns: (price, new_quantities)
    public(friend) fun calculate_buy_price(
        current_q: &vector<u64>,
        outcome_index: u8,
        amount: u64,
        b: u64,
    ): (u64, vector<u64>) {
        assert!(amount > 0, error::invalid_argument(E_INVALID_AMOUNT));
        assert!((outcome_index as u64) < vector::length(current_q), error::invalid_argument(E_INVALID_OUTCOME));

        // Calculate C(q)
        let current_cost = calculate_cost_raw(current_q, b);

        // Create q_new by adding amount to specified outcome
        let q_new = *current_q;
        let current_qi = *vector::borrow(&q_new, (outcome_index as u64));
        let (new_qi, overflow) = checked_add(current_qi, amount);
        assert!(!overflow, error::out_of_range(E_OVERFLOW));

        *vector::borrow_mut(&mut q_new, (outcome_index as u64)) = new_qi;

        // Calculate C(q_new)
        let new_cost = calculate_cost_raw(&q_new, b);

        // Price = C(q_new) - C(q)
        assert!(new_cost >= current_cost, error::invalid_state(E_UNDERFLOW));
        let diff = new_cost - current_cost;
        let price = if (diff == 0) { 1 } else { ceil_div(diff, PRECISION) };

        (price, q_new)
    }

    /// Calculate price to sell shares using LMSR
    /// Returns: (price, new_quantities)
    public(friend) fun calculate_sell_price(
        current_q: &vector<u64>,
        outcome_index: u8,
        amount: u64,
        b: u64,
    ): (u64, vector<u64>) {
        assert!(amount > 0, error::invalid_argument(E_INVALID_AMOUNT));
        assert!((outcome_index as u64) < vector::length(current_q), error::invalid_argument(E_INVALID_OUTCOME));

        let current_qi = *vector::borrow(current_q, (outcome_index as u64));
        assert!(current_qi >= amount, error::invalid_state(E_INSUFFICIENT_SHARES));

        // Calculate C(q)
        let current_cost = calculate_cost_raw(current_q, b);

        // Create q_new by subtracting amount from specified outcome
        let q_new = *current_q;
        let new_qi = current_qi - amount;
        *vector::borrow_mut(&mut q_new, (outcome_index as u64)) = new_qi;

        // Calculate C(q_new)
        let new_cost = calculate_cost_raw(&q_new, b);

        // Price = C(q) - C(q_new)
        assert!(current_cost >= new_cost, error::invalid_state(E_UNDERFLOW));
        let diff = current_cost - new_cost;
        let price = if (diff == 0) { 1 } else { ceil_div(diff, PRECISION) };

        (price, q_new)
    }

    /// Calculate implied probability (odds) for an outcome
    /// Returns basis points (10000 = 100%)
    public(friend) fun calculate_odds(
        q: &vector<u64>,
        outcome_index: u8,
        b: u64,
    ): u64 {
        assert!((outcome_index as u64) < vector::length(q), error::invalid_argument(E_INVALID_OUTCOME));
        assert!(b > 0, error::invalid_argument(E_DIVISION_BY_ZERO));

        let qi = *vector::borrow(q, (outcome_index as u64));

        let qi_over_b = (qi * PRECISION) / b;
        let exp_qi = fixed_exp(qi_over_b);

        let sum_exp = 0u64;
        let i = 0;
        let len = vector::length(q);

        while (i < len) {
            let qj = *vector::borrow(q, i);
            let qj_over_b = (qj * PRECISION) / b;
            let exp_qj = fixed_exp(qj_over_b);

            let (new_sum, overflow) = checked_add(sum_exp, exp_qj);
            assert!(!overflow, error::out_of_range(E_OVERFLOW));
            sum_exp = new_sum;

            i = i + 1;
        };

        let odds = (exp_qi * 10000) / sum_exp;

        if (odds < 100) {
            100
        } else if (odds > 9900) {
            9900
        } else {
            odds
        }
    }

    /// Get all odds for all outcomes
    public(friend) fun get_all_odds(
        q: &vector<u64>,
        b: u64,
    ): vector<u64> {
        let odds_vec = vector::empty<u64>();
        let i = 0;
        let len = vector::length(q);
        let sum = 0u64;

        while (i < len) {
            let odds = calculate_odds(q, (i as u8), b);
            vector::push_back(&mut odds_vec, odds);
            let (new_sum, overflow) = checked_add(sum, odds);
            assert!(!overflow, error::out_of_range(E_OVERFLOW));
            sum = new_sum;
            i = i + 1;
        };

        if (len > 0) {
            let target = 10000u64;
            if (sum != target) {
                let last_index = len - 1;
                let last_ref = vector::borrow_mut(&mut odds_vec, last_index);
                if (sum > target) {
                    let adjustment = sum - target;
                    if (*last_ref >= adjustment) {
                        *last_ref = *last_ref - adjustment;
                    } else {
                        *last_ref = 0;
                    };
                } else {
                    let adjustment = target - sum;
                    let (new_value, overflow2) = checked_add(*last_ref, adjustment);
                    assert!(!overflow2, error::out_of_range(E_OVERFLOW));
                    if (new_value > target) {
                        *last_ref = target;
                    } else {
                        *last_ref = new_value;
                    };
                };
            };
        };

        odds_vec
    }

    // ==================== Helper Functions ====================

    /// Checked addition with overflow detection
    fun checked_add(a: u64, b: u64): (u64, bool) {
        let sum = a + b;
        if (sum < a) {
            (sum, true)  // Overflow occurred
        } else {
            (sum, false)
        }
    }

    fun checked_sub(a: u64, b: u64): (u64, bool) {
        if (a < b) {
            (0, true)
        } else {
            (a - b, false)
        }
    }

    /// Checked multiplication with overflow detection
    fun checked_mul(a: u64, b: u64): (u64, bool) {
        if (a == 0 || b == 0) {
            return (0, false)
        };

        // Use u128 for intermediate calculation
        let result_u128 = (a as u128) * (b as u128);
        let max_u64 = 18446744073709551615u128;

        if (result_u128 > max_u64) {
            (18446744073709551615u64, true) // Return max u64 on overflow
        } else {
            ((result_u128 as u64), false)
        }
    }

    fun ceil_div(numer: u64, denom: u64): u64 {
        assert!(denom > 0, error::invalid_argument(E_DIVISION_BY_ZERO));
        if (numer == 0) {
            return 0
        };

        if (denom == 1) {
            return numer
        };

        let (denom_minus_one, borrow) = checked_sub(denom, 1);
        assert!(!borrow, error::invalid_argument(E_DIVISION_BY_ZERO));
        let (adjusted, overflow) = checked_add(numer, denom_minus_one);
        assert!(!overflow, error::out_of_range(E_OVERFLOW));
        adjusted / denom
    }


    /// Initialize quantities vector with zeros
    public(friend) fun init_quantities(num_outcomes: u8): vector<u64> {
        let q = vector::empty<u64>();
        let i = 0;

        while (i < (num_outcomes as u64)) {
            vector::push_back(&mut q, 0);
            i = i + 1;
        };

        q
    }

    // ==================== View Functions ====================

    #[view]
    public fun preview_buy_cost(
        current_q: vector<u64>,
        outcome_index: u8,
        amount: u64,
        b: u64,
    ): u64 {
        let (price, _) = calculate_buy_price(&current_q, outcome_index, amount, b);
        price
    }

    #[view]
    public fun preview_sell_proceeds(
        current_q: vector<u64>,
        outcome_index: u8,
        amount: u64,
        b: u64,
    ): u64 {
        let (price, _) = calculate_sell_price(&current_q, outcome_index, amount, b);
        price
    }
}
